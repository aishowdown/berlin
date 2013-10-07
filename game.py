import sys
import json
import re
import httplib, urllib
from uuid import uuid4

from networkplayer import NetworkPlayer
from datetime import datetime
from node import Node
import json

class BadMove(Exception):pass

class Game:

    NUM_TURNS = 1000
    STARTING_MONEY = 100
    DIRECTED = False
    PORTS = []
    NUM_PLAYERS = 0
    TIME_LIMIT = 5000
    NODE_TYPES = {}
    NODES = []
    INFOS = None
    MAPDATA = None
    PLAYERS = []

    def __init__(self, players, mapFile='./maps/default.json', logfile='./logs.json'):
        self.PLAYERS = players
        self.NUM_PLAYERS = len(players)

        self.logfile = logfile

        map_data=json.load(open(mapFile))
        self.createMap(map_data)

    def createMap(self, map_data):
        self.MAPDATA = map_data
        map_data = map_data['map']['representation']

        self.INFOS = map_data['infos']
        self.NUM_TURNS = map_data['infos']['maximum_number_of_turns']
        self.DIRECTED = map_data['infos']['directed']
        if self.NUM_PLAYERS not in map_data['infos']['number_of_players']:
            print "This map only supports %s Players" % map_data['infos']['number_of_players']
            exit(0)

        self.TIME_LIMIT = map_data['infos']['time_limit_per_turn']

        for node_type in map_data['types']:
            self.NODE_TYPES[node_type['name']] = {
                "points": node_type['points'],
                "soldiers_per_turn": node_type['soldiers_per_turn']
            }


        for node in map_data['nodes']:
            self.NODES.append(Node(id=node['id'], **self.NODE_TYPES[node['type']]))

        for path in map_data['paths']:
            fromIndex = path['from']-1
            toIndex = path['to'] - 1
            self.NODES[fromIndex].addNeighbor(toIndex)
            if(not self.DIRECTED):
                self.NODES[toIndex].addNeighbor(fromIndex)


        for positions in map_data['setup'][str(self.NUM_PLAYERS)]:
            for pos in map_data['setup'][str(self.NUM_PLAYERS)][positions]:
                nodeIndex = pos['node']-1
                self.NODES[nodeIndex].owner = int(positions)
                self.NODES[nodeIndex].number_of_soldiers = pos['number_of_soldiers']


    def build_state(self):
        states = []
        for node in self.NODES:
            player_id = None
            if node.owner is not None:
                player_id = int(node.owner)
            states.append({
                "node_id": node.id+1,
                "player_id" : player_id,
                "number_of_soldiers": node.number_of_soldiers
            })
        return states


    def getNodeStates(self):
        return [n.getState() for n in self.NODES]

    def getRequest(self, player, action):
        self.INFOS['player_id'] = int(player.id)
        return {
                "action" : action,
                "infos" : json.dumps(self.INFOS, separators=(',', ': ')),
                "map" : json.dumps({
                    "types" : self.MAPDATA['map']['representation']['types'],
                    "nodes" : self.MAPDATA['map']['representation']['nodes'],
                    "paths" : self.MAPDATA['map']['representation']['paths']
                }, separators=(',', ': ')),
                "state" : json.dumps(self.build_state(), separators=(',', ': '))
        }

    def apply_move(self, player, move, turn_dict):
        fromNode = self.NODES[int(move['from'])-1]
        toNode = self.NODES[int(move['to'])-1]
        soldiers = move['number_of_soldiers']

        #validationStep
        if fromNode.owner != player.id:
            raise BadMove('Not your node', move['from'], fromNode.owner, player.id)
        if fromNode.number_of_soldiers < soldiers:
            raise BadMove('Not enough soldiers', move['from'],
                          soldiers, fromNode.number_of_soldiers)
        if toNode.id not in fromNode.neighbors:
            raise BadMove('not connected', move['from'], move['to'])
        if soldiers == 0:
            return

        #add to turns for log
        move['player_id'] = player.id
        turn_dict['moves'].append(move)
        fromNode.number_of_soldiers -= soldiers
        toNode.addFighter(player.id, soldiers)

    def move_players(self, responses, turn_dict):
        for player, response in responses:
            for move in response:
                if not move:
                    continue
                try:
                    self.apply_move(player, move, turn_dict)
                except Exception as e:
                    print "received invalid results %s from player %s on %s" % (e, player.id, player.port)

    def spawn(self):
        # Give reward
        spawns = []
        for node in self.NODES:
            id, player_id, number_of_soldiers = node.giveRewards()
            if player_id is not None:
                spawns.append({
                    "node_id": id+1,
                    "player_id": player_id,
                    "number_of_soldiers": number_of_soldiers
                })
        return spawns

    def apply_responses(self, responses, turn_dict):
        # Move Players
        self.move_players(responses, turn_dict)

        # Fight it out
        for node in self.NODES:
            node.resolveConflicts()

        turn_dict['spawns'] = self.spawn()
		
        turn_dict['post'] = self.getNodeStates()

    def single_turn(self, action):
        turn_dict = {
            "moves" : [],
            "spawns": [],
            "states_post": [],
            "states_pre" : self.getNodeStates()
        }
        #TODO: make this part asynchronous
        responses = [(p, p.RPC(self.getRequest(p, action), self.TIME_LIMIT))
            for p in self.PLAYERS]

        if action != 'game_over':
            self.apply_responses(responses, turn_dict)

        return turn_dict


    def actions(self):
        yield 'game_start'
        for _ in range(self.NUM_TURNS-1):
            yield 'turn'
        yield 'game_over'

    def run(self):
        start_time = datetime.now()
        turns = map(self.single_turn, self.actions())
        self.write_log(start_time, turns)

    def write_log(self, start_time, turns):
        output = {"game": {
            "artificial_intelligences": [{"id": None, "name": None, "user_id": None, "port": v.port }
                                         for v in self.PLAYERS],
            "created_at": datetime.now().isoformat(),
            "id": None,
            "is_practice": True,
            "last_error": None,
            "map" : self.MAPDATA['map'],
            "map_id": self.MAPDATA['map']['id'],
            "number_of_turns": self.NUM_TURNS,
            "round_id": None,
            "status": "finished",
            "time_end": datetime.now().isoformat(),
            "time_start": start_time.isoformat(),
            "updated_at": datetime.now().isoformat(),
            "replay": {
                "infos" : {
                    "current_turn": self.NUM_TURNS,
                    "directed": self.DIRECTED,
                    "game_id": None,
                    "maximum_number_of_turns": self.NUM_TURNS,
                    "number_of_players": len(self.PLAYERS),
                    "time_limit_per_turn": self.TIME_LIMIT
                },
                "turns": dict( (i+1, t) for i,t in enumerate(turns) )
            }
        }}


        with open(self.logfile, 'w') as f:
            f.write("logsCallback(%s)" % json.dumps(output, indent=2, separators=(', ', ': ')))

def main():
    ports = sys.argv[1].split(',')
    players = [NetworkPlayer(player_number, port)
        for player_number, port in enumerate(ports)]
    Game(players).run()

if __name__ == '__main__':
    main()


