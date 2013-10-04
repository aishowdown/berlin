/*
 * A general node
 */
TS.Node = Class.create(TS, {
  initialize: function ($super, id, type, x, y, value) {
    $super();
    this.position = {
      x: x,
      y: y
    };
    this.id = id;
    this.type = type;
    this.links = new Array();
    this.playerId = null;
    this.nbSoldiers = 0;
    this.players = new Hash(); //for combats
    this.value = value; //for score
  },

  linkTo: function (otherNode, controlRatio) {
    this.links.push({
      'toId': otherNode.id,
      'controlRatio': controlRatio ? controlRatio : ((Math.random() * 30 | 0) / 100)
    });
  },

  getLink: function (toId) {
    for (var i = 0; i < this.links.length; i++)
      if (this.links[i].toId == toId)
        return this.links[i];

    return null;
  },

  setSoldiers: function (playerId, nbSoldiers) {
    this.playerId = playerId,
    this.nbSoldiers = nbSoldiers;
  }
});

/*
 * A city node
 */
TS.City = Class.create(TS.Node, {
  initialize: function ($super, id, x, y, value) {
    $super(id, 'city', x, y, value);
    this.layout = id % 3 | 0;
  },
});

/*
 * The graph holding all the nodes and related infos.
 */
TS.NodeGraph = Class.create(TS, {
  initialize: function ($super, map) {
    $super();
    this.nodes = {};
    this.map = map;
    this.directed = map.infos.directed || false;

    // Get the nodes types
    var types = {};

    this.map.types.each(function (type) {
      types[type.name] = type;
    }, this);

    // Create nodes
    this.map.nodes.each(function (node) {
      if (node.type == 'city')
        this.nodes[node.id] = new TS.City(node.id, node.x, node.y, types[node.type].points);
      else
        this.nodes[node.id] = new TS.Node(node.id, node.type, node.x, node.y, types[node.type].points);
    }, this);

    // Add paths between the nodes
    this.map.paths.each(function (path) {
      this.nodes[path.from].linkTo(this.nodes[path.to], path.control_ratio);
    }, this);
  },

  /*
   * Sync nodes objects with moves data to determine:
   * - if a node is in combat (X vs X vs ...)
   * - if a node is captured (One player on it at this turn)
   * - if a player is sacrifying soldiers (the attacker(s) are outnumbered)
   * - the winner of a combat
   * - the looser(s) of a combat
   * - if a combat is a draw
   * - if a node is reinforced (only one moving player & moving player == owner)
   * - a race occurs for a node (there no one on the node and two or more players try to capture it)
   * - etc.
   */
  syncCombats: function (moves) {
    // reset the players on the nodes
    Object.keys(this.nodes).each(function (nodeKey) {
      var node = this.nodes[nodeKey];

      node.players = new Hash();

      if (node.playerId != null && node.nbSoldiers != 0)
        node.players.set(node.playerId, node.nbSoldiers);
    }, this);

    // sync the players on the nodes
    moves.each(function (data) {
      // increment the to node
      var node = this.nodes[data.to];
      var id = parseInt(data.player_id);

      node.players.set(id, node.players.get(id) == null ?
        data.number_of_soldiers :
        (node.players.get(id) + data.number_of_soldiers));

      // decrement the from node
      node = this.nodes[data.from];

      node.players.set(id, node.players.get(id) - data.number_of_soldiers);

      var value = null;

      if (node.players.get(id) == 0)
        value = node.players.unset(id);
    }, this);

    // - decrement the number of soldiers on the 'from' node
    // - increment the number of soldiers on the 'to' node (if same player)
    moves.each(function (data) {
      this.nodes[data.from].nbSoldiers -= data.number_of_soldiers;

      if (this.nodes[data.to].playerId == this.nodes[data.from].playerId)
        this.nodes[data.to].nbSoldiers += data.number_of_soldiers;
    }, this);
  },

  syncStates: function (states) {
    states.each(function (data) {
      console.log(data);
      this.nodes[data.node_id].setSoldiers(data.player_id, data.number_of_soldiers);
    }, this);
  },

  getNodeCaptured: function (id) {
    var node = this.nodes[id];
    var playersIds = node.players.keys();

    return (playersIds.size() == 1) &&
      (node.playerId == null ||
      (node.players.get(playersIds[0]) != node.playerId && node.nbSoldiers == 0));
  },

  getNodeReinforced: function (id) {
    var node = this.nodes[id];
    var playersIds = node.players.keys();

    return (playersIds.size() == 1) && (node.playerId == playersIds[0]);
  },

  getNodeSuicide: function (id) {
    var node = this.nodes[id];
    var playersIds = node.players.keys();

    var suicide = true;

    playersIds.each(function (playerId) {
      var soldiers = node.players.get(playerId);

      if (playerId != node.playerId &&
        soldiers * 2 > node.nbSoldiers) //todo: *2?
        suicide = false;
    }, this);

    return suicide;
  },

  getNodeManoAMano: function (id) {
    var node = this.nodes[id];
    var playersIds = node.players.keys();

    if (playersIds.size() < 2)
      return false;

    var even = true;
    var soldiersForEven = -1;

    playersIds.each(function (playerId) {
      var soldiers = node.players.get(playerId);

      if (soldiersForEven == -1)
        soldiersForEven = soldiers;
      else if (soldiers != soldiersForEven)
        even = false;
    }, this);

    return even;
  },

  getLastManStanding: function (id) {
    var node = this.nodes[id];
    var playersIds = node.players.keys();

    if (playersIds.size() < 2)
      return false;

    var highest = -1;
    var secondHighest = -1;
    var winner = -1;

    playersIds.each(function (playerId) {
      var soldiers = node.players.get(playerId);

      if (soldiers > highest) {
        secondHighest = highest;
        highest = soldiers;
        winner = playerId;
      } else if (soldiers > secondHighest) {
        secondHighest = soldiers;
      }
    }, this);

    return [(highest - secondHighest) == 1, winner];
  },

  getNodeCombat: function (id) {
    var node = this.nodes[id];
    var playersIds = node.players.keys();

    return playersIds.size() > 1;
  },

  getPlayers: function (id) {
    return this.nodes[id].players;
  }
});
