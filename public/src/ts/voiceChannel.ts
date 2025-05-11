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
  mediasoup: {
    device: any | null;
    sendTransport: any | null;
    recvTransport: any | null;
    producers: Map<string, any>;
    consumers: Map<string, any>;
  };
}

// Ses kanalı durumunu tutan global değişken
const voiceState: VoiceChannelState = {
  localStream: null,
  peerConnections: {},
  currentRoom: null,
  micEnabled: true,
  deafened: false,
  mediasoup: {
    device: null,
    sendTransport: null,
    recvTransport: null,
    producers: new Map(),
    consumers: new Map()
  }
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

  // Mikrofon durumu değişikliği olayını dinle
  socket.on('micStateChanged', (data: { userId: string; enabled: boolean }) => {
    console.log(`${data.userId} mikrofon durumu değişti: ${data.enabled ? 'açık' : 'kapalı'}`);
    updateRemoteAudioState(data.userId, data.enabled);
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

    // Mikrofon izinlerini kontrol et
    const micPermission = await import('./microphoneHelper').then(module =>
      module.requestMicrophonePermission()
    );

    if (!micPermission) {
      throw new Error('Mikrofon izni alınamadı');
    }

    // Kullanıcıdan mikrofon erişimi isteyelim
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    voiceState.localStream = stream;
    voiceState.currentRoom = channelId;

    // MediaSoup entegrasyonu
    try {
      // MediaSoup modülünü yükle
      const mediasoupClient = await import('./mediasoupClient');

      // Router yeteneklerini al
      const { routerRtpCapabilities } = await socket.emitWithAck('mediasoup:get-router-capabilities', {
        roomId: channelId
      });

      // MediaSoup cihazını yükle
      const deviceLoaded = await mediasoupClient.loadDevice(routerRtpCapabilities);
      if (!deviceLoaded) {
        console.error('MediaSoup cihazı yüklenemedi');
        throw new Error('MediaSoup cihazı yüklenemedi');
      }

      // MediaSoup durumunu güncelle
      voiceState.mediasoup.device = mediasoupClient.getMediasoupState().device;

      // Gönderme transportu oluştur
      const { id, iceParameters, iceCandidates, dtlsParameters } = await socket.emitWithAck('mediasoup:create-transport', {
        roomId: channelId,
        producing: true
      });

      // Gönderme transportunu oluştur
      const sendTransportId = await mediasoupClient.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        appData: { roomId: channelId }
      });

      if (sendTransportId) {
        // Transport'u kaydet
        voiceState.mediasoup.sendTransport = mediasoupClient.getMediasoupState().sendTransport;

        // Alma transportu oluştur
        const recvTransportData = await socket.emitWithAck('mediasoup:create-transport', {
          roomId: channelId,
          producing: false,
          consuming: true
        });

        // Alma transportunu oluştur
        const recvTransportId = await mediasoupClient.createRecvTransport({
          id: recvTransportData.id,
          iceParameters: recvTransportData.iceParameters,
          iceCandidates: recvTransportData.iceCandidates,
          dtlsParameters: recvTransportData.dtlsParameters,
          appData: { roomId: channelId }
        });

        if (recvTransportId) {
          // Transport'u kaydet
          voiceState.mediasoup.recvTransport = mediasoupClient.getMediasoupState().recvTransport;

          // Ses parçasını üret
          if (voiceState.localStream) {
            const audioTrack = voiceState.localStream.getAudioTracks()[0];
            if (audioTrack) {
              // Ses parçasını üret
              const producerId = await mediasoupClient.produce(audioTrack, {
                codecOptions: {
                  opusStereo: false,
                  opusDtx: true,
                  opusFec: true,
                  opusNack: true
                }
              });

              if (producerId) {
                console.log('Ses üreticisi oluşturuldu:', producerId);

                // Odadaki diğer kullanıcıların üreticilerini tüket
                const { producers } = await socket.emitWithAck('mediasoup:get-producers', {
                  roomId: channelId
                });

                if (producers && producers.length > 0) {
                  for (const producerId of producers) {
                    // Kendi üreticimizi tüketme
                    if (mediasoupClient.getMediasoupState().producers.has(producerId)) {
                      continue;
                    }

                    // Üreticiyi tüket
                    const { consumerId, track } = await mediasoupClient.consume(
                      producerId,
                      mediasoupClient.getMediasoupState().device?.rtpCapabilities
                    ) || {};

                    if (consumerId && track) {
                      console.log('Üretici tüketildi:', consumerId);

                      // Ses parçasını oynat
                      const remoteStream = new MediaStream([track]);
                      const audioElement = document.createElement('audio');
                      audioElement.srcObject = remoteStream;
                      audioElement.autoplay = true;
                      audioElement.id = `remote-audio-${consumerId}`;
                      document.body.appendChild(audioElement);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (mediasoupError) {
      console.error('MediaSoup entegrasyonu sırasında hata oluştu:', mediasoupError);
      // MediaSoup hatası olsa bile devam et, eski WebRTC yöntemi kullanılacak
    }

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

    // Mikrofon yardım modalını göster
    import('./microphoneHelper').then(module => {
      module.showMicrophoneHelp();
    });

    // Salt dinleme modunu etkinleştirme seçeneği sun
    const enableListenOnly = confirm(
      'Mikrofon erişimi alınamadı. Salt dinleme modunda devam etmek ister misiniz? ' +
      '(Sizi duyamayacaklar ama siz diğerlerini duyabileceksiniz)'
    );

    if (enableListenOnly) {
      // Salt dinleme modunda devam et
      voiceState.micEnabled = false;

      // Ses kanalına katıldığımızı sunucuya bildirelim (mikrofon kapalı olarak)
      socket.emit(
        'joinVoiceChannel',
        { groupId, channelId, listenOnly: true },
        (response: { success: boolean; users?: string[] }) => {
          if (response.success) {
            console.log('Ses kanalına salt dinleme modunda katıldınız');
            voiceState.currentRoom = channelId;

            // Kanalda bulunan diğer kullanıcılarla bağlantı kuralım
            if (response.users && response.users.length > 0) {
              response.users.forEach(userId => {
                createPeerConnection(userId, socket, true);
              });
            }

            // Ses kanalı durumunu göster
            showVoiceChannelStatus();
            updateUIState();
          }
        }
      );
    }
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

  // MediaSoup bağlantısını kapat
  try {
    const mediasoupClient = await import('./mediasoupClient');
    mediasoupClient.closeConnection();
  } catch (mediasoupError) {
    console.error('MediaSoup bağlantısı kapatılırken hata oluştu:', mediasoupError);
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
 * @param listenOnly - Salt dinleme modu
 */
async function createPeerConnection(userId: string, socket: Socket, listenOnly: boolean = false): Promise<void> {
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

  // Yerel ses akışını ekle (salt dinleme modunda değilse)
  if (voiceState.localStream && !listenOnly) {
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

  // Mikrofon durumunu sunucuya bildir
  if (voiceState.currentRoom) {
    socket.emit('updateMicState', {
      enabled: voiceState.micEnabled,
      channelId: voiceState.currentRoom
    });
  }
}

/**
 * Uzak kullanıcının ses durumunu günceller
 * @param userId - Kullanıcı ID'si
 * @param enabled - Mikrofon durumu
 */
function updateRemoteAudioState(userId: string, enabled: boolean): void {
  const audioElement = document.getElementById(`remote-audio-${userId}`) as HTMLAudioElement;
  if (audioElement) {
    // Ses seviyesini ayarla (mikrofon kapalıysa ses yok)
    audioElement.volume = enabled ? 1.0 : 0.0;

    // Ses durumunu görsel olarak güncelle
    const userElement = document.querySelector(`[data-user-id="${userId}"]`);
    if (userElement) {
      if (enabled) {
        userElement.classList.remove('mic-muted');
        userElement.classList.add('mic-active');
      } else {
        userElement.classList.remove('mic-active');
        userElement.classList.add('mic-muted');
      }
    }
  }
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
