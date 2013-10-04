import os
import flask
import json
import sys

PING_ACTION = 'ping'
GAME_START_ACTION = 'game_start'
TURN_ACTION = 'turn'
GAME_OVER_ACTION = 'game_over'

def turn(map):
    # This is where you put you logic.  Use the map object to figure out
    # what you want to do and return a list of orders that are hashes that
    # look like this:
    # {'from': node_id, 'to': other_node_id, 'number_of_soldiers': num}

    orders = []
    my_nodes = map.NodesControlledByMe()

    print "num = %s" % len(my_nodes)
    for node_id in my_nodes:
        n = map.GetNode(node_id)
        adj_nodes = map.AdjacentNodes(node_id)
        pop = n.get('population', 0)
        to_attack = [n for n in adj_nodes if (not n in my_nodes
                                              or map.GetNode(n).get('population', 0) < pop)]
        for dest_node_id in to_attack:
            orders.append({'from': node_id, 'to': dest_node_id,
                           'number_of_soldiers': int(pop / len(to_attack))})

    return orders

class Map:
    def __init__(self, infos_data, map_data, state_data):
        self.infos = infos_data if infos_data else {}
        self.player_id = self.infos.get('player_id', None)
        self.directed = self.infos.get('directed', False)

        self.state = state_data if state_data else []
        map_data = map_data if map_data else {}
        self.types = map_data.get('types', None)
        self.nodes = map_data.get('nodes', None)
        self.paths = map_data.get('paths', None)

    def IsValid(self):
        return bool(self.types and self.nodes and self.paths and
                    self.infos and self.state)

    def GetType(self, node_type):
        if not self.types:
            return None
        matching_types = [t for t in self.types
                          if t.get('name', None) == node_type]
        if len(matching_types) != 1:
            return None
        return matching_types[0]

    def GetNode(self, node_id):
        """ Returns a pretty comprehensive dict with all the data you want to know
        about a node. contains the following entries:

        id, type, points_per_turn, soldiers_per_turn, current_owner, population
        """
        if not self.nodes:
            return None
        for n in self.nodes:
            if n.get('id', None) == node_id:
                node_type = n.get('type', None)
                type_details = self.GetType(node_type)
                if not type_details:
                    continue
                state = self.__GetState(node_id)
                if not state:
                    continue

                return {'id': node_id, 'type': node_type,
                        'points_per_turn': type_details.get('points', None),
                        'soldiers_per_turn': type_details.get('number_of_soldiers', None),
                        'current_owner': state.get('player_id', None),
                        'population': state.get('number_of_soldiers', None)}
        return None

    def __GetState(self, node_id):
        """ A Helper function, you'd probably be better off using GetNode() """
        if not self.state:
            return None
        nodes = [n for n in self.state if n.get('node_id', None) == node_id]
        if len(nodes) != 1:
            return None
        return nodes[0]

    def HasPathFrom(self, start_node_id, end_node_id):
        """ Is there an edge from start_node_id to end_node_id """
        paths = self.AdjacentNodes(start_node_id)
        return bool(end_node_id in paths)

    def AdjacentNodes(self, node_id):
        """ Return a list of the node id's one hop away """
        if not self.IsValid():
            return []
        node = self.GetNode(node_id)
        if not node:
            return []

        paths_out = [p.get('to', None) for p in self.paths
                     if p.get('from', None) == node_id]
        if self.directed:
            return paths_out

        paths_in = [p.get('from', None) for p in self.paths
                    if p.get('to', None) == node_id]
        with_duplicates = paths_out + paths_in
        seen = set()
        return [n for n in with_duplicates
                if n not in seen and not seen.add(n)]

    def NodesControlledByMe(self):
        """ Returns a list of the node id's of all the nodes you control """
        if not self.IsValid():
            return []

        print self.player_id
        print self.state
        return [n.get('node_id', None) for n in self.state
                if n.get('player_id', None) == self.player_id]


#######################

app = flask.Flask(__name__.split('.')[0])
app.config['DEBUG'] = True

@app.route('/', defaults={'path': ''}, methods = ['GET', 'POST'])
@app.route('/<path:path>/', methods = ['GET', 'POST'])
def bot(path):
    # There are unfortunately a couple of different ways the server will
    # respond, however this should handle all of them transparently so
    # you don't have to worry about it.

    if flask.request.data:  #This one gets called when the request is in the body
        json_request = json.loads(flask.request.data)
        infos_data = json_request.get('infos', None)
        map_data = json_request.get('map', None)
        state_data = json_request.get('state', None)
        action = json_request.get('action', None)
    elif flask.request.form: #This one gets called when the request is in form_data
        json_request = flask.request.form
        infos_data = json.loads(json_request.get('infos', None))
        map_data = json.loads(json_request.get('map', None))
        state_data = json.loads(json_request.get('state', None))
        action = json_request.get('action', None)
    elif flask.request.args: #This one gets called when it's urlencoded
        sys.stderr.write(str(flask.request.args))
        infos_data = json.loads(flask.request.args.get('infos', None))
        map_data = json.loads(flask.request.args.get('map', None))
        state_data = json.loads(flask.request.args.get('state', None))
        action = flask.request.args.get('action', None)
    else:
        return 'Sorry, no data recieved'

    if action == PING_ACTION:
        return json.dumps([])


    map = Map(infos_data, map_data, state_data)

    orders = turn(map)
    return json.dumps(orders)


app.run('localhost', int(sys.argv[1]))
