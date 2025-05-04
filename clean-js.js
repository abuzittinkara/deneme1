/**
 * clean-js.js
 * TypeScript karşılığı olan JavaScript dosyalarını temizleyen betik
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

// Temizlenecek dizinler
const directories = [
  './src',
  './'
];

// Korunacak JavaScript dosyaları (yapılandırma dosyaları vb.)
const protectedFiles = [
  '.eslintrc.js',
  'webpack.config.js',
  'jest.config.js',
  'babel.config.js',
  'clean-js.js'
];

/**
 * Belirtilen dizindeki tüm dosyaları ve alt dizinleri tarar
 * @param {string} dir - Taranacak dizin
 * @returns {Promise<string[]>} - Dosya yollarının listesi
 */
async function getFiles(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir) => {
    const res = path.resolve(dir, subdir);
    return (await stat(res)).isDirectory() ? getFiles(res) : res;
  }));
  return files.flat();
}

/**
 * TypeScript karşılığı olan JavaScript dosyalarını temizler
 */
async function cleanJsFiles() {
  try {
    console.log('TypeScript karşılığı olan JavaScript dosyaları temizleniyor...');
    
    // Tüm dizinlerdeki dosyaları tara
    let allFiles = [];
    for (const dir of directories) {
      const files = await getFiles(dir);
      allFiles = [...allFiles, ...files];
    }
    
    // JavaScript ve TypeScript dosyalarını filtrele
    const jsFiles = allFiles.filter(file => file.endsWith('.js'));
    const tsFiles = allFiles.filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
    
    // Temizlenecek JavaScript dosyalarını belirle
    const filesToDelete = jsFiles.filter(jsFile => {
      // Korunan dosyaları atla
      const fileName = path.basename(jsFile);
      if (protectedFiles.includes(fileName)) {
        return false;
      }
      
      // TypeScript karşılığı var mı kontrol et
      const tsFile = jsFile.replace(/\.js$/, '.ts');
      const tsxFile = jsFile.replace(/\.js$/, '.tsx');
      return tsFiles.includes(tsFile) || tsFiles.includes(tsxFile);
    });
    
    // Dosyaları sil
    if (filesToDelete.length === 0) {
      console.log('Temizlenecek JavaScript dosyası bulunamadı.');
      return;
    }
    
    console.log(`${filesToDelete.length} JavaScript dosyası temizlenecek:`);
    for (const file of filesToDelete) {
      console.log(`- ${file}`);
      await unlink(file);
    }
    
    console.log('JavaScript dosyaları başarıyla temizlendi.');
  } catch (error) {
    console.error('JavaScript dosyaları temizlenirken bir hata oluştu:', error);
  }
}

// Betiği çalıştır
cleanJsFiles();
