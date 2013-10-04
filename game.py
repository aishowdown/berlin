import sys
import json
import re
import httplib, urllib
from uuid import uuid4

from networkplayer import NetworkPlayer
from datetime import datetime
import json

#from map import Map
#import actions


class Node:
    owner = None
    def __init__(self, id, soldiers_per_turn, points, neighbors=None, player_id=None, number_of_soldiers=0):
        self.id = id - 1
        self.soldiers_per_turn = soldiers_per_turn
        self.points = points
        self.neighbors = neighbors
        if player_id is not None:
            self.owner = int(player_id)
        self.number_of_soldiers = number_of_soldiers
        self.fighting = {}

    def addNeighbor(self, node):
        if not self.neighbors:
            self.neighbors = []
        self.neighbors.append(node)

    def addFighter(self, player_id, number_of_soldiers):
        if player_id in self.fighting:
            self.fighting[player_id] += number_of_soldiers
        else:
            self.fighting[player_id] = number_of_soldiers

    def giveRewards(self):
        if self.owner is not None:
            self.number_of_soldiers += self.soldiers_per_turn

        return self.id, self.owner, self.soldiers_per_turn

    def resolveConflicts(self):
        if len(self.fighting) == 0:
            return

        if self.owner is not None:
            self.addFighter(self.owner, self.number_of_soldiers)

        #TODO: don't do this in a stupid confusing way
        max_val = False
        max_owner = False
        sec_val = 0
        max_count = 0
        #find greatest value and its count
        for fighter in self.fighting:
            val = self.fighting[fighter]
            if val and not max_val:
                max_val = val
                max_owner = fighter
            else:
                if val > max_val:
                    max_count = 1
                    max_owner = fighter
                    max_val = val
                if val == max_val:
                    max_count += 1
                    max_owner = self.owner

        #everyone kills eachother and owner stays the same (even if 2 other armies larger destroyed eachother)
        if max_count >= 2:
            self.number_of_soldiers = 0
        else:
            #find second largest value
            for fighter in self.fighting:
                val = self.fighting[fighter]
                if val > sec_val and val < max_val:
                    sec_val = val

            #name new owner
            self.owner = int(max_owner)

            #take away their troops
            #TODO: make sure this is a positive number
            self.number_of_soldiers = max_val - sec_val

        self.fighting = {}

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
            self.NODES[fromIndex].addNeighbor(toIndex) #soft link to make the in faster #(self.NODES[toIndex])
            if(not self.DIRECTED):
                self.NODES[toIndex].addNeighbor(fromIndex) #soft link to make the in faster self.NODES[fromIndex])


        #playerIndex = 0
        for positions in map_data['setup'][str(self.NUM_PLAYERS)]:
            for pos in map_data['setup'][str(self.NUM_PLAYERS)][positions]:
                nodeIndex = pos['node']-1
                self.NODES[nodeIndex].owner = int(positions) #playerIndex #soft link to make battles easier self.PLAYERS[playerIndex]
                self.NODES[nodeIndex].number_of_soldiers = pos['number_of_soldiers']
            #playerIndex +=1


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


    def __init__(self, ports, mapFile='./maps/default.json', logfile='./logs.json'):
        #TODO: Figure out a better way of passing things in
        ports = (ports.split(','))
        self.NUM_PLAYERS = len(ports)

        #TODO: if players are defined in a wonky order/offset in the maps this could get weird
        player_number = 0
        for port in ports:
            self.PLAYERS.append(NetworkPlayer(player_number, port))
            player_number += 1
        self.logfile = logfile

        #create map
        map_data=json.load(open(mapFile))
        self.createMap(map_data)

    def getNodeStates(self):
        return [{
                "node_id": node.id+1,
                "number_of_soldiers": node.number_of_soldiers,
                "player_id": node.owner
            } for node in self.NODES]

    def run(self):
        #TODO: make this part asynchronouse
        start_time = datetime.now()
        first = True
        turns = {}
        for turn in range(0, self.NUM_TURNS+1):
            turns[turn+1] = {
                "moves" : [],
                "spawns": [],
                "states_post": [],
                "states_pre" : self.getNodeStates()
            }
            responses = [];
            for player in self.PLAYERS:

                action = "turn"
                if(first):
                    action = "game_start"
                    first = False
                if turn == self.NUM_TURNS:
                    action = "game_over"

                self.INFOS['player_id'] = int(player.id)

                #TODO: maybe make asyncroun
                responses.append(player.send_data({
                    "action" : action, #action,   to make it work like their server
                    "infos" : json.dumps(self.INFOS, separators=(',', ': ')), #self.INFOS,
                    "map" : json.dumps({
                        "types" : self.MAPDATA['map']['representation']['types'],
                        "nodes" : self.MAPDATA['map']['representation']['nodes'],
                        "paths" : self.MAPDATA['map']['representation']['paths']
                    }, separators=(',', ': ')),
                    "state" : json.dumps(self.build_state(), separators=(',', ': ')) #self.build_state()
                }, self.TIME_LIMIT));

                #responses.append(player.send_data({
                #    "action" : action,
                #    "infos" : self.INFOS,
                #    "map" : {
                #        "types" : self.MAPDATA['map']['representation']['types'],
                #        "nodes" : self.MAPDATA['map']['representation']['nodes'],
                #        "paths" : self.MAPDATA['map']['representation']['paths']
                #    },
                #    "state" : self.build_state()
                #}, self.TIME_LIMIT));


                if turn < self.NUM_TURNS:
                    # Move Players
                    for response in responses:
                        try:
                            for move in response:

                                if not move:
                                    continue;
                                fromIndex = int(move['from'])-1
                                toIndex = int(move['to'])-1
                                fromNode = self.NODES[fromIndex]
                                toNode = self.NODES[toIndex]
                                #validationStep
                                if fromNode and toNode and fromNode.number_of_soldiers >= move['number_of_soldiers']:
                                    if move['number_of_soldiers'] > 0:
                                        if move['number_of_soldiers'] == int(move['number_of_soldiers']):
                                            if (toNode.id) in fromNode.neighbors and fromNode.owner == player.id:
                                                #add to turns for log
                                                move['player_id'] = player.id

                                                turns[turn+1]['moves'].append(move)

                                                fromNode.number_of_soldiers -= move['number_of_soldiers']

                                                toNode.addFighter(player.id, move['number_of_soldiers'])
                        except:
                            print "received invalid results from player %s on %s" % (player.id, player.port)



                    # Fight it out
                    for node in self.NODES:
                        node.resolveConflicts()


                    # Give reward
                    for node in self.NODES:
                        id, player_id, number_of_soldiers = node.giveRewards()
                        if player_id is not None:
                            turns[turn+1]['spawns'].append({
                                "node_id": id+1,
                                "player_id": player_id,
                                "number_of_soldiers": number_of_soldiers
                            })
                    turns[turn+1]['post'] = self.getNodeStates()


        output = {"game": {
            "artificial_intelligences": [{"id": None, "name": None, "user_id": None, "port": v.port } for v in self.PLAYERS],
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
                "turns": turns
            }


        }}


        with open(self.logfile, 'w') as f:
            f.write("logsCallback(%s)" % json.dumps(output))


Game(*sys.argv[1:]).run()
