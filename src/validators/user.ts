/**
 * src/validators/user.ts
 * Kullanıcı doğrulama şemaları
 */

import { z } from 'zod';
import { UserStatus, UserRole } from '../types/common';

/**
 * Kullanıcı oluşturma şeması
 */
export const userCreateSchema = z.object({
  username: z.string()
    .min(3, { message: 'Kullanıcı adı en az 3 karakter olmalıdır' })
    .max(30, { message: 'Kullanıcı adı en fazla 30 karakter olabilir' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir' }),
  
  email: z.string()
    .email({ message: 'Geçerli bir e-posta adresi giriniz' })
    .max(100, { message: 'E-posta adresi çok uzun' }),
  
  password: z.string()
    .min(8, { message: 'Şifre en az 8 karakter olmalıdır' })
    .max(100, { message: 'Şifre çok uzun' }),
  
  displayName: z.string()
    .min(2, { message: 'Görünen ad en az 2 karakter olmalıdır' })
    .max(50, { message: 'Görünen ad en fazla 50 karakter olabilir' })
    .optional(),
  
  avatar: z.string().url({ message: 'Geçerli bir URL giriniz' }).optional()
});

/**
 * Kullanıcı güncelleme şeması
 */
export const userUpdateSchema = z.object({
  email: z.string()
    .email({ message: 'Geçerli bir e-posta adresi giriniz' })
    .max(100, { message: 'E-posta adresi çok uzun' })
    .optional(),
  
  password: z.string()
    .min(8, { message: 'Şifre en az 8 karakter olmalıdır' })
    .max(100, { message: 'Şifre çok uzun' })
    .optional(),
  
  displayName: z.string()
    .min(2, { message: 'Görünen ad en az 2 karakter olmalıdır' })
    .max(50, { message: 'Görünen ad en fazla 50 karakter olabilir' })
    .optional(),
  
  avatar: z.string().url({ message: 'Geçerli bir URL giriniz' }).optional(),
  
  bio: z.string().max(500, { message: 'Biyografi en fazla 500 karakter olabilir' }).optional(),
  
  status: z.enum([UserStatus.ONLINE, UserStatus.AWAY, UserStatus.DND, UserStatus.INVISIBLE, UserStatus.OFFLINE])
    .optional()
});

/**
 * Kullanıcı giriş şeması
 */
export const userLoginSchema = z.object({
  username: z.string().min(1, { message: 'Kullanıcı adı gereklidir' }),
  password: z.string().min(1, { message: 'Şifre gereklidir' }),
  rememberMe: z.boolean().optional()
});

/**
 * Şifre değiştirme şeması
 */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Mevcut şifre gereklidir' }),
  newPassword: z.string()
    .min(8, { message: 'Yeni şifre en az 8 karakter olmalıdır' })
    .max(100, { message: 'Yeni şifre çok uzun' }),
  confirmPassword: z.string().min(1, { message: 'Şifre onayı gereklidir' })
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword']
});

/**
 * Şifre sıfırlama şeması
 */
export const passwordResetRequestSchema = z.object({
  email: z.string().email({ message: 'Geçerli bir e-posta adresi giriniz' })
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, { message: 'Token gereklidir' }),
  newPassword: z.string()
    .min(8, { message: 'Yeni şifre en az 8 karakter olmalıdır' })
    .max(100, { message: 'Yeni şifre çok uzun' }),
  confirmPassword: z.string().min(1, { message: 'Şifre onayı gereklidir' })
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword']
});

// Şema tiplerini dışa aktar
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
