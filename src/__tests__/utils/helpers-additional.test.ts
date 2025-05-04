/**
 * src/__tests__/utils/helpers-additional.test.ts
 * Ek yardımcı fonksiyonlar için testler
 */
import { 
  uniqueArray,
  filterObject,
  excludeFields,
  timeAgo,
  escapeHtml,
  formatNumber,
  formatFileSize,
  toUpperCaseTr,
  toLowerCaseTr,
  capitalizeFirstLetter,
  capitalizeWords,
  generateRandomId,
  caesarCipher,
  caesarDecipher,
  padString,
  maskString,
  maskEmail,
  maskPhone,
  truncateHtml,
  splitText,
  joinArray,
  splitUnique,
  splitNumbers,
  splitBooleans,
  splitDates,
  splitJson
} from '../../utils/helpers';

describe('Additional Helpers', () => {
  describe('uniqueArray', () => {
    it('should return an array with unique values', () => {
      const array = [1, 2, 3, 1, 2, 3, 4, 5];
      const result = uniqueArray(array);
      
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });
    
    it('should handle empty arrays', () => {
      expect(uniqueArray([])).toEqual([]);
    });
    
    it('should handle arrays with objects', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const array = [obj1, obj2, obj1];
      
      expect(uniqueArray(array)).toEqual([obj1, obj2]);
    });
  });
  
  describe('filterObject', () => {
    it('should filter object by specified fields', () => {
      const obj = { name: 'John', age: 30, email: 'john@example.com' };
      const fields = ['name', 'email'];
      
      expect(filterObject(obj, fields)).toEqual({ name: 'John', email: 'john@example.com' });
    });
    
    it('should handle non-existent fields', () => {
      const obj = { name: 'John', age: 30 };
      const fields = ['name', 'email'];
      
      expect(filterObject(obj, fields)).toEqual({ name: 'John' });
    });
    
    it('should handle empty objects', () => {
      expect(filterObject({}, ['name'])).toEqual({});
    });
  });
  
  describe('excludeFields', () => {
    it('should exclude specified fields from object', () => {
      const obj = { name: 'John', age: 30, email: 'john@example.com' };
      const excludeFields = ['age'];
      
      expect(excludeFields(obj, excludeFields)).toEqual({ name: 'John', email: 'john@example.com' });
    });
    
    it('should handle non-existent fields', () => {
      const obj = { name: 'John', age: 30 };
      const fields = ['email'];
      
      expect(excludeFields(obj, fields)).toEqual({ name: 'John', age: 30 });
    });
    
    it('should handle empty objects', () => {
      expect(excludeFields({}, ['name'])).toEqual({});
    });
  });
  
  describe('timeAgo', () => {
    it('should format time correctly', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      expect(timeAgo(fiveMinutesAgo)).toContain('dakika önce');
    });
    
    it('should handle null or undefined', () => {
      expect(timeAgo(null)).toBe('');
      expect(timeAgo(undefined)).toBe('');
    });
  });
  
  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const html = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(html);
      
      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
    
    it('should handle null or undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });
  
  describe('formatNumber', () => {
    it('should format numbers correctly', () => {
      expect(formatNumber(1234.56, 2, ',', '.')).toBe('1.234,56');
      expect(formatNumber(1234, 0)).toBe('1.234');
    });
    
    it('should handle null or undefined', () => {
      expect(formatNumber(null)).toBe('');
      expect(formatNumber(undefined)).toBe('');
    });
  });
  
  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
    
    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bayt');
    });
  });
  
  describe('toUpperCaseTr and toLowerCaseTr', () => {
    it('should handle Turkish characters correctly', () => {
      expect(toUpperCaseTr('ıiğüşöç')).toBe('IİĞÜŞÖÇ');
      expect(toLowerCaseTr('IİĞÜŞÖÇ')).toBe('ıiğüşöç');
    });
    
    it('should handle null or undefined', () => {
      expect(toUpperCaseTr(null)).toBe('');
      expect(toLowerCaseTr(undefined)).toBe('');
    });
  });
  
  describe('capitalizeFirstLetter and capitalizeWords', () => {
    it('should capitalize first letter correctly', () => {
      expect(capitalizeFirstLetter('hello world')).toBe('Hello world');
    });
    
    it('should capitalize all words correctly', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
    });
    
    it('should handle null or undefined', () => {
      expect(capitalizeFirstLetter(null)).toBe('');
      expect(capitalizeWords(undefined)).toBe('');
    });
  });
  
  describe('generateRandomId', () => {
    it('should generate random IDs of specified length', () => {
      const id1 = generateRandomId(10);
      const id2 = generateRandomId(10);
      
      expect(id1.length).toBe(10);
      expect(id2.length).toBe(10);
      expect(id1).not.toBe(id2);
    });
  });
  
  describe('caesarCipher and caesarDecipher', () => {
    it('should encrypt and decrypt text correctly', () => {
      const text = 'Hello World';
      const encrypted = caesarCipher(text, 3);
      const decrypted = caesarDecipher(encrypted, 3);
      
      expect(encrypted).not.toBe(text);
      expect(decrypted).toBe(text);
    });
    
    it('should handle null or undefined', () => {
      expect(caesarCipher(null)).toBe('');
      expect(caesarDecipher(undefined)).toBe('');
    });
  });
  
  describe('padString', () => {
    it('should pad strings correctly', () => {
      expect(padString('123', 5, '0')).toBe('00123');
      expect(padString('123', 5, '0', true)).toBe('12300');
    });
    
    it('should handle null or undefined', () => {
      expect(padString(null, 5, '0')).toBe('00000');
      expect(padString(undefined, 5, '0')).toBe('00000');
    });
  });
  
  describe('maskString, maskEmail, and maskPhone', () => {
    it('should mask strings correctly', () => {
      expect(maskString('1234567890', 4)).toBe('******7890');
    });
    
    it('should mask emails correctly', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j*****e@example.com');
    });
    
    it('should mask phone numbers correctly', () => {
      expect(maskPhone('+90 555 123 4567')).toBe('**********4567');
    });
    
    it('should handle null or undefined', () => {
      expect(maskString(null)).toBe('');
      expect(maskEmail(undefined)).toBe('');
      expect(maskPhone(null)).toBe('');
    });
  });
  
  describe('truncateHtml', () => {
    it('should truncate HTML correctly', () => {
      const html = '<p>This is a <strong>test</strong> paragraph.</p>';
      expect(truncateHtml(html, 10)).toBe('This is a ...');
    });
    
    it('should handle null or undefined', () => {
      expect(truncateHtml(null, 10)).toBe('');
      expect(truncateHtml(undefined, 10)).toBe('');
    });
  });
  
  describe('splitText and joinArray', () => {
    it('should split text correctly', () => {
      expect(splitText('a,b,c')).toEqual(['a', 'b', 'c']);
    });
    
    it('should join arrays correctly', () => {
      expect(joinArray(['a', 'b', 'c'])).toBe('a, b, c');
    });
    
    it('should handle null or undefined', () => {
      expect(splitText(null)).toEqual([]);
      expect(joinArray(null)).toBe('');
    });
  });
  
  describe('splitUnique, splitNumbers, splitBooleans, and splitDates', () => {
    it('should split and return unique values', () => {
      expect(splitUnique('a,b,a,c')).toEqual(['a', 'b', 'c']);
    });
    
    it('should split and return numbers', () => {
      expect(splitNumbers('1,2,3,abc')).toEqual([1, 2, 3]);
    });
    
    it('should split and return booleans', () => {
      expect(splitBooleans('true,false,1,0,yes,no')).toEqual([true, false, true, false, true, false]);
    });
    
    it('should split and return dates', () => {
      const result = splitDates('2023-01-01,2023-02-01,invalid');
      expect(result.length).toBe(2);
      expect(result[0].getFullYear()).toBe(2023);
      expect(result[0].getMonth()).toBe(0); // January is 0
      expect(result[1].getMonth()).toBe(1); // February is 1
    });
    
    it('should handle null or undefined', () => {
      expect(splitUnique(null)).toEqual([]);
      expect(splitNumbers(undefined)).toEqual([]);
      expect(splitBooleans(null)).toEqual([]);
      expect(splitDates(undefined)).toEqual([]);
    });
  });
  
  describe('splitJson', () => {
    it('should split and parse JSON correctly', () => {
      const jsonString = '{"id":1,"name":"John"},{"id":2,"name":"Jane"}';
      const result = splitJson(jsonString);
      
      expect(result.length).toBe(2);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('John');
      expect(result[1].id).toBe(2);
      expect(result[1].name).toBe('Jane');
    });
    
    it('should handle invalid JSON', () => {
      const jsonString = '{"id":1,"name":"John"},{invalid}';
      const result = splitJson(jsonString);
      
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('John');
    });
    
    it('should handle null or undefined', () => {
      expect(splitJson(null)).toEqual([]);
      expect(splitJson(undefined)).toEqual([]);
    });
  });
});
