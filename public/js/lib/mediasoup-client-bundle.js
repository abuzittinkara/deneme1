// mediasoup-client-bundle.js
// Bu dosya, mediasoup-client'ın tarayıcıda kullanılabilecek bir sürümüdür.

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.mediasoupClient = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

// Basit bir mediasoup-client mock'u
// Gerçek mediasoup-client yerine kullanılabilir

class Device {
  constructor() {
    this.handlerName = 'MockHandler';
    this.loaded = false;
    this.rtpCapabilities = null;
  }

  load(routerRtpCapabilities) {
    this.loaded = true;
    this.rtpCapabilities = routerRtpCapabilities;
    return Promise.resolve();
  }

  isLoaded() {
    return this.loaded;
  }

  canProduce(kind) {
    return kind === 'audio' || kind === 'video';
  }

  createSendTransport(options) {
    return new Transport('send', options);
  }

  createRecvTransport(options) {
    return new Transport('recv', options);
  }
}

class Transport {
  constructor(direction, options) {
    this.id = options.id;
    this.direction = direction;
    this.closed = false;
    this.options = options;
    this.handlers = {
      connect: [],
      produce: [],
      producedata: [],
      connectionstatechange: []
    };
  }

  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);
    return this;
  }

  close() {
    this.closed = true;
    return Promise.resolve();
  }

  produce(options) {
    const producer = new Producer(options);
    return Promise.resolve(producer);
  }

  consume(options) {
    const consumer = new Consumer(options);
    return Promise.resolve(consumer);
  }

  produceData(options) {
    const dataProducer = new DataProducer(options);
    return Promise.resolve(dataProducer);
  }

  consumeData(options) {
    const dataConsumer = new DataConsumer(options);
    return Promise.resolve(dataConsumer);
  }
}

class Producer {
  constructor(options) {
    this.id = options.id || Math.random().toString(36).substring(2, 15);
    this.kind = options.track ? options.track.kind : 'unknown';
    this.track = options.track;
    this.paused = false;
    this.closed = false;
    this.handlers = {
      transportclose: [],
      trackended: []
    };
  }

  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);
    return this;
  }

  pause() {
    this.paused = true;
    return Promise.resolve();
  }

  resume() {
    this.paused = false;
    return Promise.resolve();
  }

  close() {
    this.closed = true;
  }

  replaceTrack(track) {
    this.track = track;
    return Promise.resolve();
  }

  getStats() {
    return Promise.resolve([]);
  }
}

class Consumer {
  constructor(options) {
    this.id = options.id;
    this.producerId = options.producerId;
    this.kind = options.kind;
    this.rtpParameters = options.rtpParameters;
    this.paused = false;
    this.closed = false;
    this.track = new MediaStreamTrack();
    this.handlers = {
      transportclose: [],
      trackended: []
    };
  }

  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);
    return this;
  }

  pause() {
    this.paused = true;
    return Promise.resolve();
  }

  resume() {
    this.paused = false;
    return Promise.resolve();
  }

  close() {
    this.closed = true;
  }

  getStats() {
    return Promise.resolve([]);
  }
}

class DataProducer {
  constructor(options) {
    this.id = options.id || Math.random().toString(36).substring(2, 15);
    this.closed = false;
    this.handlers = {
      transportclose: []
    };
  }

  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);
    return this;
  }

  close() {
    this.closed = true;
  }

  send(data) {
    // Mock implementation
  }

  getStats() {
    return Promise.resolve([]);
  }
}

class DataConsumer {
  constructor(options) {
    this.id = options.id;
    this.dataProducerId = options.dataProducerId;
    this.closed = false;
    this.handlers = {
      transportclose: [],
      message: []
    };
  }

  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);
    return this;
  }

  close() {
    this.closed = true;
  }

  getStats() {
    return Promise.resolve([]);
  }
}

// MediaStreamTrack mock
class MediaStreamTrack {
  constructor() {
    this.kind = 'audio';
    this.enabled = true;
    this.muted = false;
    this.readyState = 'live';
    this.id = Math.random().toString(36).substring(2, 15);
  }

  stop() {
    this.readyState = 'ended';
  }

  clone() {
    return new MediaStreamTrack();
  }
}

// Export the module
module.exports = {
  Device,
  Transport,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer
};

},{}]},{},[1])(1)
});
