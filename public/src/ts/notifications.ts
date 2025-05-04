/**
 * public/src/ts/notifications.ts
 * Bildirim sistemi modülü
 * Web Push Notifications ve uygulama içi bildirimleri yönetir
 */

// Socket.io socket arayüzü
import { ChannelChangedEvent, DMSelectedEvent } from './types';

interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Bildirim verisi arayüzü
interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: {
    url?: string;
    groupId?: string;
    channelId?: string;
    messageId?: string;
    senderId?: string;
    type?: string;
    [key: string]: any;
  };
}

// Mesaj verisi arayüzü
interface MessageData {
  groupId: string;
  channelId: string;
  messageId: string;
  sender: {
    id: string;
    username: string;
  };
  content: string;
  timestamp: string;
  mentions?: string[];
}

// Bildirim ayarları arayüzü
interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  mentions: boolean;
  directMessages: boolean;
  groupMessages: boolean;
  friendRequests: boolean;
  mutedGroups: string[];
  mutedChannels: string[];
  mutedUsers: string[];
}

// VAPID public key (gerçek uygulamada sunucudan alınmalı)
const VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

// Bildirim izinleri
let notificationsEnabled = false;

// Bildirim sayılarını takip etmek için global değişkenler
const unreadMessages: { [key: string]: number } = {}; // groupId:channelId -> count
const unreadMentions: { [key: string]: number } = {}; // groupId:channelId -> count
let totalUnreadCount = 0;
let totalMentionCount = 0;

// Bildirim ayarları
let notificationSettings: NotificationSettings = {
  enabled: true,
  sound: true,
  desktop: true,
  mentions: true,
  directMessages: true,
  groupMessages: true,
  friendRequests: true,
  mutedGroups: [],
  mutedChannels: [],
  mutedUsers: [],
};

// Bildirim sesleri
const notificationSounds = {
  message: new Audio('/sounds/message.mp3'),
  mention: new Audio('/sounds/mention.mp3'),
  directMessage: new Audio('/sounds/direct-message.mp3'),
  friendRequest: new Audio('/sounds/friend-request.mp3'),
};

/**
 * Bildirim sistemini başlatır
 * @param socket - Socket.io socket
 */
export function initNotifications(socket: Socket): void {
  // Bildirim izinlerini kontrol et
  checkNotificationPermission();

  // Bildirim ayarlarını yükle
  loadNotificationSettings();

  // Service Worker'ı kaydet
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
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
  document.addEventListener('channelSelected', (e: ChannelChangedEvent) => {
    const { groupId, channelId } = e.detail;
    markChannelAsRead(groupId, channelId);
  });

  // DM değişikliğinde okunmamış mesajları sıfırla
  document.addEventListener('dmSelected', (e: DMSelectedEvent) => {
    const { userId } = e.detail;
    markDMAsRead(userId);
  });

  // Bildirim izni isteme düğmesi
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id === 'enableNotificationsBtn' || target.closest('#enableNotificationsBtn')) {
      requestNotificationPermission();
    }
  });

  // Sayfa görünürlüğünü izle
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Sayfa görünür olduğunda favicon'u sıfırla
      resetFavicon();
    }
  });

  // Bildirim sayılarını güncelle
  updateNotificationBadges();
}

/**
 * Bildirim izinlerini kontrol eder
 */
function checkNotificationPermission(): void {
  if (!('Notification' in window)) {
    console.log('Bu tarayıcı bildirim desteği sunmuyor');
    notificationsEnabled = false;
    return;
  }

  if (Notification.permission === 'granted') {
    notificationsEnabled = true;
  } else if (Notification.permission === 'denied') {
    notificationsEnabled = false;
  } else {
    notificationsEnabled = false;
    showNotificationPrompt();
  }
}

/**
 * Bildirim izni ister
 */
function requestNotificationPermission(): void {
  if (!('Notification' in window)) {
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      notificationsEnabled = true;

      // Bildirim ayarlarını güncelle
      notificationSettings.enabled = true;
      saveNotificationSettings();

      // Push aboneliği oluştur
      subscribeToPushNotifications(window.socket);

      // Bildirim izni alındı mesajı göster
      showNotificationSuccess();
    } else {
      notificationsEnabled = false;

      // Bildirim ayarlarını güncelle
      notificationSettings.enabled = false;
      saveNotificationSettings();

      // Bildirim izni reddedildi mesajı göster
      showNotificationError();
    }
  });
}

/**
 * Bildirim izni isteme mesajını gösterir
 */
function showNotificationPrompt(): void {
  // Mevcut mesajı kontrol et
  let promptElement = document.getElementById('notificationPrompt');

  if (!promptElement) {
    // Mesaj oluştur
    promptElement = document.createElement('div');
    promptElement.id = 'notificationPrompt';
    promptElement.className = 'notification-prompt';
    promptElement.innerHTML = `
      <div class="notification-prompt-content">
        <span class="material-icons">notifications</span>
        <div class="notification-prompt-text">
          <p>Bildirimler sayesinde yeni mesajlardan haberdar olabilirsiniz.</p>
        </div>
        <button id="enableNotificationsBtn" class="btn primary">Bildirimleri Etkinleştir</button>
        <button class="notification-prompt-close">&times;</button>
      </div>
    `;

    // Mesajı body'e ekle
    document.body.appendChild(promptElement);

    // Kapatma düğmesi
    const closeButton = promptElement.querySelector('.notification-prompt-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        promptElement?.remove();
      });
    }
  }
}

/**
 * Bildirim izni alındı mesajını gösterir
 */
function showNotificationSuccess(): void {
  // Mevcut mesajı kaldır
  const promptElement = document.getElementById('notificationPrompt');
  if (promptElement) {
    promptElement.remove();
  }

  // Başarı mesajı göster
  const successElement = document.createElement('div');
  successElement.className = 'notification-success';
  successElement.innerHTML = `
    <div class="notification-success-content">
      <span class="material-icons">check_circle</span>
      <p>Bildirimler etkinleştirildi!</p>
    </div>
  `;

  // Mesajı body'e ekle
  document.body.appendChild(successElement);

  // Belirli bir süre sonra mesajı kaldır
  setTimeout(() => {
    successElement.remove();
  }, 3000);
}

/**
 * Bildirim izni reddedildi mesajını gösterir
 */
function showNotificationError(): void {
  // Mevcut mesajı kaldır
  const promptElement = document.getElementById('notificationPrompt');
  if (promptElement) {
    promptElement.remove();
  }

  // Hata mesajı göster
  const errorElement = document.createElement('div');
  errorElement.className = 'notification-error';
  errorElement.innerHTML = `
    <div class="notification-error-content">
      <span class="material-icons">error</span>
      <p>Bildirim izni reddedildi. Tarayıcı ayarlarından izin vermeniz gerekiyor.</p>
    </div>
  `;

  // Mesajı body'e ekle
  document.body.appendChild(errorElement);

  // Belirli bir süre sonra mesajı kaldır
  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}

/**
 * Push bildirimlerine abone olur
 * @param socket - Socket.io socket
 */
function subscribeToPushNotifications(socket: Socket): void {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push bildirimleri bu tarayıcıda desteklenmiyor');
    return;
  }

  navigator.serviceWorker.ready.then(registration => {
    // Mevcut aboneliği kontrol et
    registration.pushManager.getSubscription().then(subscription => {
      if (subscription) {
        // Zaten abone
        console.log('Push bildirimlerine zaten abone');
        sendSubscriptionToServer(subscription, socket);
        return;
      }

      // VAPID public key'i Uint8Array'e dönüştür
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      // Yeni abonelik oluştur
      registration.pushManager
        .subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
        .then(newSubscription => {
          console.log('Push bildirimlerine abone olundu');
          sendSubscriptionToServer(newSubscription, socket);
        })
        .catch(error => {
          console.error('Push aboneliği başarısız:', error);
          notificationsEnabled = false;
        });
    });
  });
}

/**
 * Push aboneliğini sunucuya gönderir
 * @param subscription - Push aboneliği
 * @param socket - Socket.io socket
 */
function sendSubscriptionToServer(subscription: PushSubscription, socket: Socket): void {
  socket.emit(
    'registerPushSubscription',
    {
      subscription: subscription.toJSON(),
    },
    (response: { success: boolean }) => {
      if (response.success) {
        console.log('Push aboneliği sunucuya kaydedildi');
      } else {
        console.error('Push aboneliği sunucuya kaydedilemedi');
      }
    }
  );
}

/**
 * Base64 URL'yi Uint8Array'e dönüştürür
 * @param base64String - Base64 URL string
 * @returns Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Bildirim olayını işler
 * @param data - Bildirim verisi
 */
function handleNotification(data: NotificationData): void {
  // Bildirim ayarlarını kontrol et
  if (!notificationSettings.enabled) {
    return;
  }

  // Bildirim türüne göre kontrol
  if (data.data?.type === 'directMessage' && !notificationSettings.directMessages) {
    return;
  }
  if (data.data?.type === 'groupMessage' && !notificationSettings.groupMessages) {
    return;
  }
  if (data.data?.type === 'mention' && !notificationSettings.mentions) {
    return;
  }
  if (data.data?.type === 'friendRequest' && !notificationSettings.friendRequests) {
    return;
  }

  // Sessize alınmış grupları kontrol et
  if (data.data?.groupId && notificationSettings.mutedGroups.includes(data.data.groupId)) {
    return;
  }

  // Sessize alınmış kanalları kontrol et
  if (data.data?.channelId && notificationSettings.mutedChannels.includes(data.data.channelId)) {
    return;
  }

  // Sessize alınmış kullanıcıları kontrol et
  if (data.data?.senderId && notificationSettings.mutedUsers.includes(data.data.senderId)) {
    return;
  }

  // Sayfa görünür ve ilgili kanal/DM açıksa bildirim gösterme
  if (document.visibilityState === 'visible') {
    const currentChannelId = document
      .querySelector('#textMessages')
      ?.getAttribute('data-channel-id');
    const currentDmUser = document.querySelector('#dmMessages')?.getAttribute('data-friend');

    if (data.data?.channelId && data.data.channelId === currentChannelId) {
      return;
    }
    if (data.data?.senderId && data.data.senderId === currentDmUser) {
      return;
    }
  }

  // Masaüstü bildirimi göster
  if (notificationsEnabled && notificationSettings.desktop) {
    showDesktopNotification(data);
  }

  // Ses çal
  if (notificationSettings.sound) {
    playNotificationSound(data.data?.type || 'message');
  }

  // Favicon'u güncelle
  updateFavicon();

  // Uygulama içi bildirim göster
  showInAppNotification(data);
}

/**
 * Yeni mesaj olayını işler
 * @param data - Mesaj verisi
 */
function handleNewMessage(data: MessageData): void {
  // Sayfa görünür ve ilgili kanal açıksa işlem yapma
  if (document.visibilityState === 'visible') {
    const currentChannelId = document
      .querySelector('#textMessages')
      ?.getAttribute('data-channel-id');
    if (data.channelId === currentChannelId) {
      return;
    }
  }

  // Okunmamış mesaj sayısını artır
  const key = `${data.groupId}:${data.channelId}`;
  unreadMessages[key] = (unreadMessages[key] || 0) + 1;
  totalUnreadCount++;

  // Bahsetmeleri kontrol et
  if (data.mentions && data.mentions.includes((window as any).username)) {
    unreadMentions[key] = (unreadMentions[key] || 0) + 1;
    totalMentionCount++;
  }

  // Bildirim rozetlerini güncelle
  updateNotificationBadges();
}

/**
 * Yeni bahsetme olayını işler
 * @param data - Bahsetme verisi
 */
function handleNewMention(data: MessageData): void {
  // Sayfa görünür ve ilgili kanal açıksa işlem yapma
  if (document.visibilityState === 'visible') {
    const currentChannelId = document
      .querySelector('#textMessages')
      ?.getAttribute('data-channel-id');
    if (data.channelId === currentChannelId) {
      return;
    }
  }

  // Okunmamış bahsetme sayısını artır
  const key = `${data.groupId}:${data.channelId}`;
  unreadMentions[key] = (unreadMentions[key] || 0) + 1;
  totalMentionCount++;

  // Bildirim rozetlerini güncelle
  updateNotificationBadges();
}

/**
 * Masaüstü bildirimi gösterir
 * @param data - Bildirim verisi
 */
function showDesktopNotification(data: NotificationData): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  // Bildirim oluştur
  const notification = new Notification(data.title, {
    body: data.body,
    icon: data.icon || '/images/logo.png',
    tag: data.tag,
    data: data.data,
  });

  // Bildirime tıklama olayı
  notification.onclick = () => {
    // Pencereyi odakla
    window.focus();

    // Bildirimi kapat
    notification.close();

    // İlgili sayfaya yönlendir
    if (data.data?.url) {
      window.location.href = data.data.url;
    } else if (data.data?.groupId && data.data?.channelId) {
      // Kanal sayfasına yönlendir
      navigateToChannel(data.data.groupId, data.data.channelId, data.data?.messageId);
    } else if (data.data?.senderId) {
      // DM sayfasına yönlendir
      navigateToDM(data.data.senderId);
    }
  };
}

/**
 * Uygulama içi bildirim gösterir
 * @param data - Bildirim verisi
 */
function showInAppNotification(data: NotificationData): void {
  // Mevcut bildirimleri kontrol et
  const container = document.getElementById('inAppNotifications');

  // Konteyner yoksa oluştur
  if (!container) {
    const newContainer = document.createElement('div');
    newContainer.id = 'inAppNotifications';
    newContainer.className = 'in-app-notifications';
    document.body.appendChild(newContainer);
  }

  // Bildirim elementi oluştur
  const notification = document.createElement('div');
  notification.className = 'in-app-notification';
  notification.innerHTML = `
    <div class="notification-icon">
      <span class="material-icons">${getNotificationIcon(data.data?.type || 'message')}</span>
    </div>
    <div class="notification-content">
      <div class="notification-title">${data.title}</div>
      <div class="notification-body">${data.body}</div>
    </div>
    <button class="notification-close">&times;</button>
  `;

  // Bildirime tıklama olayı
  notification.addEventListener('click', () => {
    // Bildirimi kapat
    notification.remove();

    // İlgili sayfaya yönlendir
    if (data.data?.url) {
      window.location.href = data.data.url;
    } else if (data.data?.groupId && data.data?.channelId) {
      // Kanal sayfasına yönlendir
      navigateToChannel(data.data.groupId, data.data.channelId, data.data?.messageId);
    } else if (data.data?.senderId) {
      // DM sayfasına yönlendir
      navigateToDM(data.data.senderId);
    }
  });

  // Kapatma düğmesi
  const closeButton = notification.querySelector('.notification-close');
  if (closeButton) {
    closeButton.addEventListener('click', e => {
      e.stopPropagation();
      notification.remove();
    });
  }

  // Bildirimi konteynere ekle
  document.getElementById('inAppNotifications')?.appendChild(notification);

  // Belirli bir süre sonra bildirimi kaldır
  setTimeout(() => {
    notification.classList.add('notification-hide');

    // Animasyon tamamlandıktan sonra elementi kaldır
    notification.addEventListener('animationend', () => {
      notification.remove();
    });
  }, 5000);
}

/**
 * Bildirim sesi çalar
 * @param type - Bildirim türü
 */
function playNotificationSound(type: string): void {
  switch (type) {
    case 'mention':
      notificationSounds.mention.play();
      break;
    case 'directMessage':
      notificationSounds.directMessage.play();
      break;
    case 'friendRequest':
      notificationSounds.friendRequest.play();
      break;
    default:
      notificationSounds.message.play();
      break;
  }
}

/**
 * Favicon'u günceller
 */
function updateFavicon(): void {
  const favicon = document.getElementById('favicon') as HTMLLinkElement;
  if (!favicon) {
    return;
  }

  if (totalUnreadCount > 0) {
    favicon.href = '/images/favicon-notification.png';
  }
}

/**
 * Favicon'u sıfırlar
 */
function resetFavicon(): void {
  const favicon = document.getElementById('favicon') as HTMLLinkElement;
  if (!favicon) {
    return;
  }

  favicon.href = '/images/favicon.png';
}

/**
 * Bildirim rozetlerini günceller
 */
function updateNotificationBadges(): void {
  // Grup rozetlerini güncelle
  Object.keys(unreadMessages).forEach(key => {
    const [groupId, channelId] = key.split(':');

    // Grup rozeti
    const groupBadge = document.querySelector(`.group-item[data-group-id="${groupId}"] .badge`);
    if (groupBadge) {
      if (groupId) {
        groupBadge.textContent = getTotalUnreadForGroup(groupId).toString();
        groupBadge.classList.toggle('hidden', getTotalUnreadForGroup(groupId) === 0);
      }
    }

    // Kanal rozeti
    const channelBadge = document.querySelector(
      `.channel-item[data-channel-id="${channelId}"] .badge`
    );
    if (channelBadge) {
      if (unreadMessages[key] !== undefined) {
        channelBadge.textContent = unreadMessages[key].toString();
      }
      channelBadge.classList.toggle('hidden', unreadMessages[key] === 0);

      // Bahsetme rozeti
      if (unreadMentions[key] && unreadMentions[key] > 0) {
        channelBadge.classList.add('mention-badge');
      } else {
        channelBadge.classList.remove('mention-badge');
      }
    }
  });

  // DM rozetlerini güncelle
  // Bu kısım DM yapısına göre uyarlanmalı

  // Toplam rozeti güncelle
  const totalBadge = document.getElementById('totalUnreadBadge');
  if (totalBadge) {
    totalBadge.textContent = totalUnreadCount.toString();
    totalBadge.classList.toggle('hidden', totalUnreadCount === 0);

    // Bahsetme rozeti
    if (totalMentionCount > 0) {
      totalBadge.classList.add('mention-badge');
    } else {
      totalBadge.classList.remove('mention-badge');
    }
  }

  // Sayfa başlığını güncelle
  updatePageTitle();
}

/**
 * Sayfa başlığını günceller
 */
function updatePageTitle(): void {
  const originalTitle = 'Fisqos';

  if (totalUnreadCount > 0) {
    document.title = `(${totalUnreadCount}) ${originalTitle}`;
  } else {
    document.title = originalTitle;
  }
}

/**
 * Bir grup için toplam okunmamış mesaj sayısını hesaplar
 * @param groupId - Grup ID'si
 * @returns Toplam okunmamış mesaj sayısı
 */
function getTotalUnreadForGroup(groupId: string): number {
  let total = 0;

  Object.keys(unreadMessages).forEach(key => {
    if (key.startsWith(`${groupId}:`)) {
      if (unreadMessages[key] !== undefined) {
        total += unreadMessages[key];
      }
    }
  });

  return total;
}

/**
 * Bir kanalı okundu olarak işaretler
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 */
function markChannelAsRead(groupId: string, channelId: string): void {
  const key = `${groupId}:${channelId}`;

  // Toplam sayıları güncelle
  if (unreadMessages[key]) {
    totalUnreadCount -= unreadMessages[key];
    delete unreadMessages[key];
  }

  if (unreadMentions[key]) {
    totalMentionCount -= unreadMentions[key];
    delete unreadMentions[key];
  }

  // Bildirim rozetlerini güncelle
  updateNotificationBadges();

  // Favicon'u sıfırla
  if (totalUnreadCount === 0) {
    resetFavicon();
  }
}

/**
 * Bir DM'i okundu olarak işaretler
 * @param userId - Kullanıcı ID'si
 */
function markDMAsRead(userId: string): void {
  // DM yapısına göre uyarlanmalı
  // ...

  // Bildirim rozetlerini güncelle
  updateNotificationBadges();

  // Favicon'u sıfırla
  if (totalUnreadCount === 0) {
    resetFavicon();
  }
}

/**
 * Bir kanala yönlendirir
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param messageId - Mesaj ID'si (isteğe bağlı)
 */
function navigateToChannel(groupId: string, channelId: string, messageId?: string): void {
  // Grup ve kanalı seç
  const groupItem = document.querySelector(
    `.group-item[data-group-id="${groupId}"]`
  ) as HTMLElement;
  if (groupItem) {
    groupItem.click();

    setTimeout(() => {
      const channelItem = document.querySelector(
        `.channel-item[data-channel-id="${channelId}"]`
      ) as HTMLElement;
      if (channelItem) {
        channelItem.click();

        // Mesaja kaydır
        if (messageId) {
          setTimeout(() => {
            const messageElement = document.querySelector(
              `.text-message[data-message-id="${messageId}"]`
            ) as HTMLElement;
            if (messageElement) {
              messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              messageElement.classList.add('highlight-message');

              setTimeout(() => {
                messageElement.classList.remove('highlight-message');
              }, 2000);
            }
          }, 500);
        }
      }
    }, 300);
  }
}

/**
 * Bir DM'e yönlendirir
 * @param userId - Kullanıcı ID'si
 */
function navigateToDM(userId: string): void {
  // DM'e yönlendir
  const dmItem = document.querySelector(`.dm-item[data-user-id="${userId}"]`) as HTMLElement;
  if (dmItem) {
    dmItem.click();
  }
}

/**
 * Bildirim türüne göre simge döndürür
 * @param type - Bildirim türü
 * @returns Simge adı
 */
function getNotificationIcon(type: string): string {
  switch (type) {
    case 'mention':
      return 'alternate_email';
    case 'directMessage':
      return 'chat';
    case 'friendRequest':
      return 'person_add';
    default:
      return 'notifications';
  }
}

/**
 * Bildirim ayarlarını yükler
 */
function loadNotificationSettings(): void {
  const settingsJson = localStorage.getItem('fisqos_notification_settings');
  if (settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      notificationSettings = { ...notificationSettings, ...settings };
    } catch (error) {
      console.error('Bildirim ayarları yüklenemedi:', error);
    }
  }
}

/**
 * Bildirim ayarlarını kaydeder
 */
function saveNotificationSettings(): void {
  localStorage.setItem('fisqos_notification_settings', JSON.stringify(notificationSettings));
}

/**
 * Bildirim ayarlarını günceller
 * @param settings - Yeni ayarlar
 */
export function updateNotificationSettings(settings: Partial<NotificationSettings>): void {
  notificationSettings = { ...notificationSettings, ...settings };
  saveNotificationSettings();
}

/**
 * Bildirim ayarlarını döndürür
 * @returns Bildirim ayarları
 */
export function getNotificationSettings(): NotificationSettings {
  return { ...notificationSettings };
}
