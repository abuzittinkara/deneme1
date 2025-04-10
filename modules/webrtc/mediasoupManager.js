/**
 * modules/webrtc/mediasoupManager.js
 * Mediasoup yönetimi
 */
const mediasoup = require('mediasoup');
const os = require('os');
const { logger } = require('../../utils/logger');
const { redisClient, setHashCache, getHashCache, getAllHashCache, deleteCache } = require('../../config/redis');

// Worker'lar
const workers = [];
let nextWorkerIndex = 0;

// Router'lar
const routers = new Map();

// Transport'lar
const transports = new Map();

// Producer'lar
const producers = new Map();

// Consumer'lar
const consumers = new Map();

// Mediasoup yapılandırması
const mediasoupOptions = {
  // Worker ayarları
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 59999,
    logLevel: 'warn',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp'
    ]
  },
  // Router ayarları
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1,
          usedtx: 1
        }
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
      }
    ]
  },
  // WebRtcTransport ayarları
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1'
      }
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000
  }
};

/**
 * Mediasoup worker'larını oluşturur
 * @returns {Promise<void>}
 */
async function createWorkers() {
  const numWorkers = Object.keys(os.cpus()).length;
  logger.info(`${numWorkers} mediasoup worker oluşturuluyor`);
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: mediasoupOptions.worker.logLevel,
      logTags: mediasoupOptions.worker.logTags,
      rtcMinPort: mediasoupOptions.worker.rtcMinPort + (i * 5000),
      rtcMaxPort: mediasoupOptions.worker.rtcMinPort + ((i + 1) * 5000 - 1)
    });
    
    worker.on('died', () => {
      logger.error(`Mediasoup worker ${i} öldü, yeniden başlatılıyor...`);
      setTimeout(() => {
        createWorker(i)
          .then((newWorker) => {
            workers[i] = newWorker;
            logger.info(`Mediasoup worker ${i} yeniden başlatıldı`);
          })
          .catch((error) => {
            logger.error(`Mediasoup worker ${i} yeniden başlatılamadı`, { error: error.message });
          });
      }, 2000);
    });
    
    workers.push(worker);
    logger.info(`Mediasoup worker ${i} oluşturuldu`);
  }
}

/**
 * Tek bir worker oluşturur
 * @param {number} index - Worker indeksi
 * @returns {Promise<Object>} - Worker nesnesi
 */
async function createWorker(index) {
  const worker = await mediasoup.createWorker({
    logLevel: mediasoupOptions.worker.logLevel,
    logTags: mediasoupOptions.worker.logTags,
    rtcMinPort: mediasoupOptions.worker.rtcMinPort + (index * 5000),
    rtcMaxPort: mediasoupOptions.worker.rtcMinPort + ((index + 1) * 5000 - 1)
  });
  
  worker.on('died', () => {
    logger.error(`Mediasoup worker ${index} öldü, yeniden başlatılıyor...`);
    setTimeout(() => {
      createWorker(index)
        .then((newWorker) => {
          workers[index] = newWorker;
          logger.info(`Mediasoup worker ${index} yeniden başlatıldı`);
        })
        .catch((error) => {
          logger.error(`Mediasoup worker ${index} yeniden başlatılamadı`, { error: error.message });
        });
    }, 2000);
  });
  
  return worker;
}

/**
 * Mediasoup worker'larını kapatır
 * @returns {Promise<void>}
 */
async function closeWorkers() {
  for (const worker of workers) {
    try {
      await worker.close();
    } catch (error) {
      logger.error('Worker kapatma hatası', { error: error.message });
    }
  }
  
  workers.length = 0;
  logger.info('Tüm mediasoup worker\'ları kapatıldı');
}

/**
 * Yük dengelemeli worker seçimi
 * @returns {Object} - Worker nesnesi
 */
function getNextWorker() {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

/**
 * RTP yeteneklerini getirir
 * @returns {Object} - RTP yetenekleri
 */
function getRtpCapabilities() {
  return mediasoupOptions.router.mediaCodecs;
}

/**
 * Oda için router oluşturur
 * @param {string} roomId - Oda ID'si
 * @returns {Promise<Object>} - Router nesnesi
 */
async function createRouter(roomId) {
  try {
    // Mevcut router'ı kontrol et
    if (routers.has(roomId)) {
      return routers.get(roomId);
    }
    
    // Worker seç
    const worker = getNextWorker();
    
    // Router oluştur
    const router = await worker.createRouter({
      mediaCodecs: mediasoupOptions.router.mediaCodecs
    });
    
    // Router'ı kaydet
    routers.set(roomId, router);
    
    // Redis'e router bilgilerini kaydet
    await setHashCache('mediasoup:routers', roomId, {
      workerId: workers.indexOf(worker),
      routerId: router.id
    });
    
    logger.info('Router oluşturuldu', { roomId, routerId: router.id });
    
    return router;
  } catch (error) {
    logger.error('Router oluşturma hatası', { error: error.message, roomId });
    throw error;
  }
}

/**
 * WebRTC transport oluşturur
 * @param {string} socketId - Socket ID'si
 * @param {string} roomId - Oda ID'si
 * @param {string} direction - Transport yönü (send/recv)
 * @returns {Promise<Object>} - Transport nesnesi
 */
async function createWebRtcTransport(socketId, roomId, direction) {
  try {
    // Router'ı al
    let router = routers.get(roomId);
    
    if (!router) {
      router = await createRouter(roomId);
    }
    
    // Transport oluştur
    const transport = await router.createWebRtcTransport({
      ...mediasoupOptions.webRtcTransport,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      enableSctp: true
    });
    
    // Transport olaylarını dinle
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        logger.debug('Transport DTLS durumu kapatıldı', { transportId: transport.id });
        transport.close();
      }
    });
    
    transport.on('close', () => {
      logger.debug('Transport kapatıldı', { transportId: transport.id });
    });
    
    // Transport'u kaydet
    const transportKey = `${socketId}:${direction}`;
    transports.set(transportKey, transport);
    
    // Redis'e transport bilgilerini kaydet
    await setHashCache('mediasoup:transports', transportKey, {
      transportId: transport.id,
      socketId,
      roomId,
      direction
    });
    
    logger.debug('Transport oluşturuldu', { transportId: transport.id, socketId, roomId, direction });
    
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters
    };
  } catch (error) {
    logger.error('Transport oluşturma hatası', { error: error.message, socketId, roomId, direction });
    throw error;
  }
}

/**
 * WebRTC transport'u bağlar
 * @param {string} socketId - Socket ID'si
 * @param {string} transportId - Transport ID'si
 * @param {Object} dtlsParameters - DTLS parametreleri
 * @returns {Promise<void>}
 */
async function connectWebRtcTransport(socketId, transportId, dtlsParameters) {
  try {
    // Transport'u bul
    const transport = Array.from(transports.values()).find(t => t.id === transportId);
    
    if (!transport) {
      throw new Error(`Transport bulunamadı: ${transportId}`);
    }
    
    // Transport'u bağla
    await transport.connect({ dtlsParameters });
    
    logger.debug('Transport bağlandı', { transportId, socketId });
  } catch (error) {
    logger.error('Transport bağlama hatası', { error: error.message, socketId, transportId });
    throw error;
  }
}

/**
 * Producer oluşturur
 * @param {string} socketId - Socket ID'si
 * @param {string} transportId - Transport ID'si
 * @param {string} kind - Medya türü (audio/video)
 * @param {Object} rtpParameters - RTP parametreleri
 * @param {Object} appData - Uygulama verileri
 * @returns {Promise<Object>} - Producer nesnesi
 */
async function produce(socketId, transportId, kind, rtpParameters, appData = {}) {
  try {
    // Transport'u bul
    const transport = Array.from(transports.values()).find(t => t.id === transportId);
    
    if (!transport) {
      throw new Error(`Transport bulunamadı: ${transportId}`);
    }
    
    // Producer oluştur
    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData
    });
    
    // Producer olaylarını dinle
    producer.on('transportclose', () => {
      logger.debug('Producer transport kapatıldı', { producerId: producer.id });
      producer.close();
      producers.delete(producer.id);
    });
    
    producer.on('score', (score) => {
      logger.debug('Producer skor değişti', { 
        producerId: producer.id, 
        score: score.reduce((acc, s) => ({ ...acc, [s.ssrc]: s.score }), {}) 
      });
    });
    
    // Producer'ı kaydet
    producers.set(producer.id, producer);
    
    // Redis'e producer bilgilerini kaydet
    await setHashCache('mediasoup:producers', producer.id, {
      producerId: producer.id,
      socketId,
      transportId,
      kind,
      appData
    });
    
    logger.info('Producer oluşturuldu', { 
      producerId: producer.id, 
      socketId, 
      kind, 
      source: appData?.source || 'unknown' 
    });
    
    return producer;
  } catch (error) {
    logger.error('Producer oluşturma hatası', { error: error.message, socketId, transportId, kind });
    throw error;
  }
}

/**
 * Consumer oluşturur
 * @param {string} socketId - Socket ID'si
 * @param {string} transportId - Transport ID'si
 * @param {string} producerId - Producer ID'si
 * @param {Object} rtpCapabilities - RTP yetenekleri
 * @returns {Promise<Object>} - Consumer nesnesi
 */
async function consume(socketId, transportId, producerId, rtpCapabilities) {
  try {
    // Transport'u bul
    const transport = Array.from(transports.values()).find(t => t.id === transportId);
    
    if (!transport) {
      throw new Error(`Transport bulunamadı: ${transportId}`);
    }
    
    // Producer'ı bul
    const producer = producers.get(producerId);
    
    if (!producer) {
      throw new Error(`Producer bulunamadı: ${producerId}`);
    }
    
    // Router'ı bul
    const router = transport.router;
    
    // RTP yeteneklerini kontrol et
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('RTP yetenekleri uyumsuz');
    }
    
    // Consumer oluştur
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true // Başlangıçta duraklatılmış olarak oluştur
    });
    
    // Consumer olaylarını dinle
    consumer.on('transportclose', () => {
      logger.debug('Consumer transport kapatıldı', { consumerId: consumer.id });
      consumer.close();
      consumers.delete(consumer.id);
    });
    
    consumer.on('producerclose', () => {
      logger.debug('Consumer producer kapatıldı', { consumerId: consumer.id });
      consumer.close();
      consumers.delete(consumer.id);
    });
    
    consumer.on('score', (score) => {
      logger.debug('Consumer skor değişti', { 
        consumerId: consumer.id, 
        score 
      });
    });
    
    // Consumer'ı kaydet
    consumers.set(consumer.id, consumer);
    
    // Redis'e consumer bilgilerini kaydet
    await setHashCache('mediasoup:consumers', consumer.id, {
      consumerId: consumer.id,
      socketId,
      transportId,
      producerId
    });
    
    logger.debug('Consumer oluşturuldu', { 
      consumerId: consumer.id, 
      socketId, 
      producerId 
    });
    
    return consumer;
  } catch (error) {
    logger.error('Consumer oluşturma hatası', { error: error.message, socketId, transportId, producerId });
    throw error;
  }
}

/**
 * Consumer'ı devam ettirir
 * @param {string} socketId - Socket ID'si
 * @param {string} consumerId - Consumer ID'si
 * @returns {Promise<void>}
 */
async function resumeConsumer(socketId, consumerId) {
  try {
    // Consumer'ı bul
    const consumer = consumers.get(consumerId);
    
    if (!consumer) {
      throw new Error(`Consumer bulunamadı: ${consumerId}`);
    }
    
    // Consumer'ı devam ettir
    await consumer.resume();
    
    logger.debug('Consumer devam ettirildi', { consumerId, socketId });
  } catch (error) {
    logger.error('Consumer devam ettirme hatası', { error: error.message, socketId, consumerId });
    throw error;
  }
}

/**
 * Producer'ı kapatır
 * @param {string} socketId - Socket ID'si
 * @param {string} producerId - Producer ID'si
 * @returns {Promise<void>}
 */
async function closeProducer(socketId, producerId) {
  try {
    // Producer'ı bul
    const producer = producers.get(producerId);
    
    if (!producer) {
      throw new Error(`Producer bulunamadı: ${producerId}`);
    }
    
    // Producer'ı kapat
    producer.close();
    
    // Producer'ı sil
    producers.delete(producerId);
    
    // Redis'ten producer bilgilerini sil
    await deleteCache(`mediasoup:producers:${producerId}`);
    
    logger.info('Producer kapatıldı', { producerId, socketId });
  } catch (error) {
    logger.error('Producer kapatma hatası', { error: error.message, socketId, producerId });
    throw error;
  }
}

/**
 * Transport'ı kapatır
 * @param {string} socketId - Socket ID'si
 * @param {string} direction - Transport yönü (send/recv)
 * @returns {Promise<void>}
 */
async function closeTransport(socketId, direction) {
  try {
    // Transport'u bul
    const transportKey = `${socketId}:${direction}`;
    const transport = transports.get(transportKey);
    
    if (!transport) {
      return;
    }
    
    // Transport'u kapat
    transport.close();
    
    // Transport'u sil
    transports.delete(transportKey);
    
    // Redis'ten transport bilgilerini sil
    await deleteCache(`mediasoup:transports:${transportKey}`);
    
    logger.debug('Transport kapatıldı', { socketId, direction });
  } catch (error) {
    logger.error('Transport kapatma hatası', { error: error.message, socketId, direction });
  }
}

/**
 * Kullanıcının tüm medya kaynaklarını kapatır
 * @param {string} socketId - Socket ID'si
 * @returns {Promise<void>}
 */
async function closeUserMediaResources(socketId) {
  try {
    // Kullanıcının producer'larını kapat
    for (const [producerId, producer] of producers.entries()) {
      const producerData = await getHashCache('mediasoup:producers', producerId);
      
      if (producerData && producerData.socketId === socketId) {
        producer.close();
        producers.delete(producerId);
        await deleteCache(`mediasoup:producers:${producerId}`);
      }
    }
    
    // Kullanıcının consumer'larını kapat
    for (const [consumerId, consumer] of consumers.entries()) {
      const consumerData = await getHashCache('mediasoup:consumers', consumerId);
      
      if (consumerData && consumerData.socketId === socketId) {
        consumer.close();
        consumers.delete(consumerId);
        await deleteCache(`mediasoup:consumers:${consumerId}`);
      }
    }
    
    // Kullanıcının transport'larını kapat
    await closeTransport(socketId, 'send');
    await closeTransport(socketId, 'recv');
    
    logger.info('Kullanıcının tüm medya kaynakları kapatıldı', { socketId });
  } catch (error) {
    logger.error('Kullanıcı medya kaynakları kapatma hatası', { error: error.message, socketId });
  }
}

/**
 * Bant genişliğini günceller
 * @param {string} transportId - Transport ID'si
 * @param {number} bitrate - Bant genişliği (bps)
 * @returns {Promise<void>}
 */
async function updateMaxIncomingBitrate(transportId, bitrate) {
  try {
    // Transport'u bul
    const transport = Array.from(transports.values()).find(t => t.id === transportId);
    
    if (!transport) {
      throw new Error(`Transport bulunamadı: ${transportId}`);
    }
    
    // Bant genişliğini güncelle
    await transport.setMaxIncomingBitrate(bitrate);
    
    logger.debug('Bant genişliği güncellendi', { transportId, bitrate });
  } catch (error) {
    logger.error('Bant genişliği güncelleme hatası', { error: error.message, transportId, bitrate });
  }
}

/**
 * Ağ kalitesine göre video kalitesini ayarlar
 * @param {string} producerId - Producer ID'si
 * @param {string} networkQuality - Ağ kalitesi (high/medium/low/very-low)
 * @returns {Object} - Video parametreleri
 */
function adjustVideoQuality(producerId, networkQuality) {
  try {
    // Producer'ı bul
    const producer = producers.get(producerId);
    
    if (!producer || producer.kind !== 'video') {
      throw new Error(`Video producer bulunamadı: ${producerId}`);
    }
    
    // Ağ kalitesine göre video parametrelerini ayarla
    let encodingParams;
    
    switch (networkQuality) {
      case 'high':
        encodingParams = {
          maxBitrate: 1500000,
          maxFramerate: 30
        };
        break;
      case 'medium':
        encodingParams = {
          maxBitrate: 800000,
          maxFramerate: 25
        };
        break;
      case 'low':
        encodingParams = {
          maxBitrate: 400000,
          maxFramerate: 20
        };
        break;
      case 'very-low':
        encodingParams = {
          maxBitrate: 200000,
          maxFramerate: 15
        };
        break;
      default:
        encodingParams = {
          maxBitrate: 800000,
          maxFramerate: 25
        };
    }
    
    // Producer parametrelerini güncelle
    producer.appData.encodingParams = encodingParams;
    
    logger.debug('Video kalitesi ayarlandı', { producerId, networkQuality, encodingParams });
    
    return encodingParams;
  } catch (error) {
    logger.error('Video kalitesi ayarlama hatası', { error: error.message, producerId, networkQuality });
    return null;
  }
}

module.exports = {
  createWorkers,
  closeWorkers,
  getRtpCapabilities,
  createRouter,
  createWebRtcTransport,
  connectWebRtcTransport,
  produce,
  consume,
  resumeConsumer,
  closeProducer,
  closeTransport,
  closeUserMediaResources,
  updateMaxIncomingBitrate,
  adjustVideoQuality
};
