/**
 * public/js/ts/index.ts
 * Ana TypeScript dosyası
 */

// TypeScript için tip tanımlamaları
// Not: Çalışma zamanında Socket.IO CDN üzerinden yüklenir
type Socket = any;
import { Device, Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

// Global değişkenleri tanımla
declare global {
  interface Window {
    socket: Socket;
    currentUser: {
      id: string;
      username: string;
      name: string;
      surname: string;
      token: string;
      refreshToken: string;
    } | null;
    mediasoupDevice: Device | null;
    sendTransport: Transport | null;
    recvTransport: Transport | null;
    consumerTransports: Transport[];
    audioProducer: Producer | null;
    audioConsumers: Record<string, Consumer>;
    voiceChannel: {
      join: (channelId: string, socket: Socket) => void;
      leave: (socket: Socket) => void;
      toggleMic: (socket: Socket) => void;
    };
    screenShare: {
      start: (transport: Transport, socket: Socket) => Promise<void>;
      stop: (socket: Socket) => void;
    };
    screenShareStream: MediaStream | null;
  }
}

// API URL'si
const API_BASE_URL = 'http://localhost:3002/api';

// Kullanıcı bilgileri
let currentUser: {
  id: string;
  username: string;
  name: string;
  surname: string;
  token: string;
  refreshToken: string;
} | null = null;

// Socket.IO bağlantısı
let socket: Socket | null = null;

// Mediasoup değişkenleri
let device: Device | null = null;
let producerTransport: Transport | null = null;
let consumerTransports: Transport[] = [];
let audioProducer: Producer | null = null;
let audioConsumers: Record<string, Consumer> = {};

/**
 * Sayfa yüklendiğinde çalışacak ana fonksiyon
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('index.ts yüklendi');

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

  // Oturum kontrolü
  checkSession();

  // Olay dinleyicilerini ayarla
  setupEventListeners();
});

/**
 * Oturum kontrolü yapar
 */
function checkSession(): void {
  // Local Storage'dan token'ı al
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  const userJson = localStorage.getItem('user');

  if (token && refreshToken && userJson) {
    try {
      // Kullanıcı bilgilerini parse et
      const user = JSON.parse(userJson);

      // Kullanıcı bilgilerini ve token'ı sakla
      currentUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        surname: user.surname,
        token,
        refreshToken
      };

      // Token'ın geçerliliğini kontrol et
      validateToken();
    } catch (error) {
      console.error('Oturum bilgileri parse edilirken hata oluştu:', error);
      // Hatalı oturum bilgilerini temizle
      clearSession();
    }
  }
}

/**
 * Token'ın geçerliliğini kontrol eder
 */
async function validateToken(): Promise<void> {
  if (!currentUser?.token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    if (response.ok) {
      // Token geçerli, ana ekrana geçiş yap
      showAppScreen();
    } else if (response.status === 401) {
      // Token geçersiz, yenilemeyi dene
      await refreshAccessToken();
    } else {
      // Diğer hatalar
      clearSession();
    }
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    // Bağlantı hatası, offline olabilir
    // Yine de ana ekranı göster, bağlantı kurulduğunda yeniden doğrulama yapılacak
    showAppScreen();
  }
}

/**
 * Access token'ı yeniler
 */
async function refreshAccessToken(): Promise<boolean> {
  if (!currentUser?.refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken: currentUser.refreshToken })
    });

    if (response.ok) {
      const data = await response.json();

      // Token'ı güncelle
      currentUser.token = data.accessToken;
      localStorage.setItem('token', data.accessToken);

      // Ana ekrana geçiş yap
      showAppScreen();
      return true;
    } else {
      // Refresh token geçersiz, oturumu temizle
      clearSession();
      return false;
    }
  } catch (error) {
    console.error('Token yenileme hatası:', error);
    return false;
  }
}

/**
 * Oturum bilgilerini temizler
 */
function clearSession(): void {
  // Local Storage'dan oturum bilgilerini temizle
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');

  // Kullanıcı bilgilerini temizle
  currentUser = null;

  // Giriş ekranını göster
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  if (loginScreen) {
    loginScreen.style.display = 'flex';
  }

  if (appScreen) {
    appScreen.style.display = 'none';
  }
}

/**
 * Ana ekranı gösterir
 */
function showAppScreen(): void {
  if (!currentUser) return;

  // Kullanıcı adını göster
  const leftUserName = document.getElementById('leftUserName');
  if (leftUserName) {
    leftUserName.textContent = currentUser.username;
  }

  // Ana ekrana geçiş
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  if (loginScreen) {
    loginScreen.style.display = 'none';
  }

  if (appScreen) {
    appScreen.style.display = 'flex';
  }

  // Socket.IO bağlantısı kur
  connectToSocketIO();

  // Grupları yükle
  loadGroups();
}

/**
 * Olay dinleyicilerini ayarlar
 */
function setupEventListeners(): void {
  // Giriş formu elementleri
  const loginButton = document.getElementById('loginButton');
  const loginUsernameInput = document.getElementById('loginUsernameInput') as HTMLInputElement;
  const loginPasswordInput = document.getElementById('loginPasswordInput') as HTMLInputElement;
  const showRegisterScreen = document.getElementById('showRegisterScreen');

  // Kayıt formu elementleri
  const registerButton = document.getElementById('registerButton');
  const regUsernameInput = document.getElementById('regUsernameInput') as HTMLInputElement;
  const regNameInput = document.getElementById('regNameInput') as HTMLInputElement;
  const regSurnameInput = document.getElementById('regSurnameInput') as HTMLInputElement;
  const regBirthdateInput = document.getElementById('regBirthdateInput') as HTMLInputElement;
  const regEmailInput = document.getElementById('regEmailInput') as HTMLInputElement;
  const regPhoneInput = document.getElementById('regPhoneInput') as HTMLInputElement;
  const regPasswordInput = document.getElementById('regPasswordInput') as HTMLInputElement;
  const regPasswordConfirmInput = document.getElementById('regPasswordConfirmInput') as HTMLInputElement;
  const showLoginScreen = document.getElementById('showLoginScreen');
  const backToLoginButton = document.getElementById('backToLoginButton');

  // Ekran geçişleri
  if (showRegisterScreen && showLoginScreen && backToLoginButton) {
    const loginScreen = document.getElementById('login-screen');
    const registerScreen = document.getElementById('register-screen');

    showRegisterScreen.addEventListener('click', () => {
      if (loginScreen && registerScreen) {
        loginScreen.style.display = 'none';
        registerScreen.style.display = 'flex';
      }
    });

    showLoginScreen.addEventListener('click', () => {
      if (loginScreen && registerScreen) {
        registerScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
      }
    });

    backToLoginButton.addEventListener('click', () => {
      if (loginScreen && registerScreen) {
        registerScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
      }
    });
  }

  // Giriş işlemi
  if (loginButton && loginUsernameInput && loginPasswordInput) {
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
  }

  // Kayıt işlemi
  if (registerButton && regUsernameInput && regNameInput && regSurnameInput &&
      regBirthdateInput && regEmailInput && regPasswordInput && regPasswordConfirmInput) {
    registerButton.addEventListener('click', async () => {
      // Form verilerini al
      const username = regUsernameInput.value.trim();
      const name = regNameInput.value.trim();
      const surname = regSurnameInput.value.trim();
      const birthdate = regBirthdateInput.value;
      const email = regEmailInput.value.trim();
      const phone = regPhoneInput?.value.trim() || '';
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
          const registerScreen = document.getElementById('register-screen');
          const loginScreen = document.getElementById('login-screen');
          if (registerScreen && loginScreen) {
            registerScreen.style.display = 'none';
            loginScreen.style.display = 'flex';
          }
        } else {
          // Hata mesajı
          showRegisterError(data.message || 'Kayıt başarısız');
        }
      } catch (error) {
        console.error('Kayıt hatası:', error);
        showRegisterError('Bağlantı hatası. Lütfen tekrar deneyin.');
      }
    });
  }
}

/**
 * Giriş hata mesajını gösterir
 * @param message - Hata mesajı
 */
function showLoginError(message: string): void {
  const loginErrorMessage = document.getElementById('loginErrorMessage');
  const loginUsernameInput = document.getElementById('loginUsernameInput');
  const loginPasswordInput = document.getElementById('loginPasswordInput');

  if (loginErrorMessage) {
    loginErrorMessage.textContent = message;
    loginErrorMessage.style.display = 'block';
  }

  if (loginUsernameInput && loginPasswordInput) {
    loginUsernameInput.classList.add('shake');
    loginPasswordInput.classList.add('shake');

    setTimeout(() => {
      loginUsernameInput.classList.remove('shake');
      loginPasswordInput.classList.remove('shake');
    }, 500);
  }
}

/**
 * Kayıt hata mesajını gösterir
 * @param message - Hata mesajı
 */
function showRegisterError(message: string): void {
  const registerErrorMessage = document.getElementById('registerErrorMessage');

  if (registerErrorMessage) {
    registerErrorMessage.textContent = message;
    registerErrorMessage.style.display = 'block';
  }

  // Shake animasyonu
  const inputs = [
    document.getElementById('regUsernameInput'),
    document.getElementById('regNameInput'),
    document.getElementById('regSurnameInput'),
    document.getElementById('regBirthdateInput'),
    document.getElementById('regEmailInput'),
    document.getElementById('regPhoneInput'),
    document.getElementById('regPasswordInput'),
    document.getElementById('regPasswordConfirmInput')
  ].filter(Boolean);

  inputs.forEach(input => input?.classList.add('shake'));

  setTimeout(() => {
    inputs.forEach(input => input?.classList.remove('shake'));
  }, 500);
}

/**
 * Başarılı giriş işlemini yönetir
 * @param data - Giriş yanıtı
 */
function handleSuccessfulLogin(data: any): void {
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

  // Ana ekrana geçiş
  showAppScreen();
}

/**
 * Socket.IO bağlantısı kurar
 */
function connectToSocketIO(): void {
  if (!currentUser?.token) return;

  // Socket.IO bağlantısı
  // Not: io fonksiyonu global olarak tanımlı, CDN üzerinden yükleniyor
  socket = (window as any).io('http://localhost:3002', {
    transports: ['websocket'],
    auth: {
      token: currentUser.token
    }
  });

  if (!socket) return;

  // Bağlantı olayları
  socket.on('connect', () => {
    // socket değişkeni null olamaz çünkü yukarıda kontrol ettik
    const socketId = socket?.id || 'bilinmiyor';
    console.log('Socket.IO bağlantısı kuruldu:', socketId);

    // Kullanıcı durumunu çevrimiçi olarak ayarla
    socket?.emit('user:status', { status: 'online' });
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO bağlantısı kesildi');
  });

  socket.on('connect_error', (error: any) => {
    console.error('Socket.IO bağlantı hatası:', error);

    // Token hatası ise yenilemeyi dene
    if (error.message === 'invalid token') {
      refreshAccessToken().then(success => {
        if (success && socket) {
          // Yeni token ile yeniden bağlan
          socket.auth = { token: currentUser?.token };
          socket.connect();
        }
      });
    }
  });

  // Mesaj olayları
  socket.on('message:new', (message: any) => {
    console.log('Yeni mesaj:', message);
    addMessageToChat(message);
  });

  // Kullanıcı olayları
  socket.on('user:status', (data: any) => {
    console.log('Kullanıcı durumu değişti:', data);
    updateUserStatus(data.userId, data.status);
  });

  // Grup olayları
  socket.on('group:new', (group: any) => {
    console.log('Yeni grup:', group);
    addGroupToList(group);
  });

  socket.on('group:update', (group: any) => {
    console.log('Grup güncellendi:', group);
    updateGroupInList(group);
  });

  socket.on('group:delete', (groupId: any) => {
    console.log('Grup silindi:', groupId);
    removeGroupFromList(groupId);
  });

  // Ses kanalı olayları
  socket.on('voice:user-joined', (data: any) => {
    console.log('Kullanıcı ses kanalına katıldı:', data);
    updateVoiceChannelUsers(data.channelId);
  });

  socket.on('voice:user-left', (data: any) => {
    console.log('Kullanıcı ses kanalından ayrıldı:', data);
    updateVoiceChannelUsers(data.channelId);
  });

  // Global değişkene ata
  window.socket = socket;
}

/**
 * Grupları yükler
 */
async function loadGroups(): Promise<void> {
  if (!currentUser?.token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    if (response.ok) {
      const groups = await response.json();
      displayGroups(groups);
    } else if (response.status === 401) {
      // Token geçersiz, yenilemeyi dene
      const success = await refreshAccessToken();
      if (success) {
        // Yeniden dene
        loadGroups();
      }
    } else {
      console.error('Gruplar yüklenirken hata oluştu:', await response.text());
    }
  } catch (error) {
    console.error('Gruplar yüklenirken hata oluştu:', error);
  }
}

/**
 * Grupları görüntüler
 * @param groups - Gruplar listesi
 */
function displayGroups(groups: any[]): void {
  const groupsList = document.getElementById('groups-list');
  if (!groupsList) return;

  // Grupları temizle
  groupsList.innerHTML = '';

  // Grupları ekle
  groups.forEach(group => {
    addGroupToList(group);
  });
}

/**
 * Grubu listeye ekler
 * @param group - Grup bilgisi
 */
function addGroupToList(group: any): void {
  const groupsList = document.getElementById('groups-list');
  if (!groupsList) return;

  // Grup elementi oluştur
  const groupElement = document.createElement('div');
  groupElement.className = 'group';
  groupElement.setAttribute('data-group-id', group._id);

  // Grup içeriği
  groupElement.innerHTML = `
    <div class="group-icon">
      <span class="material-icons">${group.icon || 'group'}</span>
    </div>
    <div class="group-info">
      <div class="group-name">${group.name}</div>
      <div class="group-description">${group.description || ''}</div>
    </div>
  `;

  // Tıklama olayı
  groupElement.addEventListener('click', () => {
    selectGroup(group._id);
  });

  // Listeye ekle
  groupsList.appendChild(groupElement);
}

/**
 * Listedeki grubu günceller
 * @param group - Grup bilgisi
 */
function updateGroupInList(group: any): void {
  const groupElement = document.querySelector(`.group[data-group-id="${group._id}"]`);
  if (!groupElement) {
    // Grup yoksa ekle
    addGroupToList(group);
    return;
  }

  // Grup içeriğini güncelle
  const groupIcon = groupElement.querySelector('.group-icon span');
  const groupName = groupElement.querySelector('.group-name');
  const groupDescription = groupElement.querySelector('.group-description');

  if (groupIcon) {
    groupIcon.textContent = group.icon || 'group';
  }

  if (groupName) {
    groupName.textContent = group.name;
  }

  if (groupDescription) {
    groupDescription.textContent = group.description || '';
  }
}

/**
 * Grubu listeden kaldırır
 * @param groupId - Grup ID'si
 */
function removeGroupFromList(groupId: string): void {
  const groupElement = document.querySelector(`.group[data-group-id="${groupId}"]`);
  if (groupElement) {
    groupElement.remove();
  }
}

/**
 * Grubu seçer
 * @param groupId - Grup ID'si
 */
async function selectGroup(groupId: string): Promise<void> {
  if (!currentUser?.token) return;

  // Aktif grubu güncelle
  const activeGroup = document.querySelector('.group.active');
  if (activeGroup) {
    activeGroup.classList.remove('active');
  }

  const groupElement = document.querySelector(`.group[data-group-id="${groupId}"]`);
  if (groupElement) {
    groupElement.classList.add('active');
  }

  try {
    // Grup detaylarını yükle
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    if (response.ok) {
      const group = await response.json();
      displayGroupDetails(group);
      loadGroupMessages(groupId);
      loadGroupChannels(groupId);
    } else if (response.status === 401) {
      // Token geçersiz, yenilemeyi dene
      const success = await refreshAccessToken();
      if (success) {
        // Yeniden dene
        selectGroup(groupId);
      }
    } else {
      console.error('Grup detayları yüklenirken hata oluştu:', await response.text());
    }
  } catch (error) {
    console.error('Grup detayları yüklenirken hata oluştu:', error);
  }
}

/**
 * Grup detaylarını görüntüler
 * @param group - Grup bilgisi
 */
function displayGroupDetails(group: any): void {
  const groupHeader = document.querySelector('.group-header');
  if (!groupHeader) return;

  // Grup başlığını güncelle
  groupHeader.innerHTML = `
    <div class="group-icon">
      <span class="material-icons">${group.icon || 'group'}</span>
    </div>
    <div class="group-info">
      <div class="group-name">${group.name}</div>
      <div class="group-description">${group.description || ''}</div>
    </div>
  `;
}

/**
 * Grup mesajlarını yükler
 * @param groupId - Grup ID'si
 */
async function loadGroupMessages(groupId: string): Promise<void> {
  if (!currentUser?.token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/messages/group/${groupId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    if (response.ok) {
      const messages = await response.json();
      displayMessages(messages);
    } else if (response.status === 401) {
      // Token geçersiz, yenilemeyi dene
      const success = await refreshAccessToken();
      if (success) {
        // Yeniden dene
        loadGroupMessages(groupId);
      }
    } else {
      console.error('Mesajlar yüklenirken hata oluştu:', await response.text());
    }
  } catch (error) {
    console.error('Mesajlar yüklenirken hata oluştu:', error);
  }
}

/**
 * Grup kanallarını yükler
 * @param groupId - Grup ID'si
 */
async function loadGroupChannels(groupId: string): Promise<void> {
  if (!currentUser?.token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/channels/group/${groupId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    if (response.ok) {
      const channels = await response.json();
      displayChannels(channels);
    } else if (response.status === 401) {
      // Token geçersiz, yenilemeyi dene
      const success = await refreshAccessToken();
      if (success) {
        // Yeniden dene
        loadGroupChannels(groupId);
      }
    } else {
      console.error('Kanallar yüklenirken hata oluştu:', await response.text());
    }
  } catch (error) {
    console.error('Kanallar yüklenirken hata oluştu:', error);
  }
}

/**
 * Mesajları görüntüler
 * @param messages - Mesajlar listesi
 */
function displayMessages(messages: any[]): void {
  const chatMessages = document.querySelector('.chat-messages');
  if (!chatMessages) return;

  // Mesajları temizle
  chatMessages.innerHTML = '';

  // Mesajları ekle
  messages.forEach(message => {
    addMessageToChat(message);
  });

  // Otomatik kaydırma
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Mesajı sohbete ekler
 * @param message - Mesaj bilgisi
 */
function addMessageToChat(message: any): void {
  const chatMessages = document.querySelector('.chat-messages');
  if (!chatMessages) return;

  // Mesaj elementi oluştur
  const messageElement = document.createElement('div');
  messageElement.className = 'message';
  messageElement.setAttribute('data-message-id', message._id);

  // Mesaj içeriği
  const isCurrentUser = message.sender._id === currentUser?.id;
  messageElement.classList.add(isCurrentUser ? 'own-message' : 'other-message');

  // Mesaj zamanı
  const messageTime = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Mesaj içeriğini oluştur
  messageElement.innerHTML = `
    <div class="message-avatar">
      ${message.sender.username.charAt(0).toUpperCase()}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-sender">${message.sender.username}</span>
        <span class="message-time">${messageTime}</span>
      </div>
      <div class="message-text">${formatMessageText(message.content)}</div>
    </div>
  `;

  // Mesajı ekle
  chatMessages.appendChild(messageElement);

  // Otomatik kaydırma
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Mesaj metnini formatlar
 * @param text - Mesaj metni
 * @returns Formatlanmış metin
 */
function formatMessageText(text: string): string {
  // Emoji dönüşümü
  text = text.replace(/:\)/g, '😊')
             .replace(/:\(/g, '😢')
             .replace(/:D/g, '😃')
             .replace(/;\)/g, '😉')
             .replace(/:P/g, '😛')
             .replace(/<3/g, '❤️');

  // Bağlantıları dönüştür
  text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');

  // Bahsetmeleri dönüştür
  text = text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');

  return text;
}

/**
 * Kanalları görüntüler
 * @param channels - Kanallar listesi
 */
function displayChannels(channels: any[]): void {
  const channelsList = document.querySelector('.channels-list');
  if (!channelsList) return;

  // Kanalları temizle
  channelsList.innerHTML = '';

  // Kanalları türlerine göre grupla
  const textChannels = channels.filter(channel => channel.type === 'text');
  const voiceChannels = channels.filter(channel => channel.type === 'voice');

  // Metin kanalları başlığı
  if (textChannels.length > 0) {
    const textChannelsHeader = document.createElement('div');
    textChannelsHeader.className = 'channels-category';
    textChannelsHeader.innerHTML = `
      <div class="channels-category-header">
        <span class="material-icons">expand_more</span>
        <span>Metin Kanalları</span>
      </div>
    `;
    channelsList.appendChild(textChannelsHeader);

    // Metin kanallarını ekle
    textChannels.forEach(channel => {
      addChannelToList(channel, 'text');
    });
  }

  // Ses kanalları başlığı
  if (voiceChannels.length > 0) {
    const voiceChannelsHeader = document.createElement('div');
    voiceChannelsHeader.className = 'channels-category';
    voiceChannelsHeader.innerHTML = `
      <div class="channels-category-header">
        <span class="material-icons">expand_more</span>
        <span>Ses Kanalları</span>
      </div>
    `;
    channelsList.appendChild(voiceChannelsHeader);

    // Ses kanallarını ekle
    voiceChannels.forEach(channel => {
      addChannelToList(channel, 'voice');
    });
  }
}

/**
 * Kanalı listeye ekler
 * @param channel - Kanal bilgisi
 * @param type - Kanal türü
 */
function addChannelToList(channel: any, type: 'text' | 'voice'): void {
  const channelsList = document.querySelector('.channels-list');
  if (!channelsList) return;

  // Kanal elementi oluştur
  const channelElement = document.createElement('div');
  channelElement.className = `channel ${type}-channel`;
  channelElement.setAttribute('data-channel-id', channel._id);

  // Kanal içeriği
  const icon = type === 'text' ? 'tag' : 'volume_up';
  channelElement.innerHTML = `
    <div class="channel-icon">
      <span class="material-icons">${icon}</span>
    </div>
    <div class="channel-name">${channel.name}</div>
    <div class="channel-users"></div>
  `;

  // Tıklama olayı
  channelElement.addEventListener('click', () => {
    if (type === 'text') {
      selectTextChannel(channel._id);
    } else {
      toggleVoiceChannel(channel._id);
    }
  });

  // Listeye ekle
  channelsList.appendChild(channelElement);

  // Ses kanalı ise kullanıcıları yükle
  if (type === 'voice') {
    updateVoiceChannelUsers(channel._id);
  }
}

/**
 * Metin kanalını seçer
 * @param channelId - Kanal ID'si
 */
async function selectTextChannel(channelId: string): Promise<void> {
  if (!currentUser?.token) return;

  // Aktif kanalı güncelle
  const activeChannel = document.querySelector('.channel.active');
  if (activeChannel) {
    activeChannel.classList.remove('active');
  }

  const channelElement = document.querySelector(`.channel[data-channel-id="${channelId}"]`);
  if (channelElement) {
    channelElement.classList.add('active');
  }

  try {
    // Kanal mesajlarını yükle
    const response = await fetch(`${API_BASE_URL}/messages/channel/${channelId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    if (response.ok) {
      const messages = await response.json();
      displayMessages(messages);
    } else if (response.status === 401) {
      // Token geçersiz, yenilemeyi dene
      const success = await refreshAccessToken();
      if (success) {
        // Yeniden dene
        selectTextChannel(channelId);
      }
    } else {
      console.error('Mesajlar yüklenirken hata oluştu:', await response.text());
    }
  } catch (error) {
    console.error('Mesajlar yüklenirken hata oluştu:', error);
  }
}

/**
 * Ses kanalını açar/kapatır
 * @param channelId - Kanal ID'si
 */
function toggleVoiceChannel(channelId: string): void {
  // Ses kanalı modülünü kullan
  if (window.voiceChannel) {
    const isConnected = document.querySelector(`.voice-channel[data-channel-id="${channelId}"]`)?.classList.contains('active');

    if (isConnected) {
      // Kanaldan ayrıl
      window.voiceChannel.leave(window.socket);
    } else {
      // Kanala katıl
      window.voiceChannel.join(channelId, window.socket);
    }
  }
}

/**
 * Ses kanalı kullanıcılarını günceller
 * @param channelId - Kanal ID'si
 */
async function updateVoiceChannelUsers(channelId: string): Promise<void> {
  if (!currentUser?.token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/voice/channel/${channelId}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    if (response.ok) {
      const users = await response.json();
      displayVoiceChannelUsers(channelId, users);
    } else if (response.status === 401) {
      // Token geçersiz, yenilemeyi dene
      const success = await refreshAccessToken();
      if (success) {
        // Yeniden dene
        updateVoiceChannelUsers(channelId);
      }
    } else {
      console.error('Ses kanalı kullanıcıları yüklenirken hata oluştu:', await response.text());
    }
  } catch (error) {
    console.error('Ses kanalı kullanıcıları yüklenirken hata oluştu:', error);
  }
}

/**
 * Ses kanalı kullanıcılarını görüntüler
 * @param channelId - Kanal ID'si
 * @param users - Kullanıcılar listesi
 */
function displayVoiceChannelUsers(channelId: string, users: any[]): void {
  const channelUsers = document.querySelector(`.voice-channel[data-channel-id="${channelId}"] .channel-users`);
  if (!channelUsers) return;

  // Kullanıcıları temizle
  channelUsers.innerHTML = '';

  // Kullanıcıları ekle
  users.forEach(user => {
    const userElement = document.createElement('div');
    userElement.className = 'channel-user';
    userElement.setAttribute('data-user-id', user._id);

    // Kullanıcı durumu
    const isMuted = user.isMuted ? '<span class="material-icons" style="color: var(--color-danger);">mic_off</span>' : '';
    const isDeafened = user.isDeafened ? '<span class="material-icons" style="color: var(--color-warning);">hearing_disabled</span>' : '';
    const isSpeaking = user.isSpeaking ? '<span class="material-icons" style="color: var(--color-success);">volume_up</span>' : '';

    // Kullanıcı içeriği
    userElement.innerHTML = `
      <div class="channel-user-avatar">${user.username.charAt(0)}</div>
      <div class="channel-user-name">${user.username}</div>
      <div class="channel-user-status">
        ${isMuted}
        ${isDeafened}
        ${isSpeaking}
      </div>
    `;

    // Kullanıcıyı ekle
    channelUsers.appendChild(userElement);
  });
}

/**
 * Kullanıcı durumunu günceller
 * @param userId - Kullanıcı ID'si
 * @param status - Durum
 */
function updateUserStatus(userId: string, status: 'online' | 'offline' | 'away' | 'dnd'): void {
  const userElements = document.querySelectorAll(`[data-user-id="${userId}"]`);

  userElements.forEach(element => {
    // Eski durum sınıflarını kaldır
    element.classList.remove('status-online', 'status-offline', 'status-away', 'status-dnd');

    // Yeni durum sınıfını ekle
    element.classList.add(`status-${status}`);

    // Durum göstergesini güncelle
    const statusIndicator = element.querySelector('.status-indicator');
    if (statusIndicator) {
      statusIndicator.setAttribute('data-status', status);
    }
  });
}
