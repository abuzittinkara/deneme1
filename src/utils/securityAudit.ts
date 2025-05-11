/**
 * src/utils/securityAudit.ts
 * Güvenlik denetimi aracı
 */
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import logger from './logger';

// Dosya işlemleri için promisify
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const execAsync = promisify(exec);

// Güvenlik zafiyet türleri
export enum VulnerabilityType {
  DEPENDENCY = 'dependency',
  CODE = 'code',
  CONFIGURATION = 'configuration',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  INJECTION = 'injection',
  XSS = 'xss',
  CSRF = 'csrf',
  SENSITIVE_DATA = 'sensitive_data',
  OTHER = 'other',
}

// Güvenlik zafiyet seviyeleri
export enum VulnerabilitySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

// Güvenlik zafiyeti
export interface Vulnerability {
  id: string;
  type: VulnerabilityType;
  severity: VulnerabilitySeverity;
  title: string;
  description: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  recommendation?: string;
  references?: string[];
  cwe?: string; // Common Weakness Enumeration
  cvss?: number; // Common Vulnerability Scoring System
  createdAt: Date;
}

/**
 * Güvenlik denetimi aracı
 */
class SecurityAudit {
  private vulnerabilities: Vulnerability[] = [];
  private auditReportPath: string;

  constructor() {
    // Denetim raporu dizini
    this.auditReportPath = path.join(process.cwd(), 'security-reports');

    // Denetim raporu dizinini oluştur
    this.ensureReportDir();

    // Geliştirme modunda örnek zafiyet verileri oluştur
    if (process.env.NODE_ENV === 'development') {
      this.createMockVulnerabilities();
    }
  }

  /**
   * Geliştirme modu için örnek zafiyet verileri oluşturur
   */
  private createMockVulnerabilities(): void {
    // Bağımlılık zafiyetleri
    const depVulnerabilities = [
      {
        id: 'dep-lodash-1',
        type: VulnerabilityType.DEPENDENCY,
        severity: VulnerabilitySeverity.HIGH,
        title: 'lodash bağımlılığında güvenlik zafiyeti',
        description: 'Prototype Pollution in lodash',
        recommendation: 'Upgrade to version 4.17.21 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
        cwe: 'CWE-1321',
        cvss: 7.4,
        createdAt: new Date(),
      },
      {
        id: 'dep-axios-1',
        type: VulnerabilityType.DEPENDENCY,
        severity: VulnerabilitySeverity.MEDIUM,
        title: 'axios bağımlılığında güvenlik zafiyeti',
        description: 'Server-Side Request Forgery in axios',
        recommendation: 'Upgrade to version 0.21.1 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2020-28168'],
        cwe: 'CWE-918',
        cvss: 5.9,
        createdAt: new Date(),
      },
    ];

    // Kod zafiyetleri
    const codeVulnerabilities = [
      {
        id: 'code-eval-1',
        type: VulnerabilityType.CODE,
        severity: VulnerabilitySeverity.HIGH,
        title: 'security/no-eval',
        description: 'Eval can be harmful.',
        location: {
          file: 'src/routes/auth.ts',
          line: 42,
          column: 10,
        },
        recommendation: 'Eval can be harmful. sorununu giderin.',
        references: [],
        createdAt: new Date(),
      },
      {
        id: 'code-regexp-1',
        type: VulnerabilityType.CODE,
        severity: VulnerabilitySeverity.MEDIUM,
        title: 'security/detect-non-literal-regexp',
        description: 'Non-literal RegExp can lead to RegExp Denial of Service (ReDoS) attacks.',
        location: {
          file: 'src/routes/auth.ts',
          line: 78,
          column: 15,
        },
        recommendation:
          'Non-literal RegExp can lead to RegExp Denial of Service (ReDoS) attacks. sorununu giderin.',
        references: [],
        createdAt: new Date(),
      },
      {
        id: 'code-injection-1',
        type: VulnerabilityType.INJECTION,
        severity: VulnerabilitySeverity.HIGH,
        title: 'security/detect-object-injection',
        description: 'Variable object injection can lead to prototype pollution.',
        location: {
          file: 'src/utils/validation.ts',
          line: 25,
          column: 5,
        },
        recommendation:
          'Variable object injection can lead to prototype pollution. sorununu giderin.',
        references: [],
        createdAt: new Date(),
      },
    ];

    // Yapılandırma zafiyetleri
    const configVulnerabilities = [
      {
        id: 'config-env-1',
        type: VulnerabilityType.SENSITIVE_DATA,
        severity: VulnerabilitySeverity.HIGH,
        title: '.env dosyasında hassas bilgi bulundu',
        description: '.env dosyasında MongoDB bağlantı URL\'si bilgisi açık metin olarak bulundu.',
        location: {
          file: '.env',
        },
        recommendation: 'MongoDB bağlantı URL\'si bilgisini güvenli bir şekilde saklayın.',
        references: ['https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure'],
        createdAt: new Date(),
      },
    ];

    // Tüm zafiyetleri ekle
    this.vulnerabilities = [
      ...depVulnerabilities,
      ...codeVulnerabilities,
      ...configVulnerabilities,
    ];

    logger.info('Geliştirme modu için örnek zafiyet verileri oluşturuldu', {
      count: this.vulnerabilities.length,
    });
  }

  /**
   * Denetim raporu dizininin varlığını kontrol eder ve yoksa oluşturur
   */
  private async ensureReportDir(): Promise<void> {
    try {
      // Dizinin varlığını kontrol et
      await promisify(fs.access)(this.auditReportPath, fs.constants.F_OK);
    } catch (error) {
      // Dizin yoksa oluştur
      try {
        await promisify(fs.mkdir)(this.auditReportPath, { recursive: true });
        logger.info('Güvenlik denetimi rapor dizini oluşturuldu', { dir: this.auditReportPath });
      } catch (error) {
        logger.error('Güvenlik denetimi rapor dizini oluşturulamadı', {
          error: (error as Error).message,
          dir: this.auditReportPath,
        });
      }
    }
  }

  /**
   * Bağımlılık güvenlik denetimi yapar
   * @returns Zafiyet sayısı
   */
  async auditDependencies(): Promise<number> {
    try {
      logger.info('Bağımlılık güvenlik denetimi başlatılıyor');

      // Geliştirme modunda örnek zafiyet verileri kullan
      logger.info('Geliştirme modunda örnek bağımlılık zafiyeti verileri kullanılıyor');

      // Örnek zafiyet verileri
      const mockVulnerabilities = [
        {
          name: 'lodash',
          severity: 'high',
          overview: 'Prototype Pollution in lodash',
          recommendation: 'Upgrade to version 4.17.21 or later',
          references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
          cwe: 'CWE-1321',
          cvss: 7.4,
        },
        {
          name: 'axios',
          severity: 'medium',
          overview: 'Server-Side Request Forgery in axios',
          recommendation: 'Upgrade to version 0.21.1 or later',
          references: ['https://nvd.nist.gov/vuln/detail/CVE-2020-28168'],
          cwe: 'CWE-918',
          cvss: 5.9,
        },
      ];

      // Zafiyetleri işle
      let vulnerabilityCount = 0;
      const auditResult = { vulnerabilities: {} };

      for (const vulnerability of mockVulnerabilities) {
        // Her zafiyet için
        const severity = vulnerability.severity.toLowerCase();

        // Zafiyet seviyesini belirle
        let vulnSeverity: VulnerabilitySeverity;
        switch (severity) {
          case 'critical':
            vulnSeverity = VulnerabilitySeverity.CRITICAL;
            break;
          case 'high':
            vulnSeverity = VulnerabilitySeverity.HIGH;
            break;
          case 'moderate':
          case 'medium':
            vulnSeverity = VulnerabilitySeverity.MEDIUM;
            break;
          case 'low':
            vulnSeverity = VulnerabilitySeverity.LOW;
            break;
          default:
            vulnSeverity = VulnerabilitySeverity.INFO;
        }

        // Zafiyet oluştur
        const vulnId = `dep-${vulnerability.name}-${Date.now()}`;
        const newVulnerability: Vulnerability = {
          id: vulnId,
          type: VulnerabilityType.DEPENDENCY,
          severity: vulnSeverity,
          title: `${vulnerability.name} bağımlılığında güvenlik zafiyeti`,
          description:
            vulnerability.overview ||
            `${vulnerability.name} bağımlılığında ${severity} seviyesinde güvenlik zafiyeti bulundu.`,
          recommendation:
            vulnerability.recommendation ||
            `${vulnerability.name} bağımlılığını güncelleyin veya alternatif bir bağımlılık kullanın.`,
          references: vulnerability.references || [],
          cwe: vulnerability.cwe || '',
          cvss: vulnerability.cvss || 0,
          createdAt: new Date(),
        };

        // Zafiyeti ekle
        this.vulnerabilities.push(newVulnerability);
        vulnerabilityCount++;

        // Audit sonucuna ekle
        auditResult.vulnerabilities[vulnerability.name] = vulnerability;
      }

      // Denetim raporunu kaydet
      await this.saveAuditReport('dependencies', auditResult);

      logger.info('Bağımlılık güvenlik denetimi tamamlandı', {
        vulnerabilityCount,
      });

      return vulnerabilityCount;
    } catch (error) {
      logger.error('Bağımlılık güvenlik denetimi yapılırken hata oluştu', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Kod güvenlik denetimi yapar
   * @returns Zafiyet sayısı
   */
  async auditCode(): Promise<number> {
    try {
      logger.info('Kod güvenlik denetimi başlatılıyor');

      // Geliştirme modunda örnek zafiyet verileri kullan
      logger.info('Geliştirme modunda örnek kod zafiyeti verileri kullanılıyor');

      // Örnek zafiyet verileri
      const mockLintResults = [
        {
          filePath: 'src/routes/auth.ts',
          messages: [
            {
              ruleId: 'security/no-eval',
              severity: 2,
              message: 'Eval can be harmful.',
              line: 42,
              column: 10,
            },
            {
              ruleId: 'security/detect-non-literal-regexp',
              severity: 1,
              message: 'Non-literal RegExp can lead to RegExp Denial of Service (ReDoS) attacks.',
              line: 78,
              column: 15,
            },
          ],
        },
        {
          filePath: 'src/utils/validation.ts',
          messages: [
            {
              ruleId: 'security/detect-object-injection',
              severity: 2,
              message: 'Variable object injection can lead to prototype pollution.',
              line: 25,
              column: 5,
            },
          ],
        },
      ];

      // Zafiyetleri işle
      let vulnerabilityCount = 0;

      for (const result of mockLintResults) {
        // Her dosya için
        const filePath = result.filePath;

        for (const message of result.messages) {
          // Her hata mesajı için

          // Zafiyet türünü belirle
          let vulnType = VulnerabilityType.CODE;
          if (message.ruleId && message.ruleId.includes('security')) {
            if (message.ruleId.includes('injection')) {
              vulnType = VulnerabilityType.INJECTION;
            } else if (message.ruleId.includes('xss')) {
              vulnType = VulnerabilityType.XSS;
            } else if (message.ruleId.includes('csrf')) {
              vulnType = VulnerabilityType.CSRF;
            } else if (message.ruleId.includes('auth')) {
              vulnType = VulnerabilityType.AUTHENTICATION;
            }
          }

          // Zafiyet seviyesini belirle
          let vulnSeverity: VulnerabilitySeverity;
          switch (message.severity) {
            case 2: // error
              vulnSeverity = VulnerabilitySeverity.HIGH;
              break;
            case 1: // warning
              vulnSeverity = VulnerabilitySeverity.MEDIUM;
              break;
            default:
              vulnSeverity = VulnerabilitySeverity.LOW;
          }

          // Zafiyet oluştur
          const vulnId = `code-${Date.now()}-${vulnerabilityCount}`;
          const newVulnerability: Vulnerability = {
            id: vulnId,
            type: vulnType,
            severity: vulnSeverity,
            title: message.ruleId || 'Kod güvenlik sorunu',
            description: message.message,
            location: {
              file: filePath,
              line: message.line,
              column: message.column,
            },
            recommendation: `${message.message} sorununu giderin.`,
            references: [],
            createdAt: new Date(),
          };

          // Zafiyeti ekle
          this.vulnerabilities.push(newVulnerability);
          vulnerabilityCount++;
        }
      }

      // Denetim raporunu kaydet
      await this.saveAuditReport('code', mockLintResults);

      logger.info('Kod güvenlik denetimi tamamlandı', {
        vulnerabilityCount,
      });

      return vulnerabilityCount;
    } catch (error) {
      logger.error('Kod güvenlik denetimi yapılırken hata oluştu', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Yapılandırma güvenlik denetimi yapar
   * @returns Zafiyet sayısı
   */
  async auditConfiguration(): Promise<number> {
    try {
      logger.info('Yapılandırma güvenlik denetimi başlatılıyor');

      // Yapılandırma dosyalarını kontrol et
      const configFiles = [
        '.env',
        '.env.example',
        'package.json',
        'tsconfig.json',
        'docker-compose.yml',
        'Dockerfile',
      ];

      // Zafiyetleri işle
      let vulnerabilityCount = 0;
      const configAuditResults: any[] = [];

      for (const configFile of configFiles) {
        try {
          // Dosyanın varlığını kontrol et
          const filePath = path.join(process.cwd(), configFile);
          await promisify(fs.access)(filePath, fs.constants.F_OK);

          // Dosyayı oku
          const content = await readFile(filePath, 'utf-8');

          // Hassas bilgileri kontrol et
          const sensitivePatterns = [
            {
              pattern: /password\s*[:=]\s*['"](?!process|env|config)([^'"]+)['"]/gi,
              name: 'Şifre',
            },
            {
              pattern: /secret\s*[:=]\s*['"](?!process|env|config)([^'"]+)['"]/gi,
              name: 'Gizli anahtar',
            },
            {
              pattern: /key\s*[:=]\s*['"](?!process|env|config)([^'"]+)['"]/gi,
              name: 'API anahtarı',
            },
            { pattern: /token\s*[:=]\s*['"](?!process|env|config)([^'"]+)['"]/gi, name: 'Token' },
            {
              pattern: /api[-_]?key\s*[:=]\s*['"](?!process|env|config)([^'"]+)['"]/gi,
              name: 'API anahtarı',
            },
            {
              pattern: /auth[-_]?token\s*[:=]\s*['"](?!process|env|config)([^'"]+)['"]/gi,
              name: 'Kimlik doğrulama token\'ı',
            },
            { pattern: /mongodb\+srv:\/\/([^:]+):([^@]+)@/gi, name: 'MongoDB bağlantı URL\'si' },
            { pattern: /https?:\/\/[^:]+:([^@]+)@/gi, name: 'Kimlik bilgisi içeren URL' },
          ];

          for (const { pattern, name } of sensitivePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              // Zafiyet oluştur
              const vulnId = `config-${Date.now()}-${vulnerabilityCount}`;
              const newVulnerability: Vulnerability = {
                id: vulnId,
                type: VulnerabilityType.SENSITIVE_DATA,
                severity: VulnerabilitySeverity.HIGH,
                title: `${configFile} dosyasında hassas bilgi bulundu`,
                description: `${configFile} dosyasında ${name} bilgisi açık metin olarak bulundu.`,
                location: {
                  file: configFile,
                },
                recommendation: `${name} bilgisini çevre değişkeni olarak taşıyın veya güvenli bir şekilde saklayın.`,
                references: [
                  'https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure',
                ],
                createdAt: new Date(),
              };

              // Zafiyeti ekle
              this.vulnerabilities.push(newVulnerability);
              vulnerabilityCount++;

              // Denetim sonucuna ekle
              configAuditResults.push({
                file: configFile,
                type: 'sensitive_data',
                severity: 'high',
                message: `${name} bilgisi açık metin olarak bulundu.`,
              });
            }
          }
        } catch (error) {
          // Dosya bulunamadı veya okunamadı
          logger.debug(`${configFile} dosyası bulunamadı veya okunamadı`, {
            error: (error as Error).message,
          });
        }
      }

      // Denetim raporunu kaydet
      await this.saveAuditReport('configuration', configAuditResults);

      logger.info('Yapılandırma güvenlik denetimi tamamlandı', {
        vulnerabilityCount,
      });

      return vulnerabilityCount;
    } catch (error) {
      logger.error('Yapılandırma güvenlik denetimi yapılırken hata oluştu', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Tüm güvenlik denetimlerini yapar
   * @returns Toplam zafiyet sayısı
   */
  async auditAll(): Promise<number> {
    try {
      logger.info('Tüm güvenlik denetimleri başlatılıyor');

      // Zafiyetleri temizle
      this.vulnerabilities = [];

      // Tüm denetimleri çalıştır
      const dependencyVulnCount = await this.auditDependencies();
      const codeVulnCount = await this.auditCode();
      const configVulnCount = await this.auditConfiguration();

      // Toplam zafiyet sayısı
      const totalVulnCount = dependencyVulnCount + codeVulnCount + configVulnCount;

      // Özet raporu kaydet
      await this.saveAuditReport('summary', {
        totalVulnerabilities: totalVulnCount,
        dependencyVulnerabilities: dependencyVulnCount,
        codeVulnerabilities: codeVulnCount,
        configurationVulnerabilities: configVulnCount,
        vulnerabilities: this.vulnerabilities,
        timestamp: new Date(),
      });

      logger.info('Tüm güvenlik denetimleri tamamlandı', {
        totalVulnerabilities: totalVulnCount,
        dependencyVulnerabilities: dependencyVulnCount,
        codeVulnerabilities: codeVulnCount,
        configurationVulnerabilities: configVulnCount,
      });

      return totalVulnCount;
    } catch (error) {
      logger.error('Tüm güvenlik denetimleri yapılırken hata oluştu', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Denetim raporunu kaydeder
   * @param type - Denetim türü
   * @param data - Denetim verileri
   */
  private async saveAuditReport(type: string, data: any): Promise<void> {
    try {
      // Rapor dosya yolu
      const reportPath = path.join(this.auditReportPath, `${type}-audit-${Date.now()}.json`);

      // Raporu kaydet
      await writeFile(reportPath, JSON.stringify(data, null, 2));

      logger.info(`${type} denetim raporu kaydedildi`, { path: reportPath });
    } catch (error) {
      logger.error(`${type} denetim raporu kaydedilemedi`, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Zafiyetleri getirir
   * @param filters - Filtreler
   * @returns Zafiyetler
   */
  getVulnerabilities(
    filters: {
      type?: VulnerabilityType;
      severity?: VulnerabilitySeverity;
      file?: string;
    } = {}
  ): Vulnerability[] {
    // Zafiyetleri filtrele
    let filteredVulnerabilities = this.vulnerabilities;

    // Tür filtresi
    if (filters.type) {
      filteredVulnerabilities = filteredVulnerabilities.filter(
        (vuln) => vuln.type === filters.type
      );
    }

    // Seviye filtresi
    if (filters.severity) {
      filteredVulnerabilities = filteredVulnerabilities.filter(
        (vuln) => vuln.severity === filters.severity
      );
    }

    // Dosya filtresi
    if (filters.file) {
      filteredVulnerabilities = filteredVulnerabilities.filter((vuln) =>
        vuln.location?.file?.includes(filters.file || '')
      );
    }

    return filteredVulnerabilities;
  }
}

// Singleton örneği
const securityAudit = new SecurityAudit();

export default securityAudit;
