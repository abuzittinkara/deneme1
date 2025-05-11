/**
 * scripts/buildFrontend.ts
 * Frontend TypeScript dosyalarını derlemek için script
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Frontend TypeScript dosyalarının bulunduğu dizin
const TS_DIR = path.join('public', 'js');
const DIST_DIR = path.join('public', 'js', 'dist');

// Dist dizinini oluştur (yoksa)
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

/**
 * TypeScript dosyalarını JavaScript'e derler
 */
function compileTypeScript() {
  try {
    console.log('Frontend TypeScript dosyaları derleniyor...');

    // Derlenecek TypeScript dosyalarını bul
    const tsFiles = fs.readdirSync(TS_DIR)
      .filter(file => file.endsWith('.ts'))
      .map(file => path.join(TS_DIR, file));

    console.log(`Derlenecek dosyalar: ${tsFiles.length} adet`);

    // Her bir TypeScript dosyası için
    for (const tsFile of tsFiles) {
      const baseName = path.basename(tsFile, '.ts');
      const jsFile = path.join(DIST_DIR, `${baseName}.js`);

      console.log(`Derleniyor: ${tsFile} -> ${jsFile}`);

      // tsc komutunu çalıştır - güvenli şekilde
      const tscBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsc');
      const options = [
        '--target', 'ES2021',
        '--module', 'commonjs',
        '--esModuleInterop', 'true',
        '--skipLibCheck', 'true',
        '--lib', 'ES2021,DOM,DOM.Iterable',
        '--outDir', DIST_DIR,
        tsFile
      ];

      // Güvenli şekilde çalıştır - doğrudan argümanları geçerek
      execSync(tscBin, options, {
        stdio: 'inherit'
      });

      console.log(`Derlendi: ${jsFile}`);
    }

    console.log('Frontend TypeScript dosyaları başarıyla derlendi!');
  } catch (error) {
    console.error('TypeScript derleme hatası:', error);
    process.exit(1);
  }
}

/**
 * JavaScript dosyalarını minify eder
 */
function minifyJavaScript() {
  try {
    console.log('JavaScript dosyaları minify ediliyor...');

    // Minify edilecek JavaScript dosyalarını bul
    const jsFiles = fs.readdirSync(DIST_DIR)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(DIST_DIR, file));

    console.log(`Minify edilecek dosyalar: ${jsFiles.length} adet`);

    // Tercihe bağlı: Minify işlemi için tercihen terser veya uglify-js kullanılabilir
    // Bu örnekte basit bir minify işlemi yapıyoruz
    for (const jsFile of jsFiles) {
      console.log(`Minify ediliyor: ${jsFile}`);

      // Dosyayı oku
      const content = fs.readFileSync(jsFile, 'utf8');

      // Basit minify işlemi (yorum satırlarını ve fazla boşlukları kaldır)
      const minified = content
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') // Yorumları kaldır
        .replace(/\s+/g, ' ') // Fazla boşlukları tek boşluğa dönüştür
        .trim();

      // Minify edilmiş dosyayı yaz
      fs.writeFileSync(jsFile, minified);

      console.log(`Minify edildi: ${jsFile}`);
    }

    console.log('JavaScript dosyaları başarıyla minify edildi!');
  } catch (error) {
    console.error('JavaScript minify hatası:', error);
    // Minify hatası kritik değil, devam et
  }
}

/**
 * Ana fonksiyon
 */
function main() {
  compileTypeScript();
  minifyJavaScript();
}

// Scripti çalıştır
main();
