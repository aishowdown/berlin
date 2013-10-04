import json

import httplib, urllib, urllib2

class NetworkPlayer():
    headers = {"Content-type": "application/x-www-form-urlencoded",
               "Accept": "text/plain"}

    def __init__(self, id, port, obj=None, timeout=5000):
        print "player #%s initing with %s" % (id, port)
        self.id = id
        self.port = port
        if(obj):
            self.send_data(obj, timeout)

    def send_data(self, obj, timeout=5000):
        jsonmap = json.dumps(obj);
        #PUTS IT IN ARGS - switch to otehr encoder
        # import ipdb; ipdb.set_trace();
        try:
            req = urllib2.Request("http://127.0.0.1:"+self.port+"?"+urllib.urlencode(obj).replace('+', ''))
            req.add_header('Content-Type', 'application/json')
            req.get_method = lambda: 'POST'
            response = urllib2.urlopen(req, timeout=(timeout/1000))
            ret = json.load(response)
        except:
            print "failed to load json from %s on port %s " % (self.id, self.port)
            return

        return ret;
