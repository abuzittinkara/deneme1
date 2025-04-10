/**************************************
 * utils/profiler.js
 * Performans profilleme yardımcıları
 **************************************/
const { performance } = require('perf_hooks');
const { logger } = require('./logger');

/**
 * Performans ölçümü için zamanlayıcı
 */
class Timer {
  /**
   * Zamanlayıcı oluşturur
   * @param {string} name - Zamanlayıcı adı
   */
  constructor(name) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
    this.duration = null;
  }
  
  /**
   * Zamanlayıcıyı başlatır
   * @returns {Timer} - Zamanlayıcı
   */
  start() {
    this.startTime = performance.now();
    return this;
  }
  
  /**
   * Zamanlayıcıyı durdurur
   * @returns {Timer} - Zamanlayıcı
   */
  stop() {
    this.endTime = performance.now();
    this.duration = this.endTime - this.startTime;
    return this;
  }
  
  /**
   * Zamanlayıcı süresini döndürür
   * @returns {number} - Süre (milisaniye)
   */
  getDuration() {
    return this.duration;
  }
  
  /**
   * Zamanlayıcı süresini günlüğe kaydeder
   * @param {string} [message] - Ek mesaj
   * @returns {Timer} - Zamanlayıcı
   */
  log(message) {
    if (!this.duration) {
      this.stop();
    }
    
    logger.info(`${message || this.name} - Süre: ${this.duration.toFixed(2)} ms`);
    return this;
  }
}

/**
 * Performans profilleme için dekoratör
 * @param {Function} fn - Fonksiyon
 * @param {string} [name] - Fonksiyon adı
 * @returns {Function} - Profilleme yapan fonksiyon
 */
function profileFunction(fn, name) {
  const fnName = name || fn.name || 'Anonim Fonksiyon';
  
  return async function(...args) {
    const timer = new Timer(fnName).start();
    
    try {
      const result = await fn.apply(this, args);
      timer.stop().log();
      return result;
    } catch (error) {
      timer.stop();
      logger.error(`${fnName} - Hata:`, { error: error.message, duration: timer.getDuration() });
      throw error;
    }
  };
}

/**
 * Bellek kullanımını ölçer
 * @returns {Object} - Bellek kullanımı
 */
function measureMemoryUsage() {
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
 * @param {string} [label='Bellek Kullanımı'] - Etiket
 */
function logMemoryUsage(label = 'Bellek Kullanımı') {
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
 * @param {Object} target - Hedef sınıf
 */
function profileClass(target) {
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
 * @param {Object} target - Hedef nesne
 * @param {string} propertyKey - Metod adı
 * @param {Object} descriptor - Metod tanımlayıcısı
 * @returns {Object} - Yeni metod tanımlayıcısı
 */
function profileMethod(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;
  
  descriptor.value = profileFunction(originalMethod, `${className}.${propertyKey}`);
  
  return descriptor;
}

/**
 * Performans profilleme için async metod dekoratörü
 * @param {Object} target - Hedef nesne
 * @param {string} propertyKey - Metod adı
 * @param {Object} descriptor - Metod tanımlayıcısı
 * @returns {Object} - Yeni metod tanımlayıcısı
 */
function profileAsync(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;
  
  descriptor.value = async function(...args) {
    const timer = new Timer(`${className}.${propertyKey}`).start();
    
    try {
      const result = await originalMethod.apply(this, args);
      timer.stop().log();
      return result;
    } catch (error) {
      timer.stop();
      logger.error(`${className}.${propertyKey} - Hata:`, { error: error.message, duration: timer.getDuration() });
      throw error;
    }
  };
  
  return descriptor;
}

/**
 * Performans profilleme için fonksiyon çağrı sayısını ölçer
 */
class FunctionCallCounter {
  constructor() {
    this.counts = new Map();
  }
  
  /**
   * Fonksiyon çağrı sayısını artırır
   * @param {string} name - Fonksiyon adı
   */
  increment(name) {
    const count = this.counts.get(name) || 0;
    this.counts.set(name, count + 1);
  }
  
  /**
   * Fonksiyon çağrı sayısını döndürür
   * @param {string} name - Fonksiyon adı
   * @returns {number} - Çağrı sayısı
   */
  getCount(name) {
    return this.counts.get(name) || 0;
  }
  
  /**
   * Tüm fonksiyon çağrı sayılarını döndürür
   * @returns {Object} - Çağrı sayıları
   */
  getAllCounts() {
    const result = {};
    
    for (const [name, count] of this.counts.entries()) {
      result[name] = count;
    }
    
    return result;
  }
  
  /**
   * Fonksiyon çağrı sayılarını günlüğe kaydeder
   */
  log() {
    logger.info('Fonksiyon Çağrı Sayıları:', this.getAllCounts());
  }
  
  /**
   * Fonksiyon çağrı sayılarını sıfırlar
   */
  reset() {
    this.counts.clear();
  }
}

// Fonksiyon çağrı sayacı
const functionCallCounter = new FunctionCallCounter();

/**
 * Fonksiyon çağrı sayısını ölçen dekoratör
 * @param {Function} fn - Fonksiyon
 * @param {string} [name] - Fonksiyon adı
 * @returns {Function} - Çağrı sayısını ölçen fonksiyon
 */
function countFunctionCalls(fn, name) {
  const fnName = name || fn.name || 'Anonim Fonksiyon';
  
  return async function(...args) {
    functionCallCounter.increment(fnName);
    return fn.apply(this, args);
  };
}

/**
 * Darboğaz tespiti için CPU kullanımını ölçer
 * @param {number} [duration=5000] - Ölçüm süresi (milisaniye)
 * @returns {Promise<Object>} - CPU kullanımı
 */
async function measureCpuUsage(duration = 5000) {
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
 * @param {number} [duration=5000] - Ölçüm süresi (milisaniye)
 * @param {string} [label='CPU Kullanımı'] - Etiket
 */
async function logCpuUsage(duration = 5000, label = 'CPU Kullanımı') {
  const cpuUsage = await measureCpuUsage(duration);
  
  logger.info(`${label}:`, {
    user: `${cpuUsage.user}%`,
    system: `${cpuUsage.system}%`,
    total: `${cpuUsage.total}%`,
    elapsedMs: cpuUsage.elapsedMs
  });
}

module.exports = {
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
