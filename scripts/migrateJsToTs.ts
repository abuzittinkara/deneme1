/**
 * scripts/migrateJsToTs.ts
 * JavaScript dosyalarını TypeScript'e dönüştürmek için yardımcı script
 */
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Dönüştürülecek dizinler
const DIRS_TO_PROCESS = [
  'modules',
  'middleware',
  'routes',
  'socket',
  'utils',
  'config'
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
    const { stdout } = await execAsync(`find ${dir} -type f -name "*.js" | grep -v "node_modules" | grep -v "dist" | grep -v "public"`);
    return stdout.trim().split('\n').filter(Boolean);
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
    // Dosya içeriğini oku
    const content = fs.readFileSync(filePath, 'utf8');

    // TypeScript dosya yolunu oluştur
    const tsFilePath = filePath.replace(/\.js$/, '.ts');

    // Dosya başlığı ekle
    let tsContent = `/**
 * ${tsFilePath}
 * ${new Date().toISOString()}'de JavaScript'ten TypeScript'e dönüştürüldü
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
    if (moduleExportsMatch && moduleExportsMatch[1]) {
      const exportItems = moduleExportsMatch[1].trim().split(',').map(item => item.trim());
      tsContent = tsContent.replace(/module\.exports\s+=\s+{([^}]+)}/, `export {\n  ${exportItems.join(',\n  ')}\n}`);
    }

    // Tip tanımlamaları ekle
    tsContent = tsContent
      // Fonksiyon parametrelerine any tipi ekle
      .replace(/function\s+(\w+)\s*\(([^\)]+)\)/g, function(match, funcName, params) {
        const typedParams = params.split(',').map((param: string) => {
          param = param.trim();
          return param ? `${param}: any` : param;
        }).join(', ');
        return `function ${funcName}(${typedParams})`;
      })
      // Arrow fonksiyonlara any tipi ekle
      .replace(/(const|let|var)\s+(\w+)\s*=\s*\(([^\)]+)\)\s*=>/g, function(match, varType, funcName, params) {
        const typedParams = params.split(',').map((param: string) => {
          param = param.trim();
          return param ? `${param}: any` : param;
        }).join(', ');
        return `${varType} ${funcName} = (${typedParams}) =>`;
      });

    // TypeScript dosyasını oluştur
    fs.writeFileSync(tsFilePath, tsContent);

    console.log(`Dönüştürüldü: ${filePath} -> ${tsFilePath}`);

    // Orijinal JavaScript dosyasını sil (isteğe bağlı)
    // fs.unlinkSync(filePath);
    // console.log(`Silindi: ${filePath}`);
  } catch (error) {
    console.error(`Dosya dönüştürülürken hata oluştu: ${filePath}`, error);
  }
}

/**
 * Ana fonksiyon
 */
async function main() {
  console.log('JavaScript -> TypeScript dönüşümü başlatılıyor...');

  for (const dir of DIRS_TO_PROCESS) {
    if (fs.existsSync(dir)) {
      console.log(`Dizin işleniyor: ${dir}`);
      const jsFiles = await findJsFiles(dir);

      for (const file of jsFiles) {
        if (!EXCLUDE_FILES.some(exclude => file.includes(exclude))) {
          await convertJsToTs(file);
        }
      }
    } else {
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
