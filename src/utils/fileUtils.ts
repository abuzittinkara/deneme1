/**
 * src/utils/fileUtils.ts
 * Dosya işlemleri için yardımcı fonksiyonlar
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger';
import { sanitizeFilename } from './sanitizer';

/**
 * Dosya yolu güvenliği için izin verilen dizinler
 */
const ALLOWED_DIRECTORIES = ['uploads', 'public', 'temp'];

/**
 * Dosya yolunu güvenli hale getirir
 * @param filePath - Dosya yolu
 * @returns Güvenli dosya yolu
 */
export function sanitizePath(filePath: string): string {
  // Dosya yolunu normalize et
  const normalizedPath = path.normalize(filePath);

  // Path traversal saldırılarını önle
  if (normalizedPath.includes('..')) {
    logger.warn('Path traversal denemesi engellendi', { filePath });
    throw new Error('Geçersiz dosya yolu');
  }

  // Dosya adını sanitize et
  const dirname = path.dirname(normalizedPath);
  const basename = path.basename(normalizedPath);
  const sanitizedBasename = sanitizeFilename(basename);

  // İzin verilen dizinleri kontrol et
  const isAllowedDirectory = ALLOWED_DIRECTORIES.some(
    (dir) => dirname === dir || dirname.startsWith(`${dir}${path.sep}`)
  );

  if (!isAllowedDirectory) {
    logger.warn('İzin verilmeyen dizine erişim denemesi engellendi', { filePath, dirname });
    throw new Error('Bu dizine erişim izniniz yok');
  }

  return path.join(dirname, sanitizedBasename);
}

/**
 * Dosya okur
 * @param filePath - Dosya yolu
 * @returns Dosya içeriği
 */
export async function readFile(filePath: string): Promise<Buffer> {
  try {
    // Dosya yolunu güvenli hale getir
    const safePath = sanitizePath(filePath);

    // Dosyayı oku
    return await fs.readFile(safePath);
  } catch (error) {
    logger.error('Dosya okuma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      filePath,
    });

    throw error;
  }
}

/**
 * Dosya yazar
 * @param filePath - Dosya yolu
 * @param content - Dosya içeriği
 */
export async function writeFile(filePath: string, content: string | Buffer): Promise<void> {
  try {
    // Dosya yolunu güvenli hale getir
    const safePath = sanitizePath(filePath);

    // Dizinin var olduğundan emin ol
    const dirname = path.dirname(safePath);
    await fs.mkdir(dirname, { recursive: true });

    // Dosyayı yaz
    await fs.writeFile(safePath, content, { mode: 0o644 });
  } catch (error) {
    logger.error('Dosya yazma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      filePath,
    });

    throw error;
  }
}

/**
 * Dosya siler
 * @param filePath - Dosya yolu
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    // Dosya yolunu güvenli hale getir
    const safePath = sanitizePath(filePath);

    // Dosyanın var olup olmadığını kontrol et
    const exists = await fileExists(safePath);

    if (!exists) {
      logger.warn('Silinecek dosya bulunamadı', { filePath });
      return;
    }

    // Dosyayı sil
    await fs.unlink(safePath);
  } catch (error) {
    logger.error('Dosya silme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      filePath,
    });

    throw error;
  }
}

/**
 * Dosyanın var olup olmadığını kontrol eder
 * @param filePath - Dosya yolu
 * @returns Dosya var mı?
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    // Dosya yolunu güvenli hale getir
    const safePath = sanitizePath(filePath);

    // Dosyanın var olup olmadığını kontrol et
    await fs.access(safePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Dosya kopyalar
 * @param sourcePath - Kaynak dosya yolu
 * @param targetPath - Hedef dosya yolu
 */
export async function copyFile(sourcePath: string, targetPath: string): Promise<void> {
  try {
    // Dosya yollarını güvenli hale getir
    const safeSourcePath = sanitizePath(sourcePath);
    const safeTargetPath = sanitizePath(targetPath);

    // Kaynak dosyanın var olup olmadığını kontrol et
    const exists = await fileExists(safeSourcePath);

    if (!exists) {
      logger.warn('Kopyalanacak dosya bulunamadı', { sourcePath });
      throw new Error('Kopyalanacak dosya bulunamadı');
    }

    // Dizinin var olduğundan emin ol
    const dirname = path.dirname(safeTargetPath);
    await fs.mkdir(dirname, { recursive: true });

    // Dosyayı kopyala
    await fs.copyFile(safeSourcePath, safeTargetPath);
  } catch (error) {
    logger.error('Dosya kopyalama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      sourcePath,
      targetPath,
    });

    throw error;
  }
}

/**
 * Dosya taşır
 * @param sourcePath - Kaynak dosya yolu
 * @param targetPath - Hedef dosya yolu
 */
export async function moveFile(sourcePath: string, targetPath: string): Promise<void> {
  try {
    // Dosya yollarını güvenli hale getir
    const safeSourcePath = sanitizePath(sourcePath);
    const safeTargetPath = sanitizePath(targetPath);

    // Kaynak dosyanın var olup olmadığını kontrol et
    const exists = await fileExists(safeSourcePath);

    if (!exists) {
      logger.warn('Taşınacak dosya bulunamadı', { sourcePath });
      throw new Error('Taşınacak dosya bulunamadı');
    }

    // Dizinin var olduğundan emin ol
    const dirname = path.dirname(safeTargetPath);
    await fs.mkdir(dirname, { recursive: true });

    // Dosyayı taşı
    await fs.rename(safeSourcePath, safeTargetPath);
  } catch (error) {
    logger.error('Dosya taşıma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      sourcePath,
      targetPath,
    });

    throw error;
  }
}

/**
 * Benzersiz dosya adı oluşturur
 * @param filename - Dosya adı
 * @returns Benzersiz dosya adı
 */
export function generateUniqueFilename(filename: string): string {
  // Dosya adını sanitize et
  const sanitizedFilename = sanitizeFilename(filename);

  // Dosya adını parçalara ayır
  const extname = path.extname(sanitizedFilename);
  const basename = path.basename(sanitizedFilename, extname);

  // Benzersiz bir hash oluştur
  const hash = crypto.randomBytes(8).toString('hex');

  // Benzersiz dosya adını oluştur
  return `${basename}-${hash}${extname}`;
}

/**
 * Dosya boyutunu formatlar
 * @param bytes - Bayt cinsinden dosya boyutu
 * @returns Formatlanmış dosya boyutu
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Dosya türünü kontrol eder
 * @param filename - Dosya adı
 * @param allowedExtensions - İzin verilen uzantılar
 * @returns Dosya türü geçerli mi?
 */
export function isValidFileType(filename: string, allowedExtensions: string[]): boolean {
  // Dosya adını sanitize et
  const sanitizedFilename = sanitizeFilename(filename);

  // Dosya uzantısını al
  const extname = path.extname(sanitizedFilename).toLowerCase();

  // Uzantıyı kontrol et
  return allowedExtensions.includes(extname);
}

export default {
  sanitizePath,
  readFile,
  writeFile,
  deleteFile,
  fileExists,
  copyFile,
  moveFile,
  generateUniqueFilename,
  formatFileSize,
  isValidFileType,
};
