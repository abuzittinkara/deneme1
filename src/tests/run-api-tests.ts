/**
 * src/tests/run-api-tests.ts
 * API endpoint'lerini test etmek için çalıştırma script'i
 */
import { ApiTester } from './api-tests';
import { logger } from '../utils/logger';

// Test edilecek API endpoint'leri
const API_ENDPOINTS = [
  { method: 'GET', endpoint: '/api/users' },
  { method: 'GET', endpoint: '/api/groups' },
  { method: 'GET', endpoint: '/api/channels' },
  { method: 'GET', endpoint: '/api/messages' },
  { method: 'GET', endpoint: '/api/direct-messages' },
  { method: 'GET', endpoint: '/api/notifications' },
  { method: 'GET', endpoint: '/api/friends' },
];

/**
 * API testlerini çalıştırır
 */
async function runApiTests() {
  try {
    logger.info('API testleri başlatılıyor...');

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3015';
    const tester = new ApiTester({
      baseUrl,
      verbose: true,
    });

    // Önce kimlik doğrulama testi yap
    const authResult = await tester.testEndpoint('POST', '/api/auth/login', {
      username: 'testuser',
      password: 'testpassword',
    });

    // Kimlik doğrulama başarılıysa token'ı al
    let token: string | undefined;
    if (authResult.success && authResult.data?.token) {
      token = authResult.data.token;
      logger.info('Kimlik doğrulama başarılı, token alındı');

      // Token'ı tester'a ekle
      tester['token'] = token;
    } else {
      logger.warn('Kimlik doğrulama başarısız, testler anonim olarak devam edecek');
    }

    // Tüm endpoint'leri test et
    for (const endpoint of API_ENDPOINTS) {
      await tester.testEndpoint(endpoint.method as any, endpoint.endpoint);
    }

    // Sonuçları logla
    tester.logResults();

    // Özeti göster
    const summary = tester.getSummary();
    logger.info('API Test Özeti', {
      total: summary.total,
      success: summary.success,
      failed: summary.failed,
      successRate: `${Math.round((summary.success / summary.total) * 100)}%`,
      averageResponseTime: `${Math.round(summary.averageResponseTime)}ms`,
    });

    return summary;
  } catch (error) {
    logger.error('API testleri çalıştırılırken hata oluştu', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}

// Script doğrudan çalıştırıldığında testleri başlat
if (require.main === module) {
  runApiTests()
    .then((summary) => {
      if (summary.failed > 0) {
        process.exit(1); // Başarısız testler varsa hata kodu ile çık
      } else {
        process.exit(0); // Tüm testler başarılıysa normal çık
      }
    })
    .catch(() => {
      process.exit(1); // Hata durumunda hata kodu ile çık
    });
}

export default runApiTests;
