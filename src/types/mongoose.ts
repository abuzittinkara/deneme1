/**
 * src/types/mongoose.ts
 * Mongoose ile ilgili ortak tip tanımlamaları
 */
import mongoose from 'mongoose';

/**
 * ObjectId tipi - string veya mongoose.Types.ObjectId olabilir
 */
export type ObjectId = mongoose.Types.ObjectId | string;

/**
 * Verilen ID'yi mongoose.Types.ObjectId'ye dönüştürür
 * @param id - Dönüştürülecek ID (string veya ObjectId)
 * @returns mongoose.Types.ObjectId
 */
export function toObjectId(id: ObjectId): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id.toString());
}

/**
 * Verilen değerin mongoose.Types.ObjectId olup olmadığını kontrol eder
 * @param value - Kontrol edilecek değer
 * @returns Değer bir ObjectId ise true, değilse false
 */
export function isObjectId(value: any): value is mongoose.Types.ObjectId {
  return value instanceof mongoose.Types.ObjectId;
}

/**
 * İki ObjectId'nin eşit olup olmadığını kontrol eder
 * @param id1 - Birinci ID
 * @param id2 - İkinci ID
 * @returns ID'ler eşitse true, değilse false
 */
export function objectIdEquals(id1: ObjectId, id2: ObjectId): boolean {
  return toObjectId(id1).equals(toObjectId(id2));
}
