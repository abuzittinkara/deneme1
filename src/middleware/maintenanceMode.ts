/**
 * src/middleware/maintenanceMode.ts
 * Bakım modu middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { logger } from '../utils/logger';

// Bakım modu durumu
let maintenanceMode = false;
let maintenanceEndTime: Date | null = null;
let maintenanceMessage =
  'Şu anda sistemimizde bakım çalışması yapılmaktadır. Kısa süre içinde hizmetinize devam edeceğiz.';

/**
 * Bakım modu middleware'i
 * @param options Bakım modu seçenekleri
 * @returns Express middleware
 */
export function maintenanceModeMiddleware(
  options: {
    allowedIPs?: string[];
    allowedPaths?: string[];
  } = {}
) {
  const { allowedIPs = [], allowedPaths = ['/api/health', '/api/health/detailed'] } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Bakım modunda değilse devam et
    if (!maintenanceMode) {
      return next();
    }

    // İzin verilen IP'ler için devam et
    if (req.ip && allowedIPs.includes(req.ip)) {
      return next();
    }

    // İzin verilen yollar için devam et
    if (allowedPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // API istekleri için JSON yanıtı
    if (req.path.startsWith('/api')) {
      return res.status(503).json({
        success: false,
        error: {
          message: maintenanceMessage,
          statusCode: 503,
          maintenanceEndTime: maintenanceEndTime?.toISOString(),
        },
      });
    }

    // Web istekleri için bakım sayfası
    const maintenanceEndTimeStr = maintenanceEndTime
      ? formatRemainingTime(maintenanceEndTime)
      : '30 dakika';

    res.status(503).sendFile(path.join(process.cwd(), 'public', 'maintenance.html'), {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  };
}

/**
 * Bakım modunu etkinleştirir
 * @param durationMinutes Bakım süresi (dakika)
 * @param message Bakım mesajı
 */
export function enableMaintenanceMode(durationMinutes = 30, message?: string): void {
  maintenanceMode = true;
  maintenanceEndTime = new Date(Date.now() + durationMinutes * 60 * 1000);

  if (message) {
    maintenanceMessage = message;
  }

  logger.info('Bakım modu etkinleştirildi', {
    durationMinutes,
    endTime: maintenanceEndTime.toISOString(),
    message: maintenanceMessage,
  });
}

/**
 * Bakım modunu devre dışı bırakır
 */
export function disableMaintenanceMode(): void {
  maintenanceMode = false;
  maintenanceEndTime = null;

  logger.info('Bakım modu devre dışı bırakıldı');
}

/**
 * Bakım modu durumunu döndürür
 * @returns Bakım modu durumu
 */
export function getMaintenanceStatus(): {
  enabled: boolean;
  endTime: Date | null;
  message: string;
} {
  return {
    enabled: maintenanceMode,
    endTime: maintenanceEndTime,
    message: maintenanceMessage,
  };
}

/**
 * Kalan süreyi formatlar
 * @param endTime Bitiş zamanı
 * @returns Formatlanmış kalan süre
 */
function formatRemainingTime(endTime: Date): string {
  const remainingMs = endTime.getTime() - Date.now();

  if (remainingMs <= 0) {
    return 'Çok yakında';
  }

  const minutes = Math.floor(remainingMs / (1000 * 60));

  if (minutes < 1) {
    return 'Çok yakında';
  } else if (minutes < 60) {
    return `${minutes} dakika`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} saat`;
    } else {
      return `${hours} saat ${remainingMinutes} dakika`;
    }
  }
}

export default {
  maintenanceModeMiddleware,
  enableMaintenanceMode,
  disableMaintenanceMode,
  getMaintenanceStatus,
};
