/**
 * public/__tests__/setup.js
 * Jest test ortamı kurulum dosyası
 */

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    removeItem: function(key) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock MediaStream API
class MediaStream {
  constructor() {
    this.tracks = [];
  }

  addTrack(track) {
    this.tracks.push(track);
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter(track => track.kind === 'video');
  }

  getAudioTracks() {
    return this.tracks.filter(track => track.kind === 'audio');
  }
}

global.MediaStream = MediaStream;

// Mock HTMLVideoElement
class HTMLVideoElement {
  constructor() {
    this.srcObject = null;
    this.muted = false;
  }

  play() {
    return Promise.resolve();
  }
}

// Mock CustomEvent
global.CustomEvent = class CustomEvent {
  constructor(event, params) {
    this.type = event;
    this.detail = params?.detail || {};
    this.bubbles = params?.bubbles || false;
    this.cancelable = params?.cancelable || false;
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
