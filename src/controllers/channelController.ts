/**
 * src/controllers/channelController.ts
 * Kanal controller'ı
 */
import { Response } from 'express';
import mongoose from 'mongoose';
import { Channel, IChannel } from '../models/Channel';
import { Group } from '../models/Group';
import { Message } from '../models/Message';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getDocField, getDocId, getDocRefId, updateDocFields } from '../utils/document-helpers';
import { createAuthRouteHandler } from '../utils/express-helpers';
import { AuthRequest } from '../types/express';

/**
 * @swagger
 * /api/groups/{groupId}/channels:
 *   get:
 *     summary: Grup kanallarını getirir
 *     tags: [Channels]
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
 *         description: Kanal listesi
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
 *                     $ref: '#/components/schemas/Channel'
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
export const getChannels = createAuthRouteHandler(async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params;
  const user = req.user;

  // Grubu bul
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Kullanıcı grup üyesi mi kontrol et
  const userId = getDocId(user);
  const groupUsers = getDocField<any, 'users'>(group, 'users', []);
  const isMember = groupUsers.some((memberId: any) =>
    memberId.toString() === userId
  );

  if (!isMember) {
    throw new ForbiddenError('Bu grubun üyesi değilsiniz');
  }

  // Kanalları getir
  const channels = await Channel.find({ group: groupId })
    .select('name description type isPrivate createdAt')
    .sort({ type: 1, name: 1 })
    .lean();

  logger.info('Grup kanalları getirildi', {
    userId,
    groupId,
    channelCount: channels.length
  });

  return res.json({
    success: true,
    data: channels
  });
});

/**
 * @swagger
 * /api/groups/{groupId}/channels:
 *   post:
 *     summary: Yeni kanal oluşturur
 *     tags: [Channels]
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
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Kanal adı
 *                 example: Genel
 *               description:
 *                 type: string
 *                 description: Kanal açıklaması
 *                 example: Genel sohbet kanalı
 *               type:
 *                 type: string
 *                 enum: [text, voice]
 *                 description: Kanal tipi
 *                 example: text
 *               isPrivate:
 *                 type: boolean
 *                 description: Özel kanal mı?
 *                 example: false
 *     responses:
 *       201:
 *         description: Kanal başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Channel'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
export const createChannel = createAuthRouteHandler(async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params;
  const { name, description, type, isPrivate } = req.body;
  const user = req.user;

  if (!name) {
    throw new ValidationError('Kanal adı zorunludur');
  }

  if (!type || !['text', 'voice'].includes(type)) {
    throw new ValidationError('Geçerli bir kanal tipi belirtmelisiniz (text veya voice)');
  }

  // Grubu bul
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Yetki kontrolü
  const userId = getDocId(user);
  const groupData = group.toObject();
  const members = groupData.members || [];
  const member = members.find((m: any) => m.user.toString() === userId);

  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new ForbiddenError('Bu işlem için yetkiniz yok');
  }

  // Kanal oluştur
  const channelId = new mongoose.Types.ObjectId().toString();
  const channel = new Channel({
    channelId,
    name,
    description: description || '',
    type,
    group: groupId,
    createdBy: userId,
    isPrivate: isPrivate || false
  });

  await channel.save();

  logger.info('Yeni kanal oluşturuldu', {
    userId,
    groupId,
    channelId: channel._id,
    channelName: name,
    channelType: type
  });

  return res.status(201).json({
    success: true,
    data: {
      _id: channel._id,
      name: channel.name,
      description: channel.description,
      type: channel.type,
      isPrivate: channel.isPrivate,
      group: channel.group,
      createdBy: channel.createdBy,
      createdAt: channel.createdAt
    }
  });
});

/**
 * @swagger
 * /api/channels/{channelId}:
 *   get:
 *     summary: Kanal detaylarını getirir
 *     tags: [Channels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         schema:
 *           type: string
 *         required: true
 *         description: Kanal ID
 *     responses:
 *       200:
 *         description: Kanal detayları
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Channel'
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Kanal bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getChannelById = createAuthRouteHandler(async (req: AuthRequest, res: Response) => {
  const { channelId } = req.params;
  const user = req.user;

  // Kanalı bul
  const channel = await Channel.findById(channelId)
    .populate('createdBy', 'username name surname')
    .lean();

  if (!channel) {
    throw new NotFoundError('Kanal bulunamadı');
  }

  // Grubu bul
  const groupId = getDocRefId<IChannel>(channel, 'group');
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Kullanıcı grup üyesi mi kontrol et
  const userId = getDocId(user);
  const groupData = group.toObject();
  const groupUsers = groupData.users || [];
  const isMember = groupUsers.some((memberId: any) =>
    memberId.toString() === userId
  );

  if (!isMember) {
    throw new ForbiddenError('Bu grubun üyesi değilsiniz');
  }

  logger.info('Kanal detayları getirildi', {
    userId,
    channelId,
    groupId
  });

  return res.json({
    success: true,
    data: channel
  });
});

/**
 * @swagger
 * /api/channels/{channelId}:
 *   put:
 *     summary: Kanal bilgilerini günceller
 *     tags: [Channels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         schema:
 *           type: string
 *         required: true
 *         description: Kanal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Kanal adı
 *                 example: Yeni Kanal Adı
 *               description:
 *                 type: string
 *                 description: Kanal açıklaması
 *                 example: Yeni kanal açıklaması
 *               isPrivate:
 *                 type: boolean
 *                 description: Özel kanal mı?
 *                 example: true
 *     responses:
 *       200:
 *         description: Kanal başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Channel'
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Kanal bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const updateChannel = createAuthRouteHandler(async (req: AuthRequest, res: Response) => {
  const { channelId } = req.params;
  const { name, description, isPrivate } = req.body;
  const user = req.user;

  // Kanalı bul
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new NotFoundError('Kanal bulunamadı');
  }

  // Grubu bul
  const groupId = getDocRefId<IChannel>(channel, 'group');
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Yetki kontrolü
  const userId = getDocId(user);
  const groupData = group.toObject();
  const members = groupData.members || [];
  const member = members.find((m: any) => m.user.toString() === userId);

  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new ForbiddenError('Bu işlem için yetkiniz yok');
  }

  // Kanalı güncelle
  updateDocFields<IChannel>(channel, {
    ...(name && { name }),
    ...(description !== undefined && { description }),
    ...(isPrivate !== undefined && { isPrivate })
  });

  await channel.save();

  logger.info('Kanal güncellendi', {
    userId,
    channelId,
    groupId,
    updates: { name, description, isPrivate }
  });

  return res.json({
    success: true,
    data: {
      _id: getDocId(channel),
      name: getDocField<IChannel, 'name'>(channel, 'name', ''),
      description: getDocField<IChannel, 'description'>(channel, 'description', ''),
      type: getDocField<IChannel, 'type'>(channel, 'type', 'text'),
      isPrivate: getDocField<IChannel, 'isPrivate'>(channel, 'isPrivate', false),
      group: groupId,
      updatedAt: new Date()
    }
  });
});

/**
 * @swagger
 * /api/channels/{channelId}:
 *   delete:
 *     summary: Kanalı siler
 *     tags: [Channels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         schema:
 *           type: string
 *         required: true
 *         description: Kanal ID
 *     responses:
 *       200:
 *         description: Kanal başarıyla silindi
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
 *                       example: Kanal başarıyla silindi
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Kanal bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const deleteChannel = createAuthRouteHandler(async (req: AuthRequest, res: Response) => {
  const { channelId } = req.params;
  const user = req.user;

  // Kanalı bul
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new NotFoundError('Kanal bulunamadı');
  }

  // Grubu bul
  const groupId = getDocRefId<IChannel>(channel, 'group');
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Yetki kontrolü
  const userId = getDocId(user);
  const groupData = group.toObject();
  const members = groupData.members || [];
  const member = members.find((m: any) => m.user.toString() === userId);

  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new ForbiddenError('Bu işlem için yetkiniz yok');
  }

  // Kanala ait mesajları sil
  await Message.deleteMany({ channel: channelId });

  // Kanalı sil
  await Channel.findByIdAndDelete(channelId);

  logger.info('Kanal silindi', {
    userId,
    channelId,
    groupId,
    channelName: getDocField<IChannel, 'name'>(channel, 'name', ''),
    channelType: getDocField<IChannel, 'type'>(channel, 'type', 'text')
  });

  return res.json({
    success: true,
    data: {
      message: 'Kanal başarıyla silindi',
      id: channelId
    }
  });
});

/**
 * @swagger
 * /api/channels/{channelId}/users:
 *   get:
 *     summary: Kanal kullanıcılarını getirir
 *     tags: [Channels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         schema:
 *           type: string
 *         required: true
 *         description: Kanal ID
 *     responses:
 *       200:
 *         description: Kullanıcı listesi
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
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       name:
 *                         type: string
 *                       surname:
 *                         type: string
 *                       status:
 *                         type: string
 *                       role:
 *                         type: string
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Kanal bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getChannelUsers = createAuthRouteHandler(async (req: AuthRequest, res: Response) => {
  const { channelId } = req.params;
  const user = req.user;

  // Kanalı bul
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new NotFoundError('Kanal bulunamadı');
  }

  // Grubu bul
  const groupId = getDocRefId<IChannel>(channel, 'group');
  const group = await Group.findById(groupId)
    .populate('members.user', 'username name surname profilePicture status')
    .lean();

  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Kullanıcı grup üyesi mi kontrol et
  const userId = getDocId(user);
  const groupData = group as any;
  const members = groupData.members || [];
  const isMember = members.some((member: any) =>
    getDocId(member.user) === userId
  );

  if (!isMember) {
    throw new ForbiddenError('Bu grubun üyesi değilsiniz');
  }

  // Kullanıcıları formatla
  const users = members.map((member: any) => ({
    _id: member.user._id,
    username: member.user.username,
    name: member.user.name,
    surname: member.user.surname,
    profilePicture: member.user.profilePicture,
    status: member.user.status,
    role: member.role,
    joinedAt: member.joinedAt
  }));

  logger.info('Kanal kullanıcıları getirildi', {
    userId,
    channelId,
    groupId,
    userCount: users.length
  });

  return res.json({
    success: true,
    data: users
  });
});

export default {
  getChannels,
  createChannel,
  getChannelById,
  updateChannel,
  deleteChannel,
  getChannelUsers
};
