/**
 * public/js/webrtc.js
 * WebRTC işlevleri
 */

// WebRTC bağlantıları
const peerConnections = new Map();

// Medya akışları
let localStream = null;
let localScreenStream = null;

// ICE sunucu yapılandırması
const iceServers = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
    ],
  },
];

// WebRTC bağlantı seçenekleri
const rtcConfig = {
  iceServers,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  sdpSemantics: 'unified-plan',
};

// Medya kısıtlamaları
const defaultMediaConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
};

// Ekran paylaşımı kısıtlamaları
const screenShareConstraints = {
  video: {
    cursor: 'always',
    displaySurface: 'monitor',
    logicalSurface: true,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { max: 30 },
  },
  audio: false,
};

/**
 * Kullanıcı medya akışını alır
 * @param constraints Medya kısıtlamaları
 * @returns Medya akışı
 */
async function getUserMedia(constraints = defaultMediaConstraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream = stream;
    return stream;
  } catch (error) {
    console.error('Medya akışı alınamadı', error);
    return null;
  }
}

/**
 * Ekran paylaşımı akışını alır
 * @returns Ekran paylaşımı akışı
 */
async function getDisplayMedia() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(screenShareConstraints);
    localScreenStream = stream;
    return stream;
  } catch (error) {
    console.error('Ekran paylaşımı akışı alınamadı', error);
    return null;
  }
}

/**
 * WebRTC bağlantısı oluşturur
 * @param userId Kullanıcı ID
 * @returns WebRTC bağlantısı
 */
function createPeerConnection(userId) {
  // Eğer zaten bir bağlantı varsa, onu kullan
  if (peerConnections.has(userId)) {
    return peerConnections.get(userId);
  }

  // Yeni bağlantı oluştur
  const peerConnection = new RTCPeerConnection(rtcConfig);

  // ICE aday olayı
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      // ICE adayını karşı tarafa gönder
      const candidate = event.candidate;
      // Socket.IO ile gönder
      window.socket.emit('call:signal:ice-candidate', {
        callId: window.currentCallId,
        receiverId: userId,
        candidate,
      });
    }
  };

  // ICE bağlantı durumu değişikliği olayı
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE bağlantı durumu (${userId}):`, peerConnection.iceConnectionState);
  };

  // Sinyal durumu değişikliği olayı
  peerConnection.onsignalingstatechange = () => {
    console.log(`Sinyal durumu (${userId}):`, peerConnection.signalingState);
  };

  // Uzak akış olayı
  peerConnection.ontrack = (event) => {
    console.log(`Uzak akış alındı (${userId})`);
    // Uzak akışı UI'a ekle
    const remoteStream = event.streams[0];
    addRemoteStreamToUI(userId, remoteStream);
  };

  // Bağlantıyı kaydet
  peerConnections.set(userId, peerConnection);

  return peerConnection;
}

/**
 * SDP teklifini oluşturur
 * @param userId Kullanıcı ID
 * @returns SDP teklifi
 */
async function createOffer(userId) {
  try {
    // Bağlantıyı al veya oluştur
    const peerConnection = createPeerConnection(userId);

    // Yerel akışı ekle
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Teklifi oluştur
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    // Yerel açıklamayı ayarla
    await peerConnection.setLocalDescription(offer);

    return offer;
  } catch (error) {
    console.error('SDP teklifi oluşturulamadı', error);
    return null;
  }
}

/**
 * SDP yanıtını oluşturur
 * @param userId Kullanıcı ID
 * @param offer SDP teklifi
 * @returns SDP yanıtı
 */
async function createAnswer(userId, offer) {
  try {
    // Bağlantıyı al veya oluştur
    const peerConnection = createPeerConnection(userId);

    // Yerel akışı ekle
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Uzak açıklamayı ayarla
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Yanıtı oluştur
    const answer = await peerConnection.createAnswer();

    // Yerel açıklamayı ayarla
    await peerConnection.setLocalDescription(answer);

    return answer;
  } catch (error) {
    console.error('SDP yanıtı oluşturulamadı', error);
    return null;
  }
}

/**
 * ICE adayını ekler
 * @param userId Kullanıcı ID
 * @param candidate ICE adayı
 */
async function addIceCandidate(userId, candidate) {
  try {
    // Bağlantıyı al
    const peerConnection = peerConnections.get(userId);
    if (!peerConnection) {
      console.error('Bağlantı bulunamadı', userId);
      return;
    }

    // ICE adayını ekle
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('ICE adayı eklenemedi', error);
  }
}

/**
 * Bağlantıyı kapatır
 * @param userId Kullanıcı ID
 */
function closePeerConnection(userId) {
  // Bağlantıyı al
  const peerConnection = peerConnections.get(userId);
  if (!peerConnection) {
    return;
  }

  // Bağlantıyı kapat
  peerConnection.onicecandidate = null;
  peerConnection.ontrack = null;
  peerConnection.onnegotiationneeded = null;
  peerConnection.oniceconnectionstatechange = null;
  peerConnection.onsignalingstatechange = null;
  peerConnection.onicegatheringstatechange = null;
  peerConnection.onconnectionstatechange = null;
  peerConnection.close();

  // Bağlantıyı kaldır
  peerConnections.delete(userId);
}

/**
 * Tüm bağlantıları kapatır
 */
function closeAllPeerConnections() {
  // Tüm bağlantıları kapat
  for (const userId of peerConnections.keys()) {
    closePeerConnection(userId);
  }
}

/**
 * Medya akışını durdurur
 * @param stream Medya akışı
 */
function stopMediaStream(stream) {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
}

/**
 * Yerel medya akışını durdurur
 */
function stopLocalMediaStream() {
  stopMediaStream(localStream);
  localStream = null;
}

/**
 * Ekran paylaşımı akışını durdurur
 */
function stopScreenShareStream() {
  stopMediaStream(localScreenStream);
  localScreenStream = null;
}

/**
 * Uzak akışı UI'a ekler
 * @param userId Kullanıcı ID
 * @param stream Medya akışı
 */
function addRemoteStreamToUI(userId, stream) {
  // Video elementini bul veya oluştur
  let videoElement = document.getElementById(`remote-video-${userId}`);
  if (!videoElement) {
    videoElement = document.createElement('video');
    videoElement.id = `remote-video-${userId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.className = 'remote-video';
    
    // Video konteynırını bul
    const videoContainer = document.getElementById('remote-videos-container');
    if (videoContainer) {
      videoContainer.appendChild(videoElement);
    } else {
      console.error('Video konteynırı bulunamadı');
    }
  }

  // Akışı video elementine ekle
  videoElement.srcObject = stream;
}

// Global nesnelere ekle
window.webrtcModule = {
  getUserMedia,
  getDisplayMedia,
  createPeerConnection,
  createOffer,
  createAnswer,
  addIceCandidate,
  closePeerConnection,
  closeAllPeerConnections,
  stopMediaStream,
  stopLocalMediaStream,
  stopScreenShareStream,
};
