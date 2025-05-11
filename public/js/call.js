/**
 * public/js/call.js
 * Görüntülü görüşme işlevleri
 */

// Görüşme durumu
let isInCall = false;
let currentCallId = null;
let currentChannelId = null;
let callLocalStream = null;
let screenShareStream = null;
let participants = new Map();
let mediaState = {
  audio: true,
  video: true,
  screenShare: false,
};

// UI elementleri
let callContainer = null;
let localVideo = null;
let remoteVideosContainer = null;
let callControls = null;
let micButton = null;
let cameraButton = null;
let screenShareButton = null;
let endCallButton = null;

/**
 * Görüntülü görüşme modülünü başlatır
 */
function initCallModule() {
  // UI elementlerini al
  callContainer = document.getElementById('call-container');
  localVideo = document.getElementById('local-video');
  remoteVideosContainer = document.getElementById('remote-videos-container');
  callControls = document.getElementById('call-controls');
  micButton = document.getElementById('mic-button');
  cameraButton = document.getElementById('camera-button');
  screenShareButton = document.getElementById('screen-share-button');
  endCallButton = document.getElementById('end-call-button');

  // Buton olaylarını ekle
  if (micButton) {
    micButton.addEventListener('click', toggleMic);
  }
  if (cameraButton) {
    cameraButton.addEventListener('click', toggleCamera);
  }
  if (screenShareButton) {
    screenShareButton.addEventListener('click', toggleScreenShare);
  }
  if (endCallButton) {
    endCallButton.addEventListener('click', endCall);
  }

  // Socket.IO olaylarını dinle
  setupSocketEvents();
}

/**
 * Socket.IO olaylarını ayarlar
 */
function setupSocketEvents() {
  if (!window.socket) {
    console.error('Socket.IO bağlantısı bulunamadı');
    return;
  }

  // Görüşme başlatma olayı
  window.socket.on('call:start', (data) => {
    console.log('Görüşme başlatıldı', data);

    // Görüşme bilgilerini kaydet
    currentCallId = data.callId;

    // UI'ı güncelle
    showCallUI();

    // Katılımcıları ekle
    data.participants.forEach((participant) => {
      addParticipant(participant);
    });
  });

  // Görüşmeye katılma olayı
  window.socket.on('call:join', (data) => {
    console.log('Kullanıcı görüşmeye katıldı', data);

    // Katılımcıyı ekle
    addParticipant(data.user);

    // Yeni katılımcıya teklif gönder
    sendOfferToNewParticipant(data.user.id);
  });

  // Görüşmeden ayrılma olayı
  window.socket.on('call:leave', (data) => {
    console.log('Kullanıcı görüşmeden ayrıldı', data);

    // Katılımcıyı kaldır
    removeParticipant(data.userId);
  });

  // Görüşme sonlandırma olayı
  window.socket.on('call:end', (data) => {
    console.log('Görüşme sonlandırıldı', data);

    // Görüşmeyi temizle
    cleanupCall();
  });

  // WebRTC sinyalleşme olayları
  window.socket.on('call:signal:offer', async (data) => {
    console.log('SDP teklifi alındı', data);

    // Yanıt oluştur ve gönder
    const answer = await window.webrtcModule.createAnswer(data.senderId, data.sdp);
    if (answer) {
      window.socket.emit('call:signal:answer', {
        callId: currentCallId,
        receiverId: data.senderId,
        sdp: answer,
      });
    }
  });

  window.socket.on('call:signal:answer', (data) => {
    console.log('SDP yanıtı alındı', data);

    // Bağlantıyı al
    const peerConnection = window.peerConnections ? window.peerConnections.get(data.senderId) : null;
    if (peerConnection) {
      // Uzak açıklamayı ayarla
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  });

  window.socket.on('call:signal:ice-candidate', (data) => {
    console.log('ICE adayı alındı', data);

    // ICE adayını ekle
    window.webrtcModule.addIceCandidate(data.senderId, data.candidate);
  });

  window.socket.on('call:media-state', (data) => {
    console.log('Medya durumu güncellendi', data);

    // Katılımcının medya durumunu güncelle
    updateParticipantMediaState(data.userId, data.audio, data.video);
  });

  window.socket.on('call:screen-share', (data) => {
    console.log('Ekran paylaşımı durumu güncellendi', data);

    // Katılımcının ekran paylaşımı durumunu güncelle
    updateParticipantScreenShare(data.userId, data.active);
  });
}

/**
 * Görüşme başlatır
 * @param channelId Kanal ID
 */
async function startCall(channelId) {
  try {
    // Eğer zaten görüşmedeyse, çık
    if (isInCall) {
      console.warn('Zaten bir görüşmedesiniz');
      return;
    }

    // Kanal ID'yi kaydet
    currentChannelId = channelId;

    // Medya akışını al
    callLocalStream = await window.webrtcModule.getUserMedia();
    if (!callLocalStream) {
      throw new Error('Medya akışı alınamadı');
    }

    // Yerel videoyu göster
    if (localVideo) {
      localVideo.srcObject = callLocalStream;
    }

    // Görüşme başlat
    window.socket.emit('call:start', { channelId }, (response) => {
      if (response.error) {
        throw new Error(response.error.message);
      }

      // Görüşme bilgilerini kaydet
      currentCallId = response.data.callId;
      isInCall = true;

      // UI'ı güncelle
      showCallUI();

      console.log('Görüşme başlatıldı', response.data);
    });
  } catch (error) {
    console.error('Görüşme başlatılamadı', error);
    cleanupCall();
  }
}

/**
 * Görüşmeye katılır
 * @param callId Görüşme ID
 */
async function joinCall(callId) {
  try {
    // Eğer zaten görüşmedeyse, çık
    if (isInCall) {
      console.warn('Zaten bir görüşmedesiniz');
      return;
    }

    // Görüşme ID'yi kaydet
    currentCallId = callId;

    // Medya akışını al
    callLocalStream = await window.webrtcModule.getUserMedia();
    if (!callLocalStream) {
      throw new Error('Medya akışı alınamadı');
    }

    // Yerel videoyu göster
    if (localVideo) {
      localVideo.srcObject = callLocalStream;
    }

    // Görüşmeye katıl
    window.socket.emit('call:join', { callId }, (response) => {
      if (response.error) {
        throw new Error(response.error.message);
      }

      // Görüşme bilgilerini kaydet
      isInCall = true;

      // UI'ı güncelle
      showCallUI();

      console.log('Görüşmeye katıldı', response.data);
    });
  } catch (error) {
    console.error('Görüşmeye katılınamadı', error);
    cleanupCall();
  }
}

/**
 * Görüşmeden ayrılır
 */
function leaveCall() {
  try {
    // Eğer görüşmede değilse, çık
    if (!isInCall || !currentCallId) {
      return;
    }

    // Görüşmeden ayrıl
    window.socket.emit('call:leave', { callId: currentCallId }, (response) => {
      if (response.error) {
        console.error('Görüşmeden ayrılırken hata oluştu', response.error);
      }

      // Görüşmeyi temizle
      cleanupCall();

      console.log('Görüşmeden ayrıldı');
    });
  } catch (error) {
    console.error('Görüşmeden ayrılırken hata oluştu', error);
    cleanupCall();
  }
}

/**
 * Görüşmeyi sonlandırır
 */
function endCall() {
  try {
    // Eğer görüşmede değilse, çık
    if (!isInCall || !currentCallId) {
      return;
    }

    // Görüşmeyi sonlandır
    window.socket.emit('call:end', { callId: currentCallId }, (response) => {
      if (response.error) {
        console.error('Görüşme sonlandırılırken hata oluştu', response.error);
      }

      // Görüşmeyi temizle
      cleanupCall();

      console.log('Görüşme sonlandırıldı');
    });
  } catch (error) {
    console.error('Görüşme sonlandırılırken hata oluştu', error);
    cleanupCall();
  }
}

// Global nesnelere ekle
window.callModule = {
  initCallModule,
  startCall,
  joinCall,
  leaveCall,
  endCall
};
