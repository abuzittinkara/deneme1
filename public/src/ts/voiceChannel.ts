/**
 * public/src/ts/voiceChannel.ts
 * Ses kanalı işlevselliği
 * WebRTC ve Socket.io kullanarak ses iletişimi sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Peer bağlantısı arayüzü
interface PeerConnection {
  pc: RTCPeerConnection;
  iceCandidates: RTCIceCandidate[];
}

// Ses kanalı durumu
interface VoiceChannelState {
  localStream: MediaStream | null;
  peerConnections: Record<string, PeerConnection>;
  currentRoom: string | null;
  micEnabled: boolean;
  deafened: boolean;
}

// Ses kanalı durumunu tutan global değişken
const voiceState: VoiceChannelState = {
  localStream: null,
  peerConnections: {},
  currentRoom: null,
  micEnabled: true,
  deafened: false,
};

/**
 * Ses kanalı işlevselliğini başlatır
 * @param socket - Socket.io socket
 */
export function initVoiceChannel(socket: Socket): void {
  // Ses kanalına katılma olayını dinle
  socket.on('userJoinedVoice', (data: { userId: string; username: string }) => {
    console.log(`${data.username} ses kanalına katıldı`);
    createPeerConnection(data.userId, socket);
  });

  // Ses kanalından ayrılma olayını dinle
  socket.on('userLeftVoice', (data: { userId: string; username: string }) => {
    console.log(`${data.username} ses kanalından ayrıldı`);
    closePeerConnection(data.userId);
  });

  // Offer olayını dinle
  socket.on('offer', async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
    console.log('Offer alındı:', data.from);
    await handleOffer(data.from, data.offer, socket);
  });

  // Answer olayını dinle
  socket.on('answer', async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
    console.log('Answer alındı:', data.from);
    await handleAnswer(data.from, data.answer);
  });

  // ICE candidate olayını dinle
  socket.on('iceCandidate', (data: { from: string; candidate: RTCIceCandidateInit }) => {
    console.log('ICE candidate alındı:', data.from);
    handleIceCandidate(data.from, data.candidate);
  });

  // Mikrofon düğmesini dinle
  const micToggleBtn = document.getElementById('micToggleBtn');
  if (micToggleBtn) {
    micToggleBtn.addEventListener('click', () => {
      toggleMicrophone();
      updateUIState();
    });
  }

  // Kulaklık düğmesini dinle
  const deafenToggleBtn = document.getElementById('deafenToggleBtn');
  if (deafenToggleBtn) {
    deafenToggleBtn.addEventListener('click', () => {
      toggleDeafen();
      updateUIState();
    });
  }
}

/**
 * Ses kanalına katılır
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 */
export async function joinVoiceChannel(
  groupId: string,
  channelId: string,
  socket: Socket
): Promise<void> {
  try {
    // Eğer zaten bir ses kanalındaysak, önce oradan ayrılalım
    if (voiceState.currentRoom) {
      await leaveVoiceChannel(socket);
    }

    // Kullanıcıdan mikrofon erişimi isteyelim
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceState.localStream = stream;
    voiceState.currentRoom = channelId;

    // Ses kanalına katıldığımızı sunucuya bildirelim
    socket.emit(
      'joinVoiceChannel',
      { groupId, channelId },
      (response: { success: boolean; users?: string[] }) => {
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
        } else {
          console.error('Ses kanalına katılırken bir hata oluştu');
        }
      }
    );
  } catch (error) {
    console.error('Mikrofon erişimi alınamadı:', error);
    alert('Mikrofon erişimi alınamadı. Lütfen tarayıcı izinlerini kontrol edin.');
  }
}

/**
 * Ses kanalından ayrılır
 * @param socket - Socket.io socket
 */
export async function leaveVoiceChannel(socket: Socket): Promise<void> {
  if (!voiceState.currentRoom) {
    return;
  }

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
  socket.emit(
    'leaveVoiceChannel',
    { channelId: voiceState.currentRoom },
    (response: { success: boolean }) => {
      if (response.success) {
        console.log('Ses kanalından başarıyla ayrıldınız');
      } else {
        console.error('Ses kanalından ayrılırken bir hata oluştu');
      }
    }
  );

  // Ses kanalı durumunu sıfırla
  voiceState.currentRoom = null;
  voiceState.peerConnections = {};

  // Ses kanalı durumunu gizle
  hideVoiceChannelStatus();
}

/**
 * Peer bağlantısı oluşturur
 * @param userId - Kullanıcı ID'si
 * @param socket - Socket.io socket
 */
async function createPeerConnection(userId: string, socket: Socket): Promise<void> {
  // Eğer zaten bir bağlantı varsa, önce onu kapatalım
  if (voiceState.peerConnections[userId]) {
    closePeerConnection(userId);
  }

  // ICE sunucularını tanımla
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
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
    const audioContainer = document.getElementById('remoteAudioContainer');
    if (audioContainer) {
      audioContainer.appendChild(audioElement);
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
    const offer = await pc.createOffer();
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
 * Peer bağlantısını kapatır
 * @param userId - Kullanıcı ID'si
 */
function closePeerConnection(userId: string): void {
  if (!voiceState.peerConnections[userId]) {
    return;
  }

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
 * Offer'ı işler
 * @param userId - Kullanıcı ID'si
 * @param offer - Offer
 * @param socket - Socket.io socket
 */
async function handleOffer(
  userId: string,
  offer: RTCSessionDescriptionInit,
  socket: Socket
): Promise<void> {
  // Eğer zaten bir bağlantı varsa, önce onu kapatalım
  if (voiceState.peerConnections[userId]) {
    closePeerConnection(userId);
  }

  // ICE sunucularını tanımla
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
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
    const audioContainer = document.getElementById('remoteAudioContainer');
    if (audioContainer) {
      audioContainer.appendChild(audioElement);
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
async function handleAnswer(userId: string, answer: RTCSessionDescriptionInit): Promise<void> {
  if (!voiceState.peerConnections[userId]) {
    return;
  }

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
async function handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
  if (!voiceState.peerConnections[userId]) {
    return;
  }

  try {
    await voiceState.peerConnections[userId].pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('ICE candidate eklenirken bir hata oluştu:', error);
  }
}

/**
 * Mikrofonu açar/kapatır
 */
function toggleMicrophone(): void {
  if (!voiceState.localStream) {
    return;
  }

  voiceState.micEnabled = !voiceState.micEnabled;

  // Mikrofon durumunu güncelle
  voiceState.localStream.getAudioTracks().forEach(track => {
    track.enabled = voiceState.micEnabled;
  });
}

/**
 * Sağır modunu açar/kapatır
 */
function toggleDeafen(): void {
  voiceState.deafened = !voiceState.deafened;

  // Tüm uzak ses elementlerinin ses seviyesini güncelle
  Object.keys(voiceState.peerConnections).forEach(userId => {
    const audioElement = document.getElementById(`remote-audio-${userId}`) as HTMLAudioElement;
    if (audioElement) {
      audioElement.muted = voiceState.deafened;
    }
  });
}

/**
 * UI durumunu günceller
 */
function updateUIState(): void {
  // Mikrofon düğmesini güncelle
  const micToggleBtn = document.getElementById('micToggleBtn');
  if (micToggleBtn) {
    if (voiceState.micEnabled) {
      micToggleBtn.classList.remove('disabled');
      const micIcon = micToggleBtn.querySelector('.material-icons');
      if (micIcon) {
        micIcon.textContent = 'mic';
      }
    } else {
      micToggleBtn.classList.add('disabled');
      const micOffIcon = micToggleBtn.querySelector('.material-icons');
      if (micOffIcon) {
        micOffIcon.textContent = 'mic_off';
      }
    }
  }

  // Kulaklık düğmesini güncelle
  const deafenToggleBtn = document.getElementById('deafenToggleBtn');
  if (deafenToggleBtn) {
    if (voiceState.deafened) {
      deafenToggleBtn.classList.add('disabled');
      const headsetOffIcon = deafenToggleBtn.querySelector('.material-icons');
      if (headsetOffIcon) {
        headsetOffIcon.textContent = 'headset_off';
      }
    } else {
      deafenToggleBtn.classList.remove('disabled');
      const headsetIcon = deafenToggleBtn.querySelector('.material-icons');
      if (headsetIcon) {
        headsetIcon.textContent = 'headset';
      }
    }
  }
}

/**
 * Ses kanalı durumunu gösterir
 */
function showVoiceChannelStatus(): void {
  const voiceChannelStatus = document.getElementById('voiceChannelStatus') as HTMLElement;
  if (voiceChannelStatus) {
    voiceChannelStatus.style.display = 'flex';
  }
}

/**
 * Ses kanalı durumunu gizler
 */
function hideVoiceChannelStatus(): void {
  const voiceChannelStatus = document.getElementById('voiceChannelStatus') as HTMLElement;
  if (voiceChannelStatus) {
    voiceChannelStatus.style.display = 'none';
  }
}
