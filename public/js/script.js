// Fisqos - Ana JavaScript Dosyası
document.addEventListener('DOMContentLoaded', () => {
  console.log('script.js yüklendi');

  // API URL'si
  const API_BASE_URL = 'http://localhost:3001/api';

  // Ekranların görünürlüğünü kontrol et
  const loginScreen = document.getElementById('login-screen');
  const registerScreen = document.getElementById('register-screen');
  const appScreen = document.getElementById('app-screen');

  console.log('Ekranlar:', {
    loginScreen: loginScreen ? 'bulundu' : 'bulunamadı',
    registerScreen: registerScreen ? 'bulundu' : 'bulunamadı',
    appScreen: appScreen ? 'bulundu' : 'bulunamadı'
  });

  // Giriş ekranını göster
  if (loginScreen) {
    loginScreen.style.display = 'flex';
  }

  // Diğer ekranları gizle
  if (registerScreen) {
    registerScreen.style.display = 'none';
  }

  if (appScreen) {
    appScreen.style.display = 'none';
  }

  // Socket.IO bağlantısı
  let socket;

  // Kullanıcı bilgileri
  let currentUser = null;

  // Mediasoup değişkenleri
  let device;
  let producerTransport;
  let consumerTransports = [];
  let audioProducer;
  let audioConsumers = {};

  // Giriş formu elementleri
  const loginButton = document.getElementById('loginButton');
  const loginUsernameInput = document.getElementById('loginUsernameInput');
  const loginPasswordInput = document.getElementById('loginPasswordInput');
  const loginErrorMessage = document.getElementById('loginErrorMessage');
  const showRegisterScreen = document.getElementById('showRegisterScreen');

  // Kayıt formu elementleri
  const registerButton = document.getElementById('registerButton');
  const regUsernameInput = document.getElementById('regUsernameInput');
  const regNameInput = document.getElementById('regNameInput');
  const regSurnameInput = document.getElementById('regSurnameInput');
  const regBirthdateInput = document.getElementById('regBirthdateInput');
  const regEmailInput = document.getElementById('regEmailInput');
  const regPhoneInput = document.getElementById('regPhoneInput');
  const regPasswordInput = document.getElementById('regPasswordInput');
  const regPasswordConfirmInput = document.getElementById('regPasswordConfirmInput');
  const registerErrorMessage = document.getElementById('registerErrorMessage');
  const showLoginScreen = document.getElementById('showLoginScreen');
  const backToLoginButton = document.getElementById('backToLoginButton');

  // Ekran geçişleri
  showRegisterScreen.addEventListener('click', () => {
    loginScreen.style.display = 'none';
    registerScreen.style.display = 'flex';
  });

  showLoginScreen.addEventListener('click', () => {
    registerScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
  });

  backToLoginButton.addEventListener('click', () => {
    registerScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
  });

  // Giriş işlemi
  loginButton.addEventListener('click', async () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    // Basit doğrulama
    if (!username || !password) {
      showLoginError('Kullanıcı adı ve şifre gereklidir');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Başarılı giriş
        handleSuccessfulLogin(data);
      } else {
        // Hata mesajı
        showLoginError(data.message || 'Giriş başarısız');
      }
    } catch (error) {
      console.error('Giriş hatası:', error);
      showLoginError('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });

  // Kayıt işlemi
  registerButton.addEventListener('click', async () => {
    // Form verilerini al
    const username = regUsernameInput.value.trim();
    const name = regNameInput.value.trim();
    const surname = regSurnameInput.value.trim();
    const birthdate = regBirthdateInput.value;
    const email = regEmailInput.value.trim();
    const phone = regPhoneInput.value.trim();
    const password = regPasswordInput.value.trim();
    const passwordConfirm = regPasswordConfirmInput.value.trim();

    // Basit doğrulama
    if (!username || !name || !surname || !birthdate || !email || !password) {
      showRegisterError('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (password !== passwordConfirm) {
      showRegisterError('Şifreler eşleşmiyor');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          name,
          surname,
          birthdate,
          email,
          phone,
          password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Başarılı kayıt
        alert('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
        registerScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
      } else {
        // Hata mesajı
        showRegisterError(data.message || 'Kayıt başarısız');
      }
    } catch (error) {
      console.error('Kayıt hatası:', error);
      showRegisterError('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });

  // Hata mesajlarını gösterme fonksiyonları
  function showLoginError(message) {
    loginErrorMessage.textContent = message;
    loginErrorMessage.style.display = 'block';
    loginUsernameInput.classList.add('shake');
    loginPasswordInput.classList.add('shake');

    setTimeout(() => {
      loginUsernameInput.classList.remove('shake');
      loginPasswordInput.classList.remove('shake');
    }, 500);
  }

  function showRegisterError(message) {
    registerErrorMessage.textContent = message;
    registerErrorMessage.style.display = 'block';

    // Shake animasyonu
    const inputs = [
      regUsernameInput,
      regNameInput,
      regSurnameInput,
      regBirthdateInput,
      regEmailInput,
      regPhoneInput,
      regPasswordInput,
      regPasswordConfirmInput
    ];

    inputs.forEach(input => input.classList.add('shake'));

    setTimeout(() => {
      inputs.forEach(input => input.classList.remove('shake'));
    }, 500);
  }

  // Başarılı giriş işlemi
  function handleSuccessfulLogin(data) {
    // Kullanıcı bilgilerini ve token'ı sakla
    currentUser = {
      id: data.userId,
      username: data.username,
      name: data.name,
      surname: data.surname,
      token: data.accessToken,
      refreshToken: data.refreshToken
    };

    // Local Storage'a kaydet
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify({
      id: data.userId,
      username: data.username,
      name: data.name,
      surname: data.surname
    }));

    // Kullanıcı adını göster
    document.getElementById('leftUserName').textContent = data.username;

    // Ana ekrana geçiş
    loginScreen.style.display = 'none';
    callScreen.style.display = 'flex';

    // Socket.IO bağlantısı kur
    connectToSocketIO();

    // Grupları yükle
    loadGroups();
  }

  // Socket.IO bağlantısı
  function connectToSocketIO() {
    // Sunucu URL'sini ve port numarasını belirt
    socket = io('http://localhost:3000', {
      auth: {
        token: currentUser.token
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('Socket.IO bağlantısı kuruldu');
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO bağlantısı kesildi');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO bağlantı hatası:', error.message);
    });

    socket.on('error', (error) => {
      console.error('Socket.IO hatası:', error);
    });

    // Diğer socket olaylarını dinle
    setupSocketListeners();
  }

  // Socket olaylarını dinleme
  function setupSocketListeners() {
    // Grup olayları
    socket.on('group:created', handleGroupCreated);
    socket.on('group:joined', handleGroupJoined);
    socket.on('group:updated', handleGroupUpdated);
    socket.on('group:deleted', handleGroupDeleted);

    // Kanal olayları
    socket.on('channel:created', handleChannelCreated);
    socket.on('channel:joined', handleChannelJoined);
    socket.on('channel:updated', handleChannelUpdated);
    socket.on('channel:deleted', handleChannelDeleted);

    // Mesaj olayları
    socket.on('message:received', handleMessageReceived);

    // Kullanıcı olayları
    socket.on('user:joined', handleUserJoined);
    socket.on('user:left', handleUserLeft);
    socket.on('user:updated', handleUserUpdated);
  }

  // Grupları yükleme
  async function loadGroups() {
    try {
      const response = await fetch(`${API_BASE_URL}/groups`, {
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        renderGroups(data.groups);
      } else {
        console.error('Gruplar yüklenemedi:', await response.json());
      }
    } catch (error) {
      console.error('Gruplar yüklenirken hata oluştu:', error);
    }
  }

  // Grupları render etme
  function renderGroups(groups) {
    const groupList = document.getElementById('groupList');
    groupList.innerHTML = '';

    groups.forEach(group => {
      const groupElement = document.createElement('div');
      groupElement.className = 'grp-item';
      groupElement.dataset.id = group.id;
      groupElement.textContent = group.name.substring(0, 2).toUpperCase();
      groupElement.title = group.name;

      groupElement.addEventListener('click', () => selectGroup(group));

      groupList.appendChild(groupElement);
    });
  }

  // Grup seçme
  function selectGroup(group) {
    // Önceki seçili grubu temizle
    const previousSelected = document.querySelector('.grp-item.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }

    // Yeni grubu seç
    const groupElement = document.querySelector(`.grp-item[data-id="${group.id}"]`);
    if (groupElement) {
      groupElement.classList.add('selected');
    }

    // Grup başlığını güncelle
    document.getElementById('groupTitle').textContent = group.name;

    // Kanalları yükle
    loadChannels(group.id);
  }

  // Kanalları yükleme
  async function loadChannels(groupId) {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/channels`, {
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        renderChannels(data.channels);
      } else {
        console.error('Kanallar yüklenemedi:', await response.json());
      }
    } catch (error) {
      console.error('Kanallar yüklenirken hata oluştu:', error);
    }
  }

  // Kanalları render etme
  function renderChannels(channels) {
    const roomList = document.getElementById('roomList');
    roomList.innerHTML = '';

    channels.forEach(channel => {
      const channelElement = document.createElement('div');
      channelElement.className = 'room-item';
      channelElement.dataset.id = channel.id;
      channelElement.dataset.type = channel.type;

      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = channel.type === 'text' ? 'tag' : 'volume_up';

      const name = document.createElement('span');
      name.className = 'room-name';
      name.textContent = channel.name;

      channelElement.appendChild(icon);
      channelElement.appendChild(name);

      channelElement.addEventListener('click', () => selectChannel(channel));

      roomList.appendChild(channelElement);
    });
  }

  // Kanal seçme
  function selectChannel(channel) {
    // Önceki seçili kanalı temizle
    const previousSelected = document.querySelector('.room-item.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }

    // Yeni kanalı seç
    const channelElement = document.querySelector(`.room-item[data-id="${channel.id}"]`);
    if (channelElement) {
      channelElement.classList.add('selected');
    }

    // Kanal başlığını güncelle
    document.getElementById('selectedChannelTitle').textContent = channel.name;

    // Boş durum ekranını gizle
    document.getElementById('emptyStateContainer').style.display = 'none';

    // Kanal tipine göre içeriği göster
    if (channel.type === 'text') {
      // Metin kanalı
      document.getElementById('textChannelContainer').style.display = 'flex';
      document.getElementById('channelUsersContainer').style.display = 'none';
      document.getElementById('channelStatusPanel').style.display = 'none';

      // Mesajları yükle
      loadMessages(channel.id);
    } else {
      // Ses kanalı
      document.getElementById('textChannelContainer').style.display = 'none';
      document.getElementById('channelUsersContainer').style.display = 'flex';
      document.getElementById('channelStatusPanel').style.display = 'flex';

      // Ses kanalına katıl
      joinVoiceChannel(channel.id);
    }

    // Kullanıcıları yükle
    loadChannelUsers(channel.id);
  }

  // Mesajları yükleme
  async function loadMessages(channelId) {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        renderMessages(data.messages);
      } else {
        console.error('Mesajlar yüklenemedi:', await response.json());
      }
    } catch (error) {
      console.error('Mesajlar yüklenirken hata oluştu:', error);
    }
  }

  // Mesajları render etme
  function renderMessages(messages) {
    const messagesContainer = document.getElementById('textMessages');
    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-messages';
      emptyMessage.textContent = 'Henüz mesaj yok. İlk mesajı gönderen siz olun!';
      messagesContainer.appendChild(emptyMessage);
      return;
    }

    let currentSender = null;
    let messageGroup = [];

    messages.forEach((message, index) => {
      if (currentSender !== message.sender.id) {
        // Yeni gönderen, önceki grubu render et
        if (messageGroup.length > 0) {
          renderMessageGroup(messagesContainer, messageGroup);
          messageGroup = [];
        }
        currentSender = message.sender.id;
      }

      messageGroup.push(message);

      // Son mesaj veya farklı gönderen gelecekse grubu render et
      if (index === messages.length - 1) {
        renderMessageGroup(messagesContainer, messageGroup);
      }
    });

    // Mesaj alanını en alta kaydır
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Mesaj grubunu render etme
  function renderMessageGroup(container, messages) {
    if (messages.length === 0) return;

    const firstMessage = messages[0];
    const sender = firstMessage.sender;

    // Mesaj grubu container
    const groupContainer = document.createElement('div');
    groupContainer.className = 'message-group';

    // Gönderen bilgisi
    const senderInfo = document.createElement('div');
    senderInfo.className = 'message-sender-info';

    const senderAvatar = document.createElement('div');
    senderAvatar.className = 'message-avatar';
    senderAvatar.style.backgroundColor = getAvatarColor(sender.username);
    senderAvatar.textContent = sender.username.substring(0, 2).toUpperCase();

    const senderName = document.createElement('div');
    senderName.className = 'message-sender-name';
    senderName.textContent = sender.username;

    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = formatMessageTime(new Date(firstMessage.timestamp));

    senderInfo.appendChild(senderAvatar);
    senderInfo.appendChild(senderName);
    senderInfo.appendChild(messageTime);

    groupContainer.appendChild(senderInfo);

    // Mesajlar
    messages.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message-content';
      messageElement.textContent = message.content;
      groupContainer.appendChild(messageElement);
    });

    container.appendChild(groupContainer);
  }

  // Kullanıcıları yükleme
  async function loadChannelUsers(channelId) {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/users`, {
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        renderChannelUsers(data.users);
      } else {
        console.error('Kullanıcılar yüklenemedi:', await response.json());
      }
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata oluştu:', error);
    }
  }

  // Kullanıcıları render etme
  function renderChannelUsers(users) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';

    users.forEach(user => {
      const userElement = document.createElement('div');
      userElement.className = 'user-item';
      userElement.dataset.id = user.id;

      const userAvatar = document.createElement('div');
      userAvatar.className = 'user-avatar';
      userAvatar.style.backgroundColor = getAvatarColor(user.username);
      userAvatar.textContent = user.username.substring(0, 2).toUpperCase();

      const userName = document.createElement('div');
      userName.className = 'user-name';
      userName.textContent = user.username;

      const userStatus = document.createElement('div');
      userStatus.className = 'user-status';
      userStatus.classList.add(user.status);

      userElement.appendChild(userAvatar);
      userElement.appendChild(userName);
      userElement.appendChild(userStatus);

      userList.appendChild(userElement);
    });
  }

  // Mesaj gönderme
  const sendTextMessageBtn = document.getElementById('sendTextMessageBtn');
  const textChannelMessageInput = document.getElementById('textChannelMessageInput');

  sendTextMessageBtn.addEventListener('click', sendMessage);
  textChannelMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  async function sendMessage() {
    const messageContent = textChannelMessageInput.value.trim();
    if (!messageContent) return;

    const selectedChannel = document.querySelector('.room-item.selected');
    if (!selectedChannel) return;

    const channelId = selectedChannel.dataset.id;

    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          content: messageContent
        })
      });

      if (response.ok) {
        // Mesaj başarıyla gönderildi
        textChannelMessageInput.value = '';

        // Mesajları yeniden yükle
        loadMessages(channelId);
      } else {
        console.error('Mesaj gönderilemedi:', await response.json());
      }
    } catch (error) {
      console.error('Mesaj gönderilirken hata oluştu:', error);
    }
  }

  // Yardımcı fonksiyonlar
  function getAvatarColor(username) {
    // Kullanıcı adına göre tutarlı bir renk üret
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#d35400', '#c0392b', '#16a085', '#8e44ad',
      '#27ae60', '#e67e22', '#2980b9', '#f1c40f'
    ];

    return colors[Math.abs(hash) % colors.length];
  }

  function formatMessageTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Socket olay işleyicileri
  function handleGroupCreated(data) {
    loadGroups();
  }

  function handleGroupJoined(data) {
    loadGroups();
  }

  function handleGroupUpdated(data) {
    loadGroups();
  }

  function handleGroupDeleted(data) {
    loadGroups();
  }

  function handleChannelCreated(data) {
    const selectedGroup = document.querySelector('.grp-item.selected');
    if (selectedGroup && selectedGroup.dataset.id === data.groupId) {
      loadChannels(data.groupId);
    }
  }

  function handleChannelJoined(data) {
    // Kanal katılma işlemleri
  }

  function handleChannelUpdated(data) {
    const selectedGroup = document.querySelector('.grp-item.selected');
    if (selectedGroup && selectedGroup.dataset.id === data.groupId) {
      loadChannels(data.groupId);
    }
  }

  function handleChannelDeleted(data) {
    const selectedGroup = document.querySelector('.grp-item.selected');
    if (selectedGroup && selectedGroup.dataset.id === data.groupId) {
      loadChannels(data.groupId);
    }
  }

  function handleMessageReceived(data) {
    const selectedChannel = document.querySelector('.room-item.selected');
    if (selectedChannel && selectedChannel.dataset.id === data.channelId) {
      loadMessages(data.channelId);
    }
  }

  function handleUserJoined(data) {
    const selectedChannel = document.querySelector('.room-item.selected');
    if (selectedChannel && selectedChannel.dataset.id === data.channelId) {
      loadChannelUsers(data.channelId);
    }
  }

  function handleUserLeft(data) {
    const selectedChannel = document.querySelector('.room-item.selected');
    if (selectedChannel && selectedChannel.dataset.id === data.channelId) {
      loadChannelUsers(data.channelId);
    }
  }

  function handleUserUpdated(data) {
    const selectedChannel = document.querySelector('.room-item.selected');
    if (selectedChannel) {
      loadChannelUsers(selectedChannel.dataset.id);
    }
  }

  // Ses kanalına katılma
  async function joinVoiceChannel(channelId) {
    try {
      // VoiceChannelHandler modülünü dinamik olarak import et
      const VoiceChannelHandlerModule = await import('./voice-channel.js');
      const VoiceChannelHandler = VoiceChannelHandlerModule.default;

      // Eğer daha önce oluşturulmadıysa, VoiceChannelHandler'ı oluştur
      if (!window.voiceChannelHandler) {
        window.voiceChannelHandler = new VoiceChannelHandler(socket);
      }

      // Ses kanalına katıl
      const success = await window.voiceChannelHandler.joinVoiceChannel(channelId);

      if (success) {
        console.log('Ses kanalına başarıyla katıldı:', channelId);

        // Ses kontrollerini göster
        document.getElementById('voiceControls').style.display = 'flex';

        // Mikrofon ve hoparlör butonlarına olay dinleyicileri ekle
        document.getElementById('muteButton').addEventListener('click', toggleMute);
        document.getElementById('deafenButton').addEventListener('click', toggleDeafen);
        document.getElementById('videoButton').addEventListener('click', toggleVideo);
        document.getElementById('screenShareButton').addEventListener('click', toggleScreenShare);
        document.getElementById('disconnectButton').addEventListener('click', leaveVoiceChannel);

        // Ekran paylaşımı butonlarına olay dinleyicileri ekle
        document.getElementById('closeScreenShareBtn').addEventListener('click', closeScreenShare);
        document.getElementById('fullscreenScreenShareBtn').addEventListener('click', toggleFullscreenScreenShare);

        // Video iletişimi butonlarına olay dinleyicileri ekle
        document.getElementById('closeVideoBtn').addEventListener('click', closeVideo);
        document.getElementById('toggleVideoBtn').addEventListener('click', toggleVideo);
        document.getElementById('toggleMicBtn').addEventListener('click', toggleMute);
      } else {
        console.error('Ses kanalına katılırken bir hata oluştu');
      }
    } catch (error) {
      console.error('Ses kanalına katılırken bir hata oluştu:', error);
    }
  }

  // Ses kanalından ayrılma
  async function leaveVoiceChannel() {
    try {
      if (window.voiceChannelHandler) {
        const success = await window.voiceChannelHandler.leaveVoiceChannel();

        if (success) {
          console.log('Ses kanalından başarıyla ayrıldı');

          // Ses kontrollerini gizle
          document.getElementById('voiceControls').style.display = 'none';
        } else {
          console.error('Ses kanalından ayrılırken bir hata oluştu');
        }
      }
    } catch (error) {
      console.error('Ses kanalından ayrılırken bir hata oluştu:', error);
    }
  }

  // Mikrofonu aç/kapat
  async function toggleMute() {
    try {
      if (window.voiceChannelHandler) {
        const isMuted = await window.voiceChannelHandler.toggleMute();

        // Ses seviyesi göstergesini güncelle
        if (window.audioLevelIndicator) {
          window.audioLevelIndicator.setMuted(isMuted);
        }
      }
    } catch (error) {
      console.error('Mikrofon durumu değiştirilirken bir hata oluştu:', error);
    }
  }

  // Hoparlörü aç/kapat
  async function toggleDeafen() {
    try {
      if (window.voiceChannelHandler) {
        await window.voiceChannelHandler.toggleDeafen();
      }
    } catch (error) {
      console.error('Hoparlör durumu değiştirilirken bir hata oluştu:', error);
    }
  }

  // Ekran paylaşımını aç/kapat
  async function toggleScreenShare() {
    try {
      if (window.voiceChannelHandler) {
        await window.voiceChannelHandler.toggleScreenShare();
      }
    } catch (error) {
      console.error('Ekran paylaşımı durumu değiştirilirken bir hata oluştu:', error);
    }
  }

  // Ekran paylaşımını kapat
  function closeScreenShare() {
    try {
      if (window.voiceChannelHandler) {
        window.voiceChannelHandler.stopScreenShare();
      }

      // Ekran paylaşımı konteynerini gizle
      const screenShareContainer = document.getElementById('screenShareContainer');
      if (screenShareContainer) {
        screenShareContainer.style.display = 'none';
      }
    } catch (error) {
      console.error('Ekran paylaşımı kapatılırken bir hata oluştu:', error);
    }
  }

  // Ekran paylaşımını tam ekran yap/çık
  function toggleFullscreenScreenShare() {
    try {
      const screenShareVideo = document.getElementById('screenShareVideo');
      const screenShareContainer = document.getElementById('screenShareContainer');

      if (!screenShareVideo || !screenShareContainer) {
        return;
      }

      if (!document.fullscreenElement) {
        // Tam ekran yap
        if (screenShareContainer.requestFullscreen) {
          screenShareContainer.requestFullscreen();
        } else if (screenShareContainer.webkitRequestFullscreen) {
          screenShareContainer.webkitRequestFullscreen();
        } else if (screenShareContainer.msRequestFullscreen) {
          screenShareContainer.msRequestFullscreen();
        }
      } else {
        // Tam ekrandan çık
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Tam ekran durumu değiştirilirken bir hata oluştu:', error);
    }
  }

  // Video iletişimini aç/kapat
  async function toggleVideo() {
    try {
      if (window.voiceChannelHandler) {
        await window.voiceChannelHandler.toggleVideo();
      }
    } catch (error) {
      console.error('Video iletişimi durumu değiştirilirken bir hata oluştu:', error);
    }
  }

  // Video iletişimini kapat
  function closeVideo() {
    try {
      if (window.voiceChannelHandler) {
        window.voiceChannelHandler.stopVideo();
      }

      // Video konteynerini gizle
      const videoContainer = document.getElementById('videoContainer');
      if (videoContainer) {
        videoContainer.style.display = 'none';
      }
    } catch (error) {
      console.error('Video iletişimi kapatılırken bir hata oluştu:', error);
    }
  }

  // Sayfa yüklendiğinde oturum kontrolü
  function checkSession() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      try {
        currentUser = {
          ...JSON.parse(user),
          token,
          refreshToken: localStorage.getItem('refreshToken')
        };

        // Kullanıcı adını göster
        document.getElementById('leftUserName').textContent = currentUser.username;

        // Ana ekrana geçiş
        loginScreen.style.display = 'none';
        callScreen.style.display = 'flex';

        // Socket.IO bağlantısı kur
        connectToSocketIO();

        // Grupları yükle
        loadGroups();
      } catch (error) {
        console.error('Oturum bilgileri yüklenirken hata oluştu:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  }

  // Sayfa yüklendiğinde oturum kontrolü yap
  checkSession();

  // Mikrofon butonuna tıklandığında
  const micToggleButton = document.getElementById('micToggleButton');
  if (micToggleButton) {
    micToggleButton.addEventListener('click', toggleMute);
  }

  // Hoparlör butonuna tıklandığında
  const deafenToggleButton = document.getElementById('deafenToggleButton');
  if (deafenToggleButton) {
    deafenToggleButton.addEventListener('click', toggleDeafen);
  }

  // Kullanıcı durumu butonuna tıklandığında
  const userStatusButton = document.getElementById('userStatusButton');
  if (userStatusButton) {
    userStatusButton.addEventListener('click', () => {
      if (window.audioLevelIndicator) {
        window.audioLevelIndicator.toggleUserStatusMenu();
      }
    });
  }

  // Ses ayarları butonuna tıklandığında
  const audioSettingsButton = document.getElementById('audioSettingsButton');
  if (audioSettingsButton) {
    audioSettingsButton.addEventListener('click', () => {
      if (window.audioLevelIndicator) {
        window.audioLevelIndicator.toggleAudioSettingsPanel();
      }
    });
  }
});
