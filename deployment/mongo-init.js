// MongoDB başlangıç yapılandırması
db = db.getSiblingDB('sesli-sohbet');

// Koleksiyonlar
db.createCollection('users');
db.createCollection('groups');
db.createCollection('channels');
db.createCollection('messages');
db.createCollection('directMessages');
db.createCollection('sessions');
db.createCollection('files');
db.createCollection('notifications');

// İndeksler
// Kullanıcılar
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ lastSeen: -1 });
db.users.createIndex({ "friends": 1 });
db.users.createIndex({ "blocked": 1 });
db.users.createIndex({ username: "text", name: "text", surname: "text" });

// Gruplar
db.groups.createIndex({ name: 1 });
db.groups.createIndex({ owner: 1 });
db.groups.createIndex({ "members.user": 1 });

// Kanallar
db.channels.createIndex({ group: 1 });
db.channels.createIndex({ name: 1, group: 1 }, { unique: true });

// Mesajlar
db.messages.createIndex({ channel: 1, timestamp: -1 });
db.messages.createIndex({ user: 1, timestamp: -1 });
db.messages.createIndex({ isDeleted: 1 });
db.messages.createIndex({ content: "text" });
db.messages.createIndex({ mentions: 1 });
db.messages.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { isDeleted: true } });

// Direkt mesajlar
db.directMessages.createIndex({ sender: 1, recipient: 1, timestamp: -1 });
db.directMessages.createIndex({ sender: 1, timestamp: -1 });
db.directMessages.createIndex({ recipient: 1, timestamp: -1 });
db.directMessages.createIndex({ isDeleted: 1 });
db.directMessages.createIndex({ content: "text" });
db.directMessages.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { isDeleted: true } });

// Oturumlar
db.sessions.createIndex({ user: 1 });
db.sessions.createIndex({ socketId: 1 });
db.sessions.createIndex({ lastActivity: 1 });
db.sessions.createIndex({ isActive: 1 });
db.sessions.createIndex({ lastActivity: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { isActive: false } });

// Dosyalar
db.files.createIndex({ user: 1 });
db.files.createIndex({ uploadDate: -1 });
db.files.createIndex({ filename: "text" });

// Bildirimler
db.notifications.createIndex({ user: 1, isRead: 1 });
db.notifications.createIndex({ createdAt: 1 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { isRead: true } });
