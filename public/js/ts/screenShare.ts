// public/js/ts/screenShare.ts

/**
 * Bu modül, ekran paylaşımını başlatıp durdurmak için gerekli fonksiyonları sağlar.
 * Kullanım: sendTransport üzerinden yeni producerlar yaratılarak ekran paylaşımı yapılır.
 */

// TypeScript için tip tanımlamaları
// Not: Çalışma zamanında Socket.IO CDN üzerinden yüklenir
type Socket = any;
import { Transport, Producer } from 'mediasoup-client/lib/types';

// Global modül değişkeni
declare global {
  interface Window {
    screenShareModule: {
      startScreenShare: (sendTransport: Transport, socket: Socket, options?: any) => Promise<any>;
      stopScreenShare: (socket: Socket) => Promise<void>;
      togglePauseScreenShare: (socket: Socket) => Promise<boolean>;
      changeScreenShareQuality: (socket: Socket, quality: 'low' | 'medium' | 'high') => Promise<boolean>;
    };
  }
}

// Global değişkenleri tanımla
declare global {
  interface Window {
    screenShareStream: MediaStream | null;
    screenShareProducerVideo: Producer | null;
    screenShareProducerAudio: Producer | null;
    screenShareActive: boolean;
    screenSharePaused: boolean;
    screenShareQuality: 'low' | 'medium' | 'high';
    screenShareWithAudio: boolean;
    screenShareLastError: Error | null;
  }
}

interface ScreenShareResult {
  videoProducer: Producer;
  audioProducer: Producer | null;
}

// Ekran paylaşımı kalite ayarları
interface ScreenShareQualitySettings {
  resolution: {
    width: { ideal: number; max: number };
    height: { ideal: number; max: number };
  };
  frameRate: { ideal: number; max: number };
  encodings: Array<{
    maxBitrate: number;
    scaleResolutionDownBy?: number;
    priority?: 'very-low' | 'low' | 'medium' | 'high';
  }>;
}

// Ekran paylaşımı kalite ayarları
const qualitySettings: Record<'low' | 'medium' | 'high', ScreenShareQualitySettings> = {
  low: {
    resolution: {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 }
    },
    frameRate: { ideal: 15, max: 20 },
    encodings: [
      { maxBitrate: 500000, scaleResolutionDownBy: 2, priority: 'medium' }
    ]
  },
  medium: {
    resolution: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 }
    },
    frameRate: { ideal: 25, max: 30 },
    encodings: [
      { maxBitrate: 1000000, scaleResolutionDownBy: 2, priority: 'low' },
      { maxBitrate: 2500000, scaleResolutionDownBy: 1, priority: 'medium' }
    ]
  },
  high: {
    resolution: {
      width: { ideal: 2560, max: 2560 },
      height: { ideal: 1440, max: 1440 }
    },
    frameRate: { ideal: 30, max: 60 },
    encodings: [
      { maxBitrate: 1000000, scaleResolutionDownBy: 3, priority: 'low' },
      { maxBitrate: 2500000, scaleResolutionDownBy: 2, priority: 'medium' },
      { maxBitrate: 5000000, scaleResolutionDownBy: 1, priority: 'high' }
    ]
  }
};

/**
 * Ekran paylaşımını başlatır
 * @param sendTransport - Gönderme transportu
 * @param socket - Socket.io socket
 * @param options - Ekran paylaşımı seçenekleri
 * @returns Oluşturulan producer'lar
 */
async function startScreenShare(
  sendTransport: Transport,
  socket: Socket,
  options: {
    quality?: 'low' | 'medium' | 'high';
    withAudio?: boolean;
    sourceId?: string;
  } = {}
): Promise<ScreenShareResult> {
  try {
    // Zaten ekran paylaşımı yapılıyorsa durdur
    if (window.screenShareActive) {
      await stopScreenShare(socket);
    }

    // Seçenekleri ayarla
    const quality = options.quality || 'medium';
    const withAudio = options.withAudio !== undefined ? options.withAudio : true;
    window.screenShareQuality = quality;
    window.screenShareWithAudio = withAudio;
    window.screenShareActive = false;
    window.screenSharePaused = false;
    window.screenShareLastError = null;

    // Kalite ayarlarını al
    const settings = qualitySettings[quality];

    // Ekran paylaşımı için medya akışını al
    const displayMediaOptions: any = {
      video: {
        cursor: 'always',
        width: settings.resolution.width,
        height: settings.resolution.height,
        frameRate: settings.frameRate
      },
      audio: withAudio,
      surfaceSwitching: 'include',
      selfBrowserSurface: 'include',
      systemAudio: withAudio ? 'include' : 'exclude'
    };

    // Belirli bir kaynak ID'si varsa ekle
    if (options.sourceId) {
      displayMediaOptions.video.displaySurface = 'monitor';
      displayMediaOptions.video.logicalSurface = true;
      displayMediaOptions.video.sourceId = options.sourceId;
    }

    // Ekran paylaşımı için medya akışını al
    const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    // Dönen stream'i global olarak saklıyoruz
    window.screenShareStream = stream;

    // Video track'ini al ve producer oluştur
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('Ekran paylaşımında video track bulunamadı');
    }

    // Video producer'ı oluştur
    const videoProducer = await sendTransport.produce({
      track: videoTrack,
      stopTracks: false,
      encodings: settings.encodings,
      codecOptions: {
        videoGoogleStartBitrate: 1000
      },
      appData: {
        screenShare: true,
        quality
      }
    });

    window.screenShareProducerVideo = videoProducer;

    // Eğer varsa audio track için de producer oluştur
    let audioProducer: Producer | null = null;
    if (withAudio && stream.getAudioTracks().length > 0) {
      const audioTrack = stream.getAudioTracks()[0];
      audioProducer = await sendTransport.produce({
        track: audioTrack,
        stopTracks: false,
        codecOptions: {
          opusStereo: true,
          opusDtx: true,
          opusFec: true,
          opusNack: true
        },
        appData: {
          screenShareAudio: true
        }
      });
      window.screenShareProducerAudio = audioProducer;
    }

    // Ekran paylaşım durumunu bildir
    socket.emit('screenShareStatusChanged', {
      isScreenSharing: true,
      quality,
      withAudio: audioProducer !== null
    });

    socket.emit('screenShareStarted', {
      videoProducerId: videoProducer.id,
      audioProducerId: audioProducer ? audioProducer.id : null,
      quality
    });

    // Ekran paylaşımı olaylarını dinle
    videoTrack.addEventListener('ended', () => {
      stopScreenShare(socket);
    });

    // Producer olaylarını dinle
    videoProducer.on('trackended', () => {
      stopScreenShare(socket);
    });

    videoProducer.on('transportclose', () => {
      stopScreenShare(socket);
    });

    if (audioProducer) {
      audioProducer.on('trackended', () => {
        if (window.screenShareProducerAudio) {
          window.screenShareProducerAudio.close();
          window.screenShareProducerAudio = null;
        }
      });

      audioProducer.on('transportclose', () => {
        if (window.screenShareProducerAudio) {
          window.screenShareProducerAudio.close();
          window.screenShareProducerAudio = null;
        }
      });
    }

    // Ekran paylaşımı aktif
    window.screenShareActive = true;

    return { videoProducer, audioProducer };
  } catch (error) {
    console.error("Ekran paylaşımı başlatılırken hata oluştu:", error);
    window.screenShareLastError = error as Error;

    // Hata durumunda temizlik yap
    cleanupScreenShare();

    // Hata durumunu bildir
    socket.emit('screenShareError', {
      error: (error as Error).message
    });

    throw error;
  }
}

/**
 * Ekran paylaşımını durdurur
 * @param socket - Socket.io socket
 */
async function stopScreenShare(socket: Socket): Promise<void> {
  try {
    // Ekran paylaşımı aktif değilse işlem yapma
    if (!window.screenShareActive && !window.screenShareStream) {
      return;
    }

    // Üreticileri kapat
    if (window.screenShareProducerVideo) {
      await window.screenShareProducerVideo.close();
      window.screenShareProducerVideo = null;
    }

    if (window.screenShareProducerAudio) {
      await window.screenShareProducerAudio.close();
      window.screenShareProducerAudio = null;
    }

    // Stream ve track'leri temizle
    cleanupScreenShare();

    // Sunucuya bildir
    socket.emit('screenShareStatusChanged', { isScreenSharing: false });
    socket.emit('screenShareEnded');

    // Ekran paylaşımı durumunu güncelle
    window.screenShareActive = false;
    window.screenSharePaused = false;

    console.log("Ekran paylaşımı tamamen durduruldu.");
  } catch (error) {
    console.error("Ekran paylaşımı durdurulurken hata oluştu:", error);

    // Hata olsa bile temizlik yap
    cleanupScreenShare();

    // Ekran paylaşımı durumunu güncelle
    window.screenShareActive = false;
    window.screenSharePaused = false;

    // Hata durumunu bildir
    socket.emit('screenShareError', {
      error: (error as Error).message
    });
  }
}

/**
 * Ekran paylaşımını duraklatır/devam ettirir
 * @param socket - Socket.io socket
 * @returns İşlem başarılı mı
 */
async function togglePauseScreenShare(socket: Socket): Promise<boolean> {
  try {
    // Ekran paylaşımı aktif değilse işlem yapma
    if (!window.screenShareActive || !window.screenShareProducerVideo) {
      return false;
    }

    // Durum değişikliği
    window.screenSharePaused = !window.screenSharePaused;

    // Producer'ı duraklat/devam ettir
    if (window.screenSharePaused) {
      await window.screenShareProducerVideo.pause();

      if (window.screenShareProducerAudio) {
        await window.screenShareProducerAudio.pause();
      }

      // Sunucuya bildir
      socket.emit('screenSharePaused');
    } else {
      await window.screenShareProducerVideo.resume();

      if (window.screenShareProducerAudio) {
        await window.screenShareProducerAudio.resume();
      }

      // Sunucuya bildir
      socket.emit('screenShareResumed');
    }

    return true;
  } catch (error) {
    console.error("Ekran paylaşımı duraklatma/devam ettirme hatası:", error);
    return false;
  }
}

/**
 * Ekran paylaşımı kalitesini değiştirir
 * @param socket - Socket.io socket
 * @param quality - Kalite ayarı
 * @returns İşlem başarılı mı
 */
async function changeScreenShareQuality(
  socket: Socket,
  quality: 'low' | 'medium' | 'high'
): Promise<boolean> {
  try {
    // Ekran paylaşımı aktif değilse işlem yapma
    if (!window.screenShareActive || !window.screenShareProducerVideo) {
      return false;
    }

    // Aynı kalite ise işlem yapma
    if (window.screenShareQuality === quality) {
      return true;
    }

    // Kalite ayarlarını al
    const settings = qualitySettings[quality];

    // Kalite değişikliğini bildir
    socket.emit('screenShareQualityChanged', {
      producerId: window.screenShareProducerVideo.id,
      quality,
      encodings: settings.encodings
    });

    // Kalite ayarını güncelle
    window.screenShareQuality = quality;

    return true;
  } catch (error) {
    console.error("Ekran paylaşımı kalite değişikliği hatası:", error);
    return false;
  }
}

/**
 * Ekran paylaşımı kaynaklarını temizler
 */
function cleanupScreenShare(): void {
  // Stream ve track'leri temizle
  if (window.screenShareStream) {
    window.screenShareStream.getTracks().forEach(track => {
      track.stop();
      track.enabled = false; // Track'i devre dışı bırak
    });
    window.screenShareStream = null;
  }
}

// Global değişkene fonksiyonları ata
window.screenShareModule = {
  startScreenShare,
  stopScreenShare,
  togglePauseScreenShare,
  changeScreenShareQuality
};