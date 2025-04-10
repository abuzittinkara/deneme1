/**
 * middleware/security.js
 * Güvenlik başlıkları ve middleware'leri
 */
const helmet = require('helmet');
const cors = require('cors');
const { logger } = require('../utils/logger');

/**
 * Güvenlik middleware'lerini yapılandırır
 * @param {Object} app - Express uygulaması
 */
function setupSecurityMiddleware(app) {
  // Helmet (güvenlik başlıkları)
  app.use(helmet());
  
  // Content-Security-Policy başlığı
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'cdn.seslisohbet.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        connectSrc: ["'self'", 'wss://socket.seslisohbet.com', 'https://api.seslisohbet.com'],
        mediaSrc: ["'self'", 'cdn.seslisohbet.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"]
      }
    })
  );
  
  // Referrer-Policy başlığı
  app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
  
  // X-XSS-Protection başlığı
  app.use(helmet.xssFilter());
  
  // X-Content-Type-Options başlığı
  app.use(helmet.noSniff());
  
  // X-Frame-Options başlığı
  app.use(helmet.frameguard({ action: 'deny' }));
  
  // HSTS başlığı
  app.use(
    helmet.hsts({
      maxAge: 15552000, // 180 gün
      includeSubDomains: true,
      preload: true
    })
  );
  
  // CORS yapılandırması
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400 // 1 gün
    })
  );
  
  // CSRF koruması (API'ler için gerekli değil, ancak form tabanlı uygulamalar için eklenebilir)
  // app.use(csrf({ cookie: true }));
  
  // Güvenlik günlüğü middleware'i
  app.use((req, res, next) => {
    // Orijinal end fonksiyonunu kaydet
    const originalEnd = res.end;
    
    // Yanıt tamamlandığında güvenlik günlüğü oluştur
    res.end = function(chunk, encoding) {
      // Güvenlik açısından önemli başlıkları kontrol et
      const securityHeaders = {
        'content-security-policy': res.getHeader('content-security-policy'),
        'strict-transport-security': res.getHeader('strict-transport-security'),
        'x-content-type-options': res.getHeader('x-content-type-options'),
        'x-frame-options': res.getHeader('x-frame-options'),
        'x-xss-protection': res.getHeader('x-xss-protection')
      };
      
      // Eksik güvenlik başlıkları varsa uyarı günlüğü oluştur
      const missingHeaders = Object.entries(securityHeaders)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
      
      if (missingHeaders.length > 0) {
        logger.warn('Eksik güvenlik başlıkları', { 
          path: req.path, 
          method: req.method, 
          missingHeaders 
        });
      }
      
      // Orijinal end fonksiyonunu çağır
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  });
  
  logger.info('Güvenlik middleware\'leri yapılandırıldı');
}

module.exports = {
  setupSecurityMiddleware
};
