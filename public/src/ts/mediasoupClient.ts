/**
 * public/src/ts/mediasoupClient.ts
 * Mediasoup istemci kütüphanesini ve yardımcı fonksiyonları dışa aktarır
 */

// Mediasoup istemci kütüphanesini içe aktar
import * as mediasoupClient from 'mediasoup-client';
import { socket } from './socket';
import { Device } from 'mediasoup-client';
import { types as mediasoupTypes } from 'mediasoup-client';

// Mediasoup istemci kütüphanesini global olarak tanımla
(window as any).mediasoupClient = mediasoupClient;

// MediaSoup durumu
interface MediasoupState {
  device: Device | null;
  isConnected: boolean;
  sendTransport: mediasoupTypes.Transport | null;
  recvTransport: mediasoupTypes.Transport | null;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;
  roomId: string | null;
  routerRtpCapabilities: mediasoupTypes.RtpCapabilities | null;
}

// MediaSoup durumunu başlat
const mediasoupState: MediasoupState = {
  device: null,
  isConnected: false,
  sendTransport: null,
  recvTransport: null,
  producers: new Map(),
  consumers: new Map(),
  roomId: null,
  routerRtpCapabilities: null,
};

/**
 * MediaSoup cihazını yükler
 * @param routerRtpCapabilities Router RTP yetenekleri
 * @returns Başarılı mı
 */
export async function loadDevice(routerRtpCapabilities: mediasoupTypes.RtpCapabilities): Promise<boolean> {
  try {
    // Cihaz zaten yüklü mü kontrol et
    if (mediasoupState.device && mediasoupState.device.loaded) {
      console.log('MediaSoup cihazı zaten yüklü');
      return true;
    }

    // Yeni cihaz oluştur
    mediasoupState.device = new mediasoupClient.Device();

    // Cihazı yükle
    await mediasoupState.device.load({ routerRtpCapabilities });
    mediasoupState.routerRtpCapabilities = routerRtpCapabilities;

    console.log('MediaSoup cihazı yüklendi');
    return true;
  } catch (error) {
    console.error('MediaSoup cihazı yüklenirken hata oluştu:', error);
    return false;
  }
}

/**
 * Gönderme transportu oluşturur
 * @param transportOptions Transport seçenekleri
 * @returns Transport ID
 */
export async function createSendTransport(transportOptions: any): Promise<string | null> {
  try {
    if (!mediasoupState.device) {
      console.error('MediaSoup cihazı yüklenmedi');
      return null;
    }

    // Gönderme transportu oluştur
    mediasoupState.sendTransport = mediasoupState.device.createSendTransport(transportOptions);

    // Transport olaylarını dinle
    mediasoupState.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Transport bağlantısını sunucuya bildir
        await socket.emitWithAck('mediasoup:connect-transport', {
          transportId: mediasoupState.sendTransport?.id,
          dtlsParameters,
        });

        // Başarılı
        callback();
      } catch (error) {
        // Hata
        errback(error as Error);
      }
    });

    mediasoupState.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        // Üretici oluşturma isteğini sunucuya gönder
        const { producerId } = await socket.emitWithAck('mediasoup:produce', {
          transportId: mediasoupState.sendTransport?.id,
          kind,
          rtpParameters,
          appData,
        });

        // Başarılı
        callback({ id: producerId });
      } catch (error) {
        // Hata
        errback(error as Error);
      }
    });

    console.log('Gönderme transportu oluşturuldu:', mediasoupState.sendTransport.id);
    return mediasoupState.sendTransport.id;
  } catch (error) {
    console.error('Gönderme transportu oluşturulurken hata oluştu:', error);
    return null;
  }
}

/**
 * Alma transportu oluşturur
 * @param transportOptions Transport seçenekleri
 * @returns Transport ID
 */
export async function createRecvTransport(transportOptions: any): Promise<string | null> {
  try {
    if (!mediasoupState.device) {
      console.error('MediaSoup cihazı yüklenmedi');
      return null;
    }

    // Alma transportu oluştur
    mediasoupState.recvTransport = mediasoupState.device.createRecvTransport(transportOptions);

    // Transport olaylarını dinle
    mediasoupState.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Transport bağlantısını sunucuya bildir
        await socket.emitWithAck('mediasoup:connect-transport', {
          transportId: mediasoupState.recvTransport?.id,
          dtlsParameters,
        });

        // Başarılı
        callback();
      } catch (error) {
        // Hata
        errback(error as Error);
      }
    });

    console.log('Alma transportu oluşturuldu:', mediasoupState.recvTransport.id);
    return mediasoupState.recvTransport.id;
  } catch (error) {
    console.error('Alma transportu oluşturulurken hata oluştu:', error);
    return null;
  }
}

/**
 * Medya akışını üretir
 * @param track Medya parçası
 * @param options Üretici seçenekleri
 * @returns Üretici ID
 */
export async function produce(
  track: MediaStreamTrack,
  options: {
    codecOptions?: any;
    encodings?: any;
    appData?: any;
    simulcast?: boolean;
  } = {}
): Promise<string | null> {
  try {
    if (!mediasoupState.sendTransport) {
      console.error('Gönderme transportu oluşturulmadı');
      return null;
    }

    // Üretici seçenekleri
    const producerOptions: any = {
      track,
      codecOptions: options.codecOptions,
      appData: {
        ...options.appData,
        mediaType: track.kind
      }
    };

    // Video için simulcast ayarları
    if (track.kind === 'video' && options.simulcast) {
      producerOptions.encodings = [
        { scaleResolutionDownBy: 4, maxBitrate: 100000 },
        { scaleResolutionDownBy: 2, maxBitrate: 300000 },
        { scaleResolutionDownBy: 1, maxBitrate: 900000 }
      ];
      producerOptions.codecOptions = {
        videoGoogleStartBitrate: 1000
      };
    } else if (options.encodings) {
      producerOptions.encodings = options.encodings;
    }

    // Üretici oluştur
    const producer = await mediasoupState.sendTransport.produce(producerOptions);

    // Üreticiyi kaydet
    mediasoupState.producers.set(producer.id, producer);

    // Üretici olaylarını dinle
    producer.on('transportclose', () => {
      console.log('Üretici transport kapatıldı:', producer.id);
      mediasoupState.producers.delete(producer.id);
    });

    producer.on('trackended', () => {
      console.log('Üretici parça sonlandı:', producer.id);
      closeProducer(producer.id);
    });

    console.log(`${track.kind} üreticisi oluşturuldu:`, producer.id);
    return producer.id;
  } catch (error) {
    console.error('Üretici oluşturulurken hata oluştu:', error);
    return null;
  }
}

/**
 * Üreticiyi kapatır
 * @param producerId Üretici ID
 */
export async function closeProducer(producerId: string): Promise<void> {
  try {
    const producer = mediasoupState.producers.get(producerId);
    if (!producer) {
      console.warn('Üretici bulunamadı:', producerId);
      return;
    }

    // Üreticiyi kapat
    producer.close();
    mediasoupState.producers.delete(producerId);

    // Sunucuya bildir
    await socket.emitWithAck('mediasoup:close-producer', { producerId });

    console.log('Üretici kapatıldı:', producerId);
  } catch (error) {
    console.error('Üretici kapatılırken hata oluştu:', error);
  }
}

/**
 * Tüketici oluşturur
 * @param producerId Üretici ID
 * @param rtpCapabilities RTP yetenekleri
 * @returns Tüketici bilgileri
 */
export async function consume(
  producerId: string,
  rtpCapabilities: mediasoupTypes.RtpCapabilities
): Promise<{ consumerId: string; track: MediaStreamTrack; kind: string; producerId: string } | null> {
  try {
    if (!mediasoupState.recvTransport) {
      console.error('Alma transportu oluşturulmadı');
      return null;
    }

    if (!mediasoupState.device?.canConsume({ producerId, rtpCapabilities })) {
      console.error('Tüketici oluşturulamıyor, yetenekler uyumsuz');
      return null;
    }

    // Sunucudan tüketici parametrelerini al
    const { id, producerId: serverProducerId, kind, rtpParameters, appData } = await socket.emitWithAck(
      'mediasoup:consume',
      {
        transportId: mediasoupState.recvTransport.id,
        producerId,
        rtpCapabilities,
      }
    );

    // Tüketici oluştur
    const consumer = await mediasoupState.recvTransport.consume({
      id,
      producerId: serverProducerId,
      kind,
      rtpParameters,
      appData
    });

    // Tüketiciyi kaydet
    mediasoupState.consumers.set(consumer.id, consumer);

    // Tüketici olaylarını dinle
    consumer.on('transportclose', () => {
      console.log('Tüketici transport kapatıldı:', consumer.id);
      mediasoupState.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      console.log('Tüketici üretici kapatıldı:', consumer.id);
      mediasoupState.consumers.delete(consumer.id);
    });

    // Sunucuya tüketici hazır olduğunu bildir
    await socket.emitWithAck('mediasoup:consumer-ready', { consumerId: id });

    console.log(`${kind} tüketicisi oluşturuldu:`, consumer.id);
    return {
      consumerId: consumer.id,
      track: consumer.track,
      kind: consumer.kind,
      producerId: consumer.producerId
    };
  } catch (error) {
    console.error('Tüketici oluşturulurken hata oluştu:', error);
    return null;
  }
}

/**
 * Tüketiciyi kapatır
 * @param consumerId Tüketici ID
 */
export async function closeConsumer(consumerId: string): Promise<void> {
  try {
    const consumer = mediasoupState.consumers.get(consumerId);
    if (!consumer) {
      console.warn('Tüketici bulunamadı:', consumerId);
      return;
    }

    // Tüketiciyi kapat
    consumer.close();
    mediasoupState.consumers.delete(consumerId);

    // Sunucuya bildir
    await socket.emitWithAck('mediasoup:close-consumer', { consumerId });

    console.log('Tüketici kapatıldı:', consumerId);
  } catch (error) {
    console.error('Tüketici kapatılırken hata oluştu:', error);
  }
}

/**
 * Tüm transportları kapatır
 */
export function closeTransports(): void {
  try {
    // Gönderme transportunu kapat
    if (mediasoupState.sendTransport) {
      mediasoupState.sendTransport.close();
      mediasoupState.sendTransport = null;
    }

    // Alma transportunu kapat
    if (mediasoupState.recvTransport) {
      mediasoupState.recvTransport.close();
      mediasoupState.recvTransport = null;
    }

    console.log('Tüm transportlar kapatıldı');
  } catch (error) {
    console.error('Transportlar kapatılırken hata oluştu:', error);
  }
}

/**
 * MediaSoup bağlantısını kapatır
 */
export function closeConnection(): void {
  try {
    // Tüm üreticileri kapat
    for (const producerId of mediasoupState.producers.keys()) {
      closeProducer(producerId);
    }

    // Tüm tüketicileri kapat
    for (const consumerId of mediasoupState.consumers.keys()) {
      closeConsumer(consumerId);
    }

    // Transportları kapat
    closeTransports();

    // Durumu sıfırla
    mediasoupState.device = null;
    mediasoupState.isConnected = false;
    mediasoupState.roomId = null;
    mediasoupState.routerRtpCapabilities = null;

    console.log('MediaSoup bağlantısı kapatıldı');
  } catch (error) {
    console.error('MediaSoup bağlantısı kapatılırken hata oluştu:', error);
  }
}

/**
 * MediaSoup durumunu getirir
 * @returns MediaSoup durumu
 */
export function getMediasoupState(): MediasoupState {
  return mediasoupState;
}

// Mediasoup istemci kütüphanesini ve yardımcı fonksiyonları dışa aktar
export default mediasoupClient;
