/**
 * public/js/call.ts
 * Görüntülü görüşme işlevleri
 */
import {
  getUserMedia,
  getDisplayMedia,
  createOffer,
  createAnswer,
  addIceCandidate,
  closePeerConnection,
  closeAllPeerConnections,
  stopLocalMediaStream,
  stopScreenShareStream,
} from './webrtc';

// Görüşme durumu
let isInCall = false;
let currentCallId: string | null = null;
let currentChannelId: string | null = null;
let localStream: MediaStream | null = null;
let screenShareStream: MediaStream | null = null;
let participants: Map<string, any> = new Map();
let mediaState = {
  audio: true,
  video: true,
  screenShare: false,
};

// UI elementleri
let callContainer: HTMLElement | null = null;
let localVideo: HTMLVideoElement | null = null;
let remoteVideosContainer: HTMLElement | null = null;
let callControls: HTMLElement | null = null;
let micButton: HTMLElement | null = null;
let cameraButton: HTMLElement | null = null;
let screenShareButton: HTMLElement | null = null;
let endCallButton: HTMLElement | null = null;

/**
 * Görüntülü görüşme modülünü başlatır
 */
export function initCallModule(): void {
  // UI elementlerini al
  callContainer = document.getElementById('call-container');
  localVideo = document.getElementById('local-video') as HTMLVideoElement;
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
function setupSocketEvents(): void {
  // Görüşme başlatma olayı
  window.socket.on('call:start', (data) => {
    console.log('Görüşme başlatıldı', data);
    
    // Görüşme bilgilerini kaydet
    currentCallId = data.callId;
    
    // UI'ı güncelle
    showCallUI();
    
    // Katılımcıları ekle
    data.participants.forEach((participant: any) => {
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
    const answer = await createAnswer(data.senderId, data.sdp);
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
    const peerConnection = window.peerConnections.get(data.senderId);
    if (peerConnection) {
      // Uzak açıklamayı ayarla
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  });

  window.socket.on('call:signal:ice-candidate', (data) => {
    console.log('ICE adayı alındı', data);
    
    // ICE adayını ekle
    addIceCandidate(data.senderId, data.candidate);
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
export async function startCall(channelId: string): Promise<void> {
  try {
    // Eğer zaten görüşmedeyse, çık
    if (isInCall) {
      console.warn('Zaten bir görüşmedesiniz');
      return;
    }

    // Kanal ID'yi kaydet
    currentChannelId = channelId;

    // Medya akışını al
    localStream = await getUserMedia();
    if (!localStream) {
      throw new Error('Medya akışı alınamadı');
    }

    // Yerel videoyu göster
    if (localVideo) {
      localVideo.srcObject = localStream;
    }

    // Görüşme başlat
    window.socket.emit('call:start', { channelId }, (response: any) => {
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
export async function joinCall(callId: string): Promise<void> {
  try {
    // Eğer zaten görüşmedeyse, çık
    if (isInCall) {
      console.warn('Zaten bir görüşmedesiniz');
      return;
    }

    // Görüşme ID'yi kaydet
    currentCallId = callId;

    // Medya akışını al
    localStream = await getUserMedia();
    if (!localStream) {
      throw new Error('Medya akışı alınamadı');
    }

    // Yerel videoyu göster
    if (localVideo) {
      localVideo.srcObject = localStream;
    }

    // Görüşmeye katıl
    window.socket.emit('call:join', { callId }, (response: any) => {
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
export function leaveCall(): void {
  try {
    // Eğer görüşmede değilse, çık
    if (!isInCall || !currentCallId) {
      return;
    }

    // Görüşmeden ayrıl
    window.socket.emit('call:leave', { callId: currentCallId }, (response: any) => {
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
export function endCall(): void {
  try {
    // Eğer görüşmede değilse, çık
    if (!isInCall || !currentCallId) {
      return;
    }

    // Görüşmeyi sonlandır
    window.socket.emit('call:end', { callId: currentCallId }, (response: any) => {
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

/**
 * Görüşmeyi temizler
 */
function cleanupCall(): void {
  // Görüşme durumunu sıfırla
  isInCall = false;
  currentCallId = null;
  currentChannelId = null;

  // Medya akışlarını durdur
  stopLocalMediaStream();
  stopScreenShareStream();

  // WebRTC bağlantılarını kapat
  closeAllPeerConnections();

  // Katılımcıları temizle
  participants.clear();

  // UI'ı güncelle
  hideCallUI();
}

/**
 * Mikrofonu açar/kapatır
 */
function toggleMic(): void {
  if (!localStream) return;

  // Mikrofon durumunu değiştir
  mediaState.audio = !mediaState.audio;

  // Yerel akıştaki ses parçalarını güncelle
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = mediaState.audio;
  });

  // UI'ı güncelle
  updateMicButtonUI();

  // Medya durumunu güncelle
  updateMediaState();
}

/**
 * Kamerayı açar/kapatır
 */
function toggleCamera(): void {
  if (!localStream) return;

  // Kamera durumunu değiştir
  mediaState.video = !mediaState.video;

  // Yerel akıştaki video parçalarını güncelle
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = mediaState.video;
  });

  // UI'ı güncelle
  updateCameraButtonUI();

  // Medya durumunu güncelle
  updateMediaState();
}

/**
 * Ekran paylaşımını açar/kapatır
 */
async function toggleScreenShare(): void {
  try {
    // Ekran paylaşımı durumunu değiştir
    mediaState.screenShare = !mediaState.screenShare;

    if (mediaState.screenShare) {
      // Ekran paylaşımı akışını al
      screenShareStream = await getDisplayMedia();
      if (!screenShareStream) {
        throw new Error('Ekran paylaşımı akışı alınamadı');
      }

      // Ekran paylaşımı akışını tüm bağlantılara ekle
      for (const userId of participants.keys()) {
        const peerConnection = window.peerConnections.get(userId);
        if (peerConnection) {
          screenShareStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, screenShareStream!);
          });
        }
      }
    } else {
      // Ekran paylaşımı akışını durdur
      stopScreenShareStream();
    }

    // UI'ı güncelle
    updateScreenShareButtonUI();

    // Ekran paylaşımı durumunu güncelle
    updateScreenShareState();
  } catch (error) {
    console.error('Ekran paylaşımı hatası', error);
    mediaState.screenShare = false;
    updateScreenShareButtonUI();
  }
}

/**
 * Medya durumunu günceller
 */
function updateMediaState(): void {
  if (!currentCallId) return;

  // Medya durumunu güncelle
  window.socket.emit('call:media-state', {
    callId: currentCallId,
    audio: mediaState.audio,
    video: mediaState.video,
  });
}

/**
 * Ekran paylaşımı durumunu günceller
 */
function updateScreenShareState(): void {
  if (!currentCallId) return;

  // Ekran paylaşımı durumunu güncelle
  window.socket.emit('call:screen-share', {
    callId: currentCallId,
    active: mediaState.screenShare,
  });
}

// UI işlevleri
function showCallUI(): void {
  if (callContainer) {
    callContainer.classList.remove('hidden');
  }
}

function hideCallUI(): void {
  if (callContainer) {
    callContainer.classList.add('hidden');
  }
}

function updateMicButtonUI(): void {
  if (micButton) {
    if (mediaState.audio) {
      micButton.classList.remove('muted');
      micButton.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
      micButton.classList.add('muted');
      micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
  }
}

function updateCameraButtonUI(): void {
  if (cameraButton) {
    if (mediaState.video) {
      cameraButton.classList.remove('muted');
      cameraButton.innerHTML = '<i class="fas fa-video"></i>';
    } else {
      cameraButton.classList.add('muted');
      cameraButton.innerHTML = '<i class="fas fa-video-slash"></i>';
    }
  }
}

function updateScreenShareButtonUI(): void {
  if (screenShareButton) {
    if (mediaState.screenShare) {
      screenShareButton.classList.add('active');
      screenShareButton.innerHTML = '<i class="fas fa-desktop"></i>';
    } else {
      screenShareButton.classList.remove('active');
      screenShareButton.innerHTML = '<i class="fas fa-desktop"></i>';
    }
  }
}

// Katılımcı işlevleri
function addParticipant(participant: any): void {
  participants.set(participant.id, participant);
}

function removeParticipant(userId: string): void {
  participants.delete(userId);
  closePeerConnection(userId);
  
  // Video elementini kaldır
  const videoElement = document.getElementById(`remote-video-${userId}`);
  if (videoElement && videoElement.parentNode) {
    videoElement.parentNode.removeChild(videoElement);
  }
}

function updateParticipantMediaState(userId: string, audio: boolean, video: boolean): void {
  const participant = participants.get(userId);
  if (participant) {
    participant.mediaState = { ...participant.mediaState, audio, video };
    participants.set(userId, participant);
  }
}

function updateParticipantScreenShare(userId: string, active: boolean): void {
  const participant = participants.get(userId);
  if (participant) {
    participant.mediaState = { ...participant.mediaState, screenShare: active };
    participants.set(userId, participant);
  }
}

async function sendOfferToNewParticipant(userId: string): Promise<void> {
  try {
    // Teklif oluştur
    const offer = await createOffer(userId);
    if (!offer) {
      throw new Error('SDP teklifi oluşturulamadı');
    }

    // Teklifi gönder
    window.socket.emit('call:signal:offer', {
      callId: currentCallId,
      receiverId: userId,
      sdp: offer,
    });
  } catch (error) {
    console.error('Teklif gönderilirken hata oluştu', error);
  }
}

// Dışa aktarılan nesneler
export default {
  initCallModule,
  startCall,
  joinCall,
  leaveCall,
  endCall,
};
