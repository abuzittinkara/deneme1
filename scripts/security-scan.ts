/**
 * scripts/security-scan.ts
 * Güvenlik taraması scripti
 */
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import chalk from 'chalk';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Tarama yapılacak dizinler
const DIRS_TO_SCAN = [
  'src',
  'scripts',
  'config'
];

// Tarama yapılmayacak dizinler
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git'
];

// Tarama yapılacak dosya uzantıları
const FILE_EXTENSIONS = [
  '.ts',
  '.js',
  '.json',
  '.yml',
  '.yaml',
  '.env.example'
];

// Güvenlik sorunları için aranacak desenler
const SECURITY_PATTERNS = [
  {
    name: 'Hardcoded Credentials',
    pattern: /(password|secret|key|token|auth).*?[=:]["'](?!process|env|config|\\$\\{)[^"']*["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Sensitive Information Logging',
    pattern: /console\.(log|info|debug|warn|error)\(.*?(password|secret|key|token|auth)/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'Insecure Randomness',
    pattern: /Math\.random\(\)/g,
    severity: 'MEDIUM'
  },
  {
    name: 'Potential SQL Injection',
    pattern: /db\.query\(.*?\$\{/g,
    severity: 'HIGH'
  },
  {
    name: 'Potential XSS',
    pattern: /innerHTML|outerHTML|document\.write\(|eval\(|setTimeout\(.*?['"]/g,
    severity: 'HIGH'
  },
  {
    name: 'Insecure Cookie',
    pattern: /cookie.*?secure:\s*false|cookie.*?httpOnly:\s*false/g,
    severity: 'MEDIUM'
  },
  {
    name: 'Weak Encryption',
    pattern: /createCipher\(|MD5|SHA1/g,
    severity: 'HIGH'
  },
  {
    name: 'Potential Command Injection',
    pattern: /exec\(.*?\$\{|spawn\(.*?\$\{|execSync\(.*?\$\{/g,
    severity: 'CRITICAL'
  },
  {
    name: 'Potential Path Traversal',
    pattern: /path\.join\(.*?\.\.\/|path\.resolve\(.*?\.\.\/|fs\.(read|write).*?\.\.\/|require\(.*?\.\.\/.*?\)/g,
    severity: 'HIGH'
  },
  {
    name: 'Potential Prototype Pollution',
    pattern: /Object\.assign\(.*?__proto__|Object\.setPrototypeOf\(|__proto__.*?=/g,
    severity: 'MEDIUM'
  },
  {
    name: 'Insecure CORS',
    pattern: /cors\(.*?origin:\s*['"]?\*/g,
    severity: 'MEDIUM'
  },
  {
    name: 'Insecure File Upload',
    pattern: /multer\(.*?limits:\s*false|multer\(.*?fileFilter:\s*false/g,
    severity: 'MEDIUM'
  },
  {
    name: 'Potential NoSQL Injection',
    pattern: /\$where:.*?\{.*?\}|\$regex:.*?\$options/g,
    severity: 'HIGH'
  },
  {
    name: 'Potential Denial of Service',
    pattern: /bodyParser\.json\(.*?limit:\s*['"]?\d+[mg]b/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'Insecure JWT',
    pattern: /jwt\.sign\(.*?algorithm:\s*['"]?none['"]?|jwt\.sign\(.*?expiresIn:\s*['"]?0['"]?/g,
    severity: 'HIGH'
  }
];

// Sonuçlar
interface ScanResult {
  file: string;
  line: number;
  column: number;
  issue: string;
  severity: string;
  code: string;
}

const results: ScanResult[] = [];

/**
 * Dosyayı tara
 * @param filePath - Dosya yolu
 */
async function scanFile(filePath: string): Promise<void> {
  try {
    const content = await readFileAsync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const pattern of SECURITY_PATTERNS) {
      let match;
      while ((match = pattern.pattern.exec(content)) !== null) {
        // Eşleşmenin satır ve sütun numarasını bul
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;
        const line = lines[lineIndex];
        const column = match.index - content.substring(0, content.lastIndexOf('\n', match.index)).length;

        if (line) {
          results.push({
            file: filePath,
            line: lineIndex + 1,
            column: column,
            issue: pattern.name,
            severity: pattern.severity,
            code: line.trim()
          });
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`Dosya tarama hatası: ${filePath}`), error);
  }
}

/**
 * Dizini tara
 * @param directory - Dizin yolu
 */
async function scanDirectory(directory: string): Promise<void> {
  try {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Hariç tutulan dizinleri atla
        if (EXCLUDE_DIRS.includes(file)) {
          continue;
        }

        await scanDirectory(filePath);
      } else if (stat.isFile()) {
        // Sadece belirtilen uzantılara sahip dosyaları tara
        const ext = path.extname(file);
        if (FILE_EXTENSIONS.includes(ext)) {
          await scanFile(filePath);
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`Dizin tarama hatası: ${directory}`), error);
  }
}

/**
 * Bağımlılıkları tara
 */
async function scanDependencies(): Promise<void> {
  try {
    console.log(chalk.blue('Bağımlılıklar taranıyor...'));

    // npm audit ile bağımlılıkları tara
    const { stdout } = await execAsync('npm audit --json');
    const auditResult = JSON.parse(stdout);

    // Sonuçları göster
    if (auditResult.vulnerabilities) {
      const vulnerabilities = auditResult.vulnerabilities as Record<string, any[]>;
      const vulnCount = Object.values(vulnerabilities).reduce((acc: number, vuln: any[]) => acc + vuln.length, 0);

      if (vulnCount > 0) {
        console.log(chalk.yellow(`${vulnCount} güvenlik açığı bulundu:`));

        for (const [severity, vulns] of Object.entries(auditResult.vulnerabilities)) {
          console.log(chalk.yellow(`  ${severity}: ${(vulns as any[]).length}`));
        }

        console.log(chalk.blue('\nÖnerilen çözümler:'));
        console.log(chalk.green('  npm audit fix'));
        console.log(chalk.green('  npm audit fix --force (Dikkatli kullanın!)'));
      } else {
        console.log(chalk.green('Bağımlılıklarda güvenlik açığı bulunamadı.'));
      }
    } else {
      console.log(chalk.green('Bağımlılıklarda güvenlik açığı bulunamadı.'));
    }
  } catch (error) {
    console.error(chalk.red('Bağımlılık tarama hatası:'), error);
  }
}

/**
 * Sonuçları göster
 */
function displayResults(): void {
  if (results.length === 0) {
    console.log(chalk.green('Kod taramasında güvenlik sorunu bulunamadı.'));
    return;
  }

  console.log(chalk.yellow(`${results.length} potansiyel güvenlik sorunu bulundu:`));

  // Sonuçları şiddetine göre grupla
  const groupedResults = {
    'CRITICAL': [] as ScanResult[],
    'HIGH': [] as ScanResult[],
    'MEDIUM': [] as ScanResult[],
    'LOW': [] as ScanResult[]
  };

  for (const result of results) {
    // Şiddet seviyesini kontrol et ve uygun gruba ekle
    if (result.severity === 'CRITICAL') {
      groupedResults.CRITICAL.push(result);
    } else if (result.severity === 'HIGH') {
      groupedResults.HIGH.push(result);
    } else if (result.severity === 'MEDIUM') {
      groupedResults.MEDIUM.push(result);
    } else if (result.severity === 'LOW') {
      groupedResults.LOW.push(result);
    } else {
      // Bilinmeyen şiddet seviyelerini MEDIUM olarak kabul et
      groupedResults.MEDIUM.push(result);
    }
  }

  // Sonuçları göster
  // CRITICAL sonuçları
  if (groupedResults.CRITICAL.length > 0) {
    console.log(chalk.bgRed.white(`\nCRITICAL (${groupedResults.CRITICAL.length}):`));
    for (const result of groupedResults.CRITICAL) {
      console.log(chalk.white(`  ${result.file}:${result.line}:${result.column}`));
      console.log(chalk.gray(`    ${result.issue}`));
      console.log(chalk.gray(`    ${result.code}`));
      console.log();
    }
  }

  // HIGH sonuçları
  if (groupedResults.HIGH.length > 0) {
    console.log(chalk.red(`\nHIGH (${groupedResults.HIGH.length}):`));
    for (const result of groupedResults.HIGH) {
      console.log(chalk.white(`  ${result.file}:${result.line}:${result.column}`));
      console.log(chalk.gray(`    ${result.issue}`));
      console.log(chalk.gray(`    ${result.code}`));
      console.log();
    }
  }

  // MEDIUM sonuçları
  if (groupedResults.MEDIUM.length > 0) {
    console.log(chalk.yellow(`\nMEDIUM (${groupedResults.MEDIUM.length}):`));
    for (const result of groupedResults.MEDIUM) {
      console.log(chalk.white(`  ${result.file}:${result.line}:${result.column}`));
      console.log(chalk.gray(`    ${result.issue}`));
      console.log(chalk.gray(`    ${result.code}`));
      console.log();
    }
  }

  // LOW sonuçları
  if (groupedResults.LOW.length > 0) {
    console.log(chalk.blue(`\nLOW (${groupedResults.LOW.length}):`));
    for (const result of groupedResults.LOW) {
      console.log(chalk.white(`  ${result.file}:${result.line}:${result.column}`));
      console.log(chalk.gray(`    ${result.issue}`));
      console.log(chalk.gray(`    ${result.code}`));
      console.log();
    }
  }

  // Öneriler
  console.log(chalk.blue('\nÖneriler:'));
  console.log(chalk.green('  1. Hardcoded credentials yerine ortam değişkenleri kullanın.'));
  console.log(chalk.green('  2. Hassas bilgileri loglamaktan kaçının.'));
  console.log(chalk.green('  3. Güvenli rastgele sayı üretimi için crypto.randomBytes() kullanın.'));
  console.log(chalk.green('  4. SQL sorguları için parametreli sorgular kullanın.'));
  console.log(chalk.green('  5. XSS saldırılarına karşı kullanıcı girdilerini temizleyin.'));
  console.log(chalk.green('  6. Cookie\'ler için secure ve httpOnly seçeneklerini etkinleştirin.'));
  console.log(chalk.green('  7. Güçlü şifreleme algoritmaları kullanın (AES-256, SHA-256 vb.).'));
  console.log(chalk.green('  8. Komut enjeksiyonuna karşı kullanıcı girdilerini doğrulayın.'));
  console.log(chalk.green('  9. Yol geçişi saldırılarına karşı dosya yollarını doğrulayın.'));
  console.log(chalk.green('  10. CORS yapılandırmasını sıkılaştırın.'));
}

/**
 * Sonuçları dosyaya kaydet
 */
async function saveResults(): Promise<void> {
  if (results.length === 0) {
    return;
  }

  try {
    const reportDir = 'reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportPath = path.join(reportDir, `security-scan-${timestamp}.json`);

    await writeFileAsync(reportPath, JSON.stringify(results, null, 2));

    console.log(chalk.blue(`\nSonuçlar kaydedildi: ${reportPath}`));
  } catch (error) {
    console.error(chalk.red('Sonuçları kaydetme hatası:'), error);
  }
}

/**
 * Ana fonksiyon
 */
async function main(): Promise<void> {
  console.log(chalk.blue('Güvenlik taraması başlatılıyor...'));

  // Bağımlılıkları tara
  await scanDependencies();

  console.log(chalk.blue('\nKod taraması başlatılıyor...'));

  // Dizinleri tara
  for (const dir of DIRS_TO_SCAN) {
    if (fs.existsSync(dir)) {
      await scanDirectory(dir);
    }
  }

  // Sonuçları göster
  console.log(chalk.blue('\nKod taraması sonuçları:'));
  displayResults();

  // Sonuçları kaydet
  await saveResults();

  console.log(chalk.blue('\nGüvenlik taraması tamamlandı.'));
}

// Scripti çalıştır
main().catch(error => {
  console.error(chalk.red('Güvenlik taraması hatası:'), error);
  process.exit(1);
});
