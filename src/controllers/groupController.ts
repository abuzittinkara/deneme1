/**
 * src/controllers/groupController.ts
 * Grup controller'ı
 */
import { Request, Response, NextFunction } from 'express';
import { Group } from '../models/Group';
import { Channel } from '../models/Channel';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { UserDocument } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: Kullanıcının üye olduğu grupları getirir
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Grup listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Group'
 */
export const getGroups = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as UserDocument;

  // Kullanıcının üye olduğu grupları bul
  const groups = await Group.find({
    'members.user': user._id
  })
  .select('name description avatar inviteCode createdAt')
  .populate('owner', 'username name surname profilePicture')
  .lean();

  logger.info('Kullanıcının grupları getirildi', {
    userId: user._id,
    groupCount: groups.length
  });

  return res.json({
    success: true,
    data: groups
  });
});

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Yeni grup oluşturur
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Grup adı
 *                 example: Arkadaşlar
 *               description:
 *                 type: string
 *                 description: Grup açıklaması
 *                 example: Arkadaşlarla sohbet grubu
 *     responses:
 *       201:
 *         description: Grup başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const createGroup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { name, description } = req.body;
  const user = (req as any).user as UserDocument;

  if (!name) {
    throw new ValidationError('Grup adı zorunludur');
  }

  // Davet kodu oluştur
  const inviteCode = uuidv4().substring(0, 8);

  // Yeni grup oluştur
  const group = new Group({
    name,
    description,
    owner: user._id,
    inviteCode,
    members: [
      {
        user: user._id,
        role: 'owner',
        joinedAt: new Date()
      }
    ]
  });

  await group.save();

  // Genel kanal oluştur
  const generalChannel = new Channel({
    name: 'Genel',
    description: 'Genel sohbet kanalı',
    type: 'text',
    group: group._id,
    createdBy: user._id
  });

  await generalChannel.save();

  // Sesli kanal oluştur
  const voiceChannel = new Channel({
    name: 'Sesli Sohbet',
    description: 'Sesli sohbet kanalı',
    type: 'voice',
    group: group._id,
    createdBy: user._id
  });

  await voiceChannel.save();

  logger.info('Yeni grup oluşturuldu', {
    userId: user._id,
    groupId: group._id,
    groupName: name
  });

  return res.status(201).json({
    success: true,
    data: {
      _id: group._id,
      name: group.get('name'),
      description: group.get('description'),
      inviteCode: group.get('inviteCode'),
      owner: user._id,
      createdAt: group.get('createdAt')
    }
  });
});

/**
 * @swagger
 * /api/groups/join:
 *   post:
 *     summary: Davet kodu ile gruba katılır
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inviteCode
 *             properties:
 *               inviteCode:
 *                 type: string
 *                 description: Grup davet kodu
 *                 example: a1b2c3d4
 *     responses:
 *       200:
 *         description: Gruba başarıyla katıldı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Grup bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const joinGroup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { inviteCode } = req.body;
  const user = (req as any).user as UserDocument;

  if (!inviteCode) {
    throw new ValidationError('Davet kodu zorunludur');
  }

  // Grubu bul
  const group = await Group.findOne({ inviteCode });
  if (!group) {
    throw new NotFoundError('Geçersiz davet kodu');
  }

  // Kullanıcı zaten grupta mı kontrol et
  const members = group.get('members') || [];
  const isMember = members.some((member: any) =>
    member.user && member.user.toString() === user._id.toString()
  );
  if (isMember) {
    throw new ValidationError('Zaten bu grubun üyesisiniz');
  }

  // Kullanıcıyı gruba ekle
  const updatedMembers = [...members, {
    user: user._id,
    role: 'member',
    joinedAt: new Date()
  }];
  group.set('members', updatedMembers);

  await group.save();

  logger.info('Kullanıcı gruba katıldı', {
    userId: user._id,
    groupId: group._id,
    groupName: group.get('name')
  });

  return res.json({
    success: true,
    data: {
      _id: group._id,
      name: group.get('name'),
      description: group.get('description'),
      owner: group.get('owner'),
      createdAt: group.get('createdAt')
    }
  });
});

/**
 * @swagger
 * /api/groups/{groupId}:
 *   get:
 *     summary: Grup detaylarını getirir
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: Grup ID
 *     responses:
 *       200:
 *         description: Grup detayları
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Grup bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getGroupById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  const user = (req as any).user as UserDocument;

  // Grubu bul
  const group = await Group.findById(groupId)
    .populate('owner', 'username name surname profilePicture')
    .populate('members.user', 'username name surname profilePicture status')
    .lean();

  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Kullanıcı grup üyesi mi kontrol et
  const members = group.get('members') || [];
  const isMember = members.some((member: any) =>
    member.user && member.user.toString && member.user.toString() === user._id.toString()
  );
  if (!isMember) {
    throw new ForbiddenError('Bu grubun üyesi değilsiniz');
  }

  // Gruba ait kanalları getir
  const channels = await Channel.find({ group: groupId })
    .select('name description type createdAt')
    .sort({ type: 1, name: 1 })
    .lean();

  // Grup bilgilerine kanalları ekle
  const groupWithChannels = {
    ...group,
    channels
  };

  logger.info('Grup detayları getirildi', {
    userId: user._id,
    groupId
  });

  return res.json({
    success: true,
    data: groupWithChannels
  });
});

/**
 * @swagger
 * /api/groups/{groupId}:
 *   put:
 *     summary: Grup bilgilerini günceller
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: Grup ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Grup adı
 *                 example: Yeni Grup Adı
 *               description:
 *                 type: string
 *                 description: Grup açıklaması
 *                 example: Yeni grup açıklaması
 *     responses:
 *       200:
 *         description: Grup başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Grup bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const updateGroup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  const { name, description } = req.body;
  const user = (req as any).user as UserDocument;

  // Grubu bul
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Yetki kontrolü
  const members = group.get('members') || [];
  const member = members.find((member: any) =>
    member.user && member.user.toString() === user._id.toString()
  );
  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new ForbiddenError('Bu işlem için yetkiniz yok');
  }

  // Grubu güncelle
  if (name) group.set('name', name);
  if (description !== undefined) group.set('description', description);

  await group.save();

  logger.info('Grup güncellendi', {
    userId: user._id,
    groupId,
    updates: { name, description }
  });

  return res.json({
    success: true,
    data: {
      _id: group._id,
      name: group.get('name'),
      description: group.get('description'),
      owner: group.get('owner'),
      updatedAt: new Date()
    }
  });
});

/**
 * @swagger
 * /api/groups/{groupId}:
 *   delete:
 *     summary: Grubu siler
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: Grup ID
 *     responses:
 *       200:
 *         description: Grup başarıyla silindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Grup başarıyla silindi
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Grup bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const deleteGroup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  const user = (req as any).user as UserDocument;

  // Grubu bul
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Yetki kontrolü
  const members = group.get('members') || [];
  const member = members.find((member: any) =>
    member.user && member.user.toString() === user._id.toString()
  );
  if (!member || member.role !== 'owner') {
    throw new ForbiddenError('Bu işlem için yetkiniz yok');
  }

  // Gruba ait kanalları sil
  await Channel.deleteMany({ group: groupId });

  // Grubu sil
  await Group.findByIdAndDelete(groupId);

  logger.info('Grup silindi', {
    userId: user._id,
    groupId,
    groupName: group.get('name')
  });

  return res.json({
    success: true,
    data: {
      message: 'Grup başarıyla silindi',
      id: groupId
    }
  });
});

/**
 * @swagger
 * /api/groups/{groupId}/leave:
 *   post:
 *     summary: Gruptan ayrılır
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: Grup ID
 *     responses:
 *       200:
 *         description: Gruptan başarıyla ayrıldı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Gruptan başarıyla ayrıldınız
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Grup bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const leaveGroup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  const user = (req as any).user as UserDocument;

  // Grubu bul
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Kullanıcı grup üyesi mi kontrol et
  const members = group.get('members') || [];
  const memberIndex = members.findIndex((member: any) =>
    member.user && member.user.toString() === user._id.toString()
  );
  if (memberIndex === -1) {
    throw new ValidationError('Bu grubun üyesi değilsiniz');
  }

  // Grup sahibi mi kontrol et
  const owner = group.get('owner');
  const isOwner = owner && owner.toString() === user._id.toString();
  if (isOwner) {
    throw new ValidationError('Grup sahibi gruptan ayrılamaz. Önce grup sahipliğini devredin veya grubu silin.');
  }

  // Kullanıcıyı gruptan çıkar
  const updatedMembers = [...members];
  updatedMembers.splice(memberIndex, 1);
  group.set('members', updatedMembers);
  await group.save();

  logger.info('Kullanıcı gruptan ayrıldı', {
    userId: user._id,
    groupId,
    groupName: group.get('name')
  });

  return res.json({
    success: true,
    data: {
      message: 'Gruptan başarıyla ayrıldınız',
      groupId
    }
  });
});

export default {
  getGroups,
  createGroup,
  joinGroup,
  getGroupById,
  updateGroup,
  deleteGroup,
  leaveGroup
};
