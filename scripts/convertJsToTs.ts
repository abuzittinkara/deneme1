/**
 * scripts/convertJsToTs.ts
 * JavaScript dosyalarını TypeScript'e dönüştürmek için yardımcı script
 */
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// Dönüştürülecek dizinler
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

// Dönüştürülmeyecek dosyalar (özel durumlar)
const EXCLUDE_FILES = [
  'node_modules',
  'dist',
  'public',
  'uploads'
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

      if (EXCLUDE_FILES.includes(file)) {
        continue;
      }

      if (fileStat.isDirectory()) {
        const subDirFiles = await findJsFiles(filePath);
        jsFiles = [...jsFiles, ...subDirFiles];
      } else if (file.endsWith('.js')) {
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
 * JavaScript dosyasını TypeScript'e dönüştürür
 */
async function convertJsToTs(filePath: string): Promise<void> {
  try {
    console.log(`Dönüştürülüyor: ${filePath}`);

    // Dosya içeriğini oku
    const content = await readFile(filePath, 'utf8');

    // TypeScript dosya yolunu oluştur
    const tsFilePath = filePath.replace(/\.js$/, '.ts');

    // Dosya başlığı ekle
    let tsContent = `/**
 * ${tsFilePath}
 * JavaScript'ten TypeScript'e dönüştürüldü: ${new Date().toISOString()}
 */
`;

    // CommonJS require ifadelerini ES6 import ifadelerine dönüştür
    tsContent += content
      // Basit require ifadeleri
      .replace(/const\s+(\w+)\s+=\s+require\(['"](.+)['"]\);/g, 'import * as $1 from \'$2\';')
      // Destructuring require ifadeleri
      .replace(/const\s+{\s*(.+?)\s*}\s+=\s+require\(['"](.+)['"]\);/g, 'import { $1 } from \'$2\';')
      // Basit module.exports
      .replace(/module\.exports\s+=\s+(\w+);/g, 'export default $1;')
      // Fonksiyon module.exports
      .replace(/module\.exports\s+=\s+function/g, 'export default function');

    // module.exports = { ... } yapısını export { ... } yapısına dönüştür
    const moduleExportsMatch = tsContent.match(/module\.exports\s+=\s+{([^}]+)}/);
    if (moduleExportsMatch) {
      const exportItems = moduleExportsMatch[1].trim().split(',').map(item => item.trim());
      tsContent = tsContent.replace(/module\.exports\s+=\s+{([^}]+)}/, `export {\n  ${exportItems.join(',\n  ')}\n}`);
    }

    // TypeScript dosyasını oluştur
    await writeFile(tsFilePath, tsContent);

    console.log(`Dönüştürüldü: ${filePath} -> ${tsFilePath}`);

    // Orijinal JavaScript dosyasını yedekle
    const backupDir = path.join('js-backup', path.dirname(filePath));
    try {
      await mkdir(backupDir, { recursive: true });
      await writeFile(path.join(backupDir, path.basename(filePath)), content);
    } catch (error) {
      console.error(`Dosya yedeklenirken hata oluştu: ${filePath}`, error);
    }
  } catch (error) {
    console.error(`Dosya dönüştürülürken hata oluştu: ${filePath}`, error);
  }
}

/**
 * Ana fonksiyon
 */
async function main() {
  console.log('JavaScript -> TypeScript dönüşümü başlatılıyor...');

  // Yedekleme dizinini oluştur
  try {
    await mkdir('js-backup', { recursive: true });
  } catch (error) {
    console.error('Yedekleme dizini oluşturulurken hata oluştu', error);
  }

  for (const dir of DIRS_TO_PROCESS) {
    try {
      // Dizin var mı kontrol et
      await stat(dir);
      console.log(`Dizin işleniyor: ${dir}`);
      const jsFiles = await findJsFiles(dir);

      for (const file of jsFiles) {
        await convertJsToTs(file);
      }
    } catch (error) {
      console.log(`Dizin bulunamadı, atlanıyor: ${dir}`);
    }
  }

  console.log('Dönüşüm tamamlandı!');
}

// Scripti çalıştır
main().catch(error => {
  console.error('Dönüşüm sırasında hata oluştu:', error);
  process.exit(1);
});
