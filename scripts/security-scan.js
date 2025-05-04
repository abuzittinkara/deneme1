/**
 * scripts/security-scan.js
 * Güvenlik taraması ve iyileştirme scripti
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Tarama yapılacak klasörler
const SCAN_DIRS = [
  'src',
  'public',
  'scripts'
];

// Güvenlik sorunları için aranacak kalıplar
const SECURITY_PATTERNS = [
  {
    name: 'Hardcoded Credentials',
    pattern: /(password|secret|key|token|auth).*?[=:]\s*['"`]([^'"`]{8,})['"`]/gi,
    severity: 'HIGH'
  },
  {
    name: 'SQL Injection',
    pattern: /execute\s*\(\s*['"`].*?\$\{.*?\}/gi,
    severity: 'CRITICAL'
  },
  {
    name: 'Command Injection',
    pattern: /exec\s*\(\s*['"`].*?\$\{.*?\}/gi,
    severity: 'CRITICAL'
  },
  {
    name: 'Insecure Direct Object Reference',
    pattern: /params\.(id|userId|username)/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'Cross-Site Scripting (XSS)',
    pattern: /innerHTML|outerHTML|document\.write/gi,
    severity: 'HIGH'
  },
  {
    name: 'Insecure Cookie',
    pattern: /cookie.*?secure:\s*false|cookie.*?httpOnly:\s*false/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'Eval Usage',
    pattern: /eval\s*\(/gi,
    severity: 'HIGH'
  },
  {
    name: 'Insecure Randomness',
    pattern: /Math\.random\(\)/gi,
    severity: 'LOW'
  },
  {
    name: 'Potential RegExp DoS',
    pattern: /new RegExp\(.*\+.*\)/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'Insecure File Operations',
    pattern: /fs\.(write|append)File(Sync)?\s*\(/gi,
    severity: 'MEDIUM'
  }
];

// Bağımlılık güvenlik taraması
async function scanDependencies() {
  console.log('\n🔍 Bağımlılık güvenlik taraması yapılıyor...');
  
  try {
    // npm audit ile güvenlik taraması yap
    const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
    const auditResult = JSON.parse(auditOutput);
    
    // Sonuçları işle
    const vulnerabilities = auditResult.vulnerabilities || {};
    const totalVulnerabilities = Object.values(vulnerabilities).reduce((acc, curr) => acc + curr.length, 0);
    
    if (totalVulnerabilities === 0) {
      console.log('✅ Bağımlılıklarda güvenlik açığı bulunamadı.');
      return;
    }
    
    console.log(`⚠️ ${totalVulnerabilities} güvenlik açığı bulundu:`);
    
    // Güvenlik açıklarını şiddetine göre sırala
    const severityOrder = ['critical', 'high', 'moderate', 'low'];
    
    for (const severity of severityOrder) {
      const vulns = vulnerabilities[severity] || [];
      
      if (vulns.length > 0) {
        console.log(`\n${severity.toUpperCase()} (${vulns.length}):`);
        
        for (const vuln of vulns) {
          console.log(`  - ${vuln.name}: ${vuln.title}`);
          console.log(`    Etkilenen versiyon: ${vuln.version}`);
          console.log(`    Çözüm: ${vuln.recommendation || 'Güncelleme gerekiyor'}`);
        }
      }
    }
    
    console.log('\nGüvenlik açıklarını düzeltmek için:');
    console.log('npm audit fix --force');
  } catch (error) {
    console.error('Bağımlılık taraması sırasında hata oluştu:', error.message);
  }
}

// Kod güvenlik taraması
async function scanCodeSecurity() {
  console.log('\n🔍 Kod güvenlik taraması yapılıyor...');
  
  const issues = [];
  
  // Dosyaları recursive olarak tara
  async function scanDir(dir) {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await stat(fullPath);
      
      // Klasör ise recursive olarak tara
      if (stats.isDirectory()) {
        // node_modules ve dist klasörlerini atla
        if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.git') {
          await scanDir(fullPath);
        }
      } 
      // Dosya ise içeriğini tara
      else if (stats.isFile()) {
        // Sadece belirli dosya türlerini tara
        const ext = path.extname(entry).toLowerCase();
        if (['.js', '.ts', '.jsx', '.tsx', '.html', '.vue'].includes(ext)) {
          await scanFile(fullPath);
        }
      }
    }
  }
  
  // Dosya içeriğini güvenlik sorunları için tara
  async function scanFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf8');
      
      for (const pattern of SECURITY_PATTERNS) {
        const matches = content.match(pattern.pattern);
        
        if (matches) {
          for (const match of matches) {
            issues.push({
              file: filePath,
              issue: pattern.name,
              severity: pattern.severity,
              match: match.trim()
            });
          }
        }
      }
    } catch (error) {
      console.error(`Dosya taranırken hata oluştu: ${filePath}`, error.message);
    }
  }
  
  // Tüm klasörleri tara
  for (const dir of SCAN_DIRS) {
    await scanDir(dir);
  }
  
  // Sonuçları göster
  if (issues.length === 0) {
    console.log('✅ Kod taramasında güvenlik sorunu bulunamadı.');
    return;
  }
  
  console.log(`⚠️ ${issues.length} potansiyel güvenlik sorunu bulundu:`);
  
  // Sorunları şiddetine göre sırala
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  
  for (const severity of severityOrder) {
    const severityIssues = issues.filter(issue => issue.severity === severity);
    
    if (severityIssues.length > 0) {
      console.log(`\n${severity} (${severityIssues.length}):`);
      
      for (const issue of severityIssues) {
        console.log(`  - ${issue.file}`);
        console.log(`    Sorun: ${issue.issue}`);
        console.log(`    Eşleşme: ${issue.match}`);
      }
    }
  }
  
  // Sonuçları dosyaya kaydet
  const reportPath = path.join(__dirname, '../security-report.json');
  await writeFile(reportPath, JSON.stringify(issues, null, 2));
  console.log(`\nDetaylı rapor kaydedildi: ${reportPath}`);
}

// Güvenlik iyileştirme önerileri
function securityRecommendations() {
  console.log('\n📋 Güvenlik İyileştirme Önerileri:');
  
  console.log(`
1. Bağımlılıkları güncelleyin:
   - npm audit fix --force
   - Kritik güvenlik açıkları için manuel güncelleme yapın

2. Kimlik doğrulama ve yetkilendirme:
   - JWT token'ları için kısa ömür ve yenileme mekanizması kullanın
   - Hassas işlemler için çok faktörlü kimlik doğrulama ekleyin
   - Rol tabanlı erişim kontrolü uygulayın

3. Veri doğrulama ve sanitizasyon:
   - Tüm kullanıcı girdilerini doğrulayın (Joi, Zod, vb.)
   - XSS saldırılarına karşı çıktıları sanitize edin
   - SQL enjeksiyonlarına karşı parametreli sorgular kullanın

4. Güvenli HTTP başlıkları:
   - Content-Security-Policy
   - X-XSS-Protection
   - X-Content-Type-Options
   - Strict-Transport-Security

5. Dosya yükleme güvenliği:
   - Dosya türü ve boyut kontrolü yapın
   - Dosya içeriğini doğrulayın
   - Yüklenen dosyaları güvenli bir şekilde depolayın

6. Hata işleme ve loglama:
   - Hassas bilgileri loglara yazmaktan kaçının
   - Kullanıcılara ayrıntılı hata mesajları göstermeyin
   - Tüm hataları merkezi olarak izleyin

7. Şifreleme ve veri koruma:
   - Hassas verileri şifreleyin (özellikle veritabanında)
   - HTTPS kullanın
   - Güçlü şifreleme algoritmaları kullanın

8. API güvenliği:
   - Rate limiting uygulayın
   - CORS politikalarını sıkılaştırın
   - API anahtarları ve token'lar için güvenli depolama kullanın
  `);
}

// Ana fonksiyon
async function main() {
  console.log('🔒 Güvenlik Taraması ve İyileştirme Aracı 🔒');
  console.log('===========================================');
  
  // Bağımlılık taraması
  await scanDependencies();
  
  // Kod güvenlik taraması
  await scanCodeSecurity();
  
  // Güvenlik iyileştirme önerileri
  securityRecommendations();
}

// Scripti çalıştır
main().catch(error => {
  console.error('Güvenlik taraması sırasında hata oluştu:', error);
  process.exit(1);
});
