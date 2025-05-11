/**
 * src/tests/api-tests.ts
 * API endpoint'lerini test etmek için basit bir test aracı
 */
import axios, { AxiosResponse, AxiosError } from 'axios';
import { logger } from '../utils/logger';

// Test sonucu arayüzü
interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  responseTime: number;
  error?: string;
  data?: any;
}

// Test yapılandırması arayüzü
interface TestConfig {
  baseUrl: string;
  token?: string;
  verbose?: boolean;
}

/**
 * API endpoint'lerini test eder
 */
export class ApiTester {
  private baseUrl: string;
  private token?: string;
  private verbose: boolean;
  private results: TestResult[] = [];

  /**
   * ApiTester constructor
   * @param config - Test yapılandırması
   */
  constructor(config: TestConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.verbose = config.verbose || false;
  }

  /**
   * Bir endpoint'i test eder
   * @param method - HTTP metodu
   * @param endpoint - API endpoint'i
   * @param data - İstek verisi (opsiyonel)
   * @returns Test sonucu
   */
  async testEndpoint(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<TestResult> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();
    let result: TestResult = {
      endpoint,
      method,
      status: 0,
      success: false,
      responseTime: 0,
    };

    try {
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      let response: AxiosResponse;
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
      result = {
        endpoint,
        method,
        status: response.status,
        success: response.status >= 200 && response.status < 300,
        responseTime,
        data: response.data,
      };

      if (this.verbose) {
        logger.info(`API Test: ${method} ${endpoint}`, {
          status: response.status,
          responseTime: `${responseTime}ms`,
          success: result.success,
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const axiosError = error as AxiosError;

      result = {
        endpoint,
        method,
        status: axiosError.response?.status || 0,
        success: false,
        responseTime,
        error: axiosError.message,
        data: axiosError.response?.data,
      };

      if (this.verbose) {
        logger.error(`API Test Error: ${method} ${endpoint}`, {
          status: result.status,
          responseTime: `${responseTime}ms`,
          error: result.error,
        });
      }
    }

    this.results.push(result);
    return result;
  }

  /**
   * Tüm test sonuçlarını getirir
   * @returns Test sonuçları
   */
  getResults(): TestResult[] {
    return this.results;
  }

  /**
   * Test sonuçlarını özetler
   * @returns Test özeti
   */
  getSummary(): {
    total: number;
    success: number;
    failed: number;
    averageResponseTime: number;
  } {
    const total = this.results.length;
    const success = this.results.filter((r) => r.success).length;
    const failed = total - success;
    const totalResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0);
    const averageResponseTime = total > 0 ? totalResponseTime / total : 0;

    return {
      total,
      success,
      failed,
      averageResponseTime,
    };
  }

  /**
   * Test sonuçlarını loglar
   */
  logResults(): void {
    const summary = this.getSummary();
    logger.info('API Test Sonuçları', {
      total: summary.total,
      success: summary.success,
      failed: summary.failed,
      averageResponseTime: `${Math.round(summary.averageResponseTime)}ms`,
    });

    // Başarısız testleri logla
    const failedTests = this.results.filter((r) => !r.success);
    if (failedTests.length > 0) {
      logger.warn('Başarısız API Testleri', {
        count: failedTests.length,
        tests: failedTests.map((t) => ({
          endpoint: t.endpoint,
          method: t.method,
          status: t.status,
          error: t.error,
        })),
      });
    }
  }
}

export default ApiTester;
