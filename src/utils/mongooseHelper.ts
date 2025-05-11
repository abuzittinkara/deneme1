/**
 * src/utils/mongooseHelper.ts
 * Mongoose yardımcı fonksiyonları
 */
import mongoose, { Types } from 'mongoose';

/**
 * Herhangi bir değeri ObjectId'ye dönüştürür
 * @param id - Dönüştürülecek değer
 * @returns ObjectId
 */
export function toObjectId(id: any): Types.ObjectId {
  if (!id) {
    return new Types.ObjectId();
  }
  if (id instanceof Types.ObjectId) {
    return id;
  }
  if (typeof id === 'string') {
    return new Types.ObjectId(id);
  }
  if (id && id.toString && typeof id.toString === 'function') {
    return new Types.ObjectId(id.toString());
  }
  return id;
}

/**
 * İki ObjectId'nin eşit olup olmadığını kontrol eder
 * @param id1 - Birinci ID
 * @param id2 - İkinci ID
 * @returns Eşit mi
 */
export function objectIdEquals(id1: any, id2: any): boolean {
  if (!id1 || !id2) return false;

  // ObjectId nesnelerini string'e dönüştür
  const objId1 =
    id1 instanceof Types.ObjectId ? id1.toString() : typeof id1 === 'string' ? id1 : String(id1);
  const objId2 =
    id2 instanceof Types.ObjectId ? id2.toString() : typeof id2 === 'string' ? id2 : String(id2);

  return objId1 === objId2;
}

/**
 * Bir değerin geçerli bir ObjectId olup olmadığını kontrol eder
 * @param id - Kontrol edilecek değer
 * @returns Geçerli mi
 */
export function isValidObjectId(id: any): boolean {
  return Types.ObjectId.isValid(id);
}

export default {
  toObjectId,
  objectIdEquals,
  isValidObjectId,
};
