if(Splunk.Module.AppBar) { Splunk.Module.AppBar.prototype.bindEventListeners = function(){}; }
$(function(){
	$('.auxLinks a.aboutLink').remove();
	$('.auxLinks span').remove();
    $('.auxLinks a.help').attr({ title: 'About Splunk for Google Maps', href: Splunk.util.make_url("app","maps","about") }).html('About Google Maps for Splunk');
});
