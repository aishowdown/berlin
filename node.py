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

    def getState(self):
        return {
            "node_id": self.id+1,
            "number_of_soldiers": self.number_of_soldiers,
            "player_id": self.owner
        }
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

        #everyone kills eachother and owner stays the same
        # (even if 2 other armies larger destroyed eachother)
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
