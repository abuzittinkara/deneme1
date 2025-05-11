/**
 * public/js/realtime.ts
 * Gerçek zamanlı iletişim işlevleri
 */

// Socket.IO bağlantısı
let socket: any = null;

// Yazıyor... zamanlayıcısı
let typingTimer: number | null = null;

// Çevrimiçi kullanıcılar
const onlineUsers = new Map<string, {
  userId: string;
  username: string;
  status: string;
}>();

// Olay dinleyicileri
const eventListeners = new Map<string, Set<Function>>();

/**
 * Socket.IO bağlantısını başlatır
 * @param token - Kimlik doğrulama token'ı
 */
export function initSocket(token: string): void {
  // Socket.IO bağlantısını oluştur
  socket = io({
    auth: {
      token,
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // Bağlantı olayları
  socket.on('connect', handleConnect);
  socket.on('disconnect', handleDisconnect);
  socket.on('error', handleError);

  // Mesaj olayları
  socket.on('message:new', handleNewMessage);
  socket.on('message:update', handleUpdateMessage);
  socket.on('message:delete', handleDeleteMessage);
  socket.on('message:reaction', handleMessageReaction);
  socket.on('message:reaction:remove', handleMessageReactionRemove);

  // Kullanıcı olayları
  socket.on('user:typing', handleUserTyping);
  socket.on('presence:online', handleUserOnline);
  socket.on('presence:offline', handleUserOffline);
  socket.on('presence:status', handleUserStatus);
  socket.on('presence:list', handleUserList);

  // Görüşme olayları
  socket.on('call:start', handleCallStart);
  socket.on('call:join', handleCallJoin);
  socket.on('call:leave', handleCallLeave);
  socket.on('call:end', handleCallEnd);
  socket.on('call:signal:offer', handleCallSignalOffer);
  socket.on('call:signal:answer', handleCallSignalAnswer);
  socket.on('call:signal:ice-candidate', handleCallSignalIceCandidate);
  socket.on('call:media-state', handleCallMediaState);
  socket.on('call:screen-share', handleCallScreenShare);
}

/**
 * Socket.IO bağlantısını kapatır
 */
export function closeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Bağlantı olayını işler
 */
function handleConnect(): void {
  console.log('Socket.IO bağlantısı kuruldu');
  triggerEvent('connect');
}

/**
 * Bağlantı kesme olayını işler
 * @param reason - Bağlantı kesme nedeni
 */
function handleDisconnect(reason: string): void {
  console.log('Socket.IO bağlantısı kesildi:', reason);
  triggerEvent('disconnect', reason);
}

/**
 * Hata olayını işler
 * @param error - Hata
 */
function handleError(error: any): void {
  console.error('Socket.IO hatası:', error);
  triggerEvent('error', error);
}

/**
 * Yeni mesaj olayını işler
 * @param data - Mesaj verileri
 */
function handleNewMessage(data: any): void {
  console.log('Yeni mesaj:', data);
  triggerEvent('message:new', data);
}

/**
 * Mesaj güncelleme olayını işler
 * @param data - Mesaj verileri
 */
function handleUpdateMessage(data: any): void {
  console.log('Mesaj güncellendi:', data);
  triggerEvent('message:update', data);
}

/**
 * Mesaj silme olayını işler
 * @param data - Mesaj verileri
 */
function handleDeleteMessage(data: any): void {
  console.log('Mesaj silindi:', data);
  triggerEvent('message:delete', data);
}

/**
 * Mesaj tepki olayını işler
 * @param data - Tepki verileri
 */
function handleMessageReaction(data: any): void {
  console.log('Mesaj tepkisi:', data);
  triggerEvent('message:reaction', data);
}

/**
 * Mesaj tepki kaldırma olayını işler
 * @param data - Tepki verileri
 */
function handleMessageReactionRemove(data: any): void {
  console.log('Mesaj tepkisi kaldırıldı:', data);
  triggerEvent('message:reaction:remove', data);
}

/**
 * Kullanıcı yazıyor olayını işler
 * @param data - Yazıyor verileri
 */
function handleUserTyping(data: any): void {
  console.log('Kullanıcı yazıyor:', data);
  triggerEvent('user:typing', data);
}

/**
 * Kullanıcı çevrimiçi olayını işler
 * @param data - Kullanıcı verileri
 */
function handleUserOnline(data: any): void {
  console.log('Kullanıcı çevrimiçi:', data);

  // Çevrimiçi kullanıcıları güncelle
  onlineUsers.set(data.userId, {
    userId: data.userId,
    username: data.username,
    status: data.status,
  });

  triggerEvent('presence:online', data);
}

/**
 * Kullanıcı çevrimdışı olayını işler
 * @param data - Kullanıcı verileri
 */
function handleUserOffline(data: any): void {
  console.log('Kullanıcı çevrimdışı:', data);

  // Çevrimiçi kullanıcılardan kaldır
  onlineUsers.delete(data.userId);

  triggerEvent('presence:offline', data);
}

/**
 * Kullanıcı durumu olayını işler
 * @param data - Kullanıcı verileri
 */
function handleUserStatus(data: any): void {
  console.log('Kullanıcı durumu:', data);

  // Çevrimiçi kullanıcıları güncelle
  const user = onlineUsers.get(data.userId);
  if (user) {
    user.status = data.status;
  }

  triggerEvent('presence:status', data);
}

/**
 * Kullanıcı listesi olayını işler
 * @param data - Kullanıcı listesi
 */
function handleUserList(data: any): void {
  console.log('Kullanıcı listesi:', data);

  // Çevrimiçi kullanıcıları güncelle
  onlineUsers.clear();
  data.users.forEach((user: any) => {
    onlineUsers.set(user.userId, {
      userId: user.userId,
      username: user.username,
      status: user.status,
    });
  });

  triggerEvent('presence:list', data);
}

/**
 * Görüşme başlatma olayını işler
 * @param data - Görüşme verileri
 */
function handleCallStart(data: any): void {
  console.log('Görüşme başlatıldı:', data);
  triggerEvent('call:start', data);
}

/**
 * Görüşmeye katılma olayını işler
 * @param data - Görüşme verileri
 */
function handleCallJoin(data: any): void {
  console.log('Görüşmeye katılındı:', data);
  triggerEvent('call:join', data);
}

/**
 * Görüşmeden ayrılma olayını işler
 * @param data - Görüşme verileri
 */
function handleCallLeave(data: any): void {
  console.log('Görüşmeden ayrılındı:', data);
  triggerEvent('call:leave', data);
}

/**
 * Görüşme sonlandırma olayını işler
 * @param data - Görüşme verileri
 */
function handleCallEnd(data: any): void {
  console.log('Görüşme sonlandırıldı:', data);
  triggerEvent('call:end', data);
}

/**
 * Görüşme sinyali teklif olayını işler
 * @param data - Sinyal verileri
 */
function handleCallSignalOffer(data: any): void {
  console.log('Görüşme sinyali teklifi:', data);
  triggerEvent('call:signal:offer', data);
}

/**
 * Görüşme sinyali yanıt olayını işler
 * @param data - Sinyal verileri
 */
function handleCallSignalAnswer(data: any): void {
  console.log('Görüşme sinyali yanıtı:', data);
  triggerEvent('call:signal:answer', data);
}

/**
 * Görüşme sinyali ICE adayı olayını işler
 * @param data - Sinyal verileri
 */
function handleCallSignalIceCandidate(data: any): void {
  console.log('Görüşme sinyali ICE adayı:', data);
  triggerEvent('call:signal:ice-candidate', data);
}

/**
 * Görüşme medya durumu olayını işler
 * @param data - Medya verileri
 */
function handleCallMediaState(data: any): void {
  console.log('Görüşme medya durumu:', data);
  triggerEvent('call:media-state', data);
}

/**
 * Görüşme ekran paylaşımı olayını işler
 * @param data - Ekran paylaşımı verileri
 */
function handleCallScreenShare(data: any): void {
  console.log('Görüşme ekran paylaşımı:', data);
  triggerEvent('call:screen-share', data);
}

/**
 * Olay dinleyicisi ekler
 * @param event - Olay adı
 * @param callback - Geri çağırma fonksiyonu
 */
export function addEventListener(event: string, callback: Function): void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }

  eventListeners.get(event)?.add(callback);
}

/**
 * Olay dinleyicisini kaldırır
 * @param event - Olay adı
 * @param callback - Geri çağırma fonksiyonu
 */
export function removeEventListener(event: string, callback: Function): void {
  if (eventListeners.has(event)) {
    eventListeners.get(event)?.delete(callback);
  }
}

/**
 * Olayı tetikler
 * @param event - Olay adı
 * @param data - Olay verileri
 */
function triggerEvent(event: string, data?: any): void {
  if (eventListeners.has(event)) {
    eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Olay dinleyicisi hatası (${event}):`, error);
      }
    });
  }
}

/**
 * Mesaj gönderir
 * @param content - Mesaj içeriği
 * @param channelId - Kanal ID
 * @param attachments - Ekler
 * @param quotedMessageId - Alıntılanan mesaj ID
 * @param mentions - Bahsedilen kullanıcılar
 */
export function sendMessage(
  content: string,
  channelId: string,
  attachments: any[] = [],
  quotedMessageId?: string,
  mentions: string[] = []
): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  socket.emit('message:send', {
    content,
    channelId,
    attachments,
    quotedMessageId,
    mentions,
  });

  // Yazıyor... durumunu temizle
  stopTyping(channelId);
}

/**
 * Mesajı düzenler
 * @param messageId - Mesaj ID
 * @param content - Yeni içerik
 */
export function editMessage(messageId: string, content: string): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  socket.emit('message:edit', {
    messageId,
    content,
  });
}

/**
 * Mesajı siler
 * @param messageId - Mesaj ID
 */
export function deleteMessage(messageId: string): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  socket.emit('message:delete', {
    messageId,
  });
}

/**
 * Mesaja tepki ekler
 * @param messageId - Mesaj ID
 * @param emoji - Emoji
 */
export function addReaction(messageId: string, emoji: string): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  socket.emit('message:reaction', {
    messageId,
    emoji,
  });
}

/**
 * Mesajdan tepki kaldırır
 * @param messageId - Mesaj ID
 * @param emoji - Emoji
 */
export function removeReaction(messageId: string, emoji: string): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  socket.emit('message:reaction:remove', {
    messageId,
    emoji,
  });
}

/**
 * Yazıyor... durumunu gönderir
 * @param channelId - Kanal ID
 */
export function startTyping(channelId: string): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  // Zamanlayıcıyı temizle
  if (typingTimer !== null) {
    clearTimeout(typingTimer);
  }

  // Yazıyor... durumunu gönder
  socket.emit('user:typing', {
    channelId,
    isTyping: true,
  });

  // 5 saniye sonra yazıyor... durumunu temizle
  typingTimer = window.setTimeout(() => {
    stopTyping(channelId);
  }, 5000);
}

/**
 * Yazıyor... durumunu temizler
 * @param channelId - Kanal ID
 */
export function stopTyping(channelId: string): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  // Zamanlayıcıyı temizle
  if (typingTimer !== null) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }

  // Yazıyor... durumunu temizle
  socket.emit('user:typing', {
    channelId,
    isTyping: false,
  });
}

/**
 * Kullanıcı durumunu günceller
 * @param status - Durum
 */
export function updateStatus(status: string): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  socket.emit('presence:status', {
    status,
  });
}

/**
 * Kullanıcı aktivitesini günceller
 */
export function updateActivity(): void {
  if (!socket) {
    console.error('Socket.IO bağlantısı yok');
    return;
  }

  socket.emit('presence:activity');
}

/**
 * Çevrimiçi kullanıcıları getirir
 * @returns Çevrimiçi kullanıcılar
 */
export function getOnlineUsers(): Array<{
  userId: string;
  username: string;
  status: string;
}> {
  return Array.from(onlineUsers.values());
}

/**
 * Kullanıcının çevrimiçi olup olmadığını kontrol eder
 * @param userId - Kullanıcı ID
 * @returns Kullanıcı çevrimiçi mi
 */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

/**
 * Kullanıcının durumunu getirir
 * @param userId - Kullanıcı ID
 * @returns Kullanıcı durumu
 */
export function getUserStatus(userId: string): string | null {
  const user = onlineUsers.get(userId);
  return user ? user.status : null;
}

// Dışa aktarılan nesneler
export default {
  initSocket,
  closeSocket,
  addEventListener,
  removeEventListener,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  startTyping,
  stopTyping,
  updateStatus,
  updateActivity,
  getOnlineUsers,
  isUserOnline,
  getUserStatus,
};
