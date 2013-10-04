TS.Animation = Class.create(TS, {
  initialize: function (element) {
    this.element = element;

    this.steps = new Array();
    this.currentStep = 0;
  },

  addStep: function (begin, end, time) {
    this.steps.push({
      'begin': begin,
      'end': end,
      'time': time
    });
  },

  nextStep: function () {
    var step = this.steps[this.currentStep];

    //this.attr(step.begin);
    //this.element.stop();
    this.element.animate(step.end, step.time)

    this.currentStep = Math.min(this.currentStep + 1, this.steps.length);
  },

  previousStep: function () {
    this.currentStep = Math.max(this.currentStep - 1, -1);

    if (this.currentStep == -1)
      return;

    var step = this.steps[this.currentStep];

    //this.attr(step.end);
    this.attr(step.end);
    this.element.stop();
    this.element.animate(step.begin, step.time);
  },

  terminated: function () {
    return this.currentStep == this.steps.length || this.currentStep == -1;
  }
});
