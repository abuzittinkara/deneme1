// public/sw.js
// Service Worker for Push Notifications

// Service Worker'ın yüklenmesi
self.addEventListener('install', event => {
  console.log('Service Worker yükleniyor...');
  self.skipWaiting();
});

// Service Worker'ın aktifleştirilmesi
self.addEventListener('activate', event => {
  console.log('Service Worker aktifleştirildi');
  return self.clients.claim();
});

// Push bildirimi alma
self.addEventListener('push', event => {
  console.log('Push bildirimi alındı:', event);
  
  if (!event.data) {
    console.log('Boş push bildirimi alındı');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('Push verisi:', data);
    
    // Bildirim başlığı ve içeriği
    const title = data.title || 'Fisqos';
    const options = {
      body: data.body || '',
      icon: data.icon || '/images/logo.png',
      badge: data.badge || '/images/badge.png',
      data: data.data || {},
      vibrate: [100, 50, 100],
      requireInteraction: data.requireInteraction || false
    };
    
    // Bildirimi göster
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('Push verisi işleme hatası:', error);
  }
});

// Bildirime tıklama
self.addEventListener('notificationclick', event => {
  console.log('Bildirime tıklandı:', event);
  
  // Bildirimi kapat
  event.notification.close();
  
  // Bildirim verilerini al
  const data = event.notification.data || {};
  
  // Tıklama işlemi
  let url = '/';
  
  // Bildirim türüne göre yönlendirme
  if (data.type === 'new_message') {
    if (data.channel) {
      // Kanal mesajı
      url = `/channels/${data.channel}`;
    } else if (data.sender) {
      // DM mesajı
      url = `/dm/${data.sender}`;
    }
  } else if (data.type === 'friend_request') {
    url = '/friends';
  } else if (data.type === 'group_invite') {
    url = '/groups';
  }
  
  // Uygulamayı aç veya odakla
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Açık bir pencere var mı kontrol et
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Pencereyi odakla ve URL'yi değiştir
            return client.focus().then(focusedClient => {
              if (focusedClient && url !== '/') {
                focusedClient.navigate(url);
              }
              return focusedClient;
            });
          }
        }
        
        // Açık pencere yoksa yeni pencere aç
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
