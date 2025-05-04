/**
 * src/utils/fileProcessor.ts
 * Dosya işleme yardımcı sınıfı
 */
import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { File } from '../models/File';
import { env } from '../config/env';
import { ValidationError } from '../utils/errors';

// Dosya türleri
export type FileType = 'image' | 'audio' | 'video' | 'document' | 'other';

// Dosya boyutu limitleri (byte cinsinden)
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10 MB
  audio: 50 * 1024 * 1024, // 50 MB
  video: 100 * 1024 * 1024, // 100 MB
  document: 20 * 1024 * 1024, // 20 MB
  other: 5 * 1024 * 1024 // 5 MB
};

// İzin verilen dosya uzantıları
export const ALLOWED_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md'],
  other: ['.zip', '.rar', '.7z', '.tar', '.gz']
};

// Dosya yükleme dizinleri
export const UPLOAD_DIRS = {
  image: path.join(__dirname, '..', '..', 'uploads', 'images'),
  audio: path.join(__dirname, '..', '..', 'uploads', 'audio'),
  video: path.join(__dirname, '..', '..', 'uploads', 'video'),
  document: path.join(__dirname, '..', '..', 'uploads', 'documents'),
  other: path.join(__dirname, '..', '..', 'uploads', 'other'),
  temp: path.join(__dirname, '..', '..', 'uploads', 'temp')
};

// Dosya işleme seçenekleri
export interface FileProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  compress?: boolean;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  metadata?: boolean;
  generateThumbnail?: boolean;
}

// Dosya işleme sonucu
export interface ProcessedFile {
  originalName: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileType: FileType;
  mimeType: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  thumbnail?: {
    fileName: string;
    filePath: string;
    fileUrl: string;
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Dosya işleme yardımcı sınıfı
 */
class FileProcessor {
  private readonly fsAccess = promisify(fs.access);
  private readonly fsMkdir = promisify(fs.mkdir);
  private readonly fsUnlink = promisify(fs.unlink);
  private readonly fsCopyFile = promisify(fs.copyFile);
  
  constructor() {
    // Yükleme dizinlerini oluştur
    this.initializeUploadDirectories();
  }
  
  /**
   * Yükleme dizinlerini oluşturur
   */
  private async initializeUploadDirectories(): Promise<void> {
    try {
      // Tüm dizinleri oluştur
      for (const dir of Object.values(UPLOAD_DIRS)) {
        await this.ensureDirectoryExists(dir);
      }
      
      logger.info('Yükleme dizinleri oluşturuldu');
    } catch (error) {
      logger.error('Yükleme dizinleri oluşturulurken hata oluştu', { error: (error as Error).message });
    }
  }
  
  /**
   * Dizinin var olduğundan emin olur
   * @param dir Dizin yolu
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await this.fsAccess(dir, fs.constants.F_OK);
    } catch (error) {
      // Dizin yoksa oluştur
      await this.fsMkdir(dir, { recursive: true });
    }
  }
  
  /**
   * Dosya türünü belirler
   * @param mimeType MIME türü
   * @param extension Dosya uzantısı
   * @returns Dosya türü
   */
  public getFileType(mimeType: string, extension: string): FileType {
    // MIME türüne göre dosya türünü belirle
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (
      mimeType === 'application/pdf' ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation') ||
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown'
    ) {
      return 'document';
    }
    
    // Uzantıya göre dosya türünü belirle
    const ext = extension.toLowerCase();
    
    for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
      if (extensions.includes(ext)) {
        return type as FileType;
      }
    }
    
    // Varsayılan olarak diğer
    return 'other';
  }
  
  /**
   * Dosya uzantısının izin verilip verilmediğini kontrol eder
   * @param extension Dosya uzantısı
   * @param fileType Dosya türü
   * @returns İzin verilip verilmediği
   */
  public isAllowedExtension(extension: string, fileType: FileType): boolean {
    const ext = extension.toLowerCase();
    return ALLOWED_EXTENSIONS[fileType].includes(ext);
  }
  
  /**
   * Dosya boyutunun izin verilen limiti aşıp aşmadığını kontrol eder
   * @param size Dosya boyutu
   * @param fileType Dosya türü
   * @returns İzin verilip verilmediği
   */
  public isAllowedSize(size: number, fileType: FileType): boolean {
    return size <= FILE_SIZE_LIMITS[fileType];
  }
  
  /**
   * Dosyayı işler
   * @param file Dosya
   * @param options İşleme seçenekleri
   * @returns İşlenmiş dosya
   */
  public async processFile(
    file: Express.Multer.File,
    options: FileProcessingOptions = {}
  ): Promise<ProcessedFile> {
    try {
      // Dosya uzantısını al
      const extension = path.extname(file.originalname).toLowerCase();
      
      // Dosya türünü belirle
      const fileType = this.getFileType(file.mimetype, extension);
      
      // Dosya uzantısını kontrol et
      if (!this.isAllowedExtension(extension, fileType)) {
        throw new ValidationError(`İzin verilmeyen dosya uzantısı: ${extension}`);
      }
      
      // Dosya boyutunu kontrol et
      if (!this.isAllowedSize(file.size, fileType)) {
        throw new ValidationError(`Dosya boyutu çok büyük: ${file.size} byte`);
      }
      
      // Benzersiz dosya adı oluştur
      const fileName = `${uuidv4()}${extension}`;
      
      // Dosya yolunu belirle
      const filePath = path.join(UPLOAD_DIRS[fileType], fileName);
      
      // Dosya URL'sini belirle
      const fileUrl = `${env.API_URL}/uploads/${fileType}s/${fileName}`;
      
      // İşlenmiş dosya nesnesi
      const processedFile: ProcessedFile = {
        originalName: file.originalname,
        fileName,
        filePath,
        fileUrl,
        fileType,
        mimeType: file.mimetype,
        size: file.size
      };
      
      // Dosya türüne göre işle
      if (fileType === 'image') {
        // Görüntü işleme
        await this.processImage(file.path, filePath, processedFile, options);
      } else {
        // Diğer dosya türleri için sadece kopyala
        await this.fsCopyFile(file.path, filePath);
      }
      
      // Geçici dosyayı sil
      await this.fsUnlink(file.path);
      
      return processedFile;
    } catch (error) {
      logger.error('Dosya işlenirken hata oluştu', { 
        error: (error as Error).message,
        file: file.originalname
      });
      
      // Geçici dosyayı sil
      try {
        await this.fsUnlink(file.path);
      } catch (unlinkError) {
        logger.error('Geçici dosya silinirken hata oluştu', { 
          error: (unlinkError as Error).message,
          file: file.path
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Görüntüyü işler
   * @param sourcePath Kaynak dosya yolu
   * @param targetPath Hedef dosya yolu
   * @param processedFile İşlenmiş dosya nesnesi
   * @param options İşleme seçenekleri
   */
  private async processImage(
    sourcePath: string,
    targetPath: string,
    processedFile: ProcessedFile,
    options: FileProcessingOptions
  ): Promise<void> {
    try {
      // Sharp nesnesi oluştur
      let image = sharp(sourcePath);
      
      // Görüntü meta verilerini al
      const metadata = await image.metadata();
      
      // Boyutları kaydet
      if (metadata.width && metadata.height) {
        processedFile.dimensions = {
          width: metadata.width,
          height: metadata.height
        };
      }
      
      // Meta verileri kaydet
      if (options.metadata) {
        processedFile.metadata = metadata;
      }
      
      // Yeniden boyutlandırma
      if (options.resize) {
        image = image.resize({
          width: options.resize.width,
          height: options.resize.height,
          fit: options.resize.fit || 'cover'
        });
        
        // Yeniden boyutlandırılmış görüntünün meta verilerini güncelle
        const resizedMetadata = await image.metadata();
        
        if (resizedMetadata.width && resizedMetadata.height) {
          processedFile.dimensions = {
            width: resizedMetadata.width,
            height: resizedMetadata.height
          };
        }
      }
      
      // Formatı değiştir
      if (options.format) {
        image = image.toFormat(options.format, {
          quality: options.quality || 80,
          progressive: true
        });
        
        // Dosya adını ve yolunu güncelle
        const newExtension = `.${options.format}`;
        const newFileName = path.basename(processedFile.fileName, path.extname(processedFile.fileName)) + newExtension;
        
        processedFile.fileName = newFileName;
        processedFile.filePath = path.join(path.dirname(targetPath), newFileName);
        processedFile.fileUrl = processedFile.fileUrl.replace(path.extname(processedFile.fileUrl), newExtension);
        processedFile.mimeType = `image/${options.format}`;
      }
      // Sıkıştırma
      else if (options.compress) {
        const format = path.extname(targetPath).substring(1);
        
        if (format === 'jpeg' || format === 'jpg') {
          image = image.jpeg({ quality: options.quality || 80, progressive: true });
        } else if (format === 'png') {
          image = image.png({ quality: options.quality || 80, progressive: true });
        } else if (format === 'webp') {
          image = image.webp({ quality: options.quality || 80 });
        }
      }
      
      // Görüntüyü kaydet
      await image.toFile(processedFile.filePath);
      
      // Dosya boyutunu güncelle
      const stats = fs.statSync(processedFile.filePath);
      processedFile.size = stats.size;
      
      // Küçük resim oluştur
      if (options.generateThumbnail) {
        await this.generateThumbnail(sourcePath, processedFile);
      }
    } catch (error) {
      logger.error('Görüntü işlenirken hata oluştu', { 
        error: (error as Error).message,
        sourcePath,
        targetPath
      });
      throw error;
    }
  }
  
  /**
   * Küçük resim oluşturur
   * @param sourcePath Kaynak dosya yolu
   * @param processedFile İşlenmiş dosya nesnesi
   */
  private async generateThumbnail(
    sourcePath: string,
    processedFile: ProcessedFile
  ): Promise<void> {
    try {
      // Küçük resim adını oluştur
      const thumbnailFileName = `thumb_${processedFile.fileName}`;
      
      // Küçük resim yolunu belirle
      const thumbnailPath = path.join(UPLOAD_DIRS.image, thumbnailFileName);
      
      // Küçük resim URL'sini belirle
      const thumbnailUrl = `${env.API_URL}/uploads/images/${thumbnailFileName}`;
      
      // Küçük resim oluştur
      const thumbnail = sharp(sourcePath)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 70 });
      
      // Küçük resmi kaydet
      await thumbnail.toFile(thumbnailPath);
      
      // Küçük resim meta verilerini al
      const metadata = await thumbnail.metadata();
      
      // Küçük resim bilgilerini kaydet
      processedFile.thumbnail = {
        fileName: thumbnailFileName,
        filePath: thumbnailPath,
        fileUrl: thumbnailUrl,
        width: metadata.width || 200,
        height: metadata.height || 200
      };
    } catch (error) {
      logger.error('Küçük resim oluşturulurken hata oluştu', { 
        error: (error as Error).message,
        sourcePath,
        fileName: processedFile.fileName
      });
      // Küçük resim oluşturma hatası kritik değil, devam et
    }
  }
  
  /**
   * Dosyayı veritabanına kaydeder
   * @param processedFile İşlenmiş dosya
   * @param userId Kullanıcı ID
   * @returns Kaydedilen dosya
   */
  public async saveFileToDatabase(
    processedFile: ProcessedFile,
    userId: string
  ): Promise<any> {
    try {
      // Dosya nesnesini oluştur
      const file = new File({
        originalName: processedFile.originalName,
        fileName: processedFile.fileName,
        filePath: processedFile.filePath,
        fileUrl: processedFile.fileUrl,
        fileType: processedFile.fileType,
        mimeType: processedFile.mimeType,
        size: processedFile.size,
        dimensions: processedFile.dimensions,
        duration: processedFile.duration,
        thumbnail: processedFile.thumbnail,
        metadata: processedFile.metadata,
        uploadedBy: userId
      });
      
      // Dosyayı kaydet
      await file.save();
      
      logger.info('Dosya veritabanına kaydedildi', { 
        fileId: file._id,
        fileName: processedFile.fileName,
        userId
      });
      
      return file;
    } catch (error) {
      logger.error('Dosya veritabanına kaydedilirken hata oluştu', { 
        error: (error as Error).message,
        fileName: processedFile.fileName,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Dosyayı siler
   * @param fileId Dosya ID
   * @param userId Kullanıcı ID
   * @returns Başarılı mı?
   */
  public async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      // Dosyayı bul
      const file = await File.findOne({ _id: fileId });
      
      if (!file) {
        logger.warn('Silinecek dosya bulunamadı', { fileId, userId });
        return false;
      }
      
      // Yetki kontrolü
      if (file.uploadedBy.toString() !== userId) {
        logger.warn('Dosyayı silme yetkisi yok', { fileId, userId, uploadedBy: file.uploadedBy });
        return false;
      }
      
      // Dosyayı diskten sil
      if (fs.existsSync(file.filePath)) {
        await this.fsUnlink(file.filePath);
      }
      
      // Küçük resmi sil (varsa)
      if (file.thumbnail && file.thumbnail.filePath && fs.existsSync(file.thumbnail.filePath)) {
        await this.fsUnlink(file.thumbnail.filePath);
      }
      
      // Dosyayı veritabanından sil
      await file.deleteOne();
      
      logger.info('Dosya silindi', { fileId, userId });
      
      return true;
    } catch (error) {
      logger.error('Dosya silinirken hata oluştu', { 
        error: (error as Error).message,
        fileId,
        userId
      });
      return false;
    }
  }
}

// Dosya işleme yardımcı sınıfı örneği
export const fileProcessor = new FileProcessor();

export default fileProcessor;
