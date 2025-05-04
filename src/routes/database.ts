/**
 * src/routes/database.ts
 * Veritabanı izleme ve yönetim rotaları
 */
import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { 
  getDatabaseStats, 
  startDatabaseMonitoring, 
  stopDatabaseMonitoring 
} from '../utils/db-monitor';
import { 
  connectToDatabase, 
  disconnectFromDatabase, 
  retryDatabaseConnection,
  checkDatabaseHealth
} from '../config/database';
import { env } from '../config/env';

// Router oluştur
const router = express.Router();

/**
 * Veritabanı istatistiklerini getirir
 */
router.get('/api/database/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Veritabanı istatistiklerini al
    const stats = await getDatabaseStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Veritabanı istatistikleri alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı istatistikleri alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    });
  }
});

/**
 * Veritabanı sağlık durumunu getirir
 */
router.get('/api/database/health', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Veritabanı sağlık durumunu al
    const health = await checkDatabaseHealth();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Veritabanı sağlık durumu alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı sağlık durumu alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    });
  }
});

/**
 * Veritabanı izlemeyi başlatır
 */
router.post('/api/database/start-monitoring', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    startDatabaseMonitoring();
    
    res.json({
      success: true,
      message: 'Veritabanı izleme başlatıldı'
    });
  } catch (error) {
    logger.error('Veritabanı izleme başlatılırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı izleme başlatılırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    });
  }
});

/**
 * Veritabanı izlemeyi durdurur
 */
router.post('/api/database/stop-monitoring', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    stopDatabaseMonitoring();
    
    res.json({
      success: true,
      message: 'Veritabanı izleme durduruldu'
    });
  } catch (error) {
    logger.error('Veritabanı izleme durdurulurken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı izleme durdurulurken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    });
  }
});

/**
 * Veritabanı bağlantısını yeniden dener
 */
router.post('/api/database/reconnect', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Veritabanı bağlantısını yeniden dene
    const success = await retryDatabaseConnection();
    
    if (success) {
      res.json({
        success: true,
        message: 'Veritabanı bağlantısı başarıyla yeniden kuruldu'
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Veritabanı bağlantısı yeniden kurulamadı',
          code: 'RECONNECT_FAILED'
        }
      });
    }
  } catch (error) {
    logger.error('Veritabanı bağlantısı yeniden denenirken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı bağlantısı yeniden denenirken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    });
  }
});

/**
 * Veritabanı bağlantısını kapatır (sadece geliştirme modunda)
 */
router.post('/api/database/disconnect', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Sadece geliştirme modunda çalışır
    if (!env.isDevelopment) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Bu endpoint sadece geliştirme modunda kullanılabilir',
          code: 'DEVELOPMENT_ONLY'
        }
      });
    }
    
    // Veritabanı bağlantısını kapat
    await disconnectFromDatabase();
    
    res.json({
      success: true,
      message: 'Veritabanı bağlantısı kapatıldı'
    });
  } catch (error) {
    logger.error('Veritabanı bağlantısı kapatılırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı bağlantısı kapatılırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    });
  }
});

/**
 * Veritabanı bağlantısını açar (sadece geliştirme modunda)
 */
router.post('/api/database/connect', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Sadece geliştirme modunda çalışır
    if (!env.isDevelopment) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Bu endpoint sadece geliştirme modunda kullanılabilir',
          code: 'DEVELOPMENT_ONLY'
        }
      });
    }
    
    // Veritabanı bağlantısını aç
    await connectToDatabase(true);
    
    res.json({
      success: true,
      message: 'Veritabanı bağlantısı açıldı'
    });
  } catch (error) {
    logger.error('Veritabanı bağlantısı açılırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı bağlantısı açılırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    });
  }
});

export default router;
