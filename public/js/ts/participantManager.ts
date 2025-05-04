/**
 * public/js/ts/participantManager.ts
 * Çoklu katılımcı yönetimi
 */

// TypeScript için tip tanımlamaları
// Not: Çalışma zamanında Socket.IO CDN üzerinden yüklenir
type Socket = any;
import { Consumer, Producer } from 'mediasoup-client/lib/types';
import { updateRemoteVideo, removeRemoteVideo } from './videoCall';

// Global modül değişkeni
declare global {
  interface Window {
    participantManagerModule: {
      initParticipantManager: (socket: Socket) => void;
    };
  }
}

// Katılımcı arayüzü
export interface Participant {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isSpeaking: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  isLocal: boolean;
  joinedAt: Date;
  audioProducer?: Producer | null;
  videoProducer?: Producer | null;
  screenProducer?: Producer | null;
  audioConsumer?: Consumer | null;
  videoConsumer?: Consumer | null;
  screenConsumer?: Consumer | null;
}

// Global değişkenleri tanımla
declare global {
  interface Window {
    participants: Record<string, Participant>;
    localParticipantId: string;
  }
}

/**
 * Katılımcı yöneticisini başlatır
 * @param socket - Socket.io socket
 */
function initParticipantManager(socket: Socket): void {
  // Katılımcılar nesnesini oluştur
  window.participants = window.participants || {};

  // Katılımcı olaylarını dinle
  socket.on('participant:joined', (data: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  }) => {
    addParticipant(data);
  });

  socket.on('participant:left', (data: {
    id: string;
  }) => {
    removeParticipant(data.id);
  });

  socket.on('participant:updated', (data: {
    id: string;
    isVideoEnabled?: boolean;
    isAudioEnabled?: boolean;
    isScreenSharing?: boolean;
    isSpeaking?: boolean;
  }) => {
    updateParticipant(data.id, data);
  });

  socket.on('participant:list', (data: {
    participants: Array<{
      id: string;
      username: string;
      displayName?: string;
      avatar?: string;
      isVideoEnabled: boolean;
      isAudioEnabled: boolean;
      isScreenSharing: boolean;
    }>;
    localParticipantId: string;
  }) => {
    // Mevcut katılımcıları temizle
    window.participants = {};

    // Yerel katılımcı ID'sini ayarla
    window.localParticipantId = data.localParticipantId;

    // Katılımcıları ekle
    data.participants.forEach(participant => {
      addParticipant({
        ...participant,
        isLocal: participant.id === data.localParticipantId
      });
    });

    // Katılımcı listesini güncelle
    updateParticipantList();
  });

  // Konuşma durumu olayını dinle
  socket.on('userSpeakingChanged', (data: {
    userId: string;
    isSpeaking: boolean;
  }) => {
    updateParticipant(data.userId, { isSpeaking: data.isSpeaking });
  });

  // Video tüketici olayını dinle
  socket.on('newVideoConsumer', (data: {
    peerId: string;
    producerId: string;
    id: string;
    kind: 'video';
    rtpParameters: any;
    appData: any;
  }) => {
    // Video tüketicisi oluşturulduğunda katılımcıyı güncelle
    updateParticipant(data.peerId, { isVideoEnabled: true });
  });

  // Ekran paylaşımı olaylarını dinle
  socket.on('screenShareStarted', (data: {
    peerId: string;
    videoProducerId: string;
    audioProducerId?: string;
  }) => {
    updateParticipant(data.peerId, { isScreenSharing: true });
  });

  socket.on('screenShareEnded', (data: {
    peerId: string;
  }) => {
    updateParticipant(data.peerId, { isScreenSharing: false });
  });

  console.log('Katılımcı yöneticisi başlatıldı');
}

/**
 * Katılımcı ekler
 * @param participant - Katılımcı bilgileri
 */
function addParticipant(participant: {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isVideoEnabled?: boolean;
  isAudioEnabled?: boolean;
  isScreenSharing?: boolean;
  isLocal?: boolean;
}): void {
  // Katılımcı zaten varsa güncelle
  if (window.participants[participant.id]) {
    updateParticipant(participant.id, participant);
    return;
  }

  // Yeni katılımcı oluştur
  window.participants[participant.id] = {
    id: participant.id,
    username: participant.username,
    displayName: participant.displayName || participant.username,
    avatar: participant.avatar || '',
    isSpeaking: false,
    isVideoEnabled: participant.isVideoEnabled || false,
    isAudioEnabled: participant.isAudioEnabled || false,
    isScreenSharing: participant.isScreenSharing || false,
    isLocal: participant.isLocal || false,
    joinedAt: new Date()
  };

  // Katılımcı listesini güncelle
  updateParticipantList();

  console.log(`Katılımcı eklendi: ${participant.username} (${participant.id})`);
}

/**
 * Katılımcıyı kaldırır
 * @param participantId - Katılımcı ID'si
 */
function removeParticipant(participantId: string): void {
  // Katılımcı yoksa işlem yapma
  if (!window.participants[participantId]) {
    return;
  }

  // Katılımcının video elementini kaldır
  removeRemoteVideo(participantId);

  // Katılımcıyı kaldır
  const username = window.participants[participantId].username;
  delete window.participants[participantId];

  // Katılımcı listesini güncelle
  updateParticipantList();

  console.log(`Katılımcı kaldırıldı: ${username} (${participantId})`);
}

/**
 * Katılımcıyı günceller
 * @param participantId - Katılımcı ID'si
 * @param updates - Güncellenecek alanlar
 */
function updateParticipant(
  participantId: string,
  updates: {
    username?: string;
    displayName?: string;
    avatar?: string;
    isSpeaking?: boolean;
    isVideoEnabled?: boolean;
    isAudioEnabled?: boolean;
    isScreenSharing?: boolean;
    isLocal?: boolean;
    audioProducer?: Producer | null;
    videoProducer?: Producer | null;
    screenProducer?: Producer | null;
    audioConsumer?: Consumer | null;
    videoConsumer?: Consumer | null;
    screenConsumer?: Consumer | null;
  }
): void {
  // Katılımcı yoksa işlem yapma
  if (!window.participants[participantId]) {
    return;
  }

  // Katılımcıyı güncelle
  window.participants[participantId] = {
    ...window.participants[participantId],
    ...updates
  };

  // Konuşma durumu değiştiyse UI'ı güncelle
  if (updates.isSpeaking !== undefined) {
    updateSpeakingIndicator(participantId, updates.isSpeaking);
  }

  // Video durumu değiştiyse UI'ı güncelle
  if (updates.isVideoEnabled !== undefined) {
    updateVideoIndicator(participantId, updates.isVideoEnabled);
  }

  // Ses durumu değiştiyse UI'ı güncelle
  if (updates.isAudioEnabled !== undefined) {
    updateAudioIndicator(participantId, updates.isAudioEnabled);
  }

  // Ekran paylaşımı durumu değiştiyse UI'ı güncelle
  if (updates.isScreenSharing !== undefined) {
    updateScreenShareIndicator(participantId, updates.isScreenSharing);
  }

  // Katılımcı listesini güncelle
  updateParticipantList();
}

/**
 * Katılımcı listesini günceller
 */
function updateParticipantList(): void {
  // Katılımcı listesi elementini al
  const participantListElement = document.getElementById('participant-list');
  if (!participantListElement) return;

  // Katılımcı listesini temizle
  participantListElement.innerHTML = '';

  // Katılımcıları sırala (önce yerel katılımcı, sonra diğerleri)
  const sortedParticipants = Object.values(window.participants).sort((a, b) => {
    if (a.isLocal) return -1;
    if (b.isLocal) return 1;
    return a.username.localeCompare(b.username);
  });

  // Katılımcıları ekle
  sortedParticipants.forEach(participant => {
    const participantElement = document.createElement('div');
    participantElement.className = 'participant-item';
    participantElement.id = `participant-${participant.id}`;

    // Konuşma durumuna göre sınıf ekle
    if (participant.isSpeaking) {
      participantElement.classList.add('speaking');
    }

    // Yerel katılımcı ise sınıf ekle
    if (participant.isLocal) {
      participantElement.classList.add('local');
    }

    // Katılımcı adını ve görüntülenen adını belirle
    const displayName = participant.displayName || participant.username;

    // Katılımcı içeriğini oluştur
    participantElement.innerHTML = `
      <div class="participant-avatar">
        ${participant.avatar ? `<img src="${participant.avatar}" alt="${displayName}">` : `<div class="avatar-placeholder">${displayName.charAt(0)}</div>`}
        <div class="speaking-indicator"></div>
      </div>
      <div class="participant-info">
        <div class="participant-name">${displayName} ${participant.isLocal ? '(Sen)' : ''}</div>
        <div class="participant-status">
          <span class="status-indicator audio-status ${participant.isAudioEnabled ? 'enabled' : 'disabled'}">
            <span class="material-icons">${participant.isAudioEnabled ? 'mic' : 'mic_off'}</span>
          </span>
          <span class="status-indicator video-status ${participant.isVideoEnabled ? 'enabled' : 'disabled'}">
            <span class="material-icons">${participant.isVideoEnabled ? 'videocam' : 'videocam_off'}</span>
          </span>
          ${participant.isScreenSharing ? `
            <span class="status-indicator screen-status enabled">
              <span class="material-icons">screen_share</span>
            </span>
          ` : ''}
        </div>
      </div>
    `;

    // Katılımcı elementini listeye ekle
    participantListElement.appendChild(participantElement);
  });

  // Katılımcı sayısını güncelle
  const participantCountElement = document.getElementById('participant-count');
  if (participantCountElement) {
    participantCountElement.textContent = Object.keys(window.participants).length.toString();
  }
}

/**
 * Konuşma göstergesini günceller
 * @param participantId - Katılımcı ID'si
 * @param isSpeaking - Konuşuyor mu
 */
function updateSpeakingIndicator(participantId: string, isSpeaking: boolean): void {
  const participantElement = document.getElementById(`participant-${participantId}`);
  if (!participantElement) return;

  if (isSpeaking) {
    participantElement.classList.add('speaking');
  } else {
    participantElement.classList.remove('speaking');
  }
}

/**
 * Video göstergesini günceller
 * @param participantId - Katılımcı ID'si
 * @param isVideoEnabled - Video etkin mi
 */
function updateVideoIndicator(participantId: string, isVideoEnabled: boolean): void {
  const participantElement = document.getElementById(`participant-${participantId}`);
  if (!participantElement) return;

  const videoStatusElement = participantElement.querySelector('.video-status');
  if (!videoStatusElement) return;

  if (isVideoEnabled) {
    videoStatusElement.classList.add('enabled');
    videoStatusElement.classList.remove('disabled');
    videoStatusElement.querySelector('.material-icons')!.textContent = 'videocam';
  } else {
    videoStatusElement.classList.add('disabled');
    videoStatusElement.classList.remove('enabled');
    videoStatusElement.querySelector('.material-icons')!.textContent = 'videocam_off';
  }
}

/**
 * Ses göstergesini günceller
 * @param participantId - Katılımcı ID'si
 * @param isAudioEnabled - Ses etkin mi
 */
function updateAudioIndicator(participantId: string, isAudioEnabled: boolean): void {
  const participantElement = document.getElementById(`participant-${participantId}`);
  if (!participantElement) return;

  const audioStatusElement = participantElement.querySelector('.audio-status');
  if (!audioStatusElement) return;

  if (isAudioEnabled) {
    audioStatusElement.classList.add('enabled');
    audioStatusElement.classList.remove('disabled');
    audioStatusElement.querySelector('.material-icons')!.textContent = 'mic';
  } else {
    audioStatusElement.classList.add('disabled');
    audioStatusElement.classList.remove('enabled');
    audioStatusElement.querySelector('.material-icons')!.textContent = 'mic_off';
  }
}

/**
 * Ekran paylaşımı göstergesini günceller
 * @param participantId - Katılımcı ID'si
 * @param isScreenSharing - Ekran paylaşımı yapılıyor mu
 */
function updateScreenShareIndicator(participantId: string, isScreenSharing: boolean): void {
  const participantElement = document.getElementById(`participant-${participantId}`);
  if (!participantElement) return;

  const statusContainer = participantElement.querySelector('.participant-status');
  if (!statusContainer) return;

  let screenStatusElement = statusContainer.querySelector('.screen-status');

  if (isScreenSharing) {
    if (!screenStatusElement) {
      screenStatusElement = document.createElement('span');
      screenStatusElement.className = 'status-indicator screen-status enabled';
      screenStatusElement.innerHTML = '<span class="material-icons">screen_share</span>';
      statusContainer.appendChild(screenStatusElement);
    } else {
      screenStatusElement.classList.add('enabled');
    }
  } else if (screenStatusElement) {
    statusContainer.removeChild(screenStatusElement);
  }
}

/**
 * Katılımcı sayısını döndürür
 * @returns Katılımcı sayısı
 */
function getParticipantCount(): number {
  return Object.keys(window.participants).length;
}

/**
 * Katılımcı listesini döndürür
 * @returns Katılımcı listesi
 */
function getParticipants(): Participant[] {
  return Object.values(window.participants);
}

/**
 * Yerel katılımcıyı döndürür
 * @returns Yerel katılımcı
 */
function getLocalParticipant(): Participant | null {
  if (!window.localParticipantId) return null;
  return window.participants[window.localParticipantId] || null;
}

/**
 * Katılımcıyı ID'ye göre döndürür
 * @param participantId - Katılımcı ID'si
 * @returns Katılımcı
 */
function getParticipantById(participantId: string): Participant | null {
  return window.participants[participantId] || null;
}

// Global değişkene fonksiyonları ata
window.participantManagerModule = {
  initParticipantManager
};
