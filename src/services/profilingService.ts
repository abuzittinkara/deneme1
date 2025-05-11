/**
 * src/services/profilingService.ts
 * Profilleme servisi
 */
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';

// v8-profiler-next modülünü isteğe bağlı olarak yükle
let v8Profiler: any = null;
try {
  v8Profiler = require('v8-profiler-next');
} catch (error) {
  logger.warn('v8-profiler-next modülü yüklenemedi, profilleme işlevleri devre dışı', {
    error: (error as Error).message,
  });
}

// Dosya işlemleri için promisify
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

// Profil türleri
export enum ProfileType {
  CPU = 'cpu',
  HEAP = 'heap',
  HEAP_SNAPSHOT = 'heap-snapshot',
}

// Profil seçenekleri
export interface ProfileOptions {
  duration?: number; // CPU profili için süre (ms)
  name?: string; // Profil adı
  savePath?: string; // Kayıt yolu
}

/**
 * Profilleme servisi
 */
class ProfilingService {
  private isProfilingCPU: boolean = false;
  private isProfilingHeap: boolean = false;
  private profilesDir: string;
  private cpuProfiles: string[] = [];
  private heapProfiles: string[] = [];
  private heapSnapshots: string[] = [];

  constructor() {
    // Profil dizini
    this.profilesDir = path.join(process.cwd(), 'profiles');

    // Profil dizinini oluştur
    this.ensureProfilesDir();
  }

  /**
   * Profil dizininin varlığını kontrol eder ve yoksa oluşturur
   */
  private async ensureProfilesDir(): Promise<void> {
    try {
      // Dizinin varlığını kontrol et
      await access(this.profilesDir, fs.constants.F_OK);
    } catch (error) {
      // Dizin yoksa oluştur
      try {
        await mkdir(this.profilesDir, { recursive: true });
        logger.info('Profil dizini oluşturuldu', { dir: this.profilesDir });
      } catch (error) {
        logger.error('Profil dizini oluşturulamadı', {
          error: (error as Error).message,
          dir: this.profilesDir,
        });
      }
    }
  }

  /**
   * CPU profili başlatır
   * @param options - Profil seçenekleri
   * @returns Profil adı
   */
  async startCPUProfiling(options: ProfileOptions = {}): Promise<string> {
    if (!v8Profiler) {
      throw new Error('v8-profiler-next modülü yüklenemedi, CPU profilleme devre dışı');
    }

    if (this.isProfilingCPU) {
      throw new Error('CPU profili zaten çalışıyor');
    }

    try {
      // Profil adı
      const name = options.name || `cpu-profile-${Date.now()}`;

      // CPU profilini başlat
      v8Profiler.startProfiling(name, true);
      this.isProfilingCPU = true;

      logger.info('CPU profili başlatıldı', { name });

      // Belirli bir süre sonra otomatik olarak durdur
      if (options.duration) {
        setTimeout(() => {
          this.stopCPUProfiling(name, options.savePath)
            .then((profilePath) => {
              logger.info('CPU profili otomatik olarak durduruldu', {
                name,
                duration: options.duration,
                path: profilePath,
              });
            })
            .catch((error) => {
              logger.error('CPU profili durdurulurken hata oluştu', {
                error: error.message,
                name,
              });
            });
        }, options.duration);
      }

      return name;
    } catch (error) {
      logger.error('CPU profili başlatılırken hata oluştu', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * CPU profilini durdurur
   * @param name - Profil adı
   * @param savePath - Kayıt yolu
   * @returns Profil dosya yolu
   */
  async stopCPUProfiling(name?: string, savePath?: string): Promise<string> {
    if (!v8Profiler) {
      throw new Error('v8-profiler-next modülü yüklenemedi, CPU profilleme devre dışı');
    }

    if (!this.isProfilingCPU) {
      throw new Error('CPU profili çalışmıyor');
    }

    try {
      // Profil adı
      const profileName = name || `cpu-profile-${Date.now()}`;

      // CPU profilini durdur
      const profile = v8Profiler.stopProfiling(profileName);
      this.isProfilingCPU = false;

      // Profil dosya yolu
      const profilePath = savePath || path.join(this.profilesDir, `${profileName}.cpuprofile`);

      // Profili JSON olarak dışa aktar
      const profileJSON = JSON.stringify(profile);

      // Profili dosyaya kaydet
      await writeFile(profilePath, profileJSON);

      // Profil belleğini temizle
      profile.delete();

      // Profil listesine ekle
      this.cpuProfiles.push(profilePath);

      logger.info('CPU profili durduruldu ve kaydedildi', {
        name: profileName,
        path: profilePath,
      });

      return profilePath;
    } catch (error) {
      logger.error('CPU profili durdurulurken hata oluştu', {
        error: (error as Error).message,
      });
      this.isProfilingCPU = false;
      throw error;
    }
  }

  /**
   * Heap profili başlatır
   * @param options - Profil seçenekleri
   * @returns Profil adı
   */
  async startHeapProfiling(options: ProfileOptions = {}): Promise<string> {
    if (!v8Profiler) {
      throw new Error('v8-profiler-next modülü yüklenemedi, Heap profilleme devre dışı');
    }

    if (this.isProfilingHeap) {
      throw new Error('Heap profili zaten çalışıyor');
    }

    try {
      // Profil adı
      const name = options.name || `heap-profile-${Date.now()}`;

      // Heap profilini başlat
      v8Profiler.startSamplingHeapProfiling();
      this.isProfilingHeap = true;

      logger.info('Heap profili başlatıldı', { name });

      // Belirli bir süre sonra otomatik olarak durdur
      if (options.duration) {
        setTimeout(() => {
          this.stopHeapProfiling(name, options.savePath)
            .then((profilePath) => {
              logger.info('Heap profili otomatik olarak durduruldu', {
                name,
                duration: options.duration,
                path: profilePath,
              });
            })
            .catch((error) => {
              logger.error('Heap profili durdurulurken hata oluştu', {
                error: error.message,
                name,
              });
            });
        }, options.duration);
      }

      return name;
    } catch (error) {
      logger.error('Heap profili başlatılırken hata oluştu', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Heap profilini durdurur
   * @param name - Profil adı
   * @param savePath - Kayıt yolu
   * @returns Profil dosya yolu
   */
  async stopHeapProfiling(name?: string, savePath?: string): Promise<string> {
    if (!v8Profiler) {
      throw new Error('v8-profiler-next modülü yüklenemedi, Heap profilleme devre dışı');
    }

    if (!this.isProfilingHeap) {
      throw new Error('Heap profili çalışmıyor');
    }

    try {
      // Profil adı
      const profileName = name || `heap-profile-${Date.now()}`;

      // Heap profilini durdur
      const profile = v8Profiler.stopSamplingHeapProfiling();
      this.isProfilingHeap = false;

      // Profil dosya yolu
      const profilePath = savePath || path.join(this.profilesDir, `${profileName}.heapprofile`);

      // Profili JSON olarak dışa aktar
      const profileJSON = JSON.stringify(profile);

      // Profili dosyaya kaydet
      await writeFile(profilePath, profileJSON);

      // Profil listesine ekle
      this.heapProfiles.push(profilePath);

      logger.info('Heap profili durduruldu ve kaydedildi', {
        name: profileName,
        path: profilePath,
      });

      return profilePath;
    } catch (error) {
      logger.error('Heap profili durdurulurken hata oluştu', {
        error: (error as Error).message,
      });
      this.isProfilingHeap = false;
      throw error;
    }
  }

  /**
   * Heap anlık görüntüsü alır
   * @param options - Profil seçenekleri
   * @returns Profil dosya yolu
   */
  async takeHeapSnapshot(options: ProfileOptions = {}): Promise<string> {
    if (!v8Profiler) {
      throw new Error('v8-profiler-next modülü yüklenemedi, Heap anlık görüntüsü devre dışı');
    }

    try {
      // Profil adı
      const name = options.name || `heap-snapshot-${Date.now()}`;

      // Heap anlık görüntüsü al
      const snapshot = v8Profiler.takeSnapshot(name);

      // Profil dosya yolu
      const snapshotPath = options.savePath || path.join(this.profilesDir, `${name}.heapsnapshot`);

      // Anlık görüntüyü dosyaya kaydet
      await new Promise<void>((resolve, reject) => {
        const fileStream = fs.createWriteStream(snapshotPath);

        // Hata durumunda
        fileStream.on('error', (error) => {
          reject(error);
        });

        // Tamamlandığında
        fileStream.on('finish', () => {
          resolve();
        });

        // Anlık görüntüyü dışa aktar
        snapshot
          .export()
          .pipe(fileStream)
          .on('error', (error) => {
            reject(error);
          });
      });

      // Anlık görüntü belleğini temizle
      snapshot.delete();

      // Anlık görüntü listesine ekle
      this.heapSnapshots.push(snapshotPath);

      logger.info('Heap anlık görüntüsü alındı ve kaydedildi', {
        name,
        path: snapshotPath,
      });

      return snapshotPath;
    } catch (error) {
      logger.error('Heap anlık görüntüsü alınırken hata oluştu', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Profil listelerini getirir
   * @returns Profil listeleri
   */
  getProfiles(): {
    cpu: string[];
    heap: string[];
    heapSnapshots: string[];
  } {
    return {
      cpu: this.cpuProfiles,
      heap: this.heapProfiles,
      heapSnapshots: this.heapSnapshots,
    };
  }

  /**
   * Profil dosyasını siler
   * @param profilePath - Profil dosya yolu
   * @returns Başarılı mı
   */
  async deleteProfile(profilePath: string): Promise<boolean> {
    try {
      // Dosyanın varlığını kontrol et
      await access(profilePath, fs.constants.F_OK);

      // Dosyayı sil
      await promisify(fs.unlink)(profilePath);

      // Profil listelerinden kaldır
      this.cpuProfiles = this.cpuProfiles.filter((p) => p !== profilePath);
      this.heapProfiles = this.heapProfiles.filter((p) => p !== profilePath);
      this.heapSnapshots = this.heapSnapshots.filter((p) => p !== profilePath);

      logger.info('Profil dosyası silindi', { path: profilePath });

      return true;
    } catch (error) {
      logger.error('Profil dosyası silinirken hata oluştu', {
        error: (error as Error).message,
        path: profilePath,
      });
      return false;
    }
  }

  /**
   * Tüm profil dosyalarını siler
   * @param type - Profil türü (opsiyonel)
   * @returns Başarılı mı
   */
  async deleteAllProfiles(type?: ProfileType): Promise<boolean> {
    try {
      // Silinecek profil listeleri
      const profilesToDelete: string[] = [];

      // Profil türüne göre listeleri belirle
      if (!type || type === ProfileType.CPU) {
        profilesToDelete.push(...this.cpuProfiles);
        this.cpuProfiles = [];
      }

      if (!type || type === ProfileType.HEAP) {
        profilesToDelete.push(...this.heapProfiles);
        this.heapProfiles = [];
      }

      if (!type || type === ProfileType.HEAP_SNAPSHOT) {
        profilesToDelete.push(...this.heapSnapshots);
        this.heapSnapshots = [];
      }

      // Profil dosyalarını sil
      for (const profilePath of profilesToDelete) {
        try {
          await promisify(fs.unlink)(profilePath);
        } catch (error) {
          logger.warn('Profil dosyası silinirken hata oluştu', {
            error: (error as Error).message,
            path: profilePath,
          });
        }
      }

      logger.info('Tüm profil dosyaları silindi', {
        type: type || 'all',
        count: profilesToDelete.length,
      });

      return true;
    } catch (error) {
      logger.error('Tüm profil dosyaları silinirken hata oluştu', {
        error: (error as Error).message,
        type: type || 'all',
      });
      return false;
    }
  }
}

// Singleton örneği
const profilingService = new ProfilingService();

export default profilingService;
