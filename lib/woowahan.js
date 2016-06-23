var _ = require('lodash');
var $ = require('jquery');
var Handlebars = require('handlebars/runtime');
var format = require('util').format;
var Debug = require('debug');
var Backbone = require('backbone');
var Router = require('./router');

const debug = Debug('Woowahan');
const INTERVAL = 1000/60;

global._ = _;
global.$ = window.jQuery = $;
global.Handlebars = Handlebars;

/* Enable backbone.js devtools for chrome */
if (global.__backboneAgent) {
  global.__backboneAgent.handleBackbone(Backbone);
}

class Woowahan {
  constructor(settings = {}) {
    this.reducers = settings.reducers || {};
    this.routers = settings.routers || {};

    this.queue = [];
    this.actionObject = {};
    this.queuemonitor = null;
    
    this.router = null;

    global.woowahan = this;
  }

  enableQueue() {
    this.queuemonitor = setInterval(_.bind(this.queuing, this), INTERVAL);
  }

  disableQueue() {
    this.queuemonitor = clearInterval(this.queuemonitor);
  }

  addAction(id) {
    this.actionObject[id] = Date.now();

    if (this.numberOfWorkAction() === 1) {
      this.trigger('start');
    }
  }

  removeAction(id) {
    delete this.actionObject[id];

    if (this.numberOfWorkAction() === 0) {
      this.trigger('finish');
    }
  }

  addError(err) {
    this.trigger('error', err);
  }

  queuing() {
    this.disableQueue();

    let item = this.queue.shift();

    if(!!item) {
      var reducer = this.reducers[item.action.type];

      if(!reducer) {
        this.enableQueue();
        throw new Error('The unregistered reducer. Please check the type of action, if there is a written reducer use after registration.');
      }

      // 리스너가 없는 경우 허용
      item.subscriber = item.subscriber || function () {};

      if(typeof item.subscriber !== 'function') {
        this.enableQueue();
        throw new Error('The listener must be a function. If you do not need the listener it may not be specified.');
      }

      new (Function.prototype.bind.apply(reducer, _.concat(reducer, item.action.data, _.bind(item.subscriber, this))))();
    }

    this.enableQueue();
  }

  bindReducer(reducer) {
    this.reducers[reducer.actionName] = reducer;
  }

  combineReducer(reducers) {
    if (!reducers) return;

    reducers.forEach(reducer => {
      this.bindReducer(reducer);
    });
  }

  dispatch(action, subscriber) {
    debug(format('dispatch action %s', action.type));
    this.queue.push({ action, subscriber });
  }
  
  use(module) {
    switch (module.wwtype) {
      case 'reducer':
        this.bindReducer(module);
        break;
      case 'layout':
        Router.bindLayout(module);
        break;
    }
  }

  start(config) {
    let wait = setTimeout(_ => {
      switch (document.readyState) {
        case 'complete': case 'loaded': break;
        default: return;
      }

      clearTimeout(wait);

      debug('start');

      this.enableQueue();

      if (!!config) {
        if (!!config.layout) {
          Router.setLayout(config.layout);
        }
        
        Router.design(config.design, config.options);
      }

      Backbone.history.start();
    }, 1);
  }

  numberOfAction() {
    return this.queue.length;
  }

  numberOfWorkAction() {
    return Object.keys(this.actionObject).length;
  }
}

_.extend(Woowahan.prototype, Backbone.Events);

Woowahan.createError = error => ({ type: 'error', error });
Woowahan.dispatchEvent = event => global.woowahan.dispatchEvent(event);

Woowahan.Types          = require('./types');
Woowahan.Action         = require('./action');
Woowahan.Schema         = require('./schema');
Woowahan.Reducer        = require('./reducer');
Woowahan.View           = require('./view');
Woowahan.Layout         = require('./layout');
Woowahan.CollectionView = require('./collection-view');
Woowahan.ItemView       = require('./item-view');

module.exports = Woowahan;