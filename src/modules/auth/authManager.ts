/**
 * src/modules/auth/authManager.ts
 * Kimlik doğrulama işlemleri
 */
import bcrypt from 'bcrypt';
import { User, IUser, UserDocument } from '../../models/User';
import { logger } from '../../utils/logger';
import { generateTokens, verifyToken, refreshAccessToken, invalidateAllUserTokens, invalidateRefreshToken, TokenPayload, TokenResponse } from '../../config/jwt';
import { NotFoundError, ValidationError, AuthenticationError } from '../../utils/errors';
import * as sessionManager from '../session/sessionManager';

// Kullanıcı kaydı için arayüz
export interface UserRegistrationData {
  username: string;
  email: string;
  password: string;
  name?: string;
  surname?: string;
  birthdate?: string | Date;
  phone?: string;
}

// Kullanıcı kaydı sonucu arayüzü
export interface RegistrationResult {
  success: boolean;
  userId: string;
  username: string;
  message: string;
}

// Kullanıcı girişi sonucu arayüzü
export interface LoginResult extends TokenResponse {
  success: boolean;
  userId: string;
  username: string;
  name?: string;
  surname?: string;
  email?: string;
  role?: string;
  profilePicture?: string;
  isEmailVerified?: boolean;
}

// Şifre değiştirme sonucu arayüzü
export interface PasswordChangeResult {
  success: boolean;
  message: string;
}

// Çıkış sonucu arayüzü
export interface LogoutResult {
  success: boolean;
  message: string;
}

// Token yenileme sonucu arayüzü
export interface TokenRefreshResult extends TokenResponse {
  success: boolean;
}

/**
 * Kullanıcı kaydı yapar
 * @param userData - Kullanıcı verileri
 * @returns Kayıt sonucu
 */
export async function registerUser(userData: UserRegistrationData): Promise<RegistrationResult> {
  try {
    const { username, email, password, name, surname, birthdate, phone } = userData;

    // Zorunlu alanları kontrol et
    if (!username || !email || !password) {
      throw new ValidationError('Kullanıcı adı, e-posta ve şifre zorunludur');
    }

    // GELİŞTİRME MODU: MongoDB bağlantısı olmadığında test kullanıcısı kullan
    if (process.env.NODE_ENV !== 'production') {
      // Test kullanıcısı için özel durum
      if (username === 'test') {
        logger.info('Test kullanıcısı kaydı (geliştirme modu)');

        return {
          success: true,
          userId: '123456789012345678901234',
          username: 'test',
          message: 'Kullanıcı başarıyla kaydedildi (geliştirme modu)'
        };
      }
    }

    // Kullanıcı adı ve e-posta benzersiz mi kontrol et
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existingUser) {
      const existingUsername = existingUser.get('username');
      if (existingUsername && existingUsername.toLowerCase() === username.toLowerCase()) {
        throw new ValidationError('Bu kullanıcı adı zaten kullanılıyor');
      }
      const existingEmail = existingUser.get('email');
      if (existingEmail && existingEmail.toLowerCase() === email.toLowerCase()) {
        throw new ValidationError('Bu e-posta adresi zaten kullanılıyor');
      }
    }

    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Yeni kullanıcı oluştur
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      name,
      surname,
      birthdate: birthdate ? new Date(birthdate) : undefined,
      phone,
      lastSeen: new Date(),
      emailVerified: false,
      isActive: true,
      role: 'user',
      groups: [],
      friends: []
    });

    // Kullanıcıyı kaydet
    await newUser.save();

    logger.info('Yeni kullanıcı kaydedildi', { username: newUser.username, userId: newUser._id });

    return {
      success: true,
      userId: newUser._id.toString(),
      username: newUser.username,
      message: 'Kullanıcı başarıyla kaydedildi'
    };
  } catch (error) {
    logger.error('Kullanıcı kaydı hatası', { error: (error as Error).message, userData });
    throw error;
  }
}

/**
 * Kullanıcı girişi yapar
 * @param usernameOrEmail - Kullanıcı adı veya e-posta
 * @param password - Şifre
 * @returns Giriş sonucu
 */
export async function loginUser(usernameOrEmail: string, password: string, rememberMe: boolean = false): Promise<LoginResult> {
  try {
    // Zorunlu alanları kontrol et
    if (!usernameOrEmail || !password) {
      throw new ValidationError('Kullanıcı adı/e-posta ve şifre zorunludur');
    }

    // GELİŞTİRME MODU: MongoDB bağlantısı olmadığında test kullanıcısı kullan
    if (process.env.NODE_ENV !== 'production') {
      // Test kullanıcısı için sabit şifre: "Password123"
      if (usernameOrEmail === 'test' && password === 'Password123') {
        logger.info('Test kullanıcısı girişi (geliştirme modu)');

        // Sahte token oluştur
        const mockTokens = {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600
        };

        return {
          success: true,
          userId: '123456789012345678901234',
          username: 'test',
          name: 'Test',
          surname: 'User',
          email: 'test@example.com',
          role: 'user',
          profilePicture: undefined,
          isEmailVerified: true,
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
          expiresIn: mockTokens.expiresIn
        };
      }
    }

    // Kullanıcıyı bul
    const user = await User.findOne({
      $or: [
        { username: usernameOrEmail.toLowerCase() },
        { email: usernameOrEmail.toLowerCase() }
      ]
    });

    if (!user) {
      throw new AuthenticationError('Geçersiz kullanıcı adı/e-posta veya şifre');
    }

    // Kullanıcı aktif mi kontrol et
    const isActive = user.get('isActive');
    if (!isActive) {
      throw new AuthenticationError('Hesabınız aktif değil');
    }

    // Şifreyi doğrula
    const passwordHash = user.get('passwordHash');
    const isPasswordValid = await bcrypt.compare(password, passwordHash);

    if (!isPasswordValid) {
      throw new AuthenticationError('Geçersiz kullanıcı adı/e-posta veya şifre');
    }

    // Son görülme zamanını güncelle
    user.set('lastSeen', new Date());
    await user.save();

    // Token oluştur
    const tokens = await generateTokens(user);

    const username = user.get('username');
    const name = user.get('name');
    const surname = user.get('surname');
    const email = user.get('email');
    const role = user.get('role');
    const profilePicture = user.get('profilePicture');
    const emailVerified = user.get('emailVerified');

    logger.info('Kullanıcı girişi başarılı', { username, userId: user._id });

    return {
      success: true,
      userId: user._id.toString(),
      username,
      name,
      surname,
      email,
      role,
      profilePicture: profilePicture?.toString(),
      isEmailVerified: emailVerified,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    };
  } catch (error) {
    logger.error('Kullanıcı girişi hatası', { error: (error as Error).message, usernameOrEmail });
    throw error;
  }
}

/**
 * Şifre değiştirir
 * @param userId - Kullanıcı ID'si
 * @param currentPassword - Mevcut şifre
 * @param newPassword - Yeni şifre
 * @returns Şifre değiştirme sonucu
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<PasswordChangeResult> {
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Mevcut şifreyi doğrula
    const passwordHash = user.get('passwordHash');
    const isPasswordValid = await bcrypt.compare(currentPassword, passwordHash);

    if (!isPasswordValid) {
      throw new ValidationError('Mevcut şifre yanlış');
    }

    // Yeni şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Şifreyi güncelle
    user.set('passwordHash', hashedPassword);
    await user.save();

    // Tüm cihazlardan çıkış yap
    await logoutAllDevices(userId);

    logger.info('Şifre değiştirildi', { userId });

    return {
      success: true,
      message: 'Şifre başarıyla değiştirildi'
    };
  } catch (error) {
    logger.error('Şifre değiştirme hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * Kullanıcı çıkışı yapar
 * @param userId - Kullanıcı ID'si
 * @param refreshToken - Refresh token
 * @param sessionId - Oturum ID'si
 * @returns Çıkış sonucu
 */
export async function logoutUser(
  userId: string,
  refreshToken?: string,
  sessionId?: string
): Promise<LogoutResult> {
  try {
    // Refresh token'ı geçersiz kıl
    if (refreshToken) {
      await invalidateRefreshToken(refreshToken);
    }

    // Oturumu sonlandır
    if (sessionId) {
      await sessionManager.endSessionById(sessionId);
    }

    logger.info('Kullanıcı çıkışı başarılı', { userId, sessionId });

    return {
      success: true,
      message: 'Çıkış başarılı'
    };
  } catch (error) {
    logger.error('Kullanıcı çıkışı hatası', { error: (error as Error).message, userId, sessionId });
    throw error;
  }
}

/**
 * Tüm cihazlardan çıkış yapar
 * @param userId - Kullanıcı ID'si
 * @returns Çıkış sonucu
 */
export async function logoutAllDevices(userId: string): Promise<LogoutResult> {
  try {
    // Tüm refresh token'ları geçersiz kıl
    await invalidateAllUserTokens(userId);

    // Tüm oturumları sonlandır
    await sessionManager.endAllUserSessions(userId);

    logger.info('Tüm cihazlardan çıkış başarılı', { userId });

    return {
      success: true,
      message: 'Tüm cihazlardan çıkış başarılı'
    };
  } catch (error) {
    logger.error('Tüm cihazlardan çıkış hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * Refresh token ile yeni token oluşturur
 * @param refreshToken - Refresh token
 * @returns Yeni token bilgileri
 */
export async function refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
  try {
    // GELİŞTİRME MODU: Test token'ı için özel durum
    if (process.env.NODE_ENV !== 'production' && refreshToken === 'test-refresh-token') {
      logger.info('Test refresh token yenileme (geliştirme modu)');

      return {
        success: true,
        accessToken: 'test-access-token-renewed',
        refreshToken: 'test-refresh-token-renewed',
        expiresIn: 3600
      };
    }

    // Refresh token ile yeni token oluştur
    const tokens = await refreshAccessToken(refreshToken);

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    };
  } catch (error) {
    logger.error('Token yenileme hatası', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Token doğrular
 * @param token - JWT token
 * @returns Doğrulanmış token payload'ı veya null
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  // GELİŞTİRME MODU: Test token'ı için özel durum
  if (process.env.NODE_ENV !== 'production' && token === 'test-access-token') {
    return {
      sub: '123456789012345678901234',
      username: 'test',
      role: 'user'
    };
  }

  return verifyToken(token);
}

/**
 * Oturum oluşturur
 * @param sessionData - Oturum verileri
 * @returns Oluşturulan oturum
 */
export async function createSession(sessionData: any): Promise<any> {
  try {
    // GELİŞTİRME MODU: Test kullanıcısı için özel durum
    if (process.env.NODE_ENV !== 'production' && sessionData.userId === '123456789012345678901234') {
      logger.info('Test kullanıcısı oturumu oluşturuldu (geliştirme modu)');

      return {
        id: 'test-session-id',
        user: sessionData.userId,
        deviceInfo: sessionData.deviceInfo || 'web',
        ipAddress: sessionData.ipAddress || '127.0.0.1',
        createdAt: new Date(),
        lastActive: new Date(),
        isActive: true
      };
    }

    // Oturum oluştur
    const session = await sessionManager.createSession(
      sessionData.userId,
      sessionData.deviceInfo || 'web', // Varsayılan olarak web platformu
      sessionData.ipAddress || '127.0.0.1'
    );

    logger.info('Oturum oluşturuldu', {
      userId: sessionData.userId,
      sessionId: session
    });

    return session;
  } catch (error) {
    logger.error('Oturum oluşturma hatası', {
      error: (error as Error).message,
      userId: sessionData.userId
    });
    throw error;
  }
}

/**
 * Oturumu sonlandırır
 * @param userId - Kullanıcı ID'si
 * @param sessionId - Oturum ID'si
 * @returns İşlem sonucu
 */
export async function endSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    // Oturumu kontrol et
    const session = await sessionManager.getSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Oturum bulunamadı');
    }

    // Kullanıcının kendi oturumu mu kontrol et
    if (session.user.toString() !== userId) {
      throw new AuthenticationError('Bu oturumu sonlandırma yetkiniz yok');
    }

    // Oturumu sonlandır
    await sessionManager.endSessionById(sessionId);

    logger.info('Oturum sonlandırıldı', {
      userId,
      sessionId
    });

    return true;
  } catch (error) {
    logger.error('Oturum sonlandırma hatası', {
      error: (error as Error).message,
      userId,
      sessionId
    });
    throw error;
  }
}

/**
 * Belirli bir oturum dışındaki tüm oturumları sonlandırır
 * @param userId - Kullanıcı ID'si
 * @param currentSessionId - Mevcut oturum ID'si
 * @returns İşlem sonucu
 */
export async function endAllSessionsExcept(userId: string, currentSessionId: string): Promise<boolean> {
  try {
    // Tüm oturumları sonlandır (mevcut oturum hariç)
    await sessionManager.endAllSessionsExcept(userId, currentSessionId);

    logger.info('Tüm diğer oturumlar sonlandırıldı', {
      userId,
      currentSessionId
    });

    return true;
  } catch (error) {
    logger.error('Tüm diğer oturumları sonlandırma hatası', {
      error: (error as Error).message,
      userId,
      currentSessionId
    });
    throw error;
  }
}

/**
 * Kullanıcının oturumlarını getirir
 * @param userId - Kullanıcı ID'si
 * @returns Oturumlar listesi
 */
export async function getUserSessions(userId: string): Promise<any[]> {
  try {
    // Kullanıcının oturumlarını getir
    const sessions = await sessionManager.getUserSessions(userId);

    logger.debug('Kullanıcı oturumları getirildi', {
      userId,
      sessionCount: sessions.length
    });

    return sessions;
  } catch (error) {
    logger.error('Kullanıcı oturumlarını getirme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

export default {
  registerUser,
  loginUser,
  logoutUser,
  logoutAllDevices,
  changePassword,
  refreshToken,
  verifyAccessToken,
  createSession,
  endSession,
  endAllSessionsExcept,
  getUserSessions
};
