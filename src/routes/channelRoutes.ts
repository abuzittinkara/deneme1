/**
 * src/routes/channelRoutes.ts
 * Kanal rotaları
 */
import express from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { AuthRequest } from '../types/express-types';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
router.use(requireAuth as express.RequestHandler);

// Kanalları listele
router.get('/', (req: AuthRequest, res): void => {
  try {
    // Grup ID'ye göre filtreleme
    const groupId = req.query.groupId as string;

    // Gerçek veritabanı entegrasyonu daha sonra yapılacak
    // Şimdilik mock veri kullanıyoruz
    const mockChannels = [
      {
        id: 'channel1',
        name: 'genel',
        description: 'Genel sohbet kanalı',
        type: 'text',
        groupId: 'group1',
        createdBy: 'user1',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
      {
        id: 'channel2',
        name: 'sesli-sohbet',
        description: 'Sesli sohbet kanalı',
        type: 'voice',
        groupId: 'group1',
        createdBy: 'user1',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
      {
        id: 'channel3',
        name: 'genel',
        description: 'Genel sohbet kanalı',
        type: 'text',
        groupId: 'group2',
        createdBy: 'user2',
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      },
      {
        id: 'channel4',
        name: 'oyun-sohbet',
        description: 'Oyun sohbet kanalı',
        type: 'voice',
        groupId: 'group2',
        createdBy: 'user2',
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      },
    ];

    // Grup ID'ye göre filtreleme
    const filteredChannels = groupId
      ? mockChannels.filter((channel) => channel.groupId === groupId)
      : mockChannels;

    res.status(200).json({
      success: true,
      data: filteredChannels,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kanallar listelenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Kanal detayı
router.get('/:id', (req: AuthRequest, res): void => {
  try {
    const channelId = req.params['id'];

    // Gerçek veritabanı entegrasyonu daha sonra yapılacak
    // Şimdilik mock veri kullanıyoruz
    const mockChannels = {
      channel1: {
        id: 'channel1',
        name: 'genel',
        description: 'Genel sohbet kanalı',
        type: 'text',
        groupId: 'group1',
        createdBy: 'user1',
        members: [
          { id: 'user1', username: 'admin', role: 'owner' },
          { id: 'user2', username: 'user2', role: 'admin' },
          { id: 'user3', username: 'user3', role: 'member' },
        ],
        permissions: {
          sendMessages: true,
          embedLinks: true,
          attachFiles: true,
          addReactions: true,
          useVoice: false,
          manageMessages: false,
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
      channel2: {
        id: 'channel2',
        name: 'sesli-sohbet',
        description: 'Sesli sohbet kanalı',
        type: 'voice',
        groupId: 'group1',
        createdBy: 'user1',
        members: [
          { id: 'user1', username: 'admin', role: 'owner' },
          { id: 'user2', username: 'user2', role: 'admin' },
          { id: 'user3', username: 'user3', role: 'member' },
        ],
        permissions: {
          sendMessages: false,
          embedLinks: false,
          attachFiles: false,
          addReactions: false,
          useVoice: true,
          manageMessages: false,
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
      channel3: {
        id: 'channel3',
        name: 'genel',
        description: 'Genel sohbet kanalı',
        type: 'text',
        groupId: 'group2',
        createdBy: 'user2',
        members: [
          { id: 'user1', username: 'admin', role: 'member' },
          { id: 'user2', username: 'user2', role: 'owner' },
          { id: 'user4', username: 'user4', role: 'member' },
        ],
        permissions: {
          sendMessages: true,
          embedLinks: true,
          attachFiles: true,
          addReactions: true,
          useVoice: false,
          manageMessages: false,
        },
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      },
      channel4: {
        id: 'channel4',
        name: 'oyun-sohbet',
        description: 'Oyun sohbet kanalı',
        type: 'voice',
        groupId: 'group2',
        createdBy: 'user2',
        members: [
          { id: 'user1', username: 'admin', role: 'member' },
          { id: 'user2', username: 'user2', role: 'owner' },
          { id: 'user4', username: 'user4', role: 'member' },
        ],
        permissions: {
          sendMessages: false,
          embedLinks: false,
          attachFiles: false,
          addReactions: false,
          useVoice: true,
          manageMessages: false,
        },
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      },
    };

    const channel = mockChannels[channelId as keyof typeof mockChannels];

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Kanal bulunamadı',
      });
    }

    res.status(200).json({
      success: true,
      data: channel,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kanal detayları getirilirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Yeni kanal oluştur
router.post('/', async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, description, type, groupId, isPrivate, allowedUsers } = req.body;

    // Validasyon
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Kanal adı zorunludur',
      });
    }

    if (!type || !['text', 'voice'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Geçerli bir kanal tipi belirtilmelidir (text veya voice)',
      });
    }

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Grup ID zorunludur',
      });
    }

    // Kanal oluştur
    const channelService = req.app.locals.channelService;
    const newChannel = await channelService.createChannel({
      name,
      groupId,
      type,
      description,
      isPrivate,
      allowedUsers,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: newChannel,
      message: 'Kanal başarıyla oluşturuldu',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kanal oluşturulurken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Kanal güncelle
router.put('/:id', async (req: AuthRequest, res): Promise<void> => {
  try {
    const channelId = req.params['id'];
    const { name, description, isPrivate, allowedUsers, position } = req.body;

    // Validasyon
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Kanal adı zorunludur',
      });
    }

    // Kanal güncelle
    const channelService = req.app.locals.channelService;
    const updatedChannel = await channelService.updateChannel(
      channelId,
      {
        name,
        description,
        isPrivate,
        allowedUsers,
        position,
      },
      req.user._id
    );

    if (!updatedChannel) {
      return res.status(404).json({
        success: false,
        message: 'Kanal bulunamadı',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedChannel,
      message: 'Kanal başarıyla güncellendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kanal güncellenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Kanal sil
router.delete('/:id', async (req: AuthRequest, res): Promise<void> => {
  try {
    const channelId = req.params['id'];

    // Kanal sil
    const channelService = req.app.locals.channelService;
    const success = await channelService.deleteChannel(channelId, req.user._id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Kanal bulunamadı veya silme işlemi başarısız oldu',
      });
    }

    res.status(200).json({
      success: true,
      message: `Kanal başarıyla silindi: ${channelId}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kanal silinirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Kanal izinlerini güncelle
router.put('/:id/permissions', async (req: AuthRequest, res): Promise<void> => {
  try {
    const channelId = req.params['id'];
    const { isPrivate, allowedUsers } = req.body;

    // Validasyon
    if (isPrivate === undefined || (isPrivate && (!allowedUsers || !Array.isArray(allowedUsers)))) {
      return res.status(400).json({
        success: false,
        message: 'Geçerli izinler belirtilmelidir',
      });
    }

    // Kanal güncelle
    const channelService = req.app.locals.channelService;
    const updatedChannel = await channelService.updateChannel(
      channelId,
      {
        isPrivate,
        allowedUsers,
      },
      req.user._id
    );

    if (!updatedChannel) {
      return res.status(404).json({
        success: false,
        message: 'Kanal bulunamadı',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedChannel,
      message: 'Kanal izinleri başarıyla güncellendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kanal izinleri güncellenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

export default router;
