TS.Player = Class.create(TS, {
  initialize: function ($super, id) {
    this.id = id;
    this.color = this._initPlayerColor(id);

    this.soldiers = 0;
    this.nodes = 0;
    this.score = 0;
  },

  sync: function (map) {
    this.soldiers = 0;
    this.nodes = 0;
    this.score = 0;

    Object.keys(map.nodes).each(function (nodeId) {
      var node = map.nodes[nodeId];

      // sync score
      if (this.id == node.playerId)
        this.score += node.value;

      // sync nodes
      if (this.id == node.playerId)
        this.nodes += 1;

      // sync soldiers
      var movesIds = node.players.keys();

      movesIds.each(function (id) {
        if (this.id == id)
          this.soldiers += node.players.get(id);
      }, this);
    }, this);
  },

  /*
   * Get the player's color (for a known player)
   */
  _initPlayerColor: function (playerId) {
    return ['#bd1550', '#e97f02', '#50a2e9', '#ffd802', '#21bbad', '#8a9b0f'][playerId] || '#ffffff'
  }
});
