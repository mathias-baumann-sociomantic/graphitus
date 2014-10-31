[Graphitus Homepage](http://ezbz.github.io/graphitus)

Introduction
============
A simple, client-side, JSON-based [Graphite](http://graphite.wikidot.com/) logical-dashboard UI built with [bootstrap](http://twitter.github.com/bootstrap/) and [underscore.js](http://underscorejs.org/)

Installation
============
Graphitus is pure client side, all you have to do to run it is put it under a web-server that can serve HTTP requests.

Configuration
=============

Graphitus dashboards are defined using JSON notation. These configuration snippets can be stored in a document database like [couchdb](http://couchdb.apache.org/) or [mongo](http://www.mongodb.org/) and can also be files on the server.

Graphitus Configuration
-----------------------

Below is an example of global configuration (a file named ```config.json```) using static local JSON files (the dashboards ids are the file names with a ```.json``` extension):

```javascript
{
    "graphiteUrl": "http://graphite.mysite.com",
    "dashboardListUrl": "dashboard-index.json",
    "dashboardUrlTemplate": "${dashboardId}.json",
    "eventsUrl": "events.json?start=<%=start%>&end=<%=end%>",
    "eventsDateFormat": "HH:mm:ss DD/MM/YYYY",
    "eventsTimezone": "US/Eastern",
    "minimumRefresh": 60,
    "metricsQueryUrl": "http://my.graphite.com/metrics/find?format=completer&query=",
    "grafanaElasticSearch": "http://my.elasticsearch.com:9200/grafana-dash/dashboard/",
    "grafanaUrl" : "http://my.grafana.com/index.html#/dashboard/elasticsearch/",
    "timezones": ["US/Eastern", "US/Central", "US/Pacific", "Europe/London", "Israel"]
}
```

Below is an example of global configuration (a file named ```config.json```) using couch db:

```javascript
{
    "graphiteUrl": "http://graphite.mysite.com",
    "dashboardListUrl": "http://couch.mysite.com:5984/graphitus-dashboards/_all_docs", // must return a JSON with a "rows" element containing an array of rows with dashboard id ("id" attribute)
    "dashboardUrlTemplate": "http://couch.mysite.com:5984/graphitus-dashboards/${dashboardId}",
    "eventsUrl": "events.json?start=<%=start%>&end=<%=end%>", // events for rickshaw graph, start/end timeframe will be passed 
    "eventsDateFormat": "HH:mm:ss DD/MM/YYYY", // the event date-time format
    "eventsTimezone": "US/Eastern",
    "minimumRefresh": 60, // minimum refresh overrides anything defined in the dashboards
    "metricsQueryUrl": "http://my.graphite.com/metrics/find?format=completer&query=", // metrics finder url, overriding this allows proxying/caching the graphite metrics finder
    "grafanaElasticSearch": "http://my.elasticsearch.com:9200/grafana-dash/dashboard/", // optional grafana elasticsearch url for grafana export integration
    "grafanaUrl" : "http://my.grafana.com/index.html#/dashboard/elasticsearch/", // optional grafana home url for grafana export integration
    "timezones": ["US/Eastern", "US/Central", "US/Pacific", "Europe/London", "Israel"] // a list of timezone for graphite
}
```

Dashboard Configuration
-----------------------

Below is an example dashboard configuration:
```javascript
{
    "title": "MySQL Production Cluster", // give a title to page   
    "columns": 2, // the number of charts in a row side by side, mostly 2 or 4
    "user": "erezmazor", // owner   
    "timeBack": 12h, // time range back from current time (can be expressed in minutes/hours/days/weeks e.g., 30m/12h/1d/2w)    
    "from": "", // start date for the date range, prefer timeBack as any date you choose will become stale  
    "until": "", // end date for the date range, prefer timeBack as any date you choose will become stale   
    "width": 700, // width of each chart image, should correlate with # columns defined
    "height": 450, // height of each chart image
    "legend": true, // show the legend in chart
    "refresh": true, // auto refresh
    "refreshIntervalSeconds": 90, // auto refresh interval in seconds
    "averageSeries": false, // for targets that aggregate a lot of metrics prefer setting this to true as it will average many lines into one
    "defaultLineWidth": 2, // line width for chart lines
    "defaultParameters": "areaMode=stacked&areaAlpha=.5", // default url parameters to be applied to all targets
    "tz": "US/Eastern", // timezone for the rendered graph
    "data": [ // charts list
        {
            "title": "Slow Queries", // a title for the chart image
            "target": "groupByNode(machines.${dc}dc1.mysql*.Slow_queries,2,\"nonNegativeDerivative\")", // the graphite target/function which defines the chart content
            "params": "areaMode=stacked&lineMode=staircase&colorList=blue,red,green" // specify additional parameters for this target
        }, {
            "title": "Seconds Behind Master",
            "target": "groupByNode(machines.${dc}dc1.mysql*.Seconds_Behind_Master,2,\"averageSeries\")"
        }, {
            "title": "Queries Per Second",
            "target": [ // you can specify mutliple targets for a chart as a JSON array
                "derivative(machines.${dc}dc1.mysql*.Qps1)",
                "derivative(machines.${dc}dc1.mysql*.Qps2)"
            ],
            "description": "The number of queries per second executed by the server" // show a description tooltip next to the title
        }
    ],
    "parameters": { // parameters to tokens expressed in targets with ${paramName} format  
        "datacetner": { // label for a select box in the UI
            "All": { // display name for a select box in the UI
                "dc": "*" // the token name (dc) as specified in the target name and the actual token value (*)            
            },
            "New York": {
                "dc": "ny"
            },
            "LA": {
                "dc": "la"
            },
            "Chicago": {
                "dc": "chi"
            }
        }
    }
}
```

* Below is a screenshot of a sample dashboard:

![Screenshot](https://raw.github.com/erezmazor/graphitus/master/doc/screenshot.png)

* Clicking on a graph image will generate a nice [Rickshaw](http://code.shutterstock.com/rickshaw/)-based graph with hover-values and a toggle-legend

![Extended](https://raw.github.com/erezmazor/graphitus/master/doc/extended.png)

** Events on rickshaw graph

supplying an ```eventsUrl``` attribute in config.json will allow you to draw an events overlay on the rickshaw graph. The selected timeframe will be passed in to the ```eventsUrl``` in the format ```eventsUrl?start=YYYY-MM-DD HH:mm:ss&end=YYYY-MM-DD HH:mm:ss```. events must be in the following JSON format:

```javascript
[
	{
    	"message": "this is an event message",
		"start": "15:31:35 28/03/2013",
		"end": "15:33:47 28/03/2013"
	},
{
    	"message": "this is an event message",
		"start": "15:31:35 28/03/2013",
		"end": "15:33:47 28/03/2013"
	}
]
```
The date/time format and timezone can be customized by providing a ```eventsDateFormat``` and ```eventsTimezone``` properties in the  ```config.json``` configuration file.

* Clicking on a the ```histogram``` button (![Histogram](https://raw.github.com/erezmazor/graphitus/master/doc/histogram.png)) will generate a [D3 Histogram](https://github.com/mbostock/d3/wiki/Histogram-Layout)

![Histogram](https://raw.github.com/erezmazor/graphitus/master/doc/histogram-lightbox.png)

* Clicking on a the ```source``` button (![Source](https://raw.github.com/erezmazor/graphitus/master/doc/source.png)) will show the target source and allow you to edit it in place

![Source Editor](https://raw.github.com/erezmazor/graphitus/master/doc/source-editor.png)

* Clicking on a the ```functions``` button (![Functions](https://raw.github.com/erezmazor/graphitus/master/doc/functions.png)) will show some options for manipulating the graph using the [Graphite URL API](https://graphite.readthedocs.org/en/latest/render_api.html)

![Function Options](https://raw.github.com/erezmazor/graphitus/master/doc/functions-drop.png)

* Clicking on a the ```images``` button (![Images](https://raw.github.com/erezmazor/graphitus/master/doc/images.png)) will show a drop down with permalinks to the image in small, medium and large sizes (useful for sending links or copying images into email)

![Images](https://raw.github.com/erezmazor/graphitus/master/doc/images-drop.png)

* Clicking on a the ```graphlot``` button (![Graphlot](https://raw.github.com/erezmazor/graphitus/master/doc/graphlot.png)) will redirect you to the graph's ```Graphlot``` page in your graphite server.

* Override configuration with URL parameters

You can specify configuration properties in the dashboard URL to override default settings:

`dashboard.html?id=grp1.dash1&defaultLineWidth=25&timeBack=20m&width=350&height=400&columns=4&legend=false`
        
You can also specify parameter values in the URL:

`dashboard.html?id=grp1.dash1&datacenter=LA`


Configuration attributes
------------------------

Parameter              | Required?       | Description
---------------------- | --------------- | ---------------------------------
title                   | Yes             | The title of the dashboard chart
columns                 | Yes             | The number of images in a row
user                    | No              | Owner
timeBack                | No              | Specify timeframe back from current time to display (specify this or ```from``` and ```until```), shorthand format e.g., ```15m```, ```24h```, ```7d```, ```1w```
from                    | No              | From date/time in ```yyyy-MM-dd HH:MM``` (specify this and ```until``` or ```timeBack```)
until                   | No              | To date/time in ```yyyy-MM-dd HH:MM``` (specify this and ```from``` or ```timeBack```)
width                   | Yes             | Width of the chart from graphite (see ```columns```)
height                  | Yes             | Height of the chart from graphite
legend                  | No              | Show/Hide the legend in the chart (omitting leaves it up to graphite)
refresh                 | No              | Auto-refresh the charts (see ```refreshIntervalSeconds```)
refreshIntervalSeconds  | No              | When ```refresh``` is ```true``` this will determine the refresh interval
defaultLineWidth        | No              | The line width for the generated chart
defaultParameters       | No              | Default [url parameters](https://graphite.readthedocs.org/en/latest/render_api.html) to be applied to all targets
tz                      | No              | The timezone for the rendered graphite images (see [Timezone list](http://en.wikipedia.org/wiki/List_of_tz_database_time_zones)). Note: timezone resolution is in the following order url, json configuraiton file, cookie, default.

Dynamic Parameters
------------------

Dynamic parameters allow you to define metric selection and filtering based on dynamic graphite metric API queries. Structuring your graphite metrics tree properly can be useful to create such dashboaards.

Consider the following configuration for the ```parameters``` section of the configuration

```javascript
"service": {
    "type": "dynamic",
    "query": "services.prod.*",
    "index": 2,
    "showAll": false
}, 
 "host": {
    "type": "dynamic",
    "query": "services.prod.${service}.*",
    "index": 3,
    "regex": "(.*)_",
    "showAll": true
}, 
 "datacenter": {
    "type": "dynamic",
    "query": "services.prod.${service}.${host}_*",
    "index": 3,
    "regex": "_(.*)",
    "showAll": true,
    "showAllValue": "host-10000*"
}
```

You can then use a target like ```services.prod.${service}.${host}_${datacenter}.someAttribute```. When graphitus loads it will generate select boxes based on the actual values returned from the graphite metric API based on the provided queries. Note that the queries themselves can be parameterized, creating a series of select boxes depending on each other in-order.

Graphitus will also consider generating the list of values from a partial path, the index and regex determine which portion and substring (regex) of the resulting path will be used to generate the values for selection. The ```showAll``` property is used to determine if graphitus will prepend a default All (translated to ```*``` in the graphite query) option to the selection. The ```showAllValue``` parameter can be added to override the default ```*``` selection for complex name filtering schemes (you can have token in this value to express dependencies on other parameters).

Text Parameters
---------------

Text parameters allow you to create custom text box. It is useful when there is too much dynamic data for dynamic parameter.

Consider the following configuration for the ```parameters``` section of the configuration

```javascript
"campaign" : {
	"type" : "text",
	"default" : "114",
	"regexp" : "^[0-9]+$"
}
```

This will add parameter named ```campaign``` with default value "114". Input will be checked agains regular expression, defined in "regexp". All fields are mandatory.

Naming and grouping techniques
------------------------------

Graphitus path tokenization works well when you structure youd graphite metrics according to a well defined scheme. Consider the following path for graphite metrics: ```services.prod.myService.dc1.host1.myMetric.value``` which can be tokenized as ```services.${environment}.${service}.${datacenter}.${host}.${metric}.value```

This well-structured hierarchy provides powerful grouping capabilities, for example using the above path structure you can create a generic grouping scheme where you can group values by different aspects. This is achieved using the ```groupByNode``` or ```aliasByNode``` graphite functions. Here is the graphitus target definition:

```javascript
"data": [{
	"target": "groupByNode(services.${environment}.${service}.${datacenter}.${host}.${metric}.value,${group},\"averageSeries\")",
	"title": "Metric A Value"
}]
```

And the corresponding ```parameters``` section:

```javascript
"parameters": {
    "environment": {
        "type": "dynamic",
        "query": "services.*",
        "index": 1,
        "showAll": true
    },
    "service": {
        "type": "dynamic",
        "query": "services.${environment}.*",
        "index": 2,
        "showAll": true
    },
    "datacenter": {
        "type": "dynamic",
        "query": "services.${environment}.${service}.*",
        "index": 3,
        "showAll": true
    },
    "host": {
        "type": "dynamic",
        "query": "services.${environment}.${service}.${datacenter}.*",
        "index": 4,
        "showAll": true
    },
    "metric": {
        "type": "dynamic",
        "query": "services.${environment}.${service}.${datacenter}.${host}.*",
        "index": 5,
        "showAll": true
    },
    "group": {
        "environment": {
            "group": 1
        },
        "service": {
            "group": 2
        },
        "datacenter": {
            "group": 3
        },
        "host": {
            "group": 4
        },
        "metric": {
            "group": 5
        }
    }
}
```

Dynamically Defined Graphs
--------------------------

Dynamically defined Graphs are very similar to dynamic parameters. Instead of getting a select menu to pick among several options, all options used and for each one a graph is generated:


```javascript
{      
    "title":" Stats",
        "width" : 500,
        "defaultLineWidth":1,
        "timeBack":"6h",
        "height" : 300,
        "columns" : 2, 
        "refresh" : true, 
        "dataTemplates" : [ 
        {      
            "title":"Nginx ${continent}-${explode} Requests/sec", 
            "target" : "aliasByNode(${continent}-${explode}.nginx.nginx_*,0,3)", 
            "query" : "${continent}-*.nginx.nginx_*", 
            "regex" : "-(.*)", 
            "index" : 0, 
            "params" : "yMin=0&hideLegend=false"
        }      
    ],     
        "data":[ 
        { 
            "title":"${continent} Nginx Total Requests/sec", 
            "target" : "groupByNode(${continent}-*.nginx.nginx_*,3,\"sumSeries\")", 
            "params" : "yMin=0&hideLegend=false" 
        }, 
        ],     
        "parameters": { 
            "continent": { 
                "EU" : {"continent" : "eu" }, 
                "US" : {"continent" : "us" }, 
                "AP" : {"continent" : "ap" } 
            } 
        }                        
}              
```

In the example above, for each server number one graph will be generated (and also a statically defined "global" graph). For each generated graph the `${explode}` variable will be replaced with the matched regex at the given index.
The available options are basically the same as for dynamic parameters.

Timezone support
------------------

Graphitus supports timezones via configuration ```config.json``` has a ```timezones``` attribute which accepts an array. These are timezones supported by the [Graphite URL API Timezone parameter](https://graphite.readthedocs.org/en/latest/render_api.html#tz). Timezones are supported using the [moment-timezone](http://momentjs.com/timezone/) library. In order to correctly define timezones use the [moment-timezone data builder](http://momentjs.com/timezone/data/) to customize your own ```js/moment-timezone-data.js``` file. Note that moment zone names are different from graphite names, once you generate the ```js/moment-timezone-data.js``` file edit it and change timezone names to correspond to the supported graphite names.


Slideshow
------------------

A slideshow of all graphs in the dashboard can be triggered via the UI button or by appending ```&slideshow=true``` at the end of the dashboard URL.

Grafana Integration
-------------------

[Grafana](https://github.com/torkelo/grafana) is another dashboard based system. Some beta functionality for exporting Graphitus dashboards to Grafana exists via the Options menu. Not all features migrate transparently and this is currently experimental. See ```config.json``` for relevant configuration.

Additional Information
----------------------

  * [Blog post](http://techo-ecco.com/blog/monitoring-apache-hadoop-cassandra-and-zookeeper-using-graphite-and-jmxtrans)
  * [Cassandra Servers Dashboard](https://gist.github.com/ezbz/5019989#file-cassandra-servers)
  * [Cassandra Server Internals Dashboard](https://gist.github.com/ezbz/5019989#file-cassandra-servers-internals)
  * [Cassandra Per-Column Family Dashboard](https://gist.github.com/ezbz/5019989#file-cassandra-column-families)
  * [Hadoop NameNode Dashboard](https://gist.github.com/ezbz/5020008#file-hadoop-namenode)
  * [Hadoop Jobtracker Dashboard](https://gist.github.com/ezbz/5020008#file-hadoop-jobtracker)
  * [Hadoop TaskTracker Dashboard](https://gist.github.com/ezbz/5020008#file-hadoop-tasktracker)
  * [Hadoop DataNode Dashboard](https://gist.github.com/ezbz/5020008#file-hadoop-datanode)
  * [Zookeeper Dashbaord](https://gist.github.com/ezbz/5020016#file-zookeeper-servers)
