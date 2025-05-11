/**
 * scripts/test-api.js
 * API endpoint'lerini test etmek için script
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test edilecek API endpoint'leri
const API_ENDPOINTS = [
  { method: 'GET', endpoint: '/api/users' },
  { method: 'GET', endpoint: '/api/groups' },
  { method: 'GET', endpoint: '/api/channels' },
  { method: 'GET', endpoint: '/api/messages' },
  { method: 'GET', endpoint: '/api/direct-messages' },
  { method: 'GET', endpoint: '/api/notifications' },
  { method: 'GET', endpoint: '/api/friends' },
  { method: 'GET', endpoint: '/api/health' },
  { method: 'GET', endpoint: '/api/status' },
];

// Test sonuçları
const results = {
  total: 0,
  success: 0,
  failed: 0,
  endpoints: [],
};

/**
 * API endpoint'ini test eder
 * @param {string} method - HTTP metodu
 * @param {string} endpoint - API endpoint'i
 * @param {object} data - İstek verisi (opsiyonel)
 * @param {string} token - Kimlik doğrulama token'ı (opsiyonel)
 * @returns {Promise<object>} - Test sonucu
 */
async function testEndpoint(method, endpoint, data = null, token = null) {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3015';
  const url = `${baseUrl}${endpoint}`;
  const startTime = Date.now();

  try {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    switch (method) {
      case 'GET':
        response = await axios.get(url, { headers });
        break;
      case 'POST':
        response = await axios.post(url, data, { headers });
        break;
      case 'PUT':
        response = await axios.put(url, data, { headers });
        break;
      case 'DELETE':
        response = await axios.delete(url, { headers });
        break;
    }

    const responseTime = Date.now() - startTime;

    return {
      endpoint,
      method,
      status: response.status,
      success: true,
      responseTime,
      data: response.data,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      endpoint,
      method,
      status: error.response?.status || 0,
      success: false,
      responseTime,
      error: error.message,
      data: error.response?.data,
    };
  }
}

/**
 * API testlerini çalıştırır
 */
async function runTests() {
  console.log('API testleri başlatılıyor...');

  // Kimlik doğrulama testi
  let token = null;
  const authResult = await testEndpoint('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  });

  results.endpoints.push(authResult);
  results.total++;

  if (authResult.success) {
    results.success++;
    console.log('✅ Kimlik doğrulama başarılı');
    token = authResult.data.token;
  } else {
    results.failed++;
    console.log('❌ Kimlik doğrulama başarısız:', authResult.error);
  }

  // Diğer endpoint'leri test et
  for (const endpoint of API_ENDPOINTS) {
    console.log(`${endpoint.method} ${endpoint.endpoint} testi yapılıyor...`);
    const result = await testEndpoint(endpoint.method, endpoint.endpoint, null, token);

    results.endpoints.push(result);
    results.total++;

    if (result.success) {
      results.success++;
      console.log(`✅ ${endpoint.method} ${endpoint.endpoint} - ${result.status} (${result.responseTime}ms)`);
    } else {
      results.failed++;
      console.log(`❌ ${endpoint.method} ${endpoint.endpoint} - ${result.status} (${result.responseTime}ms): ${result.error}`);
    }
  }

  // Sonuçları göster
  console.log('\nAPI Test Sonuçları:');
  console.log(`Toplam: ${results.total}`);
  console.log(`Başarılı: ${results.success}`);
  console.log(`Başarısız: ${results.failed}`);
  console.log(`Başarı Oranı: ${Math.round((results.success / results.total) * 100)}%`);

  // Sonuçları dosyaya kaydet
  const resultsDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsFile = path.join(resultsDir, `api-test-results-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  console.log(`\nSonuçlar kaydedildi: ${resultsFile}`);

  return results;
}

// Script doğrudan çalıştırıldığında testleri başlat
if (require.main === module) {
  runTests()
    .then(results => {
      if (results.failed > 0) {
        process.exit(1); // Başarısız testler varsa hata kodu ile çık
      } else {
        process.exit(0); // Tüm testler başarılıysa normal çık
      }
    })
    .catch(error => {
      console.error('Test çalıştırma hatası:', error);
      process.exit(1);
    });
}

module.exports = { runTests, testEndpoint };
