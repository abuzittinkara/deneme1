/**
 * public/js/ts/videoCall.ts
 * Görüntülü görüşme işlevselliği
 */

// TypeScript için tip tanımlamaları
// Not: Çalışma zamanında Socket.IO CDN üzerinden yüklenir
type Socket = any;
import { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';
import AudioProcessor from './audioProcessor';

// Global modül değişkeni
declare global {
  interface Window {
    videoCallModule: {
      initVideoCall: (socket: Socket) => void;
      startVideoCall: (sendTransport: Transport, socket: Socket, options?: any) => Promise<Producer>;
      stopVideoCall: (socket: Socket) => Promise<void>;
      togglePauseVideoCall: (socket: Socket) => Promise<boolean>;
      changeVideoQuality: (socket: Socket, quality: 'low' | 'medium' | 'high') => Promise<boolean>;
      switchCamera: (socket: Socket, facingMode: 'user' | 'environment') => Promise<boolean>;
    };
  }
}

// Global değişkenleri tanımla
declare global {
  interface Window {
    videoStream: MediaStream | null;
    videoProducer: Producer | null;
    videoConsumers: Record<string, Consumer>;
    videoActive: boolean;
    videoPaused: boolean;
    videoQuality: 'low' | 'medium' | 'high';
    videoLastError: Error | null;
    videoProcessor: AudioProcessor | null;
  }
}

// Video kalite ayarları
interface VideoQualitySettings {
  resolution: {
    width: { ideal: number; max: number };
    height: { ideal: number; max: number };
  };
  frameRate: { ideal: number; max: number };
  facingMode: string;
  encodings: Array<{
    maxBitrate: number;
    scaleResolutionDownBy?: number;
    priority?: 'very-low' | 'low' | 'medium' | 'high';
  }>;
}

// Video kalite ayarları
const qualitySettings: Record<'low' | 'medium' | 'high', VideoQualitySettings> = {
  low: {
    resolution: {
      width: { ideal: 320, max: 640 },
      height: { ideal: 240, max: 480 }
    },
    frameRate: { ideal: 15, max: 20 },
    facingMode: 'user',
    encodings: [
      { maxBitrate: 150000, scaleResolutionDownBy: 2, priority: 'medium' }
    ]
  },
  medium: {
    resolution: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 }
    },
    frameRate: { ideal: 25, max: 30 },
    facingMode: 'user',
    encodings: [
      { maxBitrate: 300000, scaleResolutionDownBy: 2, priority: 'low' },
      { maxBitrate: 600000, scaleResolutionDownBy: 1, priority: 'medium' }
    ]
  },
  high: {
    resolution: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 }
    },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',
    encodings: [
      { maxBitrate: 300000, scaleResolutionDownBy: 3, priority: 'low' },
      { maxBitrate: 600000, scaleResolutionDownBy: 2, priority: 'medium' },
      { maxBitrate: 1500000, scaleResolutionDownBy: 1, priority: 'high' }
    ]
  }
};

/**
 * Görüntülü görüşmeyi başlatır
 * @param sendTransport - Gönderme transportu
 * @param socket - Socket.io socket
 * @param options - Görüntülü görüşme seçenekleri
 * @returns Oluşturulan producer
 */
async function startVideoCall(
  sendTransport: Transport,
  socket: Socket,
  options: {
    quality?: 'low' | 'medium' | 'high';
    audio?: boolean;
    facingMode?: 'user' | 'environment';
  } = {}
): Promise<Producer> {
  try {
    // Zaten görüntülü görüşme yapılıyorsa durdur
    if (window.videoActive) {
      await stopVideoCall(socket);
    }

    // Seçenekleri ayarla
    const quality = options.quality || 'medium';
    const withAudio = options.audio !== undefined ? options.audio : true;
    const facingMode = options.facingMode || 'user';

    window.videoQuality = quality;
    window.videoActive = false;
    window.videoPaused = false;
    window.videoLastError = null;

    // Kalite ayarlarını al
    const settings = qualitySettings[quality];
    settings.facingMode = facingMode;

    // Kamera erişimi için medya akışını al
    const constraints: MediaStreamConstraints = {
      video: {
        width: settings.resolution.width,
        height: settings.resolution.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode
      },
      audio: withAudio
    };

    // Kamera erişimi için medya akışını al
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Dönen stream'i global olarak saklıyoruz
    window.videoStream = stream;

    // Video track'ini al ve producer oluştur
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('Kamera akışında video track bulunamadı');
    }

    // Video producer'ı oluştur
    const videoProducer = await sendTransport.produce({
      track: videoTrack,
      encodings: settings.encodings,
      codecOptions: {
        videoGoogleStartBitrate: 1000
      },
      appData: {
        videoCall: true,
        quality
      }
    });

    window.videoProducer = videoProducer;

    // Ses işleme
    if (withAudio && stream.getAudioTracks().length > 0) {
      // Ses işleme sınıfını başlat
      const audioProcessor = new AudioProcessor(socket);
      await audioProcessor.start(stream, window.audioProducer!);
      window.videoProcessor = audioProcessor;
    }

    // Görüntülü görüşme durumunu bildir
    socket.emit('videoCallStatusChanged', {
      isVideoActive: true,
      quality,
      facingMode
    });

    socket.emit('videoCallStarted', {
      videoProducerId: videoProducer.id,
      quality
    });

    // Video olaylarını dinle
    videoTrack.addEventListener('ended', () => {
      stopVideoCall(socket);
    });

    // Producer olaylarını dinle
    videoProducer.on('trackended', () => {
      stopVideoCall(socket);
    });

    videoProducer.on('transportclose', () => {
      stopVideoCall(socket);
    });

    // Görüntülü görüşme aktif
    window.videoActive = true;

    // Yerel video elementini güncelle
    updateLocalVideo();

    return videoProducer;
  } catch (error) {
    console.error("Görüntülü görüşme başlatılırken hata oluştu:", error);
    window.videoLastError = error as Error;

    // Hata durumunda temizlik yap
    cleanupVideoCall();

    // Hata durumunu bildir
    socket.emit('videoCallError', {
      error: (error as Error).message
    });

    throw error;
  }
}

/**
 * Görüntülü görüşmeyi durdurur
 * @param socket - Socket.io socket
 */
async function stopVideoCall(socket: Socket): Promise<void> {
  try {
    // Görüntülü görüşme aktif değilse işlem yapma
    if (!window.videoActive && !window.videoStream) {
      return;
    }

    // Producer'ı kapat
    if (window.videoProducer) {
      await window.videoProducer.close();
      window.videoProducer = null;
    }

    // Ses işlemeyi durdur
    if (window.videoProcessor) {
      window.videoProcessor.stop();
      window.videoProcessor = null;
    }

    // Stream ve track'leri temizle
    cleanupVideoCall();

    // Sunucuya bildir
    socket.emit('videoCallStatusChanged', { isVideoActive: false });
    socket.emit('videoCallEnded');

    // Görüntülü görüşme durumunu güncelle
    window.videoActive = false;
    window.videoPaused = false;

    // Yerel video elementini güncelle
    updateLocalVideo();

    console.log("Görüntülü görüşme tamamen durduruldu.");
  } catch (error) {
    console.error("Görüntülü görüşme durdurulurken hata oluştu:", error);

    // Hata olsa bile temizlik yap
    cleanupVideoCall();

    // Görüntülü görüşme durumunu güncelle
    window.videoActive = false;
    window.videoPaused = false;

    // Hata durumunu bildir
    socket.emit('videoCallError', {
      error: (error as Error).message
    });
  }
}

/**
 * Görüntülü görüşmeyi duraklatır/devam ettirir
 * @param socket - Socket.io socket
 * @returns İşlem başarılı mı
 */
async function togglePauseVideoCall(socket: Socket): Promise<boolean> {
  try {
    // Görüntülü görüşme aktif değilse işlem yapma
    if (!window.videoActive || !window.videoProducer) {
      return false;
    }

    // Durum değişikliği
    window.videoPaused = !window.videoPaused;

    // Producer'ı duraklat/devam ettir
    if (window.videoPaused) {
      await window.videoProducer.pause();

      // Sunucuya bildir
      socket.emit('videoCallPaused');
    } else {
      await window.videoProducer.resume();

      // Sunucuya bildir
      socket.emit('videoCallResumed');
    }

    // Yerel video elementini güncelle
    updateLocalVideo();

    return true;
  } catch (error) {
    console.error("Görüntülü görüşme duraklatma/devam ettirme hatası:", error);
    return false;
  }
}

/**
 * Görüntülü görüşme kalitesini değiştirir
 * @param socket - Socket.io socket
 * @param quality - Kalite ayarı
 * @returns İşlem başarılı mı
 */
async function changeVideoQuality(
  socket: Socket,
  quality: 'low' | 'medium' | 'high'
): Promise<boolean> {
  try {
    // Görüntülü görüşme aktif değilse işlem yapma
    if (!window.videoActive || !window.videoProducer) {
      return false;
    }

    // Aynı kalite ise işlem yapma
    if (window.videoQuality === quality) {
      return true;
    }

    // Kalite ayarlarını al
    const settings = qualitySettings[quality];

    // Kalite değişikliğini bildir
    socket.emit('videoQualityChanged', {
      producerId: window.videoProducer.id,
      quality,
      encodings: settings.encodings
    });

    // Kalite ayarını güncelle
    window.videoQuality = quality;

    return true;
  } catch (error) {
    console.error("Görüntülü görüşme kalite değişikliği hatası:", error);
    return false;
  }
}

/**
 * Kamera yönünü değiştirir
 * @param socket - Socket.io socket
 * @param facingMode - Kamera yönü
 * @returns İşlem başarılı mı
 */
async function switchCamera(
  socket: Socket,
  facingMode: 'user' | 'environment'
): Promise<boolean> {
  try {
    // Görüntülü görüşme aktif değilse işlem yapma
    if (!window.videoActive || !window.videoStream) {
      return false;
    }

    // Mevcut kalite ayarlarını al
    const quality = window.videoQuality || 'medium';
    const settings = qualitySettings[quality];

    // Kamera yönünü değiştir
    settings.facingMode = facingMode;

    // Mevcut görüntülü görüşmeyi durdur
    await stopVideoCall(socket);

    // Yeni kamera yönü ile görüntülü görüşmeyi başlat
    await startVideoCall(window.sendTransport!, socket, {
      quality,
      facingMode
    });

    return true;
  } catch (error) {
    console.error("Kamera yönü değişikliği hatası:", error);
    return false;
  }
}

/**
 * Görüntülü görüşme kaynaklarını temizler
 */
function cleanupVideoCall(): void {
  // Stream ve track'leri temizle
  if (window.videoStream) {
    window.videoStream.getTracks().forEach(track => {
      track.stop();
      track.enabled = false; // Track'i devre dışı bırak
    });
    window.videoStream = null;
  }
}

/**
 * Yerel video elementini günceller
 */
function updateLocalVideo(): void {
  const localVideo = document.getElementById('local-video') as HTMLVideoElement;
  if (!localVideo) return;

  if (window.videoStream && window.videoActive && !window.videoPaused) {
    localVideo.srcObject = window.videoStream;
    localVideo.play().catch(error => {
      console.error("Yerel video oynatılamadı:", error);
    });

    // Video konteynerini göster
    const localVideoContainer = document.getElementById('local-video-container');
    if (localVideoContainer) {
      localVideoContainer.style.display = 'block';
    }
  } else {
    localVideo.srcObject = null;

    // Video konteynerini gizle
    const localVideoContainer = document.getElementById('local-video-container');
    if (localVideoContainer) {
      localVideoContainer.style.display = 'none';
    }
  }
}

/**
 * Uzak video elementini günceller
 * @param peerId - Peer ID'si
 * @param consumer - Consumer
 */
export function updateRemoteVideo(peerId: string, consumer: Consumer): void {
  // Uzak video elementi var mı kontrol et
  let videoElement = document.getElementById(`video-${peerId}`) as HTMLVideoElement;

  // Yoksa oluştur
  if (!videoElement) {
    // Video konteynerini al
    const remoteVideos = document.getElementById('remote-videos');
    if (!remoteVideos) return;

    // Video konteynerini oluştur
    const videoContainer = document.createElement('div');
    videoContainer.className = 'remote-video-container';
    videoContainer.id = `video-container-${peerId}`;

    // Video elementini oluştur
    videoElement = document.createElement('video');
    videoElement.id = `video-${peerId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;

    // Kullanıcı adı etiketini oluştur
    const usernameLabel = document.createElement('div');
    usernameLabel.className = 'username-label';
    usernameLabel.textContent = peerId;

    // Elementleri ekle
    videoContainer.appendChild(videoElement);
    videoContainer.appendChild(usernameLabel);
    remoteVideos.appendChild(videoContainer);
  }

  // Video track'ini ekle
  const stream = new MediaStream([consumer.track]);
  videoElement.srcObject = stream;

  // Video elementini oynat
  videoElement.play().catch(error => {
    console.error(`Uzak video oynatılamadı (${peerId}):`, error);
  });
}

/**
 * Uzak video elementini kaldırır
 * @param peerId - Peer ID'si
 */
export function removeRemoteVideo(peerId: string): void {
  // Video konteynerini al
  const videoContainer = document.getElementById(`video-container-${peerId}`);
  if (videoContainer) {
    videoContainer.remove();
  }
}

/**
 * Görüntülü görüşme modülünü başlatır
 * @param socket - Socket.io socket
 */
function initVideoCall(socket: Socket): void {
  // Görüntülü görüşme olaylarını dinle
  socket.on('newVideoConsumer', async (data: {
    peerId: string;
    producerId: string;
    id: string;
    kind: 'video';
    rtpParameters: any;
    appData: any;
  }) => {
    try {
      if (!window.recvTransport) {
        console.error('Alma transportu oluşturulmamış');
        return;
      }

      // Consumer oluştur
      const consumer = await window.recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: { ...data.appData, peerId: data.peerId }
      });

      // Consumer'ı sakla
      window.videoConsumers = window.videoConsumers || {};
      window.videoConsumers[data.peerId] = consumer;

      // Uzak video elementini güncelle
      updateRemoteVideo(data.peerId, consumer);

      // Consumer'ı başlat
      socket.emit('resumeConsumer', { consumerId: consumer.id });

      // Consumer olaylarını dinle
      consumer.on('transportclose', () => {
        removeRemoteVideo(data.peerId);
      });

      consumer.on('trackended', () => {
        removeRemoteVideo(data.peerId);
      });
    } catch (error) {
      console.error('Video consumer oluşturulurken hata oluştu:', error);
    }
  });

  socket.on('videoConsumerClosed', (data: { peerId: string; consumerId: string }) => {
    // Consumer'ı kapat
    const consumer = window.videoConsumers?.[data.peerId];
    if (consumer) {
      consumer.close();
      delete window.videoConsumers[data.peerId];
    }

    // Uzak video elementini kaldır
    removeRemoteVideo(data.peerId);
  });

  // Görüntülü görüşme UI olaylarını dinle
  setupVideoCallUIEvents(socket);

  console.log('Görüntülü görüşme modülü başlatıldı');
}

/**
 * Görüntülü görüşme UI olaylarını ayarlar
 * @param socket - Socket.io socket
 */
function setupVideoCallUIEvents(socket: Socket): void {
  // Görüntülü arama düğmesi
  const videoCallBtn = document.getElementById('video-call-btn');
  if (videoCallBtn) {
    videoCallBtn.addEventListener('click', async () => {
      try {
        // Aktif kanal varsa ona katıl, yoksa genel kanala katıl
        const channelId = document.querySelector('.channel.active')?.getAttribute('data-channel-id') || 'voice-general';

        // Ses kanalına katıl
        if (!window.voiceChannel) {
          console.error('Ses kanalı modülü yüklenmemiş');
          return;
        }

        // Ses kanalına katıl
        await window.voiceChannel.join(channelId, socket);

        // Görüntülü görüşmeyi başlat
        if (window.videoActive) {
          await stopVideoCall(socket);
          videoCallBtn.classList.remove('active');
        } else {
          if (!window.sendTransport) {
            console.error('Gönderme transportu oluşturulmamış');
            return;
          }

          await startVideoCall(window.sendTransport, socket);
          videoCallBtn.classList.add('active');
        }
      } catch (error) {
        console.error('Görüntülü görüşme başlatılırken hata oluştu:', error);
      }
    });
  }

  // Kamera düğmesi
  const toggleVideoBtn = document.getElementById('toggle-video-btn');
  if (toggleVideoBtn) {
    toggleVideoBtn.addEventListener('click', async () => {
      try {
        if (window.videoActive) {
          await togglePauseVideoCall(socket);

          // Durum göstergesini güncelle
          if (window.videoPaused) {
            toggleVideoBtn.classList.add('active');
            const icon = toggleVideoBtn.querySelector('.material-icons');
            if (icon) {
              icon.textContent = 'videocam_off';
            }
          } else {
            toggleVideoBtn.classList.remove('active');
            const icon = toggleVideoBtn.querySelector('.material-icons');
            if (icon) {
              icon.textContent = 'videocam';
            }
          }
        } else {
          if (!window.sendTransport) {
            console.error('Gönderme transportu oluşturulmamış');
            return;
          }

          await startVideoCall(window.sendTransport, socket);
          toggleVideoBtn.classList.remove('active');
        }
      } catch (error) {
        console.error('Kamera durumu değiştirilirken hata oluştu:', error);
      }
    });
  }

  // Kamera yönü değiştirme düğmesi
  const switchCameraBtn = document.getElementById('switch-camera-btn');
  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', async () => {
      try {
        // Mevcut kamera yönünü al
        const currentFacingMode = qualitySettings[window.videoQuality || 'medium'].facingMode;

        // Kamera yönünü değiştir
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        // Kamera yönünü değiştir
        await switchCamera(socket, newFacingMode as 'user' | 'environment');

        // Durum göstergesini güncelle
        const icon = switchCameraBtn.querySelector('.material-icons');
        if (icon) {
          icon.textContent = newFacingMode === 'user' ? 'camera_front' : 'camera_rear';
        }
      } catch (error) {
        console.error('Kamera yönü değiştirilirken hata oluştu:', error);
      }
    });
  }

  // Video kalitesi seçenekleri
  const qualityOptions = document.querySelectorAll('.video-quality-option');
  qualityOptions.forEach(option => {
    option.addEventListener('click', async () => {
      try {
        const quality = option.getAttribute('data-quality') as 'low' | 'medium' | 'high';

        if (window.videoActive) {
          await changeVideoQuality(socket, quality);

          // Aktif kaliteyi güncelle
          qualityOptions.forEach(opt => {
            opt.classList.remove('active');
          });
          option.classList.add('active');
        }
      } catch (error) {
        console.error('Video kalitesi değiştirilirken hata oluştu:', error);
      }
    });
  });
}

// Global değişkene fonksiyonları ata
window.videoCallModule = {
  initVideoCall,
  startVideoCall,
  stopVideoCall,
  togglePauseVideoCall,
  changeVideoQuality,
  switchCamera
};