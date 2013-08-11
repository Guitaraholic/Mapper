// Copyright by SPP Handelsges.m.b.H. 2011 - http://www.spp.at/
Splunk.Module.GeoDrilldown = $.klass(Splunk.Module, {
	initialize: function($super, container) {
		$super(container);
		this.childEnforcement  = Splunk.Module.ALWAYS_REQUIRE;
        this.parentEnforcement = Splunk.Module.ALWAYS_REQUIRE;
		this.hide(this.HIDDEN_MODULE_KEY);
	},
	pushContextToChildren: function($super, explicitContext) {
		$super(explicitContext);
		//console.debug("GeoDrilldown.pushContextToChildren(%a)", arguments);
	},
	getModifiedContext: function() {
		//console.debug("GeoDrilldown.getModifiedContext(%a)", arguments);
		var context = this.getContext();
		//console.debug("Modified context: %o", context._root);
		var search = context.get("search");
		
		var click = context.get("maps.click");
		
		if(click) {
			
			//console.debug("Received click %o", click);
			
			var intention = {
	            arg:{
	                '_geo': click
	            },
	            name:"addterm"
	        };
			search.abandonJob();
			search.addIntention(intention);
        	context.set("search", search);
			return context;
		}
	}
});