// public/js/ts/notifications.ts

/**
 * Bildirim sistemi modülü
 * Web Push Notifications ve uygulama içi bildirimleri yönetir
 */

// TypeScript için tip tanımlamaları
// Not: Çalışma zamanında Socket.IO CDN üzerinden yüklenir
type Socket = any;

// VAPID public key (gerçek uygulamada sunucudan alınmalı)
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

// Bildirim izinleri
let notificationsEnabled = false;

// Bildirim sayılarını takip etmek için global değişkenler
let unreadMessages: Record<string, number> = {}; // groupId:channelId -> count
let unreadMentions: Record<string, number> = {}; // groupId:channelId -> count
let totalUnreadCount = 0;
let totalMentionCount = 0;

// Notification interfaces
interface NotificationData {
  type?: string;
  title?: string;
  message: string;
  playSound?: boolean;
  duration?: number;
}

interface MessageData {
  groupId: string;
  channelId: string;
  message: {
    sender: string;
    content: string;
  };
}

interface UnreadCountsResponse {
  success: boolean;
  unreadMessages?: Record<string, number>;
  unreadMentions?: Record<string, number>;
}

interface NotificationSettingsEvent extends CustomEvent {
  detail: Record<string, any>;
}

interface ChannelSelectedEvent extends CustomEvent {
  detail: {
    groupId: string;
    channelId: string;
  };
}

interface PushSubscriptionResponse {
  success: boolean;
  message?: string;
}

interface UserPreferences {
  soundEffects: boolean;
  notifications: boolean;
}

// Declare global variables
declare global {
  interface Window {
    socket: Socket;
    currentTextChannel: string;
    selectedGroup: string;
    currentGroup: string;
  }
}

/**
 * Bildirim sistemini başlatır
 * @param socket - Socket.io socket
 */
export function initNotifications(socket: Socket): void {
  // Bildirim izinlerini kontrol et
  checkNotificationPermission();

  // Bildirim ayarları değiştiğinde
  document.addEventListener('notificationSettingsChanged', updateNotificationSettings as EventListener);

  // Bildirim izni düğmesine tıklama
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('#enableNotificationsBtn')) {
      requestNotificationPermission();
    }
  });

  // Service Worker'ı kaydet
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker kaydedildi:', registration.scope);

        // Bildirim izni varsa push aboneliği oluştur
        if (notificationsEnabled) {
          subscribeToPushNotifications(socket);
        }
      })
      .catch(error => {
        console.error('Service Worker kaydı başarısız:', error);
      });
  }

  // Socket olaylarını dinle
  socket.on('notification', handleNotification);
  socket.on('newMessage', handleNewMessage);
  socket.on('newMention', handleNewMention);

  // Kanal değişikliğinde okunmamış mesajları sıfırla
  document.addEventListener('channelSelected', ((e: Event) => {
    const customEvent = e as ChannelSelectedEvent;
    const { groupId, channelId } = customEvent.detail;
    markChannelAsRead(groupId, channelId);
  }) as EventListener);

  // Sayfa yüklenirken okunmamış mesajları al
  socket.emit('getUnreadCounts', {}, (response: UnreadCountsResponse) => {
    if (response.success) {
      unreadMessages = response.unreadMessages || {};
      unreadMentions = response.unreadMentions || {};
      updateUnreadCountBadges();
    }
  });
}

/**
 * Bildirim izinlerini kontrol eder
 */
function checkNotificationPermission(): void {
  if (!('Notification' in window)) {
    console.log('Bu tarayıcı bildirimleri desteklemiyor');
    notificationsEnabled = false;
    return;
  }

  if (Notification.permission === 'granted') {
    notificationsEnabled = true;
  } else {
    notificationsEnabled = false;
  }

  updateNotificationUI();
}

/**
 * Bildirim izni ister
 */
async function requestNotificationPermission(): Promise<void> {
  if (!('Notification' in window)) {
    showToast('Bu tarayıcı bildirimleri desteklemiyor', 'error');
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      notificationsEnabled = true;
      showToast('Bildirimler etkinleştirildi', 'success');

      // Push aboneliği oluştur
      subscribeToPushNotifications(window.socket);
    } else {
      notificationsEnabled = false;
      showToast('Bildirim izni reddedildi', 'warning');
    }

    updateNotificationUI();
  } catch (error) {
    console.error('Bildirim izni isteme hatası:', error);
    showToast('Bildirim izni istenirken bir hata oluştu', 'error');
  }
}

/**
 * Push bildirimlerine abone olur
 * @param socket - Socket.io socket
 */
async function subscribeToPushNotifications(socket: Socket): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push bildirimleri bu tarayıcıda desteklenmiyor');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Mevcut aboneliği kontrol et
    let subscription = await registration.pushManager.getSubscription();

    // Abonelik yoksa yeni oluştur
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // Aboneliği sunucuya gönder
    socket.emit('savePushSubscription', { subscription }, (response: PushSubscriptionResponse) => {
      if (response.success) {
        console.log('Push aboneliği kaydedildi');
      } else {
        console.error('Push aboneliği kaydetme hatası:', response.message);
      }
    });
  } catch (error) {
    console.error('Push aboneliği oluşturma hatası:', error);
  }
}

/**
 * Bildirim ayarlarını günceller
 * @param event - Olay nesnesi
 */
function updateNotificationSettings(event: NotificationSettingsEvent): void {
  const settings = event.detail;

  // Bildirim ayarlarını sunucuya gönder
  window.socket.emit('updateNotificationSettings', settings, (response: { success: boolean }) => {
    if (response.success) {
      showToast('Bildirim ayarları güncellendi', 'success');
    } else {
      showToast('Bildirim ayarları güncellenirken bir hata oluştu', 'error');
    }
  });
}

/**
 * Bildirim UI'ını günceller
 */
function updateNotificationUI(): void {
  const enableBtn = document.getElementById('enableNotificationsBtn');
  if (!enableBtn) return;

  if (notificationsEnabled) {
    enableBtn.textContent = 'Bildirimler Etkin';
    enableBtn.classList.add('enabled');
  } else {
    enableBtn.textContent = 'Bildirimleri Etkinleştir';
    enableBtn.classList.remove('enabled');
  }
}

/**
 * Bildirimi işler
 * @param data - Bildirim verileri
 */
function handleNotification(data: NotificationData): void {
  // Uygulama içi bildirim göster
  showInAppNotification(data);

  // Kullanıcı ayarlarına göre ses çal
  if (data.playSound !== false) {
    playNotificationSound();
  }
}

/**
 * Yeni mesaj bildirimini işler
 * @param data - Mesaj verileri
 */
function handleNewMessage(data: MessageData): void {
  const { groupId, channelId, message } = data;

  // Kullanıcı şu anda bu kanalda değilse bildirim göster
  const currentChannel = window.currentTextChannel;
  const currentGroup = window.selectedGroup || window.currentGroup;

  if (currentChannel !== channelId || currentGroup !== groupId) {
    // Okunmamış mesaj sayısını artır
    const key = `${groupId}:${channelId}`;
    unreadMessages[key] = (unreadMessages[key] || 0) + 1;

    // Bildirim göstergelerini güncelle
    updateUnreadCountBadges();

    // Bildirim göster
    showInAppNotification({
      type: 'message',
      title: message.sender,
      message: message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content
    });

    // Ses çal
    playNotificationSound();
  }
}

/**
 * Yeni bahsedilme (mention) bildirimini işler
 * @param data - Bahsedilme verileri
 */
function handleNewMention(data: MessageData): void {
  const { groupId, channelId, message } = data;

  // Bahsedilme sayısını artır
  const key = `${groupId}:${channelId}`;
  unreadMentions[key] = (unreadMentions[key] || 0) + 1;

  // Bildirim göstergelerini güncelle
  updateUnreadCountBadges();

  // Bildirim göster (daha dikkat çekici)
  showInAppNotification({
    type: 'message',
    title: `@${message.sender} senden bahsetti`,
    message: message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content,
    duration: 10000 // Daha uzun süre göster
  });

  // Ses çal
  playNotificationSound();

  // Masaüstü bildirimi göster
  if (notificationsEnabled) {
    showDesktopNotification(
      `@${message.sender} senden bahsetti`,
      message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content
    );
  }
}

/**
 * Kanalı okundu olarak işaretle
 * @param groupId - Grup ID
 * @param channelId - Kanal ID
 */
function markChannelAsRead(groupId: string, channelId: string): void {
  const key = `${groupId}:${channelId}`;

  // Okunmamış mesaj ve bahsedilme sayılarını sıfırla
  if (unreadMessages[key] || unreadMentions[key]) {
    unreadMessages[key] = 0;
    unreadMentions[key] = 0;

    // Bildirim göstergelerini güncelle
    updateUnreadCountBadges();

    // Sunucuya bildir
    window.socket.emit('markChannelAsRead', { groupId, channelId });
  }
}

/**
 * Okunmamış mesaj sayısı göstergelerini güncelle
 */
function updateUnreadCountBadges(): void {
  // Toplam okunmamış mesaj ve bahsedilme sayılarını hesapla
  totalUnreadCount = 0;
  totalMentionCount = 0;

  Object.values(unreadMessages).forEach(count => {
    totalUnreadCount += count;
  });

  Object.values(unreadMentions).forEach(count => {
    totalMentionCount += count;
  });

  // Kanal göstergelerini güncelle
  updateChannelBadges();

  // Grup göstergelerini güncelle
  updateGroupBadges();

  // Sayfa başlığını güncelle
  updatePageTitle();
}

/**
 * Kanal bildirim göstergelerini güncelle
 */
function updateChannelBadges(): void {
  // Tüm kanal öğelerini al
  const channelItems = document.querySelectorAll('.channel-item');

  channelItems.forEach(item => {
    const channelHeader = item.querySelector('.channel-header') as HTMLElement;
    if (!channelHeader) return;

    const channelId = channelHeader.dataset.channelId;
    const groupId = window.selectedGroup || window.currentGroup;

    if (!channelId || !groupId) return;

    const key = `${groupId}:${channelId}`;
    const unreadCount = unreadMessages[key] || 0;
    const mentionCount = unreadMentions[key] || 0;

    // Mevcut bildirim göstergelerini temizle
    const existingBadge = item.querySelector('.notification-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const existingIndicator = item.querySelector('.unread-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Bahsedilme varsa, bahsedilme göstergesi ekle
    if (mentionCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'notification-badge';
      badge.textContent = mentionCount.toString();
      badge.style.backgroundColor = '#c61884'; // Bahsedilmeler için özel renk
      item.appendChild(badge);
    }
    // Sadece okunmamış mesaj varsa, okunmamış göstergesi ekle
    else if (unreadCount > 0) {
      // Okunmamış mesaj sayısı göstergesi
      if (unreadCount > 1) {
        const badge = document.createElement('div');
        badge.className = 'notification-badge';
        badge.textContent = unreadCount.toString();
        item.appendChild(badge);
      } else {
        // Tek mesaj için sadece nokta göstergesi
        const indicator = document.createElement('div');
        indicator.className = 'unread-indicator';
        item.appendChild(indicator);
      }
    }
  });
}

/**
 * Grup bildirim göstergelerini güncelle
 */
function updateGroupBadges(): void {
  // Grup başına okunmamış mesaj ve bahsedilme sayılarını hesapla
  const groupCounts: Record<string, { unread: number, mentions: number }> = {}; // groupId -> { unread, mentions }

  Object.keys(unreadMessages).forEach(key => {
    const [groupId] = key.split(':');
    if (!groupCounts[groupId]) {
      groupCounts[groupId] = { unread: 0, mentions: 0 };
    }
    groupCounts[groupId].unread += unreadMessages[key];
  });

  Object.keys(unreadMentions).forEach(key => {
    const [groupId] = key.split(':');
    if (!groupCounts[groupId]) {
      groupCounts[groupId] = { unread: 0, mentions: 0 };
    }
    groupCounts[groupId].mentions += unreadMentions[key];
  });

  // Tüm grup öğelerini al
  const groupItems = document.querySelectorAll('.grp-item');

  groupItems.forEach(item => {
    const groupId = (item as HTMLElement).dataset.groupId;
    if (!groupId) return;

    const counts = groupCounts[groupId] || { unread: 0, mentions: 0 };

    // Mevcut bildirim göstergelerini temizle
    const existingBadge = item.querySelector('.notification-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    // Bahsedilme varsa, bahsedilme göstergesi ekle
    if (counts.mentions > 0) {
      const badge = document.createElement('div');
      badge.className = 'notification-badge';
      badge.textContent = counts.mentions.toString();
      badge.style.backgroundColor = '#c61884'; // Bahsedilmeler için özel renk
      item.appendChild(badge);
    }
    // Sadece okunmamış mesaj varsa, okunmamış göstergesi ekle
    else if (counts.unread > 0) {
      const badge = document.createElement('div');
      badge.className = 'notification-badge';
      badge.textContent = counts.unread.toString();
      item.appendChild(badge);
    }
  });
}

/**
 * Sayfa başlığını güncelle
 */
function updatePageTitle(): void {
  const originalTitle = 'Fisqos';

  if (totalMentionCount > 0) {
    document.title = `(${totalMentionCount}) ${originalTitle}`;
  } else if (totalUnreadCount > 0) {
    document.title = `(${totalUnreadCount}) ${originalTitle}`;
  } else {
    document.title = originalTitle;
  }
}

/**
 * Masaüstü bildirimi gösterir
 * @param title - Bildirim başlığı
 * @param body - Bildirim içeriği
 */
function showDesktopNotification(title: string, body: string): void {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/images/logo.png',
      badge: '/images/logo-badge.png',
      tag: 'fisqos-notification'
    } as NotificationOptions);

    notification.onclick = function() {
      window.focus();
      this.close();
    };
  }
}

/**
 * Uygulama içi bildirim gösterir
 * @param data - Bildirim verileri
 */
function showInAppNotification(data: NotificationData): void {
  // Mevcut bildirimleri kontrol et
  const container = document.getElementById('notificationsContainer');
  if (!container) {
    // Bildirim konteyneri yoksa oluştur
    createNotificationsContainer();
  }

  // Yeni bildirim oluştur
  const notification = document.createElement('div');
  notification.className = `in-app-notification ${data.type || 'info'}`;

  // Bildirim içeriği
  notification.innerHTML = `
    <div class="notification-icon">
      <span class="material-icons">${getNotificationIcon(data.type || 'info')}</span>
    </div>
    <div class="notification-content">
      <div class="notification-title">${data.title || 'Bildirim'}</div>
      <div class="notification-message">${data.message}</div>
    </div>
    <button class="notification-close">
      <span class="material-icons">close</span>
    </button>
  `;

  // Bildirim konteyneri
  const notificationsContainer = document.getElementById('notificationsContainer');
  if (notificationsContainer) {
    notificationsContainer.appendChild(notification);

    // Kapatma düğmesi olayı
    const closeButton = notification.querySelector('.notification-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        notification.classList.add('closing');
        setTimeout(() => {
          notification.remove();

          // Konteyner boşsa gizle
          if (notificationsContainer.children.length === 0) {
            notificationsContainer.classList.add('hidden');
          }
        }, 300);
      });
    }

    // Otomatik kapanma
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('closing');
        setTimeout(() => {
          notification.remove();

          // Konteyner boşsa gizle
          if (notificationsContainer.children.length === 0) {
            notificationsContainer.classList.add('hidden');
          }
        }, 300);
      }
    }, data.duration || 5000);

    // Bildirim konteyneri görünür yap
    notificationsContainer.classList.remove('hidden');

    // Bildirim animasyonu
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
  }
}

/**
 * Bildirim konteyneri oluşturur
 */
function createNotificationsContainer(): void {
  const container = document.createElement('div');
  container.id = 'notificationsContainer';
  container.className = 'notifications-container hidden';
  document.body.appendChild(container);
}

/**
 * Bildirim türüne göre ikon döndürür
 * @param type - Bildirim türü
 * @returns - Material icon adı
 */
function getNotificationIcon(type: string): string {
  switch (type) {
    case 'success':
      return 'check_circle';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'message':
      return 'message';
    case 'friend_request':
      return 'person_add';
    case 'group_invite':
      return 'group_add';
    default:
      return 'notifications';
  }
}

/**
 * Bildirim sesi çalar
 */
function playNotificationSound(): void {
  // Kullanıcı ses ayarlarını kontrol et
  const userPreferences = getUserPreferences();
  if (!userPreferences.soundEffects) return;

  const audio = new Audio('/sounds/notification.mp3');
  audio.volume = 0.5;
  audio.play().catch(error => {
    console.error('Bildirim sesi çalma hatası:', error);
  });
}

/**
 * Kullanıcı tercihlerini döndürür
 * @returns - Kullanıcı tercihleri
 */
function getUserPreferences(): UserPreferences {
  // Gerçek uygulamada kullanıcı tercihlerini saklamak için localStorage veya başka bir yöntem kullanılabilir
  return {
    soundEffects: localStorage.getItem('soundEffects') !== 'false',
    notifications: localStorage.getItem('notifications') !== 'false'
  };
}

/**
 * Base64 URL'yi Uint8Array'e dönüştürür (Web Push için)
 * @param base64String - Base64 URL string
 * @returns - Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Toast bildirimi gösterir
 * @param message - Bildirim mesajı
 * @param type - Bildirim türü (success, error, warning, info)
 * @param duration - Bildirim süresi (ms)
 */
export function showToast(message: string, type = 'info', duration = 3000): void {
  // Toast konteyneri
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    document.body.appendChild(toastContainer);
  }

  // Toast oluştur
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Toast içeriği
  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-icons">${getNotificationIcon(type)}</span>
    </div>
    <div class="toast-message">${message}</div>
    <button class="toast-close">
      <span class="material-icons">close</span>
    </button>
  `;

  // Toast'u konteynere ekle
  toastContainer.appendChild(toast);

  // Kapatma düğmesi olayı
  const closeButton = toast.querySelector('.toast-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      toast.classList.add('closing');
      setTimeout(() => {
        toast.remove();
      }, 300);
    });
  }

  // Otomatik kapanma
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('closing');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }, duration);

  // Toast animasyonu
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
}
