/**
 * src/routes/messageRoutes.ts
 * Mesaj rotaları
 */
import express from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { AuthRequest } from '../types/express-types';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
router.use(requireAuth as express.RequestHandler);

/**
 * @route GET /api/messages
 * @desc Tüm mesajları listele (sayfalı)
 * @access Private
 */
router.get('/', (req: AuthRequest, res) => {
  try {
    // Sayfalama parametrelerini al
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const channelId = req.query.channelId as string;

    // Validasyon
    if (!channelId) {
      return res.status(400).json({
        success: false,
        message: 'Kanal ID zorunludur',
      });
    }

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz sayfalama parametreleri',
      });
    }

    // Gerçek veritabanı entegrasyonu daha sonra yapılacak
    // Şimdilik mock veri kullanıyoruz
    const mockMessages = [];

    // Örnek mesajlar oluştur
    for (let i = 0; i < limit; i++) {
      const messageId = `msg_${channelId}_${(page - 1) * limit + i + 1}`;
      const timestamp = new Date();
      timestamp.setMinutes(timestamp.getMinutes() - ((page - 1) * limit + i));

      mockMessages.push({
        id: messageId,
        channelId,
        content: `Bu bir test mesajıdır #${(page - 1) * limit + i + 1}`,
        sender: {
          id: i % 3 === 0 ? 'user1' : i % 3 === 1 ? 'user2' : 'user3',
          username: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'user2' : 'user3',
          avatar: `https://ui-avatars.com/api/?name=${i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'user2' : 'user3'}&background=random`,
        },
        attachments:
          i % 5 === 0
            ? [
              {
                id: `attachment_${messageId}_1`,
                type: 'image',
                url: 'https://picsum.photos/200/300',
                filename: 'ornek_resim.jpg',
                size: 12345,
              },
            ]
            : [],
        reactions:
          i % 4 === 0
            ? [
              { emoji: '👍', count: 2, users: ['user1', 'user2'] },
              { emoji: '❤️', count: 1, users: ['user3'] },
            ]
            : [],
        createdAt: timestamp.toISOString(),
        updatedAt:
          i % 7 === 0
            ? new Date(timestamp.getTime() + 5 * 60000).toISOString()
            : timestamp.toISOString(),
        isEdited: i % 7 === 0,
      });
    }

    // Toplam mesaj sayısı (örnek)
    const totalMessages = 1000;

    // Sayfalama bilgilerini oluştur
    const pagination = {
      total: totalMessages,
      page,
      limit,
      pages: Math.ceil(totalMessages / limit),
    };

    res.status(200).json({
      success: true,
      data: mockMessages,
      meta: {
        pagination,
      },
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Mesajlar listelenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/messages/:id
 * @desc Mesaj detayını getir
 * @access Private
 */
router.get('/:id', (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;

    // Gerçek veritabanı entegrasyonu daha sonra yapılacak
    // Şimdilik mock veri kullanıyoruz

    // Mesaj ID'sini parçalara ayır (örnek: msg_channel1_123)
    const parts = messageId.split('_');
    if (parts.length < 3) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı',
      });
    }

    const channelId = parts[1];
    const messageNumber = parseInt(parts[2]);

    // Örnek mesaj oluştur
    const timestamp = new Date();
    timestamp.setMinutes(timestamp.getMinutes() - messageNumber);

    const mockMessage = {
      id: messageId,
      channelId,
      content: `Bu bir test mesajıdır #${messageNumber}`,
      sender: {
        id: messageNumber % 3 === 0 ? 'user1' : messageNumber % 3 === 1 ? 'user2' : 'user3',
        username: messageNumber % 3 === 0 ? 'admin' : messageNumber % 3 === 1 ? 'user2' : 'user3',
        avatar: `https://ui-avatars.com/api/?name=${messageNumber % 3 === 0 ? 'admin' : messageNumber % 3 === 1 ? 'user2' : 'user3'}&background=random`,
      },
      attachments:
        messageNumber % 5 === 0
          ? [
            {
              id: `attachment_${messageId}_1`,
              type: 'image',
              url: 'https://picsum.photos/200/300',
              filename: 'ornek_resim.jpg',
              size: 12345,
            },
          ]
          : [],
      reactions:
        messageNumber % 4 === 0
          ? [
            { emoji: '👍', count: 2, users: ['user1', 'user2'] },
            { emoji: '❤️', count: 1, users: ['user3'] },
          ]
          : [],
      createdAt: timestamp.toISOString(),
      updatedAt:
        messageNumber % 7 === 0
          ? new Date(timestamp.getTime() + 5 * 60000).toISOString()
          : timestamp.toISOString(),
      isEdited: messageNumber % 7 === 0,
      thread:
        messageNumber % 6 === 0
          ? {
            count: 3,
            lastReply: {
              id: `msg_${channelId}_thread_${messageNumber}_3`,
              content: 'Bu bir yanıt mesajıdır',
              sender: {
                id: 'user2',
                username: 'user2',
              },
              createdAt: new Date(timestamp.getTime() + 30 * 60000).toISOString(),
            },
          }
          : null,
      mentions:
        messageNumber % 8 === 0
          ? [
            { id: 'user1', username: 'admin', type: 'user' },
            { id: 'role1', name: 'moderator', type: 'role' },
          ]
          : [],
    };

    res.status(200).json({
      success: true,
      data: mockMessage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Mesaj detayı getirilirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/messages/channel/:channelId
 * @desc Kanal mesajlarını getir (sayfalı)
 * @access Private
 */
router.get('/channel/:channelId', (req: AuthRequest, res) => {
  try {
    const channelId = req.params.channelId;

    // Sayfalama parametrelerini al
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const before = req.query.before as string; // Belirli bir mesajdan önceki mesajları getir
    const after = req.query.after as string; // Belirli bir mesajdan sonraki mesajları getir

    // Validasyon
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz sayfalama parametreleri',
      });
    }

    // Gerçek veritabanı entegrasyonu daha sonra yapılacak
    // Şimdilik mock veri kullanıyoruz
    const mockMessages = [];

    // Örnek mesajlar oluştur
    for (let i = 0; i < limit; i++) {
      const messageId = `msg_${channelId}_${(page - 1) * limit + i + 1}`;
      const timestamp = new Date();
      timestamp.setMinutes(timestamp.getMinutes() - ((page - 1) * limit + i));

      mockMessages.push({
        id: messageId,
        channelId,
        content: `Bu bir test mesajıdır #${(page - 1) * limit + i + 1}`,
        sender: {
          id: i % 3 === 0 ? 'user1' : i % 3 === 1 ? 'user2' : 'user3',
          username: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'user2' : 'user3',
          avatar: `https://ui-avatars.com/api/?name=${i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'user2' : 'user3'}&background=random`,
        },
        attachments:
          i % 5 === 0
            ? [
              {
                id: `attachment_${messageId}_1`,
                type: 'image',
                url: 'https://picsum.photos/200/300',
                filename: 'ornek_resim.jpg',
                size: 12345,
              },
            ]
            : [],
        reactions:
          i % 4 === 0
            ? [
              { emoji: '👍', count: 2, users: ['user1', 'user2'] },
              { emoji: '❤️', count: 1, users: ['user3'] },
            ]
            : [],
        createdAt: timestamp.toISOString(),
        updatedAt:
          i % 7 === 0
            ? new Date(timestamp.getTime() + 5 * 60000).toISOString()
            : timestamp.toISOString(),
        isEdited: i % 7 === 0,
        thread:
          i % 6 === 0
            ? {
              count: 3,
              lastReply: {
                id: `msg_${channelId}_thread_${(page - 1) * limit + i + 1}_3`,
                content: 'Bu bir yanıt mesajıdır',
                sender: {
                  id: 'user2',
                  username: 'user2',
                },
                createdAt: new Date(timestamp.getTime() + 30 * 60000).toISOString(),
              },
            }
            : null,
      });
    }

    // Toplam mesaj sayısı (örnek)
    const totalMessages = 1000;

    // Sayfalama bilgilerini oluştur
    const pagination = {
      total: totalMessages,
      page,
      limit,
      pages: Math.ceil(totalMessages / limit),
    };

    // Önceki ve sonraki sayfa için cursor değerleri
    const cursors = {
      before: mockMessages.length > 0 ? mockMessages[0].id : null,
      after: mockMessages.length > 0 ? mockMessages[mockMessages.length - 1].id : null,
    };

    res.status(200).json({
      success: true,
      data: mockMessages,
      meta: {
        pagination,
        cursors,
      },
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kanal mesajları getirilirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/messages
 * @desc Yeni mesaj oluştur
 * @access Private
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { content, channelId, attachments, quotedMessageId, mentions } = req.body;

    // Validasyon
    if (!channelId) {
      return res.status(400).json({
        success: false,
        message: 'Kanal ID zorunludur',
      });
    }

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Mesaj içeriği veya ek dosya zorunludur',
      });
    }

    // Mesaj oluştur
    const messageService = req.app.locals.messageService;
    const newMessage = await messageService.createMessage({
      channelId,
      userId: req.user._id,
      content: content || '',
      attachments,
      quotedMessageId,
      mentions,
    });

    res.status(201).json({
      success: true,
      data: newMessage,
      message: 'Mesaj başarıyla oluşturuldu',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Mesaj oluşturulurken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

/**
 * @route PUT /api/messages/:id
 * @desc Mesaj güncelle
 * @access Private
 */
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    const { content } = req.body;

    // Validasyon
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Mesaj içeriği zorunludur',
      });
    }

    // Mesaj güncelle
    const messageService = req.app.locals.messageService;
    const updatedMessage = await messageService.updateMessage(messageId, { content }, req.user._id);

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedMessage,
      message: 'Mesaj başarıyla güncellendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Mesaj güncellenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

/**
 * @route DELETE /api/messages/:id
 * @desc Mesaj sil
 * @access Private
 */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;

    // Mesaj sil
    const messageService = req.app.locals.messageService;
    const success = await messageService.deleteMessage(messageId, req.user._id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı veya silme işlemi başarısız oldu',
      });
    }

    res.status(200).json({
      success: true,
      message: `Mesaj başarıyla silindi: ${messageId}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Mesaj silinirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/messages/:id/reactions
 * @desc Mesaja reaksiyon ekle
 * @access Private
 */
router.post('/:id/reactions', async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    const { emoji } = req.body;

    // Validasyon
    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji zorunludur',
      });
    }

    // Reaksiyon ekle
    const messageService = req.app.locals.messageService;
    const success = await messageService.addReaction(messageId, req.user._id, emoji);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı veya reaksiyon ekleme işlemi başarısız oldu',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reaksiyon başarıyla eklendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Reaksiyon eklenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

/**
 * @route DELETE /api/messages/:id/reactions/:emoji
 * @desc Mesajdan reaksiyon kaldır
 * @access Private
 */
router.delete('/:id/reactions/:emoji', async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    const emoji = req.params.emoji;

    // Reaksiyon kaldır
    const messageService = req.app.locals.messageService;
    const success = await messageService.removeReaction(messageId, req.user._id, emoji);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı veya reaksiyon kaldırma işlemi başarısız oldu',
      });
    }

    res.status(200).json({
      success: true,
      message: `Reaksiyon başarıyla kaldırıldı: ${emoji}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Reaksiyon kaldırılırken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

export default router;
