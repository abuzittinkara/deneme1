/**
 * public/js/ui.ts
 * Kullanıcı arayüzü işlevleri
 */

// DOM elementleri
let serversList: HTMLElement | null;
let channelsList: HTMLElement | null;
let chatMessages: HTMLElement | null;
let chatInput: HTMLInputElement | null;
let serverHeader: HTMLElement | null;
let chatHeader: HTMLElement | null;
let loginScreen: HTMLElement | null;
let appScreen: HTMLElement | null;
let errorMessage: HTMLElement | null;

// Aktif elementler
let activeServer: string | null = null;
let activeChannel: string | null = null;

/**
 * Kullanıcı arayüzünü başlatır
 */
export function initUI(): void {
  // DOM elementlerini al
  serversList = document.getElementById('servers-list');
  channelsList = document.getElementById('channels-list');
  chatMessages = document.getElementById('chat-messages');
  chatInput = document.getElementById('chat-input') as HTMLInputElement;
  serverHeader = document.getElementById('server-header');
  chatHeader = document.getElementById('chat-header');
  loginScreen = document.getElementById('login-screen');
  appScreen = document.getElementById('app-screen');
  errorMessage = document.getElementById('error-message');

  // Olay dinleyicilerini ekle
  if (chatInput) {
    chatInput.addEventListener('keypress', handleChatInputKeyPress);
  }

  // Tema değiştirme düğmesi
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Giriş formu
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Kayıt formu
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // Sunucu ekleme düğmesi
  const addServerBtn = document.getElementById('add-server-btn');
  if (addServerBtn) {
    addServerBtn.addEventListener('click', showAddServerModal);
  }

  // Kanal ekleme düğmesi
  const addChannelBtn = document.getElementById('add-channel-btn');
  if (addChannelBtn) {
    addChannelBtn.addEventListener('click', showAddChannelModal);
  }

  // Kullanıcı ayarları düğmesi
  const userSettingsBtn = document.getElementById('user-settings-btn');
  if (userSettingsBtn) {
    userSettingsBtn.addEventListener('click', showUserSettings);
  }

  // Örnek sunucuları ve kanalları yükle
  loadSampleData();
}

/**
 * Örnek verileri yükler
 */
function loadSampleData(): void {
  // Örnek sunucular
  const sampleServers = [
    { id: 'server1', name: 'Genel', icon: 'G' },
    { id: 'server2', name: 'Oyun', icon: 'O' },
    { id: 'server3', name: 'Müzik', icon: 'M' },
    { id: 'server4', name: 'Teknoloji', icon: 'T' },
  ];

  // Örnek kanallar
  const sampleChannels = {
    server1: [
      { id: 'channel1', name: 'genel', type: 'text' },
      { id: 'channel2', name: 'sesli-sohbet', type: 'voice' },
      { id: 'channel3', name: 'duyurular', type: 'text' },
    ],
    server2: [
      { id: 'channel4', name: 'minecraft', type: 'text' },
      { id: 'channel5', name: 'valorant', type: 'text' },
      { id: 'channel6', name: 'oyun-sohbet', type: 'voice' },
    ],
    server3: [
      { id: 'channel7', name: 'müzik-önerileri', type: 'text' },
      { id: 'channel8', name: 'müzik-dinleme', type: 'voice' },
    ],
    server4: [
      { id: 'channel9', name: 'yazılım', type: 'text' },
      { id: 'channel10', name: 'donanım', type: 'text' },
      { id: 'channel11', name: 'teknoloji-sohbet', type: 'voice' },
    ],
  };

  // Örnek mesajlar
  const sampleMessages = {
    channel1: [
      { id: 'msg1', author: 'Admin', content: 'Merhaba, Fisqos\'a hoş geldiniz!', timestamp: '12:00' },
      { id: 'msg2', author: 'User1', content: 'Teşekkürler, burada olmak güzel.', timestamp: '12:05' },
      { id: 'msg3', author: 'User2', content: 'Selam herkese!', timestamp: '12:10' },
    ],
    channel3: [
      { id: 'msg4', author: 'Admin', content: 'Yeni güncelleme yayınlandı!', timestamp: '11:30' },
      { id: 'msg5', author: 'Admin', content: 'Detaylar için dökümantasyona bakabilirsiniz.', timestamp: '11:32' },
    ],
    channel4: [
      { id: 'msg6', author: 'User3', content: 'Minecraft sunucusu kurdum, katılmak isteyen var mı?', timestamp: '13:15' },
      { id: 'msg7', author: 'User4', content: 'Ben katılırım!', timestamp: '13:20' },
    ],
  };

  // Sunucuları ekle
  if (serversList) {
    serversList.innerHTML = '';
    sampleServers.forEach(server => {
      const serverElement = createServerElement(server);
      serversList.appendChild(serverElement);
    });
  }

  // İlk sunucuyu seç
  selectServer('server1');
}

/**
 * Sunucu elementi oluşturur
 * @param server - Sunucu bilgileri
 * @returns Sunucu elementi
 */
function createServerElement(server: { id: string; name: string; icon: string }): HTMLElement {
  const serverElement = document.createElement('div');
  serverElement.className = 'server-icon';
  serverElement.dataset.id = server.id;
  serverElement.textContent = server.icon;
  serverElement.title = server.name;

  serverElement.addEventListener('click', () => {
    selectServer(server.id);
  });

  return serverElement;
}

/**
 * Kanal elementi oluşturur
 * @param channel - Kanal bilgileri
 * @returns Kanal elementi
 */
function createChannelElement(channel: { id: string; name: string; type: string }): HTMLElement {
  const channelElement = document.createElement('div');
  channelElement.className = 'channel';
  channelElement.dataset.id = channel.id;

  const iconElement = document.createElement('span');
  iconElement.className = 'channel-icon material-icons';
  iconElement.textContent = channel.type === 'text' ? 'tag' : 'volume_up';

  const nameElement = document.createElement('span');
  nameElement.className = 'channel-name';
  nameElement.textContent = channel.name;

  channelElement.appendChild(iconElement);
  channelElement.appendChild(nameElement);

  channelElement.addEventListener('click', () => {
    selectChannel(channel.id);
  });

  return channelElement;
}

/**
 * Mesaj elementi oluşturur
 * @param message - Mesaj bilgileri
 * @returns Mesaj elementi
 */
function createMessageElement(message: { id: string; author: string; content: string; timestamp: string }): HTMLElement {
  const messageElement = document.createElement('div');
  messageElement.className = 'message';
  messageElement.dataset.id = message.id;

  const avatarElement = document.createElement('div');
  avatarElement.className = 'message-avatar';
  avatarElement.textContent = message.author.charAt(0).toUpperCase();

  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';

  const headerElement = document.createElement('div');
  headerElement.className = 'message-header';

  const authorElement = document.createElement('span');
  authorElement.className = 'message-author';
  authorElement.textContent = message.author;

  const timestampElement = document.createElement('span');
  timestampElement.className = 'message-timestamp';
  timestampElement.textContent = message.timestamp;

  const textElement = document.createElement('div');
  textElement.className = 'message-text';
  textElement.textContent = message.content;

  headerElement.appendChild(authorElement);
  headerElement.appendChild(timestampElement);

  contentElement.appendChild(headerElement);
  contentElement.appendChild(textElement);

  messageElement.appendChild(avatarElement);
  messageElement.appendChild(contentElement);

  return messageElement;
}

/**
 * Sunucu seçer
 * @param serverId - Sunucu ID
 */
function selectServer(serverId: string): void {
  // Aktif sunucuyu güncelle
  activeServer = serverId;

  // Sunucu ikonlarını güncelle
  if (serversList) {
    const serverElements = serversList.querySelectorAll('.server-icon');
    serverElements.forEach(element => {
      element.classList.remove('active');
      if (element.dataset.id === serverId) {
        element.classList.add('active');
      }
    });
  }

  // Sunucu başlığını güncelle
  if (serverHeader) {
    const serverName = document.querySelector('.server-name');
    if (serverName) {
      serverName.textContent = getServerName(serverId);
    }
  }

  // Kanalları yükle
  loadChannels(serverId);

  // İlk kanalı seç
  const firstChannelId = getFirstChannelId(serverId);
  if (firstChannelId) {
    selectChannel(firstChannelId);
  }
}

/**
 * Kanal seçer
 * @param channelId - Kanal ID
 */
function selectChannel(channelId: string): void {
  // Aktif kanalı güncelle
  activeChannel = channelId;

  // Kanal elementlerini güncelle
  if (channelsList) {
    const channelElements = channelsList.querySelectorAll('.channel');
    channelElements.forEach(element => {
      element.classList.remove('active');
      if (element.dataset.id === channelId) {
        element.classList.add('active');
      }
    });
  }

  // Kanal başlığını güncelle
  if (chatHeader) {
    const channelName = document.querySelector('.chat-header-name');
    if (channelName) {
      channelName.textContent = getChannelName(channelId);
    }
  }

  // Mesajları yükle
  loadMessages(channelId);
}

/**
 * Kanalları yükler
 * @param serverId - Sunucu ID
 */
function loadChannels(serverId: string): void {
  if (!channelsList) return;

  // Kanalları temizle
  channelsList.innerHTML = '';

  // Örnek kanalları yükle
  const sampleChannels = {
    server1: [
      { id: 'channel1', name: 'genel', type: 'text' },
      { id: 'channel2', name: 'sesli-sohbet', type: 'voice' },
      { id: 'channel3', name: 'duyurular', type: 'text' },
    ],
    server2: [
      { id: 'channel4', name: 'minecraft', type: 'text' },
      { id: 'channel5', name: 'valorant', type: 'text' },
      { id: 'channel6', name: 'oyun-sohbet', type: 'voice' },
    ],
    server3: [
      { id: 'channel7', name: 'müzik-önerileri', type: 'text' },
      { id: 'channel8', name: 'müzik-dinleme', type: 'voice' },
    ],
    server4: [
      { id: 'channel9', name: 'yazılım', type: 'text' },
      { id: 'channel10', name: 'donanım', type: 'text' },
      { id: 'channel11', name: 'teknoloji-sohbet', type: 'voice' },
    ],
  };

  // Kanalları ekle
  const channels = sampleChannels[serverId as keyof typeof sampleChannels] || [];
  channels.forEach(channel => {
    const channelElement = createChannelElement(channel);
    channelsList.appendChild(channelElement);
  });
}

/**
 * Mesajları yükler
 * @param channelId - Kanal ID
 */
function loadMessages(channelId: string): void {
  if (!chatMessages) return;

  // Mesajları temizle
  chatMessages.innerHTML = '';

  // Örnek mesajları yükle
  const sampleMessages = {
    channel1: [
      { id: 'msg1', author: 'Admin', content: 'Merhaba, Fisqos\'a hoş geldiniz!', timestamp: '12:00' },
      { id: 'msg2', author: 'User1', content: 'Teşekkürler, burada olmak güzel.', timestamp: '12:05' },
      { id: 'msg3', author: 'User2', content: 'Selam herkese!', timestamp: '12:10' },
    ],
    channel3: [
      { id: 'msg4', author: 'Admin', content: 'Yeni güncelleme yayınlandı!', timestamp: '11:30' },
      { id: 'msg5', author: 'Admin', content: 'Detaylar için dökümantasyona bakabilirsiniz.', timestamp: '11:32' },
    ],
    channel4: [
      { id: 'msg6', author: 'User3', content: 'Minecraft sunucusu kurdum, katılmak isteyen var mı?', timestamp: '13:15' },
      { id: 'msg7', author: 'User4', content: 'Ben katılırım!', timestamp: '13:20' },
    ],
  };

  // Mesajları ekle
  const messages = sampleMessages[channelId as keyof typeof sampleMessages] || [];
  messages.forEach(message => {
    const messageElement = createMessageElement(message);
    chatMessages.appendChild(messageElement);
  });

  // Mesajları aşağı kaydır
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Sunucu adını getirir
 * @param serverId - Sunucu ID
 * @returns Sunucu adı
 */
function getServerName(serverId: string): string {
  const sampleServers = {
    server1: 'Genel',
    server2: 'Oyun',
    server3: 'Müzik',
    server4: 'Teknoloji',
  };

  return sampleServers[serverId as keyof typeof sampleServers] || 'Bilinmeyen Sunucu';
}

/**
 * Kanal adını getirir
 * @param channelId - Kanal ID
 * @returns Kanal adı
 */
function getChannelName(channelId: string): string {
  const sampleChannels = {
    channel1: 'genel',
    channel2: 'sesli-sohbet',
    channel3: 'duyurular',
    channel4: 'minecraft',
    channel5: 'valorant',
    channel6: 'oyun-sohbet',
    channel7: 'müzik-önerileri',
    channel8: 'müzik-dinleme',
    channel9: 'yazılım',
    channel10: 'donanım',
    channel11: 'teknoloji-sohbet',
  };

  return sampleChannels[channelId as keyof typeof sampleChannels] || 'Bilinmeyen Kanal';
}

/**
 * İlk kanal ID'sini getirir
 * @param serverId - Sunucu ID
 * @returns İlk kanal ID'si
 */
function getFirstChannelId(serverId: string): string | null {
  const sampleChannels = {
    server1: [
      { id: 'channel1', name: 'genel', type: 'text' },
      { id: 'channel2', name: 'sesli-sohbet', type: 'voice' },
      { id: 'channel3', name: 'duyurular', type: 'text' },
    ],
    server2: [
      { id: 'channel4', name: 'minecraft', type: 'text' },
      { id: 'channel5', name: 'valorant', type: 'text' },
      { id: 'channel6', name: 'oyun-sohbet', type: 'voice' },
    ],
    server3: [
      { id: 'channel7', name: 'müzik-önerileri', type: 'text' },
      { id: 'channel8', name: 'müzik-dinleme', type: 'voice' },
    ],
    server4: [
      { id: 'channel9', name: 'yazılım', type: 'text' },
      { id: 'channel10', name: 'donanım', type: 'text' },
      { id: 'channel11', name: 'teknoloji-sohbet', type: 'voice' },
    ],
  };

  const channels = sampleChannels[serverId as keyof typeof sampleChannels] || [];
  return channels.length > 0 ? channels[0].id : null;
}

/**
 * Sohbet giriş alanı tuş basma olayını işler
 * @param event - Klavye olayı
 */
function handleChatInputKeyPress(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

/**
 * Mesaj gönderir
 */
function sendMessage(): void {
  if (!chatInput || !chatMessages || !activeChannel) return;

  const content = chatInput.value.trim();
  if (!content) return;

  // Mesaj oluştur
  const message = {
    id: `msg_${Date.now()}`,
    author: 'Sen',
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  // Mesaj elementi oluştur
  const messageElement = createMessageElement(message);

  // Mesajı ekle
  chatMessages.appendChild(messageElement);

  // Mesajları aşağı kaydır
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Giriş alanını temizle
  chatInput.value = '';
}

/**
 * Temayı değiştirir
 */
function toggleTheme(): void {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

/**
 * Giriş formunu işler
 * @param event - Form olayı
 */
function handleLogin(event: Event): void {
  event.preventDefault();

  const usernameInput = document.getElementById('login-username') as HTMLInputElement;
  const passwordInput = document.getElementById('login-password') as HTMLInputElement;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showError('Kullanıcı adı ve şifre zorunludur');
    return;
  }

  // Giriş işlemi burada yapılacak
  // Şimdilik doğrudan ana ekrana geçiyoruz
  showAppScreen();
}

/**
 * Kayıt formunu işler
 * @param event - Form olayı
 */
function handleRegister(event: Event): void {
  event.preventDefault();

  const usernameInput = document.getElementById('register-username') as HTMLInputElement;
  const emailInput = document.getElementById('register-email') as HTMLInputElement;
  const passwordInput = document.getElementById('register-password') as HTMLInputElement;
  const confirmPasswordInput = document.getElementById('register-confirm-password') as HTMLInputElement;

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();

  if (!username || !email || !password || !confirmPassword) {
    showError('Tüm alanlar zorunludur');
    return;
  }

  if (password !== confirmPassword) {
    showError('Şifreler eşleşmiyor');
    return;
  }

  // Kayıt işlemi burada yapılacak
  // Şimdilik doğrudan ana ekrana geçiyoruz
  showAppScreen();
}

/**
 * Hata mesajı gösterir
 * @param message - Hata mesajı
 */
function showError(message: string): void {
  if (!errorMessage) return;

  errorMessage.textContent = message;
  errorMessage.style.display = 'block';

  setTimeout(() => {
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }, 3000);
}

/**
 * Ana ekranı gösterir
 */
function showAppScreen(): void {
  if (!loginScreen || !appScreen) return;

  loginScreen.style.display = 'none';
  appScreen.style.display = 'flex';
}

/**
 * Giriş ekranını gösterir
 */
function showLoginScreen(): void {
  if (!loginScreen || !appScreen) return;

  loginScreen.style.display = 'flex';
  appScreen.style.display = 'none';
}

/**
 * Sunucu ekleme modalını gösterir
 */
function showAddServerModal(): void {
  // Sunucu ekleme modalı burada gösterilecek
}

/**
 * Kanal ekleme modalını gösterir
 */
function showAddChannelModal(): void {
  // Kanal ekleme modalı burada gösterilecek
}

/**
 * Kullanıcı ayarlarını gösterir
 */
function showUserSettings(): void {
  // Kullanıcı ayarları burada gösterilecek
}

// Dışa aktarılan nesneler
export default {
  initUI,
  selectServer,
  selectChannel,
  sendMessage,
  toggleTheme,
  showLoginScreen,
  showAppScreen,
};
