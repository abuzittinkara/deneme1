/**
 * src/socket/handlers/mediasoupHandlers.ts
 * MediaSoup olayları için işleyicileri kaydeder
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';

/**
 * MediaSoup olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerMediasoupHandlers(
  socket: TypedSocket,
  dependencies: Record<string, any>
): void {
  const { webRTCService } = dependencies;
  const userId = socket.data.userId || socket.id; // Kullanıcı ID yoksa socket ID kullan
  const username = socket.data.username || 'Misafir';

  /**
   * Router yeteneklerini al
   */
  socket.on('mediasoup:get-router-capabilities', async (data, callback) => {
    try {
      const { roomId } = data;

      if (!roomId) {
        return callback({ error: 'Geçersiz oda ID' });
      }

      // Router'ı al veya oluştur
      const router = await webRTCService.getOrCreateRouter(roomId);
      if (!router) {
        return callback({ error: 'Router oluşturulamadı' });
      }

      // Router yeteneklerini döndür
      callback({
        routerRtpCapabilities: router.rtpCapabilities,
      });

      logger.debug('Router yetenekleri alındı', {
        userId,
        username,
        roomId,
      });
    } catch (error) {
      logger.error('Router yetenekleri alınırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Router yetenekleri alınırken bir hata oluştu' });
    }
  });

  /**
   * Transport oluştur
   */
  socket.on('mediasoup:create-transport', async (data, callback) => {
    try {
      const { roomId, producing, consuming } = data;

      if (!roomId) {
        return callback({ error: 'Geçersiz oda ID' });
      }

      // Transport oluştur
      const transport = await webRTCService.createWebRtcTransport({
        roomId,
        producing: !!producing,
        consuming: !!consuming,
      });

      if (!transport) {
        return callback({ error: 'Transport oluşturulamadı' });
      }

      // Transport bilgilerini döndür
      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      logger.debug('Transport oluşturuldu', {
        userId,
        username,
        roomId,
        transportId: transport.id,
        producing,
        consuming,
      });
    } catch (error) {
      logger.error('Transport oluşturulurken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Transport oluşturulurken bir hata oluştu' });
    }
  });

  /**
   * Transport bağlantısı
   */
  socket.on('mediasoup:connect-transport', async (data, callback) => {
    try {
      const { transportId, dtlsParameters } = data;

      if (!transportId || !dtlsParameters) {
        return callback({ error: 'Geçersiz transport ID veya DTLS parametreleri' });
      }

      // Transport'u bağla
      await webRTCService.connectTransport(transportId, dtlsParameters);

      // Başarılı
      callback({ success: true });

      logger.debug('Transport bağlandı', {
        userId,
        username,
        transportId,
      });
    } catch (error) {
      logger.error('Transport bağlanırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Transport bağlanırken bir hata oluştu' });
    }
  });

  /**
   * Üretici oluştur
   */
  socket.on('mediasoup:produce', async (data, callback) => {
    try {
      const { transportId, kind, rtpParameters, appData } = data;

      if (!transportId || !kind || !rtpParameters) {
        return callback({ error: 'Geçersiz parametreler' });
      }

      // Üretici oluştur
      const producer = await webRTCService.produce({
        transportId,
        producerId: `${userId}-${kind}`,
        kind,
        rtpParameters,
        appData: {
          ...appData,
          userId,
          username,
        },
      });

      if (!producer) {
        return callback({ error: 'Üretici oluşturulamadı' });
      }

      // Üretici ID'sini döndür
      callback({ producerId: producer.id });

      logger.debug('Üretici oluşturuldu', {
        userId,
        username,
        transportId,
        producerId: producer.id,
        kind,
      });
    } catch (error) {
      logger.error('Üretici oluşturulurken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Üretici oluşturulurken bir hata oluştu' });
    }
  });

  /**
   * Tüketici oluştur
   */
  socket.on('mediasoup:consume', async (data, callback) => {
    try {
      const { transportId, producerId, rtpCapabilities } = data;

      if (!transportId || !producerId || !rtpCapabilities) {
        return callback({ error: 'Geçersiz parametreler' });
      }

      // Tüketici oluştur
      const consumer = await webRTCService.consume({
        transportId,
        consumerId: `${userId}-${producerId}`,
        producerId,
        rtpCapabilities,
      });

      if (!consumer) {
        return callback({ error: 'Tüketici oluşturulamadı' });
      }

      // Tüketici bilgilerini döndür
      callback({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });

      logger.debug('Tüketici oluşturuldu', {
        userId,
        username,
        transportId,
        consumerId: consumer.id,
        producerId,
      });
    } catch (error) {
      logger.error('Tüketici oluşturulurken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Tüketici oluşturulurken bir hata oluştu' });
    }
  });

  /**
   * Tüketici hazır
   */
  socket.on('mediasoup:consumer-ready', async (data, callback) => {
    try {
      const { consumerId } = data;

      if (!consumerId) {
        return callback({ error: 'Geçersiz tüketici ID' });
      }

      // Tüketiciyi hazır olarak işaretle
      await webRTCService.resumeConsumer(consumerId);

      // Başarılı
      callback({ success: true });

      logger.debug('Tüketici hazır', {
        userId,
        username,
        consumerId,
      });
    } catch (error) {
      logger.error('Tüketici hazır işaretlenirken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Tüketici hazır işaretlenirken bir hata oluştu' });
    }
  });

  /**
   * Üreticiyi kapat
   */
  socket.on('mediasoup:close-producer', async (data, callback) => {
    try {
      const { producerId } = data;

      if (!producerId) {
        return callback({ error: 'Geçersiz üretici ID' });
      }

      // Üreticiyi kapat
      await webRTCService.closeProducer(producerId);

      // Başarılı
      callback({ success: true });

      logger.debug('Üretici kapatıldı', {
        userId,
        username,
        producerId,
      });
    } catch (error) {
      logger.error('Üretici kapatılırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Üretici kapatılırken bir hata oluştu' });
    }
  });

  /**
   * Tüketiciyi kapat
   */
  socket.on('mediasoup:close-consumer', async (data, callback) => {
    try {
      const { consumerId } = data;

      if (!consumerId) {
        return callback({ error: 'Geçersiz tüketici ID' });
      }

      // Tüketiciyi kapat
      await webRTCService.closeConsumer(consumerId);

      // Başarılı
      callback({ success: true });

      logger.debug('Tüketici kapatıldı', {
        userId,
        username,
        consumerId,
      });
    } catch (error) {
      logger.error('Tüketici kapatılırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Tüketici kapatılırken bir hata oluştu' });
    }
  });

  /**
   * Odadaki üreticileri getir
   */
  socket.on('mediasoup:get-producers', async (data, callback) => {
    try {
      const { roomId } = data;

      if (!roomId) {
        return callback({ error: 'Geçersiz oda ID' });
      }

      // Odadaki üreticileri getir
      const producers = await webRTCService.getProducersInRoom(roomId);
      if (!producers) {
        return callback({ producers: [] });
      }

      // Üretici ID'lerini döndür
      callback({
        producers: producers.map((producer) => producer.id),
      });

      logger.debug('Odadaki üreticiler getirildi', {
        userId,
        username,
        roomId,
        producerCount: producers.length,
      });
    } catch (error) {
      logger.error('Odadaki üreticiler getirilirken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ error: 'Odadaki üreticiler getirilirken bir hata oluştu', producers: [] });
    }
  });
}
