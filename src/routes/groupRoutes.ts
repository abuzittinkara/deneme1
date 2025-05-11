/**
 * src/routes/groupRoutes.ts
 * Grup rotaları
 */
import express from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { AuthRequest } from '../types/express-types';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
router.use(requireAuth as express.RequestHandler);

// Grupları listele
router.get('/', (req: AuthRequest, res) => {
  try {
    // Gerçek veritabanı entegrasyonu daha sonra yapılacak
    // Şimdilik mock veri kullanıyoruz
    const mockGroups = [
      {
        id: 'group1',
        name: 'Genel Grup',
        description: 'Herkesin katılabileceği genel grup',
        owner: 'user1',
        members: ['user1', 'user2', 'user3'],
        channels: ['channel1', 'channel2'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'group2',
        name: 'Oyun Grubu',
        description: 'Oyun severler için grup',
        owner: 'user2',
        members: ['user1', 'user2', 'user4'],
        channels: ['channel3', 'channel4'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'group3',
        name: 'Proje Grubu',
        description: 'Proje çalışmaları için grup',
        owner: 'user3',
        members: ['user2', 'user3', 'user5'],
        channels: ['channel5', 'channel6'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    res.status(200).json({
      success: true,
      data: mockGroups,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gruplar listelenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Grup detayı
router.get('/:id', (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id;

    // Gerçek veritabanı entegrasyonu daha sonra yapılacak
    // Şimdilik mock veri kullanıyoruz
    const mockGroups = {
      group1: {
        id: 'group1',
        name: 'Genel Grup',
        description: 'Herkesin katılabileceği genel grup',
        owner: 'user1',
        members: [
          { id: 'user1', username: 'admin', role: 'owner' },
          { id: 'user2', username: 'user2', role: 'admin' },
          { id: 'user3', username: 'user3', role: 'member' },
        ],
        channels: [
          { id: 'channel1', name: 'genel', type: 'text' },
          { id: 'channel2', name: 'sesli-sohbet', type: 'voice' },
        ],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
      group2: {
        id: 'group2',
        name: 'Oyun Grubu',
        description: 'Oyun severler için grup',
        owner: 'user2',
        members: [
          { id: 'user1', username: 'admin', role: 'member' },
          { id: 'user2', username: 'user2', role: 'owner' },
          { id: 'user4', username: 'user4', role: 'member' },
        ],
        channels: [
          { id: 'channel3', name: 'genel', type: 'text' },
          { id: 'channel4', name: 'oyun-sohbet', type: 'voice' },
        ],
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      },
      group3: {
        id: 'group3',
        name: 'Proje Grubu',
        description: 'Proje çalışmaları için grup',
        owner: 'user3',
        members: [
          { id: 'user2', username: 'user2', role: 'member' },
          { id: 'user3', username: 'user3', role: 'owner' },
          { id: 'user5', username: 'user5', role: 'admin' },
        ],
        channels: [
          { id: 'channel5', name: 'genel', type: 'text' },
          { id: 'channel6', name: 'proje-toplantı', type: 'voice' },
        ],
        createdAt: '2023-01-03T00:00:00.000Z',
        updatedAt: '2023-01-03T00:00:00.000Z',
      },
    };

    const group = mockGroups[groupId as keyof typeof mockGroups];

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grup bulunamadı',
      });
    }

    res.status(200).json({
      success: true,
      data: group,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Grup detayları getirilirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Yeni grup oluştur
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, type, icon, rules } = req.body;

    // Validasyon
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Grup adı zorunludur',
      });
    }

    // Grup oluştur
    const groupService = req.app.locals.groupService;
    const newGroup = await groupService.createGroup({
      name,
      ownerId: req.user._id,
      description,
      type,
      icon,
      rules,
    });

    res.status(201).json({
      success: true,
      data: newGroup,
      message: 'Grup başarıyla oluşturuldu',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Grup oluşturulurken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Grup güncelle
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id;
    const { name, description, type, icon, rules } = req.body;

    // Validasyon
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Grup adı zorunludur',
      });
    }

    // Grup güncelle
    const groupService = req.app.locals.groupService;
    const updatedGroup = await groupService.updateGroup(
      groupId,
      {
        name,
        description,
        type,
        icon,
        rules,
      },
      req.user._id
    );

    if (!updatedGroup) {
      return res.status(404).json({
        success: false,
        message: 'Grup bulunamadı',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedGroup,
      message: 'Grup başarıyla güncellendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Grup güncellenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Grup sil
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id;

    // Grup sil
    const groupService = req.app.locals.groupService;
    const success = await groupService.deleteGroup(groupId, req.user._id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Grup bulunamadı veya silme işlemi başarısız oldu',
      });
    }

    res.status(200).json({
      success: true,
      message: `Grup başarıyla silindi: ${groupId}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Grup silinirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Gruba üye ekle
router.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id;
    const { userId } = req.body;

    // Validasyon
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı ID zorunludur',
      });
    }

    // Kullanıcıyı gruba ekle
    const groupService = req.app.locals.groupService;
    const success = await groupService.addUserToGroup(groupId, userId, req.user._id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Grup bulunamadı veya kullanıcı ekleme işlemi başarısız oldu',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Kullanıcı gruba başarıyla eklendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kullanıcı gruba eklenirken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

// Gruptan üye çıkar
router.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.params.userId;

    // Kullanıcıyı gruptan çıkar
    const groupService = req.app.locals.groupService;
    const success = await groupService.removeUserFromGroup(groupId, userId, req.user._id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Grup bulunamadı veya kullanıcı çıkarma işlemi başarısız oldu',
      });
    }

    res.status(200).json({
      success: true,
      message: `Kullanıcı gruptan başarıyla çıkarıldı: ${userId}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Kullanıcı gruptan çıkarılırken bir hata oluştu',
      error: (error as Error).message,
    });
  }
});

export default router;
