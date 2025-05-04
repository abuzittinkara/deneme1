/**
 * public/src/ts/screenShare.ts
 * Bu modül, ekran paylaşımını başlatıp durdurmak için gerekli fonksiyonları sağlar.
 * Kullanım: sendTransport üzerinden yeni producerlar yaratılarak ekran paylaşımı yapılır.
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Transport arayüzü
interface Transport {
  id: string;
  produce: (options: ProduceOptions) => Promise<Producer>;
}

// Producer arayüzü
interface Producer {
  id: string;
  kind: string;
  close: () => void;
}

// ProduceOptions arayüzü
interface ProduceOptions {
  track: MediaStreamTrack;
  stopTracks?: boolean;
  appData?: Record<string, any>;
}

// Global değişkenleri tanımla
declare global {
  interface Window {
    screenShareStream: MediaStream | null;
    screenShareProducerVideo: Producer | null;
    screenShareProducerAudio: Producer | null;
  }
}

/**
 * Ekran paylaşımını başlatır
 * @param sendTransport - Gönderme transportu
 * @param socket - Socket.io socket
 * @returns Oluşturulan video ve ses producerları
 */
export async function startScreenShare(
  sendTransport: Transport,
  socket: Socket
): Promise<{ videoProducer: Producer; audioProducer: Producer | null }> {
  try {
    // Kullanıcının ekranını paylaşmasını ister (video ve audio alınır)
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    // Dönen stream'i global olarak saklıyoruz
    window.screenShareStream = stream;

    // Video track'ini al ve producer oluştur
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track found in screen share stream');
    }
    const videoProducer = await sendTransport.produce({
      track: videoTrack,
      stopTracks: false,
      appData: { source: 'screen' },
    });
    window.screenShareProducerVideo = videoProducer;

    // Eğer varsa audio track için de producer oluştur
    let audioProducer: Producer | null = null;
    if (stream.getAudioTracks().length > 0) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioProducer = await sendTransport.produce({
          track: audioTrack,
          stopTracks: false,
          appData: { source: 'screen' },
        });
        window.screenShareProducerAudio = audioProducer;
      }
    }

    // Ekran paylaşım durumunu bildir
    socket.emit('screenShareStatusChanged', { isScreenSharing: true });
    socket.emit('screenShareStarted', { producerId: videoProducer.id });

    // Eğer kullanıcı ekran paylaşımını durdurursa otomatik olarak stopScreenShare çağrılır
    if (videoTrack) {
      videoTrack.onended = () => {
        stopScreenShare(socket);
      };
    }

    return { videoProducer, audioProducer };
  } catch (error) {
    console.error('Screen sharing failed:', error);
    throw error;
  }
}

/**
 * Ekran paylaşımını durdurur
 * @param socket - Socket.io socket
 */
export async function stopScreenShare(socket: Socket): Promise<void> {
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
  if (window.screenShareStream) {
    window.screenShareStream.getTracks().forEach(track => {
      track.stop();
      track.enabled = false; // Track'i devre dışı bırak
    });
    window.screenShareStream = null;
  }
  // Sunucuya bildir
  socket.emit('screenShareStatusChanged', { isScreenSharing: false });
  socket.emit('screenShareEnded', {});
  console.log('Ekran paylaşımı tamamen durduruldu.');
}
