/**
 * src/routes/auth/auth.docs.ts
 * Kimlik doğrulama API dokümantasyonu
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Kullanıcı e-posta adresi
 *           example: user@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: Kullanıcı şifresi
 *           example: P@ssw0rd123
 *         rememberMe:
 *           type: boolean
 *           description: Oturumu hatırla
 *           example: false
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             tokens:
 *               $ref: '#/components/schemas/Token'
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - passwordConfirm
 *       properties:
 *         username:
 *           type: string
 *           description: Kullanıcı adı
 *           example: johndoe
 *           minLength: 3
 *           maxLength: 30
 *         email:
 *           type: string
 *           format: email
 *           description: E-posta adresi
 *           example: john@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: Şifre
 *           example: P@ssw0rd123
 *           minLength: 8
 *         passwordConfirm:
 *           type: string
 *           format: password
 *           description: Şifre onayı
 *           example: P@ssw0rd123
 *         displayName:
 *           type: string
 *           description: Görünen ad
 *           example: John Doe
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: Yenileme token'ı
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Kimlik doğrulama ve yetkilendirme işlemleri
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Kullanıcı girişi
 *     description: E-posta ve şifre ile kullanıcı girişi yapar
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Başarılı giriş
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Kimlik doğrulama hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Kullanıcı kaydı
 *     description: Yeni kullanıcı kaydı oluşturur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       409:
 *         description: Kullanıcı zaten mevcut
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Token yenileme
 *     description: Yenileme token'ı ile yeni erişim token'ı alır
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token başarıyla yenilendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       $ref: '#/components/schemas/Token'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Geçersiz token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Çıkış yap
 *     description: Kullanıcı oturumunu sonlandırır
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Başarıyla çıkış yapıldı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Başarıyla çıkış yapıldı
 *       401:
 *         description: Kimlik doğrulama hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Mevcut kullanıcı bilgilerini al
 *     description: Kimlik doğrulaması yapılmış kullanıcının bilgilerini döndürür
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Kimlik doğrulama hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Şifre değiştir
 *     description: Kullanıcının şifresini değiştirir
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - newPasswordConfirm
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Mevcut şifre
 *                 example: P@ssw0rd123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre
 *                 example: NewP@ssw0rd456
 *               newPasswordConfirm:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre onayı
 *                 example: NewP@ssw0rd456
 *     responses:
 *       200:
 *         description: Şifre başarıyla değiştirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Şifre başarıyla değiştirildi
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Kimlik doğrulama hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
