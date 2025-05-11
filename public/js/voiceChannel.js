/**
 * public/js/voiceChannel.js
 * Ses kanalı işlevselliği
 * WebRTC ve Socket.io kullanarak ses iletişimi sağlar
 */

// Tüm kodu bir IIFE (Immediately Invoked Function Expression) içine alarak global scope'u kirletmiyoruz
(function() {
  // Ses kanalı durumunu tutan değişken
  const voiceState = {
    localStream: null,
    peerConnections: {},
    currentRoom: null,
    micEnabled: true,
    deafened: false,
  };

  // Global olarak erişilebilir olması için window nesnesine ekle
  window.voiceState = voiceState;

  // Ses kanalı UI elementleri
  let voiceChannelStatus;
  let micToggleBtn;
  let deafenToggleBtn;
  let remoteAudioContainer;

  /**
   * Ses kanalı işlevselliğini başlatır
   * @param socket - Socket.io socket
   */
  function initVoiceChannel(socket) {
  console.log('Ses kanalı modülü başlatılıyor...');

  // UI elementlerini al
  voiceChannelStatus = document.getElementById('voiceChannelStatus');
  micToggleBtn = document.getElementById('toggle-mic-btn');
  deafenToggleBtn = document.getElementById('toggle-deafen-btn');
  remoteAudioContainer = document.getElementById('remote-audio-container');

  // Eğer remote audio container yoksa, oluştur
  if (!remoteAudioContainer) {
    remoteAudioContainer = document.createElement('div');
    remoteAudioContainer.id = 'remote-audio-container';
    remoteAudioContainer.style.display = 'none';
    document.body.appendChild(remoteAudioContainer);
  }

  // Ses kanalına katılma olayını dinle
  socket.on('userJoinedVoice', (data) => {
    console.log(`${data.username} ses kanalına katıldı`);
    createPeerConnection(data.userId, socket);
  });

  // Ses kanalından ayrılma olayını dinle
  socket.on('userLeftVoice', (data) => {
    console.log(`${data.username} ses kanalından ayrıldı`);
    closePeerConnection(data.userId);
  });

  // Offer olayını dinle
  socket.on('offer', async (data) => {
    console.log('Offer alındı:', data.from);
    await handleOffer(data.from, data.offer, socket);
  });

  // Answer olayını dinle
  socket.on('answer', async (data) => {
    console.log('Answer alındı:', data.from);
    await handleAnswer(data.from, data.answer);
  });

  // ICE candidate olayını dinle
  socket.on('iceCandidate', (data) => {
    console.log('ICE candidate alındı:', data.from);
    handleIceCandidate(data.from, data.candidate);
  });

  // Mikrofon düğmesini dinle
  if (micToggleBtn) {
    micToggleBtn.addEventListener('click', () => {
      toggleMicrophone();
      updateUIState();

      // Mikrofon durumunu sunucuya bildir
      socket.emit('updateMicState', {
        enabled: voiceState.micEnabled,
        channelId: voiceState.currentRoom
      });
    });
  }

  // Kulaklık düğmesini dinle
  if (deafenToggleBtn) {
    deafenToggleBtn.addEventListener('click', () => {
      toggleDeafen();
      updateUIState();
    });
  }

  console.log('Ses kanalı modülü başlatıldı');
  }

/**
 * Ses kanalına katılır
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 * @returns Promise
 */
  async function joinVoiceChannel(channelId, socket) {
  console.log('Ses kanalına katılma isteği:', channelId);

  try {
    // Eğer zaten bir ses kanalındaysak, önce oradan ayrılalım
    if (voiceState.currentRoom) {
      await leaveVoiceChannel(socket);
    }

    // Kullanıcıdan mikrofon erişimi isteyelim
    console.log('Mikrofon erişimi isteniyor...');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    console.log('Mikrofon erişimi alındı');
    voiceState.localStream = stream;
    voiceState.currentRoom = channelId;

    // Mikrofonu varsayılan olarak açık tut
    voiceState.micEnabled = true;
    voiceState.localStream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });

    // Ses kanalına katıldığımızı sunucuya bildirelim
    return new Promise((resolve, reject) => {
      socket.emit('joinVoiceChannel', { channelId }, (response) => {
        if (response.success) {
          console.log('Ses kanalına başarıyla katıldınız');

          // Kanalda bulunan diğer kullanıcılarla bağlantı kuralım
          if (response.users && response.users.length > 0) {
            response.users.forEach(userId => {
              createPeerConnection(userId, socket);
            });
          }

          // Ses kanalı durumunu göster
          showVoiceChannelStatus();
          updateUIState();
          resolve();
        } else {
          console.error('Ses kanalına katılırken bir hata oluştu:', response.error);
          reject(new Error(response.error || 'Bilinmeyen hata'));
        }
      });
    });
  } catch (error) {
    console.error('Mikrofon erişimi alınamadı:', error);
    alert('Mikrofon erişimi alınamadı. Lütfen tarayıcı izinlerini kontrol edin.');
    throw error;
  }
  }

  /**
   * Ses kanalından ayrılır
   * @param socket - Socket.io socket
   */
  async function leaveVoiceChannel(socket) {
  if (!voiceState.currentRoom) {
    return Promise.resolve();
  }

  console.log('Ses kanalından ayrılma isteği:', voiceState.currentRoom);

  // Tüm peer bağlantılarını kapat
  Object.keys(voiceState.peerConnections).forEach(userId => {
    closePeerConnection(userId);
  });

  // Yerel ses akışını kapat
  if (voiceState.localStream) {
    voiceState.localStream.getTracks().forEach(track => track.stop());
    voiceState.localStream = null;
  }

  // Ses kanalından ayrıldığımızı sunucuya bildirelim
  return new Promise((resolve) => {
    socket.emit('leaveVoiceChannel', { channelId: voiceState.currentRoom }, (response) => {
      if (response.success) {
        console.log('Ses kanalından başarıyla ayrıldınız');
      } else {
        console.error('Ses kanalından ayrılırken bir hata oluştu');
      }

      // Ses kanalı durumunu sıfırla
      voiceState.currentRoom = null;
      voiceState.peerConnections = {};

      // Ses kanalı durumunu gizle
      hideVoiceChannelStatus();
      resolve();
    });
  });
}

/**
 * Peer bağlantısı oluşturur
 * @param userId - Kullanıcı ID'si
 * @param socket - Socket.io socket
 */
async function createPeerConnection(userId, socket) {
  // Eğer zaten bir bağlantı varsa, önce onu kapatalım
  if (voiceState.peerConnections[userId]) {
    closePeerConnection(userId);
  }

  console.log('Peer bağlantısı oluşturuluyor:', userId);

  // ICE sunucularını tanımla
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // TURN sunucuları eklenebilir
      // {
      //   urls: 'turn:turn.example.com:3478',
      //   username: 'username',
      //   credential: 'password'
      // }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };

  // Yeni bir RTCPeerConnection oluştur
  const pc = new RTCPeerConnection(configuration);

  // Peer bağlantısını kaydet
  voiceState.peerConnections[userId] = {
    pc,
    iceCandidates: [],
  };

  // Yerel ses akışını ekle
  if (voiceState.localStream) {
    voiceState.localStream.getTracks().forEach(track => {
      if (voiceState.localStream) {
        pc.addTrack(track, voiceState.localStream);
      }
    });
  }

  // Uzak ses akışını işle
  pc.ontrack = event => {
    console.log('Uzak ses akışı alındı:', userId);
    const audioElement = document.createElement('audio');
    audioElement.id = `remote-audio-${userId}`;
    if (event.streams && event.streams.length > 0) {
      audioElement.srcObject = event.streams[0];
    }
    audioElement.autoplay = true;

    // Ses seviyesini ayarla (sağır modunda ses kapalı)
    audioElement.muted = voiceState.deafened;

    // Ses elementini sayfaya ekle
    if (remoteAudioContainer) {
      remoteAudioContainer.appendChild(audioElement);
    } else {
      document.body.appendChild(audioElement);
    }
  };

  // ICE candidate olayını dinle
  pc.onicecandidate = event => {
    if (event.candidate) {
      // ICE candidate'i karşı tarafa gönder
      socket.emit('sendIceCandidate', {
        to: userId,
        candidate: event.candidate,
      });

      // ICE candidate'i kaydet
      if (voiceState.peerConnections[userId]) {
        voiceState.peerConnections[userId].iceCandidates.push(event.candidate);
      }
    }
  };

  // Bağlantı durumu değişikliğini dinle
  pc.onconnectionstatechange = () => {
    console.log(`Peer bağlantı durumu (${userId}):`, pc.connectionState);
  };

  // Offer oluştur ve gönder
  try {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
    await pc.setLocalDescription(offer);

    // Offer'ı karşı tarafa gönder
    socket.emit('sendOffer', {
      to: userId,
      offer,
    });
  } catch (error) {
    console.error('Offer oluşturulurken bir hata oluştu:', error);
  }
}

/**
 * Offer'ı işler
 * @param userId - Kullanıcı ID'si
 * @param offer - Offer
 * @param socket - Socket.io socket
 */
async function handleOffer(userId, offer, socket) {
  // Eğer zaten bir bağlantı varsa, önce onu kapatalım
  if (voiceState.peerConnections[userId]) {
    closePeerConnection(userId);
  }

  console.log('Offer işleniyor:', userId);

  // ICE sunucularını tanımla
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };

  // Yeni bir RTCPeerConnection oluştur
  const pc = new RTCPeerConnection(configuration);

  // Peer bağlantısını kaydet
  voiceState.peerConnections[userId] = {
    pc,
    iceCandidates: [],
  };

  // Yerel ses akışını ekle
  if (voiceState.localStream) {
    voiceState.localStream.getTracks().forEach(track => {
      if (voiceState.localStream) {
        pc.addTrack(track, voiceState.localStream);
      }
    });
  }

  // Uzak ses akışını işle
  pc.ontrack = event => {
    console.log('Uzak ses akışı alındı:', userId);
    const audioElement = document.createElement('audio');
    audioElement.id = `remote-audio-${userId}`;
    if (event.streams && event.streams.length > 0) {
      audioElement.srcObject = event.streams[0];
    }
    audioElement.autoplay = true;

    // Ses seviyesini ayarla (sağır modunda ses kapalı)
    audioElement.muted = voiceState.deafened;

    // Ses elementini sayfaya ekle
    if (remoteAudioContainer) {
      remoteAudioContainer.appendChild(audioElement);
    } else {
      document.body.appendChild(audioElement);
    }
  };

  // ICE candidate olayını dinle
  pc.onicecandidate = event => {
    if (event.candidate) {
      // ICE candidate'i karşı tarafa gönder
      socket.emit('sendIceCandidate', {
        to: userId,
        candidate: event.candidate,
      });

      // ICE candidate'i kaydet
      if (voiceState.peerConnections[userId]) {
        voiceState.peerConnections[userId].iceCandidates.push(event.candidate);
      }
    }
  };

  // Bağlantı durumu değişikliğini dinle
  pc.onconnectionstatechange = () => {
    console.log(`Peer bağlantı durumu (${userId}):`, pc.connectionState);
  };

  // Offer'ı ayarla
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  // Answer oluştur ve gönder
  try {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Answer'ı karşı tarafa gönder
    socket.emit('sendAnswer', {
      to: userId,
      answer,
    });
  } catch (error) {
    console.error('Answer oluşturulurken bir hata oluştu:', error);
  }
}

/**
 * Answer'ı işler
 * @param userId - Kullanıcı ID'si
 * @param answer - Answer
 */
async function handleAnswer(userId, answer) {
  if (!voiceState.peerConnections[userId]) {
    return;
  }

  console.log('Answer işleniyor:', userId);

  try {
    await voiceState.peerConnections[userId].pc.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  } catch (error) {
    console.error('Answer ayarlanırken bir hata oluştu:', error);
  }
}

/**
 * ICE candidate'i işler
 * @param userId - Kullanıcı ID'si
 * @param candidate - ICE candidate
 */
async function handleIceCandidate(userId, candidate) {
  if (!voiceState.peerConnections[userId]) {
    return;
  }

  console.log('ICE candidate işleniyor:', userId);

  try {
    await voiceState.peerConnections[userId].pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('ICE candidate eklenirken bir hata oluştu:', error);
  }
}

/**
 * Peer bağlantısını kapatır
 * @param userId - Kullanıcı ID'si
 */
function closePeerConnection(userId) {
  if (!voiceState.peerConnections[userId]) {
    return;
  }

  console.log('Peer bağlantısı kapatılıyor:', userId);

  // Peer bağlantısını kapat
  voiceState.peerConnections[userId].pc.close();
  delete voiceState.peerConnections[userId];

  // Uzak ses elementini kaldır
  const audioElement = document.getElementById(`remote-audio-${userId}`);
  if (audioElement) {
    audioElement.remove();
  }
}

/**
 * Mikrofonu açar/kapatır
 */
  function toggleMicrophone() {
  if (!voiceState.localStream) {
    return;
  }

  console.log('Mikrofon durumu değiştiriliyor');

  voiceState.micEnabled = !voiceState.micEnabled;

  // Mikrofon durumunu güncelle
  voiceState.localStream.getAudioTracks().forEach(track => {
    track.enabled = voiceState.micEnabled;
  });

  console.log('Mikrofon durumu:', voiceState.micEnabled ? 'Açık' : 'Kapalı');
  }
  /**
   * Sağır modunu açar/kapatır
   */
  function toggleDeafen() {
  console.log('Sağır modu değiştiriliyor');

  voiceState.deafened = !voiceState.deafened;

  // Tüm uzak ses elementlerinin ses seviyesini güncelle
  Object.keys(voiceState.peerConnections).forEach(userId => {
    const audioElement = document.getElementById(`remote-audio-${userId}`);
    if (audioElement) {
      audioElement.muted = voiceState.deafened;
    }
  });

  console.log('Sağır modu:', voiceState.deafened ? 'Açık' : 'Kapalı');
  }

  /**
   * UI durumunu günceller
   */
  function updateUIState() {
    if (micToggleBtn) {
      micToggleBtn.classList.toggle('active', voiceState.micEnabled);
      const micIcon = micToggleBtn.querySelector('.material-icons');
      if (micIcon) {
        micIcon.textContent = voiceState.micEnabled ? 'mic' : 'mic_off';
      }
    }

    if (deafenToggleBtn) {
      deafenToggleBtn.classList.toggle('active', voiceState.deafened);
      const deafenIcon = deafenToggleBtn.querySelector('.material-icons');
      if (deafenIcon) {
        deafenIcon.textContent = voiceState.deafened ? 'hearing_disabled' : 'hearing';
      }
    }

    // Ses kanalı durumunu güncelle
    if (voiceChannelStatus && voiceState.currentRoom) {
      voiceChannelStatus.style.display = 'flex';
      voiceChannelStatus.textContent = `Ses Kanalı: ${voiceState.currentRoom} (${voiceState.micEnabled ? 'Mikrofon Açık' : 'Mikrofon Kapalı'})`;
    }
  }

  /**
   * Ses kanalı durumunu gösterir
   */
  function showVoiceChannelStatus() {
    if (voiceChannelStatus) {
      voiceChannelStatus.style.display = 'flex';
      voiceChannelStatus.textContent = `Ses Kanalı: ${voiceState.currentRoom}`;
    }
  }

  /**
   * Ses kanalı durumunu gizler
   */
  function hideVoiceChannelStatus() {
    if (voiceChannelStatus) {
      voiceChannelStatus.style.display = 'none';
    }
  }

  // Fonksiyonları global window.voiceChannelModule nesnesine ekle
  window.voiceChannelModule = {
    initVoiceChannel,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMicrophone,
    updateUIState
  };
})();
