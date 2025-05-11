/**
 * src/routes/profiling.ts
 * Profilleme rotaları
 */
import express from 'express';
import { createRouteHandler } from '../utils/express-helpers';
import profilingService, { ProfileType } from '../services/profilingService';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = express.Router();

/**
 * CPU profili başlatır
 * @route POST /api/profiling/cpu/start
 * @access Admin
 */
router.post(
  '/api/profiling/cpu/start',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil seçenekleri
      const options = {
        name: req.body.name,
        duration: req.body.duration ? parseInt(req.body.duration) : undefined,
        savePath: req.body.savePath,
      };

      // CPU profilini başlat
      const profileName = await profilingService.startCPUProfiling(options);

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          name: profileName,
          type: ProfileType.CPU,
          startTime: Date.now(),
          duration: options.duration,
        },
        message: 'CPU profili başlatıldı',
      });
    } catch (error) {
      logger.error('CPU profili başlatılırken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'CPU profili başlatılırken hata oluştu',
          code: 'CPU_PROFILING_START_ERROR',
        },
      });
    }
  })
);

/**
 * CPU profilini durdurur
 * @route POST /api/profiling/cpu/stop
 * @access Admin
 */
router.post(
  '/api/profiling/cpu/stop',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil adı ve kayıt yolu
      const name = req.body.name;
      const savePath = req.body.savePath;

      // CPU profilini durdur
      const profilePath = await profilingService.stopCPUProfiling(name, savePath);

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          path: profilePath,
          type: ProfileType.CPU,
          stopTime: Date.now(),
        },
        message: 'CPU profili durduruldu ve kaydedildi',
      });
    } catch (error) {
      logger.error('CPU profili durdurulurken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'CPU profili durdurulurken hata oluştu',
          code: 'CPU_PROFILING_STOP_ERROR',
        },
      });
    }
  })
);

/**
 * Heap profili başlatır
 * @route POST /api/profiling/heap/start
 * @access Admin
 */
router.post(
  '/api/profiling/heap/start',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil seçenekleri
      const options = {
        name: req.body.name,
        duration: req.body.duration ? parseInt(req.body.duration) : undefined,
        savePath: req.body.savePath,
      };

      // Heap profilini başlat
      const profileName = await profilingService.startHeapProfiling(options);

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          name: profileName,
          type: ProfileType.HEAP,
          startTime: Date.now(),
          duration: options.duration,
        },
        message: 'Heap profili başlatıldı',
      });
    } catch (error) {
      logger.error('Heap profili başlatılırken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Heap profili başlatılırken hata oluştu',
          code: 'HEAP_PROFILING_START_ERROR',
        },
      });
    }
  })
);

/**
 * Heap profilini durdurur
 * @route POST /api/profiling/heap/stop
 * @access Admin
 */
router.post(
  '/api/profiling/heap/stop',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil adı ve kayıt yolu
      const name = req.body.name;
      const savePath = req.body.savePath;

      // Heap profilini durdur
      const profilePath = await profilingService.stopHeapProfiling(name, savePath);

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          path: profilePath,
          type: ProfileType.HEAP,
          stopTime: Date.now(),
        },
        message: 'Heap profili durduruldu ve kaydedildi',
      });
    } catch (error) {
      logger.error('Heap profili durdurulurken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Heap profili durdurulurken hata oluştu',
          code: 'HEAP_PROFILING_STOP_ERROR',
        },
      });
    }
  })
);

/**
 * Heap anlık görüntüsü alır
 * @route POST /api/profiling/heap-snapshot
 * @access Admin
 */
router.post(
  '/api/profiling/heap-snapshot',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil seçenekleri
      const options = {
        name: req.body.name,
        savePath: req.body.savePath,
      };

      // Heap anlık görüntüsü al
      const snapshotPath = await profilingService.takeHeapSnapshot(options);

      // Yanıt döndür
      return res.json({
        success: true,
        data: {
          path: snapshotPath,
          type: ProfileType.HEAP_SNAPSHOT,
          time: Date.now(),
        },
        message: 'Heap anlık görüntüsü alındı ve kaydedildi',
      });
    } catch (error) {
      logger.error('Heap anlık görüntüsü alınırken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Heap anlık görüntüsü alınırken hata oluştu',
          code: 'HEAP_SNAPSHOT_ERROR',
        },
      });
    }
  })
);

/**
 * Profil listelerini getirir
 * @route GET /api/profiling/profiles
 * @access Admin
 */
router.get(
  '/api/profiling/profiles',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil listelerini getir
      const profiles = profilingService.getProfiles();

      // Yanıt döndür
      return res.json({
        success: true,
        data: profiles,
      });
    } catch (error) {
      logger.error('Profil listeleri getirilirken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Profil listeleri getirilirken hata oluştu',
          code: 'PROFILES_LIST_ERROR',
        },
      });
    }
  })
);

/**
 * Profil dosyasını siler
 * @route DELETE /api/profiling/profiles/:path
 * @access Admin
 */
router.delete(
  '/api/profiling/profiles/:path',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil dosya yolu
      const profilePath = req.params.path;

      // Profil dosyasını sil
      const success = await profilingService.deleteProfile(profilePath);

      // Yanıt döndür
      if (success) {
        return res.json({
          success: true,
          message: 'Profil dosyası silindi',
        });
      } else {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Profil dosyası bulunamadı veya silinemedi',
            code: 'PROFILE_DELETE_ERROR',
          },
        });
      }
    } catch (error) {
      logger.error('Profil dosyası silinirken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Profil dosyası silinirken hata oluştu',
          code: 'PROFILE_DELETE_ERROR',
        },
      });
    }
  })
);

/**
 * Tüm profil dosyalarını siler
 * @route DELETE /api/profiling/profiles
 * @access Admin
 */
router.delete(
  '/api/profiling/profiles',
  // authMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  // adminMiddleware, // Geliştirme amaçlı olarak kaldırıldı
  createRouteHandler(async (req, res) => {
    try {
      // Profil türü
      const type = req.query.type as ProfileType | undefined;

      // Tüm profil dosyalarını sil
      const success = await profilingService.deleteAllProfiles(type);

      // Yanıt döndür
      if (success) {
        return res.json({
          success: true,
          message: `Tüm ${type || ''} profil dosyaları silindi`,
        });
      } else {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Profil dosyaları silinirken hata oluştu',
            code: 'PROFILES_DELETE_ERROR',
          },
        });
      }
    } catch (error) {
      logger.error('Tüm profil dosyaları silinirken hata oluştu', {
        error: (error as Error).message,
      });

      return res.status(500).json({
        success: false,
        error: {
          message: 'Tüm profil dosyaları silinirken hata oluştu',
          code: 'PROFILES_DELETE_ERROR',
        },
      });
    }
  })
);

export default router;
