# Güvenlik Güncellemeleri

Bu dokümantasyon, yapılan güvenlik güncellemelerini ve iyileştirmelerini açıklar.

## İçindekiler

1. [Giriş](#giriş)
2. [Güvenlik Başlıkları](#güvenlik-başlıkları)
3. [Rate Limiting](#rate-limiting)
4. [Giriş Doğrulama ve Sanitizasyon](#giriş-doğrulama-ve-sanitizasyon)
5. [Yetkilendirme Sistemi](#yetkilendirme-sistemi)
6. [Güvenli Çevre Değişkenleri](#güvenli-çevre-değişkenleri)

## Giriş

Güvenlik güncellemeleri, uygulamanın güvenliğini artırmak için yapılan iyileştirmeleri içerir. Bu güncellemeler, aşağıdaki alanlarda yapılmıştır:

1. **Güvenlik Başlıkları**: HTTP güvenlik başlıklarının sıkılaştırılması
2. **Rate Limiting**: API isteklerinin sınırlandırılması
3. **Giriş Doğrulama ve Sanitizasyon**: Kullanıcı girdilerinin doğrulanması ve temizlenmesi
4. **Yetkilendirme Sistemi**: Kaynaklara erişim yetkilerinin kontrol edilmesi
5. **Güvenli Çevre Değişkenleri**: Hardcoded credentials sorunlarının çözülmesi

## Güvenlik Başlıkları

Güvenlik başlıkları, `src/middleware/securityMiddleware.ts` dosyasında yapılandırılmıştır. Aşağıdaki başlıklar eklenmiştir:

### Content Security Policy (CSP)

```javascript
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'", 'wss:', 'ws:', 'localhost:*'],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    workerSrc: ["'self'", 'blob:'],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'"],
    upgradeInsecureRequests: [],
    blockAllMixedContent: []
  }
};
```

### Diğer Güvenlik Başlıkları

```javascript
export const securityHeaders = helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? contentSecurityPolicy : false,
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' },
  hsts: {
    maxAge: 31536000, // 1 yıl
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  },
  dnsPrefetchControl: { allow: false },
  expectCt: {
    enforce: true,
    maxAge: 86400 // 1 gün
  }
});
```

## Rate Limiting

Rate limiting, API isteklerinin sınırlandırılması için kullanılır. Aşağıdaki rate limiter'lar eklenmiştir:

### Genel API Limitleri

```javascript
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına 15 dakikada maksimum 100 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Çok fazla istek, lütfen daha sonra tekrar deneyin',
      statusCode: 429
    }
  },
  skip: (req) => env.NODE_ENV === 'development', // Geliştirme modunda atla
  handler: (req, res, next, options) => {
    logger.warn('Hız sınırı aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json(options.message);
  },
  keyGenerator: (req) => {
    // IP + User ID (eğer varsa) ile anahtar oluştur
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userId = (req as any).user?._id || 'anonymous';
    return `${ip}:${userId}`;
  }
});
```

### Kimlik Doğrulama Limitleri

```javascript
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 10, // IP başına 1 saatte maksimum 10 başarısız giriş denemesi
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Çok fazla başarısız giriş denemesi, lütfen daha sonra tekrar deneyin',
      statusCode: 429
    }
  },
  skip: (req) => env.NODE_ENV === 'development', // Geliştirme modunda atla
  handler: (req, res, next, options) => {
    logger.warn('Kimlik doğrulama hız sınırı aşıldı', {
      ip: req.ip,
      username: req.body.username,
      userAgent: req.headers['user-agent']
    });
    res.status(429).json(options.message);
  },
  skipSuccessfulRequests: true, // Başarılı istekleri sayma
  keyGenerator: (req) => {
    // IP + User-Agent ile anahtar oluştur
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return `${ip}:${userAgent.substring(0, 20)}`;
  }
});
```

### Hassas İşlemler için Limitleri

```javascript
export const sensitiveActionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 saat
  max: 5, // IP başına 24 saatte maksimum 5 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Çok fazla hassas işlem denemesi, lütfen daha sonra tekrar deneyin',
      statusCode: 429
    }
  },
  skip: (req) => env.NODE_ENV === 'development', // Geliştirme modunda atla
  handler: (req, res, next, options) => {
    logger.warn('Hassas işlem hız sınırı aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: (req as any).user?._id
    });
    res.status(429).json(options.message);
  },
  skipSuccessfulRequests: false, // Başarılı istekleri de say
  keyGenerator: (req) => {
    // IP + User ID + User-Agent ile anahtar oluştur
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userId = (req as any).user?._id || 'anonymous';
    const userAgent = req.headers['user-agent'] || '';
    return `${ip}:${userId}:${userAgent.substring(0, 20)}`;
  }
});
```

## Giriş Doğrulama ve Sanitizasyon

Kullanıcı girdilerinin doğrulanması ve temizlenmesi için `src/utils/sanitizer.ts` dosyası eklenmiştir. Aşağıdaki fonksiyonlar eklenmiştir:

### HTML Escape

```javascript
export function escapeHtml(html: string | undefined | null): string {
  if (!html) return '';
  
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### XSS Sanitizasyon

```javascript
export function sanitizeXss(text: string | undefined | null): string {
  if (!text) return '';
  
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '')
    .replace(/on\w+=\w+/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, 'data-safe:');
}
```

### SQL Sanitizasyon

```javascript
export function sanitizeSql(text: string | undefined | null): string {
  if (!text) return '';
  
  return text
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x1a/g, '\\Z');
}
```

### URL Sanitizasyon

```javascript
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  try {
    // URL'yi parse et
    const parsedUrl = new URL(url);
    
    // Sadece belirli protokollere izin ver
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      logger.warn('Güvenli olmayan URL protokolü engellendi', {
        url,
        protocol: parsedUrl.protocol
      });
      return '';
    }
    
    return parsedUrl.toString();
  } catch (error) {
    logger.warn('Geçersiz URL sanitize edildi', {
      url,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
    return '';
  }
}
```

### Dosya Adı Sanitizasyon

```javascript
export function sanitizeFilename(filename: string | undefined | null): string {
  if (!filename) return '';
  
  // Dosya adındaki tehlikeli karakterleri temizle
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_') // Dosya sisteminde geçersiz karakterler
    .replace(/\.\./g, '_') // Path traversal saldırılarını önle
    .replace(/^\.+|\.+$/g, '_') // Başlangıç ve sondaki noktaları temizle
    .trim();
}
```

## Yetkilendirme Sistemi

Yetkilendirme sistemi, `src/utils/authorizationHelper.ts` ve `src/middleware/authorizationMiddleware.ts` dosyalarında uygulanmıştır. Aşağıdaki fonksiyonlar eklenmiştir:

### Yetki Kontrolü

```javascript
export async function hasPermission(
  userId: string,
  resourceId: string,
  resourceType: 'group' | 'channel' | 'message' | 'user',
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view'
): Promise<boolean> {
  try {
    // Kullanıcıyı kontrol et
    const user = await User.findById(userId);
    
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    
    // Admin kullanıcılar her şeye erişebilir
    if (user.role === 'admin') {
      return true;
    }
    
    // Kaynak tipine göre yetki kontrolü yap
    switch (resourceType) {
      case 'group':
        return await hasGroupPermission(userId, resourceId, requiredPermission);
      
      case 'channel':
        return await hasChannelPermission(userId, resourceId, requiredPermission);
      
      case 'message':
        return await hasMessagePermission(userId, resourceId, requiredPermission);
      
      case 'user':
        return await hasUserPermission(userId, resourceId, requiredPermission);
      
      default:
        return false;
    }
  } catch (error) {
    logger.error('Yetki kontrolü sırasında hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      userId,
      resourceId,
      resourceType,
      requiredPermission
    });
    
    return false;
  }
}
```

### Yetkilendirme Middleware'leri

```javascript
export function authorizeResource(
  resourceType: 'group' | 'channel' | 'message' | 'user',
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view',
  getResourceId: (req: Request) => string = (req) => req.params.id
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Kullanıcı ID'sini al
      const userId = getUserIdFromRequest(req);
      
      // Kaynak ID'sini al
      const resourceId = getResourceId(req);
      
      if (!resourceId) {
        return next(new ForbiddenError('Geçersiz kaynak ID'));
      }
      
      // Yetki kontrolü yap
      const hasAccess = await hasPermission(
        userId,
        resourceId,
        resourceType,
        requiredPermission
      );
      
      if (!hasAccess) {
        return next(new ForbiddenError(`Bu işlem için yetkiniz yok: ${resourceType} ${requiredPermission}`));
      }
      
      next();
    } catch (error) {
      logger.error('Yetkilendirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        resourceType,
        requiredPermission,
        path: req.path,
        method: req.method
      });
      
      next(error);
    }
  };
}
```

## Güvenli Çevre Değişkenleri

Güvenli çevre değişkenleri, `src/config/env.ts` dosyasında yapılandırılmıştır. Aşağıdaki değişiklikler yapılmıştır:

### JWT Ayarları

```javascript
// JWT ayarları
JWT_SECRET: process.env['JWT_SECRET'] || (process.env.NODE_ENV === 'production' ? undefined : 'dev-jwt-secret'),
JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] || '15m', // Güvenlik için 15 dakika
REFRESH_TOKEN_EXPIRES_IN: process.env['REFRESH_TOKEN_EXPIRES_IN'] || '7d',
```

### Mediasoup Ayarları

```javascript
// Mediasoup ayarları
ANNOUNCED_IP: process.env['ANNOUNCED_IP'] || 'localhost',
TURN_USERNAME: process.env['TURN_USERNAME'] || (process.env.NODE_ENV === 'production' ? undefined : 'dev-turn-user'),
TURN_CREDENTIAL: process.env['TURN_CREDENTIAL'] || (process.env.NODE_ENV === 'production' ? undefined : 'dev-turn-credential'),
```

### Üretim Ortamı Kontrolü

```javascript
// Üretim ortamında gerekli çevre değişkenlerini kontrol et
if (env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'MONGODB_URI',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'TURN_USERNAME',
    'TURN_CREDENTIAL'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Üretim ortamında ${envVar} çevre değişkeni gereklidir`);
    }
  }
}
```
