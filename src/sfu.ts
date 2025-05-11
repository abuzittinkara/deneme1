/**
 * src/sfu.ts
 * Selective Forwarding Unit (SFU) - Mediasoup entegrasyonu
 */
import * as mediasoup from 'mediasoup';
import { types as mediasoupTypes } from 'mediasoup';
import { logger } from './utils/logger';
import { env } from './config/env';

/**
 * Bu dizi, CPU çekirdeği sayınız kadar Worker tutacak.
 */
let workers: mediasoupTypes.Worker[] = [];

/**
 * Round-robin ile Worker seçmek için bir index.
 */
let nextWorkerIndex = 0;

/**
 * Router'ları ID bazında saklayacak nesne
 */
const routers: Record<string, mediasoupTypes.Router> = {};

/**
 * createWorkers() => uygulama başlarken çağrılacak.
 */
async function createWorkers(): Promise<void> {
  // Sunucunuzda kaç çekirdek varsa (ör. 2 ise 2 worker vb.)
  const cpuCores = 2;
  for (let i = 0; i < cpuCores; i++) {
    const worker = await mediasoup.createWorker({
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    });

    worker.on('died', () => {
      logger.error('Mediasoup Worker died', { pid: worker.pid });
      // Burada worker'ı yeniden başlatma mantığı eklenebilir
    });

    workers.push(worker);
  }
  logger.info(`SFU: ${workers.length} adet Mediasoup Worker oluşturuldu.`);
}

/**
 * Tüm worker'ları kapatır
 */
async function closeWorkers(): Promise<void> {
  for (const worker of workers) {
    await worker.close();
  }
  workers = [];
  logger.info('SFU: Tüm Mediasoup Worker\'lar kapatıldı.');
}

/**
 * Round-robin algoritması ile bir sonraki worker'ı döndürür
 */
function getNextWorker(): mediasoupTypes.Worker {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available');
  }
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

/**
 * Belirtilen oda ID'si için bir router oluşturur
 */
async function createRouter(roomId: string): Promise<mediasoupTypes.Router> {
  const worker = getNextWorker();
  // Video üretimini desteklemek için video codec ekleniyor.
  const mediaCodecs: mediasoupTypes.RtpCodecCapability[] = [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {},
    },
  ];
  const router = await worker.createRouter({ mediaCodecs });
  routers[roomId] = router;
  return router;
}

/**
 * Belirtilen oda ID'si için router'ı döndürür
 */
function getRouter(roomId: string): mediasoupTypes.Router | null {
  return routers[roomId] || null;
}

/**
 * WebRTC transport oluşturur
 *
 * Burada TURN sunucunuzu ekliyoruz => "iceServers"
 * Değerler .env içindeki ANNOUNCED_IP, TURN_USERNAME, TURN_CREDENTIAL değişkenlerinden okunuyor.
 */
async function createWebRtcTransport(
  router: mediasoupTypes.Router
): Promise<mediasoupTypes.WebRtcTransport> {
  // WebRTC transport için temel seçenekler
  const transportOptions: mediasoupTypes.WebRtcTransportOptions = {
    listenIps: [
      {
        ip: '0.0.0.0',
        // .env'de ANNOUNCED_IP tanımlıysa onu kullan, yoksa varsayılan IP
        announcedIp: env.ANNOUNCED_IP || '31.57.154.104',
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  };

  // STUN/TURN sunucuları için özel yapılandırma
  // Not: Bu özellik mediasoup'un WebRtcTransportOptions tipinde doğrudan desteklenmiyor
  // Bu nedenle, transport oluşturduktan sonra istemci tarafında kullanılmak üzere
  // bu bilgileri ayrıca döndürebilirsiniz.
  const iceServers = [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: env.TURN_USERNAME || '6975c20c80cb0d79f1e4a4b6',
      credential: env.TURN_CREDENTIAL || 'BCHrcOSfdcmZ/Dda',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: env.TURN_USERNAME || '6975c20c80cb0d79f1e4a4b6',
      credential: env.TURN_CREDENTIAL || 'BCHrcOSfdcmZ/Dda',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: env.TURN_USERNAME || '6975c20c80cb0d79f1e4a4b6',
      credential: env.TURN_CREDENTIAL || 'BCHrcOSfdcmZ/Dda',
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: env.TURN_USERNAME || '6975c20c80cb0d79f1e4a4b6',
      credential: env.TURN_CREDENTIAL || 'BCHrcOSfdcmZ/Dda',
    },
  ];

  const transport = await router.createWebRtcTransport(transportOptions);
  return transport;
}

/**
 * Transport'u bağlar
 */
async function connectTransport(
  transport: mediasoupTypes.WebRtcTransport,
  dtlsParameters: mediasoupTypes.DtlsParameters
): Promise<void> {
  await transport.connect({ dtlsParameters });
}

/**
 * Transport üzerinde Producer yaratır
 */
async function produce(
  transport: mediasoupTypes.WebRtcTransport,
  kind: mediasoupTypes.MediaKind,
  rtpParameters: mediasoupTypes.RtpParameters
): Promise<mediasoupTypes.Producer> {
  const producer = await transport.produce({ kind, rtpParameters });
  return producer;
}

/**
 * Consumer oluşturur
 */
async function consume(
  router: mediasoupTypes.Router,
  transport: mediasoupTypes.WebRtcTransport,
  producer: mediasoupTypes.Producer
): Promise<mediasoupTypes.Consumer> {
  if (!producer) {
    throw new Error('Producer bulunamadı');
  }

  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: true,
  });
  await consumer.resume();
  return consumer;
}

/**
 * Transport'u kapatır
 */
async function closeTransport(transport: mediasoupTypes.WebRtcTransport): Promise<void> {
  if (transport && !transport.closed) {
    await transport.close();
    logger.info('SFU: transport closed', { id: transport.id });
  }
}

/**
 * Producer'ı kapatır
 */
async function closeProducer(producer: mediasoupTypes.Producer): Promise<void> {
  if (producer && !producer.closed) {
    await producer.close();
    logger.info('SFU: producer closed', { id: producer.id });
  }
}

/**
 * Consumer'ı kapatır
 */
async function closeConsumer(consumer: mediasoupTypes.Consumer): Promise<void> {
  if (consumer && !consumer.closed) {
    await consumer.close();
    logger.info('SFU: consumer closed', { id: consumer.id });
  }
}

export {
  createWorkers,
  closeWorkers,
  createRouter,
  getRouter,
  createWebRtcTransport,
  connectTransport,
  produce,
  consume,
  closeTransport,
  closeProducer,
  closeConsumer,
};
