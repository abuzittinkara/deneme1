#!/usr/bin/env node
/**
 * scripts/ts-migration.js
 * JavaScript dosyalarını TypeScript'e dönüştürmek için yardımcı script
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Dönüştürülecek dizin
const SRC_DIR = path.join(__dirname, '../src');

// Dönüştürülmeyecek dosyalar
const EXCLUDED_FILES = [
  '.DS_Store',
  '.gitkeep',
  'node_modules',
  'dist',
  'uploads'
];

// Dönüştürülmeyecek dizinler
const EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'uploads',
  'logs'
];

// Dönüştürülecek dosya uzantıları
const JS_EXTENSIONS = ['.js'];

// TypeScript dosyalarının uzantısı
const TS_EXTENSION = '.ts';

// Dönüştürme istatistikleri
const stats = {
  total: 0,
  converted: 0,
  skipped: 0,
  errors: 0
};

/**
 * Bir dizindeki tüm JavaScript dosyalarını bulur
 * @param {string} dir - Taranacak dizin
 * @param {Array<string>} fileList - Bulunan dosyaların listesi
 * @returns {Array<string>} JavaScript dosyalarının listesi
 */
function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (EXCLUDED_FILES.includes(file)) {
      continue;
    }

    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(file)) {
        findJsFiles(filePath, fileList);
      }
    } else if (JS_EXTENSIONS.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * JavaScript dosyasını TypeScript'e dönüştürür
 * @param {string} filePath - JavaScript dosyasının yolu
 */
function convertJsToTs(filePath) {
  try {
    stats.total++;

    // Dosya içeriğini oku
    const content = fs.readFileSync(filePath, 'utf8');

    // TypeScript dosya yolu
    const tsFilePath = filePath.replace(/\.js$/, TS_EXTENSION);

    // Eğer TypeScript dosyası zaten varsa, dönüştürme
    if (fs.existsSync(tsFilePath)) {
      console.log(chalk.yellow(`Atlandı (TS dosyası zaten var): ${filePath}`));
      stats.skipped++;
      return;
    }

    // Dosya içeriğini TypeScript'e uygun hale getir
    let tsContent = content;

    // Basit dönüşümler
    tsContent = tsContent
      // require -> import
      .replace(/const\s+(\w+)\s+=\s+require\(['"](.+)['"]\);?/g, 'import * as $1 from \'$2\';')
      // module.exports -> export default
      .replace(/module\.exports\s+=\s+(\w+);?/g, 'export default $1;')
      // exports.x = y -> export const x = y
      .replace(/exports\.(\w+)\s+=\s+(.+);?/g, 'export const $1 = $2;');

    // TypeScript dosyasını oluştur
    fs.writeFileSync(tsFilePath, tsContent);

    // JavaScript dosyasını sil
    fs.unlinkSync(filePath);

    console.log(chalk.green(`Dönüştürüldü: ${filePath} -> ${tsFilePath}`));
    stats.converted++;
  } catch (error) {
    console.error(chalk.red(`Hata: ${filePath} dosyası dönüştürülürken hata oluştu`), error);
    stats.errors++;
  }
}

/**
 * Ana fonksiyon
 */
function main() {
  console.log(chalk.blue('JavaScript -> TypeScript dönüştürme işlemi başlatılıyor...'));

  // JavaScript dosyalarını bul
  const jsFiles = findJsFiles(SRC_DIR);
  console.log(chalk.blue(`Toplam ${jsFiles.length} JavaScript dosyası bulundu.`));

  // Her dosyayı dönüştür
  for (const file of jsFiles) {
    convertJsToTs(file);
  }

  // İstatistikleri göster
  console.log(chalk.blue('\nDönüştürme işlemi tamamlandı.'));
  console.log(chalk.blue(`Toplam dosya: ${stats.total}`));
  console.log(chalk.green(`Dönüştürülen: ${stats.converted}`));
  console.log(chalk.yellow(`Atlanan: ${stats.skipped}`));
  console.log(chalk.red(`Hata: ${stats.errors}`));

  // TypeScript derlemesi yap
  try {
    console.log(chalk.blue('\nTypeScript derlemesi yapılıyor...'));
    execSync('npm run build:src', { stdio: 'inherit' });
    console.log(chalk.green('TypeScript derlemesi başarılı.'));
  } catch (error) {
    console.error(chalk.red('TypeScript derlemesi sırasında hatalar oluştu.'));
  }
}

// Scripti çalıştır
main();
