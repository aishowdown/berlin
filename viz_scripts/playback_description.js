TS.PlaybackDescription = Class.create(TS, {
  initialize: function (mapDescription, map, gameDescription, canvas, graphics, stepTime) {
    this.mapDescription = mapDescription;
    this.map = map;
    this.gameDescription = gameDescription;
    this.canvas = canvas;
    this.graphics = graphics;

    this.turns = new Array();
    this.preview = null;
    this.currentTurn = 0;
    this.direction = 'forward';

    this.stepTime = stepTime;

    this.simulatioGameRatio = 5;
  },

  /*
   * Initialize the turns object with all the steps necessary
   * to draw the game replay on the screen
   */
  initializeTurns: function () {
    // process each turn of the game description
    Object.keys(this.gameDescription.turns).each(function (turnId) {
      var turn = this.gameDescription.turns[turnId];
      var result = null;

      this.map.syncStates(turn.states_pre);
      this.map.syncCombats(turn.moves);

      this.turns.push(this._processStates(turn.states_pre));
      this.turns.push(this._processMoves(turn.moves, turn.states_pre));
      this.turns.push(this._processCombats(turn.moves, turn.states_pre));

      this.map.syncStates(turn.states_post);

      this.turns.push(this._processStates(turn.states_post));
      this.turns.push(this._processSpawns(turn.spawns, turn.states_post));
    }, this);

    // prepare first turn
    this._setup(this.turns[0]);
  },

  /*
   * Initialize the preview object with all the step necessary
   * to draw the preview of the map on the screen
   */
  initializePreview: function () {
    this.preview = this._createTurn(['nodes']);
    this._setup(this.preview);
    this._processNodes(this.preview.layers['nodes']);
  },

  /*
   * Setup the first turn to:
   * - draw the background
   * - draw the paths
   */
  _setup: function (turn) {
    var nextId = 0;
    var layer = null;
    var object = null;
    var animations = null;

    // setup the background
    layer = this._createLayer();

    object = this._createBackgroundObject(nextId, this.mapDescription.infos['tile_background'] || true);
    this._syncAnimationLayerObject(layer, object.id, this._createEmptyAnimation());
    layer.objects.push(object);

    turn.layers['background'] = layer;

    nextId++;

    // setup the paths
    layer = this._createLayer();

    Object.keys(this.map.nodes).each(function (nodeId) {
      var node = this.map.nodes[nodeId];

      node.links.each(function (link) {
        object = this._createPathObject(nextId, nodeId, link.toId);
        this._syncAnimationLayerObject(layer, object.id, this._createEmptyAnimation());
        layer.objects.push(object);

        nextId++;
      }, this);
    }, this);

    turn.layers['paths'] = layer;

    // setup debug
    layer = this._createLayer();

    Object.keys(this.map.nodes).each(function (nodeId) {
      object = this._createDebugNodeObject(nextId, this.map.nodes[nodeId]);
      layer.objects.push(object);
      this._syncAnimationLayerObject(layer, object.id, this._createEmptyAnimation());
      nextId++;
    }, this);

    turn.layers['debug'] = layer;
    turn.layers['spawns'] = this._createLayer();
    turn.layers['combats'] = this._createLayer();
  },

  /*
   * Process the moves of a turn
   */
  _processMoves: function (moves, preStates) {
    var nextId = 0;

    var turn = this._createTurn(['moves']);

    var result = this._processStates(preStates);
    turn.layers['nodes'] = result.layers['nodes'];
    turn.layers['soldiers'] = result.layers['soldiers'];

    var layer = turn.layers['moves'];

    this.players = turn.players;

    $A(moves).each(function (data) {
      var moveObject = this._createMoveObject(nextId, data.from, data.to, data.player_id, data.number_of_soldiers);
      var moveAnimations = this._createMoveAnimations(moveObject);
      this._syncAnimationLayerObject(layer, moveObject.id, moveAnimations);
      layer.objects.push(moveObject);
      nextId++;

      var moveTextObject = this._createMoveObject(nextId, data.from, data.to, data.player_id, data.number_of_soldiers);
      moveTextObject.type = 'moveText';
      moveTextObject.rotate = false;
      var moveTextAnimations = this._createMoveAnimations(moveTextObject);
      this._syncAnimationLayerObject(layer, moveTextObject.id, moveTextAnimations);
      layer.objects.push(moveTextObject);
      nextId++;

      //decrement the number of soldiers on the starting node
      $A(turn.layers['soldiers'].objects).each(function (soldier) {
        if (soldier.node == data.from) {
          turn.layers['soldiers'].forward_arrival[soldier.id].start.count -= data.number_of_soldiers;
          turn.layers['soldiers'].backward_arrival[soldier.id].start.count = turn.layers['soldiers'].forward_arrival[soldier.id].start.count;
        }
      }, this);
    }, this);

    return turn;
  },


  /*
   * Process the combats of a turn
   */
  _processCombats: function (moves, preStates) {
    var nextId = 0;

    var turn = this._createTurn(['combats']);

    var result = this._processStates(preStates);
    turn.layers['nodes'] = result.layers['nodes'];
    turn.layers['soldiers'] = result.layers['soldiers'];

    this.players = turn.players;

    var layer = turn.layers['combats'];

    $A(moves).each(function (data) {
      var fromNode = this.map.nodes[data.from];
      var toNode = this.map.nodes[data.to];

      var combatObject = this._createCombatObject(nextId, data.to);

      // add a commentary on the move
      // if (this.map.getNodeCaptured(data.to)) {
      // 	combatObject.text = "captured!";
      // 	combatObject.textAttrs.fill = this._getPlayerColor(this.map.nodes[data.from].playerId);
      // 	combatObject.blurColor = '#000';
      // } else if (this.map.getNodeReinforced(data.to)) {
      // 	combatObject.text = "reinforced!";
      // 	combatObject.textAttrs.fill = this._getPlayerColor(this.map.nodes[data.from].playerId);
      // 	combatObject.blurColor = '#000';
      // } else if (this.map.getNodeSuicide(data.to)) {
      // 	combatObject.text = "kamikaze!";
      // 	combatObject.textAttrs.fill = this._getPlayerColor(this.map.nodes[data.from].playerId);
      // 	combatObject.blurColor = '#000';
      // } else if (this.map.getNodeManoAMano(data.to)) {
      // 	combatObject.text = "Mano a mano!";
      // 	combatObject.textAttrs.fill = '#ffffff';
      // } else if (this.map.getLastManStanding(data.to)[0]) {
      // 	combatObject.text = "Last man standing!";
      // 	combatObject.textAttrs.fill = this._getPlayerColor(this.map.getLastManStanding(data.to)[1]);
      // 	combatObject.blurColor = '#000';
      // } else if (this.map.getNodeCombat(data.to)) {
      // 	combatObject.text = "fight!";
      // 	combatObject.textAttrs.fill = '#ffffff';
      // }

      layer.objects.push(combatObject);

      var combatAnimations = this.map.getNodeCombat(data.to) ?
        this._createCombatAnimations(combatObject) :
        this._createCombatAnimations2(combatObject);

      this._syncAnimationLayerObject(layer, combatObject.id, combatAnimations);

      nextId++;

      // if the node is in combat, create a chart object that displays the players involved
      if (this.map.getNodeCombat(data.to)) {
        var players = this.map.getPlayers(data.to);

        var chartObject = this._createChartObject(nextId, data.to, players);
        var charAnimations = this._createChartAnimations(chartObject);

        this._syncAnimationLayerObject(layer, chartObject.id, charAnimations);

        layer.objects.push(chartObject);

        nextId++;
      }

      //- decrement the number of soldiers on the starting node
      //- increment the number of soldiers on the ending node (if the same player or no player)
      $A(turn.layers['soldiers'].objects).each(function (soldier) {
        if (soldier.node == data.from) {
          turn.layers['soldiers'].forward_arrival[soldier.id].start.count -= data.number_of_soldiers;
          turn.layers['soldiers'].backward_arrival[soldier.id].start.count = turn.layers['soldiers'].forward_arrival[soldier.id].start.count;
        }

        if ((soldier.node == data.to && this.map.nodes[soldier.node].playerId == this.map.nodes[data.from].playerId) || //reinforce
          (soldier.node == data.to && this.map.nodes[soldier.node].playerId == null) || //capture (no owner)
          (soldier.node == data.to && this.map.nodes[soldier.node].nbSoldiers == 0)) //capture (0 soldiers)
        {
          turn.layers['soldiers'].forward_arrival[soldier.id].start.count += data.number_of_soldiers;
          turn.layers['soldiers'].backward_arrival[soldier.id].start.count = turn.layers['soldiers'].forward_arrival[soldier.id].start.count;
        }
      }, this);

      // announce capture
      $A(turn.layers['nodes'].objects).each(function (node) {
        if (node.node == data.to) {
          turn.layers['nodes'].forward_arrival[node.id].start.color = this._getPlayerColor(this.map.nodes[data.from].playerId);
          turn.layers['nodes'].backward_arrival[node.id].start.color = turn.layers['nodes'].forward_arrival[node.id].start.color;
        }
      }, this);
    }, this);

    return turn;
  },

  _processStates: function (states) {
    var turn = this._createTurn(['nodes', 'soldiers']);

    this.players = turn.players;

    // prepare the nodes and cities
    this._processNodes(turn.layers['nodes']);

    // prepare the soldiers counts
    var nextId = 0;
    var layer = turn.layers['soldiers'];

    $A(states).each(function (data) {
      var soldiersObject = this._createSoldiersObject(nextId++, data.node_id, data.number_of_soldiers);
      var soldiersAnimations = this._createSoldiersAnimations(soldiersObject);
      this._syncAnimationLayerObject(layer, soldiersObject.id, soldiersAnimations);
      layer.objects.push(soldiersObject);
      nextId++;
    }, this);

    return turn;
  },

  /*
   * Process the nodes and the cities
   */
  _processNodes: function (layer) {
    var nextId = 0;
    var nodeObject = null;
    var nodeAnimations = null;

    Object.keys(this.map.nodes).each(function (nodeId) {
      var node = this.map.nodes[nodeId];

      if (node.type == 'node') {
        nodeObject = this._createNodeObject(nextId, node);
        nodeAnimations = this._createNodeAnimations(nodeObject, node);
      } else if (node.type == 'city') {
        nodeObject = this._createCityObject(nextId, node);
        nodeAnimations = this._createCityAnimations(nodeObject, node);
      }

      layer.objects.push(nodeObject);

      this._syncAnimationLayerObject(layer, nodeObject.id, nodeAnimations);

      nextId++;
    }, this);
  },

  _processSpawns: function (spawns, preStates) {
    var nextId = 0;

    var turn = this._createTurn(['spawns']);

    var result = this._processStates(preStates);
    turn.layers['nodes'] = result.layers['nodes'];
    turn.layers['soldiers'] = result.layers['soldiers'];
    turn.layers['moves'] = this._createLayer();
    turn.layers['combats'] = this._createLayer();


    this.players = turn.players;

    $A(spawns).each(function (data) {
      var spawnObject = this._createSpawnObject(nextId, data.node_id, data.number_of_soldiers);

      var layer = turn.layers['spawns'];

      layer.objects.push(spawnObject);

      var spawnAnimations = this._createSpawnAnimations(spawnObject);

      this._syncAnimationLayerObject(layer, spawnObject.id, spawnAnimations);

      //increment the number of soldiers
      $A(turn.layers['soldiers'].objects).each(function (soldier) {
        if (soldier.node == data.node_id) {
          turn.layers['soldiers'].forward_departure[soldier.id].start.count += data.number_of_soldiers;
          turn.layers['soldiers'].backward_departure[soldier.id].start.count = turn.layers['soldiers'].forward_departure[soldier.id].start.count;
        }
      }, this);

      nextId++;
    }, this);

    return turn;
  },

  /*
   * Create a chart object
   */
  _createChartObject: function (id, node, players) {
    var object = {
      'id': id,
      'type': 'chart',
      'position': this._getNodePosition(node),
      'radius': 15,
      'colors': new Array(),
      'data': new Array()
    };

    players.each(function (pair) {
      var color = this._getPlayerColor(pair.key);
      var soldiers = pair.value;

      object.colors.push(color);
      object.data.push(soldiers);
    }, this);

    return object;
  },

  /*
   * Create chart animations
   */
  _createChartAnimations: function (chartObject) {
    var animations = {
      'forward_arrival': {
        'start': {
          'opacity': 1
        },
        'end': {
          'opacity': 1
        },
        'length': this.stepTime
      },

      'forward_departure': {
        'start': {
          'opacity': 1
        },
        'end': {
          'opacity': 0
        },
        'length': this.stepTime
      },

      'backward_arrival': {
        'start': {
          'opacity': 0
        },
        'end': {
          'opacity': 1
        },
        'length': this.stepTime
      },

      'backward_departure': {
        'start': {
          'opacity': 1
        },
        'end': {
          'opacity': 0
        },
        'length': this.stepTime
      }
    };

    return animations;
  },

  /*
   * Create a soldiers object
   */
  _createSoldiersObject: function (id, node, count) {
    var object = {
      'id': id,
      'type': 'soldiers',
      'node': node,
      'position': this._getNodePosition(node),
      'count': count
    };

    return object;
  },

  /*
   * Create soldiers animations
   */
  _createSoldiersAnimations: function (soldierObject) {
    var animations =

    {
      'forward_arrival': {
        'start': {
          'x': soldierObject.position.x,
          'y': soldierObject.position.y,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': '#000000',
          'blurColor': '#FFFFFF',
          'count': soldierObject.count
        },

        'end': {},
        'length': 0
      },

      'forward_departure': {
        'start': {
          'x': soldierObject.position.x,
          'y': soldierObject.position.y,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': '#000000',
          'blurColor': '#FFFFFF',
          'count': soldierObject.count
        },

        'end': {},
        'length': 0
      },

      'backward_arrival': {
        'start': {
          'x': soldierObject.position.x,
          'y': soldierObject.position.y,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': '#000000',
          'blurColor': '#FFFFFF',
          'count': soldierObject.count
        },

        'end': {},
        'length': 0
      },

      'backward_departure':

      {
        'start': {
          'x': soldierObject.position.x,
          'y': soldierObject.position.y,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': '#000000',
          'blurColor': '#FFFFFF',
          'count': soldierObject.count
        },

        'end': {},
        'length': 0
      }
    };

    return animations;
  },

  /*
   * Create a spawn object
   */
  _createSpawnObject: function (id, node, count) {
    var object = {
      'id': id,
      'type': 'spawn',
      'color': this._getPlayerColor(this.map.nodes[node].playerId),
      'position': this._getNodePosition(node),
      'count': '+' + count
    };

    return object;
  },

  /*
   * Create spawn animations
   */
  _createSpawnAnimations: function (spawnObject) {
    var animations =

    {
      'forward_arrival': {
        'start': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y,
          'opacity': 0,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': spawnObject.color,
          'blurColor': '#000'
        },

        'end': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y - 30,
          'opacity': 1
        },

        'length': this.stepTime
      },

      'forward_departure': {
        'start': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y - 30,
          'opacity': 1,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': spawnObject.color,
          'blurColor': '#000'
        },

        'end': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y - 60,
          'opacity': 0
        },

        'length': this.stepTime
      },

      'backward_arrival': {
        'start': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y - 60,
          'opacity': 0,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': spawnObject.color,
          'blurColor': '#000'
        },

        'end': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y - 30,
          'opacity': 1
        },

        'length': this.stepTime
      },

      'backward_departure': {
        'start': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y - 30,
          'opacity': 1,
          'font': 'Symbol',
          'fontWeight': 'bold',
          'fontSize': 20,
          'fill': spawnObject.color,
          'blurColor': '#000'
        },

        'end': {
          'x': spawnObject.position.x,
          'y': spawnObject.position.y,
          'opacity': 0
        },

        'length': this.stepTime
      }
    };

    return animations;
  },

  /*
   * Create a move object
   */
  _createMoveObject: function (id, from, to, playerId, count) {
    var object = {
      'id': id,
      'type': 'move',
      'count': count,
      'countAttrs': {
        'font': 'Symbol',
        'fontWeight': 'bold',
        'fontSize': 20,
        'fill': '#000000',
        'blurColor': '#FFFFFF'
      },
      'color': this.players[playerId].color,
      'radius': 10,
      'rotate': true,
      'from': this._getNodePosition(from),
      'to': this._getNodePosition(to)
    };

    var link = this.map.nodes[from].getLink(to);
    var backPointer = false;

    if (link == null) {
      link = this.map.nodes[to].getLink(from);
      backPointer = true;
    }

    object['controlRatio'] = this._getQuadraticCurvePoint(
      backPointer ? object.to : object.from,
      backPointer ? object.from : object.to,
      link.controlRatio);

    return object;
  },

  /*
   * Create move animations
   */
  _createMoveAnimations: function (moveObject) {
    var img = (moveObject.from.x > moveObject.to.x) ? this.graphics.army1 : this.graphics.army1_backward;

    var animations =

    {
      'forward_arrival': {
        'start': {
          'opacity': 0,
          'x': moveObject.from.x,
          'y': moveObject.from.y,
          'img': img
        },
        'end': {
          'opacity': 1,
          'animateAlong': {
            'start': 0,
            'end': 0.4,
            'path': "M #{from.x} #{from.y} Q #{controlRatio.x} #{controlRatio.y} #{to.x} #{to.y}".interpolate(moveObject),
            'rotate': moveObject.rotate
          }
        },
        'length': this.stepTime
      },

      'forward_departure': {
        'start': {
          'opacity': 1,
          'setPositionFromPath': {
            'at': 0.4,
            'path': "M #{from.x} #{from.y} Q #{controlRatio.x} #{controlRatio.y} #{to.x} #{to.y}".interpolate(moveObject)
          },
          'img': img
        },
        'end': {
          'opacity': 0,
          'animateAlong': {
            'start': 0.4,
            'end': 1,
            'path': "M #{from.x} #{from.y} Q #{controlRatio.x} #{controlRatio.y} #{to.x} #{to.y}".interpolate(moveObject),
            'rotate': moveObject.rotate
          }
        },
        'length': this.stepTime
      },

      'backward_arrival': {
        'start': {
          'opacity': 0,
          'setPositionFromPath': {
            'at': 1,
            'path': "M #{from.x} #{from.y} Q #{controlRatio.x} #{controlRatio.y} #{to.x} #{to.y}".interpolate(moveObject)
          },
          'img': img
        },
        'end': {
          'opacity': 1,
          'animateAlong': {
            'start': 1,
            'end': 0.6,
            'path': "M #{to.x} #{to.y} Q #{controlRatio.x} #{controlRatio.y} #{from.x} #{from.y}".interpolate(moveObject),
            'rotate': moveObject.rotate
          }
        },
        'length': this.stepTime
      },

      'backward_departure': {
        'start': {
          'opacity': 1,
          'setPositionFromPath': {
            'at': 0.4,
            'path': "M #{from.x} #{from.y} Q #{controlRatio.x} #{controlRatio.y} #{to.x} #{to.y}".interpolate(moveObject)
          },
          'img': img
        },
        'end': {
          'opacity': 0,
          'animateAlong': {
            'start': 0.6,
            'end': 1,
            'path': "M #{to.x} #{to.y} Q #{controlRatio.x} #{controlRatio.y} #{from.x} #{from.y}".interpolate(moveObject),
            'rotate': moveObject.rotate
          }
        },
        'length': this.stepTime
      }
    };

    return animations;
  },

  /*
   * Create a combat object
   */
  _createCombatObject: function (id, position) {
    var object = {
      'id': id,
      'type': 'combat',
      'text': '',
      'textAttrs': {
        'font': 'Symbol',
        'font-weight': 'normal',
        'font-size': 12,
        'fill': '#fff',
      },
      'blurColor': '#fff',
      'position': this._getNodePosition(position)
    };

    object.textAttrs.y = object.position.y - 30;

    return object;
  },

  /*
   * Create combat animations
   */
  _createCombatAnimations: function (combatObject) {
    var animations = {
      'forward_arrival': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'img': this.graphics.combat,
          'transform': 's1,1',
          'opacity': 1
        },
        'end': {
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'length': this.stepTime
      },

      'forward_departure': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'img': this.graphics.combat,
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'end': {
          'transform': 's0.0001,0.0001',
          'opacity': 0
        },
        'length': this.stepTime
      },

      'backward_arrival': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'img': this.graphics.combat,
          'transform': 's0.0001,0.0001',
          'opacity': 0
        },
        'end': {
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'length': this.stepTime
      },

      'backward_departure': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'img': this.graphics.combat,
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'end': {
          'transform': 's1,1',
          'opacity': 0
        },
        'length': this.stepTime
      }
    };

    return animations;
  },


  /*
   * Create combat animations
   */
  _createCombatAnimations2: function (combatObject) {
    var animations = {
      'forward_arrival': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'transform': 's1,1',
          'opacity': 1
        },
        'end': {
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'length': this.stepTime
      },

      'forward_departure': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'end': {
          'transform': 's0.0001,0.0001',
          'opacity': 0
        },
        'length': this.stepTime
      },

      'backward_arrival': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'transform': 's0.0001,0.0001',
          'opacity': 0
        },
        'end': {
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'length': this.stepTime
      },

      'backward_departure': {
        'start': {
          'x': combatObject.position.x,
          'y': combatObject.position.y,
          'transform': 's0.5,0.5',
          'opacity': 1
        },
        'end': {
          'transform': 's1,1',
          'opacity': 0
        },
        'length': this.stepTime
      }
    };

    return animations;
  },

  /*
   * Create a node object
   */
  _createNodeObject: function (id, node) {
    var object = {
      'id': id,
      'type': 'node',
      'node': node.id,
      'position': this._getNodePosition(node.id)
    };

    return object;
  },

  /*
   * Create a debug node object
   */
  _createDebugNodeObject: function (id, node) {
    var object = {
      'id': id,
      'type': 'debug_node',
      'node': node.id,
      'position': this._getNodePosition(node.id),
      'opacity': 0.5,
      'font': 'Symbol',
      'fontWeight': 'bold',
      'fontSize': 20,
      'fill': '#FFF'
    };

    return object;
  },

  /*
   * Create a node animations
   */
  _createNodeAnimations: function (nodeObject, node, bypassColor) {
    var animations =

    {
      'forward_arrival': {
        'start': {
          'x': nodeObject.position.x - this.graphics.node.width / 2,
          'y': nodeObject.position.y - this.graphics.node.height / 2,
          'img': this.graphics.node,
          'width': this.graphics.node.width,
          'height': this.graphics.node.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'radius': 10
        },

        'end': {},
        'length': 0
      },

      'forward_departure': {
        'start': {
          'x': nodeObject.position.x - this.graphics.node.width / 2,
          'y': nodeObject.position.y - this.graphics.node.height / 2,
          'img': this.graphics.node,
          'width': this.graphics.node.width,
          'height': this.graphics.node.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'radius': 10
        },

        'end': {},
        'length': 0
      },

      'backward_arrival': {
        'start': {
          'x': nodeObject.position.x - this.graphics.node.width / 2,
          'y': nodeObject.position.y - this.graphics.node.height / 2,
          'img': this.graphics.node,
          'width': this.graphics.node.width,
          'height': this.graphics.node.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'radius': 10
        },

        'end': {},
        'length': 0
      },

      'backward_departure':

      {
        'start': {
          'x': nodeObject.position.x - this.graphics.node.width / 2,
          'y': nodeObject.position.y - this.graphics.node.height / 2,
          'img': this.graphics.node,
          'width': this.graphics.node.width,
          'height': this.graphics.node.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'radius': 10
        },

        'end': {},
        'length': 0
      }
    };

    return animations;
  },

  /*
   * Create a city object
   */
  _createCityObject: function (id, node) {
    var object = {
      'id': id,
      'type': 'city',
      'node': node.id,
      'position': this._getNodePosition(node.id)
    };

    return object;
  },

  /*
   * Create city animations
   */
  _createCityAnimations: function (nodeObject, node) {
    var img = (node.layout == 0) ? this.graphics.city1 :
      (node.layout == 1) ? this.graphics.city2 : this.graphics.city3;

    var animations = {
      'forward_arrival': {
        'start': {
          'x': nodeObject.position.x - img.width / 2,
          'y': nodeObject.position.y - img.height / 2,
          'img': img,
          'width': img.width,
          'height': img.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'layout': node.layout,
          'radius': 7.5,
          'spacing': 1.8
        },

        'end': {},
        'length': 0
      },

      'forward_departure': {
        'start': {
          'x': nodeObject.position.x - img.width / 2,
          'y': nodeObject.position.y - img.height / 2,
          'img': img,
          'width': img.width,
          'height': img.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'layout': node.layout,
          'radius': 7.5,
          'spacing': 1.8
        },

        'end': {},
        'length': 0
      },

      'backward_arrival': {
        'start': {
          'x': nodeObject.position.x - img.width / 2,
          'y': nodeObject.position.y - img.height / 2,
          'img': img,
          'width': img.width,
          'height': img.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'layout': node.layout,
          'radius': 7.5,
          'spacing': 1.8
        },

        'end': {},
        'length': 0
      },

      'backward_departure':

      {
        'start': {
          'x': nodeObject.position.x - img.width / 2,
          'y': nodeObject.position.y - img.height / 2,
          'img': img,
          'width': img.width,
          'height': img.height,
          'color': (node.playerId != null) ? this._getPlayerColor(node.playerId) : '#FFFFFF',
          'layout': node.layout,
          'radius': 7.5,
          'spacing': 1.8
        },

        'end': {},
        'length': 0
      }
    };

    return animations;
  },

  /*
   * Create a background object
   */
  _createBackgroundObject: function (id, tile) {
    var object = {
      'id': id,
      'type': 'background',
      'img': this.graphics.background,
      'tile': tile
    };

    return object;
  },

  /*
   * Create a path object
   */
  _createPathObject: function (id, from, to) {
    var object = {
      'id': id,
      'type': 'path',
      'from': this._getNodePosition(from),
      'to': this._getNodePosition(to)
    };

    var link = this.map.nodes[from].getLink(to) || this.map.nodes[to].getLink(from);

    object['controlRatio'] = this._getQuadraticCurvePoint(object.from, object.to, link.controlRatio);

    return object;
  },

  /*
   * Obtain the absolute position of a node
   */
  _getNodePosition: function (nodeId) {
    return this.canvas.getAbsolutePosition(this.map.nodes[nodeId].position);
  },

  /*
   * Create a new empty turn
   */
  _createTurn: function (layers) {
    var turn = {
      'players': (this.gameDescription == null) ? null : this._getPlayersStates(this.gameDescription.infos.number_of_players),
      'layers': {}
    };

    $A(layers).each(function (layer) {
      turn.layers[layer] = this._createLayer();
    }, this);

    return turn;
  },

  /*
   * Create a layer data object
   */
  _createLayer: function () {
    var layer = {
      objects: new Array(),
      forward_arrival: {},
      forward_departure: {},
      backward_arrival: {},
      backward_departure: {}
    };

    return layer;
  },

  /*
   *
   */
  _getPlayerColor: function (playerId) {
    return (this.players == null || this.players[playerId] == null) ? '#FFFFFF' : this.players[playerId].color;
  },

  /*
   * Get the state of the players
   */
  _getPlayersStates: function (nbPlayers) {
    // create the players
    var players = {};

    for (var i = 0; i < nbPlayers; i++)
      players[i] = new TS.Player(i);

    // synchronize the players with the map
    Object.keys(players).each(function (playerId) {
      var player = players[playerId];

      player.sync(this.map);
    }, this);

    return players;
  },

  /*
   * Synchronize the state of the players
   */
  _syncPlayers: function () {
    Object.keys(this.players).each(function (playerId) {
      var player = this.players[playerId];

      player.sync(this.map);
    }, this);
  },

  /*
   * Get the quadratic curve point
   */
  _getQuadraticCurvePoint: function (from, to, ratio) {
    var data = {
      x: (from.x + (to.x - from.x) / 2 + (to.y - from.y) * ratio),
      y: (from.y + (to.y - from.y) / 2 + (to.x - from.x) * ratio * -1)
    };

    return data;
  },

  /*
   * Get the angle of a vector
   */
  _getRotation: function (start, end) {
    // compute the angle
    var vector = {
      x: end.x - start.x,
      y: end.y - start.y
    }

    var angleRad = Math.atan2(vector.y, vector.x);

    return angleRad * (180 / Math.PI);
  },

  /*
   * Synchronize an Animation descriptor with a Layer's Object descriptor
   */
  _syncAnimationLayerObject: function (layer, objectId, animation) {
    layer.forward_arrival[objectId] = animation.forward_arrival;
    layer.forward_departure[objectId] = animation.forward_departure;
    layer.backward_arrival[objectId] = animation.backward_arrival;
    layer.backward_departure[objectId] = animation.backward_departure;
  },

  /*
   * Create an empty animation descriptor
   */
  _createEmptyAnimation: function () {
    var animation = {
      'forward_arrival': {
        'start': {},
        'end': {},
        'length': 0
      },

      'forward_departure': {
        'start': {},
        'end': {},
        'length': 0
      },

      'backward_arrival': {
        'start': {},
        'end': {},
        'length': 0
      },

      'backward_departure': {
        'start': {},
        'end': {},
        'length': 0
      }
    };

    return animation;
  }
});
