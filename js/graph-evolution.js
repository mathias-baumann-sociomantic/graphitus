//var histogramSeriesMethod = 'avg';

function loadGraphEvolution(target, dashboardTitle, graphTitle) {

console.log("target received is :");
console.log(target);
console.log("graphTitle: " + graphTitle);
console.log("dashboardTitle: " + dashboardTitle);

	$("#graphEvolution").html("");
	$("#graphEvolutionWarning").hide();
	$("#graphEvolutionTitle").text("Evolution of graph " + graphTitle); // + " on dashboard " + dashboardTitle);
	$("#graphEvolutionProgress").show();
	//$("#graphEvolutionProgressText").text("Accessing Graphite metrics API");
	//loadGraphiteData(target, function(json) {
		$("#graphEvolutionProgressText").text("Rendering graph evolution");
		renderGraphEvolution(graphTitle, target);
		$("#graphEvolutionProgress").hide();
	//});
}

function renderGraphEvolution(graphTitle, graphUrl) {
    var htmlContent="";
	var w = parseInt($(".lightbox-content").css("width")) - 30;
	var h = parseInt($(".lightbox-content").css("height")) - 150;
	var margin = {
		right: 300,
		left: 300
	},
		width = w - margin.left - margin.right,
        heightStd = width * 3 / 4;
        heightWide = width * 9 / 16;
        height = heightWide;

    var extraGraphiteParams='&title=&hideLegend=false&fontSize=11&width=' + width + '&height=' + height

    htmlContent+='<img src="' + graphUrl + extraGraphiteParams + '&from=-6hours&title=Graph for the last 6 hours:"><br/>' + "\n";
    htmlContent+='<img src="' + graphUrl + extraGraphiteParams + '&from=-1days&title=Graph for the last 1 days:"><br/>' + "\n";
    htmlContent+='<img src="' + graphUrl + extraGraphiteParams + '&from=-1week&title=Graph for the last 1 weeks:"><br/>' + "\n";
    htmlContent+='<img src="' + graphUrl + extraGraphiteParams + '&from=-1month&title=Graph for the last 1 month:"><br/>' + "\n";
    htmlContent+='<img src="' + graphUrl + extraGraphiteParams + '&from=-1year&title=Graph for the last 1 year:"><br/>' + "\n";

    $("#graphEvolution").html(htmlContent);
}