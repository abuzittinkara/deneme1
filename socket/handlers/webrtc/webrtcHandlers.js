/**************************************
 * socket/handlers/webrtc/webrtcHandlers.js
 * WebRTC/Mediasoup ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * WebRTC socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerWebRTCHandlers(socket, io, deps) {
  const { 
    users, 
    groups, 
    mediasoupManager
  } = deps;

  // RTP yeteneklerini getirme olayı
  socket.on('getRtpCapabilities', (callback) => {
    try {
      const rtpCapabilities = mediasoupManager.getRtpCapabilities();
      callback({ success: true, rtpCapabilities });
      
      logger.debug('RTP yetenekleri gönderildi', { socketId: socket.id });
    } catch (err) {
      handleSocketError(err, "RTP yetenekleri getirme hatası", socket, callback);
    }
  });

  // WebRTC transport oluşturma olayı
  socket.on('createWebRtcTransport', async (data, callback) => {
    try {
      const { direction } = data;
      const userData = users[socket.id];
      
      if (!userData) {
        return callback({ success: false, message: "Kullanıcı verisi bulunamadı." });
      }
      
      const { currentGroup, currentRoom } = userData;
      
      if (!currentGroup || !currentRoom) {
        return callback({ success: false, message: "Aktif bir ses kanalında değilsiniz." });
      }
      
      if (!groups[currentGroup] || !groups[currentGroup].rooms[currentRoom]) {
        return callback({ success: false, message: "Kanal bulunamadı." });
      }
      
      if (groups[currentGroup].rooms[currentRoom].type !== 'voice') {
        return callback({ success: false, message: "Bu bir ses kanalı değil." });
      }
      
      // Transport oluştur
      const transport = await mediasoupManager.createWebRtcTransport(socket.id, direction);
      
      callback({
        success: true,
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        }
      });
      
      logger.debug('WebRTC transport oluşturuldu', { 
        socketId: socket.id, 
        direction,
        transportId: transport.id
      });
    } catch (err) {
      handleSocketError(err, "WebRTC transport oluşturma hatası", socket, callback);
    }
  });

  // Transport bağlama olayı
  socket.on('connectWebRtcTransport', async (data, callback) => {
    try {
      const { transportId, dtlsParameters } = data;
      
      await mediasoupManager.connectWebRtcTransport(socket.id, transportId, dtlsParameters);
      
      callback({ success: true });
      
      logger.debug('WebRTC transport bağlandı', { 
        socketId: socket.id, 
        transportId
      });
    } catch (err) {
      handleSocketError(err, "WebRTC transport bağlama hatası", socket, callback);
    }
  });

  // Produce olayı (ses/video gönderme)
  socket.on('produce', async (data, callback) => {
    try {
      const { transportId, kind, rtpParameters, appData } = data;
      const userData = users[socket.id];
      
      if (!userData) {
        return callback({ success: false, message: "Kullanıcı verisi bulunamadı." });
      }
      
      const { currentGroup, currentRoom } = userData;
      
      if (!currentGroup || !currentRoom) {
        return callback({ success: false, message: "Aktif bir ses kanalında değilsiniz." });
      }
      
      // Producer oluştur
      const producer = await mediasoupManager.produce(
        socket.id,
        transportId,
        kind,
        rtpParameters,
        appData
      );
      
      // Ekran paylaşımı ise, kullanıcı verisini güncelle
      if (appData && appData.source === 'screen') {
        userData.isScreenSharing = true;
        userData.screenShareProducerId = producer.id;
      }
      
      // Kanaldaki diğer kullanıcılara bildir
      socket.to(`${currentGroup}::${currentRoom}`).emit('newProducer', {
        producerId: producer.id,
        socketId: socket.id,
        kind,
        username: userData.username,
        appData
      });
      
      callback({ success: true, id: producer.id });
      
      logger.info('Producer oluşturuldu', { 
        socketId: socket.id, 
        kind,
        producerId: producer.id,
        source: appData?.source || 'unknown'
      });
    } catch (err) {
      handleSocketError(err, "Producer oluşturma hatası", socket, callback);
    }
  });

  // Consume olayı (ses/video alma)
  socket.on('consume', async (data, callback) => {
    try {
      const { transportId, producerId, rtpCapabilities } = data;
      const userData = users[socket.id];
      
      if (!userData) {
        return callback({ success: false, message: "Kullanıcı verisi bulunamadı." });
      }
      
      // Consumer oluştur
      const consumer = await mediasoupManager.consume(
        socket.id,
        transportId,
        producerId,
        rtpCapabilities
      );
      
      callback({
        success: true,
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      });
      
      logger.debug('Consumer oluşturuldu', { 
        socketId: socket.id, 
        consumerId: consumer.id,
        producerId
      });
    } catch (err) {
      handleSocketError(err, "Consumer oluşturma hatası", socket, callback);
    }
  });

  // Consumer'ı devam ettirme olayı
  socket.on('resumeConsumer', async (data, callback) => {
    try {
      const { consumerId } = data;
      
      await mediasoupManager.resumeConsumer(socket.id, consumerId);
      
      callback({ success: true });
      
      logger.debug('Consumer devam ettirildi', { 
        socketId: socket.id, 
        consumerId
      });
    } catch (err) {
      handleSocketError(err, "Consumer devam ettirme hatası", socket, callback);
    }
  });

  // Producer'ı kapatma olayı
  socket.on('closeProducer', async (data, callback) => {
    try {
      const { producerId } = data;
      const userData = users[socket.id];
      
      if (!userData) {
        return callback({ success: false, message: "Kullanıcı verisi bulunamadı." });
      }
      
      const { currentGroup, currentRoom } = userData;
      
      // Producer'ı kapat
      await mediasoupManager.closeProducer(socket.id, producerId);
      
      // Ekran paylaşımı ise, kullanıcı verisini güncelle
      if (userData.screenShareProducerId === producerId) {
        userData.isScreenSharing = false;
        userData.screenShareProducerId = null;
      }
      
      // Kanaldaki diğer kullanıcılara bildir
      if (currentGroup && currentRoom) {
        socket.to(`${currentGroup}::${currentRoom}`).emit('producerClosed', {
          producerId,
          socketId: socket.id
        });
      }
      
      callback({ success: true });
      
      logger.info('Producer kapatıldı', { 
        socketId: socket.id, 
        producerId
      });
    } catch (err) {
      handleSocketError(err, "Producer kapatma hatası", socket, callback);
    }
  });

  // Ses seviyesi değişikliği olayı
  socket.on('audioLevelChanged', (data) => {
    try {
      const { level } = data;
      const userData = users[socket.id];
      
      if (!userData) return;
      
      const { currentGroup, currentRoom } = userData;
      
      if (!currentGroup || !currentRoom) return;
      
      // Ses seviyesi çok düşükse gönderme
      if (level < -50) return;
      
      // Kanaldaki diğer kullanıcılara bildir
      socket.to(`${currentGroup}::${currentRoom}`).emit('userAudioLevel', {
        socketId: socket.id,
        username: userData.username,
        level
      });
      
      logger.debug('Ses seviyesi değişti', { 
        socketId: socket.id, 
        level
      });
    } catch (err) {
      logger.error('Ses seviyesi değişikliği hatası', { 
        error: err.message, 
        socketId: socket.id 
      });
    }
  });
}

module.exports = registerWebRTCHandlers;
