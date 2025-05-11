/**
 * scripts/convertToTypeScript.ts
 * JavaScript dosyalarını TypeScript'e dönüştürmek için basit bir script
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Dönüştürülecek dosya veya dizin
const targetPath = process.argv[2];

if (!targetPath) {
  console.error('Lütfen bir dosya veya dizin belirtin:');
  console.error('npm run ts:convert <dosya_veya_dizin_yolu>');
  console.error('Örnek: npm run ts:convert src/utils/logger.js');
  console.error('Örnek: npm run ts:convert src/utils');
  process.exit(1);
}

// Dosya veya dizin kontrolü
const isDirectory = fs.existsSync(targetPath) && fs.lstatSync(targetPath).isDirectory();

/**
 * JavaScript dosyasını TypeScript'e dönüştürür
 */
function convertJsToTs(filePath: string): void {
  if (!filePath.endsWith('.js')) {
    console.log(`Atlanıyor: ${filePath} (JavaScript dosyası değil)`);
    return;
  }

  try {
    // Dosya içeriğini oku
    const content = fs.readFileSync(filePath, 'utf8');
    
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
    fs.writeFileSync(tsFilePath, tsContent);
    
    console.log(`Dönüştürüldü: ${filePath} -> ${tsFilePath}`);
    
    // Orijinal JavaScript dosyasını yedekle
    const backupDir = path.join('js-backup', path.dirname(filePath));
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, path.basename(filePath));
    fs.copyFileSync(filePath, backupPath);
    console.log(`Yedeklendi: ${filePath} -> ${backupPath}`);
    
    // Orijinal JavaScript dosyasını sil (isteğe bağlı)
    // fs.unlinkSync(filePath);
    // console.log(`Silindi: ${filePath}`);
  } catch (error) {
    console.error(`Dosya dönüştürülürken hata oluştu: ${filePath}`, error);
  }
}

/**
 * Dizindeki tüm JavaScript dosyalarını dönüştürür
 */
function convertDirectory(dirPath: string): void {
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.lstatSync(filePath);
      
      if (stat.isDirectory()) {
        // Alt dizinleri de işle
        convertDirectory(filePath);
      } else if (file.endsWith('.js')) {
        // JavaScript dosyalarını dönüştür
        convertJsToTs(filePath);
      }
    }
  } catch (error) {
    console.error(`Dizin işlenirken hata oluştu: ${dirPath}`, error);
  }
}

// Ana işlem
console.log('JavaScript -> TypeScript dönüşümü başlatılıyor...');

// Yedekleme dizinini oluştur
if (!fs.existsSync('js-backup')) {
  fs.mkdirSync('js-backup', { recursive: true });
}

if (isDirectory) {
  convertDirectory(targetPath);
} else {
  convertJsToTs(targetPath);
}

console.log('Dönüşüm tamamlandı!');
console.log('Tip hatalarını düzeltmek için dosyaları manuel olarak düzenleyin.');
console.log('Dönüştürülen dosyaları kontrol etmek için: npm run ts:check');
