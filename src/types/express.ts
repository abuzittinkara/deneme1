/**
 * src/types/express.ts
 * Express tipi tanımlamaları
 */
import { Request } from 'express';
import { UserDocument } from '../models/User';

/**
 * Kimlik doğrulaması yapılmış kullanıcı
 */
export interface AuthUser {
  id?: string;
  _id?: any;
  username?: string;
  role?: string;
  sub?: string;
  email?: string;
  name?: string;
  surname?: string;
  profilePicture?: string;
  [key: string]: any;
}

/**
 * Kimlik doğrulama yapılmış istek
 */
export interface AuthRequest extends Request {
  user: AuthUser | UserDocument;
  token?: string;
}

/**
 * Dosya yükleme isteği
 */
export interface FileUploadRequest extends Request {
  file?: Express.Multer.File;
  files?: { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Kimlik doğrulama yapılmış dosya yükleme isteği
 */
export interface AuthFileUploadRequest extends Omit<AuthRequest, 'files'> {
  // FileUploadRequest'ten alınan alanlar
  files?: { [fieldname: string]: Express.Multer.File[] };
  file?: Express.Multer.File;
}
