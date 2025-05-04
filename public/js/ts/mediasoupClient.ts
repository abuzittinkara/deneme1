/**
 * public/js/ts/mediasoupClient.ts
 * Mediasoup istemci entegrasyonu
 */

import { Socket } from 'socket.io-client';
import { Device, Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

// Mediasoup istemci kütüphanesini global olarak tanımla
declare global {
  interface Window {
    mediasoupClient: {
      Device: new () => Device;
    };
  }
}

// Mediasoup yanıt tipi
interface MediasoupResponse {
  error?: string;
  [key: string]: any;
}

// Transport oluşturma yanıtı
interface CreateTransportResponse {
  transportId: string;
  params: {
    id: string;
    iceParameters: any;
    iceCandidates: any[];
    dtlsParameters: any;
    sctpParameters?: any;
  };
}

// Consumer oluşturma yanıtı
interface ConsumeResponse {
  consumerId: string;
  producerId: string;
  rtpParameters: any;
  kind: 'audio' | 'video';
}

/**
 * Mediasoup işleyici sınıfı
 */
class MediasoupHandler {
  // Socket.IO bağlantısı
  private socket: Socket;

  // Mediasoup cihazı
  public device: Device | null = null;

  // Oda bilgisi
  public roomId: string | null = null;

  // Transport'lar
  public producerTransport: Transport | null = null;
  public consumerTransport: Transport | null = null;

  // Producer ve Consumer koleksiyonları
  public producers: Map<string, Producer> = new Map();
  public consumers: Map<string, Consumer> = new Map();

  // Durum bilgileri
  public isProducing: boolean = false;
  public isConsuming: boolean = false;

  // Medya akışı
  public localStream: MediaStream | null = null;

  // Callback fonksiyonları
  public onNewConsumer: ((consumer: Consumer, peerId: string) => void) | null = null;
  public onConsumerClosed: ((consumerId: string, peerId: string) => void) | null = null;
  public onPeerJoined: ((peerId: string, username: string) => void) | null = null;
  public onPeerLeft: ((peerId: string) => void) | null = null;

  /**
   * Mediasoup işleyici oluşturur
   * @param socket - Socket.IO bağlantısı
   */
  constructor(socket: Socket) {
    this.socket = socket;
  }

  /**
   * Mediasoup cihazını yükler
   * @param roomId - Oda ID'si
   * @returns Yükleme başarılı mı
   */
  async loadDevice(roomId: string): Promise<boolean> {
    try {
      this.roomId = roomId;

      // RTP yeteneklerini al
      const { rtpCapabilities } = await this.sendRequest('mediasoup:join-room', { roomId });

      // Mediasoup cihazını oluştur
      this.device = new window.mediasoupClient.Device();

      // Cihazı yükle
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });

      console.log('Mediasoup cihazı yüklendi');

      return true;
    } catch (error) {
      console.error('Mediasoup cihazı yüklenirken hata oluştu:', error);
      return false;
    }
  }

  /**
   * Medya akışını başlatır
   * @returns Başlatma başarılı mı
   */
  async startMedia(): Promise<boolean> {
    try {
      // Kullanıcı medya akışını al
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // Producer transport oluştur
      await this.createProducerTransport();

      // Consumer transport oluştur
      await this.createConsumerTransport();

      // Ses üreticisi oluştur
      const audioTrack = this.localStream.getAudioTracks()[0];

      if (audioTrack) {
        await this.produceAudio(audioTrack);
      }

      return true;
    } catch (error) {
      console.error('Medya akışı başlatılırken hata oluştu:', error);
      return false;
    }
  }

  /**
   * Producer transport oluşturur
   * @returns Oluşturma başarılı mı
   */
  async createProducerTransport(): Promise<boolean> {
    try {
      if (!this.device) {
        throw new Error('Mediasoup cihazı yüklenmedi');
      }

      if (!this.roomId) {
        throw new Error('Oda ID tanımlanmadı');
      }

      // Transport oluştur
      const { transportId, params } = await this.sendRequest<CreateTransportResponse>('mediasoup:create-transport', {
        roomId: this.roomId,
        direction: 'send'
      });

      // Transport oluştur
      this.producerTransport = this.device.createSendTransport(params);

      // Transport olaylarını dinle
      this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Transport'u bağla
          await this.sendRequest('mediasoup:connect-transport', {
            roomId: this.roomId,
            transportId,
            dtlsParameters
          });

          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          // Producer oluştur
          const { producerId } = await this.sendRequest<{ producerId: string }>('mediasoup:produce', {
            roomId: this.roomId,
            transportId,
            kind,
            rtpParameters
          });

          callback({ id: producerId });
        } catch (error) {
          errback(error as Error);
        }
      });

      this.producerTransport.on('connectionstatechange', (state) => {
        console.log('Producer transport bağlantı durumu:', state);

        if (state === 'closed' || state === 'failed' || state === 'disconnected') {
          this.producerTransport?.close();
          this.producers.forEach((producer) => producer.close());
          this.producers.clear();
        }
      });

      console.log('Producer transport oluşturuldu');

      return true;
    } catch (error) {
      console.error('Producer transport oluşturulurken hata oluştu:', error);
      return false;
    }
  }

  /**
   * Consumer transport oluşturur
   * @returns Oluşturma başarılı mı
   */
  async createConsumerTransport(): Promise<boolean> {
    try {
      if (!this.device) {
        throw new Error('Mediasoup cihazı yüklenmedi');
      }

      if (!this.roomId) {
        throw new Error('Oda ID tanımlanmadı');
      }

      // Transport oluştur
      const { transportId, params } = await this.sendRequest<CreateTransportResponse>('mediasoup:create-transport', {
        roomId: this.roomId,
        direction: 'recv'
      });

      // Transport oluştur
      this.consumerTransport = this.device.createRecvTransport(params);

      // Transport olaylarını dinle
      this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Transport'u bağla
          await this.sendRequest('mediasoup:connect-transport', {
            roomId: this.roomId,
            transportId,
            dtlsParameters
          });

          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      this.consumerTransport.on('connectionstatechange', (state) => {
        console.log('Consumer transport bağlantı durumu:', state);

        if (state === 'closed' || state === 'failed' || state === 'disconnected') {
          this.consumerTransport?.close();
          this.consumers.forEach((consumer) => consumer.close());
          this.consumers.clear();
        }
      });

      console.log('Consumer transport oluşturuldu');

      // Socket olaylarını dinle
      this.socket.on('mediasoup:new-producer', async ({ producerId, peerId, kind }: { producerId: string; peerId: string; kind: 'audio' | 'video' }) => {
        await this.consume(producerId, peerId, kind);
      });

      this.socket.on('mediasoup:peer-joined', ({ peerId, username }: { peerId: string; username: string }) => {
        console.log(`Kullanıcı odaya katıldı: ${username}`);

        if (this.onPeerJoined) {
          this.onPeerJoined(peerId, username);
        }
      });

      this.socket.on('mediasoup:peer-left', ({ peerId }: { peerId: string }) => {
        console.log(`Kullanıcı odadan ayrıldı: ${peerId}`);

        // Kullanıcının consumer'larını kapat
        this.consumers.forEach((consumer) => {
          if (consumer.appData.peerId === peerId) {
            consumer.close();
            this.consumers.delete(consumer.id);

            if (this.onConsumerClosed) {
              this.onConsumerClosed(consumer.id, peerId);
            }
          }
        });

        if (this.onPeerLeft) {
          this.onPeerLeft(peerId);
        }
      });

      return true;
    } catch (error) {
      console.error('Consumer transport oluşturulurken hata oluştu:', error);
      return false;
    }
  }

  /**
   * Ses üretir
   * @param audioTrack - Ses track'i
   * @returns Oluşturulan producer
   */
  async produceAudio(audioTrack: MediaStreamTrack): Promise<Producer | null> {
    try {
      if (!this.producerTransport) {
        throw new Error('Producer transport oluşturulmadı');
      }

      // Ses üreticisi oluştur
      const producer = await this.producerTransport.produce({
        track: audioTrack,
        codecOptions: {
          opusStereo: true,
          opusDtx: true,
          opusFec: true,
          opusNack: true
        }
      });

      // Producer olaylarını dinle
      producer.on('transportclose', () => {
        producer.close();
        this.producers.delete(producer.id);
      });

      producer.on('trackended', () => {
        producer.close();
        this.producers.delete(producer.id);
      });

      // Producer'ı sakla
      this.producers.set(producer.id, producer);
      this.isProducing = true;

      console.log('Ses üreticisi oluşturuldu');

      return producer;
    } catch (error) {
      console.error('Ses üretilirken hata oluştu:', error);
      return null;
    }
  }

  /**
   * Ses tüketir
   * @param producerId - Producer ID'si
   * @param peerId - Peer ID'si
   * @param kind - Medya türü
   * @returns Oluşturulan consumer
   */
  async consume(producerId: string, peerId: string, kind: 'audio' | 'video'): Promise<Consumer | null> {
    try {
      if (!this.consumerTransport) {
        throw new Error('Consumer transport oluşturulmadı');
      }

      if (!this.device) {
        throw new Error('Mediasoup cihazı yüklenmedi');
      }

      if (!this.roomId) {
        throw new Error('Oda ID tanımlanmadı');
      }

      // RTP yeteneklerini kontrol et
      if (!this.device.rtpCapabilities) {
        throw new Error('RTP yetenekleri tanımlanmamış');
      }

      // Consumer oluştur
      const { consumerId, producerId: remoteProducerId, rtpParameters, kind: consumerKind } = await this.sendRequest<ConsumeResponse>('mediasoup:consume', {
        roomId: this.roomId,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      });

      // Consumer oluştur
      const consumer = await this.consumerTransport.consume({
        id: consumerId,
        producerId: remoteProducerId,
        kind: consumerKind,
        rtpParameters,
        appData: { peerId }
      });

      // Consumer olaylarını dinle
      consumer.on('transportclose', () => {
        consumer.close();
        this.consumers.delete(consumer.id);
      });

      // Consumer'ı sakla
      this.consumers.set(consumer.id, consumer);
      this.isConsuming = true;

      // Consumer'ı başlat
      await this.sendRequest('mediasoup:resume-consumer', {
        roomId: this.roomId,
        consumerId
      });

      console.log(`${kind} consumer oluşturuldu`);

      // Callback'i çağır
      if (this.onNewConsumer) {
        this.onNewConsumer(consumer, peerId);
      }

      return consumer;
    } catch (error) {
      console.error('Consumer oluşturulurken hata oluştu:', error);
      return null;
    }
  }

  /**
   * Odadan ayrılır
   * @returns Ayrılma başarılı mı
   */
  async leaveRoom(): Promise<boolean> {
    try {
      if (!this.roomId) {
        return true; // Zaten odada değilse başarılı kabul et
      }

      // Odadan ayrıl
      await this.sendRequest('mediasoup:leave-room', { roomId: this.roomId });

      // Producer'ları kapat
      this.producers.forEach((producer) => producer.close());
      this.producers.clear();

      // Consumer'ları kapat
      this.consumers.forEach((consumer) => consumer.close());
      this.consumers.clear();

      // Transport'ları kapat
      if (this.producerTransport) {
        this.producerTransport.close();
        this.producerTransport = null;
      }

      if (this.consumerTransport) {
        this.consumerTransport.close();
        this.consumerTransport = null;
      }

      // Medya akışını kapat
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      this.isProducing = false;
      this.isConsuming = false;
      this.roomId = null;

      console.log('Odadan ayrıldı');

      return true;
    } catch (error) {
      console.error('Odadan ayrılırken hata oluştu:', error);
      return false;
    }
  }

  /**
   * Socket.IO isteği gönderir
   * @param event - Olay adı
   * @param data - Gönderilecek veri
   * @returns Sunucu yanıtı
   */
  sendRequest<T = any>(event: string, data: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.socket.emit(event, data, (response: MediasoupResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response as T);
        }
      });
    });
  }
}

export default MediasoupHandler;
