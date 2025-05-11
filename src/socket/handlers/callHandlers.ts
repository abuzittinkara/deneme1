/**
 * src/socket/handlers/callHandlers.ts
 * Sesli/görüntülü görüşme olayları için Socket.IO işleyicileri
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';
import { CallSignalType } from '../../types/call';

/**
 * Sesli/görüntülü görüşme olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerCallHandlers(socket: TypedSocket, dependencies: Record<string, any>): void {
  const { sfu, userManager, callManager, webRTCService } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  /**
   * Görüşme başlatma olayı
   */
  socket.on('call:start', async (data) => {
    const { channelId } = data;

    try {
      // Görüşme oluştur
      const call = await measurePerformanceAsync(async () => {
        return await sfu.createRoom(channelId, userId);
      }, 'Görüşme başlatma');

      if (!call) {
        throw new Error('Görüşme başlatılamadı');
      }

      // Kullanıcı bilgilerini al
      const user = await userManager.getUserProfile(userId);

      // Kanaldaki diğer kullanıcılara görüşme başlatma bilgisini gönder
      socket.to(channelId).emit('call:start', {
        callId: call.id,
        channelId,
        initiator: user,
        participants: [user],
      });

      logger.debug('Görüşme başlatıldı', {
        userId,
        username,
        channelId,
        callId: call.id,
      });
    } catch (error) {
      logger.error('Görüşme başlatma hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId,
      });

      socket.emit('error', {
        message: 'Görüşme başlatılamadı',
        code: 'CALL_START_ERROR',
      });
    }
  });

  /**
   * Görüşmeye katılma olayı
   */
  socket.on('call:join', async (data) => {
    const { callId } = data;

    try {
      // Görüşmeye katıl
      const room = await measurePerformanceAsync(async () => {
        return await sfu.joinRoom(callId, userId);
      }, 'Görüşmeye katılma');

      if (!room) {
        throw new Error('Görüşmeye katılınamadı');
      }

      // Kullanıcı bilgilerini al
      const user = await userManager.getUserProfile(userId);

      // Görüşmedeki diğer kullanıcılara katılma bilgisini gönder
      socket.to(room.id).emit('call:join', {
        callId,
        user,
      });

      logger.debug('Görüşmeye katıldı', {
        userId,
        username,
        callId,
      });
    } catch (error) {
      logger.error('Görüşmeye katılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
      });

      socket.emit('error', {
        message: 'Görüşmeye katılınamadı',
        code: 'CALL_JOIN_ERROR',
      });
    }
  });

  /**
   * Görüşmeden ayrılma olayı
   */
  socket.on('call:leave', async (data) => {
    const { callId } = data;

    try {
      // Görüşmeden ayrıl
      const success = await measurePerformanceAsync(async () => {
        return await sfu.leaveRoom(callId, userId);
      }, 'Görüşmeden ayrılma');

      if (!success) {
        throw new Error('Görüşmeden ayrılınamadı');
      }

      // Görüşmedeki diğer kullanıcılara ayrılma bilgisini gönder
      socket.to(callId).emit('call:leave', {
        callId,
        userId,
      });

      logger.debug('Görüşmeden ayrıldı', {
        userId,
        username,
        callId,
      });
    } catch (error) {
      logger.error('Görüşmeden ayrılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
      });

      socket.emit('error', {
        message: 'Görüşmeden ayrılınamadı',
        code: 'CALL_LEAVE_ERROR',
      });
    }
  });

  /**
   * Görüşmeyi sonlandırma olayı
   */
  socket.on('call:end', async (data) => {
    const { callId } = data;

    try {
      // Görüşmeyi sonlandır
      const success = await measurePerformanceAsync(async () => {
        return await sfu.closeRoom(callId, userId);
      }, 'Görüşmeyi sonlandırma');

      if (!success) {
        throw new Error('Görüşme sonlandırılamadı');
      }

      // Görüşmedeki diğer kullanıcılara sonlandırma bilgisini gönder
      socket.to(callId).emit('call:end', {
        callId,
      });

      logger.debug('Görüşme sonlandırıldı', {
        userId,
        username,
        callId,
      });
    } catch (error) {
      logger.error('Görüşme sonlandırma hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
      });

      socket.emit('error', {
        message: 'Görüşme sonlandırılamadı',
        code: 'CALL_END_ERROR',
      });
    }
  });

  /**
   * WebRTC sinyalleşme olayı - SDP teklifi
   */
  socket.on('call:signal:offer', async (data) => {
    const { callId, receiverId, sdp } = data;

    try {
      // Teklifi alıcıya ilet
      socket.to(receiverId).emit('call:signal:offer', {
        callId,
        senderId: userId,
        sdp,
      });

      logger.debug('SDP teklifi gönderildi', {
        userId,
        username,
        callId,
        receiverId,
      });
    } catch (error) {
      logger.error('SDP teklifi gönderme hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
        receiverId,
      });

      socket.emit('error', {
        message: 'SDP teklifi gönderilemedi',
        code: 'CALL_SIGNAL_OFFER_ERROR',
      });
    }
  });

  /**
   * WebRTC sinyalleşme olayı - SDP yanıtı
   */
  socket.on('call:signal:answer', async (data) => {
    const { callId, receiverId, sdp } = data;

    try {
      // Yanıtı alıcıya ilet
      socket.to(receiverId).emit('call:signal:answer', {
        callId,
        senderId: userId,
        sdp,
      });

      logger.debug('SDP yanıtı gönderildi', {
        userId,
        username,
        callId,
        receiverId,
      });
    } catch (error) {
      logger.error('SDP yanıtı gönderme hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
        receiverId,
      });

      socket.emit('error', {
        message: 'SDP yanıtı gönderilemedi',
        code: 'CALL_SIGNAL_ANSWER_ERROR',
      });
    }
  });

  /**
   * WebRTC sinyalleşme olayı - ICE adayı
   */
  socket.on('call:signal:ice-candidate', async (data) => {
    const { callId, receiverId, candidate } = data;

    try {
      // ICE adayını alıcıya ilet
      socket.to(receiverId).emit('call:signal:ice-candidate', {
        callId,
        senderId: userId,
        candidate,
      });

      logger.debug('ICE adayı gönderildi', {
        userId,
        username,
        callId,
        receiverId,
      });
    } catch (error) {
      logger.error('ICE adayı gönderme hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
        receiverId,
      });

      socket.emit('error', {
        message: 'ICE adayı gönderilemedi',
        code: 'CALL_SIGNAL_ICE_CANDIDATE_ERROR',
      });
    }
  });

  /**
   * Medya durumu güncelleme olayı
   */
  socket.on('call:media-state', async (data) => {
    const { callId, audio, video } = data;

    try {
      // Medya durumunu güncelle
      const success = await callManager.updateMediaState({
        callId,
        userId,
        audio,
        video,
      });

      if (!success) {
        throw new Error('Medya durumu güncellenemedi');
      }

      // Görüşmedeki diğer kullanıcılara medya durumu bilgisini gönder
      socket.to(callId).emit('call:media-state', {
        callId,
        userId,
        audio,
        video,
      });

      logger.debug('Medya durumu güncellendi', {
        userId,
        username,
        callId,
        audio,
        video,
      });
    } catch (error) {
      logger.error('Medya durumu güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
      });

      socket.emit('error', {
        message: 'Medya durumu güncellenemedi',
        code: 'CALL_MEDIA_STATE_ERROR',
      });
    }
  });

  /**
   * Ekran paylaşımı durumu güncelleme olayı
   */
  socket.on('call:screen-share', async (data) => {
    const { callId, active } = data;

    try {
      // Ekran paylaşımı durumunu güncelle
      const success = await callManager.updateScreenShare({
        callId,
        userId,
        active,
      });

      if (!success) {
        throw new Error('Ekran paylaşımı durumu güncellenemedi');
      }

      // Görüşmedeki diğer kullanıcılara ekran paylaşımı durumu bilgisini gönder
      socket.to(callId).emit('call:screen-share', {
        callId,
        userId,
        active,
      });

      logger.debug('Ekran paylaşımı durumu güncellendi', {
        userId,
        username,
        callId,
        active,
      });
    } catch (error) {
      logger.error('Ekran paylaşımı durumu güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId,
      });

      socket.emit('error', {
        message: 'Ekran paylaşımı durumu güncellenemedi',
        code: 'CALL_SCREEN_SHARE_ERROR',
      });
    }
  });

  /**
   * WebRTC - Router RTP yeteneklerini getir
   */
  socket.on('webrtc:get-router-capabilities', async (data) => {
    const { roomId } = data;

    try {
      // Oda yoksa oluştur
      const routerId = await webRTCService.createRoom(roomId);

      if (!routerId) {
        throw new Error('Router oluşturulamadı');
      }

      // RTP yeteneklerini getir
      const rtpCapabilities = webRTCService.getRtpCapabilities(routerId);

      if (!rtpCapabilities) {
        throw new Error('RTP yetenekleri alınamadı');
      }

      // Kullanıcıyı odaya ekle
      await webRTCService.addPeerToRoom(roomId, userId);

      // RTP yeteneklerini gönder
      socket.emit('webrtc:router-capabilities', {
        roomId,
        rtpCapabilities,
      });

      logger.debug('Router RTP yetenekleri gönderildi', {
        userId,
        username,
        roomId,
      });
    } catch (error) {
      logger.error('Router RTP yetenekleri alma hatası', {
        error: (error as Error).message,
        userId,
        username,
        roomId,
      });

      socket.emit('error', {
        message: 'Router RTP yetenekleri alınamadı',
        code: 'WEBRTC_ROUTER_CAPABILITIES_ERROR',
      });
    }
  });

  /**
   * WebRTC - Transport oluştur
   */
  socket.on('webrtc:create-transport', async (data) => {
    const { roomId, direction, sctpCapabilities } = data;

    try {
      // Oda için router ID'sini bul
      const room = webRTCService.getRoom(roomId);

      if (!room || !room.routerId) {
        throw new Error('Oda bulunamadı');
      }

      // Transport oluştur
      const transportOptions = {
        producing: direction === 'send',
        consuming: direction === 'recv',
        sctpCapabilities: direction === 'send' ? sctpCapabilities : undefined,
      };

      const transport = await webRTCService.createWebRtcTransport(room.routerId, transportOptions);

      if (!transport) {
        throw new Error('Transport oluşturulamadı');
      }

      // Transport bilgilerini gönder
      socket.emit('webrtc:transport-created', {
        roomId,
        direction,
        transportId: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      });

      // Kullanıcının transport'unu kaydet
      webRTCService.addTransportToPeer(roomId, userId, transport.id);

      logger.debug('Transport oluşturuldu', {
        userId,
        username,
        roomId,
        direction,
        transportId: transport.id,
      });
    } catch (error) {
      logger.error('Transport oluşturma hatası', {
        error: (error as Error).message,
        userId,
        username,
        roomId,
        direction,
      });

      socket.emit('error', {
        message: 'Transport oluşturulamadı',
        code: 'WEBRTC_CREATE_TRANSPORT_ERROR',
      });
    }
  });

  /**
   * WebRTC - Transport bağla
   */
  socket.on('webrtc:connect-transport', async (data) => {
    const { transportId, dtlsParameters } = data;

    try {
      // Transport'u bağla
      const success = await webRTCService.connectTransport(transportId, dtlsParameters);

      if (!success) {
        throw new Error('Transport bağlanamadı');
      }

      // Başarı bilgisini gönder
      socket.emit('webrtc:transport-connected', {
        transportId,
      });

      logger.debug('Transport bağlandı', {
        userId,
        username,
        transportId,
      });
    } catch (error) {
      logger.error('Transport bağlama hatası', {
        error: (error as Error).message,
        userId,
        username,
        transportId,
      });

      socket.emit('error', {
        message: 'Transport bağlanamadı',
        code: 'WEBRTC_CONNECT_TRANSPORT_ERROR',
      });
    }
  });

  /**
   * WebRTC - Producer oluştur
   */
  socket.on('webrtc:produce', async (data) => {
    const { transportId, kind, rtpParameters } = data;

    try {
      // Producer oluştur
      const producerId = await webRTCService.createProducer(transportId, rtpParameters, kind);

      if (!producerId) {
        throw new Error('Producer oluşturulamadı');
      }

      // Producer bilgisini gönder
      socket.emit('webrtc:producer-created', {
        transportId,
        producerId,
      });

      // Odadaki diğer kullanıcılara yeni producer bilgisini gönder
      const roomId = webRTCService.getRoomIdByTransportId(transportId);

      if (roomId) {
        // Kullanıcının producer'ını kaydet
        webRTCService.addProducerToPeer(roomId, userId, producerId);

        // Odadaki diğer kullanıcılara bildir
        socket.to(roomId).emit('webrtc:new-producer', {
          roomId,
          producerId,
          producerUserId: userId,
          kind,
        });
      }

      logger.debug('Producer oluşturuldu', {
        userId,
        username,
        transportId,
        producerId,
        kind,
      });
    } catch (error) {
      logger.error('Producer oluşturma hatası', {
        error: (error as Error).message,
        userId,
        username,
        transportId,
        kind,
      });

      socket.emit('error', {
        message: 'Producer oluşturulamadı',
        code: 'WEBRTC_PRODUCE_ERROR',
      });
    }
  });

  /**
   * WebRTC - Consumer oluştur
   */
  socket.on('webrtc:consume', async (data) => {
    const { roomId, transportId, producerId, rtpCapabilities } = data;

    try {
      // Consumer oluştur
      const consumer = await webRTCService.createConsumer(transportId, producerId, rtpCapabilities);

      if (!consumer) {
        throw new Error('Consumer oluşturulamadı');
      }

      // Consumer bilgisini gönder
      socket.emit('webrtc:consumer-created', {
        roomId,
        transportId,
        producerId,
        consumerId: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerUserId: webRTCService.getUserIdByProducerId(producerId),
      });

      // Kullanıcının consumer'ını kaydet
      webRTCService.addConsumerToPeer(roomId, userId, consumer.id);

      logger.debug('Consumer oluşturuldu', {
        userId,
        username,
        roomId,
        transportId,
        producerId,
        consumerId: consumer.id,
      });
    } catch (error) {
      logger.error('Consumer oluşturma hatası', {
        error: (error as Error).message,
        userId,
        username,
        roomId,
        transportId,
        producerId,
      });

      socket.emit('error', {
        message: 'Consumer oluşturulamadı',
        code: 'WEBRTC_CONSUME_ERROR',
      });
    }
  });

  /**
   * WebRTC - Consumer'ı başlat
   */
  socket.on('webrtc:resume-consumer', async (data) => {
    const { consumerId } = data;

    try {
      // Consumer'ı başlat
      const success = await webRTCService.resumeConsumer(consumerId);

      if (!success) {
        throw new Error('Consumer başlatılamadı');
      }

      // Başarı bilgisini gönder
      socket.emit('webrtc:consumer-resumed', {
        consumerId,
      });

      logger.debug('Consumer başlatıldı', {
        userId,
        username,
        consumerId,
      });
    } catch (error) {
      logger.error('Consumer başlatma hatası', {
        error: (error as Error).message,
        userId,
        username,
        consumerId,
      });

      socket.emit('error', {
        message: 'Consumer başlatılamadı',
        code: 'WEBRTC_RESUME_CONSUMER_ERROR',
      });
    }
  });

  /**
   * WebRTC - Odadan ayrıl
   */
  socket.on('webrtc:leave-room', async (data) => {
    const { roomId } = data;

    try {
      // Odadan ayrıl
      const success = await webRTCService.removePeerFromRoom(roomId, userId);

      if (!success) {
        throw new Error('Odadan ayrılınamadı');
      }

      // Başarı bilgisini gönder
      socket.emit('webrtc:room-left', {
        roomId,
      });

      // Odadaki diğer kullanıcılara ayrılma bilgisini gönder
      socket.to(roomId).emit('webrtc:peer-left', {
        roomId,
        userId,
      });

      logger.debug('Odadan ayrıldı', {
        userId,
        username,
        roomId,
      });
    } catch (error) {
      logger.error('Odadan ayrılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        roomId,
      });

      socket.emit('error', {
        message: 'Odadan ayrılınamadı',
        code: 'WEBRTC_LEAVE_ROOM_ERROR',
      });
    }
  });
}
