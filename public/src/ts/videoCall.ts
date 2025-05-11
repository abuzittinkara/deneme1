/**
 * public/src/ts/videoCall.ts
 * Video görüşme işlevselliği
 * MediaSoup ve WebRTC kullanarak video iletişimi sağlar
 */

import { socket } from './socket';
import * as mediasoupClient from './mediasoupClient';

// Video görüşme durumu
interface VideoCallState {
  isActive: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  localVideo: HTMLVideoElement | null;
  remoteVideos: Map<string, HTMLVideoElement>;
  currentCamera: string;
  availableCameras: MediaDeviceInfo[];
  currentQuality: string;
  roomId: string | null;
  mediasoup: {
    device: any | null;
    sendTransport: any | null;
    recvTransport: any | null;
    producers: Map<string, any>;
    consumers: Map<string, any>;
  };
  screenShare: {
    active: boolean;
    stream: MediaStream | null;
    producer: any | null;
  };
}

// Video görüşme ayarları
interface VideoCallSettings {
  lowQuality: MediaTrackConstraints;
  mediumQuality: MediaTrackConstraints;
  highQuality: MediaTrackConstraints;
}

// Video görüşme durumu
const videoCallState: VideoCallState = {
  isActive: false,
  localStream: null,
  remoteStreams: new Map(),
  localVideo: null,
  remoteVideos: new Map(),
  currentCamera: 'user',
  availableCameras: [],
  currentQuality: 'medium',
  roomId: null,
  mediasoup: {
    device: null,
    sendTransport: null,
    recvTransport: null,
    producers: new Map(),
    consumers: new Map()
  },
  screenShare: {
    active: false,
    stream: null,
    producer: null
  }
};

// Video görüşme ayarları
const videoCallSettings: VideoCallSettings = {
  lowQuality: {
    width: { ideal: 320 },
    height: { ideal: 240 },
    frameRate: { max: 15 }
  },
  mediumQuality: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { max: 30 }
  },
  highQuality: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { max: 30 }
  }
};

/**
 * Video görüşmeyi başlatır
 * @param roomId Oda ID
 */
export async function startVideoCall(roomId: string): Promise<void> {
  try {
    // Eğer zaten aktif bir görüşme varsa, durdur
    if (videoCallState.isActive) {
      await stopVideoCall();
    }

    // Oda ID'sini kaydet
    videoCallState.roomId = roomId;

    // Kullanılabilir kameraları al
    await getAvailableCameras();

    // Yerel video akışını al
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: getCurrentQualitySettings()
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoCallState.localStream = stream;

    // Yerel video elementini ayarla
    const localVideo = document.getElementById('local-video') as HTMLVideoElement;
    if (localVideo) {
      localVideo.srcObject = stream;
      localVideo.muted = true; // Kendi sesini duymaması için
      localVideo.play().catch(error => console.error('Yerel video oynatma hatası:', error));
      videoCallState.localVideo = localVideo;
    }

    // MediaSoup entegrasyonu
    try {
      // Router yeteneklerini al
      const { routerRtpCapabilities } = await socket.emitWithAck('mediasoup:get-router-capabilities', {
        roomId
      });

      // MediaSoup cihazını yükle
      const deviceLoaded = await mediasoupClient.loadDevice(routerRtpCapabilities);
      if (!deviceLoaded) {
        console.error('MediaSoup cihazı yüklenemedi');
        throw new Error('MediaSoup cihazı yüklenemedi');
      }

      // MediaSoup durumunu güncelle
      videoCallState.mediasoup.device = mediasoupClient.getMediasoupState().device;

      // Gönderme transportu oluştur
      const { id, iceParameters, iceCandidates, dtlsParameters } = await socket.emitWithAck('mediasoup:create-transport', {
        roomId,
        producing: true
      });

      // Gönderme transportunu oluştur
      const sendTransportId = await mediasoupClient.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        appData: { roomId }
      });

      if (sendTransportId) {
        // Transport'u kaydet
        videoCallState.mediasoup.sendTransport = mediasoupClient.getMediasoupState().sendTransport;

        // Alma transportu oluştur
        const recvTransportData = await socket.emitWithAck('mediasoup:create-transport', {
          roomId,
          producing: false,
          consuming: true
        });

        // Alma transportunu oluştur
        const recvTransportId = await mediasoupClient.createRecvTransport({
          id: recvTransportData.id,
          iceParameters: recvTransportData.iceParameters,
          iceCandidates: recvTransportData.iceCandidates,
          dtlsParameters: recvTransportData.dtlsParameters,
          appData: { roomId }
        });

        if (recvTransportId) {
          // Transport'u kaydet
          videoCallState.mediasoup.recvTransport = mediasoupClient.getMediasoupState().recvTransport;

          // Medya parçalarını üret
          if (videoCallState.localStream) {
            // Ses parçasını üret
            const audioTrack = videoCallState.localStream.getAudioTracks()[0];
            if (audioTrack) {
              const audioProducerId = await mediasoupClient.produce(audioTrack, {
                codecOptions: {
                  opusStereo: false,
                  opusDtx: true,
                  opusFec: true,
                  opusNack: true
                }
              });

              if (audioProducerId) {
                console.log('Ses üreticisi oluşturuldu:', audioProducerId);
              }
            }

            // Video parçasını üret
            const videoTrack = videoCallState.localStream.getVideoTracks()[0];
            if (videoTrack) {
              const videoProducerId = await mediasoupClient.produce(videoTrack, {
                codecOptions: {
                  videoGoogleStartBitrate: 1000
                },
                simulcast: true
              });

              if (videoProducerId) {
                console.log('Video üreticisi oluşturuldu:', videoProducerId);
              }
            }

            // Odadaki diğer kullanıcıların üreticilerini tüket
            const { producers } = await socket.emitWithAck('mediasoup:get-producers', {
              roomId
            });

            if (producers && producers.length > 0) {
              await consumeAllProducers(producers);
            }
          }
        }
      }
    } catch (mediasoupError) {
      console.error('MediaSoup entegrasyonu sırasında hata oluştu:', mediasoupError);
    }

    // Video görüşme durumunu güncelle
    videoCallState.isActive = true;

    // Sunucuya video görüşme başlatıldığını bildir
    socket.emit('video-call-started', {
      userId: socket.id,
      roomId
    });

    // Video kontrol düğmelerini göster
    showVideoControls();

    // Yeni üretici olayını dinle
    socket.on('mediasoup:new-producer', async (data) => {
      const { producerId } = data;

      // Kendi üreticimizi tüketme
      if (videoCallState.mediasoup.producers.has(producerId)) {
        return;
      }

      await consumeProducer(producerId);
    });

    console.log('Video görüşme başlatıldı');
  } catch (error) {
    console.error('Video görüşme başlatma hatası:', error);
    alert('Kamera veya mikrofon erişimi sağlanamadı. Lütfen izinleri kontrol edin.');
  }
}

/**
 * Tüm üreticileri tüketir
 * @param producers Üretici ID'leri
 */
async function consumeAllProducers(producers: string[]): Promise<void> {
  for (const producerId of producers) {
    // Kendi üreticimizi tüketme
    if (videoCallState.mediasoup.producers.has(producerId)) {
      continue;
    }

    await consumeProducer(producerId);
  }
}

/**
 * Üreticiyi tüketir
 * @param producerId Üretici ID
 */
async function consumeProducer(producerId: string): Promise<void> {
  try {
    // Üreticiyi tüket
    const result = await mediasoupClient.consume(
      producerId,
      mediasoupClient.getMediasoupState().device?.rtpCapabilities
    );

    if (result) {
      const { consumerId, track, kind, producerId } = result;

      console.log(`${kind} üreticisi tüketildi:`, consumerId);

      // Medya parçasını işle
      if (kind === 'video') {
        // Video parçası için yeni bir akış oluştur
        const remoteStream = new MediaStream([track]);

        // Uzak video elementini oluştur
        const videoElement = document.createElement('video');
        videoElement.srcObject = remoteStream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.id = `remote-video-${consumerId}`;

        // Video elementini konteynıra ekle
        const remoteVideosContainer = document.getElementById('remote-videos-container');
        if (remoteVideosContainer) {
          const videoContainer = document.createElement('div');
          videoContainer.className = 'remote-video-wrapper';
          videoContainer.id = `video-container-${consumerId}`;
          videoContainer.appendChild(videoElement);
          remoteVideosContainer.appendChild(videoContainer);
        }

        // Video elementini ve akışı kaydet
        videoCallState.remoteVideos.set(consumerId, videoElement);
        videoCallState.remoteStreams.set(consumerId, remoteStream);
      } else if (kind === 'audio') {
        // Ses parçası için yeni bir akış oluştur
        const remoteStream = new MediaStream([track]);

        // Ses elementini oluştur
        const audioElement = document.createElement('audio');
        audioElement.srcObject = remoteStream;
        audioElement.autoplay = true;
        audioElement.id = `remote-audio-${consumerId}`;

        // Ses elementini gizli olarak ekle
        document.body.appendChild(audioElement);
      }
    }
  } catch (error) {
    console.error('Üretici tüketilirken hata oluştu:', error);
  }
}

/**
 * Video görüşmeyi durdurur
 */
export async function stopVideoCall(): Promise<void> {
  if (!videoCallState.isActive) return;

  // MediaSoup bağlantısını kapat
  try {
    // Tüm üreticileri kapat
    for (const producerId of videoCallState.mediasoup.producers.keys()) {
      await mediasoupClient.closeProducer(producerId);
    }
    videoCallState.mediasoup.producers.clear();

    // Tüm tüketicileri kapat
    for (const consumerId of videoCallState.mediasoup.consumers.keys()) {
      await mediasoupClient.closeConsumer(consumerId);
    }
    videoCallState.mediasoup.consumers.clear();

    // Transportları kapat
    mediasoupClient.closeTransports();

    // Ekran paylaşımını durdur
    if (videoCallState.screenShare.active) {
      await stopScreenShare();
    }
  } catch (error) {
    console.error('MediaSoup bağlantısı kapatılırken hata oluştu:', error);
  }

  // Yerel video akışını durdur
  if (videoCallState.localStream) {
    videoCallState.localStream.getTracks().forEach(track => track.stop());
    videoCallState.localStream = null;
  }

  // Yerel video elementini temizle
  if (videoCallState.localVideo) {
    videoCallState.localVideo.srcObject = null;
    videoCallState.localVideo = null;
  }

  // Uzak video akışlarını durdur
  videoCallState.remoteStreams.forEach(stream => {
    stream.getTracks().forEach(track => track.stop());
  });
  videoCallState.remoteStreams.clear();

  // Uzak video elementlerini temizle
  videoCallState.remoteVideos.forEach(video => {
    video.srcObject = null;
    video.parentElement?.remove();
  });
  videoCallState.remoteVideos.clear();

  // Video görüşme durumunu güncelle
  videoCallState.isActive = false;
  videoCallState.roomId = null;

  // Sunucuya video görüşme durdurulduğunu bildir
  socket.emit('video-call-stopped', {
    userId: socket.id,
    roomId: videoCallState.roomId
  });

  // Socket olaylarını temizle
  socket.off('mediasoup:new-producer');

  // Video kontrol düğmelerini gizle
  hideVideoControls();

  console.log('Video görüşme durduruldu');
}

/**
 * Ekran paylaşımını başlatır
 */
export async function startScreenShare(): Promise<void> {
  if (!videoCallState.isActive || !videoCallState.roomId) {
    console.error('Video görüşme aktif değil');
    return;
  }

  if (videoCallState.screenShare.active) {
    console.warn('Ekran paylaşımı zaten aktif');
    return;
  }

  try {
    // Ekran paylaşımı akışını al
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'
      },
      audio: false
    });

    // Ekran paylaşımı durumunu güncelle
    videoCallState.screenShare.stream = stream;
    videoCallState.screenShare.active = true;

    // Ekran paylaşımı parçasını al
    const screenTrack = stream.getVideoTracks()[0];

    // Ekran paylaşımı bittiğinde
    screenTrack.onended = () => {
      stopScreenShare();
    };

    // Ekran paylaşımını üret
    if (videoCallState.mediasoup.sendTransport) {
      const screenProducerId = await mediasoupClient.produce(screenTrack, {
        codecOptions: {
          videoGoogleStartBitrate: 1000
        },
        appData: {
          mediaType: 'screen'
        }
      });

      if (screenProducerId) {
        videoCallState.screenShare.producer = mediasoupClient.getMediasoupState().producers.get(screenProducerId);
        console.log('Ekran paylaşımı üreticisi oluşturuldu:', screenProducerId);

        // Sunucuya ekran paylaşımı başlatıldığını bildir
        socket.emit('video-screen-share', {
          userId: socket.id,
          roomId: videoCallState.roomId,
          active: true
        });
      }
    }

    // Ekran paylaşımı düğmesini güncelle
    updateScreenShareButton(true);

    console.log('Ekran paylaşımı başlatıldı');
  } catch (error) {
    console.error('Ekran paylaşımı başlatma hatası:', error);
    videoCallState.screenShare.active = false;
    videoCallState.screenShare.stream = null;
  }
}

/**
 * Ekran paylaşımını durdurur
 */
export async function stopScreenShare(): Promise<void> {
  if (!videoCallState.screenShare.active) {
    return;
  }

  try {
    // Ekran paylaşımı akışını durdur
    if (videoCallState.screenShare.stream) {
      videoCallState.screenShare.stream.getTracks().forEach(track => track.stop());
      videoCallState.screenShare.stream = null;
    }

    // Ekran paylaşımı üreticisini kapat
    if (videoCallState.screenShare.producer) {
      await mediasoupClient.closeProducer(videoCallState.screenShare.producer.id);
      videoCallState.screenShare.producer = null;
    }

    // Ekran paylaşımı durumunu güncelle
    videoCallState.screenShare.active = false;

    // Sunucuya ekran paylaşımı durdurulduğunu bildir
    if (videoCallState.roomId) {
      socket.emit('video-screen-share', {
        userId: socket.id,
        roomId: videoCallState.roomId,
        active: false
      });
    }

    // Ekran paylaşımı düğmesini güncelle
    updateScreenShareButton(false);

    console.log('Ekran paylaşımı durduruldu');
  } catch (error) {
    console.error('Ekran paylaşımı durdurma hatası:', error);
  }
}

/**
 * Kamera değiştirir (ön/arka)
 */
export async function switchCamera(): Promise<void> {
  if (!videoCallState.isActive || !videoCallState.localStream) return;

  try {
    // Mevcut kamerayı değiştir
    videoCallState.currentCamera = videoCallState.currentCamera === 'user' ? 'environment' : 'user';

    // Mevcut video akışını durdur
    videoCallState.localStream.getVideoTracks().forEach(track => track.stop());

    // Yeni video akışını al
    const constraints = {
      video: {
        ...getCurrentQualitySettings(),
        facingMode: { exact: videoCallState.currentCamera }
      }
    };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Yeni video akışını mevcut akışa ekle
    const videoTrack = newStream.getVideoTracks()[0];
    const audioTrack = videoCallState.localStream.getAudioTracks()[0];

    // Yeni akış oluştur
    const newCombinedStream = new MediaStream();

    // Video track'i ekle (eğer varsa)
    if (videoTrack) {
      newCombinedStream.addTrack(videoTrack);
    }

    // Audio track'i ekle (eğer varsa)
    if (audioTrack) {
      newCombinedStream.addTrack(audioTrack);
    }

    // Yerel akışı güncelle
    videoCallState.localStream = newCombinedStream;

    // Yerel video elementini güncelle
    if (videoCallState.localVideo) {
      videoCallState.localVideo.srcObject = newCombinedStream;
    }

    console.log(`Kamera değiştirildi: ${videoCallState.currentCamera}`);
  } catch (error) {
    console.error('Kamera değiştirme hatası:', error);
    alert('Kamera değiştirilemedi. Cihazınızda birden fazla kamera olmayabilir.');
  }
}

/**
 * Video kalitesini değiştirir
 */
export function changeVideoQuality(quality: 'low' | 'medium' | 'high'): void {
  if (!videoCallState.isActive) return;

  videoCallState.currentQuality = quality;

  // Kalite değişikliğini uygula
  if (videoCallState.localStream) {
    const videoTrack = videoCallState.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.applyConstraints(getCurrentQualitySettings())
        .then(() => {
          console.log(`Video kalitesi değiştirildi: ${quality}`);

          // Kalite seçeneklerini güncelle
          updateQualityOptions();
        })
        .catch(error => {
          console.error('Video kalitesi değiştirme hatası:', error);
        });
    }
  }
}

/**
 * Kullanılabilir kameraları alır
 */
async function getAvailableCameras(): Promise<void> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === 'videoinput');
    videoCallState.availableCameras = cameras;

    // Kamera değiştirme düğmesini güncelle
    updateCameraButton();

    console.log(`${cameras.length} kamera bulundu`);
  } catch (error) {
    console.error('Kamera listesi alınamadı:', error);
  }
}

/**
 * Mevcut kalite ayarlarını alır
 */
function getCurrentQualitySettings(): MediaTrackConstraints {
  switch (videoCallState.currentQuality) {
    case 'low':
      return videoCallSettings.lowQuality;
    case 'high':
      return videoCallSettings.highQuality;
    case 'medium':
    default:
      return videoCallSettings.mediumQuality;
  }
}

/**
 * Mevcut oda ID'sini alır
 */
function getCurrentRoomId(): string {
  // Aktif kanalın ID'sini al
  const activeChannel = document.querySelector('.channel.active');
  return activeChannel ? activeChannel.getAttribute('data-id') || 'default-room' : 'default-room';
}

/**
 * Video kontrol düğmelerini gösterir
 */
function showVideoControls(): void {
  const switchCameraBtn = document.getElementById('switch-camera-btn');
  const videoQualityBtn = document.getElementById('video-quality-btn');
  const screenShareBtn = document.getElementById('screen-share-btn');

  if (switchCameraBtn) {
    switchCameraBtn.classList.add('visible');
  }

  if (videoQualityBtn) {
    videoQualityBtn.classList.add('visible');
  }

  if (screenShareBtn) {
    screenShareBtn.classList.add('visible');
    // Ekran paylaşımı destekleniyorsa düğmeyi etkinleştir
    if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
      screenShareBtn.classList.remove('disabled');
      screenShareBtn.setAttribute('title', 'Ekran paylaşımını başlat');
    } else {
      screenShareBtn.classList.add('disabled');
      screenShareBtn.setAttribute('title', 'Ekran paylaşımı bu tarayıcıda desteklenmiyor');
    }
  }

  // Kamera değiştirme düğmesini güncelle
  updateCameraButton();

  // Kalite seçeneklerini güncelle
  updateQualityOptions();
}

/**
 * Video kontrol düğmelerini gizler
 */
function hideVideoControls(): void {
  const switchCameraBtn = document.getElementById('switch-camera-btn');
  const videoQualityBtn = document.getElementById('video-quality-btn');
  const screenShareBtn = document.getElementById('screen-share-btn');

  if (switchCameraBtn) {
    switchCameraBtn.classList.remove('visible');
  }

  if (videoQualityBtn) {
    videoQualityBtn.classList.remove('visible');
  }

  if (screenShareBtn) {
    screenShareBtn.classList.remove('visible');
    screenShareBtn.classList.remove('active');
  }
}

/**
 * Kamera değiştirme düğmesini günceller
 */
function updateCameraButton(): void {
  const switchCameraBtn = document.getElementById('switch-camera-btn');

  if (switchCameraBtn) {
    // Birden fazla kamera varsa düğmeyi göster
    if (videoCallState.availableCameras.length > 1) {
      switchCameraBtn.classList.add('visible');
    } else {
      switchCameraBtn.classList.remove('visible');
    }
  }
}

/**
 * Kalite seçeneklerini günceller
 */
function updateQualityOptions(): void {
  const qualityOptions = document.querySelectorAll('.video-quality-option');

  qualityOptions.forEach(option => {
    const quality = option.getAttribute('data-quality');

    if (quality === videoCallState.currentQuality) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

/**
 * Ekran paylaşımı düğmesini günceller
 * @param active Ekran paylaşımı aktif mi
 */
function updateScreenShareButton(active: boolean): void {
  const screenShareBtn = document.getElementById('screen-share-btn');

  if (screenShareBtn) {
    if (active) {
      screenShareBtn.classList.add('active');
      screenShareBtn.setAttribute('title', 'Ekran paylaşımını durdur');
    } else {
      screenShareBtn.classList.remove('active');
      screenShareBtn.setAttribute('title', 'Ekran paylaşımını başlat');
    }
  }
}

// Dışa aktarılan fonksiyonlar
export default {
  startVideoCall,
  stopVideoCall,
  switchCamera,
  changeVideoQuality,
  startScreenShare,
  stopScreenShare
};
