/**
 * scripts/cleanup.ts
 * Gereksiz dosyaları temizleme scripti
 */
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

// Temizlenecek klasörler
const CLEANUP_DIRS: string[] = [
  'controllers',
  'middleware',
  'models',
  'routes',
  'services',
  'utils',
  'config'
];

// Korunacak dosyalar (silinmeyecek)
const KEEP_FILES: string[] = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.env',
  '.env.example',
  '.gitignore',
  'README.md'
];

/**
 * Dosya veya klasörün TypeScript karşılığı var mı kontrol eder
 * 
 * @param filePath - Dosya yolu
 * @returns TypeScript karşılığı varsa true
 */
async function hasTypeScriptEquivalent(filePath: string): Promise<boolean> {
  // Dosya uzantısını al
  const ext = path.extname(filePath);
  
  // JavaScript dosyası değilse kontrol etme
  if (ext !== '.js') return false;
  
  // TypeScript karşılığının yolunu oluştur
  const baseName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  const tsFilePath = path.join('src', dirName, `${baseName}.ts`);
  
  try {
    // TypeScript dosyası var mı kontrol et
    await stat(tsFilePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Klasörü temizler
 * 
 * @param dir - Temizlenecek klasör
 */
async function cleanupDir(dir: string): Promise<void> {
  try {
    // Klasör var mı kontrol et
    await stat(dir);
    
    // Klasördeki dosyaları oku
    const files = await readdir(dir);
    
    // Her dosya için kontrol et
    for (const file of files) {
      const filePath = path.join(dir, file);
      const fileStat = await stat(filePath);
      
      // Klasör ise recursive olarak temizle
      if (fileStat.isDirectory()) {
        await cleanupDir(filePath);
      } else {
        // Korunacak dosya mı kontrol et
        if (KEEP_FILES.includes(file)) continue;
        
        // TypeScript karşılığı var mı kontrol et
        const hasTS = await hasTypeScriptEquivalent(filePath);
        
        if (hasTS) {
          console.log(`Siliniyor: ${filePath} (TypeScript karşılığı var)`);
          await unlink(filePath);
        }
      }
    }
    
    // Klasör boş mu kontrol et
    const remainingFiles = await readdir(dir);
    if (remainingFiles.length === 0) {
      console.log(`Boş klasör siliniyor: ${dir}`);
      await rmdir(dir);
    }
  } catch (error) {
    // Klasör yoksa veya başka bir hata varsa atla
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`Hata: ${dir} temizlenirken bir sorun oluştu`, error);
    }
  }
}

/**
 * Ana fonksiyon
 */
async function main(): Promise<void> {
  console.log('Gereksiz dosyalar temizleniyor...');
  
  // Her klasörü temizle
  for (const dir of CLEANUP_DIRS) {
    await cleanupDir(dir);
  }
  
  console.log('Temizleme tamamlandı!');
}

// Scripti çalıştır
main().catch(error => {
  console.error('Temizleme sırasında bir hata oluştu:', error);
  process.exit(1);
});
