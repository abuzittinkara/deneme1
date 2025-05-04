/**
 * src/utils/profiler.ts
 * Performans profilleme yardımcıları
 */
import { performance } from 'perf_hooks';
import { logger } from './logger';

/**
 * Performans ölçümü için zamanlayıcı
 */
export class Timer {
  private name: string;
  private startTime: number | null;
  private endTime: number | null;
  private duration: number | null;
  
  /**
   * Zamanlayıcı oluşturur
   * @param name - Zamanlayıcı adı
   */
  constructor(name: string) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
    this.duration = null;
  }
  
  /**
   * Zamanlayıcıyı başlatır
   * @returns Zamanlayıcı
   */
  start(): Timer {
    this.startTime = performance.now();
    return this;
  }
  
  /**
   * Zamanlayıcıyı durdurur
   * @returns Zamanlayıcı
   */
  stop(): Timer {
    if (this.startTime === null) {
      throw new Error('Timer must be started before stopping');
    }
    
    this.endTime = performance.now();
    this.duration = this.endTime - this.startTime;
    return this;
  }
  
  /**
   * Zamanlayıcı süresini döndürür
   * @returns Süre (milisaniye)
   */
  getDuration(): number {
    if (this.duration === null) {
      throw new Error('Timer must be stopped before getting duration');
    }
    
    return this.duration;
  }
  
  /**
   * Zamanlayıcı süresini günlüğe kaydeder
   * @param message - Ek mesaj
   * @returns Zamanlayıcı
   */
  log(message?: string): Timer {
    if (this.duration === null) {
      this.stop();
    }
    
    logger.info(`${message || this.name} - Süre: ${this.duration!.toFixed(2)} ms`);
    return this;
  }
}

// Fonksiyon tipi
type AnyFunction = (...args: any[]) => any;

/**
 * Performans profilleme için dekoratör
 * @param fn - Fonksiyon
 * @param name - Fonksiyon adı
 * @returns Profilleme yapan fonksiyon
 */
export function profileFunction<T extends AnyFunction>(fn: T, name?: string): T {
  const fnName = name || fn.name || 'Anonim Fonksiyon';
  
  return (async function(this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
    const timer = new Timer(fnName).start();
    
    try {
      const result = await fn.apply(this, args);
      timer.stop().log();
      return result;
    } catch (error) {
      timer.stop();
      logger.error(`${fnName} - Hata:`, { error: (error as Error).message, duration: timer.getDuration() });
      throw error;
    }
  }) as unknown as T;
}

/**
 * Bellek kullanımını ölçer
 * @returns Bellek kullanımı
 */
export function measureMemoryUsage(): Record<string, number> {
  const memoryUsage = process.memoryUsage();
  
  return {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };
}

/**
 * Bellek kullanımını günlüğe kaydeder
 * @param label - Etiket
 */
export function logMemoryUsage(label = 'Bellek Kullanımı'): void {
  const memory = measureMemoryUsage();
  
  logger.info(`${label}:`, {
    rss: `${memory.rss} MB`,
    heapTotal: `${memory.heapTotal} MB`,
    heapUsed: `${memory.heapUsed} MB`,
    external: `${memory.external} MB`
  });
}

/**
 * Performans profilleme için sınıf dekoratörü
 * @param target - Hedef sınıf
 */
export function profileClass<T extends { new (...args: any[]): any }>(target: T): T {
  // Sınıf adını al
  const className = target.name;
  
  // Prototip metodlarını al
  const prototype = target.prototype;
  const methodNames = Object.getOwnPropertyNames(prototype)
    .filter(name => name !== 'constructor' && typeof prototype[name] === 'function');
  
  // Her metodu profille
  for (const methodName of methodNames) {
    const originalMethod = prototype[methodName];
    
    prototype[methodName] = profileFunction(originalMethod, `${className}.${methodName}`);
  }
  
  return target;
}

/**
 * Performans profilleme için metod dekoratörü
 * @param target - Hedef nesne
 * @param propertyKey - Metod adı
 * @param descriptor - Metod tanımlayıcısı
 * @returns Yeni metod tanımlayıcısı
 */
export function profileMethod(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;
  
  descriptor.value = profileFunction(originalMethod, `${className}.${propertyKey}`);
  
  return descriptor;
}

/**
 * Performans profilleme için async metod dekoratörü
 * @param target - Hedef nesne
 * @param propertyKey - Metod adı
 * @param descriptor - Metod tanımlayıcısı
 * @returns Yeni metod tanımlayıcısı
 */
export function profileAsync(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;
  
  descriptor.value = async function(...args: any[]): Promise<any> {
    const timer = new Timer(`${className}.${propertyKey}`).start();
    
    try {
      const result = await originalMethod.apply(this, args);
      timer.stop().log();
      return result;
    } catch (error) {
      timer.stop();
      logger.error(`${className}.${propertyKey} - Hata:`, { error: (error as Error).message, duration: timer.getDuration() });
      throw error;
    }
  };
  
  return descriptor;
}

/**
 * Performans profilleme için fonksiyon çağrı sayısını ölçer
 */
export class FunctionCallCounter {
  private counts: Map<string, number>;
  
  constructor() {
    this.counts = new Map<string, number>();
  }
  
  /**
   * Fonksiyon çağrı sayısını artırır
   * @param name - Fonksiyon adı
   */
  increment(name: string): void {
    const count = this.counts.get(name) || 0;
    this.counts.set(name, count + 1);
  }
  
  /**
   * Fonksiyon çağrı sayısını döndürür
   * @param name - Fonksiyon adı
   * @returns Çağrı sayısı
   */
  getCount(name: string): number {
    return this.counts.get(name) || 0;
  }
  
  /**
   * Tüm fonksiyon çağrı sayılarını döndürür
   * @returns Çağrı sayıları
   */
  getAllCounts(): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [name, count] of this.counts.entries()) {
      result[name] = count;
    }
    
    return result;
  }
  
  /**
   * Fonksiyon çağrı sayılarını günlüğe kaydeder
   */
  log(): void {
    logger.info('Fonksiyon Çağrı Sayıları:', this.getAllCounts());
  }
  
  /**
   * Fonksiyon çağrı sayılarını sıfırlar
   */
  reset(): void {
    this.counts.clear();
  }
}

// Fonksiyon çağrı sayacı
export const functionCallCounter = new FunctionCallCounter();

/**
 * Fonksiyon çağrı sayısını ölçen dekoratör
 * @param fn - Fonksiyon
 * @param name - Fonksiyon adı
 * @returns Çağrı sayısını ölçen fonksiyon
 */
export function countFunctionCalls<T extends AnyFunction>(fn: T, name?: string): T {
  const fnName = name || fn.name || 'Anonim Fonksiyon';
  
  return (function(this: any, ...args: Parameters<T>): ReturnType<T> {
    functionCallCounter.increment(fnName);
    return fn.apply(this, args);
  }) as unknown as T;
}

// CPU kullanımı ölçüm sonucu arayüzü
export interface CpuUsageResult {
  user: string;
  system: string;
  total: string;
  elapsedMs: number;
}

/**
 * Darboğaz tespiti için CPU kullanımını ölçer
 * @param duration - Ölçüm süresi (milisaniye)
 * @returns CPU kullanımı
 */
export async function measureCpuUsage(duration = 5000): Promise<CpuUsageResult> {
  return new Promise(resolve => {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime.bigint();
    
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const endTime = process.hrtime.bigint();
      
      const elapsedMs = Number(endTime - startTime) / 1000000;
      
      const userPercent = (endUsage.user / 1000) / elapsedMs * 100;
      const systemPercent = (endUsage.system / 1000) / elapsedMs * 100;
      const totalPercent = userPercent + systemPercent;
      
      resolve({
        user: userPercent.toFixed(2),
        system: systemPercent.toFixed(2),
        total: totalPercent.toFixed(2),
        elapsedMs
      });
    }, duration);
  });
}

/**
 * CPU kullanımını günlüğe kaydeder
 * @param duration - Ölçüm süresi (milisaniye)
 * @param label - Etiket
 */
export async function logCpuUsage(duration = 5000, label = 'CPU Kullanımı'): Promise<void> {
  const cpuUsage = await measureCpuUsage(duration);
  
  logger.info(`${label}:`, {
    user: `${cpuUsage.user}%`,
    system: `${cpuUsage.system}%`,
    total: `${cpuUsage.total}%`,
    elapsedMs: cpuUsage.elapsedMs
  });
}

export default {
  Timer,
  profileFunction,
  measureMemoryUsage,
  logMemoryUsage,
  profileClass,
  profileMethod,
  profileAsync,
  functionCallCounter,
  countFunctionCalls,
  measureCpuUsage,
  logCpuUsage
};
