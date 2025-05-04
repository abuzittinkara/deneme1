/**
 * MongoDB başlatma betiği
 * Docker Compose ile MongoDB başlatıldığında çalıştırılır
 */

// Veritabanı adı
const dbName = process.env.MONGO_INITDB_DATABASE || 'fisqos';

// Admin kullanıcı bilgileri
const adminUser = process.env.MONGO_INITDB_ROOT_USERNAME || 'admin';
const adminPassword = process.env.MONGO_INITDB_ROOT_PASSWORD || 'password';

// Uygulama kullanıcısı bilgileri
const appUser = process.env.APP_DB_USERNAME || 'fisqos_app';
const appPassword = process.env.APP_DB_PASSWORD || 'app_password';

// Admin veritabanına bağlan
const adminDb = db.getSiblingDB('admin');

// Admin kullanıcısı ile kimlik doğrulama
adminDb.auth(adminUser, adminPassword);

// Uygulama veritabanına geç
const appDb = db.getSiblingDB(dbName);

// Uygulama kullanıcısını oluştur
appDb.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [
    { role: 'readWrite', db: dbName },
    { role: 'dbAdmin', db: dbName }
  ]
});

// Koleksiyonları oluştur
appDb.createCollection('users');
appDb.createCollection('sessions');
appDb.createCollection('messages');
appDb.createCollection('channels');
appDb.createCollection('groups');
appDb.createCollection('files');
appDb.createCollection('notifications');

// İndeksleri oluştur
appDb.users.createIndex({ username: 1 }, { unique: true });
appDb.users.createIndex({ email: 1 }, { unique: true });
appDb.users.createIndex({ status: 1 });
appDb.users.createIndex({ role: 1 });
appDb.users.createIndex({ createdAt: 1 });

appDb.sessions.createIndex({ userId: 1 });
appDb.sessions.createIndex({ token: 1 }, { unique: true });
appDb.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

appDb.messages.createIndex({ channelId: 1 });
appDb.messages.createIndex({ senderId: 1 });
appDb.messages.createIndex({ createdAt: 1 });

appDb.channels.createIndex({ name: 1 });
appDb.channels.createIndex({ groupId: 1 });
appDb.channels.createIndex({ createdAt: 1 });

appDb.groups.createIndex({ name: 1 });
appDb.groups.createIndex({ ownerId: 1 });
appDb.groups.createIndex({ createdAt: 1 });

appDb.files.createIndex({ userId: 1 });
appDb.files.createIndex({ type: 1 });
appDb.files.createIndex({ createdAt: 1 });

appDb.notifications.createIndex({ userId: 1 });
appDb.notifications.createIndex({ read: 1 });
appDb.notifications.createIndex({ createdAt: 1 });

// Başlangıç verilerini ekle (opsiyonel)
if (process.env.CREATE_ADMIN_USER === 'true') {
  const bcrypt = require('bcrypt');
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('admin123', salt);
  
  appDb.users.insertOne({
    username: 'admin',
    email: 'admin@example.com',
    password: hashedPassword,
    displayName: 'Admin User',
    role: 'admin',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

print('MongoDB başlatma betiği tamamlandı');
