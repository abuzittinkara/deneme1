/**
 * src/__tests__/globalSetup.ts
 * Jest global setup
 */

export default async (): Promise<void> => {
  console.log('Global setup başlatılıyor...');
  
  // Test veritabanı bağlantısı
  process.env.MONGODB_URI = 'mongodb://localhost:27017/fisqos_test';
  
  // Test JWT secret
  process.env.JWT_SECRET = 'test-jwt-secret';
  
  // Test portu
  process.env.PORT = '9093';
  
  // Test modunu ayarla
  process.env.NODE_ENV = 'test';
  
  console.log('Global setup tamamlandı.');
};
