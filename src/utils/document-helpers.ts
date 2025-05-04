/**
 * src/utils/document-helpers.ts
 * Mongoose belge erişimi için yardımcı fonksiyonlar
 */
import { Document } from 'mongoose';

/**
 * Mongoose belgesinden güvenli bir şekilde alan almak için yardımcı fonksiyon
 * @param doc - Mongoose belgesi
 * @param field - Alınacak alan
 * @param defaultValue - Varsayılan değer (alan bulunamazsa)
 * @returns Alan değeri veya varsayılan değer
 */
export function getDocField<T, K extends keyof T | string>(
  doc: Document | T | null | undefined,
  field: K,
  defaultValue: any
): any {
  if (!doc) {
    return defaultValue;
  }

  // Document tipinde ise toObject() metodunu kullan
  if (doc instanceof Document) {
    const obj = doc.toObject();
    return (obj as any)[field as string] ?? defaultValue;
  }

  // Düz nesne ise doğrudan erişim
  return (doc as any)[field as string] ?? defaultValue;
}

/**
 * Mongoose belgesini düz nesneye dönüştürmek için yardımcı fonksiyon
 * @param doc - Mongoose belgesi
 * @returns Düz nesne
 */
export function docToObject<T>(doc: Document | T | null | undefined): T | null {
  if (!doc) {
    return null;
  }

  // Document tipinde ise toObject() metodunu kullan
  if (doc instanceof Document) {
    return doc.toObject() as T;
  }

  // Zaten düz nesne ise doğrudan döndür
  return doc as T;
}

/**
 * Mongoose belge dizisini düz nesne dizisine dönüştürmek için yardımcı fonksiyon
 * @param docs - Mongoose belge dizisi
 * @returns Düz nesne dizisi
 */
export function docsToObjects<T>(docs: (Document | T)[] | null | undefined): T[] {
  if (!docs) {
    return [];
  }

  return docs.map(doc => {
    if (doc instanceof Document) {
      return doc.toObject() as T;
    }
    return doc as T;
  });
}

/**
 * Mongoose belgesini güvenli bir şekilde güncellemek için yardımcı fonksiyon
 * @param doc - Mongoose belgesi
 * @param updates - Güncellenecek alanlar
 * @returns Güncellenmiş belge
 */
export function updateDocFields<T>(
  doc: Document | null | undefined,
  updates: Partial<T>
): Document | null {
  if (!doc) {
    return null;
  }

  // Belgeyi güncelle
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) {
      // undefined değerleri için unset işlemi
      (doc as any)[key] = undefined;
    } else {
      (doc as any)[key] = value;
    }
  });

  return doc;
}

/**
 * Mongoose belgesini güvenli bir şekilde güncelleyip kaydetmek için yardımcı fonksiyon
 * @param doc - Mongoose belgesi
 * @param updates - Güncellenecek alanlar
 * @returns Güncellenmiş ve kaydedilmiş belge veya null
 */
export async function updateAndSaveDoc<T>(
  doc: Document | null | undefined,
  updates: Partial<T>
): Promise<Document | null> {
  const updatedDoc = updateDocFields<T>(doc, updates);
  if (!updatedDoc) {
    return null;
  }

  try {
    return await updatedDoc.save();
  } catch (error) {
    console.error('Belge kaydedilirken hata oluştu:', error);
    return null;
  }
}

/**
 * Mongoose belgesinden ID almak için yardımcı fonksiyon
 * @param doc - Mongoose belgesi
 * @returns ID string veya null
 */
export function getDocId(doc: Document | { _id?: any; id?: string } | null | undefined): string | null {
  if (!doc) {
    return null;
  }

  if (doc instanceof Document) {
    return doc._id?.toString() || null;
  }

  if (doc._id) {
    return doc._id.toString();
  }

  if ((doc as any).id) {
    return (doc as any).id;
  }

  return null;
}

/**
 * Mongoose belgesinden referans alanı almak için yardımcı fonksiyon
 * @param doc - Mongoose belgesi
 * @param field - Referans alanı
 * @returns Referans ID string veya null
 */
export function getDocRefId<T>(
  doc: Document | T | null | undefined,
  field: keyof T | string
): string | null {
  if (!doc) {
    return null;
  }

  let fieldValue: any;

  if (doc instanceof Document) {
    const obj = doc.toObject();
    fieldValue = obj[field as string];
  } else {
    fieldValue = (doc as any)[field as string];
  }

  if (!fieldValue) {
    return null;
  }

  // Referans bir ObjectId ise
  if (typeof fieldValue === 'object' && fieldValue._id) {
    return fieldValue._id.toString();
  }

  // Doğrudan bir ObjectId ise
  if (fieldValue.toString) {
    return fieldValue.toString();
  }

  return null;
}

/**
 * Belge dizisinden ID dizisi oluşturmak için yardımcı fonksiyon
 * @param docs - Belge dizisi
 * @returns ID dizisi
 */
export function getDocIds(docs: (Document | { _id?: any; id?: string })[] | null | undefined): string[] {
  if (!docs || !Array.isArray(docs)) {
    return [];
  }

  return docs
    .map(doc => getDocId(doc))
    .filter((id): id is string => id !== null);
}

/**
 * Belge dizisinden belirli bir alanın değerlerini çıkarmak için yardımcı fonksiyon
 * @param docs - Belge dizisi
 * @param field - Çıkarılacak alan
 * @param defaultValue - Varsayılan değer
 * @returns Alan değerleri dizisi
 */
export function getDocFieldsFromArray<T, K extends keyof T | string>(
  docs: (Document | T)[] | null | undefined,
  field: K,
  defaultValue: any
): any[] {
  if (!docs || !Array.isArray(docs)) {
    return [];
  }

  return docs.map(doc => getDocField<T, K>(doc, field, defaultValue));
}
