// config/mediasoup.js
const os = require('os');

module.exports = {
  // Mediasoup Worker ayarları
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: 'warn',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
      'rtx',
      'bwe',
      'score',
      'simulcast',
      'svc'
    ],
    // İşlemci sayısına göre worker sayısı
    numWorkers: Object.keys(os.cpus()).length
  },

  // Router ayarları
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000
        }
      }
    ]
  },

  // WebRTC transport ayarları
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: '127.0.0.1' // Dış IP adresi
      }
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    factorIncomingBitrate: 0.9
  },

  // Producer ayarları
  producer: {
    // Ses için codec ayarları
    audioOptions: {
      codecOptions: {
        opusStereo: true,
        opusDtx: true,
        opusFec: true,
        opusNack: true
      }
    },
    // Video için codec ayarları
    videoOptions: {
      codecOptions: {
        videoGoogleStartBitrate: 1000
      }
    },
    // Ekran paylaşımı için codec ayarları
    screenShareOptions: {
      codecOptions: {
        videoGoogleStartBitrate: 1500,
        videoGoogleMaxBitrate: 3000
      }
    }
  },

  // Ekran paylaşımı ayarları
  screenSharing: {
    // Ekran paylaşımı için önerilen video kısıtlamaları
    videoConstraints: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 }
    }
  },

  // Video iletişimi ayarları
  videoChat: {
    // Video iletişimi için önerilen video kısıtlamaları
    videoConstraints: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user'
    },
    // Video iletişimi için önerilen ses kısıtlamaları
    audioConstraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }
};
