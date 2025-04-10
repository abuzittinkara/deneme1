/**
 * middleware/validators.js
 * Kullanıcı girişlerini doğrulama ve temizleme için middleware'ler
 */

const { body, param, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

/**
 * Doğrulama hatalarını kontrol eden middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Doğrulama hatası',
      errors: errors.array() 
    });
  }
  next();
};

/**
 * HTML içeriğini temizleyen yardımcı fonksiyon
 * @param {string} content - Temizlenecek içerik
 * @returns {string} - Temizlenmiş içerik
 */
const sanitizeContent = (content) => {
  if (typeof content !== 'string') return content;
  
  return sanitizeHtml(content, {
    allowedTags: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 
      'li', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'hr', 'span'
    ],
    allowedAttributes: {
      'a': ['href', 'target', 'rel'],
      'span': ['class', 'style'],
      '*': ['class']
    },
    allowedStyles: {
      '*': {
        'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
        'text-decoration': [/^underline$/]
      }
    }
  });
};

// Kullanıcı kaydı doğrulama kuralları
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Kullanıcı adı 3-20 karakter arasında olmalıdır')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir')
    .escape(),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Şifre en az 8 karakter olmalıdır')
    .matches(/[A-Z]/).withMessage('Şifre en az bir büyük harf içermelidir')
    .matches(/[a-z]/).withMessage('Şifre en az bir küçük harf içermelidir')
    .matches(/[0-9]/).withMessage('Şifre en az bir rakam içermelidir'),
  
  body('email')
    .trim()
    .isEmail().withMessage('Geçerli bir e-posta adresi giriniz')
    .normalizeEmail(),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('İsim 2-50 karakter arasında olmalıdır')
    .escape(),
  
  body('surname')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Soyisim 2-50 karakter arasında olmalıdır')
    .escape(),
  
  body('birthdate')
    .isISO8601().withMessage('Geçerli bir tarih formatı giriniz (YYYY-MM-DD)')
    .toDate(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[0-9\s-()]{7,20}$/).withMessage('Geçerli bir telefon numarası giriniz')
    .escape(),
  
  validateRequest
];

// Kullanıcı girişi doğrulama kuralları
const loginValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Kullanıcı adı 3-20 karakter arasında olmalıdır')
    .escape(),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Şifre en az 8 karakter olmalıdır'),
  
  validateRequest
];

// Grup oluşturma doğrulama kuralları
const createGroupValidation = [
  body('groupName')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Grup adı 3-50 karakter arasında olmalıdır')
    .escape(),
  
  validateRequest
];

// Kanal oluşturma doğrulama kuralları
const createChannelValidation = [
  body('groupId')
    .trim()
    .notEmpty().withMessage('Grup ID boş olamaz')
    .escape(),
  
  body('roomName')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Kanal adı 3-50 karakter arasında olmalıdır')
    .escape(),
  
  body('roomType')
    .trim()
    .isIn(['text', 'voice']).withMessage('Kanal tipi text veya voice olmalıdır'),
  
  validateRequest
];

// Mesaj gönderme doğrulama kuralları
const sendMessageValidation = [
  body('message')
    .trim()
    .notEmpty().withMessage('Mesaj boş olamaz')
    .customSanitizer(sanitizeContent),
  
  body('channelId')
    .trim()
    .notEmpty().withMessage('Kanal ID boş olamaz')
    .escape(),
  
  validateRequest
];

// DM mesajı gönderme doğrulama kuralları
const sendDMValidation = [
  body('message')
    .trim()
    .notEmpty().withMessage('Mesaj boş olamaz')
    .customSanitizer(sanitizeContent),
  
  body('friend')
    .trim()
    .notEmpty().withMessage('Arkadaş kullanıcı adı boş olamaz')
    .escape(),
  
  validateRequest
];

// Arkadaşlık isteği gönderme doğrulama kuralları
const sendFriendRequestValidation = [
  body('to')
    .trim()
    .notEmpty().withMessage('Hedef kullanıcı adı boş olamaz')
    .escape(),
  
  validateRequest
];

// Profil güncelleme doğrulama kuralları
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('İsim 2-50 karakter arasında olmalıdır')
    .escape(),
  
  body('surname')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Soyisim 2-50 karakter arasında olmalıdır')
    .escape(),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Geçerli bir e-posta adresi giriniz')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[0-9\s-()]{7,20}$/).withMessage('Geçerli bir telefon numarası giriniz')
    .escape(),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Biyografi en fazla 500 karakter olabilir')
    .customSanitizer(sanitizeContent),
  
  body('preferences')
    .optional()
    .isObject().withMessage('Tercihler bir nesne olmalıdır'),
  
  body('preferences.theme')
    .optional()
    .isIn(['dark', 'light']).withMessage('Tema dark veya light olmalıdır'),
  
  body('preferences.notifications')
    .optional()
    .isBoolean().withMessage('Bildirimler true veya false olmalıdır'),
  
  body('preferences.soundEffects')
    .optional()
    .isBoolean().withMessage('Ses efektleri true veya false olmalıdır'),
  
  body('preferences.language')
    .optional()
    .isIn(['tr', 'en']).withMessage('Dil tr veya en olmalıdır'),
  
  validateRequest
];

// Şifre sıfırlama doğrulama kuralları
const resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty().withMessage('Token boş olamaz')
    .escape(),
  
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Şifre en az 8 karakter olmalıdır')
    .matches(/[A-Z]/).withMessage('Şifre en az bir büyük harf içermelidir')
    .matches(/[a-z]/).withMessage('Şifre en az bir küçük harf içermelidir')
    .matches(/[0-9]/).withMessage('Şifre en az bir rakam içermelidir'),
  
  validateRequest
];

// Rol oluşturma doğrulama kuralları
const createRoleValidation = [
  body('groupId')
    .trim()
    .notEmpty().withMessage('Grup ID boş olamaz')
    .escape(),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 30 }).withMessage('Rol adı 2-30 karakter arasında olmalıdır')
    .escape(),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Renk geçerli bir HEX kodu olmalıdır (örn: #FF5733)'),
  
  body('permissions')
    .optional()
    .isObject().withMessage('İzinler bir nesne olmalıdır'),
  
  validateRequest
];

// Dosya yükleme doğrulama kuralları
const uploadFileValidation = [
  body('fileName')
    .trim()
    .notEmpty().withMessage('Dosya adı boş olamaz')
    .escape(),
  
  body('fileType')
    .trim()
    .notEmpty().withMessage('Dosya tipi boş olamaz')
    .matches(/^[a-zA-Z0-9\/\-+.]+$/).withMessage('Geçersiz dosya tipi'),
  
  body('fileData')
    .notEmpty().withMessage('Dosya verisi boş olamaz'),
  
  validateRequest
];

module.exports = {
  validateRequest,
  sanitizeContent,
  registerValidation,
  loginValidation,
  createGroupValidation,
  createChannelValidation,
  sendMessageValidation,
  sendDMValidation,
  sendFriendRequestValidation,
  updateProfileValidation,
  resetPasswordValidation,
  createRoleValidation,
  uploadFileValidation
};
