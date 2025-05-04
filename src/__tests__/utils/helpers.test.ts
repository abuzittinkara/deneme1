/**
 * src/__tests__/utils/helpers.test.ts
 * Yardımcı fonksiyonlar için testler
 */
import { 
  generateRandomString, 
  slugify, 
  formatDate, 
  truncateText, 
  isValidEmail, 
  isValidUsername 
} from '../../utils/helpers';

describe('Helpers', () => {
  describe('generateRandomString', () => {
    it('should generate a random string of specified length', () => {
      const length = 10;
      const randomString = generateRandomString(length);
      
      expect(randomString).toBeDefined();
      expect(typeof randomString).toBe('string');
      expect(randomString.length).toBe(length);
    });
    
    it('should generate different strings on multiple calls', () => {
      const length = 10;
      const randomString1 = generateRandomString(length);
      const randomString2 = generateRandomString(length);
      
      expect(randomString1).not.toBe(randomString2);
    });
  });
  
  describe('slugify', () => {
    it('should convert a string to a slug', () => {
      const input = 'Hello World! This is a test.';
      const expected = 'hello-world-this-is-a-test';
      
      expect(slugify(input)).toBe(expected);
    });
    
    it('should handle special characters and multiple spaces', () => {
      const input = 'Özel  Karakterler  &  Boşluklar';
      const expected = 'ozel-karakterler-bosluklar';
      
      expect(slugify(input)).toBe(expected);
    });
    
    it('should return empty string for empty input', () => {
      expect(slugify('')).toBe('');
    });
  });
  
  describe('formatDate', () => {
    it('should format a date correctly', () => {
      const date = new Date('2023-01-15T12:30:45');
      const formatted = formatDate(date);
      
      // Format depends on the implementation, but should be a string
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
    
    it('should handle current date when no date is provided', () => {
      const formatted = formatDate();
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
  
  describe('truncateText', () => {
    it('should truncate text to specified length with ellipsis', () => {
      const text = 'This is a long text that needs to be truncated';
      const maxLength = 20;
      const expected = 'This is a long text...';
      
      expect(truncateText(text, maxLength)).toBe(expected);
    });
    
    it('should not truncate text shorter than maxLength', () => {
      const text = 'Short text';
      const maxLength = 20;
      
      expect(truncateText(text, maxLength)).toBe(text);
    });
    
    it('should handle empty text', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });
  
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });
    
    it('should return false for invalid emails', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
    });
  });
  
  describe('isValidUsername', () => {
    it('should return true for valid usernames', () => {
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('user_name')).toBe(true);
    });
    
    it('should return false for invalid usernames', () => {
      expect(isValidUsername('us')).toBe(false); // Too short
      expect(isValidUsername('user name')).toBe(false); // Contains space
      expect(isValidUsername('user@name')).toBe(false); // Contains special character
      expect(isValidUsername('a'.repeat(21))).toBe(false); // Too long
    });
  });
});
