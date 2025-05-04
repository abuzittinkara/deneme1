/**
 * src/routes/users/users.docs.ts
 * Kullanıcı API dokümantasyonu
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserCreateRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - role
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
 *         displayName:
 *           type: string
 *           description: Görünen ad
 *           example: John Doe
 *         role:
 *           type: string
 *           enum: [user, admin, moderator]
 *           description: Kullanıcı rolü
 *           example: user
 *         status:
 *           type: string
 *           enum: [active, inactive, banned, suspended]
 *           description: Kullanıcı durumu
 *           example: active
 *         avatar:
 *           type: string
 *           description: Avatar URL
 *           example: https://example.com/avatar.jpg
 *     UserUpdateRequest:
 *       type: object
 *       properties:
 *         displayName:
 *           type: string
 *           description: Görünen ad
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           description: E-posta adresi
 *           example: john@example.com
 *         role:
 *           type: string
 *           enum: [user, admin, moderator]
 *           description: Kullanıcı rolü
 *           example: user
 *         status:
 *           type: string
 *           enum: [active, inactive, banned, suspended]
 *           description: Kullanıcı durumu
 *           example: active
 *         avatar:
 *           type: string
 *           description: Avatar URL
 *           example: https://example.com/avatar.jpg
 *     UserResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/User'
 *     UsersListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 100
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 10
 *             pages:
 *               type: integer
 *               example: 10
 */

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Kullanıcı yönetimi işlemleri
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Kullanıcıları listele
 *     description: Sayfalanmış kullanıcı listesini döndürür
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/sortParam'
 *       - name: search
 *         in: query
 *         description: Arama terimi (kullanıcı adı, e-posta veya görünen ad)
 *         schema:
 *           type: string
 *       - name: role
 *         in: query
 *         description: Rol filtresi
 *         schema:
 *           type: string
 *           enum: [user, admin, moderator]
 *       - name: status
 *         in: query
 *         description: Durum filtresi
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned, suspended]
 *     responses:
 *       200:
 *         description: Kullanıcı listesi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersListResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Kullanıcı oluştur
 *     description: Yeni bir kullanıcı oluşturur (sadece admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreateRequest'
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Kullanıcı zaten mevcut
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Kullanıcı detaylarını al
 *     description: Belirli bir kullanıcının detaylarını döndürür
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Kullanıcı ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Kullanıcı detayları
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     summary: Kullanıcı güncelle
 *     description: Belirli bir kullanıcının bilgilerini günceller
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Kullanıcı ID
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     summary: Kullanıcı sil
 *     description: Belirli bir kullanıcıyı siler (sadece admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Kullanıcı ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla silindi
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
 *                   example: Kullanıcı başarıyla silindi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Kullanıcı durumunu güncelle
 *     description: Belirli bir kullanıcının durumunu günceller (sadece admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Kullanıcı ID
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, banned, suspended]
 *                 description: Kullanıcı durumu
 *                 example: active
 *               reason:
 *                 type: string
 *                 description: Durum değişikliği nedeni
 *                 example: Kullanıcı isteği üzerine
 *     responses:
 *       200:
 *         description: Kullanıcı durumu başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
