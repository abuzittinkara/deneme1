/**
 * src/services/webrtcService.ts
 * WebRTC servisi
 */
import { logger } from '../utils/logger';
import * as mediasoup from 'mediasoup';
import {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpCapabilities,
  Transport,
} from 'mediasoup/node/lib/types.js';
import { TypedServer } from '../types/socket';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

/**
 * WebRTC servisi
 */
export class WebRTCService {
  private io: TypedServer;
  private workers: Worker[] = [];
  private nextWorkerIndex = 0;
  private routers: Map<string, Router> = new Map();
  private transports: Map<string, Transport> = new Map();
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private rooms: Map<
    string,
    {
      routerId: string;
      peers: Map<
        string,
        {
          userId: string;
          transports: string[];
          producers: string[];
          consumers: string[];
        }
      >;
    }
  > = new Map();

  // Transport -> Room eşleştirmesi
  private transportToRoom: Map<string, string> = new Map();

  // Producer -> User eşleştirmesi
  private producerToUser: Map<string, string> = new Map();

  /**
   * Yapıcı
   * @param io Socket.IO sunucusu
   */
  constructor(io: TypedServer) {
    this.io = io;
    logger.info('WebRTC servisi başlatıldı');
  }

  /**
   * Mediasoup işçilerini oluşturur
   */
  async createWorkers(): Promise<void> {
    try {
      const numWorkers = Math.min(Object.keys(os.cpus()).length, 4);
      logger.info(`${numWorkers} mediasoup işçisi oluşturuluyor...`);

      for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
          logLevel: 'warn',
          logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
          rtcMinPort: 10000 + i * 1000,
          rtcMaxPort: 10999 + i * 1000,
        });

        worker.on('died', () => {
          logger.error(`Mediasoup işçisi öldü, pid: ${worker.pid}`);
          // İşçiyi yeniden oluştur
          this.workers = this.workers.filter((w) => w.pid !== worker.pid);
          this.createWorker();
        });

        this.workers.push(worker);
        logger.info(`Mediasoup işçisi oluşturuldu, pid: ${worker.pid}`);
      }
    } catch (error) {
      logger.error('Mediasoup işçileri oluşturulurken hata oluştu', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Yeni bir mediasoup işçisi oluşturur
   */
  private async createWorker(): Promise<void> {
    try {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: 10000,
        rtcMaxPort: 10999,
      });

      worker.on('died', () => {
        logger.error(`Mediasoup işçisi öldü, pid: ${worker.pid}`);
        // İşçiyi yeniden oluştur
        this.workers = this.workers.filter((w) => w.pid !== worker.pid);
        this.createWorker();
      });

      this.workers.push(worker);
      logger.info(`Mediasoup işçisi oluşturuldu, pid: ${worker.pid}`);
    } catch (error) {
      logger.error('Mediasoup işçisi oluşturulurken hata oluştu', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Bir sonraki işçiyi getirir
   * @returns Mediasoup işçisi
   */
  private getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Yeni bir router oluşturur
   * @returns Router ID
   */
  async createRouter(): Promise<string> {
    try {
      if (this.workers.length === 0) {
        throw new Error('Mediasoup işçileri oluşturulmadı');
      }

      const worker = this.getNextWorker();
      const router = await worker.createRouter({
        mediaCodecs: [
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
            parameters: {
              'x-google-start-bitrate': 1000,
            },
          },
          {
            kind: 'video',
            mimeType: 'video/VP9',
            clockRate: 90000,
            parameters: {
              'profile-id': 2,
              'x-google-start-bitrate': 1000,
            },
          },
          {
            kind: 'video',
            mimeType: 'video/h264',
            clockRate: 90000,
            parameters: {
              'packetization-mode': 1,
              'profile-level-id': '4d0032',
              'level-asymmetry-allowed': 1,
              'x-google-start-bitrate': 1000,
            },
          },
          {
            kind: 'video',
            mimeType: 'video/h264',
            clockRate: 90000,
            parameters: {
              'packetization-mode': 1,
              'profile-level-id': '42e01f',
              'level-asymmetry-allowed': 1,
              'x-google-start-bitrate': 1000,
            },
          },
        ],
      });

      const routerId = uuidv4();
      this.routers.set(routerId, router);

      logger.info('Yeni router oluşturuldu', { routerId });

      return routerId;
    } catch (error) {
      logger.error('Router oluşturulurken hata oluştu', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Router'ı getirir
   * @param routerId Router ID
   * @returns Router
   */
  getRouter(routerId: string): Router | undefined {
    return this.routers.get(routerId);
  }

  /**
   * Router'ın RTP yeteneklerini getirir
   * @param routerId Router ID
   * @returns RTP yetenekleri
   */
  getRtpCapabilities(routerId: string): RtpCapabilities | undefined {
    const router = this.routers.get(routerId);
    if (!router) {
      return undefined;
    }
    return router.rtpCapabilities;
  }

  /**
   * Router'ı alır veya oluşturur
   * @param roomId Oda ID
   * @returns Router
   */
  async getOrCreateRouter(roomId: string): Promise<Router | null> {
    try {
      // Router zaten var mı kontrol et
      if (this.routers.has(roomId)) {
        return this.routers.get(roomId)!;
      }

      // Yeni router oluştur
      const worker = this.getNextWorker();
      if (!worker) {
        logger.error('Kullanılabilir worker bulunamadı');
        return null;
      }

      // Video üretimini desteklemek için video codec ekleniyor
      const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
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

      // Router oluştur
      const router = await worker.createRouter({ mediaCodecs });
      this.routers.set(roomId, router);

      logger.info('Yeni router oluşturuldu', { roomId });
      return router;
    } catch (error) {
      logger.error('Router oluşturulurken hata oluştu', {
        error: (error as Error).message,
        roomId,
      });
      return null;
    }
  }

  /**
   * Yeni bir WebRTC transport oluşturur
   * @param options Transport seçenekleri
   * @returns Transport bilgileri
   */
  async createWebRtcTransport(options: {
    roomId: string;
    producing?: boolean;
    consuming?: boolean;
    sctpCapabilities?: any;
    forceTcp?: boolean;
    enableBWE?: boolean;
  }): Promise<
    | {
        id: string;
        iceParameters: any;
        iceCandidates: any;
        dtlsParameters: any;
        sctpParameters?: any;
      }
    | undefined
  > {
    try {
      const { roomId, ...transportOptions } = options;

      // Router'ı al veya oluştur
      const router = await this.getOrCreateRouter(roomId);
      if (!router) {
        logger.warn('Router bulunamadı veya oluşturulamadı', { roomId });
        return undefined;
      }

      // Ağ koşullarına göre optimizasyon
      const initialAvailableOutgoingBitrate = options.producing ? 1000000 : 600000; // 1Mbps veya 600Kbps
      const maxIncomingBitrate = options.consuming ? 4000000 : 0; // 4Mbps veya 0

      // Transport oluştur
      const transport = await router.createWebRtcTransport({
        listenIps: [
          {
            ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
            announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
          },
        ],
        initialAvailableOutgoingBitrate,
        maxIncomingBitrate,
        maxSctpMessageSize: 262144,
        enableUdp: !options.forceTcp,
        enableTcp: true,
        preferUdp: !options.forceTcp,
        enableSctp: !!options.sctpCapabilities,
        numSctpStreams: options.sctpCapabilities
          ? {
            OS: options.sctpCapabilities.numStreams.OS,
            MIS: options.sctpCapabilities.numStreams.MIS,
          }
          : undefined,
        // Bant genişliği tahmini (BWE) etkinleştir
        enableBWE: options.enableBWE,
      });

      // DTLS durum değişikliği olayını dinle
      transport.on('dtlsstatechange', (dtlsState) => {
        logger.debug('Transport DTLS durum değişikliği', {
          transportId: transport.id,
          dtlsState,
        });

        if (dtlsState === 'closed') {
          transport.close();
        }
      });

      // ICE bağlantı durumu olayını dinle
      transport.on('icestatechange', (iceState) => {
        logger.debug('Transport ICE durum değişikliği', {
          transportId: transport.id,
          iceState,
        });
      });

      // Kapatma olayını dinle
      transport.on('close', () => {
        logger.info('Transport kapatıldı', { transportId: transport.id });
        this.transports.delete(transport.id);
        this.transportToRoom.delete(transport.id);
      });

      // Bant genişliği tahmini olayını dinle
      if (options.enableBWE) {
        transport.on('bwe', (data) => {
          logger.debug('Transport bant genişliği tahmini', {
            transportId: transport.id,
            availableOutgoingBitrate: data.availableOutgoingBitrate,
            availableIncomingBitrate: data.availableIncomingBitrate,
            desiredBitrate: data.desiredBitrate,
            effectiveDesiredBitrate: data.effectiveDesiredBitrate,
          });
        });
      }

      // Transport'u kaydet
      const transportId = transport.id;
      this.transports.set(transportId, transport);

      // Maksimum gelen bit hızını ayarla
      if (maxIncomingBitrate > 0) {
        try {
          await transport.setMaxIncomingBitrate(maxIncomingBitrate);
        } catch (error) {
          logger.warn('Maksimum gelen bit hızı ayarlanamadı', {
            error: (error as Error).message,
            transportId,
          });
        }
      }

      logger.info('Yeni WebRTC transport oluşturuldu', {
        transportId,
        routerId,
        initialAvailableOutgoingBitrate,
        maxIncomingBitrate,
        enableBWE: options.enableBWE,
      });

      return {
        id: transportId,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      };
    } catch (error) {
      logger.error('WebRTC transport oluşturulurken hata oluştu', {
        error: (error as Error).message,
        routerId,
      });
      return undefined;
    }
  }

  /**
   * Transport'u bağlar
   * @param transportId Transport ID
   * @param dtlsParameters DTLS parametreleri
   * @returns İşlem başarılı mı
   */
  async connectTransport(transportId: string, dtlsParameters: any): Promise<boolean> {
    try {
      const transport = this.transports.get(transportId) as WebRtcTransport;
      if (!transport) {
        logger.warn('Transport bulunamadı', { transportId });
        return false;
      }

      await transport.connect({ dtlsParameters });

      logger.info('Transport bağlandı', { transportId });

      return true;
    } catch (error) {
      logger.error('Transport bağlanırken hata oluştu', {
        error: (error as Error).message,
        transportId,
      });
      return false;
    }
  }

  /**
   * Üretici oluşturur
   * @param options Üretici seçenekleri
   * @returns Üretici
   */
  async produce(options: {
    transportId: string;
    producerId?: string;
    kind: mediasoup.types.MediaKind;
    rtpParameters: mediasoup.types.RtpParameters;
    appData?: Record<string, any>;
  }): Promise<Producer | null> {
    try {
      const { transportId, producerId, kind, rtpParameters, appData } = options;

      // Transport'u bul
      const transport = this.transports.get(transportId);
      if (!transport) {
        logger.warn('Transport bulunamadı', { transportId });
        return null;
      }

      // Üretici oluştur
      const producer = await transport.produce({
        id: producerId,
        kind,
        rtpParameters,
        appData,
      });

      // Üreticiyi kaydet
      this.producers.set(producer.id, producer);

      // Üretici olaylarını dinle
      producer.on('transportclose', () => {
        logger.debug('Üretici transport kapatıldı', { producerId: producer.id });
        this.producers.delete(producer.id);
      });

      producer.on('score', (score) => {
        logger.debug('Üretici skor güncellendi', {
          producerId: producer.id,
          score,
        });
      });

      logger.info('Üretici oluşturuldu', {
        producerId: producer.id,
        transportId,
        kind,
      });

      return producer;
    } catch (error) {
      logger.error('Üretici oluşturulamadı', {
        error: (error as Error).message,
        transportId: options.transportId,
        kind: options.kind,
      });
      return null;
    }
  }

  /**
   * Tüketici oluşturur
   * @param options Tüketici seçenekleri
   * @returns Tüketici
   */
  async consume(options: {
    transportId: string;
    consumerId?: string;
    producerId: string;
    rtpCapabilities: mediasoup.types.RtpCapabilities;
    paused?: boolean;
    appData?: Record<string, any>;
  }): Promise<Consumer | null> {
    try {
      const {
        transportId,
        consumerId,
        producerId,
        rtpCapabilities,
        paused = false,
        appData,
      } = options;

      // Transport'u bul
      const transport = this.transports.get(transportId);
      if (!transport) {
        logger.warn('Transport bulunamadı', { transportId });
        return null;
      }

      // Üreticiyi bul
      const producer = this.producers.get(producerId);
      if (!producer) {
        logger.warn('Üretici bulunamadı', { producerId });
        return null;
      }

      // Router'ı bul
      let routerId: string | undefined;
      for (const [id, router] of this.routers.entries()) {
        if (router.canConsume({ producerId, rtpCapabilities })) {
          routerId = id;
          break;
        }
      }

      if (!routerId) {
        logger.warn('Uygun router bulunamadı', { producerId });
        return null;
      }

      const router = this.routers.get(routerId);
      if (!router) {
        logger.warn('Router bulunamadı', { routerId });
        return null;
      }

      // RTP yeteneklerini kontrol et
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        logger.warn('RTP yetenekleri uyumsuz', { producerId, transportId });
        return null;
      }

      // Tüketici oluştur
      const consumer = await transport.consume({
        id: consumerId,
        producerId,
        rtpCapabilities,
        paused,
        appData,
      });

      // Tüketiciyi kaydet
      this.consumers.set(consumer.id, consumer);

      // Tüketici olaylarını dinle
      consumer.on('transportclose', () => {
        logger.debug('Tüketici transport kapatıldı', { consumerId: consumer.id });
        this.consumers.delete(consumer.id);
      });

      consumer.on('producerclose', () => {
        logger.debug('Tüketici üretici kapatıldı', { consumerId: consumer.id });
        this.consumers.delete(consumer.id);
      });

      consumer.on('producerpause', () => {
        logger.debug('Tüketici üretici duraklatıldı', { consumerId: consumer.id });
      });

      consumer.on('producerresume', () => {
        logger.debug('Tüketici üretici devam ettirildi', { consumerId: consumer.id });
      });

      consumer.on('score', (score) => {
        logger.debug('Tüketici skor güncellendi', {
          consumerId: consumer.id,
          score,
        });
      });

      logger.info('Tüketici oluşturuldu', {
        consumerId: consumer.id,
        producerId,
        transportId,
        kind: consumer.kind,
      });

      return consumer;
    } catch (error) {
      logger.error('Tüketici oluşturulamadı', {
        error: (error as Error).message,
        transportId: options.transportId,
        producerId: options.producerId,
      });
      return null;
    }
  }

  /**
   * Üreticiyi kapatır
   * @param producerId Üretici ID
   * @returns Başarılı mı
   */
  async closeProducer(producerId: string): Promise<boolean> {
    try {
      const producer = this.producers.get(producerId);
      if (!producer) {
        logger.warn('Üretici bulunamadı', { producerId });
        return false;
      }

      producer.close();
      this.producers.delete(producerId);
      logger.debug('Üretici kapatıldı', { producerId });
      return true;
    } catch (error) {
      logger.error('Üretici kapatılamadı', {
        error: (error as Error).message,
        producerId,
      });
      return false;
    }
  }

  /**
   * Tüketiciyi kapatır
   * @param consumerId Tüketici ID
   * @returns Başarılı mı
   */
  async closeConsumer(consumerId: string): Promise<boolean> {
    try {
      const consumer = this.consumers.get(consumerId);
      if (!consumer) {
        logger.warn('Tüketici bulunamadı', { consumerId });
        return false;
      }

      consumer.close();
      this.consumers.delete(consumerId);
      logger.debug('Tüketici kapatıldı', { consumerId });
      return true;
    } catch (error) {
      logger.error('Tüketici kapatılamadı', {
        error: (error as Error).message,
        consumerId,
      });
      return false;
    }
  }

  /**
   * Odadaki üreticileri getirir
   * @param roomId Oda ID
   * @returns Üreticiler
   */
  async getProducersInRoom(roomId: string): Promise<Producer[]> {
    try {
      // Router'ı kontrol et
      const router = this.routers.get(roomId);
      if (!router) {
        logger.warn('Router bulunamadı', { roomId });
        return [];
      }

      // Odaya ait üreticileri bul
      const roomProducers: Producer[] = [];
      for (const [, producer] of this.producers) {
        // Üreticinin appData'sında roomId var mı kontrol et
        const appData = producer.appData as Record<string, any>;
        if (appData && appData.roomId === roomId) {
          roomProducers.push(producer);
        }
      }

      logger.debug('Odadaki üreticiler getirildi', {
        roomId,
        producerCount: roomProducers.length,
      });

      return roomProducers;
    } catch (error) {
      logger.error('Odadaki üreticiler getirilirken hata oluştu', {
        error: (error as Error).message,
        roomId,
      });
      return [];
    }
  }

  /**
   * Yeni bir producer oluşturur
   * @param transportId Transport ID
   * @param rtpParameters RTP parametreleri
   * @param kind Medya türü
   * @returns Producer ID
   */
  async createProducer(
    transportId: string,
    rtpParameters: any,
    kind: 'audio' | 'video'
  ): Promise<string | undefined> {
    try {
      const transport = this.transports.get(transportId);
      if (!transport) {
        logger.warn('Transport bulunamadı', { transportId });
        return undefined;
      }

      const producer = await transport.produce({
        kind,
        rtpParameters,
      });

      producer.on('transportclose', () => {
        logger.info('Producer transport kapatıldı', { producerId: producer.id });
        this.producers.delete(producer.id);
      });

      producer.on('score', (score) => {
        logger.debug('Producer score güncellendi', {
          producerId: producer.id,
          score,
        });
      });

      this.producers.set(producer.id, producer);

      logger.info('Yeni producer oluşturuldu', {
        producerId: producer.id,
        transportId,
        kind,
      });

      return producer.id;
    } catch (error) {
      logger.error('Producer oluşturulurken hata oluştu', {
        error: (error as Error).message,
        transportId,
        kind,
      });
      return undefined;
    }
  }

  /**
   * Yeni bir consumer oluşturur
   * @param transportId Transport ID
   * @param producerId Producer ID
   * @param rtpCapabilities RTP yetenekleri
   * @returns Consumer bilgileri
   */
  async createConsumer(
    transportId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<
    | {
        id: string;
        kind: 'audio' | 'video';
        rtpParameters: any;
        producerId: string;
      }
    | undefined
  > {
    try {
      const transport = this.transports.get(transportId);
      if (!transport) {
        logger.warn('Transport bulunamadı', { transportId });
        return undefined;
      }

      const producer = this.producers.get(producerId);
      if (!producer) {
        logger.warn('Producer bulunamadı', { producerId });
        return undefined;
      }

      // Router'ı bul
      let routerId: string | undefined;
      for (const [id, router] of this.routers.entries()) {
        if (router.canConsume({ producerId, rtpCapabilities })) {
          routerId = id;
          break;
        }
      }

      if (!routerId) {
        logger.warn('Uygun router bulunamadı', { producerId });
        return undefined;
      }

      const router = this.routers.get(routerId);
      if (!router) {
        logger.warn('Router bulunamadı', { routerId });
        return undefined;
      }

      // Consumer oluşturabilir mi kontrol et
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        logger.warn('Router consumer oluşturamıyor', {
          producerId,
          routerId,
        });
        return undefined;
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Başlangıçta duraklatılmış olarak oluştur
      });

      consumer.on('transportclose', () => {
        logger.info('Consumer transport kapatıldı', { consumerId: consumer.id });
        this.consumers.delete(consumer.id);
      });

      consumer.on('producerclose', () => {
        logger.info('Consumer producer kapatıldı', { consumerId: consumer.id });
        this.consumers.delete(consumer.id);
      });

      consumer.on('score', (score) => {
        logger.debug('Consumer score güncellendi', {
          consumerId: consumer.id,
          score,
        });
      });

      this.consumers.set(consumer.id, consumer);

      logger.info('Yeni consumer oluşturuldu', {
        consumerId: consumer.id,
        transportId,
        producerId,
      });

      return {
        id: consumer.id,
        kind: consumer.kind as 'audio' | 'video',
        rtpParameters: consumer.rtpParameters,
        producerId: consumer.producerId,
      };
    } catch (error) {
      logger.error('Consumer oluşturulurken hata oluştu', {
        error: (error as Error).message,
        transportId,
        producerId,
      });
      return undefined;
    }
  }

  /**
   * Consumer'ı başlatır
   * @param consumerId Consumer ID
   * @returns İşlem başarılı mı
   */
  async resumeConsumer(consumerId: string): Promise<boolean> {
    try {
      const consumer = this.consumers.get(consumerId);
      if (!consumer) {
        logger.warn('Consumer bulunamadı', { consumerId });
        return false;
      }

      await consumer.resume();

      logger.info('Consumer başlatıldı', { consumerId });

      return true;
    } catch (error) {
      logger.error('Consumer başlatılırken hata oluştu', {
        error: (error as Error).message,
        consumerId,
      });
      return false;
    }
  }

  /**
   * Yeni bir oda oluşturur
   * @param roomId Oda ID
   * @returns Router ID
   */
  async createRoom(roomId: string): Promise<string | undefined> {
    try {
      // Oda zaten var mı kontrol et
      if (this.rooms.has(roomId)) {
        logger.warn('Oda zaten var', { roomId });
        return this.rooms.get(roomId)?.routerId;
      }

      // Yeni router oluştur
      const routerId = await this.createRouter();

      // Odayı kaydet
      this.rooms.set(roomId, {
        routerId,
        peers: new Map(),
      });

      logger.info('Yeni oda oluşturuldu', { roomId, routerId });

      return routerId;
    } catch (error) {
      logger.error('Oda oluşturulurken hata oluştu', {
        error: (error as Error).message,
        roomId,
      });
      return undefined;
    }
  }

  /**
   * Odaya kullanıcı ekler
   * @param roomId Oda ID
   * @param userId Kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async addPeerToRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        logger.warn('Oda bulunamadı', { roomId });
        return false;
      }

      // Kullanıcı zaten odada mı kontrol et
      if (room.peers.has(userId)) {
        logger.warn('Kullanıcı zaten odada', { roomId, userId });
        return true;
      }

      // Kullanıcıyı odaya ekle
      room.peers.set(userId, {
        userId,
        transports: [],
        producers: [],
        consumers: [],
      });

      logger.info('Kullanıcı odaya eklendi', { roomId, userId });

      return true;
    } catch (error) {
      logger.error('Kullanıcı odaya eklenirken hata oluştu', {
        error: (error as Error).message,
        roomId,
        userId,
      });
      return false;
    }
  }

  /**
   * Odadan kullanıcı çıkarır
   * @param roomId Oda ID
   * @param userId Kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async removePeerFromRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        logger.warn('Oda bulunamadı', { roomId });
        return false;
      }

      const peer = room.peers.get(userId);
      if (!peer) {
        logger.warn('Kullanıcı odada bulunamadı', { roomId, userId });
        return false;
      }

      // Kullanıcının transport, producer ve consumer'larını kapat
      for (const transportId of peer.transports) {
        const transport = this.transports.get(transportId);
        if (transport) {
          transport.close();
        }
      }

      // Kullanıcıyı odadan çıkar
      room.peers.delete(userId);

      logger.info('Kullanıcı odadan çıkarıldı', { roomId, userId });

      return true;
    } catch (error) {
      logger.error('Kullanıcı odadan çıkarılırken hata oluştu', {
        error: (error as Error).message,
        roomId,
        userId,
      });
      return false;
    }
  }

  /**
   * Odadaki kullanıcıları getirir
   * @param roomId Oda ID
   * @returns Kullanıcı ID'leri
   */
  getPeersInRoom(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }

    return Array.from(room.peers.keys());
  }

  /**
   * Odayı getirir
   * @param roomId Oda ID
   * @returns Oda bilgileri
   */
  getRoom(roomId: string): { routerId: string; peers: Map<string, any> } | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Transport ID'sine göre oda ID'sini getirir
   * @param transportId Transport ID
   * @returns Oda ID
   */
  getRoomIdByTransportId(transportId: string): string | undefined {
    return this.transportToRoom.get(transportId);
  }

  /**
   * Producer ID'sine göre kullanıcı ID'sini getirir
   * @param producerId Producer ID
   * @returns Kullanıcı ID
   */
  getUserIdByProducerId(producerId: string): string | undefined {
    return this.producerToUser.get(producerId);
  }

  /**
   * Kullanıcıya transport ekler
   * @param roomId Oda ID
   * @param userId Kullanıcı ID
   * @param transportId Transport ID
   * @returns İşlem başarılı mı
   */
  addTransportToPeer(roomId: string, userId: string, transportId: string): boolean {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }

      const peer = room.peers.get(userId);
      if (!peer) {
        return false;
      }

      peer.transports.push(transportId);
      this.transportToRoom.set(transportId, roomId);

      return true;
    } catch (error) {
      logger.error('Transport kullanıcıya eklenirken hata oluştu', {
        error: (error as Error).message,
        roomId,
        userId,
        transportId,
      });
      return false;
    }
  }

  /**
   * Kullanıcıya producer ekler
   * @param roomId Oda ID
   * @param userId Kullanıcı ID
   * @param producerId Producer ID
   * @returns İşlem başarılı mı
   */
  addProducerToPeer(roomId: string, userId: string, producerId: string): boolean {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }

      const peer = room.peers.get(userId);
      if (!peer) {
        return false;
      }

      peer.producers.push(producerId);
      this.producerToUser.set(producerId, userId);

      return true;
    } catch (error) {
      logger.error('Producer kullanıcıya eklenirken hata oluştu', {
        error: (error as Error).message,
        roomId,
        userId,
        producerId,
      });
      return false;
    }
  }

  /**
   * Kullanıcıya consumer ekler
   * @param roomId Oda ID
   * @param userId Kullanıcı ID
   * @param consumerId Consumer ID
   * @returns İşlem başarılı mı
   */
  addConsumerToPeer(roomId: string, userId: string, consumerId: string): boolean {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }

      const peer = room.peers.get(userId);
      if (!peer) {
        return false;
      }

      peer.consumers.push(consumerId);

      return true;
    } catch (error) {
      logger.error('Consumer kullanıcıya eklenirken hata oluştu', {
        error: (error as Error).message,
        roomId,
        userId,
        consumerId,
      });
      return false;
    }
  }

  /**
   * Kaynakları temizler
   */
  async close(): Promise<void> {
    try {
      // Tüm transport, producer ve consumer'ları kapat
      for (const transport of this.transports.values()) {
        transport.close();
      }

      // Tüm router'ları kapat
      for (const router of this.routers.values()) {
        router.close();
      }

      // Tüm işçileri kapat
      for (const worker of this.workers) {
        worker.close();
      }

      // Koleksiyonları temizle
      this.transports.clear();
      this.producers.clear();
      this.consumers.clear();
      this.routers.clear();
      this.rooms.clear();
      this.workers = [];

      logger.info('WebRTC servisi kapatıldı');
    } catch (error) {
      logger.error('WebRTC servisi kapatılırken hata oluştu', {
        error: (error as Error).message,
      });
    }
  }
}
