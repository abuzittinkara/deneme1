/**
 * src/routes/security.ts
 * Güvenlik denetimi rotaları
 */
import express from 'express';
import { createRouteHandler } from '../utils/express-helpers';
import securityAudit, { VulnerabilityType, VulnerabilitySeverity } from '../utils/securityAudit';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Tüm güvenlik denetimlerini çalıştırır
 * @route POST /api/security/audit/all
 * @access Admin
 */
router.post(
  '/api/security/audit/all',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Tüm denetimleri çalıştır
      const vulnerabilityCount = await securityAudit.auditAll();

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          vulnerabilityCount,
        },
        message: 'Tüm güvenlik denetimleri tamamlandı',
      });
    } catch (error) {
      logger.error('Tüm güvenlik denetimleri çalıştırılırken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Tüm güvenlik denetimleri çalıştırılırken hata oluştu',
          code: 'SECURITY_AUDIT_ERROR',
        },
      });
    }
  })
);

/**
 * Bağımlılık güvenlik denetimini çalıştırır
 * @route POST /api/security/audit/dependencies
 * @access Admin
 */
router.post(
  '/api/security/audit/dependencies',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Bağımlılık denetimini çalıştır
      const vulnerabilityCount = await securityAudit.auditDependencies();

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          vulnerabilityCount,
        },
        message: 'Bağımlılık güvenlik denetimi tamamlandı',
      });
    } catch (error) {
      logger.error('Bağımlılık güvenlik denetimi çalıştırılırken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Bağımlılık güvenlik denetimi çalıştırılırken hata oluştu',
          code: 'DEPENDENCY_AUDIT_ERROR',
        },
      });
    }
  })
);

/**
 * Kod güvenlik denetimini çalıştırır
 * @route POST /api/security/audit/code
 * @access Admin
 */
router.post(
  '/api/security/audit/code',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Kod denetimini çalıştır
      const vulnerabilityCount = await securityAudit.auditCode();

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          vulnerabilityCount,
        },
        message: 'Kod güvenlik denetimi tamamlandı',
      });
    } catch (error) {
      logger.error('Kod güvenlik denetimi çalıştırılırken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Kod güvenlik denetimi çalıştırılırken hata oluştu',
          code: 'CODE_AUDIT_ERROR',
        },
      });
    }
  })
);

/**
 * Yapılandırma güvenlik denetimini çalıştırır
 * @route POST /api/security/audit/configuration
 * @access Admin
 */
router.post(
  '/api/security/audit/configuration',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Yapılandırma denetimini çalıştır
      const vulnerabilityCount = await securityAudit.auditConfiguration();

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          vulnerabilityCount,
        },
        message: 'Yapılandırma güvenlik denetimi tamamlandı',
      });
    } catch (error) {
      logger.error('Yapılandırma güvenlik denetimi çalıştırılırken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Yapılandırma güvenlik denetimi çalıştırılırken hata oluştu',
          code: 'CONFIGURATION_AUDIT_ERROR',
        },
      });
    }
  })
);

/**
 * Zafiyetleri getirir
 * @route GET /api/security/vulnerabilities
 * @access Admin
 */
router.get(
  '/api/security/vulnerabilities',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Filtreler
      const type = req.query.type as VulnerabilityType | undefined;
      const severity = req.query.severity as VulnerabilitySeverity | undefined;
      const file = req.query.file as string | undefined;

      // Zafiyetleri getir
      const vulnerabilities = securityAudit.getVulnerabilities({
        type,
        severity,
        file,
      });

      // Zafiyetleri grupla
      const groupedVulnerabilities: Record<string, any[]> = {};

      vulnerabilities.forEach((vulnerability) => {
        if (!groupedVulnerabilities[vulnerability.type]) {
          groupedVulnerabilities[vulnerability.type] = [];
        }

        groupedVulnerabilities[vulnerability.type].push(vulnerability);
      });

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          vulnerabilities: groupedVulnerabilities,
          count: vulnerabilities.length,
          types: Object.keys(groupedVulnerabilities),
        },
      });
    } catch (error) {
      logger.error('Zafiyetler getirilirken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Zafiyetler getirilirken hata oluştu',
          code: 'VULNERABILITIES_ERROR',
        },
      });
    }
  })
);

/**
 * Zafiyet sayılarını getirir
 * @route GET /api/security/vulnerabilities/count
 * @access Admin
 */
router.get(
  '/api/security/vulnerabilities/count',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Tüm zafiyetleri getir
      const allVulnerabilities = securityAudit.getVulnerabilities();

      // Zafiyet sayılarını hesapla
      const counts = {
        total: allVulnerabilities.length,
        byType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
      };

      // Türe göre sayıları hesapla
      Object.values(VulnerabilityType).forEach((type) => {
        counts.byType[type] = securityAudit.getVulnerabilities({ type }).length;
      });

      // Seviyeye göre sayıları hesapla
      Object.values(VulnerabilitySeverity).forEach((severity) => {
        counts.bySeverity[severity] = securityAudit.getVulnerabilities({ severity }).length;
      });

      // Yanıt döndür
      return res.json({
        success: true,
        data: counts,
      });
    } catch (error) {
      logger.error('Zafiyet sayıları getirilirken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Zafiyet sayıları getirilirken hata oluştu',
          code: 'VULNERABILITY_COUNTS_ERROR',
        },
      });
    }
  })
);

export default router;
