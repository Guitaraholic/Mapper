Author: Paul McDonough
Based on Work by Siegfried Puchbauer
Feedback: splunk@spp.at

Mapper for Splunk
======================

=== Documentation ===

Mapper is based on the excellent Google Maps for Splunk application. This app changes focus to mapping by Postcode Data for Geo lookups rather then IP addresses.

Additional configuration and features to enable tooltip popup reporting and more!


== Licence and Terms of Use ==

This app is licensed under the terms of the Creative Commons license and provided as-is without any warranty. It uses
third-party components that are licensed differently:
* Google Maps: http://code.google.com/apis/maps/terms.html

== Using the Google Maps Search View ==

The App provides a flashtimeline-like view which allows you to simply enter a search and display the results on the map.
In order to plot search results on the map they have to have some kind of location information attached. This location
information has to be included in a field with the name _geo and has to be formatted as "<latitude>,<longitude>".
Latitude and Longitude have to be expressed as floating point numbers. As an example "47.11,0.815" would be a valid _geo
value. Other notations (like 47°N 12',...) are not supported.

In most cases you don't have to build the _geo field yourself. The built-in geolocation lookup methods (geoip command
and geo lookup) are emitting this field by default. In cases where you already have geolocation information in your
results, you can leverage the geonormalize command to build the _geo value for you.

= Geolocation Lookup for IP addresses =

Performing Gelocation Lookup on external IP addresses

External IP address values can be easily translated to locations by using the built-in geoip command or the geo lookup.

Examples:

Perform a geolocation lookup for values of the clientip field in access_combined events:

    sourcetype=access_combined | geoip clientip

Same as the previous example, but also perform DNS lookups in case when the value of the clientip field is a hostname
and not an IP:

    sourcetype=access_combined | geoip clientip resolve_hostnames=true

Same as the first example, but using the geo lookup instead of the command

    sourcetype=access_combined | lookup geo ip as clientip

Performing Gelocation Lookup on internal IP addresses

In order to perform geolocation lookup on private IP address ranges you have to implement a lookup yourself. Splunk
provides multiple ways to achieve this:
* Creating a CSV with the IP subnets and their locations and leveraging the CIDR match_type
* Creating a scripted lookup which queries the geolocation information from an existing asset management system.

Performing combined Geolocation Lookup on IP adresses

Lookups for external and interal IP addresses can be easily combined.

Examples:

sourcetype=access_combined clientip=*
| lookup geoip_internal ip as clientip
| geoip clientip


sourcetype=access_combined clientip=*
| lookup example_geo_internal ip as clientip
| lookup geo ip as clientip OUTPUTNEW _geo geo_info


= Use existing geolocation information available in search results =

It's common case that events already contain geo information.

The geonormalize command

The geonormalize command can detect existing fields containing the geoinformation and normalizes them for the GoogleMaps
module. For doing this the command searches for field pairs (a latitude field and a longitude field) matching a name
scheme. The values of those fields are then merged and emitted as the _geo field. The following name schemes are
supported:

* @*lat/*lng@
* @*lat/*lon@
* @*latitude/*longitude@

So for example when an event has the fields @gps_lat=47.11@ and @gps_lon=0.815@ the geonormalize command will detect
those fields and emit the _geo field with the value @47.11,0.815@.

Example:


sourcetype=device_tracking device_id=A47C08B13 | geonormalize



Manual building the _geo field

If you don't want to use the geonormalize command or if the location fields do not match any naming scheme, you can
manually build the _geo field.

Example:


eventtype=phone_activation | eval _geo=phone_loc_1+","+phone_loc_2


(Assuming that phone_loc_1 contains the latitude and phone_loc_2 contains the longitude)

== Creating Dashboards with Google Maps ==

This add-on provides a Splunk UI module called @GoogleMaps@. This module can only be using in *advanced XML* dashboards.
 The usage of the module is quite similar to any built-in module in Splunk which displays results (like
 SimpleResultsTable, EventsViewer, etc.).

Example:
<module name="HiddenSearch" layoutPanel="panel_row1_col1" autoRun="true">
    <param name="search">sourcetype=access_combined | geoip clientip</param>
    <param name="earliest">-24h@h</param>
    <module name="GoogleMaps">
        <param name="height">500px</param>
        <param name="mapType">roadmap</param>
        <param name="scrollwheel">off</param>
    </module>
</module>

All available options to the module can be found at the module reference at your Splunk instance at
http://locahost:8000/modules#Splunk.Module.GoogleMaps

