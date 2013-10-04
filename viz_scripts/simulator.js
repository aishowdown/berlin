TS.AIMap = Class.create(TS, {
  initialize: function ($super, container, map_data, options) {
    $super();

    this.options = Object.extend({
      engine: "SVG"
    }, options || {});

    this.container = $(container);
    this.layers = {};
    this.graphics = {};
    this.color = new TS.Color();
    this.size = {
      width: this.container.getWidth(),
      height: this.container.getHeight()
    };

    this.config = map_data.representation;
    this.imagesToLoad = this.config.images.size();
    this.nodeGraph = new TS.NodeGraph(this.config);

    // Create a canvas element for each display layer
    $A(['background', 'paths', 'nodes', 'moves', 'soldiers', 'combats', 'spawns', 'debug']).each(function (layer) {
      this.layers[layer] = new TS[this.options.engine](
        this.container, {
          position: {
            x: 0,
            y: 0
          },
          size: this.size,
          active: ['debug'].indexOf(layer) <= -1,
          mustRefresh: ['nodes', 'moves', 'soldiers', 'combats', 'spawns'].indexOf(layer) > -1,
          translate: this.config.infos.translate
        }
      );
    }, this);


    // Preload all the images
    this.config.images.each(function (data) {
      var img = new Image();
      img.onload = this.onImageLoaded.bindAsEventListener(this, data.name);
      img.src = (this.options.assets_path) + data.src;
    }, this);
  },

  /*
   * Callback after each image is loaded
   */
  onImageLoaded: function (event, name) {
    this.graphics[name] = event.findElement();

    this.imagesToLoad--;

    // when all the images are loaded, tell the world.
    if (this.imagesToLoad == 0)
      this.fire("ready");
  },

  /*
   * Called every time a new turn happens
   */
  doTurn: function (turnBefore, turnNow, forward) {
    // if a turnBefore exists, we must play the departure animations
    if (turnBefore) {
      Object.keys(turnBefore.layers).each(function (layerName) {
        var layer = this.layers[layerName];

        if (!layer.getMustRefresh()) {
          return;
        }

        // clear the layer
        layer.clear();

        if (!layer.active) {
          return;
        }

        var data = turnBefore.layers[layerName];

        // add the objects
        data.objects.each(function (object) {
          layer.addObject(
            object,
            data[forward ? 'forward_departure' : 'backward_departure'][object.id].start);
        }, this);

        // add the animations
        Object.keys(data[forward ? 'forward_departure' : 'backward_departure']).each(function (animationId) {
          var animation = data[forward ? 'forward_departure' : 'backward_departure'][animationId];
          layer.addAnimation(animationId, animation.end, animation.length);
        }, this);
      }, this);
    }

    if (turnNow) {
      Object.keys(turnNow.layers).each(function (layerName) {
        var layer = this.layers[layerName];

        if (!layer.getMustRefresh()) {
          return;
        }

        // clear the layer
        layer.clear();

        if (!layer.active) {
          return;
        }

        var data = turnNow.layers[layerName];

        // add the objects
        data.objects.each(function (object) {
          layer.addObject(object, data[forward ? 'forward_arrival' : 'backward_arrival'][object.id].start);
        }, this);

        // add the animations
        Object.keys(data[forward ? 'forward_arrival' : 'backward_arrival']).each(function (animationId) {
          var animation = data[forward ? 'forward_arrival' : 'backward_arrival'][animationId];
          layer.addAnimation(animationId, animation.end, animation.length);
        }, this);
      }, this);
    }
  },

  drawDebugLayer: function (turn) {
    var layer = this.layers['debug'];

    if (!layer.getMustRefresh()) {
      return;
    }

    // clear the layer
    layer.clear();

    if (!layer.active) {
      return;
    }

    var data = turn.layers['debug'];

    // add the objects
    data.objects.each(function (object) {
      layer.addObject(object, data['forward_arrival'][object.id].start);
    }, this);
  }
});
