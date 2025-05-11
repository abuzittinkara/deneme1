/**
 * public/js/components/call.ts
 * Görüntülü görüşme bileşeni
 */
import { Device } from 'mediasoup-client';
import realtime from '../realtime';

// WebRTC bağlantı durumları
enum ConnectionState {
  NEW = 'new',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed',
}

// Medya durumları
interface MediaState {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

// Görüşme katılımcısı
interface Participant {
  id: string;
  username: string;
  mediaState: MediaState;
  videoElement?: HTMLVideoElement;
  audioElement?: HTMLAudioElement;
  videoStream?: MediaStream;
  audioStream?: MediaStream;
  screenStream?: MediaStream;
}

// WebRTC bağlantısı
interface Connection {
  roomId: string;
  device?: Device;
  sendTransport?: any;
  recvTransport?: any;
  producers: Map<string, any>;
  consumers: Map<string, any>;
  state: ConnectionState;
}

// Görüşme durumu
let activeCall: {
  callId: string;
  channelId: string;
  participants: Map<string, Participant>;
  localParticipant: Participant;
  connection: Connection;
  isActive: boolean;
} | null = null;

// DOM elementleri
let callContainer: HTMLElement | null;
let callControls: HTMLElement | null;
let participantsContainer: HTMLElement | null;
let localVideo: HTMLVideoElement | null;
let screenShareVideo: HTMLVideoElement | null;

// Medya kısıtlamaları
const mediaConstraints = {
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

/**
 * Görüntülü görüşme bileşenini başlatır
 */
export function initCallComponent(): void {
  // DOM elementlerini al
  callContainer = document.getElementById('call-container');
  callControls = document.getElementById('call-controls');
  participantsContainer = document.getElementById('participants-container');
  localVideo = document.getElementById('local-video') as HTMLVideoElement;
  screenShareVideo = document.getElementById('screen-share-video') as HTMLVideoElement;

  // Olay dinleyicilerini ekle
  if (callControls) {
    const audioToggleBtn = callControls.querySelector('#audio-toggle');
    const videoToggleBtn = callControls.querySelector('#video-toggle');
    const screenShareBtn = callControls.querySelector('#screen-share');
    const endCallBtn = callControls.querySelector('#end-call');

    if (audioToggleBtn) {
      audioToggleBtn.addEventListener('click', toggleAudio);
    }

    if (videoToggleBtn) {
      videoToggleBtn.addEventListener('click', toggleVideo);
    }

    if (screenShareBtn) {
      screenShareBtn.addEventListener('click', toggleScreenShare);
    }

    if (endCallBtn) {
      endCallBtn.addEventListener('click', endCall);
    }
  }

  // Socket.IO olaylarını dinle
  realtime.addEventListener('call:start', handleCallStart);
  realtime.addEventListener('call:join', handleCallJoin);
  realtime.addEventListener('call:leave', handleCallLeave);
  realtime.addEventListener('call:end', handleCallEnd);
  realtime.addEventListener('call:media-state', handleCallMediaState);
  realtime.addEventListener('call:screen-share', handleCallScreenShare);

  // WebRTC olaylarını dinle
  realtime.addEventListener('webrtc:router-capabilities', handleRouterCapabilities);
  realtime.addEventListener('webrtc:transport-created', handleTransportCreated);
  realtime.addEventListener('webrtc:transport-connected', handleTransportConnected);
  realtime.addEventListener('webrtc:producer-created', handleProducerCreated);
  realtime.addEventListener('webrtc:consumer-created', handleConsumerCreated);
  realtime.addEventListener('webrtc:consumer-resumed', handleConsumerResumed);
  realtime.addEventListener('webrtc:new-producer', handleNewProducer);
  realtime.addEventListener('webrtc:peer-left', handlePeerLeft);
}

/**
 * Görüşme başlatma olayını işler
 * @param data - Görüşme verileri
 */
async function handleCallStart(data: any): Promise<void> {
  const { callId, channelId, initiator } = data;

  // Görüşme zaten aktifse, yeni görüşmeyi reddet
  if (activeCall && activeCall.isActive) {
    console.warn('Zaten aktif bir görüşme var');
    return;
  }

  // Görüşme durumunu oluştur
  activeCall = {
    callId,
    channelId,
    participants: new Map(),
    localParticipant: {
      id: 'local',
      username: 'Sen',
      mediaState: {
        audio: true,
        video: true,
        screen: false,
      },
    },
    connection: {
      roomId: callId,
      producers: new Map(),
      consumers: new Map(),
      state: ConnectionState.NEW,
    },
    isActive: true,
  };

  // Görüşme arayüzünü göster
  showCallInterface();

  // Yerel medyayı başlat
  await startLocalMedia();

  // WebRTC bağlantısını başlat
  await initializeWebRTC();

  // Görüşmeye katıl
  joinCall(callId, channelId);
}

/**
 * Görüşmeye katılma olayını işler
 * @param data - Görüşme verileri
 */
function handleCallJoin(data: any): void {
  const { callId, userId, username } = data;

  // Aktif görüşme yoksa veya farklı bir görüşmeyse, yoksay
  if (!activeCall || activeCall.callId !== callId) {
    return;
  }

  // Katılımcıyı ekle
  const participant: Participant = {
    id: userId,
    username,
    mediaState: {
      audio: true,
      video: true,
      screen: false,
    },
  };

  activeCall.participants.set(userId, participant);

  // Katılımcı arayüzünü güncelle
  updateParticipantsUI();
}

/**
 * Görüşmeden ayrılma olayını işler
 * @param data - Görüşme verileri
 */
function handleCallLeave(data: any): void {
  const { callId, userId } = data;

  // Aktif görüşme yoksa veya farklı bir görüşmeyse, yoksay
  if (!activeCall || activeCall.callId !== callId) {
    return;
  }

  // Katılımcıyı kaldır
  activeCall.participants.delete(userId);

  // Katılımcı arayüzünü güncelle
  updateParticipantsUI();
}

/**
 * Görüşme sonlandırma olayını işler
 * @param data - Görüşme verileri
 */
function handleCallEnd(data: any): void {
  const { callId } = data;

  // Aktif görüşme yoksa veya farklı bir görüşmeyse, yoksay
  if (!activeCall || activeCall.callId !== callId) {
    return;
  }

  // Görüşmeyi sonlandır
  cleanupCall();
}

/**
 * Medya durumu olayını işler
 * @param data - Medya durumu verileri
 */
function handleCallMediaState(data: any): void {
  const { callId, userId, audio, video } = data;

  // Aktif görüşme yoksa veya farklı bir görüşmeyse, yoksay
  if (!activeCall || activeCall.callId !== callId) {
    return;
  }

  // Katılımcının medya durumunu güncelle
  const participant = activeCall.participants.get(userId);
  if (participant) {
    participant.mediaState.audio = audio;
    participant.mediaState.video = video;

    // Katılımcı arayüzünü güncelle
    updateParticipantMediaUI(participant);
  }
}

/**
 * Ekran paylaşımı olayını işler
 * @param data - Ekran paylaşımı verileri
 */
function handleCallScreenShare(data: any): void {
  const { callId, userId, active } = data;

  // Aktif görüşme yoksa veya farklı bir görüşmeyse, yoksay
  if (!activeCall || activeCall.callId !== callId) {
    return;
  }

  // Katılımcının ekran paylaşımı durumunu güncelle
  const participant = activeCall.participants.get(userId);
  if (participant) {
    participant.mediaState.screen = active;

    // Ekran paylaşımı arayüzünü güncelle
    updateScreenShareUI(participant, active);
  }
}

/**
 * Router yetenekleri olayını işler
 * @param data - Router yetenekleri verileri
 */
async function handleRouterCapabilities(data: any): Promise<void> {
  const { roomId, rtpCapabilities } = data;

  // Aktif görüşme yoksa veya farklı bir odaysa, yoksay
  if (!activeCall || activeCall.connection.roomId !== roomId) {
    return;
  }

  try {
    // Device oluştur
    const device = new Device();

    // Router yeteneklerini yükle
    await device.load({ routerRtpCapabilities: rtpCapabilities });

    activeCall.connection.device = device;
    activeCall.connection.state = ConnectionState.CONNECTING;

    // Transport'ları oluştur
    createSendTransport(roomId);
    createRecvTransport(roomId);
  } catch (error) {
    console.error('Router yetenekleri yüklenirken hata oluştu:', error);
    cleanupCall();
  }
}

/**
 * Transport oluşturma olayını işler
 * @param data - Transport verileri
 */
function handleTransportCreated(data: any): void {
  const { roomId, direction, transportId, iceParameters, iceCandidates, dtlsParameters } = data;

  // Aktif görüşme yoksa veya farklı bir odaysa, yoksay
  if (!activeCall || activeCall.connection.roomId !== roomId || !activeCall.connection.device) {
    return;
  }

  try {
    if (direction === 'send') {
      // Gönderme transport'unu oluştur
      const transport = activeCall.connection.device.createSendTransport({
        id: transportId,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      });

      // Transport olaylarını dinle
      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Transport'u bağla
          realtime.emit('webrtc:connect-transport', {
            transportId,
            dtlsParameters,
          });
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          // Producer oluştur
          realtime.emit('webrtc:produce', {
            transportId,
            kind,
            rtpParameters,
          });

          // Producer ID'si daha sonra handleProducerCreated olayında alınacak
          // Geçici bir ID ile callback'i çağır
          callback({ id: 'pending' });
        } catch (error) {
          errback(error as Error);
        }
      });

      activeCall.connection.sendTransport = transport;

      // Yerel medyayı gönder
      if (activeCall.localParticipant.videoStream) {
        produceVideo(activeCall.localParticipant.videoStream);
      }

      if (activeCall.localParticipant.audioStream) {
        produceAudio(activeCall.localParticipant.audioStream);
      }
    } else if (direction === 'recv') {
      // Alma transport'unu oluştur
      const transport = activeCall.connection.device.createRecvTransport({
        id: transportId,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      });

      // Transport olaylarını dinle
      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Transport'u bağla
          realtime.emit('webrtc:connect-transport', {
            transportId,
            dtlsParameters,
          });
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      activeCall.connection.recvTransport = transport;
    }
  } catch (error) {
    console.error(`${direction} transport oluşturulurken hata oluştu:`, error);
  }
}

/**
 * Transport bağlantı olayını işler
 * @param data - Transport verileri
 */
function handleTransportConnected(data: any): void {
  const { transportId } = data;

  // Aktif görüşme yoksa, yoksay
  if (!activeCall) {
    return;
  }

  console.log(`Transport bağlandı: ${transportId}`);
}

/**
 * Producer oluşturma olayını işler
 * @param data - Producer verileri
 */
function handleProducerCreated(data: any): void {
  const { transportId, producerId } = data;

  // Aktif görüşme yoksa, yoksay
  if (!activeCall) {
    return;
  }

  // Producer'ı kaydet
  const pendingProducer = Array.from(activeCall.connection.producers.values())
    .find(producer => producer.id === 'pending');

  if (pendingProducer) {
    pendingProducer.id = producerId;
    activeCall.connection.producers.set(producerId, pendingProducer);
  }

  console.log(`Producer oluşturuldu: ${producerId}`);
}

/**
 * Yeni producer olayını işler
 * @param data - Producer verileri
 */
async function handleNewProducer(data: any): Promise<void> {
  const { roomId, producerId, producerUserId, kind } = data;

  // Aktif görüşme yoksa veya farklı bir odaysa, yoksay
  if (!activeCall || activeCall.connection.roomId !== roomId || !activeCall.connection.recvTransport) {
    return;
  }

  // Katılımcıyı bul
  const participant = activeCall.participants.get(producerUserId);
  if (!participant) {
    console.warn(`Katılımcı bulunamadı: ${producerUserId}`);
    return;
  }

  // Consumer oluştur
  try {
    if (!activeCall.connection.device) {
      throw new Error('Device bulunamadı');
    }

    // RTP yeteneklerini al
    const rtpCapabilities = activeCall.connection.device.rtpCapabilities;

    // Consumer oluştur
    realtime.emit('webrtc:consume', {
      roomId,
      transportId: activeCall.connection.recvTransport.id,
      producerId,
      rtpCapabilities,
    });
  } catch (error) {
    console.error('Consumer oluşturulurken hata oluştu:', error);
  }
}

/**
 * Consumer oluşturma olayını işler
 * @param data - Consumer verileri
 */
async function handleConsumerCreated(data: any): Promise<void> {
  const { roomId, transportId, producerId, consumerId, kind, rtpParameters, producerUserId } = data;

  // Aktif görüşme yoksa veya farklı bir odaysa, yoksay
  if (!activeCall || activeCall.connection.roomId !== roomId || !activeCall.connection.recvTransport) {
    return;
  }

  // Katılımcıyı bul
  const participant = activeCall.participants.get(producerUserId);
  if (!participant) {
    console.warn(`Katılımcı bulunamadı: ${producerUserId}`);
    return;
  }

  try {
    // Consumer oluştur
    const consumer = await activeCall.connection.recvTransport.consume({
      id: consumerId,
      producerId,
      kind,
      rtpParameters,
    });

    // Consumer'ı kaydet
    activeCall.connection.consumers.set(consumerId, consumer);

    // Consumer'ı başlat
    realtime.emit('webrtc:resume-consumer', {
      consumerId,
    });

    // Medya akışını katılımcıya ekle
    const stream = new MediaStream([consumer.track]);

    if (kind === 'video') {
      participant.videoStream = stream;

      // Video elementini oluştur veya güncelle
      if (!participant.videoElement) {
        participant.videoElement = document.createElement('video');
        participant.videoElement.autoplay = true;
        participant.videoElement.playsInline = true;
        participant.videoElement.muted = true;
      }

      participant.videoElement.srcObject = stream;
    } else if (kind === 'audio') {
      participant.audioStream = stream;

      // Audio elementini oluştur veya güncelle
      if (!participant.audioElement) {
        participant.audioElement = document.createElement('audio');
        participant.audioElement.autoplay = true;
      }

      participant.audioElement.srcObject = stream;
    }

    // Katılımcı arayüzünü güncelle
    updateParticipantMediaUI(participant);
  } catch (error) {
    console.error('Consumer oluşturulurken hata oluştu:', error);
  }
}

/**
 * Consumer başlatma olayını işler
 * @param data - Consumer verileri
 */
function handleConsumerResumed(data: any): void {
  const { consumerId } = data;

  // Aktif görüşme yoksa, yoksay
  if (!activeCall) {
    return;
  }

  console.log(`Consumer başlatıldı: ${consumerId}`);
}

/**
 * Katılımcı ayrılma olayını işler
 * @param data - Katılımcı verileri
 */
function handlePeerLeft(data: any): void {
  const { roomId, userId } = data;

  // Aktif görüşme yoksa veya farklı bir odaysa, yoksay
  if (!activeCall || activeCall.connection.roomId !== roomId) {
    return;
  }

  // Katılımcıyı kaldır
  activeCall.participants.delete(userId);

  // Katılımcının consumer'larını kaldır
  for (const [consumerId, consumer] of activeCall.connection.consumers.entries()) {
    if (consumer.producerUserId === userId) {
      consumer.close();
      activeCall.connection.consumers.delete(consumerId);
    }
  }

  // Katılımcı arayüzünü güncelle
  updateParticipantsUI();
}

/**
 * Görüşme arayüzünü gösterir
 */
function showCallInterface(): void {
  if (!callContainer) return;

  // Görüşme arayüzünü göster
  callContainer.style.display = 'flex';

  // Görüşme kontrollerini göster
  if (callControls) {
    callControls.style.display = 'flex';
  }
}

/**
 * Görüşme arayüzünü gizler
 */
function hideCallInterface(): void {
  if (!callContainer) return;

  // Görüşme arayüzünü gizle
  callContainer.style.display = 'none';

  // Görüşme kontrollerini gizle
  if (callControls) {
    callControls.style.display = 'none';
  }
}

/**
 * Yerel medyayı başlatır
 */
async function startLocalMedia(): Promise<void> {
  try {
    // Kamera ve mikrofon erişimi iste
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

    // Yerel video elementine bağla
    if (localVideo) {
      localVideo.srcObject = stream;
      localVideo.muted = true;
      localVideo.autoplay = true;
      localVideo.playsInline = true;
    }

    // Ses ve video akışlarını ayır
    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    if (audioTrack) {
      const audioStream = new MediaStream([audioTrack]);
      activeCall!.localParticipant.audioStream = audioStream;
    }

    if (videoTrack) {
      const videoStream = new MediaStream([videoTrack]);
      activeCall!.localParticipant.videoStream = videoStream;
    }

    // Medya durumunu güncelle
    updateLocalMediaUI();
  } catch (error) {
    console.error('Yerel medya başlatılırken hata oluştu:', error);

    // Hata durumunda medya durumunu güncelle
    if (activeCall) {
      activeCall.localParticipant.mediaState.audio = false;
      activeCall.localParticipant.mediaState.video = false;
      updateLocalMediaUI();
    }
  }
}

/**
 * WebRTC bağlantısını başlatır
 */
async function initializeWebRTC(): Promise<void> {
  if (!activeCall) return;

  try {
    // Router yeteneklerini al
    realtime.emit('webrtc:get-router-capabilities', {
      roomId: activeCall.connection.roomId,
    });
  } catch (error) {
    console.error('WebRTC bağlantısı başlatılırken hata oluştu:', error);
    cleanupCall();
  }
}

/**
 * Gönderme transport'unu oluşturur
 * @param roomId - Oda ID
 */
function createSendTransport(roomId: string): void {
  if (!activeCall) return;

  // Transport oluştur
  realtime.emit('webrtc:create-transport', {
    roomId,
    direction: 'send',
  });
}

/**
 * Alma transport'unu oluşturur
 * @param roomId - Oda ID
 */
function createRecvTransport(roomId: string): void {
  if (!activeCall) return;

  // Transport oluştur
  realtime.emit('webrtc:create-transport', {
    roomId,
    direction: 'recv',
  });
}

/**
 * Video producer'ı oluşturur
 * @param stream - Video akışı
 */
async function produceVideo(stream: MediaStream): Promise<void> {
  if (!activeCall || !activeCall.connection.sendTransport) return;

  try {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Ağ koşullarını algıla
    const networkType = detectNetworkType();

    // Ağ koşullarına göre kodlama ayarlarını belirle
    let encodings;
    let codecOptions;

    switch (networkType) {
      case 'slow':
        // Düşük bant genişliği için tek katman
        encodings = [
          { maxBitrate: 150000, scaleResolutionDownBy: 4, maxFramerate: 15 }
        ];
        codecOptions = {
          videoGoogleStartBitrate: 150,
          videoGoogleMaxBitrate: 150,
          videoGoogleMinBitrate: 50
        };
        break;

      case 'medium':
        // Orta bant genişliği için iki katman
        encodings = [
          { maxBitrate: 150000, scaleResolutionDownBy: 4, maxFramerate: 15 },
          { maxBitrate: 500000, scaleResolutionDownBy: 2, maxFramerate: 30 }
        ];
        codecOptions = {
          videoGoogleStartBitrate: 300,
          videoGoogleMaxBitrate: 500,
          videoGoogleMinBitrate: 100
        };
        break;

      case 'fast':
      default:
        // Yüksek bant genişliği için üç katman (SVC)
        encodings = [
          { maxBitrate: 150000, scaleResolutionDownBy: 4, maxFramerate: 15 },
          { maxBitrate: 500000, scaleResolutionDownBy: 2, maxFramerate: 30 },
          { maxBitrate: 1200000, maxFramerate: 30 }
        ];
        codecOptions = {
          videoGoogleStartBitrate: 500,
          videoGoogleMaxBitrate: 1200,
          videoGoogleMinBitrate: 150
        };
        break;
    }

    // Video üreticisini oluştur
    const producer = await activeCall.connection.sendTransport.produce({
      track: videoTrack,
      encodings,
      codecOptions,
      // Uyarlanabilir bit hızı için ek ayarlar
      appData: {
        networkType,
        adaptiveBitrate: true
      }
    });

    // Üretici olaylarını dinle
    producer.on('transportclose', () => {
      console.log('Video producer transport kapatıldı');
      activeCall?.connection.producers.delete(producer.id);
    });

    producer.on('trackended', () => {
      console.log('Video track sonlandı');
      closeProducer(producer.id);
    });

    // Üreticiyi kaydet
    activeCall.connection.producers.set(producer.id, producer);

    console.log(`Video producer oluşturuldu (${networkType} ağ)`, {
      producerId: producer.id,
      encodings,
      codecOptions
    });
  } catch (error) {
    console.error('Video producer oluşturulurken hata oluştu:', error);
  }
}

/**
 * Ağ türünü algılar
 * @returns Ağ türü (slow, medium, fast)
 */
function detectNetworkType(): 'slow' | 'medium' | 'fast' {
  // Navigator bağlantı bilgisi varsa kullan
  if ('connection' in navigator && (navigator as any).connection) {
    const connection = (navigator as any).connection;

    // Bağlantı türüne göre karar ver
    if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
      return 'slow';
    } else if (connection.effectiveType === '3g') {
      return 'medium';
    } else if (connection.effectiveType === '4g') {
      return 'fast';
    }

    // Bant genişliğine göre karar ver (varsa)
    if (connection.downlink) {
      if (connection.downlink < 1) {
        return 'slow';
      } else if (connection.downlink < 5) {
        return 'medium';
      } else {
        return 'fast';
      }
    }
  }

  // Varsayılan olarak orta hız
  return 'medium';
}

/**
 * Producer'ı kapatır
 * @param producerId - Producer ID
 */
function closeProducer(producerId: string): void {
  if (!activeCall) return;

  const producer = activeCall.connection.producers.get(producerId);
  if (!producer) return;

  producer.close();
  activeCall.connection.producers.delete(producerId);
}

/**
 * Ses producer'ı oluşturur
 * @param stream - Ses akışı
 */
async function produceAudio(stream: MediaStream): Promise<void> {
  if (!activeCall || !activeCall.connection.sendTransport) return;

  try {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const producer = await activeCall.connection.sendTransport.produce({
      track: audioTrack,
      codecOptions: {
        opusStereo: true,
        opusDtx: true,
        opusFec: true,
        opusMaxPlaybackRate: 48000,
      },
    });

    activeCall.connection.producers.set(producer.id, producer);
  } catch (error) {
    console.error('Ses producer oluşturulurken hata oluştu:', error);
  }
}

/**
 * Görüşmeye katılır
 * @param callId - Görüşme ID
 * @param channelId - Kanal ID
 */
function joinCall(callId: string, channelId: string): void {
  // Görüşmeye katıl
  realtime.emit('call:join', {
    callId,
    channelId,
  });
}

/**
 * Görüşmeyi temizler
 */
function cleanupCall(): void {
  if (!activeCall) return;

  // WebRTC bağlantısını kapat
  if (activeCall.connection.sendTransport) {
    activeCall.connection.sendTransport.close();
  }

  if (activeCall.connection.recvTransport) {
    activeCall.connection.recvTransport.close();
  }

  // Producer'ları kapat
  for (const producer of activeCall.connection.producers.values()) {
    producer.close();
  }

  // Consumer'ları kapat
  for (const consumer of activeCall.connection.consumers.values()) {
    consumer.close();
  }

  // Yerel medyayı kapat
  if (activeCall.localParticipant.videoStream) {
    activeCall.localParticipant.videoStream.getTracks().forEach(track => track.stop());
  }

  if (activeCall.localParticipant.audioStream) {
    activeCall.localParticipant.audioStream.getTracks().forEach(track => track.stop());
  }

  // Görüşme durumunu sıfırla
  activeCall.isActive = false;
  activeCall = null;

  // Görüşme arayüzünü gizle
  hideCallInterface();
}

/**
 * Görüşmeyi sonlandırır
 */
function endCall(): void {
  if (!activeCall) return;

  // Görüşmeyi sonlandır
  realtime.emit('call:end', {
    callId: activeCall.callId,
  });

  // Görüşmeyi temizle
  cleanupCall();
}

/**
 * Sesi açar/kapatır
 */
function toggleAudio(): void {
  if (!activeCall) return;

  // Ses durumunu değiştir
  const newState = !activeCall.localParticipant.mediaState.audio;
  activeCall.localParticipant.mediaState.audio = newState;

  // Ses producer'ını bul
  const audioProducer = Array.from(activeCall.connection.producers.values())
    .find(producer => producer.kind === 'audio');

  if (audioProducer) {
    if (newState) {
      audioProducer.resume();
    } else {
      audioProducer.pause();
    }
  }

  // Yerel ses akışını güncelle
  if (activeCall.localParticipant.audioStream) {
    activeCall.localParticipant.audioStream.getAudioTracks().forEach(track => {
      track.enabled = newState;
    });
  }

  // Medya durumunu güncelle
  updateLocalMediaUI();

  // Medya durumunu diğer katılımcılara bildir
  realtime.emit('call:media-state', {
    callId: activeCall.callId,
    audio: newState,
    video: activeCall.localParticipant.mediaState.video,
  });
}

/**
 * Videoyu açar/kapatır
 */
function toggleVideo(): void {
  if (!activeCall) return;

  // Video durumunu değiştir
  const newState = !activeCall.localParticipant.mediaState.video;
  activeCall.localParticipant.mediaState.video = newState;

  // Video producer'ını bul
  const videoProducer = Array.from(activeCall.connection.producers.values())
    .find(producer => producer.kind === 'video');

  if (videoProducer) {
    if (newState) {
      videoProducer.resume();
    } else {
      videoProducer.pause();
    }
  }

  // Yerel video akışını güncelle
  if (activeCall.localParticipant.videoStream) {
    activeCall.localParticipant.videoStream.getVideoTracks().forEach(track => {
      track.enabled = newState;
    });
  }

  // Medya durumunu güncelle
  updateLocalMediaUI();

  // Medya durumunu diğer katılımcılara bildir
  realtime.emit('call:media-state', {
    callId: activeCall.callId,
    audio: activeCall.localParticipant.mediaState.audio,
    video: newState,
  });
}

/**
 * Ekran paylaşımını açar/kapatır
 */
async function toggleScreenShare(): Promise<void> {
  if (!activeCall) return;

  try {
    // Ekran paylaşımı durumunu değiştir
    const newState = !activeCall.localParticipant.mediaState.screen;

    if (newState) {
      // Ekran paylaşımını başlat
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Ekran paylaşımı video elementine bağla
      if (screenShareVideo) {
        screenShareVideo.srcObject = stream;
        screenShareVideo.muted = true;
        screenShareVideo.autoplay = true;
        screenShareVideo.playsInline = true;
      }

      // Ekran paylaşımı akışını kaydet
      activeCall.localParticipant.screenStream = stream;

      // Ekran paylaşımı durumunu güncelle
      activeCall.localParticipant.mediaState.screen = true;

      // Ekran paylaşımı bittiğinde
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        toggleScreenShare();
      });
    } else {
      // Ekran paylaşımını durdur
      if (activeCall.localParticipant.screenStream) {
        activeCall.localParticipant.screenStream.getTracks().forEach(track => track.stop());
        activeCall.localParticipant.screenStream = undefined;
      }

      // Ekran paylaşımı video elementini temizle
      if (screenShareVideo) {
        screenShareVideo.srcObject = null;
      }

      // Ekran paylaşımı durumunu güncelle
      activeCall.localParticipant.mediaState.screen = false;
    }

    // Ekran paylaşımı durumunu güncelle
    updateScreenShareUI(activeCall.localParticipant, newState);

    // Ekran paylaşımı durumunu diğer katılımcılara bildir
    realtime.emit('call:screen-share', {
      callId: activeCall.callId,
      active: newState,
    });
  } catch (error) {
    console.error('Ekran paylaşımı başlatılırken/durdurulurken hata oluştu:', error);

    // Hata durumunda ekran paylaşımı durumunu güncelle
    if (activeCall) {
      activeCall.localParticipant.mediaState.screen = false;
      updateScreenShareUI(activeCall.localParticipant, false);
    }
  }
}

/**
 * Yerel medya durumunu günceller
 */
function updateLocalMediaUI(): void {
  if (!activeCall) return;

  // Ses düğmesini güncelle
  const audioToggleBtn = callControls?.querySelector('#audio-toggle');
  if (audioToggleBtn) {
    const audioIcon = audioToggleBtn.querySelector('i');
    if (audioIcon) {
      audioIcon.textContent = activeCall.localParticipant.mediaState.audio ? 'mic' : 'mic_off';
    }
    audioToggleBtn.classList.toggle('active', activeCall.localParticipant.mediaState.audio);
  }

  // Video düğmesini güncelle
  const videoToggleBtn = callControls?.querySelector('#video-toggle');
  if (videoToggleBtn) {
    const videoIcon = videoToggleBtn.querySelector('i');
    if (videoIcon) {
      videoIcon.textContent = activeCall.localParticipant.mediaState.video ? 'videocam' : 'videocam_off';
    }
    videoToggleBtn.classList.toggle('active', activeCall.localParticipant.mediaState.video);
  }

  // Yerel video elementini güncelle
  if (localVideo) {
    localVideo.classList.toggle('hidden', !activeCall.localParticipant.mediaState.video);
  }
}

/**
 * Katılımcı medya durumunu günceller
 * @param participant - Katılımcı
 */
function updateParticipantMediaUI(participant: Participant): void {
  if (!participantsContainer) return;

  // Katılımcı elementini bul veya oluştur
  let participantElement = participantsContainer.querySelector(`[data-participant-id="${participant.id}"]`);

  if (!participantElement) {
    participantElement = document.createElement('div');
    participantElement.className = 'participant';
    participantElement.setAttribute('data-participant-id', participant.id);

    const nameElement = document.createElement('div');
    nameElement.className = 'participant-name';
    nameElement.textContent = participant.username;

    const videoContainer = document.createElement('div');
    videoContainer.className = 'participant-video-container';

    if (participant.videoElement) {
      videoContainer.appendChild(participant.videoElement);
    }

    const audioIndicator = document.createElement('div');
    audioIndicator.className = 'audio-indicator';
    audioIndicator.innerHTML = '<i class="material-icons">mic</i>';

    participantElement.appendChild(videoContainer);
    participantElement.appendChild(nameElement);
    participantElement.appendChild(audioIndicator);

    participantsContainer.appendChild(participantElement);
  }

  // Video elementini güncelle
  if (participant.videoElement) {
    const videoContainer = participantElement.querySelector('.participant-video-container');
    if (videoContainer && !videoContainer.contains(participant.videoElement)) {
      videoContainer.innerHTML = '';
      videoContainer.appendChild(participant.videoElement);
    }

    participant.videoElement.classList.toggle('hidden', !participant.mediaState.video);
  }

  // Ses göstergesini güncelle
  const audioIndicator = participantElement.querySelector('.audio-indicator');
  if (audioIndicator) {
    audioIndicator.classList.toggle('active', participant.mediaState.audio);

    const micIcon = audioIndicator.querySelector('i');
    if (micIcon) {
      micIcon.textContent = participant.mediaState.audio ? 'mic' : 'mic_off';
    }
  }
}

/**
 * Katılımcı arayüzünü günceller
 */
function updateParticipantsUI(): void {
  if (!activeCall || !participantsContainer) return;

  // Tüm katılımcı elementlerini temizle
  participantsContainer.innerHTML = '';

  // Katılımcıları ekle
  for (const participant of activeCall.participants.values()) {
    updateParticipantMediaUI(participant);
  }
}

/**
 * Ekran paylaşımı arayüzünü günceller
 * @param participant - Katılımcı
 * @param active - Ekran paylaşımı aktif mi
 */
function updateScreenShareUI(participant: Participant, active: boolean): void {
  // Ekran paylaşımı düğmesini güncelle
  const screenShareBtn = callControls?.querySelector('#screen-share');
  if (screenShareBtn && participant.id === 'local') {
    const screenIcon = screenShareBtn.querySelector('i');
    if (screenIcon) {
      screenIcon.textContent = active ? 'stop_screen_share' : 'screen_share';
    }
    screenShareBtn.classList.toggle('active', active);
  }

  // Ekran paylaşımı video elementini güncelle
  if (screenShareVideo) {
    screenShareVideo.classList.toggle('hidden', !active);
  }
}

// Dışa aktarılan nesneler
export default {
  initCallComponent,
};