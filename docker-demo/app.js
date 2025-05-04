const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// Statik dosyaları sun
app.use(express.static(path.join(__dirname, '../public')));

// Ana sayfa rotası
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API rotası
app.get('/api', (req, res) => {
  res.json({ message: 'API çalışıyor!' });
});

// Auth API rotaları
app.post('/api/auth/login', (req, res) => {
  // Basit bir giriş yanıtı
  res.json({
    userId: '123456',
    username: 'testuser',
    name: 'Test',
    surname: 'User',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token'
  });
});

app.post('/api/auth/register', (req, res) => {
  // Basit bir kayıt yanıtı
  res.json({
    success: true,
    message: 'Kayıt başarılı'
  });
});

// Gruplar API
app.get('/api/groups', (req, res) => {
  res.json({
    groups: [
      { id: '1', name: 'Genel Grup' },
      { id: '2', name: 'Test Grubu' }
    ]
  });
});

// Kanallar API
app.get('/api/groups/:groupId/channels', (req, res) => {
  const groupId = req.params.groupId;
  res.json({
    channels: [
      { id: '101', name: 'Genel', type: 'text', groupId },
      { id: '102', name: 'Sesli Sohbet', type: 'voice', groupId }
    ]
  });
});

// Mesajlar API
app.get('/api/channels/:channelId/messages', (req, res) => {
  const channelId = req.params.channelId;
  res.json({
    messages: [
      {
        id: '1001',
        content: 'Merhaba, bu bir test mesajıdır.',
        timestamp: new Date().toISOString(),
        sender: { id: '123', username: 'testuser' },
        channelId
      },
      {
        id: '1002',
        content: 'Socket.IO entegrasyonu test ediliyor.',
        timestamp: new Date().toISOString(),
        sender: { id: '456', username: 'admin' },
        channelId
      }
    ]
  });
});

// Mesaj gönderme API
app.post('/api/channels/:channelId/messages', (req, res) => {
  try {
    const channelId = req.params.channelId;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Mesaj içeriği gereklidir' });
    }

    const message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toISOString(),
      sender: { id: '123', username: 'testuser' },
      channelId
    };

    // Socket.IO ile mesajı yayınla
    io.to(`channel:${channelId}`).emit('message:received', message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Mesaj gönderme hatası:', error);
    res.status(500).json({ error: 'Mesaj gönderilirken bir hata oluştu' });
  }
});

// Kullanıcılar API
app.get('/api/channels/:channelId/users', (req, res) => {
  res.json({
    users: [
      { id: '123', username: 'testuser', status: 'online' },
      { id: '456', username: 'admin', status: 'online' },
      { id: '789', username: 'user3', status: 'offline' }
    ]
  });
});

// Socket.IO bağlantı işlemleri
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Kimlik doğrulama hatası: Token bulunamadı'));
  }

  // Gerçek uygulamada token doğrulaması yapılmalı
  // Şimdilik test token'ı kabul ediyoruz
  if (token === 'test-token') {
    socket.user = {
      id: '123456',
      username: 'testuser'
    };
    return next();
  }

  return next(new Error('Kimlik doğrulama hatası: Geçersiz token'));
});

io.on('connection', (socket) => {
  console.log('Yeni bir kullanıcı bağlandı:', socket.id);

  // Kimlik doğrulama başarılı olayını gönder
  socket.emit('auth:success', {
    userId: socket.user.id,
    username: socket.user.username
  });

  // Grup olayları
  socket.on('group:join', (groupId) => {
    console.log(`Kullanıcı ${socket.user.username} ${groupId} grubuna katıldı`);
    socket.join(`group:${groupId}`);
  });

  // Kanal olayları
  socket.on('channel:join', (channelId) => {
    console.log(`Kullanıcı ${socket.user.username} ${channelId} kanalına katıldı`);
    socket.join(`channel:${channelId}`);
  });

  // Mesaj olayları
  socket.on('message:send', (data) => {
    const { channelId, content } = data;

    const message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toISOString(),
      sender: {
        id: socket.user.id,
        username: socket.user.username
      },
      channelId
    };

    console.log(`Yeni mesaj: ${socket.user.username} -> ${channelId}: ${content}`);

    // Mesajı kanaldaki herkese gönder
    io.to(`channel:${channelId}`).emit('message:received', message);
  });

  // Bağlantı kesildiğinde
  socket.on('disconnect', () => {
    console.log('Kullanıcı bağlantısı kesildi:', socket.id);
  });
});

server.listen(3001, '0.0.0.0', () => {
  console.log(`Server running on port 3001`);
  console.log(`Socket.IO server is running`);
});
