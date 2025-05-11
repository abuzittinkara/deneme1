/**
 * src/controllers/fileController.ts
 * Dosya controller'ı
 */
import { Request, Response, NextFunction } from 'express';
import { asyncHandler, sendSuccess, sendError } from '../utils/controllerUtils';
import { fileProcessor, FileProcessingOptions } from '../utils/fileProcessor';
import File from '../models/File';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Dosya yükler
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Yüklenecek dosya
 *       - in: query
 *         name: resize
 *         schema:
 *           type: boolean
 *         description: Görüntüyü yeniden boyutlandır
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *         description: Yeniden boyutlandırma genişliği
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *         description: Yeniden boyutlandırma yüksekliği
 *       - in: query
 *         name: compress
 *         schema:
 *           type: boolean
 *         description: Görüntüyü sıkıştır
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Sıkıştırma kalitesi
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [jpeg, png, webp, avif]
 *         description: Çıktı formatı
 *       - in: query
 *         name: generateThumbnail
 *         schema:
 *           type: boolean
 *         description: Küçük resim oluştur
 *     responses:
 *       201:
 *         description: Dosya başarıyla yüklendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/File'
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
export const uploadFile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Dosya kontrolü
  if (!req.file) {
    throw new ValidationError('Dosya bulunamadı');
  }

  const userId = (req as any).user._id;

  // İşleme seçeneklerini al
  const options: FileProcessingOptions = {};

  // Yeniden boyutlandırma
  if (req.query['resize'] === 'true') {
    options.resize = {};

    if (req.query['width']) {
      options.resize.width = parseInt(req.query['width'] as string);
    }

    if (req.query['height']) {
      options.resize.height = parseInt(req.query['height'] as string);
    }

    if (req.query['fit']) {
      options.resize.fit = req.query['fit'] as any;
    }
  }

  // Sıkıştırma
  if (req.query['compress'] === 'true') {
    options.compress = true;

    if (req.query['quality']) {
      options.quality = parseInt(req.query['quality'] as string);
    }
  }

  // Format
  if (req.query['format']) {
    options.format = req.query['format'] as any;
  }

  // Küçük resim
  if (req.query['generateThumbnail'] === 'true') {
    options.generateThumbnail = true;
  }

  // Dosyayı işle
  const processedFile = await fileProcessor.processFile(req.file, options);

  // Dosyayı veritabanına kaydet
  const file = await fileProcessor.saveFileToDatabase(processedFile, userId);

  return sendSuccess(res, file, 201);
});

/**
 * @swagger
 * /api/files/upload-multiple:
 *   post:
 *     summary: Birden fazla dosya yükler
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: files
 *         type: array
 *         items:
 *           type: file
 *         required: true
 *         description: Yüklenecek dosyalar
 *       - in: query
 *         name: resize
 *         schema:
 *           type: boolean
 *         description: Görüntüleri yeniden boyutlandır
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *         description: Yeniden boyutlandırma genişliği
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *         description: Yeniden boyutlandırma yüksekliği
 *       - in: query
 *         name: compress
 *         schema:
 *           type: boolean
 *         description: Görüntüleri sıkıştır
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Sıkıştırma kalitesi
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [jpeg, png, webp, avif]
 *         description: Çıktı formatı
 *       - in: query
 *         name: generateThumbnail
 *         schema:
 *           type: boolean
 *         description: Küçük resim oluştur
 *     responses:
 *       201:
 *         description: Dosyalar başarıyla yüklendi
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
 *                     $ref: '#/components/schemas/File'
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
export const uploadMultipleFiles = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Dosya kontrolü
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new ValidationError('Dosya bulunamadı');
    }

    const userId = (req as any).user._id;

    // İşleme seçeneklerini al
    const options: FileProcessingOptions = {};

    // Yeniden boyutlandırma
    if (req.query['resize'] === 'true') {
      options.resize = {};

      if (req.query['width']) {
        options.resize.width = parseInt(req.query['width'] as string);
      }

      if (req.query['height']) {
        options.resize.height = parseInt(req.query['height'] as string);
      }

      if (req.query['fit']) {
        options.resize.fit = req.query['fit'] as any;
      }
    }

    // Sıkıştırma
    if (req.query['compress'] === 'true') {
      options.compress = true;

      if (req.query['quality']) {
        options.quality = parseInt(req.query['quality'] as string);
      }
    }

    // Format
    if (req.query['format']) {
      options.format = req.query['format'] as any;
    }

    // Küçük resim
    if (req.query['generateThumbnail'] === 'true') {
      options.generateThumbnail = true;
    }

    // Dosyaları işle
    const files = [];

    for (const file of req.files) {
      try {
        // Dosyayı işle
        const processedFile = await fileProcessor.processFile(file, options);

        // Dosyayı veritabanına kaydet
        const savedFile = await fileProcessor.saveFileToDatabase(processedFile, userId);

        files.push(savedFile);
      } catch (error) {
        logger.error('Dosya işlenirken hata oluştu', {
          error: (error as Error).message,
          file: file.originalname,
        });

        // Hata durumunda diğer dosyaları işlemeye devam et
      }
    }

    if (files.length === 0) {
      throw new ValidationError('Hiçbir dosya yüklenemedi');
    }

    return sendSuccess(res, files, 201);
  }
);

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Dosya bilgilerini getirir
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Dosya ID
 *     responses:
 *       200:
 *         description: Dosya bilgileri başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/File'
 *       404:
 *         description: Dosya bulunamadı
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
export const getFile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const fileId = req.params['id'];

  // ID'yi doğrula
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ValidationError('Geçersiz dosya ID');
  }

  // Dosyayı bul
  const file = await File.findById(fileId);

  if (!file) {
    throw new NotFoundError('Dosya bulunamadı');
  }

  return sendSuccess(res, file);
});

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Kullanıcının dosyalarını getirir
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Sayfa başına dosya sayısı
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Atlanacak dosya sayısı
 *       - in: query
 *         name: fileType
 *         schema:
 *           type: string
 *           enum: [image, audio, video, document, other]
 *         description: Dosya türüne göre filtrele
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sıralama alanı
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sıralama yönü
 *     responses:
 *       200:
 *         description: Dosyalar başarıyla getirildi
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
 *                     files:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/File'
 *                     total:
 *                       type: integer
 *                       example: 42
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getUserFiles = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user._id;

    // Sorgu parametrelerini al
    const limit = parseInt((req.query['limit'] as string) || '20');
    const skip = parseInt((req.query['skip'] as string) || '0');
    const fileType = req.query['fileType'] as string;
    const sortBy = (req.query['sortBy'] as string) || 'createdAt';
    const sortOrder = req.query['sortOrder'] === 'asc' ? 1 : -1;

    // Sorgu oluştur
    const query: any = { uploadedBy: userId };

    // Dosya türüne göre filtrele
    if (fileType) {
      query.fileType = fileType;
    }

    // Toplam sayıyı al
    const total = await File.countDocuments(query);

    // Dosyaları getir
    // Dosyaları getir ve bellek içinde işle
    const filesQuery = await File.find(query).exec();

    // Bellek içinde sıralama ve sayfalama yap
    const sortedFiles = Array.from(filesQuery).sort((a: any, b: any) => {
      const aValue = a.get(sortBy) || '';
      const bValue = b.get(sortBy) || '';

      if (sortOrder === 1) {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Sayfalama uygula
    const files = sortedFiles.slice(skip, skip + limit);

    return sendSuccess(res, { files, total });
  }
);

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Dosyayı siler
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Dosya ID
 *     responses:
 *       200:
 *         description: Dosya başarıyla silindi
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
 *                       example: Dosya başarıyla silindi
 *       404:
 *         description: Dosya bulunamadı
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
 *       403:
 *         description: Dosyayı silme yetkisi yok
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const deleteFile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const fileId = req.params['id'];
  const userId = (req as any).user._id;

  // ID'yi doğrula
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ValidationError('Geçersiz dosya ID');
  }

  // Dosyayı sil
  const success = await fileProcessor.deleteFile(fileId || '', userId);

  if (!success) {
    throw new NotFoundError('Dosya bulunamadı veya silme yetkisi yok');
  }

  return sendSuccess(res, { message: 'Dosya başarıyla silindi' });
});

/**
 * @swagger
 * /api/files/download/{id}:
 *   get:
 *     summary: Dosyayı indirir
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Dosya ID
 *     responses:
 *       200:
 *         description: Dosya başarıyla indirildi
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Dosya bulunamadı
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
export const downloadFile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const fileId = req.params['id'];

    // ID'yi doğrula
    if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
      throw new ValidationError('Geçersiz dosya ID');
    }

    // Dosyayı bul
    const file = await File.findById(fileId);

    if (!file) {
      throw new NotFoundError('Dosya bulunamadı');
    }

    // Dosya yolunu güvenli bir şekilde kontrol et
    const resolvedFilePath = path.resolve(file.filePath);
    const uploadsBasePath = path.resolve(path.join(__dirname, '..', '..', 'uploads'));

    // Yol geçişi kontrolü
    if (!resolvedFilePath.startsWith(uploadsBasePath)) {
      logger.warn('Güvenli olmayan dosya indirme girişimi', {
        fileId,
        filePath: file.filePath,
        resolvedPath: resolvedFilePath,
        ip: req.ip,
      });
      throw new ValidationError('Geçersiz dosya yolu');
    }

    // Dosyanın varlığını kontrol et
    if (!fs.existsSync(resolvedFilePath)) {
      throw new NotFoundError('Dosya bulunamadı');
    }

    // Dosya adını güvenli hale getir
    const safeFileName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Dosyayı indir
    res.download(resolvedFilePath, safeFileName);
  }
);

export default {
  uploadFile,
  uploadMultipleFiles,
  getFile,
  getUserFiles,
  deleteFile,
  downloadFile,
};
