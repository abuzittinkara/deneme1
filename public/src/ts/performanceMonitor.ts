/**
 * public/src/ts/performanceMonitor.ts
 * İstemci tarafı performans izleme için TypeScript modülü
 */

// Performans ölçüm arayüzü
export interface PerformanceMeasurement {
  name: string;
  startTime: number;
  duration: number;
  type: 'network' | 'render' | 'script' | 'resource' | 'custom';
  metadata?: Record<string, any>;
}

// Performans izleyici arayüzü
export interface PerformanceMonitor {
  startMeasurement(name: string, type: PerformanceMeasurement['type'], metadata?: Record<string, any>): void;
  endMeasurement(name: string): PerformanceMeasurement | null;
  getMeasurements(): PerformanceMeasurement[];
  clearMeasurements(): void;
  monitorNetworkRequests(): void;
  monitorResourceLoading(): void;
  monitorFrameRate(): void;
  stopMonitoring(): void;
  init(): void;
}

// Performans izleyici sınıfı
class PerformanceMonitorImpl implements PerformanceMonitor {
  private measurements: Map<string, PerformanceMeasurement> = new Map();
  private activeMeasurements: Map<string, { startTime: number, type: PerformanceMeasurement['type'], metadata?: Record<string, any> }> = new Map();
  private isMonitoring: boolean = false;
  private frameRateInterval: number | null = null;
  private networkRequestsOriginal: { fetch: typeof fetch, xhr: typeof XMLHttpRequest.prototype.open } | null = null;

  /**
   * Performans ölçümünü başlatır
   * @param name - Ölçüm adı
   * @param type - Ölçüm türü
   * @param metadata - Ek meta veriler
   */
  public startMeasurement(name: string, type: PerformanceMeasurement['type'], metadata?: Record<string, any>): void {
    this.activeMeasurements.set(name, {
      startTime: performance.now(),
      type,
      metadata
    });
  }

  /**
   * Performans ölçümünü bitirir
   * @param name - Ölçüm adı
   * @returns Ölçüm sonucu veya null
   */
  public endMeasurement(name: string): PerformanceMeasurement | null {
    const activeMeasurement = this.activeMeasurements.get(name);
    
    if (!activeMeasurement) {
      console.warn(`Ölçüm bulunamadı: ${name}`);
      return null;
    }
    
    const endTime = performance.now();
    const measurement: PerformanceMeasurement = {
      name,
      startTime: activeMeasurement.startTime,
      duration: endTime - activeMeasurement.startTime,
      type: activeMeasurement.type,
      metadata: activeMeasurement.metadata
    };
    
    this.measurements.set(name, measurement);
    this.activeMeasurements.delete(name);
    
    // Yavaş işlemleri logla
    if (measurement.duration > 100) {
      console.warn(`Yavaş işlem tespit edildi: ${name} (${measurement.duration.toFixed(2)}ms)`);
    }
    
    return measurement;
  }

  /**
   * Tüm ölçümleri döndürür
   * @returns Ölçüm listesi
   */
  public getMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Tüm ölçümleri temizler
   */
  public clearMeasurements(): void {
    this.measurements.clear();
    this.activeMeasurements.clear();
  }

  /**
   * Ağ isteklerini izler
   */
  public monitorNetworkRequests(): void {
    if (this.isMonitoring || !window.fetch) return;
    
    // Orijinal fetch ve XHR metodlarını sakla
    this.networkRequestsOriginal = {
      fetch: window.fetch,
      xhr: XMLHttpRequest.prototype.open
    };
    
    // Fetch API'yi izle
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const requestId = `fetch-${url}-${Date.now()}`;
      
      this.startMeasurement(requestId, 'network', { url, method: init?.method || 'GET' });
      
      try {
        const response = await this.networkRequestsOriginal!.fetch.call(window, input, init);
        this.endMeasurement(requestId);
        return response;
      } catch (error) {
        this.endMeasurement(requestId);
        throw error;
      }
    };
    
    // XMLHttpRequest'i izle
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) {
      const requestId = `xhr-${url}-${Date.now()}`;
      
      this.addEventListener('loadstart', () => {
        performanceMonitor.startMeasurement(requestId, 'network', { url, method });
      });
      
      this.addEventListener('loadend', () => {
        performanceMonitor.endMeasurement(requestId);
      });
      
      return performanceMonitor.networkRequestsOriginal!.xhr.call(this, method, url, async, username, password);
    };
    
    this.isMonitoring = true;
  }

  /**
   * Kaynak yüklemelerini izler
   */
  public monitorResourceLoading(): void {
    if (!window.performance || !window.performance.getEntriesByType) return;
    
    // PerformanceObserver API'sini kullan
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            
            // Büyük kaynakları tespit et
            if (resourceEntry.transferSize > 500000) { // 500KB
              console.warn(`Büyük kaynak tespit edildi: ${resourceEntry.name} (${(resourceEntry.transferSize / 1024).toFixed(2)}KB)`);
            }
            
            // Yavaş kaynakları tespit et
            if (resourceEntry.duration > 1000) { // 1 saniye
              console.warn(`Yavaş kaynak yüklemesi tespit edildi: ${resourceEntry.name} (${resourceEntry.duration.toFixed(2)}ms)`);
            }
            
            this.measurements.set(`resource-${resourceEntry.name}-${Date.now()}`, {
              name: resourceEntry.name,
              startTime: resourceEntry.startTime,
              duration: resourceEntry.duration,
              type: 'resource',
              metadata: {
                transferSize: resourceEntry.transferSize,
                encodedBodySize: resourceEntry.encodedBodySize,
                decodedBodySize: resourceEntry.decodedBodySize,
                initiatorType: resourceEntry.initiatorType
              }
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
    }
  }

  /**
   * Kare hızını izler
   */
  public monitorFrameRate(): void {
    if (this.frameRateInterval !== null) return;
    
    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;
    
    const calculateFPS = () => {
      const currentTime = performance.now();
      frames++;
      
      if (currentTime - lastTime >= 1000) {
        fps = Math.round((frames * 1000) / (currentTime - lastTime));
        
        // Düşük kare hızını tespit et
        if (fps < 30) {
          console.warn(`Düşük kare hızı tespit edildi: ${fps} FPS`);
        }
        
        frames = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(calculateFPS);
    };
    
    requestAnimationFrame(calculateFPS);
    
    // Her 5 saniyede bir FPS ölçümlerini kaydet
    this.frameRateInterval = window.setInterval(() => {
      this.measurements.set(`fps-${Date.now()}`, {
        name: 'Frame Rate',
        startTime: performance.now(),
        duration: 0,
        type: 'render',
        metadata: { fps }
      });
    }, 5000);
  }

  /**
   * İzlemeyi durdurur
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    // Fetch ve XHR metodlarını geri yükle
    if (this.networkRequestsOriginal) {
      window.fetch = this.networkRequestsOriginal.fetch;
      XMLHttpRequest.prototype.open = this.networkRequestsOriginal.xhr;
      this.networkRequestsOriginal = null;
    }
    
    // Kare hızı izlemeyi durdur
    if (this.frameRateInterval !== null) {
      window.clearInterval(this.frameRateInterval);
      this.frameRateInterval = null;
    }
    
    this.isMonitoring = false;
  }

  /**
   * Performans izleyiciyi başlatır
   */
  public init(): void {
    // Ağ isteklerini izle
    this.monitorNetworkRequests();
    
    // Kaynak yüklemelerini izle
    this.monitorResourceLoading();
    
    // Kare hızını izle
    this.monitorFrameRate();
    
    console.log('Performans izleyici başlatıldı');
  }
}

// Performans izleyici örneğini oluştur
export const performanceMonitor: PerformanceMonitor = new PerformanceMonitorImpl();

// Performans izleyiciyi dışa aktar
export default performanceMonitor;
