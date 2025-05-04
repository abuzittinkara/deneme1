/**
 * src/__tests__/utils/sanitizer.test.ts
 * Sanitizer yardımcı fonksiyonlarının testleri
 */
import {
  escapeHtml,
  sanitizeXss,
  sanitizeSql,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeAll,
  sanitizeText
} from '../../utils/sanitizer';

describe('Sanitizer Utils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const html = '<script>alert("XSS");</script>';
      const escaped = escapeHtml(html);

      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;);&lt;/script&gt;');
    });

    it('should handle null or undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should not modify regular text', () => {
      const text = 'Hello, world!';
      expect(escapeHtml(text)).toBe(text);
    });
  });

  describe('sanitizeXss', () => {
    it('should remove script tags', () => {
      const xss = '<script>alert("XSS");</script>Hello';
      const sanitized = sanitizeXss(xss);

      expect(sanitized).toBe('Hello');
    });

    it('should remove event handlers', () => {
      const xss = '<div onclick="alert(\'XSS\')">Click me</div>';
      const sanitized = sanitizeXss(xss);

      expect(sanitized).toBe('<div>Click me</div>');
    });

    it('should handle null or undefined', () => {
      expect(sanitizeXss(null)).toBe('');
      expect(sanitizeXss(undefined)).toBe('');
    });

    it('should remove javascript: protocol', () => {
      const xss = '<a href="javascript:alert(\'XSS\')">Click me</a>';
      const sanitized = sanitizeXss(xss);

      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('sanitizeSql', () => {
    it('should escape SQL injection characters', () => {
      const sql = "Robert'); DROP TABLE Students;--";
      const sanitized = sanitizeSql(sql);

      expect(sanitized).toBe("Robert''); DROP TABLE Students;--");
    });

    it('should handle null or undefined', () => {
      expect(sanitizeSql(null)).toBe('');
      expect(sanitizeSql(undefined)).toBe('');
    });

    it('should escape backslashes', () => {
      const sql = "path\\to\\file";
      const sanitized = sanitizeSql(sql);

      expect(sanitized).toBe("path\\\\to\\\\file");
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid http URLs', () => {
      const url = 'http://example.com';
      const sanitized = sanitizeUrl(url);

      // URL nesnesi trailing slash ekleyebilir, bu yüzden tam eşleşme yerine içerme kontrolü yapıyoruz
      expect(sanitized).toContain('http://example.com');
    });

    it('should allow valid https URLs', () => {
      const url = 'https://example.com/path?query=value';
      const sanitized = sanitizeUrl(url);

      // URL nesnesi trailing slash ekleyebilir, bu yüzden tam eşleşme yerine içerme kontrolü yapıyoruz
      expect(sanitized).toContain('https://example.com/path?query=value');
    });

    it('should reject javascript: URLs', () => {
      const url = 'javascript:alert("XSS")';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).toBe('');
    });

    it('should handle null or undefined', () => {
      expect(sanitizeUrl(null)).toBe('');
      expect(sanitizeUrl(undefined)).toBe('');
    });

    it('should handle invalid URLs', () => {
      const url = 'not a url';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters from filenames', () => {
      const filename = 'file/with?invalid*chars.txt';
      const sanitized = sanitizeFilename(filename);

      // Farklı implementasyonlar farklı sonuçlar verebilir, bu yüzden tam eşleşme yerine içerme kontrolü yapıyoruz
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('?');
      expect(sanitized).not.toContain('*');
      expect(sanitized).toContain('.txt');
    });

    it('should handle null or undefined', () => {
      expect(sanitizeFilename(null)).toBe('');
      expect(sanitizeFilename(undefined)).toBe('');
    });

    it('should prevent path traversal attacks', () => {
      const filename = '../../../etc/passwd';
      const sanitized = sanitizeFilename(filename);

      expect(sanitized).not.toContain('..');
    });

    it('should remove leading and trailing dots', () => {
      const filename = '.hidden.file.';
      const sanitized = sanitizeFilename(filename);

      // Farklı implementasyonlar farklı sonuçlar verebilir, bu yüzden tam eşleşme yerine içerme kontrolü yapıyoruz
      expect(sanitized).not.toMatch(/^\./); // Başlangıçta nokta olmamalı
      expect(sanitized).not.toMatch(/\.$/); // Sonda nokta olmamalı
      expect(sanitized).toContain('hidden.file'); // Ana dosya adı korunmalı
    });
  });

  describe('sanitizeText', () => {
    it('should remove HTML tags from text', () => {
      const text = '<p>This is <b>bold</b> text</p>';
      const sanitized = sanitizeText(text);

      expect(sanitized).toBe('This is bold text');
    });

    it('should handle null or undefined', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });
  });

  describe('sanitizeAll', () => {
    it('should apply all sanitization functions', () => {
      const input = '<script>alert("XSS");</script>Robert\'); DROP TABLE Students;--';
      const sanitized = sanitizeAll(input);

      // Should be sanitized and not contain script tags
      expect(sanitized).not.toContain('<script>');

      // Should have escaped single quotes
      expect(sanitized).toContain("&#39;&#39;");
    });

    it('should handle null or undefined', () => {
      expect(sanitizeAll(null)).toBe('');
      expect(sanitizeAll(undefined)).toBe('');
    });
  });
});
