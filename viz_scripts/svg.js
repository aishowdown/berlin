TS.SVG = Class.create(TS.Drawable, {
  initialize: function ($super, container, options) {
    $super(container, options);
    this.raphael = Raphael(this.position.x, this.position.y, this.size.width, this.size.height);
    this.raphael.setViewBox(0, 0, this.size.width, this.size.height, true);
    this.raphael.canvas.setAttribute('preserveAspectRatio', 'none');
    container.insert(this.raphael.canvas);

    this.objects = {};
    this.active = options.active;
    this.mustRefresh = options.mustRefresh;
    this.refreshCount = 0;
  },

  clear: function () {
    this.raphael.clear();
    this.refreshCount++;
  },

  getMustRefresh: function () {
    return this.mustRefresh || this.refreshCount <= 0;
  },

  setActive: function (value) {
    this.active = value;
  },

  addObject: function (object, attrs) {
    if (object.type == 'spawn')
      this.objects[object.id] = this._createSpawnObject(object.count, attrs);
    else if (object.type == 'soldiers')
      this.objects[object.id] = this._createSoldiersObject(attrs);
    else if (object.type == 'city')
      this.objects[object.id] = this._createCityObject(attrs);
    else if (object.type == 'node')
      this.objects[object.id] = this._createNodeObject(attrs);
    else if (object.type == 'debug_node')
      this.objects[object.id] = this._createDebugNodeObject(object, attrs);
    else if (object.type == 'background')
      this.objects[object.id] = this._createBackgroundObject(object.img, object.tile);
    else if (object.type == 'path')
      this.objects[object.id] = this._createPathObject(object.from, object.to, object.controlRatio);
    else if (object.type == 'move')
      this.objects[object.id] = this._createMoveObject(object, attrs);
    else if (object.type == 'moveText')
      this.objects[object.id] = this._createMoveTextObject(object, attrs);
    else if (object.type == 'combat')
      this.objects[object.id] = this._createCombatObject(object, attrs);
    else if (object.type == 'chart')
      this.objects[object.id] = this._createChartObject(object, attrs);
  },

  addAnimation: function (id, attrs, length) {
    if (Object.keys(attrs).length != 0) {
      if (attrs['animateAlong'])
        this._animateAlong(this.objects[id], attrs['animateAlong'], length);

      this.objects[id].animate(attrs, length);
    }
  },

  _createBackgroundObject: function (img, tile) {
    if (!tile) {
      this.raphael.image(img.src, 0, 0, img.width, img.height);
      return;
    }

    for (var i = 0; i < 6; i++) //todo: don't haaaaaaardcode.
      this.raphael.image(
        img.src, (i % 3 | 0) * img.width, (i / 3 | 0) * img.height,
        img.width,
        img.height
      );
  },

  _createPathObject: function (from, to, controlRatio) {
    options = {
      color: "#ffffff",
      blurryColor: '#ffffff',
      strokeWidth: 3,
      lineJoin: 'round',
      blurryOpacity: 0.3,
      opacity: 0.1,
      dashes: '5,5'
    };

    // format and data of the path
    var pathFormat = "M #{from.x} #{from.y} Q #{control.x} #{control.y} #{to.x} #{to.y}";

    var data = {
      'from': from,
      'to': to,
      'control': controlRatio
    };

    var pathData = pathFormat.interpolate(data);

    // draw the blurry path
    var blurryPath = this.raphael.path(pathData);
    blurryPath.attr({
      'stroke': options.blurryColor,
      'stroke-width': options.strokeWidth,
      'stroke-linejoin': options.lineJoin,
      'stroke-dasharray': options.dashes,
      'opacity': options.blurryOpacity
    });
    blurryPath.blur(1);

    return blurryPath;
  },

  _createSoldiersObject: function (attrs) {
    // draw text
    var text = this.raphael.text(attrs.x, attrs.y, attrs.count);

    text.attr({
      'font': attrs.font,
      'font-weight': attrs.fontWeight,
      'font-size': attrs.fontSize,
      'fill': attrs.fill,
      'opacity': attrs.opacity
    });

    var set = this.raphael.set();
    set.push(text);

    return set;
  },

  _createSpawnObject: function (count, attrs) {
    // draw text
    var text = this.raphael.text(attrs.x, attrs.y, count);

    text.attr({
      'font': attrs.font,
      'font-weight': attrs.fontWeight,
      'font-size': attrs.fontSize,
      'fill': attrs.fill,
      'opacity': attrs.opacity
    });

    var set = this.raphael.set();
    set.push(text);

    return set;
  },

  _createCityObject: function (attrs) {
    // colorize
    var circlePosition = {
      x: attrs.x + attrs.width / 2,
      y: attrs.y + attrs.height / 2
    };

    var circle = this.raphael.circle(circlePosition.x, circlePosition.y, attrs.radius + 10);
    circle.attr({
      'opacity': 1,
      'fill': attrs.color,
      'stroke': 'none'
    });

    // draw the city
    var image = this.raphael.image(
      attrs.img.src,
      attrs.x,
      attrs.y,
      attrs.width,
      attrs.height
    );

    if (attrs.color == '#FFFFFF') {
      circle.remove();
      return image;
    }

    var city = this.raphael.set();
    city.push(image, circle);

    return city;
  },

  _createNodeObject: function (attrs) {
    // colorize
    var circlePosition = {
      x: attrs.x + attrs.width / 2,
      y: attrs.y + attrs.height / 2
    };

    var circle = this.raphael.circle(circlePosition.x, circlePosition.y, attrs.radius + 5);
    circle.attr({
      'opacity': 1,
      'fill': attrs.color,
      'stroke': 'none'
    });

    var image = this.raphael.image(
      attrs.img.src,
      attrs.x,
      attrs.y,
      attrs.width,
      attrs.height
    );

    if (attrs.color == '#FFFFFF') {
      circle.remove();
      return image;
    }

    var node = this.raphael.set();
    node.push(image, circle);

    return node;
  },

  _createMoveObject: function (object, attrs) {
    // get the position
    var position = (attrs['setPositionFromPath']) ? this._getPositionFromPath(attrs['setPositionFromPath']) : {
      x: object.from.x,
      y: object.from.y
    };

    // create the background circle
    var circle = this.raphael.circle(position.x, position.y, object.radius);
    circle.attr({
      'opacity': attrs.opacity,
      'fill': object.color,
      'stroke': 'none'
    });

    var move = this.raphael.set();

    move.push(circle);
    //move.push(army);
    return move;
  },

  _createChartObject: function (object, attrs) {
    // create the chart
    var chart = this.raphael.piechart(
      object.position.x,
      object.position.y,
      object.radius,
      object.data.clone(), {
        legend: [],
        legendpos: 'west',
        legendcolor: '#fff',
        colors: object.colors,
        matchColors: true
      });

    chart.attr({
      'opacity': attrs.opacity
    });

    return chart;
  },

  _createMoveTextObject: function (object, attrs) {
    // get the position
    var position = (attrs['setPositionFromPath']) ? this._getPositionFromPath(attrs['setPositionFromPath']) : {
      x: object.from.x,
      y: object.from.y
    };

    // create the soldiers count
    var textAttrs = object.countAttrs;
    textAttrs.x = position.x;
    textAttrs.y = position.y;
    textAttrs.opacity = attrs['opacity'];
    textAttrs.count = object.count;

    return this._createSoldiersObject(textAttrs);
  },

  _createCombatObject: function (object, attrs) {
    // create the combat graphic
    if (attrs.img != null) {
      var image = this.raphael.image(
        attrs.img.src,
        attrs.x - attrs.img.width / 2,
        attrs.y - attrs.img.height / 2,
        attrs.img.width,
        attrs.img.height);

      image.attr({
        'transform': attrs['transform'],
        'opacity': attrs['opacity']
      });
    }

    // create the combat quote
    var text = this.raphael.text(attrs.x, attrs.y, object.text);
    text.attr(object.textAttrs);

    var combat = this.raphael.set();
    combat.push(text);

    if (attrs.img != null)
      combat.push(image);

    return combat;
  },

  _createDebugNodeObject: function (object, attrs) {
    var text = this.raphael.text(object.position.x, object.position.y + 30, object.node);

    text.attr({
      'font': object.font,
      'font-weight': object.fontWeight,
      'font-size': object.fontSize,
      'fill': object.fill,
      'opacity': object.opacity
    });

    var set = this.raphael.set();
    set.push(text);

    return set;
  },

  _animateAlong: function (object, attrs, length) {
    // get the full path
    var path = this.raphael.path(attrs['path']);

    // prepare the partial path
    var pathLength = path.getTotalLength();
    var sub = path.getSubpath(attrs['start'] * pathLength, attrs['end'] * pathLength);

    // remove the full path
    path.remove();

    animationAttrs = {};
    animationAttrs["duration"] = length
    animationAttrs["path"] = sub

    $A(object).each(function (data) {
      data.animateAlong(animationAttrs);
    });
  },

  _getPositionFromPath: function (data) {
    // get the full path
    var path = this.raphael.path(data['path']);

    // prepare the partial path
    var pathLength = path.getTotalLength();
    var position = path.getPointAtLength(path.getTotalLength() * data['at']);

    // remove the full path
    path.remove();

    return position;
  },

  _getRotationFromPath: function (pathData, positionPourc, reverse) {
    // prepare the path
    var path = this.raphael.path(pathData);
    var length = path.getTotalLength();
    var positionBegin = path.getPointAtLength(length * positionPourc);
    var positionEnd = path.getPointAtLength(length * (reverse ? Math.max(0, positionPourc - 0.001) : Math.min(100, positionPourc + 0.001)));

    // remove the path
    path.remove();

    // compute the angle
    var vector = {
      x: positionEnd.x - positionBegin.x,
      y: positionEnd.y - positionBegin.y
    }

    var angleRad = Math.atan2(vector.y, vector.x);

    return angleRad * (180 / Math.PI);
  }
});
