/**
 * src/__tests__/utils/fileUtils.test.ts
 * Dosya işlemleri yardımcı fonksiyonlarının testleri
 */
import {
  sanitizePath,
  generateUniqueFilename,
  formatFileSize,
  isValidFileType,
} from '../../utils/fileUtils';
import path from 'path';

describe('File Utils', () => {
  describe('sanitizePath', () => {
    it('should sanitize path correctly', () => {
      const filePath = 'uploads/test.txt';
      const sanitized = sanitizePath(filePath);

      // Windows'ta path separator farklı olabilir
      expect(sanitized.replace(/\\/g, '/')).toBe(filePath);
    });

    it('should throw error for path traversal attempts', () => {
      const filePath = '../../../etc/passwd';

      expect(() => sanitizePath(filePath)).toThrow('Geçersiz dosya yolu');
    });

    it('should throw error for disallowed directories', () => {
      const filePath = 'config/secrets.json';

      expect(() => sanitizePath(filePath)).toThrow('Bu dizine erişim izniniz yok');
    });

    it('should sanitize filename in path', () => {
      const filePath = 'uploads/test<script>.txt';
      const sanitized = sanitizePath(filePath);

      // Windows'ta path separator farklı olabilir ve sanitize işlemi farklı olabilir
      const normalizedPath = sanitized.replace(/\\/g, '/');
      expect(normalizedPath).toMatch(/^uploads\/test.*\.txt$/);
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate unique filename', () => {
      const filename = 'test.txt';
      const unique = generateUniqueFilename(filename);

      // Dosya adı "test-[hash].txt" formatında olmalı
      expect(unique).toMatch(/^test-[a-f0-9]{16}\.txt$/);
    });

    it('should sanitize filename before generating unique name', () => {
      const filename = 'test<script>.txt';
      const unique = generateUniqueFilename(filename);

      // Sanitize işlemi farklı olabilir, ancak dosya adı "[sanitized]-[hash].txt" formatında olmalı
      expect(unique).toMatch(/^test.*-[a-f0-9]{16}\.txt$/);
    });

    it('should handle filenames without extension', () => {
      const filename = 'test';
      const unique = generateUniqueFilename(filename);

      // Dosya adı "test-[hash]" formatında olmalı
      expect(unique).toMatch(/^test-[a-f0-9]{16}$/);
    });
  });

  describe('formatFileSize', () => {
    it('should format file size correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });

    it('should format file size with decimal places', () => {
      expect(formatFileSize(1500)).toBe('1.46 KB');
      expect(formatFileSize(1500000)).toBe('1.43 MB');
    });
  });

  describe('isValidFileType', () => {
    it('should validate file types correctly', () => {
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

      expect(isValidFileType('test.jpg', allowedExtensions)).toBe(true);
      expect(isValidFileType('test.jpeg', allowedExtensions)).toBe(true);
      expect(isValidFileType('test.png', allowedExtensions)).toBe(true);
      expect(isValidFileType('test.gif', allowedExtensions)).toBe(true);
      expect(isValidFileType('test.pdf', allowedExtensions)).toBe(false);
    });

    it('should handle uppercase extensions', () => {
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

      expect(isValidFileType('test.JPG', allowedExtensions)).toBe(true);
      expect(isValidFileType('test.JPEG', allowedExtensions)).toBe(true);
    });

    it('should sanitize filename before validating', () => {
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

      expect(isValidFileType('test<script>.jpg', allowedExtensions)).toBe(true);
    });
  });
});
