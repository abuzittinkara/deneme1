/**
 * src/types/mongoose.d.ts
 * Mongoose için tip tanımlamaları
 */
import { Document, Model } from 'mongoose';

// Mongoose ObjectId için tip tanımlaması
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Mongoose model için tip tanımlaması
export type ModelType<T extends Document> = Model<T>;

// Mongoose document için tip tanımlaması
export type DocumentType<T> = Document & T;

// Mongoose ObjectId için tip tanımlaması
export type ObjectId = string | import('mongoose').Types.ObjectId;

// Mongoose ObjectId oluşturmak için yardımcı fonksiyon
export function toObjectId(id: any): import('mongoose').Types.ObjectId;

// Mongoose ObjectId referansı için tip tanımlaması
export type Ref<T> = T | import('mongoose').Types.ObjectId | string;

// Mongoose populate için tip tanımlaması
export type Populated<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] extends Array<Ref<infer U>> ? U[] : T[P] extends Ref<infer U> ? U : T[P];
};

// Mongoose query için tip tanımlaması
export interface QueryOptions {
  lean?: boolean;
  populate?: string | string[] | { path: string; select?: string; populate?: any }[];
  select?: string | string[];
  sort?: string | { [key: string]: 1 | -1 };
  limit?: number;
  skip?: number;
  session?: any;
}

// Mongoose update için tip tanımlaması
export interface UpdateOptions {
  new?: boolean;
  upsert?: boolean;
  runValidators?: boolean;
  setDefaultsOnInsert?: boolean;
  session?: any;
}

// Mongoose delete için tip tanımlaması
export interface DeleteOptions {
  session?: any;
}

// Mongoose create için tip tanımlaması
export interface CreateOptions {
  session?: any;
}

// Mongoose aggregate için tip tanımlaması
export interface AggregateOptions {
  session?: any;
}

// Mongoose transaction için tip tanımlaması
export interface TransactionOptions {
  readPreference?: string;
  readConcern?: { level: string };
  writeConcern?: { w: string | number; j: boolean; wtimeout: number };
}

// Mongoose pagination için tip tanımlaması
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string | { [key: string]: 1 | -1 };
  populate?: string | string[] | { path: string; select?: string; populate?: any }[];
  select?: string | string[];
}

// Mongoose pagination sonucu için tip tanımlaması
export interface PaginationResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}
