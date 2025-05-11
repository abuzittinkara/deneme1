/**
 * src/utils/webrtc.ts
 * WebRTC işlemleri için yardımcı fonksiyonlar
 */
import { logger } from './logger';

/**
 * ICE sunucu yapılandırması
 * STUN ve TURN sunucuları
 */
export const iceServers = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
    ],
  },
  // TURN sunucuları gerçek uygulamada eklenmelidir
  // {
  //   urls: 'turn:turn.fisqos.com:3478',
  //   username: 'username',
  //   credential: 'password'
  // }
];

/**
 * WebRTC bağlantı seçenekleri
 */
export const rtcConfig: RTCConfiguration = {
  iceServers,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  sdpSemantics: 'unified-plan',
};

/**
 * Medya kısıtlamaları
 */
export const defaultMediaConstraints = {
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
 * Ekran paylaşımı kısıtlamaları
 */
export const screenShareConstraints = {
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
export const getUserMedia = async (
  constraints: MediaStreamConstraints = defaultMediaConstraints
): Promise<MediaStream | null> => {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    logger.error('Medya akışı alınamadı', { error });
    return null;
  }
};

/**
 * Ekran paylaşımı akışını alır
 * @returns Ekran paylaşımı akışı
 */
export const getDisplayMedia = async (): Promise<MediaStream | null> => {
  try {
    // @ts-ignore - TypeScript displayMedia'yı tanımıyor olabilir
    return await navigator.mediaDevices.getDisplayMedia(screenShareConstraints);
  } catch (error) {
    logger.error('Ekran paylaşımı akışı alınamadı', { error });
    return null;
  }
};

/**
 * WebRTC bağlantısı oluşturur
 * @returns WebRTC bağlantısı
 */
export const createPeerConnection = (): RTCPeerConnection => {
  return new RTCPeerConnection(rtcConfig);
};

/**
 * SDP teklifini oluşturur
 * @param peerConnection WebRTC bağlantısı
 * @returns SDP teklifi
 */
export const createOffer = async (
  peerConnection: RTCPeerConnection
): Promise<RTCSessionDescriptionInit | null> => {
  try {
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await peerConnection.setLocalDescription(offer);
    return offer;
  } catch (error) {
    logger.error('SDP teklifi oluşturulamadı', { error });
    return null;
  }
};

/**
 * SDP yanıtını oluşturur
 * @param peerConnection WebRTC bağlantısı
 * @param offer SDP teklifi
 * @returns SDP yanıtı
 */
export const createAnswer = async (
  peerConnection: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit | null> => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  } catch (error) {
    logger.error('SDP yanıtı oluşturulamadı', { error });
    return null;
  }
};

/**
 * ICE adayını ekler
 * @param peerConnection WebRTC bağlantısı
 * @param candidate ICE adayı
 */
export const addIceCandidate = async (
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    logger.error('ICE adayı eklenemedi', { error });
  }
};

/**
 * Medya akışını WebRTC bağlantısına ekler
 * @param peerConnection WebRTC bağlantısı
 * @param stream Medya akışı
 */
export const addStreamToPeerConnection = (
  peerConnection: RTCPeerConnection,
  stream: MediaStream
): void => {
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream);
  });
};

/**
 * WebRTC bağlantısını kapatır
 * @param peerConnection WebRTC bağlantısı
 */
export const closePeerConnection = (peerConnection: RTCPeerConnection): void => {
  if (peerConnection) {
    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    peerConnection.onnegotiationneeded = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onsignalingstatechange = null;
    peerConnection.onicegatheringstatechange = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
  }
};

/**
 * Medya akışını durdurur
 * @param stream Medya akışı
 */
export const stopMediaStream = (stream: MediaStream | null): void => {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
};
