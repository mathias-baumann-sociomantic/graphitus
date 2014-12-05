var dashboards = new Array();
var dashboardsPathInfo = new Array();
var searchIndex = new Array();
var graphiteData = {};

var Graphitus = {
	namespace: function(namespace, obj) {
		var parts = namespace.split('.');
		var parent = Graphitus;
		for (var i = 1, length = parts.length; i < length; i++) {
			var currentPart = parts[i];
			parent[currentPart] = parent[currentPart] || {};
			parent = parent[currentPart];
		}
		return parent;
	},

	keys: function(obj) {
		var keys = [];
		for (var key in obj) keys.push(key);
		return keys;
	},

	extend: function(destination, source) {
		for (var property in source) {
			destination[property] = source[property];
		}
		return destination;
	},

	clone: function(obj) {
		return JSON.parse(JSON.stringify(obj));
	}
};

Graphitus.namespace('Graphitus.Tree');

Graphitus.Tree = function(args) {
	var self = this;
	this.root = {};
	this.pathInfo = [];

	this.add = function(item) {
		this._addRecursive(this.root, item);
		this._addPathInfo(item);
	},
	this._addRecursive = function(parent, item) {
		var parts = item.split(/[\.\/]/);
		var first = parts.shift();
		parent[first] = parent[first] || {};
		if (parts.length) {
			this._addRecursive(parent[first], parts.join('.'));
		}
		return parent[first];
	};

	this._addPathInfo = function(item) {
		var parts = item.split(/[\.\/]/);
		var pathIndex = parts.join('.');
		this.pathInfo[pathIndex] = item;
	}

	this.getPathInfoForItem = function(item) {
		return this.pathInfo[item];
	}

	this.getPathInfo = function() {
		return this.pathInfo;
	}

	this.getRoot = function() {
		return this.root;
	}
};

var graphitusConfig = null;

function loadDashboards() {
	$.ajax({
		type: "get",
		url: graphitusConfig.dashboardListUrl,
		dataType: 'json',
		success: function(json) {
			console.log("Loaded " + json.rows.length + " dashboards");
			var data = json.rows;

			var tree = new Graphitus.Tree();
			for (var i = 0; i < data.length; i++) {
				tree.add(data[i].id);
			}
			dashboards = tree.getRoot();
			dashboardsPathInfo = tree.getPathInfo();
			for (i in json.rows) {
				searchIndex.push(json.rows[i].id);
			}
			loadDashboard();
		},
		error: function(xhr, ajaxOptions, thrownError) {
			console.log(thrownError);
		}
	});
}

function loadGraphitusConfig(callback) {
	$.ajax({
		type: "get",
		url: "config.json",
		dataType: 'json',
		success: function(json) {
			graphitusConfig = json;
			//console.log("Loaded configuration: " + JSON.stringify(graphitusConfig));
			callback();
		},
		error: function(xhr, ajaxOptions, thrownError) {
			console.log(thrownError);
		}
	});
}

function generateDashboardsMenu(name, path, dashboardsRoot, depth) {
	var tmplDashboardsMenu = $('#tmpl-dashboards-menu').html();
	var realpath = dashboardsPathInfo[path];
	return _.template(tmplDashboardsMenu, {
		dashboardsRoot: dashboardsRoot,
		name: name,
		path: path,
		realpath: realpath,
		depth: depth,
		isLeaf: _.isEmpty(dashboardsRoot)
	});
}

function generateDashboardsMenus() {
	var result = "";
	for (idx in dashboards) {
		result += generateDashboardsMenu(idx, idx, dashboards[idx], 0);
	}
	return result;
}


function formatBase1024KMGTPShort(y){
	abs_y = Math.abs(y);
	explicitText = " (" + (Math.round(y * 100) / 100) + ")";
    if (abs_y >= 1125899906842624)  { return parseFloat(y / 1125899906842624).toFixed(2) + "P" + explicitText }
    else if (abs_y >= 1099511627776){ return parseFloat(y / 1099511627776).toFixed(2) + "T" + explicitText }
    else if (abs_y >= 1073741824)   { return parseFloat(y / 1073741824).toFixed(2) + "G" + explicitText }
    else if (abs_y >= 1048576)      { return parseFloat(y / 1048576).toFixed(2) + "M" + explicitText }
    else if (abs_y >= 1024)         { return parseFloat(y / 1024).toFixed(2) + "K" + explicitText }
    else if (abs_y < 1 && y > 0)    { return parseFloat(y).toFixed(2) }
    else if (abs_y === 0)           { return '' }
    else                        	{ return y.toFixed(2) }
}


function loadGraphiteData(target, callback){
	if(graphiteData[target]){
		callback(graphiteData[target]);
		return;
	}
	$.ajax({
		type: "get",
		url: target + "&format=json&jsonp=?",
		dataType:'json',
		success: function(json) {
			graphiteData[target] = json;
			callback(json);
		},
		error:function (xhr, ajaxOptions, thrownError){
			console.log(thrownError);
		}
	});
}

function getColorList(targetUri) {
	var uriColors = new RegExp('[\\?&]colorList=([^&#]*)').exec(targetUri);
	var defaultColors = graphitusConfig.defaultColorList;
	var effectiveColorList = uriColors !== null ? uriColors[1] : defaultColors;
	return effectiveColorList.split(',').map(graphiteToRickshawColor);
}

function graphiteToRickshawColor(graphiteColor) {
	colorReplacements={
		"black":"#000000",
		"white":"#FFFFFF",
		"blue":"#6464FF",
		"green":"#00C800",
		"red":"#C80032",
		"yellow":"#FFFF00",
		"orange":"#FFA500",
		"purple":"#C864FF",
		"brown":"#966432",
		"aqua":"#969600",
		"gray":"#AFAFAF",
		"grey":"#AFAFAF",
		"magenta":"#FF00FF",
		"pink":"#FF6464",
		"gold":"#C8C800",
		"rose":"#C896C8",
		"darkblue":"#0000FF",
		"darkgreen":"#00FF00",
		"darkred":"#FF0000",
		"darkgray":"#6F6F6F",
		"darkgrey":"#6F6F6F",
	}
	graphiteColor = graphiteColor.replace("%23","#");
	rickshawColor = colorReplacements[graphiteColor] !== undefined ? colorReplacements[graphiteColor] : graphiteColor;
	return rickshawColor;
}

function getMetricsListFromTargetUri(targetUri) {
	var metricsList = new Array();

	$.ajax({
		type: "get",
		url: targetUri + "&format=json&jsonp=?",
		dataType:'json',
		async: false,
		success: function(data) {
			$.each(data, function(index, metricId) {
				metricsList.push(metricId.target);
			});
		},
		error:function (xhr, ajaxOptions, thrownError){
			console.log(thrownError);
		}
	});

	return (metricsList);
}
