// Voice Channel Handler
// MediasoupHandler sınıfını doğrudan kullan
// ScreenShareHandler ve VideoChatHandler sınıflarını import et
import ScreenShareHandler from './screen-share.js';
import VideoChatHandler from './video-chat.js';

class VoiceChannelHandler {
  constructor(socket) {
    this.socket = socket;
    this.mediasoup = new MediasoupHandler(socket);
    this.screenShare = new ScreenShareHandler(this.mediasoup);
    this.videoChat = new VideoChatHandler(this.mediasoup);
    this.currentChannelId = null;
    this.peers = new Map();
    this.audioElements = new Map();
    this.videoElements = new Map();
    this.isMuted = false;
    this.isDeafened = false;

    // Mediasoup olaylarını dinle
    this.mediasoup.onNewConsumer = this.handleNewConsumer.bind(this);
    this.mediasoup.onConsumerClosed = this.handleConsumerClosed.bind(this);
    this.mediasoup.onPeerJoined = this.handlePeerJoined.bind(this);
    this.mediasoup.onPeerLeft = this.handlePeerLeft.bind(this);

    // Ekran paylaşımı olaylarını dinle
    this.screenShare.onScreenShareStarted = this.handleScreenShareStarted.bind(this);
    this.screenShare.onScreenShareStopped = this.handleScreenShareStopped.bind(this);
    this.screenShare.onScreenShareError = this.handleScreenShareError.bind(this);

    // Video iletişimi olaylarını dinle
    this.videoChat.onVideoStarted = this.handleVideoStarted.bind(this);
    this.videoChat.onVideoStopped = this.handleVideoStopped.bind(this);
    this.videoChat.onVideoError = this.handleVideoError.bind(this);

    // Socket.IO olaylarını dinle
    this.socket.on('mediasoup:new-screen-share', this.handleNewScreenShare.bind(this));
    this.socket.on('mediasoup:screen-share-stopped', this.handleScreenShareStopped.bind(this));
    this.socket.on('mediasoup:new-video', this.handleNewVideo.bind(this));
    this.socket.on('mediasoup:video-stopped', this.handleVideoStopped.bind(this));
  }

  // Ses kanalına katıl
  async joinVoiceChannel(channelId) {
    try {
      // Zaten bir kanaldaysak, önce çıkalım
      if (this.currentChannelId) {
        await this.leaveVoiceChannel();
      }

      this.currentChannelId = channelId;

      // Mediasoup cihazını yükle
      const deviceLoaded = await this.mediasoup.loadDevice(channelId);
      if (!deviceLoaded) {
        throw new Error('Mediasoup cihazı yüklenemedi');
      }

      // Medya akışını başlat
      const mediaStarted = await this.mediasoup.startMedia();
      if (!mediaStarted) {
        throw new Error('Medya akışı başlatılamadı');
      }

      // Ses seviyesi göstergesini başlat
      if (window.audioLevelIndicator) {
        await window.audioLevelIndicator.startMicrophoneStream();

        // Mikrofon ses seviyesi göstergesini oluştur
        window.audioLevelIndicator.createIndicator('micAudioLevelIndicator', 'local');
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();

      console.log(`Ses kanalına katıldı: ${channelId}`);

      return true;
    } catch (error) {
      console.error('Ses kanalına katılırken hata oluştu:', error);
      this.currentChannelId = null;
      return false;
    }
  }

  // Ses kanalından ayrıl
  async leaveVoiceChannel() {
    try {
      if (!this.currentChannelId) {
        return true;
      }

      // Mediasoup odadan ayrıl
      await this.mediasoup.leaveRoom();

      // Tüm medya akışlarını temizle
      await this.cleanupMedia();

      // Ses seviyesi göstergesini durdur
      if (window.audioLevelIndicator) {
        window.audioLevelIndicator.stopMicrophoneStream();
        window.audioLevelIndicator.removeAllIndicators();
      }

      const channelId = this.currentChannelId;
      this.currentChannelId = null;

      // Kullanıcı arayüzünü güncelle
      this.updateUI();

      console.log(`Ses kanalından ayrıldı: ${channelId}`);

      return true;
    } catch (error) {
      console.error('Ses kanalından ayrılırken hata oluştu:', error);
      return false;
    }
  }

  // Tüm medya akışlarını temizle
  async cleanupMedia() {
    try {
      // Ekran paylaşımını durdur
      await this.stopScreenShare();

      // Video iletişimini durdur
      await this.videoChat.stopVideo();

      // Tüm ses elementlerini temizle
      this.audioElements.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
      this.audioElements.clear();

      // Tüm video elementlerini temizle
      this.videoElements.forEach((video) => {
        video.srcObject = null;
        video.remove();
      });
      this.videoElements.clear();

      // Peer listesini temizle
      this.peers.clear();

      return true;
    } catch (error) {
      console.error('Medya akışları temizlenirken hata oluştu:', error);
      return false;
    }
  }

  // Mikrofonu aç/kapat
  async toggleMute() {
    try {
      if (!this.currentChannelId) {
        return false;
      }

      this.isMuted = !this.isMuted;

      // Tüm ses üreticilerini aç/kapat
      this.mediasoup.producers.forEach((producer) => {
        if (producer.kind === 'audio') {
          producer.pause();

          if (!this.isMuted) {
            producer.resume();
          }
        }
      });

      // Ses seviyesi göstergesini güncelle
      if (window.audioLevelIndicator) {
        window.audioLevelIndicator.setMuted(this.isMuted);
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();

      return this.isMuted;
    } catch (error) {
      console.error('Mikrofon durumu değiştirilirken hata oluştu:', error);
      return false;
    }
  }

  // Hoparlörü aç/kapat
  async toggleDeafen() {
    try {
      if (!this.currentChannelId) {
        return false;
      }

      this.isDeafened = !this.isDeafened;

      // Tüm ses tüketicilerini aç/kapat
      this.audioElements.forEach((audio) => {
        audio.muted = this.isDeafened;
      });

      // Eğer hoparlör kapatıldıysa, mikrofonu da kapat
      if (this.isDeafened && !this.isMuted) {
        await this.toggleMute();
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();

      return true;
    } catch (error) {
      console.error('Hoparlör durumu değiştirilirken hata oluştu:', error);
      return false;
    }
  }

  // Yeni consumer oluşturulduğunda
  handleNewConsumer(consumer, peerId) {
    try {
      // Peer bilgilerini al
      const peer = this.peers.get(peerId) || { id: peerId };
      this.peers.set(peerId, peer);

      // Consumer'ın türüne göre işlem yap
      if (consumer.kind === 'audio') {
        // Ses elementi oluştur
        const audioId = `audio-${consumer.id}`;
        let audioElement = document.getElementById(audioId);

        if (!audioElement) {
          audioElement = document.createElement('audio');
          audioElement.id = audioId;
          audioElement.autoplay = true;
          audioElement.muted = this.isDeafened;
          document.body.appendChild(audioElement);
        }

        // MediaStream oluştur
        const stream = new MediaStream();
        stream.addTrack(consumer.track);
        audioElement.srcObject = stream;

        // Ses elementini sakla
        this.audioElements.set(consumer.id, audioElement);
      } else if (consumer.kind === 'video') {
        // Consumer'ın appData'sına göre işlem yap
        if (consumer.appData && consumer.appData.screenShare) {
          // Ekran paylaşımı videosu
          const screenShareVideo = document.getElementById('screenShareVideo');
          if (screenShareVideo) {
            const stream = new MediaStream();
            stream.addTrack(consumer.track);
            screenShareVideo.srcObject = stream;

            // Ekran paylaşımı konteynerini göster
            const screenShareContainer = document.getElementById('screenShareContainer');
            if (screenShareContainer) {
              screenShareContainer.style.display = 'block';
            }
          }
        } else {
          // Normal video
          const videoId = `video-${consumer.id}`;
          let videoElement = document.getElementById(videoId);

          if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = videoId;
            videoElement.className = 'remote-video';
            videoElement.autoplay = true;
            videoElement.playsInline = true;

            // Video konteynerine ekle
            const remoteVideosContainer = document.getElementById('remoteVideos');
            if (remoteVideosContainer) {
              remoteVideosContainer.appendChild(videoElement);
            }
          }

          // MediaStream oluştur
          const stream = new MediaStream();
          stream.addTrack(consumer.track);
          videoElement.srcObject = stream;

          // Video elementini sakla
          this.videoElements.set(consumer.id, videoElement);

          // Video konteynerini göster
          const videoContainer = document.getElementById('videoContainer');
          if (videoContainer) {
            videoContainer.style.display = 'flex';
          }
        }
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Yeni consumer oluşturulurken hata oluştu:', error);
    }
  }

  // Consumer kapatıldığında
  handleConsumerClosed(consumerId, peerId) {
    try {
      // Ses elementini kaldır
      const audioElement = this.audioElements.get(consumerId);
      if (audioElement) {
        audioElement.srcObject = null;
        audioElement.remove();
        this.audioElements.delete(consumerId);
      }

      // Video elementini kaldır
      const videoElement = this.videoElements.get(consumerId);
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.remove();
        this.videoElements.delete(consumerId);

        // Eğer hiç video kalmadıysa, video konteynerini gizle
        if (this.videoElements.size === 0 && !this.videoChat.isVideoEnabled) {
          const videoContainer = document.getElementById('videoContainer');
          if (videoContainer) {
            videoContainer.style.display = 'none';
          }
        }
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Consumer kapatılırken hata oluştu:', error);
    }
  }

  // Kullanıcı katıldığında
  handlePeerJoined(peerId, username) {
    try {
      // Peer bilgilerini sakla
      this.peers.set(peerId, { id: peerId, username });

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Kullanıcı katılırken hata oluştu:', error);
    }
  }

  // Kullanıcı ayrıldığında
  handlePeerLeft(peerId) {
    try {
      // Peer bilgilerini temizle
      this.peers.delete(peerId);

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Kullanıcı ayrılırken hata oluştu:', error);
    }
  }

  // Ekran paylaşımını başlat
  async startScreenShare() {
    try {
      if (!this.currentChannelId) {
        throw new Error('Önce bir ses kanalına katılmalısınız');
      }

      const producer = await this.screenShare.startScreenShare();

      return producer;
    } catch (error) {
      console.error('Ekran paylaşımı başlatılırken hata oluştu:', error);
      return null;
    }
  }

  // Ekran paylaşımını durdur
  async stopScreenShare() {
    try {
      return await this.screenShare.stopScreenShare();
    } catch (error) {
      console.error('Ekran paylaşımı durdurulurken hata oluştu:', error);
      return false;
    }
  }

  // Ekran paylaşımı durumunu değiştir
  async toggleScreenShare() {
    return await this.screenShare.toggleScreenShare();
  }

  // Ekran paylaşımı başladığında
  handleScreenShareStarted(producer) {
    try {
      console.log('Ekran paylaşımı başladı');

      // Ekran paylaşımı butonunu güncelle
      const screenShareButton = document.getElementById('screenShareButton');
      if (screenShareButton) {
        screenShareButton.classList.add('active');
      }

      // Ekran paylaşımı konteynerini göster
      const screenShareContainer = document.getElementById('screenShareContainer');
      if (screenShareContainer) {
        screenShareContainer.style.display = 'block';
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Ekran paylaşımı başlatılırken hata oluştu:', error);
    }
  }

  // Ekran paylaşımı durduğunda
  handleScreenShareStopped() {
    try {
      console.log('Ekran paylaşımı durduruldu');

      // Ekran paylaşımı butonunu güncelle
      const screenShareButton = document.getElementById('screenShareButton');
      if (screenShareButton) {
        screenShareButton.classList.remove('active');
      }

      // Ekran paylaşımı konteynerini gizle
      const screenShareContainer = document.getElementById('screenShareContainer');
      if (screenShareContainer) {
        screenShareContainer.style.display = 'none';
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Ekran paylaşımı durdurulurken hata oluştu:', error);
    }
  }

  // Ekran paylaşımı hatası
  handleScreenShareError(error) {
    console.error('Ekran paylaşımı hatası:', error);

    // Kullanıcıya hata mesajı göster
    alert(`Ekran paylaşımı hatası: ${error.message || 'Bilinmeyen hata'}`);
  }

  // Yeni ekran paylaşımı
  handleNewScreenShare({ producerId, peerId, username }) {
    try {
      console.log(`Yeni ekran paylaşımı: ${username}`);

      // Ekran paylaşımı konteynerini göster
      const screenShareContainer = document.getElementById('screenShareContainer');
      if (screenShareContainer) {
        screenShareContainer.style.display = 'block';
      }

      // Ekran paylaşımı başlığını güncelle
      const screenShareTitle = document.getElementById('screenShareTitle');
      if (screenShareTitle) {
        screenShareTitle.textContent = `${username} ekranını paylaşıyor`;
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Yeni ekran paylaşımı işlenirken hata oluştu:', error);
    }
  }

  // Video iletişimi başladığında
  handleVideoStarted(producer, stream) {
    try {
      console.log('Video iletişimi başladı');

      // Video butonunu güncelle
      const videoButton = document.getElementById('videoButton');
      if (videoButton) {
        videoButton.classList.add('active');
      }

      // Yerel video önizlemesini göster
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = stream;
        localVideo.style.display = 'block';
      }

      // Video konteynerini göster
      const videoContainer = document.getElementById('videoContainer');
      if (videoContainer) {
        videoContainer.style.display = 'flex';
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Video iletişimi başlatılırken hata oluştu:', error);
    }
  }

  // Video iletişimi durduğunda
  handleVideoStopped({ peerId, producerId } = {}) {
    try {
      console.log('Video iletişimi durduruldu');

      // Video butonunu güncelle
      const videoButton = document.getElementById('videoButton');
      if (videoButton) {
        videoButton.classList.remove('active');
      }

      // Yerel video önizlemesini gizle
      const localVideo = document.getElementById('localVideo');
      if (localVideo && (!peerId || peerId === this.socket.id)) {
        localVideo.srcObject = null;
        localVideo.style.display = 'none';
      }

      // Uzak video elementini kaldır
      if (peerId && producerId) {
        const videoElement = this.videoElements.get(producerId);
        if (videoElement) {
          videoElement.srcObject = null;
          videoElement.remove();
          this.videoElements.delete(producerId);
        }
      }

      // Eğer hiç video kalmadıysa, video konteynerini gizle
      if (this.videoElements.size === 0 && !this.videoChat.isVideoEnabled) {
        const videoContainer = document.getElementById('videoContainer');
        if (videoContainer) {
          videoContainer.style.display = 'none';
        }
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Video iletişimi durdurulurken hata oluştu:', error);
    }
  }

  // Video iletişimi hatası
  handleVideoError(error) {
    console.error('Video iletişimi hatası:', error);

    // Kullanıcıya hata mesajı göster
    alert(`Video iletişimi hatası: ${error.message || 'Bilinmeyen hata'}`);
  }

  // Yeni video iletişimi
  handleNewVideo({ producerId, peerId, username }) {
    try {
      console.log(`Yeni video iletişimi: ${username}`);

      // Video konteynerini göster
      const videoContainer = document.getElementById('videoContainer');
      if (videoContainer) {
        videoContainer.style.display = 'flex';
      }

      // Kullanıcı arayüzünü güncelle
      this.updateUI();
    } catch (error) {
      console.error('Yeni video iletişimi işlenirken hata oluştu:', error);
    }
  }

  // Kullanıcı arayüzünü güncelle
  updateUI() {
    try {
      // Ses kanalı kullanıcıları listesini güncelle
      const userListElement = document.getElementById('voiceChannelUsers');
      if (userListElement) {
        userListElement.innerHTML = '';

        // Kullanıcıları listele
        this.peers.forEach((peer) => {
          const userElement = document.createElement('div');
          userElement.className = 'voice-user-item';
          userElement.dataset.id = peer.id;

          const userAvatar = document.createElement('div');
          userAvatar.className = 'voice-user-avatar';
          userAvatar.textContent = peer.username ? peer.username.substring(0, 2).toUpperCase() : '??';

          const userName = document.createElement('div');
          userName.className = 'voice-user-name';
          userName.textContent = peer.username || 'Bilinmeyen Kullanıcı';

          const userStatus = document.createElement('div');
          userStatus.className = 'voice-user-status';
          userStatus.innerHTML = '<span class="material-icons">mic</span>';

          // Ekran paylaşımı durumunu göster
          if (peer.isScreenSharing) {
            const screenShareIcon = document.createElement('span');
            screenShareIcon.className = 'material-icons screen-share-icon';
            screenShareIcon.textContent = 'screen_share';
            userStatus.appendChild(screenShareIcon);
          }

          userElement.appendChild(userAvatar);
          userElement.appendChild(userName);
          userElement.appendChild(userStatus);

          userListElement.appendChild(userElement);
        });
      }

      // Mikrofon ve hoparlör butonlarını güncelle
      const muteButton = document.getElementById('muteButton');
      if (muteButton) {
        muteButton.classList.toggle('active', this.isMuted);
        muteButton.querySelector('.material-icons').textContent = this.isMuted ? 'mic_off' : 'mic';
      }

      const deafenButton = document.getElementById('deafenButton');
      if (deafenButton) {
        deafenButton.classList.toggle('active', this.isDeafened);
        deafenButton.querySelector('.material-icons').textContent = this.isDeafened ? 'volume_off' : 'volume_up';
      }

      // Ekran paylaşımı butonunu güncelle
      const screenShareButton = document.getElementById('screenShareButton');
      if (screenShareButton) {
        screenShareButton.classList.toggle('active', this.screenShare.isScreenSharing);
      }

      // Kanal durumunu güncelle
      const channelStatusElement = document.getElementById('channelStatus');
      if (channelStatusElement) {
        channelStatusElement.textContent = this.currentChannelId ? 'Bağlı' : 'Bağlı Değil';
        channelStatusElement.className = this.currentChannelId ? 'status-connected' : 'status-disconnected';
      }
    } catch (error) {
      console.error('Kullanıcı arayüzü güncellenirken hata oluştu:', error);
    }
  }
}

export default VoiceChannelHandler;
