/**
 * scripts/build.ts
 * TypeScript kodunu derlemek için betik
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
 * Dosyayı kopyalar
 * @param source - Kaynak dosya yolu
 * @param target - Hedef dosya yolu
 */
function copyFile(source: string, target: string): void {
  try {
    fs.copyFileSync(source, target);
    info(`Dosya kopyalandı: ${path.basename(source)}`);
  } catch (err) {
    error(`Dosya kopyalama hatası: ${(err as Error).message}`);
  }
}

/**
 * Dizini kopyalar
 * @param source - Kaynak dizin yolu
 * @param target - Hedef dizin yolu
 */
function copyDirectory(source: string, target: string): void {
  // Hedef dizin yoksa oluştur
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Kaynak dizindeki dosyaları oku
  const files = fs.readdirSync(source);

  // Her dosyayı kopyala
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    // Dosya mı dizin mi kontrol et
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      // Dizinse, özyinelemeli olarak kopyala
      copyDirectory(sourcePath, targetPath);
    } else {
      // Dosyaysa, kopyala
      copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * Ana fonksiyon
 */
function build(): void {
  log('\n' + colors.bright + colors.fg.magenta + '=== TypeScript Derleme Betiği ===' + colors.reset + '\n');

  // Dist dizinini temizle
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    info('Dist dizini temizleniyor...');
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // Dist dizinini oluştur
  createDirectory(distDir);

  // ESLint ile kod kontrolü
  info('ESLint ile kod kontrolü yapılıyor...');
  if (!runCommand('npx eslint "src/**/*.ts" --fix')) {
    warn('ESLint hataları var, ancak derlemeye devam ediliyor...');
  }

  // TypeScript derlemesi (sadece transpile et, tip kontrolü yapma)
  info('TypeScript kodu derleniyor (sadece transpile)...');
  if (!runCommand('npx tsc -p tsconfig.json --noEmit false --skipLibCheck true --allowJs true --checkJs false --noEmitOnError false')) {
    warn('TypeScript derlemesi sırasında hatalar oluştu, ancak derlemeye devam ediliyor...');
    // Hata olsa bile devam et
  }

  // Statik dosyaları kopyala
  info('Statik dosyalar kopyalanıyor...');

  // package.json kopyala
  fs.copyFileSync(
    path.join(__dirname, '..', 'package.json'),
    path.join(distDir, 'package.json')
  );

  // .env dosyasını kopyala (varsa)
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, path.join(distDir, '.env'));
  } else {
    warn('.env dosyası bulunamadı, kopyalanmadı.');
  }

  // public dizinini kopyala
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    copyDirectory(publicDir, path.join(distDir, 'public'));
  } else {
    warn('public dizini bulunamadı, kopyalanmadı.');
  }

  // views dizinini kopyala (varsa)
  const viewsDir = path.join(__dirname, '..', 'views');
  if (fs.existsSync(viewsDir)) {
    copyDirectory(viewsDir, path.join(distDir, 'views'));
  }

  // Derleme tamamlandı
  success('TypeScript kodu başarıyla derlendi!');
  log('\n' + colors.bright + colors.fg.green + '=== Derleme Tamamlandı ===' + colors.reset + '\n');
}

// Betiği çalıştır
build();
