/**
 * public/__tests__/unit/videoCall.test.ts
 * Video görüşme modülü için birim testleri
 */

import { startVideoCall, stopVideoCall, switchCamera, changeVideoQuality } from '../../src/ts/videoCall';

// Mock socket.io
jest.mock('../../src/ts/index', () => ({
  socket: {
    id: 'test-socket-id',
    emit: jest.fn()
  }
}));

// Mock MediaStream ve MediaDevices
class MockMediaStream {
  tracks: MockMediaTrack[] = [];

  constructor(tracks: MockMediaTrack[] = []) {
    this.tracks = tracks;
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

  addTrack(track: MockMediaTrack) {
    this.tracks.push(track);
  }
}

class MockMediaTrack {
  kind: string;
  enabled: boolean = true;
  readyState: string = 'live';

  constructor(kind: string) {
    this.kind = kind;
  }

  stop() {
    this.readyState = 'ended';
  }

  applyConstraints = jest.fn().mockResolvedValue(undefined);
}

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(),
    enumerateDevices: jest.fn()
  },
  writable: true
});

// Mock document.getElementById
document.getElementById = jest.fn();

describe('Video Call Module', () => {
  let mockVideoElement: any;
  let mockVideoTrack: any;
  let mockAudioTrack: any;
  let mockStream: any;
  let mockHeaderControls: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock elements
    mockVideoElement = {
      srcObject: null,
      muted: false,
      play: jest.fn().mockResolvedValue(undefined),
      parentElement: {
        remove: jest.fn()
      }
    };

    mockHeaderControls = {
      appendChild: jest.fn()
    };

    // Setup mock tracks and stream
    mockVideoTrack = new MockMediaTrack('video');
    mockAudioTrack = new MockMediaTrack('audio');
    mockStream = new MockMediaStream([mockVideoTrack, mockAudioTrack]);

    // Setup mock getUserMedia
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
    (navigator.mediaDevices.enumerateDevices as jest.Mock).mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera1' },
      { kind: 'videoinput', deviceId: 'camera2' }
    ]);

    // Setup mock getElementById
    (document.getElementById as jest.Mock).mockImplementation((id) => {
      if (id === 'local-video') return mockVideoElement;
      if (id === 'switch-camera-btn') return { classList: { add: jest.fn(), remove: jest.fn() } };
      if (id === 'video-quality-btn') return { classList: { add: jest.fn(), remove: jest.fn() } };
      return null;
    });

    // Setup mock querySelector
    document.querySelector = jest.fn().mockImplementation((selector) => {
      if (selector === '.channel.active') return { getAttribute: () => 'test-channel-id' };
      if (selector === '.chat-header-controls') return mockHeaderControls;
      return null;
    });

    // Setup mock querySelectorAll
    document.querySelectorAll = jest.fn().mockReturnValue([
      { getAttribute: () => 'low', classList: { add: jest.fn(), remove: jest.fn() } },
      { getAttribute: () => 'medium', classList: { add: jest.fn(), remove: jest.fn() } },
      { getAttribute: () => 'high', classList: { add: jest.fn(), remove: jest.fn() } }
    ]);
  });

  test('startVideoCall should initialize video call', async () => {
    await startVideoCall();

    // Check if getUserMedia was called with correct constraints
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: expect.any(Object)
    });

    // Check if local video element was set up correctly
    expect(mockVideoElement.srcObject).toBe(mockStream);
    expect(mockVideoElement.muted).toBe(true);
    expect(mockVideoElement.play).toHaveBeenCalled();

    // Check if socket.emit was called
    const { socket } = require('../../src/ts/index');
    expect(socket.emit).toHaveBeenCalledWith('video-call-started', {
      userId: 'test-socket-id',
      roomId: 'test-channel-id'
    });
  });

  test('stopVideoCall should clean up video call resources', async () => {
    // First start a call
    await startVideoCall();

    // Then stop it
    await stopVideoCall();

    // Check if tracks were stopped
    expect(mockVideoTrack.readyState).toBe('ended');
    expect(mockAudioTrack.readyState).toBe('ended');

    // Check if video element was cleaned up
    expect(mockVideoElement.srcObject).toBe(null);

    // Check if socket.emit was called
    const { socket } = require('../../src/ts/index');
    expect(socket.emit).toHaveBeenCalledWith('video-call-stopped', {
      userId: 'test-socket-id',
      roomId: 'test-channel-id'
    });
  });

  test('switchCamera should switch between cameras', async () => {
    // First start a call
    await startVideoCall();

    // Mock a new stream for the camera switch
    const newVideoTrack = new MockMediaTrack('video');
    const newStream = new MockMediaStream([newVideoTrack]);
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(newStream);

    // Switch camera
    await switchCamera();

    // Check if getUserMedia was called with facingMode
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: expect.objectContaining({
        facingMode: expect.any(Object)
      })
    });

    // Check if video element was updated
    expect(mockVideoElement.srcObject).not.toBe(mockStream);
  });

  test('changeVideoQuality should update video quality', async () => {
    // First start a call
    await startVideoCall();

    // Change quality
    changeVideoQuality('high');

    // Check if track.applyConstraints was called
    expect(mockVideoTrack.applyConstraints).toHaveBeenCalled();
  });
});
