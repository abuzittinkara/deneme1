/**
 * src/modules/auth/authManagerMock.ts
 * Kimlik doğrulama işlemleri için mock fonksiyonlar
 */
import {
  UserRegistrationData,
  RegistrationResult,
  LoginResult,
  TokenRefreshResult,
  LogoutResult,
} from './authManager';

/**
 * Kullanıcı kaydı yapar (mock)
 * @param userData - Kullanıcı verileri
 * @returns Kayıt sonucu
 */
export async function registerUser(userData: UserRegistrationData): Promise<RegistrationResult> {
  return {
    success: true,
    userId: '123456789',
    username: userData.username,
    message: 'Kullanıcı başarıyla kaydedildi',
  };
}

/**
 * Kullanıcı girişi yapar (mock)
 * @param usernameOrEmail - Kullanıcı adı veya e-posta
 * @param password - Şifre
 * @returns Giriş sonucu
 */
export async function loginUser(usernameOrEmail: string, password: string): Promise<LoginResult> {
  if (password === 'WrongPassword') {
    throw new Error('Geçersiz kullanıcı adı/e-posta veya şifre');
  }

  return {
    success: true,
    userId: '123456789',
    username: 'testuser',
    name: 'Test',
    surname: 'User',
    email: 'test@example.com',
    role: 'user',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
  };
}

/**
 * Token yeniler (mock)
 * @param refreshToken - Refresh token
 * @returns Yeni token bilgileri
 */
export async function refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
  if (refreshToken === 'invalid-refresh-token') {
    throw new Error('Geçersiz refresh token');
  }

  return {
    success: true,
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 3600,
  };
}

/**
 * Kullanıcı çıkışı yapar (mock)
 * @param refreshToken - Refresh token
 * @returns Çıkış sonucu
 */
export async function logoutUser(refreshToken?: string): Promise<LogoutResult> {
  return {
    success: true,
    message: 'Çıkış başarılı',
  };
}
