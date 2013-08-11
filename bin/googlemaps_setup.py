import splunk.admin as admin
import geoip
import spp.config

class GoogleMapsSetupHandler(spp.config.SetupEndpoint):
	CONFIG = "geoip"
	SUPPORTED_OPTIONS = {
		'settings': ('api','cache_memory','resolve_hostnames','database_file', ('database_info',spp.config.SetupEndpoint.READONLY),'add_info_field'),
		'pygeoip': ('cache_mmap',)
	}

	def process_list(self, output):
		try:
			output["settings"].append("database_info", geoip.get_geo_db_info())
		except:
			pass

	def process_edit(self, output, props):
		try:
			dbf = self._get_arg("database_file")
			if dbf:
				geoip.get_geo_db_info( cfg = { "database_file": dbf })
		except geoip.GeoipError,e:
			raise admin.ArgValidationException("Error: %s" % e)

		mmap = geoip._bool(self._get_arg("cache_mmap"))
		if mmap:
			try:
				import mmap
			except:
				raise admin.ArgValidationException("The mmap python module is not available!")

		api = self._get_arg("api")
		if api and api == 'geoip':
			if not geoip.is_c_api_available():
				raise admin.ArgValidationException("The Maxmind C based Geo IP API is not installed!")

admin.init(GoogleMapsSetupHandler, admin.CONTEXT_NONE)