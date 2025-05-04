/**
 * scripts/ts-strict-check.js
 * TypeScript strict mode kontrol scripti
 *
 * Bu script, TypeScript strict mode'a geçiş için hazırlık yapar.
 * Belirli bir strict flag'i etkinleştirerek, projenin o flag ile derlenip derlenemeyeceğini kontrol eder.
 *
 * Kullanım:
 * node scripts/ts-strict-check.js --flag=noImplicitAny
 * node scripts/ts-strict-check.js --flag=strictNullChecks
 * node scripts/ts-strict-check.js --flag=strictFunctionTypes
 * node scripts/ts-strict-check.js --flag=strictPropertyInitialization
 * node scripts/ts-strict-check.js --flag=noImplicitThis
 * node scripts/ts-strict-check.js --flag=all (tüm strict flagleri etkinleştirir)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Komut satırı argümanlarını analiz et
const args = process.argv.slice(2);
let flag = null;

for (const arg of args) {
  if (arg.startsWith('--flag=')) {
    flag = arg.split('=')[1];
    break;
  }
}

if (!flag) {
  console.error('Lütfen bir flag belirtin. Örnek: --flag=noImplicitAny');
  process.exit(1);
}

// Strict flagleri
const strictFlags = [
  'noImplicitAny',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictPropertyInitialization',
  'noImplicitThis',
  'alwaysStrict'
];

// Flag'i kontrol et
if (flag !== 'all' && !strictFlags.includes(flag)) {
  console.error(`Geçersiz flag: ${flag}. Geçerli flagler: ${strictFlags.join(', ')} veya all`);
  process.exit(1);
}

// Geçici bir tsconfig dosyası oluştur
const tempTsconfigPath = path.join(__dirname, '..', 'tsconfig.temp.json');
const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');

// Basit bir tsconfig.json oluştur
const tempTsconfig = {
  extends: './tsconfig.json',
  compilerOptions: {}
};

// Flag'i etkinleştir
if (flag === 'all') {
  // Tüm strict flagleri etkinleştir
  strictFlags.forEach(f => {
    tempTsconfig.compilerOptions[f] = true;
  });
  console.log('Tüm strict flagler etkinleştirildi.');
} else {
  tempTsconfig.compilerOptions[flag] = true;
  console.log(`${flag} etkinleştirildi.`);
}

// Geçici tsconfig'i yaz
fs.writeFileSync(tempTsconfigPath, JSON.stringify(tempTsconfig, null, 2));

try {
  // TypeScript derlemesini çalıştır
  console.log('TypeScript derlemesi başlatılıyor...');

  // Çalışma dizinini değiştir (tsc'nin doğru çalışması için)
  const cwd = process.cwd();
  process.chdir(path.join(__dirname, '..'));

  execSync(`npx tsc -p tsconfig.temp.json --noEmit`, { stdio: 'inherit' });

  // Çalışma dizinini geri al
  process.chdir(cwd);

  console.log(`\n✅ Başarılı! Proje ${flag === 'all' ? 'tüm strict flagler' : flag} ile derlenebiliyor.`);
} catch (error) {
  console.error(`\n❌ Hata! Proje ${flag === 'all' ? 'tüm strict flagler' : flag} ile derlenemiyor.`);
} finally {
  // Geçici tsconfig'i sil
  if (fs.existsSync(tempTsconfigPath)) {
    fs.unlinkSync(tempTsconfigPath);
    console.log('Geçici tsconfig.json silindi.');
  }
}
