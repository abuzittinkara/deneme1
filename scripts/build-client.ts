/**
 * scripts/build-client.ts
 * İstemci tarafı TypeScript kodunu derlemek için betik
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Renkli konsol çıktısı için
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    crimson: '\x1b[38m'
  },

  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    crimson: '\x1b[48m'
  }
};

/**
 * Konsola bilgi mesajı yazdırır
 * @param message - Yazdırılacak mesaj
 */
function info(message: string): void {
  console.log(colors.fg.blue + '[INFO] ' + colors.reset + message);
}

/**
 * Konsola başarı mesajı yazdırır
 * @param message - Yazdırılacak mesaj
 */
function success(message: string): void {
  console.log(colors.fg.green + '[SUCCESS] ' + colors.reset + message);
}

/**
 * Konsola uyarı mesajı yazdırır
 * @param message - Yazdırılacak mesaj
 */
function warn(message: string): void {
  console.log(colors.fg.yellow + '[WARNING] ' + colors.reset + message);
}

/**
 * Konsola hata mesajı yazdırır
 * @param message - Yazdırılacak mesaj
 */
function error(message: string): void {
  console.log(colors.fg.red + '[ERROR] ' + colors.reset + message);
}

/**
 * Konsola log mesajı yazdırır
 * @param message - Yazdırılacak mesaj
 */
function log(message: string): void {
  console.log(message);
}

/**
 * Komut çalıştırır
 * @param command - Çalıştırılacak komut
 * @returns Komutun başarılı olup olmadığı
 */
function runCommand(command: string): boolean {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Dizin oluşturur
 * @param dirPath - Oluşturulacak dizin yolu
 */
function createDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    info(`Dizin oluşturuldu: ${dirPath}`);
  }
}

/**
 * Ana fonksiyon
 */
function buildClient(): void {
  log('\n' + colors.bright + colors.fg.magenta + '=== İstemci TypeScript Derleme Betiği ===' + colors.reset + '\n');

  // public/dist dizinini temizle
  const distDir = path.join(__dirname, '..', 'public', 'dist');
  if (fs.existsSync(distDir)) {
    info('public/dist dizini temizleniyor...');
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // public/dist dizinini oluştur
  createDirectory(distDir);

  // public dizinine git
  process.chdir(path.join(__dirname, '..', 'public'));

  // Bağımlılıkları yükle
  info('Bağımlılıklar yükleniyor...');
  if (!runCommand('npm install')) {
    error('Bağımlılıklar yüklenirken hata oluştu!');
    process.exit(1);
  }

  // ESLint ile kod kontrolü
  info('ESLint ile kod kontrolü yapılıyor...');
  if (!runCommand('npm run lint')) {
    warn('ESLint hataları var, ancak derlemeye devam ediliyor...');
  }

  // Webpack ile TypeScript derlemesi
  info('TypeScript kodu webpack ile derleniyor...');
  if (!runCommand('npm run build')) {
    error('TypeScript derlemesi başarısız oldu!');
    process.exit(1);
  }

  // Derleme tamamlandı
  success('İstemci TypeScript kodu başarıyla derlendi!');
  log('\n' + colors.bright + colors.fg.green + '=== Derleme Tamamlandı ===' + colors.reset + '\n');
}

// Betiği çalıştır
buildClient();
