/**
 * src/__tests__/globalTeardown.ts
 * Jest global teardown
 */

export default async (): Promise<void> => {
  console.log('Global teardown başlatılıyor...');

  // Temizlik işlemleri
  try {
    // Tüm zamanlanmış görevleri temizle
    const timers = setTimeout(() => {}, 0) as unknown as number;
    for (let i = 0; i < timers; i++) {
      clearTimeout(i);
    }

    // Açık kalan bağlantıları kapat
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Tüm işlemlerin tamamlanması için bekle
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Zorla çıkış yap
    process.exit(0);
  } catch (error) {
    console.error('Global teardown hatası:', error);
    process.exit(1);
  }

  console.log('Global teardown tamamlandı.');
};
