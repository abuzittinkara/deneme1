/**
 * src/config/environment.ts
 * Çevre değişkenleri yardımcıları
 */

/**
 * Geliştirme ortamında mı?
 * @returns Geliştirme ortamında ise true, değilse false
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Test ortamında mı?
 * @returns Test ortamında ise true, değilse false
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Üretim ortamında mı?
 * @returns Üretim ortamında ise true, değilse false
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Ortam değişkenini alır
 * @param key - Ortam değişkeni anahtarı
 * @param defaultValue - Varsayılan değer
 * @returns Ortam değişkeni değeri veya varsayılan değer
 */
export function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Ortam değişkenini sayı olarak alır
 * @param key - Ortam değişkeni anahtarı
 * @param defaultValue - Varsayılan değer
 * @returns Ortam değişkeni değeri veya varsayılan değer
 */
export function getEnvNumber(key: string, defaultValue: number = 0): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Ortam değişkenini boolean olarak alır
 * @param key - Ortam değişkeni anahtarı
 * @param defaultValue - Varsayılan değer
 * @returns Ortam değişkeni değeri veya varsayılan değer
 */
export function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  return value.toLowerCase() === 'true';
}

/**
 * Ortam değişkenini dizi olarak alır
 * @param key - Ortam değişkeni anahtarı
 * @param separator - Ayırıcı
 * @param defaultValue - Varsayılan değer
 * @returns Ortam değişkeni değeri veya varsayılan değer
 */
export function getEnvArray(key: string, separator: string = ',', defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  return value.split(separator).map(item => item.trim());
}
