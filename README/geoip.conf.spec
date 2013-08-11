#
# Geolocation Lookup settings
#

[settings]

api = geoip | pygeoip
* The API to use. "pygeoip" is a purely Python based API and has no dependencies whereas the geoip API requires the Maxmind
* Python and C library to be installed.

database_file = <file path>
* The path to the Maxmind database file relative to the script path of geoip.py (in the bin folder).

resolve_hostnames = true | false
* If enabled, the geoip lookup will try to resolve the hostnames via DNS lookups in case of a invalid IP address in the given field.

add_info_field = true | false
* If enabled the lookups and the geoip command will emit an additinal field called "geo_info" containing the city name (if available) and the country name separated by a comma.

cache_memory = true | false
* Enable memory caching for the geoip command and lookups

[pygeoip]

cache_mmap = true | false
* Enable mmap caching for the geoip command and lookups

