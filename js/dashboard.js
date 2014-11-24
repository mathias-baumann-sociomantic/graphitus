var lastUpdate = new Date();
var lastExecution = 0;
var autoRefershRef = null;
var refreshIntervalRef = null;
var config = null;
var autoRefreshEnabled = false;
var parameterDependencies = new Array();
var dynamicParams = new Array();
var rawTargets = new Array();
var textValuesCurrent = new Array();

function renderGraphitus() {
	$('#dashboards-view').hide();
	$('#parameters-toolbar').hide();
	loadDashboards();
}

function renderView() {
	renderParamToolbar();
	var tmplToolbarMarkup = $('#tmpl-toolbar').html();
	var tmplDashboardViewMarkup = $('#tmpl-dashboards-view').html();
	var dashboardsMenu = generateDashboardsMenus();
	var title = (config.title.length < 15) ? config.title : config.title.substring(0, 15) + "...";
	$("#toolbar").append(_.template(tmplToolbarMarkup, {
		config: config,
		title: title,
		dashboardsMenu: dashboardsMenu
	}));
	loadTimezone();
	initializeSearch();
	console.log("rendered toolbar");

	generateDynamicGraphs();
	generateConditionalGraphs();

	$("#dashboards-view").append(_.template(tmplDashboardViewMarkup, {
		config: config
	}));
	$('.dropdown-menu input, .dropdown-menu label, .dropdown-menu select').click(function(e) {
		e.stopPropagation();
	});

	$("[rel='tooltip']").tooltip();

	initializeGraphParams();

	console.log("rendered dashboard view");
}

function updateDashboardTitle() {
	var updatedTitle=applyParameters(config.title) + ' ';
	var shortUpdatedTitle = (config.title.length < 15) ? config.title : config.title.substring(0, 15) + "...";
	document.title = updatedTitle + "Dashboard";
	$("#dashboard_title").html(shortUpdatedTitle);
}

function loadView() {
	updateGraphs();
	toggleAutoRefresh();
	renderSource();
	document.title = config.title + " Dashboard";
	$("#start").datetimepicker({
		timeFormat: 'hh:mm',
		dateFormat: 'yymmdd',
		hourGrid: 4,
		minuteGrid: 10
	});
	$("#end").datetimepicker({
		timeFormat: 'hh:mm',
		dateFormat: 'yymmdd',
		hourGrid: 4,
		minuteGrid: 10
	});

}

function loadDashboard() {
	var dashId = queryParam('id');
	var dashboardUrl = applyParameter(graphitusConfig.dashboardUrlTemplate, "dashboardId", dashId);
	$.ajax({
		type: "get",
		url: dashboardUrl,
		dataType: 'json',
		cache: false,
		success: function(data) {
			if (data.error) {
				alert("No dashboard information " + dashId);
				return;
			}
			console.log("fetched [" + dashboardUrl + "]");
			config = data;

			//backward compatibility
			if (!config.timeBack && config.hoursBack) {
				config.timeBack = config.hoursBack + 'h';
			}
			// end
			if ($.cookie('remember_timeBack')) {
				config.timeBack = $.cookie('remember_timeBack');
				config.from = null;
				config.until = null;
			}
			if ($.cookie('remember_start') && $.cookie('remember_end')) {
				config.from = $.cookie('remember_start');
				config.until = $.cookie('remember_end');
				config.hoursBack = null;
				config.timeBack = null;
			}
			mergeUrlParamsWithConfig(config);
			//console.log("effective config: " + JSON.stringify(config));
			renderView();
			console.log("rendered view");
			loadView();
			console.log("view loaded");
			$("#loader").hide();

			if (config.slideshow == "true") {
				startSlideshow();
			} else {
				$('#dashboards-view').show();
			}
		},
		error: function(xhr, ajaxOptions, thrownError) {
			console.log("error [" + dashboardUrl + "]");
			var tmplError = $('#tmpl-warning-dashboard').html();
			$('#message').html(_.template(tmplError, {
				dashboardId: dashId
			}));
			$('#message').show();
			$("#loader").hide();
		}
	});
}

function updateGraphs() {
	updateDashboardTitle();
	console.log("Updating graphs, start time: " + lastUpdate);
	showProgress();

	$("#permalink").attr("href", generatePermalink());
	for (var i = 0; i < config.data.length; i++) {
		updateGraph(i);
	}

	lastExecution = Math.floor((new Date() - lastUpdate) / 1000);
	lastUpdate = new Date();
	hideProgress();
	console.log("Update complete in: " + (new Date() - lastUpdate) + "ms");
}

function updateGraph(idx) {
	var graph = config.data[idx];
	$('#title' + idx).html(applyParameters(graph.title));
	$('#sLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width / 2, config.height / 2, "render"));
	$('#mLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width, config.height, "render"));
	$('#lLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width * 2, config.height * 2, "render"));
	$('#gLink' + idx).attr('href', buildUrl(idx, graph, graph.title, 0, 0, "graphlot"));
	$('#img' + idx).attr('src', buildUrl(idx, graph, "", config.width, config.height, "render"));
	rawTargets[idx] = buildUrl(idx, graph, graph.title, config.width, config.height, "render");
	$('#source' + idx).val(getGraphSource(graph));
}

function buildUrl(idx, graph, chartTitle, width, height, graphiteOperation) {
	var params = "&lineWidth=" + config.defaultLineWidth + "&title=" + encodeURIComponent(chartTitle) + "&tz=" + $("#tz").val();
	if (config.defaultParameters) {
		params = params + "&" + config.defaultParameters;
	}
	if ($('#graphParams' + idx).val()) {
		params += "&" + $('#graphParams' + idx).val();
	}
	if (config.defaultColorList) {
		params += "&colorList=" + config.defaultColorList;
	}
	var range = "";
	var timeBack = $('#timeBack').val();
	var start = $('#start').val();
	var end = $('#end').val();
	if (timeBack != "") {
		range = "&from=-" + parseTimeBackValue(timeBack);
	} else if (start != "" && end != "") {
		var startParts = start.split(" ");
		var endParts = end.split(" ");
		range = "&from=" + startParts[1] + "_" + startParts[0] + "&until=" + endParts[1] + "_" + endParts[0];
	}

	var legend = "&hideLegend=" + !($("#legend").prop('checked'));
	var size = "&width=" + width + "&height=" + height;

	var refreshStep = (config.refreshIntervalSeconds > graphitusConfig.minimumRefresh) ? config.refreshIntervalSeconds : graphitusConfig.minimumRefresh;
	var prevent_cache = "&preventCache=" + (new Date().getTime() / 1000 / refreshStep | 0);

	targetUri = "";
	var targets = (typeof graph.target == 'string') ? new Array(graph.target) : graph.target;
	for (i = 0; i < targets.length; i++) {
		var effectiveTarget = encodeURIComponent(calculateEffectiveTarget(targets[i]));

		if ($("#average").prop('checked')) {
			targetUri = targetUri + "target=averageSeries(" + effectiveTarget + ")";
		} else if ($("#sum").prop('checked')) {
			targetUri = targetUri + "target=sumSeries(" + effectiveTarget + ")";
		} else {
			targetUri = targetUri + "target=" + effectiveTarget;
		}
		if (i < targets.length - 1) {
			targetUri = targetUri + "&";
		}
	}
	if ($("#events").prop('checked') && config.events) {
		for (i = 0; i < config.events.length; i++) {
			targetUri = targetUri + "&target=drawAsInfinite(" + config.events[i] + ")";
		}
	}
	var userParams = getUserUrlParams(idx);

	return getGraphiteServer() + "/" + graphiteOperation + "/?" + targetUri + legend + params + userParams + range + size + prevent_cache;
}

function getGraphiteServer() {
	return graphitusConfig.graphiteUrl;
}

function getUserUrlParams(idx) {
	var userUrlParams = "";
	userUrlParams += ($("#yMin" + idx).val() != "") ? "&yMin=" + $("#yMin" + idx).val() : "";
	userUrlParams += ($("#yMax" + idx).val() != "") ? "&yMax=" + $("#yMax" + idx).val() : "";
	userUrlParams += ($("#otherUrlParamName" + idx).val() != "" && $("#otherUrlParamValue" + idx).val() != "") ? "&" + $("#otherUrlParamName" + idx).val() + "=" + $("#otherUrlParamValue" + idx).val() : "";
	return userUrlParams;
}

function calculateEffectiveTarget(target) {
	return applyParameters(target);
}

function renderTextValidate(paramGroupName, regexp) {
	var re = new RegExp(regexp);
        if (!re.test($('#' + paramGroupName).val())) {
		document.getElementById(paramGroupName).style.backgroundColor = "#FFAAAA";
		return false;
	} else {
		document.getElementById(paramGroupName).style.backgroundColor = "white";
		return true;
	}
}

function renderParamToolbar() {
	if (config.parameters) {
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			if (paramGroup.type && paramGroup.type == "text") {
				$("#parametersToolbarContent").append('<input type="text" class="input-small" placeholder="' + paramGroup.defaultValue + '" id="' + paramGroupName + '" name="' + paramGroupName + '" value="' + getDefaultValue(paramGroupName, paramGroup) + '" onchange="updateGraphs()" />');
			} else {
				var tmplParamSel = $('#tmpl-parameter-sel').html();
				$("#parametersToolbarContent").append(_.template(tmplParamSel, {
					group: paramGroupName
				}));
				$("#" + paramGroupName).select2({
					placeholder: "Loading " + paramGroupName
				});
				if (paramGroup.type && paramGroup.type == "dynamic") {
					dynamicParams[paramGroupName] = paramGroup;
					loadParameterDependencies(paramGroupName, paramGroup.query);
					renderDynamicParamGroup(paramGroupName, paramGroup);
				} else {
					renderValueParamGroup(paramGroupName, paramGroup);
				}
			}
		});
		$('#parameters-toolbar').show();
	}
}

function generatePermalink() {
	var href = "dashboard.html?id=" + queryParam("id");
	href = href + "&legend=" + $("#legend").prop('checked');
	href = href + "&average=" + $("#average").prop('checked');
	href = href + "&sum=" + $("#sum").prop('checked');
	href = href + "&showEvents=" + $("#events").prop('checked');
	var timeBack = $('#timeBack').val();
	var start = $('#start').val();
	var end = $('#end').val();
	if (timeBack != "") {
		href = href + "&timeBack=" + timeBack;
	} else if (start != "" && end != "") {
		href = href + "&from=" + start + "&until=" + end;
	}

	if (config.parameters) {
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			if ($('#' + paramGroupName)) {
				var paramText;
				if ($('#' + paramGroupName).is('select')) {
					paramText = $('#' + paramGroupName + " option:selected").text();
				} else {
					paramText = $('#' + paramGroupName).val();
				}
				href = href + "&" + paramGroupName + "=" + encodeURIComponent(paramText);
			}
		});
	}
	return href;
}

function renderValueParamGroup(paramGroupName, paramGroup) {
	var tmplParamSelItem = $('#tmpl-parameter-sel-item').html();
	$("#" + paramGroupName).html("");
	$("#" + paramGroupName).append(_.template(tmplParamSelItem, {
		group: paramGroupName,
		params: paramGroup,
		selected: getDefaultValue(paramGroupName, paramGroup)
	}));
	$("#" + paramGroupName).select2({
		placeholder: "Select a " + paramGroupName,
		dropdownAutoWidth: true
	});
	$("#" + paramGroupName).off("change");
	$("#" + paramGroupName).on("change", function(e) {
		updateDependantParameters(paramGroupName);
		var hasDynamicGraphs = false;
		config.data = jQuery.grep(config.data, function (n, i) { hasDynamicGraphs = n.dynamic || hasDynamicGraphs;
		                                                         return n.dynamic != true; });
		generateDynamicGraphs();
		generateConditionalGraphs();

		if ( hasDynamicGraphs == true )
		{
			var tmplDashboardViewMarkup = $('#tmpl-dashboards-view').html();
			// This method leaks memory, using alternative way with document
			// node
			/*$("#dashboards-view").html(_.template(tmplDashboardViewMarkup, {
				config: config
				}));*/
			document.getElementById('dashboards-view').innerHTML = _.template(tmplDashboardViewMarkup, {
				config: config
				});
		}
		initializeGraphParams();
		updateGraphs();
	});
}

function getDefaultValue(paramGroupName, paramGroup) {
	if (queryParam(paramGroupName)) {
		return queryParam(paramGroupName);
	} else if (dynamicParams[paramGroupName] && dynamicParams[paramGroupName].defaultValue) {
		return dynamicParams[paramGroupName].defaultValue;
	} else if (paramGroup && paramGroup.defaultValue) {
		return paramGroup.defaultValue
	} else {
	    return ""
	}
}

function updateDependantParameters(paramGroupName) {
	var dependencies = parameterDependencies[paramGroupName];
	if (dependencies) {
		for (idx in dependencies) {
			var dep = dependencies[idx];
			var paramGroup = dynamicParams[dep];
			if (paramGroup.type && paramGroup.type == "dynamic") {
				renderDynamicParamGroup(dep, paramGroup);
			}
		}
	}
}

function loadParameterDependencies(paramGroupName, path) {
	var dependencies = getDependenciesFromPath(path);
	for (idx in dependencies) {
		if (!parameterDependencies[dependencies[idx]]) {
			parameterDependencies[dependencies[idx]] = new Array();
		}
		parameterDependencies[dependencies[idx]].push(paramGroupName);
	}
}

function getDependenciesFromPath(path) {
	var dependencies = new Array();
	path.replace(/\{(.*?)\}/g, function(g0, g1) {
		dependencies.push(g1);
	});
	return dependencies;
}

function generateDynamicQuery(query) {
	var dependencies = getDependenciesFromPath(query);
	for (idx in dependencies) {
		var dependsOn = dependencies[idx];
		dependValue = $('#' + dependsOn).val();
		if (!dependValue) {
			dependValue = "*";
		}
		query = applyParameter(query, dependsOn, dependValue);
	}
	return encodeURIComponent(query);
}

function getMetricsQueryUrl() {
	if (graphitusConfig.metricsQueryUrl) {
		return graphitusConfig.metricsQueryUrl;
	}
	return getGraphiteServer() + "/metrics/find?format=completer&query=";
}

function renderDynamicParamGroup(paramGroupName, paramGroup) {
	var query = generateDynamicQuery(dynamicParams[paramGroupName].query);
	var queryUrl = getMetricsQueryUrl() + query;
	$.ajax({
		type: 'GET',
		url: queryUrl,
		dataType: 'json',
		success: function(data) {
			var parameters = new Array();
			var parametersSorted = new Array();
			if (paramGroup.showAll) {
				parameters["All"] = new Array();
				parameters["All"][paramGroupName] = new Array();
				parameters["All"][paramGroupName] = (paramGroup.showAllValue) ? applyParameters(paramGroup.showAllValue) : "*";
			}

			$.each(data.metrics, function(i, metric) {
				var paramValue = getParamValueFromPath(paramGroup, metric);
				parametersSorted.push(paramValue);
			});
			parametersSorted.sort();

			$.each(parametersSorted, function(sortedIndex, sortedValue) {
				parameters[sortedValue] = new Array();
				parameters[sortedValue][paramGroupName] = new Array();
				parameters[sortedValue][paramGroupName] = sortedValue;
			});

			config.parameters[paramGroupName] = parameters;
			renderValueParamGroup(paramGroupName, parameters);
		},
		error: function(xhr, ajaxOptions, thrownError) {
			console.log("error [" + xhr + "]");
			var tmplError = $('#tmpl-warning-parameters').html();
			$('#message').html(_.template(tmplError, {
				message: "Could not load graphite parameters from url [" + queryUrl + "]: " + JSON.stringify(xhr.statusText) + "<br/>"
			}));
			$('#message').show();
			$("#loader").hide();
		},
		async: false
	});
}

function endsWith(str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function getParamValueFromPath(paramGroup, metric) {
	var result = "";

	if (paramGroup.index != undefined) {
		var pathParts = metric.path.split(".");
		result = pathParts[paramGroup.index];
	} else {
		result = metric.name;
	}

	return applyRegexToName(paramGroup, result);
}

function applyRegexToName(paramGroup, metric) {
	var result = metric;
	if (paramGroup.regex) {
		var regEx = applyParameters(paramGroup.regex);
		var regexResult = result.match(new RegExp(regEx));
		result = (regexResult) ? regexResult[1] : "";
	}
	return result;
}

function applyParameters(target) {
	if (config.parameters) {
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			var selectedParamText = "";
			if (paramGroup.type && paramGroup.type == "text" ) {
				if (renderTextValidate(paramGroupName, paramGroup.regexp)) {
					selectedParamText = $('#' + paramGroupName).val();
					textValuesCurrent[paramGroupName] = selectedParamText;
				} else {
					selectedParamText = textValuesCurrent[paramGroupName];
				}

				target = applyParameter(target, paramGroupName, selectedParamText);
			} else {
				for (tokenKey in paramGroup[paramGroupName]) {
					var tokenValue = paramGroup[paramGroupName][tokenKey];
					target = applyParameter(target, tokenKey, tokenValue);
				}
				selectedParamText = $('#' + paramGroupName + " option:selected").text();
				for (tokenKey in paramGroup[selectedParamText]) {
					var tokenValue = paramGroup[selectedParamText][tokenKey];
					target = applyParameter(target, tokenKey, tokenValue);
				}
			}
		});
	}
	return target;
}

function multiReplace(str, match, repl) {
	do {
		str = str.replace(match, repl);
	} while (str.indexOf(match) !== -1);
	return str;
}

function applyParameter(originalString, paramName, paramValue) {
	return multiReplace(originalString, "${" + paramName + "}", paramValue);
}

function toggleAutoRefresh() {
	if (config.refresh) {
		enableAutoRefresh();
	} else {
		disableAutoRefresh();
	}
	config.refresh = !config.refresh;
}

function enableAutoRefresh() {
	config.refreshIntervalSeconds = (config.refreshIntervalSeconds > graphitusConfig.minimumRefresh) ? config.refreshIntervalSeconds : graphitusConfig.minimumRefresh;
	console.log("Setting refresh interval to " + config.refreshIntervalSeconds);
	autoRefershRef = window.setInterval("updateGraphs()", config.refreshIntervalSeconds * 1000);
	refreshIntervalRef = window.setInterval("updateRefreshCounter()", 1000);
}

function disableAutoRefresh() {
	window.clearInterval(refreshIntervalRef);
	window.clearInterval(autoRefershRef);
    $("#refreshCounter").html('<label class="badge badge-warning">Auto Refresh Disabled<br/></label>');
}

function updateRefreshCounter() {
	var remaining = config.refreshIntervalSeconds - Math.floor(((new Date().getTime()) - lastUpdate.getTime()) / 1000);
	$("#refreshCounter").html('<label class="badge badge-success">update in ' + remaining + 's<br/>' + "</label>");
}

function showProgress() {
	$("#refreshCounter").hide();
	$("#loadingProgress").show();
}

function hideProgress() {
	$("#refreshCounter").show();
	$("#loadingProgress").hide();
}

function useHours() {
	$("#start,#end").val("");
	$.removeCookie('remember_start');
	$.removeCookie('remember_end');
	if ($("#timeBack").val() != "") {
		$.cookie('remember_timeBack', ($("#timeBack").val()));
		updateGraphs();
	}
}

function useDateRange() {
	$("#timeBack").val("");
	$.removeCookie('remember_timeBack');
	if ($("#start").val() != "" && $("#end").val() != "") {
		$.cookie('remember_start', ($("#start").val()));
		$.cookie('remember_end', ($("#end").val()));
		updateGraphs();
	}
}

function parseTimeBackValue(timeBack) {
	var delimiterIdx = timeBack.length - 1;
	if (timeBack.lastIndexOf('w') == delimiterIdx) {
		return timeBack.replace('w', 'weeks');
	} else if (timeBack.lastIndexOf('d') == delimiterIdx) {
		return timeBack.replace('d', 'days');
	} else if (timeBack.lastIndexOf('h') == delimiterIdx) {
		return timeBack.replace('h', 'hours');
	} else if (timeBack.lastIndexOf('m') == delimiterIdx) {
		return timeBack.replace('m', 'minutes');
	} else {
		return timeBack + 'hours';
	}
}

function queryParam(name) {
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\?&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(window.location.search);
	if (results == null) {
		return null;
	} else {
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	}
}

function mergeUrlParamsWithConfig(config) {
	if (queryParam('hoursBack') != null) {
		config.hoursBack = queryParam('hoursBack');
	}
	if (queryParam('timeBack') != null) {
		config.timeBack = queryParam('timeBack');
	}
	if (queryParam('from') != null && queryParam('until') != null) {
		config.from = queryParam('from');
		config.until = queryParam('until');
		config.hoursBack = null;
		config.timeBack = null;
	}
	if (queryParam('columns') != null) {
		config.columns = queryParam('columns');
	}
	if (queryParam('theme') != null) {
		config.theme = queryParam('theme');
	}
	if (queryParam('width') != null) {
		config.width = queryParam('width');
	}
	if (queryParam('height') != null) {
		config.height = queryParam('height');
	}
	if (queryParam('legend') != null) {
		config.legend = queryParam('legend');
	}
	if (queryParam('showEvents') != null) {
		config.showEvents = queryParam('showEvents');
	}
	if (queryParam('averageSeries') != null) {
		config.averageSeries = queryParam('averageSeries');
	}
	if (queryParam('sumSeries') != null) {
		config.sumSeries = queryParam('sumSeries');
	}
	if (queryParam('defaultLineWidth') != null) {
		config.defaultLineWidth = queryParam('defaultLineWidth');
	}
	if (queryParam('defaultParameters') != null) {
		config.defaultParameters = queryParam('defaultParameters');
	}
	if (queryParam('slideshow') != null) {
		config.slideshow = queryParam('slideshow');
	}

    if (config.columns != null) {
        if (config.width != null) { 
		    var graphsMargin = 25;
		    var dasboardsViewWidth = config.columns * ( config.width + graphsMargin);
		    $('#dashboards-view').css({'width':dasboardsViewWidth});
		    console.log("adjust view to columns setting to: " + config.columns + " columns");
        } else {
		    var graphsMargin = 25;
            var dasboardsViewWidth = $('#dashboards-view').width();
            config.width = ( dasboardsViewWidth / config.columns ) - graphsMargin;
            console.log("adjust graph width setting to: " + config.width + " px");
            if (config.height == null) {
                var heightNormal = config.width * 3 / 4;
                var heightWide = config.width * 9 / 16;
                config.height = heightWide;
                console.log("adjust graph height setting to: " + config.height + "px");
            }
        }
    }
}

function getGraphSource(graph) {
	var result = new Array();
	if ((typeof graph.target) === 'string') {
		result.push(calculateEffectiveTarget(graph.target));
	} else {
		for (idx in graph.target) {
			result.push(calculateEffectiveTarget(graph.target[idx]));
		}
	}
	return result.join("\n");
}

function renderSource() {
	$('.source').width(config.width - 10);
}

function toggleSource(idx) {
	if ($('#sourceContainer' + idx).is(":visible")) {
		$('#sourceContainer' + idx).hide();
		$('#img' + idx).show();
	} else {
		$('#sourceContainer' + idx).show();
		$('#img' + idx).hide();
	}
}

function updateSource(idx) {
	config.data[idx].target = $('#source' + idx).val();
	updateGraph(idx);
	toggleSource(idx);
	return false;
}

function initializeSearch() {
	$('#search').typeahead({
		source: searchIndex,
		matcher: function(item) {
			var searchingWords=this.query.replace(/ /g, ".*");
			return item.match(searchingWords);
		},
		highlighter: function(item) {
			var matchingWords=this.query.split(" ");
			for (word = 0; word < matchingWords.length; ++word) {
				item = item.replace(matchingWords[word], "<b>" + matchingWords[word] + "</b>");
			}
			return item;
		},
		updater: function(selection) {
			document.location.href = "dashboard.html?id=" + selection;
		},
		items: 9999,
		minLength: 2
	});
}

function generateDynamicGraphs() {
	if ( config.dataTemplates == undefined ) return;

	var fixed_graphs = config.data.length;

	var queryCache = new Array();
	var queryCacheContents = new Array();

	for (var i = 0; i < config.dataTemplates.length; i++)
	{
		var tmpl = config.dataTemplates[i];
		var url = getGraphiteServer() + "/metrics/find?format=completer&query=";
		var query = generateDynamicQuery(tmpl.query);
		var queryUrl = url + query;
		var parameters = new Array();

		// resolve the template dynamic query. and cache
		if ( queryCache.indexOf(query) == -1 ) { 
			queryCache.push(query);
			queryCacheContents[query] = new Array();
			$.ajax({
				type: 'GET',
				url: queryUrl,
				dataType: 'json',
				success: function(data) {
					$.each(data.metrics, function(index, metric) {
						var value = getParamValueFromPath(tmpl, metric);
						if ( queryCacheContents[query].indexOf(value) == -1 ) {
							queryCacheContents[query].push(value)
						}
		 			});
		 		},
		 		error: function(xhr, ajaxOptions, thrownError) {
		 			console.log("error [" + xhr + "]");
		 			var tmplError = $('#tmpl-warning-parameters').html();
		 			$('#message').html(_.template(tmplError, {
		 				message: "Could not load graphite parameters from url [" + queryUrl + "]: " + JSON.stringify(xhr.statusText) + "<br/>"
		 			}));
		 			$('#message').show();
		 			$("#loader").hide();
		 		},
		 		async: false
		 	});
		};

		// add graphs for each matching exploded value
		$.each(queryCacheContents[query], function(index, paramValue) {
			if ( parameters.indexOf(paramValue) == -1 )	{
				parameters.push(paramValue);
				var g = new Object();

				// apply parameter
				if ( (typeof tmpl.target) === 'string' ) {
					g.target = applyParameter(tmpl.target, "explode", paramValue);
				} else {
					tmpl.target.forEach(function(t) {
						if (typeof g.target === 'undefined') {
							g.target=new Array();
						}
						g.target.push(applyParameter(t, "explode", paramValue));
					});
				}

				g.title = applyParameter(tmpl.title, "explode", paramValue);
				g.dynamic = true;
				g.params = tmpl.params;

				// sort the new metric in the right position, alphabetically
				var was_added = false;
				$.each(config.data, function(index, d ) {
					if ( index < fixed_graphs ) return true;

					if ( d.title > g.title ) {
						config.data.splice(index, 0, g);
						was_added = true;
						return false;
					}
				});
				if ( was_added == false ) { config.data.push(g); };
			}
		});

	} // end of loop for each dataTemplates

}

function initializeGraphParams() {
	for (var i = 0; i < config.data.length; i++) {
		$('#graphParams' + i).val(config.data[i].params);
	}
}

function setTimezone() {
	console.log("timezone set: " + $("#tz").val());
	$.cookie('graphitus.timezone', $("#tz").val());
}

function loadTimezone() {
	var tz = "";
	if (queryParam("tz")) {
		tz = queryParam("tz");
		console.log("timezone loaded from url param: [" + tz + "]");
	} else if (config.tz) {
		tz = config.tz;
		console.log("timezone loaded from dashboard config: [" + tz + "]");
	} else {
		tz = $.cookie('graphitus.timezone');
		console.log("timezone loaded from cookie: [" + tz + "]");
	}
	if (tz && tz !== "") {
		$("#tz").val(tz);
	}
}

function showExtendedGraph(idx) {
	$(".lightbox-content").css("width", $(window).width() - 100);
	$(".lightbox-content").css("height", $(window).height() - 100);
	$('#extendedGraph').lightbox({
		resizeToFit: false
	});
	setRickshawPalette(getColorList(rawTargets[idx]));
	loadExtendedGraph(rawTargets[idx], applyParameters(config.title), applyParameters(config.data[idx].title));
	$(".rickshaw_legend").css("height", $(window).height() - 220);
}

function showHistogram(idx) {
	$(".lightbox-content").css("width", $(window).width() - 200);
	$(".lightbox-content").css("height", $(window).height() - 200);
	$('#hitogramLightbox').lightbox({
		resizeToFit: false
	});
	loadHistogram(rawTargets[idx], applyParameters(config.title), applyParameters(config.data[idx].title));
}

function showGraphEvolution(idx) {
	$(".lightbox-content").css("width", $(window).width() - 100);
	$(".lightbox-content").css("height", $(window).height() - 100);
	$('#graphEvolutionLightbox').lightbox({
		resizeToFit: false
	});
	loadGraphEvolution(rawTargets[idx], applyParameters(config.title), applyParameters(config.data[idx].title));
}

function togglePinnedParametersToolbar() {
	if ($("#parametersToolbarPin i").hasClass("fa-lock")) {
		$("#parametersToolbarPin").html("<i class='fa fa-lg fa-unlock'/>");
		$("#parameters-toolbar").css("position", "fixed");
		$("#parameters-toolbar").css("width", "100%");
		$("#parameters-toolbar").css("opacity", ".85");
	} else {
		$("#parametersToolbarPin").html("<i class='fa fa-lg fa-lock'/>");
		$("#parameters-toolbar").css("position", "relative");
		$("#parameters-toolbar").css("opacity", "1");
	}
}

function generateConditionalGraphs(){
	if ( config.dataConditional == undefined ) return;

	var fixed_graphs = config.data.length;

	var queryCache = new Array();
	var queryCacheContents = new Array();

	for (var i = 0; i < config.dataConditional.length; i++)
	{
		var tmpl = config.dataConditional[i];
		var url = getGraphiteServer() + "/metrics/find?format=completer&query=";
		var query = generateDynamicQuery(tmpl.query);
		var queryUrl = url + query;
		var parameters = new Array();

		// resolve the template dynamic query. and cache
		if ( queryCache.indexOf(query) == -1 ) {
			queryCache.push(query);
			queryCacheContents[query] = new Array();

			$.ajax({
				type: 'GET',
				url: queryUrl,
				dataType: 'json',
				success: function(data) {
					$.each(data.metrics, function(index, metric) {
						var value = getParamValueFromPath(tmpl, metric);
						if ( queryCacheContents[query].indexOf(value) == -1 ) {
							queryCacheContents[query].push(value)
						}
					});
				},
				error: function(xhr, ajaxOptions, thrownError) {
					console.log("error [" + xhr + "]");
					var tmplError = $('#tmpl-warning-parameters').html();
					$('#message').html(_.template(tmplError, {
						message: "Could not load graphite parameters from url [" + queryUrl + "]: " + JSON.stringify(xhr.statusText) + "<br/>"
					}));
					$('#message').show();
					$("#loader").hide();
				},
				async: false
			});
		};

		// use cache to avoid extra ajax calls
		$.each(queryCacheContents[query], function(index, paramValue) {
			if ( parameters.indexOf(paramValue) == -1 )	{ parameters.push(paramValue); }
		});
		var g = new Object();

		// compose parameter and apply it to the new graph
		var expandedValues = '{' + parameters.join(',') + '}';
		if ( (typeof tmpl.target) === 'string' ) {
			g.target = applyParameter(tmpl.target, "explode", expandedValues);
		} else {
			tmpl.target.forEach(function(t)	{
				if (typeof g.target === 'undefined') { g.target=new Array(); }
				g.target.push(applyParameter(t, "explode", expandedValues));
			});
		}

		g.title = applyParameter(tmpl.title, "explode", expandedValues);
		g.dynamic = true;
		g.params = tmpl.params;

		// sort the new metric in the right position, alphabetically
		var was_added = false;
		$.each(config.data, function(index, d ) {
			if ( index < fixed_graphs ) return true;

			if ( d.title > g.title ) {
				config.data.splice(index, 0, g);
				was_added = true;
				return false;
			}
		});

		if ( was_added == false ) { config.data.push(g); }
	}
}
