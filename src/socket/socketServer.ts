/**
 * src/socket/socketServer.ts
 * Socket.IO sunucusu
 */
import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

// Geçici kullanıcı veritabanı (gerçek uygulamada MongoDB kullanılacak)
const users: Record<string, any> = {
  test: {
    username: 'test',
    passwordHash: '$2b$10$XpC5o8bIIl.//wqQVrUQ8.WZJ.uli58EOEF9zQqIzJVBM.1vwJET6', // "test" şifresinin hash'i
    name: 'Test',
    surname: 'User',
    email: 'test@example.com'
  }
};

// Aktif kullanıcılar
const activeUsers: Record<string, any> = {};

// Socket.IO sunucusu
let ioServer: Server;

// Socket.IO olaylarını başlat
export function initSocketEvents(server: any): void {
  ioServer = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioServer.on('connection', (socket) => {
    logger.info('Yeni bağlantı', { socketId: socket.id });

    // Login olayı
    socket.on('login', async (data) => {
      try {
        const { username, password } = data;

        // Kullanıcıyı kontrol et
        const user = users[username];

        if (!user) {
          socket.emit('loginResult', {
            success: false,
            message: 'Geçersiz kullanıcı adı veya şifre'
          });
          return;
        }

        // Şifreyi kontrol et
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
          socket.emit('loginResult', {
            success: false,
            message: 'Geçersiz kullanıcı adı veya şifre'
          });
          return;
        }

        // Kullanıcıyı aktif kullanıcılara ekle
        activeUsers[socket.id] = {
          username: user.username,
          name: user.name,
          surname: user.surname
        };

        // Başarılı giriş
        socket.emit('loginResult', {
          success: true,
          username: user.username,
          name: user.name,
          surname: user.surname
        });

        logger.info('Kullanıcı girişi başarılı', { username: user.username });
      } catch (error) {
        logger.error('Giriş hatası', { error: (error as Error).message });
        socket.emit('loginResult', {
          success: false,
          message: 'Giriş sırasında bir hata oluştu'
        });
      }
    });

    // Register olayı
    socket.on('register', async (data) => {
      try {
        const { username, password, name, surname, email } = data;

        // Kullanıcı adı kontrolü
        if (users[username]) {
          socket.emit('registerResult', {
            success: false,
            message: 'Bu kullanıcı adı zaten kullanılıyor'
          });
          return;
        }

        // Şifreyi hashle
        const passwordHash = await bcrypt.hash(password, 10);

        // Kullanıcıyı kaydet
        users[username] = {
          username,
          passwordHash,
          name,
          surname,
          email
        };

        // Başarılı kayıt
        socket.emit('registerResult', {
          success: true,
          message: 'Kayıt başarılı'
        });

        logger.info('Kullanıcı kaydı başarılı', { username });
      } catch (error) {
        logger.error('Kayıt hatası', { error: (error as Error).message });
        socket.emit('registerResult', {
          success: false,
          message: 'Kayıt sırasında bir hata oluştu'
        });
      }
    });

    // Bağlantı kesildiğinde
    socket.on('disconnect', () => {
      // Aktif kullanıcılardan çıkar
      if (activeUsers[socket.id]) {
        const username = activeUsers[socket.id].username;
        delete activeUsers[socket.id];
        logger.info('Kullanıcı bağlantısı kesildi', { username, socketId: socket.id });
      }
    });
  });

  logger.info('Socket.IO olayları başlatıldı');
}

// Socket.IO sunucusuna erişim
export const io = {
  to: (room: string) => ({
    emit: (event: string, data: any) => {
      if (ioServer) {
        ioServer.to(room).emit(event, data);
      } else {
        logger.debug(`Socket.IO emit (test): ${room} - ${event}`, { data });
      }
    }
  }),
  emit: (event: string, data: any) => {
    if (ioServer) {
      ioServer.emit(event, data);
    } else {
      logger.debug(`Socket.IO emit (test): ${event}`, { data });
    }
  }
};

export default {
  io,
  initSocketEvents
};
