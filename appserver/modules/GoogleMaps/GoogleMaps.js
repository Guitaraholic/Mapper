/**
* (c) by SPP Handelsges.m.b.H. 2011 - http://www.spp.at/
* 
* Google Maps module displays a Google Map which is capable of rendering results.
*/

var Maps = {
	DEFAULT_STYLES: {splunk: { label: 'Splunk', style: [{featureType:"all",elementType:"all",stylers:[{invert_lightness:true}]},{featureType:"road",elementType:"all",stylers:[{visibility:"off"}]},{featureType:"administrative",elementType:"labels",stylers:[{visibility:"simplified"}]},{featureType:"administrative.country",elementType:"labels",stylers:[{visibility:"on"}]}]}},
	OVERLAYS: {},
	_loaded: false,
	_scriptAttached: false,
	_modules: [],
	onLoad: function(callback, scope, args) {
		var cb = function() { callback.apply(scope, args || []); }
		if(Maps._loaded) {
			setTimeout(cb,1);
		} else {
			$(document).bind("gmaps:loaded", cb);
		}
	},
	loadAPI: function() {
	    if(!Maps._scriptAttached) {
	        window._gmapsOnLoad = function() { 
				Maps._loaded = true; 
				$(document).trigger('gmaps:loaded'); 
				window._gmapsOnLoad = undefined; 
			}
	        var s = document.createElement('script');
			s.src = "//maps.google.com/maps/api/js?sensor=false&version=v3.6&callback=_gmapsOnLoad";
			s.id = 'gmaps';
			document.body.appendChild(s)
			Maps._scriptAttached = true;
	    }
	}
};

// Asynchronously load the Google Maps API

Splunk.namespace("Module");
Splunk.Module.GoogleMaps = $.klass(Splunk.Module.DispatchingModule, {
    initialize: function($super, container) {
        $super(container);
		this.debug = Splunk.util.normalizeBoolean(this._params.debug);
		if(this.debug) console.debug("GoogleMaps module initialized. Attaching onLoad callback");
		this.ct = container;
		Maps.onLoad(this.onReady, this);
		Maps._modules.push(this);
		$(container).css({
            "float": 'none',
            "height": this._params.height,
            "min-height": this._params.height
        });
		this.mapCt = $('.map', container).get(0);
		if(this.debug) console.debug("Applying styles to container %o", this.ct);
		if($.browser.msie && !$.support.opacity) {
			$(this.mapCt).addClass("msie-fix");
		}
        $(this.mapCt).css({
            "float": 'none',
            "height": this._params.height,
            "min-height": this._params.height
        });
		this.msgCt = $('.map-msg', container).get(0);
		this.statusCt = $('.map-status', container);
		this.statusMsgCt = $('.status-message', this.statusCt);
    },
    onReady: function() {
		if(this.debug) console.debug("Google Maps API loaded.");
		var container = this.ct;
		var center = this.getParam("center").split(",");
        var latlng = new google.maps.LatLng(parseFloat(center[0]), parseFloat(center[1]));
		var opts = {
            zoom: parseInt(this._params.zoomLevel),
            center: latlng,
            mapTypeControl: this.getBoolParam('mapTypeControl'),
            navigationControl: this.getBoolParam('navigationControl'),
            scaleControl: this.getBoolParam('scaleControl'),
            scrollwheel: this.getBoolParam('scrollwheel'),
			streetViewControl: this.getBoolParam('streetViewControl')
        };
        var map = new google.maps.Map(this.mapCt, opts);
		if(this.debug) console.debug("Constructed map %o", opts);
		this.map = map;
		
		var mapStyles = $.extend({}, Maps.DEFAULT_STYLES);
		for(var p in this._params) {
		    var m = p.match(/^mapStyle\.(\w+)$/);
		    if(m) {
				if(this.debug) console.debug("Parsing custom map style: %s", this._params[p]);
		        try {  
		            eval("var _ms = "+this._params[p]); 
		            mapStyles[m[1]] = _ms;
		        } catch(e){ console.error("Error parsing JSON: %o", e); }
		    }
		}
		
		var mts = this._params.mapStyles;
		var types = [];
		if(mts) {
			$.each(mts.split(","), function(i, style){
				style = $.trim(style).toLowerCase();
				if(!google.maps.MapTypeId[style.toUpperCase()]) {
					var sp = mapStyles[style];
					if(sp) {
						map.mapTypes.set(style,new google.maps.StyledMapType(sp.style, { name: sp.label || style }));
						types.push(style);
					} else {
						Splunk.Messenger.System.getInstance().send("error","splunk","Custom Google Maps style \"" + style + "\" is not defined!");
					}
				} else {
					types.push(style);
				}
			});
		}
		map.setOptions({
			mapTypeControlOptions: {
				mapTypeIds: types
			}
		});
		map.setMapTypeId((this._params.mapType||'roadmap').toLowerCase());
		this.autoPostProcess = this.getBoolParam('autoPostProcess');
		if(this.debug) console.debug("Creating overlay %o", this._params['overlay']);
		var OV = Maps.OVERLAYS[this._params['overlay']];
		if(!OV) {
		    Splunk.Messenger.System.getInstance().send("error","splunk","Error: Maps Overlay \"" + this._params['overlay'] + "\" is not available!");
		    return;
		}
		OV = OV();
        this.overlay = new OV({
            map: this.map,
            params: this._params
        });
        
        this.drilldownEnabled = this.getBoolParam("drilldown");
        if(this.drilldownEnabled) {
			if(this.debug) console.debug("Enabling drilldown drilldown_field=%s",this._params['drilldown_field']||"n/a");
            $(this.mapCt).addClass("drilldown-enabled");
            this.drilldownField = this._params['drilldown_field'];
            var me = this;
            google.maps.event.addListener(this.overlay, "drilldown", function(m) {
                me.doDrilldown(m);
            });
        }
		google.maps.event.addListener(map, 'idle', this.saveMapState.bind(this));
		google.maps.event.addListener(map, 'maptypeid_changed', this.saveMapType.bind(this));
		this.status(false);
		this.lastResultsStats = [0,0,0];
		if(this.debug) console.debug("Map rendering complete");
    },
	saveMapState: function() {
		if(this.debug) console.debug("Persiting map state...");
		this.setParamIfModified("zoomLevel", this.map.getZoom());
		var c = this.map.getCenter();
		this.setParamIfModified("center", [c.lat(),c.lng()].join(","));
	},
	saveMapType: function() {
		if(this.debug) console.debug("Persisting map type...");
		this.setParamIfModified("mapType", this.map.getMapTypeId());
	},
	setParamIfModified: function(k, v) {
		if(this._params[k] !== String(v)) {
			if(this.debug) console.debug("Persisting %s=%o", k, v);
			this.setParam(k,v);
		}
	},
    doDrilldown: function(markers) {
		if(this.debug) console.debug("Performing drilldown action for markers %o", markers);
        if(markers) {
            if(this.drilldownField) {
                var values = [];
                for(var i=0; i<markers.length; i++) {
                    $.merge(values, markers[i].getDrilldownValues());
                }
                var quote = function(v) { return /[^\w\.\-]/.test(v) ? ['"',v.replace(/"/g,'\\"'),'"'].join(""):v; },f=this.drilldownField;
                this.drilldownValue = ["(",$.map($.unique(values), function(v){ return [f,quote(v)].join("=") }).join(" OR "),")"].join("");
                // yes, this code is quite unreadable ;-)
                this.pushContextToChildren();
            } else {
				if(markers.length > 1) {
					// Since drilldown cannot accept ranges or multiple values, we have to get down to a single displayed marker in
					// order to handle a single drilldown value over to the downstream modules.
					if(this.debug) console.debug("Click on cluster with %d locations - Zooming in...", markers.length);
					// Zoom in
					var b0 = markers[0].getLatLng();
					var bounds = new google.maps.LatLngBounds(b0, b0);
					for (var i = markers.length - 1; i > 0; i--){
						bounds.extend(markers[i].getLatLng());
					}
					this.map.panTo(bounds.getCenter());
					this.map.setZoom(this.map.getZoom()+1);
				} else {
					this.drilldownValue = markers[0].getLocation();
					this.pushContextToChildren();
				}
            }
        } 
    },
	status: function(msg) {
		this.statusCt[msg ? 'show':'hide']();
		this.statusMsgCt.html(msg || '');
		return this.statusCt;
	},
    getBoolParam: function(name) {
        return Splunk.util.normalizeBoolean(this._params[name]);
    },
	getModifiedContext: function() {
		var context = this.getContext();
        if(this.lastResultsStats) {
    		context.set("gmapTotalCount",  this.lastResultsStats[0]);
    		context.set("gmapLocationCount", this.lastResultsStats[1]);
    		context.set("gmapProcessedCount", this.lastResultsStats[2]);
	    }
		if(this.drilldownValue) {
			if(this.drilldownField) {
				context.set("maps.drilldown", this.drilldownValue);
			} else {
				context.set("maps.click", this.drilldownValue);
			}
			this.drilldownValue = undefined;
		}
        return context;
    },
    renderResults: function(results) {
		if(!results) return;
		this.status("Rendering...");
        $(this.msgCt).hide();
        var json = {};
        try {
            json = JSON.parse(results);
        } catch(e) {
			if(this.debug) console.debug("Error parsing result JSON... Seems to be a error message");
            $(this.msgCt).html(results); // Display python stacktrace etc.
            $(this.msgCt).show();
            return;
        }
		var msgs = json && json.messages;
		if(msgs) {
			$(this.msgCt).html(['<div class="info">', msgs.join("<br />"), '</div>'].join("")).show(300);
		}
        var items = json && json.items || [];
        var markers = [];
		var totolCount = 0;
        for (var i = 0; i < items.length; i++) {
            var p = items[i];
			var geo = p[0].split(",");
            var lat = parseFloat(geo[0]), lng = parseFloat(geo[1]), cnt=p[1];
			totolCount += cnt;
            var marker = new Maps.Marker(lat, lng, cnt, p[2]);
            markers.push(marker);
        }
        this.resetUI();
		if(this.debug) console.debug("Rendering results");
        this.overlay.addMarkers(markers);
		this.lastResultsStats = [ totolCount||0 ,markers.length||0 ,json.processed_count||0 ];
		this.pushStatus();
		this.status(false);
    },
    pushStatus: function() {
		if(this.debug) console.debug("Pushing status to SimpleResultsHeader modules...");
        if(Splunk.Module.SimpleResultsHeader && this._children) {
            for(var i=0; i<this._children.length; i++) {
                var c = this._children[i];
                if(c instanceof Splunk.Module.SimpleResultsHeader) {
                    c.setLoadState(Splunk.util.moduleLoadStates.WAITING_FOR_CONTEXT);
                    c.baseContext = this.getModifiedContext();
                    c.setLoadState(Splunk.util.moduleLoadStates.HAS_CONTEXT);
                    c.onContextChange();
                    c.pushContextToChildren();
                }
            }
        }
    },
    resetUI: function() {
		if(this.debug) console.debug("Resetting user interface");
		if(this.overlay) {
	        this.overlay.clearMarkers();
		}
		this.status(false);
		this.lastResultsStats = [0,0,0];
		$(this.msgCt).hide();
    },
	fetchResults: function(msg) {
		if(this.debug) console.debug("Fetching results");
		this.status(msg);
		this.abortGetResults();
		this.postLoadAction = undefined;
		this.loading = true;
		this.getResults();
	},
    onJobDone: function(event) {
		if(this.debug) console.debug("Search job is done.");
		this.status("Loading results...");
        this.fetchResults("Loading results...");
    },
	getResultsCompleteHandler: function() {
		this.loading = false;
		if(this.postLoadAction) {
			this.postLoadAction();
		}
	},
	getResultsErrorHandler: function($super, xhr, textStatus, exception) {
		this.status("Error loading results").hide(1500);
		this.loading = false;
		$super(xhr, textStatus, exception);
	},
    onJobProgress: function(event) {
		if(this.debug) console.debug("Job progress...");
        var context = this.getContext();
        var search = context.get("search");
		
		if(search.job.areResultsTransformed()) {
			if(this.debug) console.debug("Job results are transformed");
			if(!search.job.isPreviewable() && !search.job.isDone()) {
				if(this.debug) console.debug("Job is not previewable");
				this.status("Waiting for preview...");
			} else {
				if(this.debug) console.debug("Loading preview");
				this.fetchResults("Loading preview...");
			}
		} else {
			if(this.debug) console.debug("Job results are not transformed");
	        if (search.job.getEventAvailableCount() > 0) {
				if(this.debug) console.debug("%d Events are available.", search.job.getEventAvailableCount());
				if(!this.loading) {
					this.fetchResults("Loading preview...");
				} else {
					this.postLoadAction = this.fetchResults.bind(this, "Loading preview...");
				}
	        } else {
				if(this.debug) console.debug("No events are available.");
	            this.status("Waiting for search to complete...");
	        }
		}
    },
	onContextChange: function($super) {
		if(this.debug) console.debug("onContextChange");
		var context = this.getContext();
        var search = context.get("search"); 
        if (search.job.getSearchId() != this._previousSID) {
			if(this.debug) console.debug("SID has changed. Resetting...");
            this.resetUI();
            this._previousSID = search.job.getSearchId();
        }
		var done = search.job.isDone();
        if (search.isJobDispatched() && (done || (search.job.getEventCount() > 0)) ) {
			this.fetchResults(done ? "Loading results..." : "Loading preview...");
		}
	},    
	onBeforeJobDispatched: function(search) {
		if(this.debug) console.debug("Applying settings to search job (minStatusBuckets=1, requiredFields=*)");
        search.setMinimumStatusBuckets(1);
		search.setRequiredFields(['*']); //(this.getRequiredFields());
    },
	getRequiredFields: function() {
        var f = ['_geo','_geo_count'];
        if(this.drilldownField) f.push(this.drilldownField);
		return f;
	},
    getResultParams: function($super) {
        var params = $super();
        var context = this.getContext();
        var search = context.get("search");
        var sid = search.job.getSearchId();
        var timerange = search.getTimeRange(), 
			earliest = timerange && timerange.getAbsoluteEarliestTime(), 
			latest = timerange && timerange.getAbsoluteLatestTime();
		if(earliest && latest) {
			params.earliest_time = earliest.getTime()/1000;
			params.latest_time = latest.getTime()/1000;
		}
        params.sid = sid;
		if(this.drilldownField) {
			params.drilldown_field = this.autoPostProcess ? "_geo_drilldown_values" : this.drilldown_field;
		}
		params.entity_name = search.job.areResultsTransformed() ? 'results': 'events';
		if(this.autoPostProcess) {
		    if(this.drilldownField) {
		        params.postprocess = "eval _geo_count=coalesce(_geo_count,1) | stats sum(_geo_count) as _geo_count values(" + this.drilldownField + ") as _geo_drilldown_values by _geo";
	        } else {
	            params.postprocess = "eval _geo_count=coalesce(_geo_count,1) | stats sum(_geo_count) as _geo_count by _geo";
	        }
	    }
		if(search.job.isPreviewable()) params.show_preview = '1';
		if(this.debug) {
			params.debug = 1;
			if(this.debug) console.debug("Constructed parameters for module backend: %o", params);
		}
        return params;
    }
});

// A marker represents a location on the map and additionally holds the count of results/events and the drilldown values in the case of a configured drilldown_field.
Maps.Marker = $.klass({
	initialize: function(lat,lng,count,drilldown) {
		this._lat = lat;
		this._lng = lng;
		this.count = count;
		this._drilldown = drilldown;
	},
	lat: function() {
		return this._lat;
	},
	lng: function() {
		return this._lng;
	},
	getPosition: function() {
		return this._pos || ( this._pos = new google.maps.LatLng(this._lat, this._lng));
	},
	getDrilldownValues: function() {
	    return this._drilldown || [];
	},
	getLocation: function() {
		return [this._lat, this._lng].join(",");
	},
	getLatLng: function() {
		return new google.maps.LatLng(this._lat, this._lng);
	}
});
// function _debug() {
//     if (window.console && typeof window.console.debug == 'function') {
//         window.console.debug.apply(window.console, arguments);
//     }
// }
// ============

Maps.OVERLAYS['clusters'] = function() {
    // Attach overlay stylesheet
    var DEFAULT_CLUSTER_RANGE = [0, 10, 100, 1000, 10000];
    var CLUSTER_STYLES = {
        m: [[53, 53], [56, 56], [66, 66], [78, 78], [90, 90]],
        conv: [[30, 27, 26, 27], [40, 36, 35, 36], [50, 45, 45, 45]],
        heart: [[30, 27], [40, 36], [50, 45]],
        people: [[35,35],[45,45],[55,55]]
    };
    google.maps.OverlayView.subclasses = [];
    Maps.MarkerClusterer = $.klass(google.maps.OverlayView, {
        initialize: function(config) {
            this.map = config.map;
            this.markers = [];
            this.clusters = [];
        
            this.style = config.params['overlay.style'] || 'm';
            if(!this.stype in CLUSTER_STYLES) {
                Splunk.Messenger.System.getInstance().send("error","splunk","Error: Invalid overlay.style \"" + this.style + "\"!");
            }
            this.sizes = CLUSTER_STYLES[this.style];
            this.gridSize = parseInt(config.params['overlay.gridSize'] || 30);
            this.zoomOnClick = parseInt(config.params['overlay.maxZoom'] || 15);
            this.markerOpacity = config.params['overlay.opacity'];
			if(this.markerOpacity) this.markerOpacity = parseFloat(this.markerOpacity);
            this.roundQuantity = Splunk.util.normalizeBoolean(config.params['overlay.roundQuantity']);
            this.setMap(this.map);
            this.prevZoom = this.map.getZoom();
        
            var customRange = config.params['overlay.rangeMap'];
            if(customRange) {
                try {
                    this.rangeMap = eval("[+"+customRange+"]");
                } catch(e) {
                    Splunk.Messenger.System.getInstance().send("error","splunk", "Error: Invalid overlay.rangeMap specified: \"" +  customRange + "\"")
                }
            } else {
                this.rangeMap = DEFAULT_CLUSTER_RANGE;
            }

            google.maps.event.addListener(this.map, 'zoom_changed', this.onZoomChanged.bind(this));
            google.maps.event.addListener(this.map, 'idle', this.redraw.bind(this));
        },
        onZoomChanged: function() {
            var maxZoom = this.map.mapTypes[this.map.getMapTypeId()].maxZoom;
            var zoom = this.map.getZoom();
            if (zoom < 0 || zoom > maxZoom) {
                return;
            }
            if (this.prevZoom != zoom) {
                this.prevZoom = this.map.getZoom();
                this.resetViewport();
            }
        },
        onAdd: function() {
            if (!this.ready) {
                this.ready = true;
                this.createClusters();
            }
        },
        calculate: function(markers, classes) {
            var sum = 0;
            for (var i = 0; i < markers.length; i++) {
                sum += (markers[i].count || 1);
            }
            var idx = 0;
            for (var i = 0; i < this.rangeMap.length; i++) {
                if (sum > this.rangeMap[i]) {
                    idx = i;
                } else {
                    break;
                }
            }
            return {
                text: sum,
                index: idx
            };
        },
        pushMarker: function(marker) {
            marker.isAdded = false;
            this.markers.push(marker);
        },
        addMarker: function(m, noupdate) {
            this.pushMarker(m);
            if (!noupdate) this.redraw();
        },
        addMarkers: function(m, noupdate) {
            for (var i = 0, marker; marker = m[i]; i++) {
                this.pushMarker(marker, true);
            }
            if (!noupdate) this.redraw();
        },
        getExtendedBounds: function(bounds) {
            var projection = this.getProjection();
            // Turn the bounds into latlng.
            var tr = new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getNorthEast().lng());
            var bl = new google.maps.LatLng(bounds.getSouthWest().lat(), bounds.getSouthWest().lng());
            var gs = this.gridSize;
            // Convert the points to pixels and the extend out by the grid size.
            var trPix = projection.fromLatLngToDivPixel(tr);
            trPix.x += gs;
            trPix.y -= gs;
            var blPix = projection.fromLatLngToDivPixel(bl);
            blPix.x -= gs;
            blPix.y += gs;
            // Convert the pixel points back to LatLng
            var ne = projection.fromDivPixelToLatLng(trPix);
            var sw = projection.fromDivPixelToLatLng(blPix);
            // Extend the bounds to contain the new bounds.
            bounds.extend(ne);
            bounds.extend(sw);
            return bounds;
        },
        isMarkerInBounds: function(marker, bounds) {
            return bounds.contains(marker.getPosition());
        },
        clearMarkers: function() {
            this.resetViewport();
            this.markers = [];
        },
        resetViewport: function() {
            for (var i = 0, cluster; cluster = this.clusters[i]; i++) {
                cluster.remove();
            }
            for (var i = 0, marker; marker = this.markers[i]; i++) {
                marker.isAdded = false;
            }
            this.clusters = [];
        },
        draw: function() {},
        redraw: function() {
            this.createClusters();
        },
        createClusters: function() {
            if (!this.ready) {
                return;
            }
            // Get our current map view bounds.
            // Create a new bounds object so we don't affect the map.
            var mapBounds = new google.maps.LatLngBounds(this.map.getBounds().getSouthWest(), this.map.getBounds().getNorthEast());
            var bounds = this.getExtendedBounds(mapBounds), zoom = this.map.getZoom();
    		var markersInBounds = 0, clustersCreated = 0;
            for (var i = 0, marker; marker = this.markers[i]; i++) {
                var added = false;
                if (!marker.isAdded && (zoom < 3 || this.isMarkerInBounds(marker, bounds))) {
                    markersInBounds++;
    				for (var j = 0, cluster; cluster = this.clusters[j]; j++) {
                        if (!added && cluster.getCenter() &&
                        cluster.isMarkerInClusterBounds(marker)) {
                            added = true;
                            cluster.addMarker(marker);
                            break;
                        }
                    }

                    if (!added) {
    					clustersCreated++;
                        var cluster = new Maps.Cluster(this);
                        cluster.addMarker(marker);
                        this.clusters.push(cluster);
                    }
                }
            }
        }
    });
    Maps.Cluster = $.klass({
        initialize: function(mc) {
            this.markerClusterer = mc;
            this.map = mc.map;
            this.gridSize = mc.gridSize;
            this.center = null;
            this.markers = [];
            this.bounds = null;
            this.clusterIcon = new Maps.ClusterIcon(this, this.gridSize);
        },
        getCenter: function() {
            return this.center;
        },
        addMarker: function(marker) {
            if (!this.center) {
                this.center = marker.getPosition();
    	        this.calculateBounds();
            } 
            marker.isAdded = true;
            this.markers.push(marker);
            this.updateIcon();
            return true;
        },
        remove: function() {
            this.clusterIcon.remove();
            this.markers.length = 0;
            delete this.markers;
        },
        calculateBounds: function() {
            var bounds = new google.maps.LatLngBounds(this.center, this.center);
            this.bounds = this.markerClusterer.getExtendedBounds(bounds);
        },
        isMarkerInClusterBounds: function(marker) {
            return this.bounds.contains(marker.getPosition());
        },
        updateIcon: function() {
            var sums = this.markerClusterer.calculate(this.markers, this.markerClusterer.sizes.length);
            this.clusterIcon.setCenter(this.center);
            this.clusterIcon.setSums(sums);
            this.clusterIcon.show();
        },
        getMarkers: function() {
            return this.markers;
        }
    });

    Maps.ClusterIcon = $.klass(google.maps.OverlayView, {
        initialize: function(cluster, gridSize) {
            this.padding = 0;
            this.cluster = cluster;
            this.center = null;
            this.map = cluster.map;
            this.div = null;
            this.sums = null;
            this.visible = false;
            this.setMap(this.map);
        },
        onAdd: function() {
            this.div = $('<div unselectable="on"></div>');
            if (this.visible) {
                this.div.addClass(this.getCssClass()).html(this.sums.text);
                this.updatePos();
            }
            if(this.cluster.markerClusterer.markerOpacity) {
                if($.support.opacity) {
					// Only set when browser nativly support opacity. Otherwise markers in IE are skrewed up. 
					this.div.css({ opacity: this.cluster.markerClusterer.markerOpacity });
				}
            }
            var panes = this.getPanes();
            this.div.appendTo(panes.overlayImage);
            var c = this.cluster, m = this.cluster.markerClusterer;
            google.maps.event.addDomListener(this.div[0], 'click', function() {
                google.maps.event.trigger(m, "drilldown", c.getMarkers());
            });
        },
        getPosFromLatLng: function(latlng) {
            var pos = this.getProjection().fromLatLngToDivPixel(latlng);
            pos.x -= this.offset.x;
            pos.y -= this.offset.y;
            return pos;
        },
        draw: function() {
            if (this.visible) {
                var pos = this.getPosFromLatLng(this.center);
                this.div.css({ top: pos.y, left: pos.x });
            }
        },
        hide: function() {
            if (this.div) {
                this.div.hide();
            }
            this.visible = false;
        },
        show: function() {
            if (this.div) {
                this.div.className = this.getCssClass();
                this.div.show();
                this.updatePos();
            }
            this.visible = true;
        },
        remove: function() {
            this.setMap(null);
        },
        onRemove: function() {
            if (this.div) {
                this.div.remove();
            }
        },
        setSums: function(sums) {
            this.sums = sums;
            this.index = sums.index;
			if(this.cluster.markerClusterer.roundQuantity) {
				if(sums.text > 999999) this.sums.text = ((sums.text/1000000).toFixed(2)+"M")
				else if(sums.text > 99999) this.sums.text = ((sums.text/1000).toFixed(0)+"k")
				else if(sums.text > 9999) this.sums.text = ((sums.text/1000).toFixed(1)+"k")
				else if(sums.text > 999) this.sums.text = ((sums.text/1000).toFixed(2)+"k")
			}
            if (this.div) {
				this.div.html(sums.text);
            }
            this.useStyle();
        },
        useStyle: function() {
            var index = Math.max(0, this.sums.index);
            index = Math.min(this.cluster.markerClusterer.sizes.length - 1, index);
            var style = this.cluster.markerClusterer.style;
            this.cssClass=style + "-" + (index + 1);
            var s = CLUSTER_STYLES[style][index];
            this.width = s[0];
            this.height = s[1];
            if(s.length >= 4) {
                this.offset = { x: s[2], y: s[3] };
            } else {
                this.offset = {x: parseInt(this.width / 2, 10) ,y: parseInt(this.height / 2, 10) };
            }
        },
        setCenter: function(center) {
            this.center = center;
        },
        getCssClass: function() {
            return "cluster-icon " + (this.cssClass || this.cluster.markerClusterer.style + "-1");
        },
        updatePos: function() {
            var pos = this.getPosFromLatLng(this.center);
            this.div.css({ top: pos.y, left: pos.x });
        }
    });
    return Maps.MarkerClusterer;
};

$(Maps.loadAPI);