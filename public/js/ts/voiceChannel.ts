/**
 * public/js/ts/voiceChannel.ts
 * Ses kanalı işlevselliği
 */

// TypeScript için tip tanımlamaları
// Not: Çalışma zamanında Socket.IO CDN üzerinden yüklenir
type Socket = any;
import { Device, Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

// Global modül değişkeni
declare global {
  interface Window {
    voiceChannelModule: {
      initVoiceChannel: (socket: Socket) => void;
      joinVoiceChannel: (channelId: string, socket: Socket) => Promise<void>;
      leaveVoiceChannel: (socket: Socket) => Promise<void>;
      toggleMicrophone: (socket: Socket) => void;
    };
  }
}

// Global değişkenleri tanımla
declare global {
  interface Window {
    mediasoupDevice: Device | null;
    sendTransport: Transport | null;
    recvTransport: Transport | null;
    localStream: MediaStream | null;
    audioProducer: Producer | null;
    videoProducer: Producer | null;
    consumers: Map<string, Consumer>;
    currentVoiceChannel: string | null;
  }
}

// Ses kanalı durumu
interface VoiceChannelState {
  isMuted: boolean;
  isDeafened: boolean;
  isConnected: boolean;
  currentChannelId: string | null;
  peers: Map<string, PeerInfo>;
}

// Peer bilgisi
interface PeerInfo {
  id: string;
  username: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

// Ses kanalı durumunu tutan global değişken
const voiceState: VoiceChannelState = {
  isMuted: false,
  isDeafened: false,
  isConnected: false,
  currentChannelId: null,
  peers: new Map()
};

/**
 * Ses kanalı işlevselliğini başlatır
 * @param socket - Socket.io socket
 */
function initVoiceChannel(socket: Socket): void {
  // Global değişkenleri başlat
  window.mediasoupDevice = null;
  window.sendTransport = null;
  window.recvTransport = null;
  window.localStream = null;
  window.audioProducer = null;
  window.videoProducer = null;
  window.consumers = new Map();
  window.currentVoiceChannel = null;

  // Ses kanalı olaylarını dinle
  setupVoiceChannelEvents(socket);

  // Ses kanalı UI olaylarını dinle
  setupVoiceChannelUIEvents(socket);

  console.log('Ses kanalı modülü başlatıldı');
}

/**
 * Ses kanalı olaylarını ayarlar
 * @param socket - Socket.io socket
 */
function setupVoiceChannelEvents(socket: Socket): void {
  // Kullanıcı ses kanalına katıldığında
  socket.on('userJoinedVoice', (data: { userId: string; username: string }) => {
    console.log(`${data.username} ses kanalına katıldı`);

    // Peer'i ekle
    voiceState.peers.set(data.userId, {
      id: data.userId,
      username: data.username,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false
    });

    // UI'ı güncelle
    updateVoiceChannelUI();
  });

  // Kullanıcı ses kanalından ayrıldığında
  socket.on('userLeftVoice', (data: { userId: string; username: string }) => {
    console.log(`${data.username} ses kanalından ayrıldı`);

    // Peer'i kaldır
    voiceState.peers.delete(data.userId);

    // Consumer'ı kapat
    const consumer = window.consumers.get(data.userId);
    if (consumer) {
      consumer.close();
      window.consumers.delete(data.userId);
    }

    // UI'ı güncelle
    updateVoiceChannelUI();
  });

  // Kullanıcı mikrofon durumunu değiştirdiğinde
  socket.on('userMuteChanged', (data: { userId: string; isMuted: boolean }) => {
    const peer = voiceState.peers.get(data.userId);
    if (peer) {
      peer.isMuted = data.isMuted;
      updateVoiceChannelUI();
    }
  });

  // Kullanıcı kulaklık durumunu değiştirdiğinde
  socket.on('userDeafenChanged', (data: { userId: string; isDeafened: boolean }) => {
    const peer = voiceState.peers.get(data.userId);
    if (peer) {
      peer.isDeafened = data.isDeafened;
      updateVoiceChannelUI();
    }
  });

  // Kullanıcı konuşma durumunu değiştirdiğinde
  socket.on('userSpeakingChanged', (data: { userId: string; isSpeaking: boolean }) => {
    const peer = voiceState.peers.get(data.userId);
    if (peer) {
      peer.isSpeaking = data.isSpeaking;
      updateVoiceChannelUI();
    }
  });

  // RTP yetenekleri alındığında
  socket.on('rtpCapabilities', (data: { rtpCapabilities: any }) => {
    loadDevice(data.rtpCapabilities);
  });

  // Transport oluşturulduğunda
  socket.on('transportCreated', (data: {
    id: string;
    iceParameters: any;
    iceCandidates: any[];
    dtlsParameters: any;
    direction: 'send' | 'recv';
  }) => {
    if (data.direction === 'send') {
      createSendTransport(data, socket);
    } else {
      createRecvTransport(data, socket);
    }
  });

  // Yeni consumer oluşturulduğunda
  socket.on('newConsumer', async (data: {
    peerId: string;
    producerId: string;
    id: string;
    kind: 'audio' | 'video';
    rtpParameters: any;
    appData: any;
  }, callback: (response: { consumed: boolean }) => void) => {
    try {
      await consumeTrack(data);
      callback({ consumed: true });
    } catch (error) {
      console.error('Consumer oluşturma hatası:', error);
      callback({ consumed: false });
    }
  });
}

/**
 * Ses kanalı UI olaylarını ayarlar
 * @param socket - Socket.io socket
 */
function setupVoiceChannelUIEvents(socket: Socket): void {
  // Ses kanallarına tıklama olayı
  const voiceChannels = document.querySelectorAll('.voice-channel');
  voiceChannels.forEach(channel => {
    channel.addEventListener('click', async () => {
      const channelId = channel.getAttribute('data-channel-id');
      if (!channelId) return;

      if (voiceState.currentChannelId === channelId) {
        // Zaten bu kanaldaysak, çık
        await leaveVoiceChannel(socket);
      } else {
        // Yeni kanala katıl
        await joinVoiceChannel(channelId, socket);
      }
    });
  });

  // Mikrofon düğmesi
  const toggleMicBtn = document.getElementById('toggle-mic-btn');
  if (toggleMicBtn) {
    toggleMicBtn.addEventListener('click', () => {
      toggleMicrophone(socket);
    });
  }

  // Görüşmeden ayrılma düğmesi
  const leaveCallBtn = document.getElementById('leave-call-btn');
  if (leaveCallBtn) {
    leaveCallBtn.addEventListener('click', () => {
      leaveVoiceChannel(socket);
    });
  }

  // Sesli arama düğmesi
  const voiceCallBtn = document.getElementById('voice-call-btn');
  if (voiceCallBtn) {
    voiceCallBtn.addEventListener('click', () => {
      // Aktif kanal varsa ona katıl, yoksa genel kanala katıl
      const channelId = document.querySelector('.channel.active')?.getAttribute('data-channel-id') || 'voice-general';
      joinVoiceChannel(channelId, socket);
    });
  }
}

/**
 * Mediasoup cihazını yükler
 * @param routerRtpCapabilities - Router RTP yetenekleri
 */
async function loadDevice(routerRtpCapabilities: any): Promise<void> {
  try {
    // Mediasoup-client kütüphanesini kontrol et
    if (typeof window.mediasoupClient === 'undefined') {
      console.error('mediasoup-client kütüphanesi yüklenmemiş');
      return;
    }

    // Cihazı oluştur
    const device = new window.mediasoupClient.Device();

    // Cihazı yükle
    await device.load({ routerRtpCapabilities });

    // Global değişkene ata
    window.mediasoupDevice = device;

    console.log('Mediasoup cihazı yüklendi');
  } catch (error) {
    console.error('Mediasoup cihazı yüklenirken hata oluştu:', error);
  }
}

/**
 * Gönderme transportunu oluşturur
 * @param transportOptions - Transport seçenekleri
 * @param socket - Socket.io socket
 */
async function createSendTransport(transportOptions: any, socket: Socket): Promise<void> {
  try {
    if (!window.mediasoupDevice) {
      throw new Error('Mediasoup cihazı yüklenmemiş');
    }

    // Transport oluştur
    const transport = window.mediasoupDevice.createSendTransport(transportOptions);

    // Transport olaylarını dinle
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Sunucuya transport bağlantı isteği gönder
        await new Promise<void>((resolve, reject) => {
          socket.emit('connectTransport', {
            transportId: transport.id,
            dtlsParameters
          }, (response: { connected: boolean }) => {
            if (response.connected) {
              resolve();
            } else {
              reject(new Error('Transport bağlantısı başarısız'));
            }
          });
        });

        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    // Produce olayını dinle
    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        // Sunucuya produce isteği gönder
        const { id } = await new Promise<{ id: string }>((resolve, reject) => {
          socket.emit('produce', {
            transportId: transport.id,
            kind,
            rtpParameters,
            appData
          }, (response: { id?: string; error?: string }) => {
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.id) {
              resolve({ id: response.id });
            } else {
              reject(new Error('Geçersiz sunucu yanıtı'));
            }
          });
        });

        callback({ id });
      } catch (error) {
        errback(error as Error);
      }
    });

    // Global değişkene ata
    window.sendTransport = transport;

    console.log('Gönderme transportu oluşturuldu');

    // Mikrofon akışını başlat
    await startLocalMedia();
  } catch (error) {
    console.error('Gönderme transportu oluşturulurken hata oluştu:', error);
  }
}

/**
 * Alma transportunu oluşturur
 * @param transportOptions - Transport seçenekleri
 * @param socket - Socket.io socket
 */
async function createRecvTransport(transportOptions: any, socket: Socket): Promise<void> {
  try {
    if (!window.mediasoupDevice) {
      throw new Error('Mediasoup cihazı yüklenmemiş');
    }

    // Transport oluştur
    const transport = window.mediasoupDevice.createRecvTransport(transportOptions);

    // Transport olaylarını dinle
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Sunucuya transport bağlantı isteği gönder
        await new Promise<void>((resolve, reject) => {
          socket.emit('connectTransport', {
            transportId: transport.id,
            dtlsParameters
          }, (response: { connected: boolean }) => {
            if (response.connected) {
              resolve();
            } else {
              reject(new Error('Transport bağlantısı başarısız'));
            }
          });
        });

        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    // Global değişkene ata
    window.recvTransport = transport;

    console.log('Alma transportu oluşturuldu');
  } catch (error) {
    console.error('Alma transportu oluşturulurken hata oluştu:', error);
  }
}

/**
 * Yerel medya akışını başlatır
 */
async function startLocalMedia(): Promise<void> {
  try {
    // Mikrofon erişimi iste
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Global değişkene ata
    window.localStream = stream;

    // Audio track'i al
    const audioTrack = stream.getAudioTracks()[0];

    if (!window.sendTransport) {
      throw new Error('Gönderme transportu oluşturulmamış');
    }

    // Audio producer oluştur
    const producer = await window.sendTransport.produce({
      track: audioTrack,
      codecOptions: {
        opusStereo: true,
        opusDtx: true
      }
    });

    // Global değişkene ata
    window.audioProducer = producer;

    console.log('Mikrofon akışı başlatıldı');

    // Mikrofon durumunu güncelle
    if (voiceState.isMuted) {
      producer.pause();
    }
  } catch (error) {
    console.error('Mikrofon akışı başlatılırken hata oluştu:', error);
    alert('Mikrofon erişimi alınamadı. Lütfen tarayıcı izinlerini kontrol edin.');
  }
}

/**
 * Uzak kullanıcının track'ini tüketir
 * @param consumerOptions - Consumer seçenekleri
 */
async function consumeTrack(consumerOptions: {
  peerId: string;
  producerId: string;
  id: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
  appData: any;
}): Promise<void> {
  try {
    if (!window.recvTransport) {
      throw new Error('Alma transportu oluşturulmamış');
    }

    if (!window.mediasoupDevice) {
      throw new Error('Mediasoup cihazı yüklenmemiş');
    }

    // RTP yeteneklerini kontrol et
    if (!window.mediasoupDevice.rtpCapabilities) {
      throw new Error('RTP yetenekleri tanımlanmamış');
    }

    // Consumer oluştur
    const consumer = await window.recvTransport.consume({
      id: consumerOptions.id,
      producerId: consumerOptions.producerId,
      kind: consumerOptions.kind,
      rtpParameters: consumerOptions.rtpParameters,
      appData: { ...consumerOptions.appData, peerId: consumerOptions.peerId }
    });

    // Consumer'ı sakla
    window.consumers.set(consumerOptions.peerId, consumer);

    // Audio elementi oluştur ve ekle
    if (consumerOptions.kind === 'audio') {
      const audioElement = document.createElement('audio');
      audioElement.id = `audio-${consumerOptions.peerId}`;
      audioElement.srcObject = new MediaStream([consumer.track]);
      audioElement.autoplay = true;

      // Ses seviyesini ayarla (kulaklık durumuna göre)
      audioElement.volume = voiceState.isDeafened ? 0 : 1;

      // Gizli olarak ekle
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);
    }

    // Consumer'ı başlat
    await consumer.resume();

    console.log(`${consumerOptions.kind} consumer oluşturuldu:`, consumerOptions.peerId);
  } catch (error) {
    console.error('Track tüketilirken hata oluştu:', error);
  }
}

/**
 * Ses kanalına katılır
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 */
async function joinVoiceChannel(channelId: string, socket: Socket): Promise<void> {
  try {
    // Zaten bir kanaldaysak, önce çıkalım
    if (voiceState.isConnected) {
      await leaveVoiceChannel(socket);
    }

    console.log(`Ses kanalına katılınıyor: ${channelId}`);

    // Medya konteynerini göster
    const mediaContainer = document.getElementById('media-container');
    if (mediaContainer) {
      mediaContainer.style.display = 'flex';
    }

    // Kanal durumunu güncelle
    voiceState.isConnected = true;
    voiceState.currentChannelId = channelId;
    window.currentVoiceChannel = channelId;

    // Sunucuya katılma isteği gönder
    socket.emit('joinVoiceChannel', { channelId }, async (response: {
      joined: boolean;
      rtpCapabilities?: any;
      error?: string;
    }) => {
      if (response.joined && response.rtpCapabilities) {
        // Mediasoup cihazını yükle
        await loadDevice(response.rtpCapabilities);

        // Transport oluşturma isteği gönder
        socket.emit('createTransport', { direction: 'send' });
        socket.emit('createTransport', { direction: 'recv' });

        // UI'ı güncelle
        updateVoiceChannelUI();
      } else {
        console.error('Ses kanalına katılma hatası:', response.error);
        voiceState.isConnected = false;
        voiceState.currentChannelId = null;
        window.currentVoiceChannel = null;

        // Medya konteynerini gizle
        if (mediaContainer) {
          mediaContainer.style.display = 'none';
        }
      }
    });
  } catch (error) {
    console.error('Ses kanalına katılırken hata oluştu:', error);

    // Hata durumunda temizlik yap
    voiceState.isConnected = false;
    voiceState.currentChannelId = null;
    window.currentVoiceChannel = null;

    // Medya konteynerini gizle
    const mediaContainer = document.getElementById('media-container');
    if (mediaContainer) {
      mediaContainer.style.display = 'none';
    }
  }
}

/**
 * Ses kanalından ayrılır
 * @param socket - Socket.io socket
 */
async function leaveVoiceChannel(socket: Socket): Promise<void> {
  try {
    if (!voiceState.isConnected) return;

    console.log('Ses kanalından ayrılınıyor');

    // Sunucuya ayrılma isteği gönder
    socket.emit('leaveVoiceChannel');

    // Kaynakları temizle
    cleanupMediaResources();

    // Kanal durumunu güncelle
    voiceState.isConnected = false;
    voiceState.currentChannelId = null;
    window.currentVoiceChannel = null;
    voiceState.peers.clear();

    // Medya konteynerini gizle
    const mediaContainer = document.getElementById('media-container');
    if (mediaContainer) {
      mediaContainer.style.display = 'none';
    }

    // UI'ı güncelle
    updateVoiceChannelUI();

    console.log('Ses kanalından ayrıldı');
  } catch (error) {
    console.error('Ses kanalından ayrılırken hata oluştu:', error);
  }
}

/**
 * Mikrofonu açar/kapatır
 * @param socket - Socket.io socket
 */
function toggleMicrophone(socket: Socket): void {
  try {
    if (!voiceState.isConnected) return;

    // Mikrofon durumunu tersine çevir
    voiceState.isMuted = !voiceState.isMuted;

    // Audio producer'ı güncelle
    if (window.audioProducer) {
      if (voiceState.isMuted) {
        window.audioProducer.pause();
      } else {
        window.audioProducer.resume();
      }
    }

    // Sunucuya bildir
    socket.emit('setMicrophoneStatus', { isMuted: voiceState.isMuted });

    // UI'ı güncelle
    updateVoiceChannelUI();

    console.log(`Mikrofon ${voiceState.isMuted ? 'kapatıldı' : 'açıldı'}`);
  } catch (error) {
    console.error('Mikrofon durumu değiştirilirken hata oluştu:', error);
  }
}

/**
 * Medya kaynaklarını temizler
 */
function cleanupMediaResources(): void {
  // Audio producer'ı kapat
  if (window.audioProducer) {
    window.audioProducer.close();
    window.audioProducer = null;
  }

  // Video producer'ı kapat
  if (window.videoProducer) {
    window.videoProducer.close();
    window.videoProducer = null;
  }

  // Consumer'ları kapat
  window.consumers.forEach(consumer => {
    consumer.close();

    // Audio elementini kaldır
    const audioElement = document.getElementById(`audio-${consumer.appData.peerId}`);
    if (audioElement) {
      audioElement.remove();
    }
  });
  window.consumers.clear();

  // Transportları kapat
  if (window.sendTransport) {
    window.sendTransport.close();
    window.sendTransport = null;
  }

  if (window.recvTransport) {
    window.recvTransport.close();
    window.recvTransport = null;
  }

  // Yerel medya akışını kapat
  if (window.localStream) {
    window.localStream.getTracks().forEach(track => track.stop());
    window.localStream = null;
  }

  // Mediasoup cihazını temizle
  window.mediasoupDevice = null;
}

/**
 * Ses kanalı UI'ını günceller
 */
function updateVoiceChannelUI(): void {
  // Ses kanallarını güncelle
  const voiceChannels = document.querySelectorAll('.voice-channel');
  voiceChannels.forEach(channel => {
    const channelId = channel.getAttribute('data-channel-id');
    const isActive = channelId === voiceState.currentChannelId;

    // Aktif kanalı işaretle
    if (isActive) {
      channel.classList.add('active');
    } else {
      channel.classList.remove('active');
    }

    // Kanal kullanıcılarını güncelle
    const channelUsers = channel.querySelector('.channel-users');
    if (channelUsers && isActive) {
      // Kullanıcı listesini temizle
      channelUsers.innerHTML = '';

      // Kullanıcıları ekle
      voiceState.peers.forEach(peer => {
        const userElement = document.createElement('div');
        userElement.className = 'channel-user';
        userElement.innerHTML = `
          <div class="channel-user-avatar">${peer.username.charAt(0)}</div>
          <div class="channel-user-name">${peer.username}</div>
          <div class="channel-user-status">
            ${peer.isMuted ? '<span class="material-icons" style="color: var(--color-danger);">mic_off</span>' : ''}
            ${peer.isDeafened ? '<span class="material-icons" style="color: var(--color-warning);">hearing_disabled</span>' : ''}
            ${peer.isSpeaking ? '<span class="material-icons" style="color: var(--color-success);">volume_up</span>' : ''}
          </div>
        `;
        channelUsers.appendChild(userElement);
      });

      // Kendimizi ekle
      const userElement = document.createElement('div');
      userElement.className = 'channel-user';
      userElement.innerHTML = `
        <div class="channel-user-avatar">S</div>
        <div class="channel-user-name">Sen</div>
        <div class="channel-user-status">
          ${voiceState.isMuted ? '<span class="material-icons" style="color: var(--color-danger);">mic_off</span>' : ''}
          ${voiceState.isDeafened ? '<span class="material-icons" style="color: var(--color-warning);">hearing_disabled</span>' : ''}
        </div>
      `;
      channelUsers.appendChild(userElement);
    } else if (channelUsers) {
      channelUsers.innerHTML = '';
    }
  });

  // Mikrofon düğmesini güncelle
  const toggleMicBtn = document.getElementById('toggle-mic-btn');
  if (toggleMicBtn) {
    const micIcon = toggleMicBtn.querySelector('.material-icons');
    if (micIcon) {
      micIcon.textContent = voiceState.isMuted ? 'mic_off' : 'mic';
    }

    if (voiceState.isMuted) {
      toggleMicBtn.classList.add('active');
    } else {
      toggleMicBtn.classList.remove('active');
    }
  }

  // Medya başlığını güncelle
  const mediaTitle = document.querySelector('.media-title');
  if (mediaTitle && voiceState.currentChannelId) {
    const channelName = document.querySelector(`.voice-channel[data-channel-id="${voiceState.currentChannelId}"] .channel-name`)?.textContent || 'Ses Kanalı';
    mediaTitle.textContent = `${channelName} - Sesli Görüşme`;
  }
}

// Global değişkene fonksiyonları ata
window.voiceChannelModule = {
  initVoiceChannel,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMicrophone
};