/**
 * tests/unit/utils/validation.test.ts
 * Doğrulama yardımcıları için birim testleri
 */
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateGroupName,
  validateChannelName,
  sanitizeInput
} from '../../../src/utils/validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
      expect(validateEmail('user-name@domain.com')).toBe(true);
      expect(validateEmail('user123@domain.co')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('test')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@example')).toBe(false);
      expect(validateEmail('test@.com')).toBe(false);
      expect(validateEmail('test@example..com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(validatePassword('Password123!')).toBe(true);
      expect(validatePassword('StrongP@ss123')).toBe(true);
      expect(validatePassword('P@ssw0rd')).toBe(true);
      expect(validatePassword('Complex!Password123')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('pass')).toBe(false); // Too short
      expect(validatePassword('password')).toBe(false); // No uppercase, no number
      expect(validatePassword('PASSWORD')).toBe(false); // No lowercase, no number
      expect(validatePassword('Password')).toBe(false); // No number
      expect(validatePassword('password123')).toBe(false); // No uppercase
      expect(validatePassword('PASSWORD123')).toBe(false); // No lowercase
    });
  });

  describe('validateUsername', () => {
    it('should validate valid usernames', () => {
      expect(validateUsername('user123')).toBe(true);
      expect(validateUsername('user_name')).toBe(true);
      expect(validateUsername('user-name')).toBe(true);
      expect(validateUsername('user.name')).toBe(true);
      expect(validateUsername('u')).toBe(true); // Minimum length is 1
    });

    it('should reject invalid usernames', () => {
      expect(validateUsername('')).toBe(false); // Empty
      expect(validateUsername('user name')).toBe(false); // Contains space
      expect(validateUsername('user@name')).toBe(false); // Contains special character
      expect(validateUsername('user!name')).toBe(false); // Contains special character
      // Test for username that's too long (>30 characters)
      expect(validateUsername('abcdefghijklmnopqrstuvwxyz12345')).toBe(false);
    });
  });

  describe('validateGroupName', () => {
    it('should validate valid group names', () => {
      expect(validateGroupName('Group Name')).toBe(true);
      expect(validateGroupName('Group-Name')).toBe(true);
      expect(validateGroupName('Group_Name')).toBe(true);
      expect(validateGroupName('Group123')).toBe(true);
      expect(validateGroupName('G')).toBe(true); // Minimum length is 1
    });

    it('should reject invalid group names', () => {
      expect(validateGroupName('')).toBe(false); // Empty
      expect(validateGroupName('Group@Name')).toBe(false); // Contains special character
      expect(validateGroupName('Group!Name')).toBe(false); // Contains special character
      // Test for group name that's too long (>50 characters)
      expect(validateGroupName('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz')).toBe(false);
    });
  });

  describe('validateChannelName', () => {
    it('should validate valid channel names', () => {
      expect(validateChannelName('channel-name')).toBe(true);
      expect(validateChannelName('channel_name')).toBe(true);
      expect(validateChannelName('channel123')).toBe(true);
      expect(validateChannelName('c')).toBe(true); // Minimum length is 1
    });

    it('should reject invalid channel names', () => {
      expect(validateChannelName('')).toBe(false); // Empty
      expect(validateChannelName('channel name')).toBe(false); // Contains space
      expect(validateChannelName('channel@name')).toBe(false); // Contains special character
      expect(validateChannelName('channel!name')).toBe(false); // Contains special character
      // Test for channel name that's too long (>30 characters)
      expect(validateChannelName('abcdefghijklmnopqrstuvwxyz12345')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML in input strings', () => {
      expect(sanitizeInput('<script>alert("XSS")</script>')).toBe('');
      expect(sanitizeInput('<img src="x" onerror="alert(\'XSS\')">')).toBe('<img src="x" />');
      expect(sanitizeInput('<a href="javascript:alert(\'XSS\')">Click me</a>')).toBe('<a>Click me</a>');
      expect(sanitizeInput('<p>Normal text</p>')).toBe('<p>Normal text</p>');
      expect(sanitizeInput('Normal text with <b>bold</b> formatting')).toBe('Normal text with <b>bold</b> formatting');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('123');
      expect(sanitizeInput({} as any)).toBe('[object Object]');
    });
  });
});
