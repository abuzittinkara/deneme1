/**
 * middleware/auth.js
 * Kimlik doğrulama middleware'leri
 */
const { verifyAccessToken } = require('../modules/auth/authManager');
const { AuthenticationError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Kimlik doğrulama middleware'i
 * @param {Object} req - Express request nesnesi
 * @param {Object} res - Express response nesnesi
 * @param {Function} next - Express next fonksiyonu
 */
function authenticate(req, res, next) {
  try {
    // Authorization başlığını al
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Kimlik doğrulama gerekli');
    }
    
    // Token'ı çıkar
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      throw new AuthenticationError('Geçersiz veya süresi dolmuş token');
    }
    
    // Kullanıcı bilgilerini request'e ekle
    req.user = decoded;
    
    next();
  } catch (error) {
    logger.error('Kimlik doğrulama hatası', { error: error.message });
    
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ success: false, message: error.message });
    }
    
    return res.status(401).json({ success: false, message: 'Kimlik doğrulama başarısız' });
  }
}

/**
 * Rol kontrolü middleware'i
 * @param {string|Array} roles - İzin verilen roller
 * @returns {Function} - Middleware fonksiyonu
 */
function authorize(roles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Kimlik doğrulama gerekli');
      }
      
      const userRole = req.user.role || 'user';
      
      // Tek bir rol kontrolü
      if (typeof roles === 'string' && userRole !== roles) {
        throw new AuthenticationError('Bu işlem için yetkiniz yok');
      }
      
      // Birden fazla rol kontrolü
      if (Array.isArray(roles) && !roles.includes(userRole)) {
        throw new AuthenticationError('Bu işlem için yetkiniz yok');
      }
      
      next();
    } catch (error) {
      logger.error('Yetkilendirme hatası', { error: error.message, userId: req.user?.sub, role: req.user?.role });
      
      if (error instanceof AuthenticationError) {
        return res.status(403).json({ success: false, message: error.message });
      }
      
      return res.status(403).json({ success: false, message: 'Yetkilendirme başarısız' });
    }
  };
}

/**
 * Kullanıcı kimliği kontrolü middleware'i
 * @param {string} paramName - Kullanıcı ID'sinin bulunduğu parametre adı
 * @returns {Function} - Middleware fonksiyonu
 */
function checkUserId(paramName = 'userId') {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Kimlik doğrulama gerekli');
      }
      
      const paramUserId = req.params[paramName];
      
      // Admin her kullanıcının verilerine erişebilir
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Kullanıcı sadece kendi verilerine erişebilir
      if (req.user.sub !== paramUserId) {
        throw new AuthenticationError('Bu işlem için yetkiniz yok');
      }
      
      next();
    } catch (error) {
      logger.error('Kullanıcı kimliği kontrolü hatası', { 
        error: error.message, 
        userId: req.user?.sub, 
        paramUserId: req.params[paramName] 
      });
      
      if (error instanceof AuthenticationError) {
        return res.status(403).json({ success: false, message: error.message });
      }
      
      return res.status(403).json({ success: false, message: 'Yetkilendirme başarısız' });
    }
  };
}

module.exports = {
  authenticate,
  authorize,
  checkUserId
};
