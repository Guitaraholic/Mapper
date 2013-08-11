# Copyright by SPP Handelsges.m.b.H. 2011 - http://www.spp.at/
import cherrypy
import controllers.module as module
import os
import time
from re import match
import splunk, splunk.search, splunk.util, splunk.entity
import lib.util as util
import lib.i18n as i18n
import logging, json

GEO_FIELD = '_geo'

class GoogleMaps(module.ModuleHandler):
	def generateResults(self, host_app, client_app, sid, field_list=None, entity_name='results', postprocess=None,
						earliest_time=None, latest_time=None, show_preview='0',count='100000',offset='0',
						max_lines = None, drilldown_field = None, debug = False):
		try:
			count = int(count)
			offset = int(offset)
			messages = []
			if not sid:
				raise Exception('GoogleMaps.generateResults - sid not passed!')

			try:
				job = splunk.search.getJob(sid, sessionKey=cherrypy.session['sessionKey'])
			except splunk.ResourceNotFound:
				return _("job sid=%s not found") % sid
			
			if postprocess:
				job.setFetchOption(search=postprocess)
				
			required_fields = ['_geo','_geo_count']
				
			if drilldown_field:
				required_fields.append(drilldown_field)
				
			if show_preview == '1' and entity_name == 'results' and not job.isDone:
				entity_name = 'results_preview'
				
			# set formatting
			job.setFetchOption(
					earliestTime=earliest_time,
					latestTime=latest_time,
					fieldList = required_fields
					)
			points = []
			pointmap = {}
			processed_count = 0
			res_count = len(job)
			end = max(res_count, offset+count)
			dbg_res = []
			for result in getattr(job, entity_name)[offset:end]:
				processed_count = processed_count+1
				if debug:
					dbg_res.append(str(result.fields))
				if GEO_FIELD in result:
					geo = result[GEO_FIELD][0].value
					cnt = 1
					if '_geo_count' in result: 
						cnt = int(result['_geo_count'][0].value)
					
					dv = None
					if drilldown_field:
						dv = drilldown_field in result and [ x.value for x in result[drilldown_field] ] or None
					
					if geo:
						if geo in pointmap:
							o = pointmap[geo]
							o[1] = o[1]+cnt
							if dv: 
								for x in dv: 
									if not x in o[2]: 
										o[2].append(x)
						else:
							o = drilldown_field and [geo,cnt,[]] or [geo, cnt]
							if dv: 
								for x in dv: 
									if not x in o[2]: 
										o[2].append(x)
							points.append(o)
							pointmap[geo] = o
			
			response = { "items": points, "messages": messages, "processed_count": processed_count, "result_count": res_count }
			
			if debug:
				response['debug'] = { "job": job.toJsonable(), "fetch": job.getFetchOptions(), "res": dbg_res, "entity_name": entity_name }
				
			return json.dumps(response)

		except Exception, e:
			import traceback
			stack =	 traceback.format_exc()
			return _("Error : Traceback: <div><pre>" + str(stack) + "</pre></div>")