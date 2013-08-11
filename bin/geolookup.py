import geoip,sys

#import spp.debug
#spp.debug.redirect_all("maxmind_geolookup")

geoip.process_csv_stream( sys.stdin, sys.stdout, prefix="ip_", ip_field = 'ip', add_missing_fields = False, add_geo_field = True )