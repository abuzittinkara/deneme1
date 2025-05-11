/**
 * src/services/userService.ts
 * Kullanıcı işlemleri için servis
 */
import { User, UserDocument, IUser } from '../models/User';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';
import { UserStatus, UserRole } from '../types/enums';
import mongoose from 'mongoose';
import { ApiError } from '../utils/errors';

/**
 * Kullanıcı oluşturma parametreleri
 */
export interface CreateUserParams {
  username: string;
  password: string;
  email?: string;
  name?: string;
  surname?: string;
  role?: UserRole;
}

/**
 * Kullanıcı güncelleme parametreleri
 */
export interface UpdateUserParams {
  name?: string;
  surname?: string;
  email?: string;
  bio?: string;
  status?: UserStatus;
  customStatus?: string;
  avatar?: string;
  role?: UserRole;
  isActive?: boolean;
  preferences?: Partial<IUser['preferences']>;
}

/**
 * Kullanıcı servisi
 */
export class UserService {
  /**
   * Kullanıcı oluşturur
   * @param params - Kullanıcı oluşturma parametreleri
   * @returns Oluşturulan kullanıcı
   */
  async createUser(params: CreateUserParams): Promise<UserDocument> {
    try {
      const { username, password, email, name, surname, role } = params;

      // Kullanıcı adı veya e-posta adresi zaten kullanılıyor mu kontrol et
      const existingUser = await User.findByUsernameOrEmail(username || email || '');
      if (existingUser) {
        throw new ApiError('Kullanıcı adı veya e-posta adresi zaten kullanılıyor', 400);
      }

      // Şifreyi hashle
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Kullanıcıyı oluştur
      const user = await User.create({
        username,
        passwordHash,
        email,
        name,
        surname,
        role: role || UserRole.USER,
        status: UserStatus.ACTIVE,
        isActive: true,
        emailVerified: false,
        bio: '',
        customStatus: '',
        twoFactorEnabled: false,
        preferences: {
          theme: 'dark',
          notifications: true,
          emailNotifications: true,
          soundEffects: true,
          language: 'tr',
          notificationTypes: {
            directMessages: true,
            mentions: true,
            friendRequests: true,
            groupInvites: true,
            channelMessages: false,
          },
        },
        onlineStatus: {
          isOnline: false,
          lastActiveAt: new Date(),
        },
      });

      logger.info('Kullanıcı oluşturuldu', {
        userId: user._id,
        username: user.username,
      });

      return user;
    } catch (error) {
      logger.error('Kullanıcı oluşturma hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        params,
      });
      throw error;
    }
  }

  /**
   * Kullanıcı bilgilerini getirir
   * @param userId - Kullanıcı ID
   * @returns Kullanıcı bilgileri
   */
  async getUserById(userId: string): Promise<UserDocument | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      const user = await User.findById(userId);
      return user;
    } catch (error) {
      logger.error('Kullanıcı bilgileri getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
      });
      throw error;
    }
  }

  /**
   * Kullanıcı adına göre kullanıcı bilgilerini getirir
   * @param username - Kullanıcı adı
   * @returns Kullanıcı bilgileri
   */
  async getUserByUsername(username: string): Promise<UserDocument | null> {
    try {
      const user = await User.findByUsername(username);
      return user;
    } catch (error) {
      logger.error('Kullanıcı bilgileri getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        username,
      });
      throw error;
    }
  }

  /**
   * E-posta adresine göre kullanıcı bilgilerini getirir
   * @param email - E-posta adresi
   * @returns Kullanıcı bilgileri
   */
  async getUserByEmail(email: string): Promise<UserDocument | null> {
    try {
      const user = await User.findByEmail(email);
      return user;
    } catch (error) {
      logger.error('Kullanıcı bilgileri getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        email,
      });
      throw error;
    }
  }

  /**
   * Kullanıcı bilgilerini günceller
   * @param userId - Kullanıcı ID
   * @param params - Kullanıcı güncelleme parametreleri
   * @returns Güncellenen kullanıcı
   */
  async updateUser(userId: string, params: UpdateUserParams): Promise<UserDocument | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Kullanıcıyı bul
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError('Kullanıcı bulunamadı', 404);
      }

      // Kullanıcı bilgilerini güncelle
      const updatedUser = await User.findByIdAndUpdate(userId, { $set: params }, { new: true });

      logger.info('Kullanıcı bilgileri güncellendi', {
        userId,
        updatedFields: Object.keys(params),
      });

      return updatedUser;
    } catch (error) {
      logger.error('Kullanıcı bilgileri güncelleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        params,
      });
      throw error;
    }
  }

  /**
   * Kullanıcı şifresini günceller
   * @param userId - Kullanıcı ID
   * @param currentPassword - Mevcut şifre
   * @param newPassword - Yeni şifre
   * @returns İşlem başarılı mı
   */
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Kullanıcıyı bul
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError('Kullanıcı bulunamadı', 404);
      }

      // Mevcut şifreyi kontrol et
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new ApiError('Mevcut şifre hatalı', 400);
      }

      // Yeni şifreyi hashle
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      // Şifreyi güncelle
      await User.updateOne({ _id: userId }, { $set: { passwordHash } });

      logger.info('Kullanıcı şifresi güncellendi', {
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Kullanıcı şifresi güncelleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
      });
      throw error;
    }
  }

  /**
   * Kullanıcıyı siler
   * @param userId - Kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Kullanıcıyı bul
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError('Kullanıcı bulunamadı', 404);
      }

      // Kullanıcıyı sil
      await User.deleteOne({ _id: userId });

      logger.info('Kullanıcı silindi', {
        userId,
        username: user.username,
      });

      return true;
    } catch (error) {
      logger.error('Kullanıcı silme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
      });
      throw error;
    }
  }

  /**
   * Kullanıcı listesini getirir
   * @param limit - Maksimum kullanıcı sayısı
   * @param skip - Atlanacak kullanıcı sayısı
   * @returns Kullanıcı listesi
   */
  async getUsers(limit = 20, skip = 0): Promise<UserDocument[]> {
    try {
      const users = await User.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

      return users;
    } catch (error) {
      logger.error('Kullanıcı listesi getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        limit,
        skip,
      });
      throw error;
    }
  }

  /**
   * Aktif kullanıcı sayısını getirir
   * @returns Aktif kullanıcı sayısı
   */
  async getActiveUserCount(): Promise<number> {
    try {
      const count = await User.countDocuments({ isActive: true });
      return count;
    } catch (error) {
      logger.error('Aktif kullanıcı sayısı getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      throw error;
    }
  }
}

// Servis örneğini oluştur
export const userService = new UserService();

// Hem default export hem de named export sağla
export default userService;
