/**
 * src/controllers/searchController.ts
 * Arama controller'ı
 */
import { Request, Response, NextFunction } from 'express';
import { asyncHandler, sendSuccess, sendError } from '../utils/controllerUtils';
import { getSearchAndFilterParams, formatSearchResults } from '../utils/searchUtils';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import { User } from '../models/User';
import { Group } from '../models/Group';
import { Channel } from '../models/Channel';
import { Message } from '../models/Message';
import { File } from '../models/File';

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Genel arama yapar
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: true
 *         description: Arama metni
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, users, groups, channels, messages, files]
 *         description: Arama türü
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sayfa numarası
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Sayfa başına sonuç sayısı
 *     responses:
 *       200:
 *         description: Arama sonuçları başarıyla getirildi
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
 *                     users:
 *                       type: object
 *                       properties:
 *                         results:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/User'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     groups:
 *                       type: object
 *                       properties:
 *                         results:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Group'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     channels:
 *                       type: object
 *                       properties:
 *                         results:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Channel'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     messages:
 *                       type: object
 *                       properties:
 *                         results:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Message'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     files:
 *                       type: object
 *                       properties:
 *                         results:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/File'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const search = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  const searchText = req.query.search as string;
  const searchType = req.query.type as string || 'all';
  
  // Arama metni kontrolü
  if (!searchText || searchText.trim().length < 2) {
    throw new ValidationError('Arama metni en az 2 karakter olmalıdır');
  }
  
  // Arama türü kontrolü
  const validTypes = ['all', 'users', 'groups', 'channels', 'messages', 'files'];
  
  if (!validTypes.includes(searchType)) {
    throw new ValidationError(`Geçersiz arama türü: ${searchType}`);
  }
  
  // Arama sonuçları
  const results: any = {};
  
  // Kullanıcı araması
  if (searchType === 'all' || searchType === 'users') {
    const { searchQuery, filterQuery, sortParams, paginationParams } = getSearchAndFilterParams(req, {
      searchFields: ['username', 'name', 'surname', 'email'],
      allowedFilters: ['status', 'role'],
      allowedSortFields: ['username', 'name', 'surname', 'createdAt', 'lastActive'],
      defaultSortField: 'username'
    });
    
    // Arama sorgusunu oluştur
    const query = {
      $or: [
        { username: { $regex: searchText, $options: 'i' } },
        { name: { $regex: searchText, $options: 'i' } },
        { surname: { $regex: searchText, $options: 'i' } },
        { email: { $regex: searchText, $options: 'i' } }
      ],
      ...filterQuery
    };
    
    // Kullanıcıları getir
    const total = await User.countDocuments(query);
    
    const users = await User.find(query)
      .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken -passwordResetExpires')
      .sort({ [sortParams.sortBy]: sortParams.sortOrder })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);
    
    // Sonuçları formatla
    results.users = formatSearchResults(users, total, paginationParams);
  }
  
  // Grup araması
  if (searchType === 'all' || searchType === 'groups') {
    const { searchQuery, filterQuery, sortParams, paginationParams } = getSearchAndFilterParams(req, {
      searchFields: ['name', 'description'],
      allowedFilters: ['type', 'isPublic'],
      allowedSortFields: ['name', 'createdAt', 'memberCount'],
      defaultSortField: 'name'
    });
    
    // Arama sorgusunu oluştur
    const query = {
      $or: [
        { name: { $regex: searchText, $options: 'i' } },
        { description: { $regex: searchText, $options: 'i' } }
      ],
      $and: [
        {
          $or: [
            { isPublic: true },
            { owner: userId },
            { members: userId }
          ]
        }
      ],
      ...filterQuery
    };
    
    // Grupları getir
    const total = await Group.countDocuments(query);
    
    const groups = await Group.find(query)
      .sort({ [sortParams.sortBy]: sortParams.sortOrder })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .populate('owner', 'username name surname profilePicture');
    
    // Sonuçları formatla
    results.groups = formatSearchResults(groups, total, paginationParams);
  }
  
  // Kanal araması
  if (searchType === 'all' || searchType === 'channels') {
    const { searchQuery, filterQuery, sortParams, paginationParams } = getSearchAndFilterParams(req, {
      searchFields: ['name', 'description'],
      allowedFilters: ['type', 'group'],
      allowedSortFields: ['name', 'createdAt'],
      defaultSortField: 'name'
    });
    
    // Kullanıcının erişebileceği grupları bul
    const accessibleGroups = await Group.find({
      $or: [
        { isPublic: true },
        { owner: userId },
        { members: userId }
      ]
    }).select('_id');
    
    const groupIds = accessibleGroups.map(group => group._id);
    
    // Arama sorgusunu oluştur
    const query = {
      $or: [
        { name: { $regex: searchText, $options: 'i' } },
        { description: { $regex: searchText, $options: 'i' } }
      ],
      group: { $in: groupIds },
      ...filterQuery
    };
    
    // Kanalları getir
    const total = await Channel.countDocuments(query);
    
    const channels = await Channel.find(query)
      .sort({ [sortParams.sortBy]: sortParams.sortOrder })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .populate('group', 'name');
    
    // Sonuçları formatla
    results.channels = formatSearchResults(channels, total, paginationParams);
  }
  
  // Mesaj araması
  if (searchType === 'all' || searchType === 'messages') {
    const { searchQuery, filterQuery, sortParams, paginationParams } = getSearchAndFilterParams(req, {
      searchFields: ['content'],
      allowedFilters: ['channel', 'sender'],
      allowedSortFields: ['createdAt'],
      defaultSortField: 'createdAt'
    });
    
    // Kullanıcının erişebileceği kanalları bul
    const accessibleGroups = await Group.find({
      $or: [
        { isPublic: true },
        { owner: userId },
        { members: userId }
      ]
    }).select('_id');
    
    const groupIds = accessibleGroups.map(group => group._id);
    
    const accessibleChannels = await Channel.find({
      group: { $in: groupIds }
    }).select('_id');
    
    const channelIds = accessibleChannels.map(channel => channel._id);
    
    // Arama sorgusunu oluştur
    const query = {
      content: { $regex: searchText, $options: 'i' },
      channel: { $in: channelIds },
      ...filterQuery
    };
    
    // Mesajları getir
    const total = await Message.countDocuments(query);
    
    const messages = await Message.find(query)
      .sort({ [sortParams.sortBy]: sortParams.sortOrder })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .populate('sender', 'username name surname profilePicture')
      .populate('channel', 'name');
    
    // Sonuçları formatla
    results.messages = formatSearchResults(messages, total, paginationParams);
  }
  
  // Dosya araması
  if (searchType === 'all' || searchType === 'files') {
    const { searchQuery, filterQuery, sortParams, paginationParams } = getSearchAndFilterParams(req, {
      searchFields: ['originalName', 'fileName'],
      allowedFilters: ['fileType', 'uploadedBy'],
      allowedSortFields: ['originalName', 'createdAt', 'size'],
      defaultSortField: 'createdAt'
    });
    
    // Arama sorgusunu oluştur
    const query = {
      $or: [
        { originalName: { $regex: searchText, $options: 'i' } },
        { fileName: { $regex: searchText, $options: 'i' } }
      ],
      uploadedBy: userId,
      ...filterQuery
    };
    
    // Dosyaları getir
    const total = await File.countDocuments(query);
    
    const files = await File.find(query)
      .sort({ [sortParams.sortBy]: sortParams.sortOrder })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);
    
    // Sonuçları formatla
    results.files = formatSearchResults(files, total, paginationParams);
  }
  
  return sendSuccess(res, results);
});

/**
 * @swagger
 * /api/search/users:
 *   get:
 *     summary: Kullanıcı araması yapar
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: true
 *         description: Arama metni
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [online, offline, away, busy]
 *         description: Kullanıcı durumu
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin]
 *         description: Kullanıcı rolü
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sayfa numarası
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Sayfa başına sonuç sayısı
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [username, name, surname, createdAt, lastActive]
 *           default: username
 *         description: Sıralama alanı
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sıralama yönü
 *     responses:
 *       200:
 *         description: Kullanıcı arama sonuçları başarıyla getirildi
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
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const searchUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const searchText = req.query.search as string;
  
  // Arama metni kontrolü
  if (!searchText || searchText.trim().length < 2) {
    throw new ValidationError('Arama metni en az 2 karakter olmalıdır');
  }
  
  // Arama parametrelerini al
  const { searchQuery, filterQuery, sortParams, paginationParams } = getSearchAndFilterParams(req, {
    searchFields: ['username', 'name', 'surname', 'email'],
    allowedFilters: ['status', 'role'],
    allowedSortFields: ['username', 'name', 'surname', 'createdAt', 'lastActive'],
    defaultSortField: 'username'
  });
  
  // Arama sorgusunu oluştur
  const query = {
    $or: [
      { username: { $regex: searchText, $options: 'i' } },
      { name: { $regex: searchText, $options: 'i' } },
      { surname: { $regex: searchText, $options: 'i' } },
      { email: { $regex: searchText, $options: 'i' } }
    ],
    ...filterQuery
  };
  
  // Kullanıcıları getir
  const total = await User.countDocuments(query);
  
  const users = await User.find(query)
    .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken -passwordResetExpires')
    .sort({ [sortParams.sortBy]: sortParams.sortOrder })
    .skip(paginationParams.skip)
    .limit(paginationParams.limit);
  
  // Sonuçları formatla
  const results = formatSearchResults(users, total, paginationParams);
  
  return sendSuccess(res, results);
});

/**
 * @swagger
 * /api/search/groups:
 *   get:
 *     summary: Grup araması yapar
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: true
 *         description: Arama metni
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *         description: Grup türü (herkese açık/özel)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sayfa numarası
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Sayfa başına sonuç sayısı
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, memberCount]
 *           default: name
 *         description: Sıralama alanı
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sıralama yönü
 *     responses:
 *       200:
 *         description: Grup arama sonuçları başarıyla getirildi
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
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Group'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const searchGroups = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  const searchText = req.query.search as string;
  
  // Arama metni kontrolü
  if (!searchText || searchText.trim().length < 2) {
    throw new ValidationError('Arama metni en az 2 karakter olmalıdır');
  }
  
  // Arama parametrelerini al
  const { searchQuery, filterQuery, sortParams, paginationParams } = getSearchAndFilterParams(req, {
    searchFields: ['name', 'description'],
    allowedFilters: ['isPublic'],
    allowedSortFields: ['name', 'createdAt', 'memberCount'],
    defaultSortField: 'name'
  });
  
  // Arama sorgusunu oluştur
  const query = {
    $or: [
      { name: { $regex: searchText, $options: 'i' } },
      { description: { $regex: searchText, $options: 'i' } }
    ],
    $and: [
      {
        $or: [
          { isPublic: true },
          { owner: userId },
          { members: userId }
        ]
      }
    ],
    ...filterQuery
  };
  
  // Grupları getir
  const total = await Group.countDocuments(query);
  
  const groups = await Group.find(query)
    .sort({ [sortParams.sortBy]: sortParams.sortOrder })
    .skip(paginationParams.skip)
    .limit(paginationParams.limit)
    .populate('owner', 'username name surname profilePicture');
  
  // Sonuçları formatla
  const results = formatSearchResults(groups, total, paginationParams);
  
  return sendSuccess(res, results);
});

export default {
  search,
  searchUsers,
  searchGroups
};
