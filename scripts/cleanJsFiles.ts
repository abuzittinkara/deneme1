/**
 * scripts/cleanJsFiles.ts
 * TypeScript karşılığı olan JavaScript dosyalarını temizleyen script
 */
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

// Temizlenecek dizinler
const DIRS_TO_PROCESS = [
  'src/modules',
  'src/middleware',
  'src/routes',
  'src/socket',
  'src/utils',
  'src/config',
  'src/controllers',
  'src/services'
];

// Korunacak JavaScript dosyaları (yapılandırma dosyaları vb.)
const PROTECTED_FILES = [
  '.eslintrc.js',
  'webpack.config.js',
  'jest.config.js',
  'babel.config.js'
];

/**
 * Bir dizindeki tüm JavaScript dosyalarını bulur
 */
async function findJsFiles(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    let jsFiles: string[] = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      const fileStat = await stat(filePath);

      if (fileStat.isDirectory()) {
        const subDirFiles = await findJsFiles(filePath);
        jsFiles = [...jsFiles, ...subDirFiles];
      } else if (file.endsWith('.js') && !PROTECTED_FILES.includes(file)) {
        jsFiles.push(filePath);
      }
    }

    return jsFiles;
  } catch (error) {
    console.error(`Dizin taranırken hata oluştu: ${dir}`, error);
    return [];
  }
}

/**
 * JavaScript dosyasının TypeScript karşılığı var mı kontrol eder
 */
async function hasTypeScriptEquivalent(jsFilePath: string): Promise<boolean> {
  const tsFilePath = jsFilePath.replace(/\.js$/, '.ts');
  return await exists(tsFilePath);
}

/**
 * Ana fonksiyon
 */
async function main() {
  console.log('TypeScript karşılığı olan JavaScript dosyaları temizleniyor...');

  for (const dir of DIRS_TO_PROCESS) {
    try {
      // Dizin var mı kontrol et
      await stat(dir);
      console.log(`Dizin işleniyor: ${dir}`);
      const jsFiles = await findJsFiles(dir);

      for (const file of jsFiles) {
        if (await hasTypeScriptEquivalent(file)) {
          console.log(`Siliniyor: ${file} (TypeScript karşılığı var)`);
          await unlink(file);
        }
      }
    } catch (error) {
      console.log(`Dizin bulunamadı, atlanıyor: ${dir}`);
    }
  }

  console.log('Temizleme tamamlandı!');
}

// Scripti çalıştır
main().catch(error => {
  console.error('Temizleme sırasında hata oluştu:', error);
  process.exit(1);
});
