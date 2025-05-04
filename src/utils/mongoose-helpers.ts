/**
 * src/utils/mongoose-helpers.ts
 * Mongoose model işlemleri için yardımcı fonksiyonlar
 */
import mongoose, { Document, Model, Query, QueryWithHelpers } from 'mongoose';
import { logger } from './logger';

/**
 * Mongoose sorgu zincirini tip güvenli hale getiren yardımcı sınıf
 * @template T - Doküman tipi
 * @template R - Dönüş tipi (tek doküman, doküman dizisi veya null)
 */
export class TypedQuery<T extends Document, R = T | T[] | null> {
  private query: Query<unknown, unknown>;

  constructor(query: Query<unknown, unknown>) {
    this.query = query;
  }

  /**
   * Sorguyu çalıştırır ve sonuçları döndürür
   * @returns Sorgu sonuçları
   */
  async exec(): Promise<R> {
    try {
      return await this.query.exec() as R;
    } catch (error) {
      logger.error('Mongoose sorgu hatası', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Sorguya populate ekler
   * @param path - Populate edilecek alan
   * @param select - Seçilecek alanlar
   * @returns Zincir sorgu nesnesi
   */
  populate(path: string, select?: string): TypedQuery<T, R> {
    this.query = this.query.populate(path, select);
    return this;
  }

  /**
   * Sorguya populate ekler (nesne versiyonu)
   * @param options - Populate seçenekleri
   * @returns Zincir sorgu nesnesi
   */
  populateObject(options: mongoose.PopulateOptions | mongoose.PopulateOptions[]): TypedQuery<T, R> {
    this.query = this.query.populate(options);
    return this;
  }

  /**
   * Sorguya select ekler
   * @param fields - Seçilecek alanlar
   * @returns Zincir sorgu nesnesi
   */
  select(fields: string): TypedQuery<T, R> {
    this.query = this.query.select(fields);
    return this;
  }

  /**
   * Sorguya sort ekler
   * @param fields - Sıralama alanları
   * @returns Zincir sorgu nesnesi
   */
  sort(fields: string | Record<string, 1 | -1>): TypedQuery<T, R> {
    this.query = this.query.sort(fields);
    return this;
  }

  /**
   * Sorguya limit ekler
   * @param limit - Limit değeri
   * @returns Zincir sorgu nesnesi
   */
  limit(limit: number): TypedQuery<T, R> {
    this.query = this.query.limit(limit);
    return this;
  }

  /**
   * Sorguya skip ekler
   * @param skip - Skip değeri
   * @returns Zincir sorgu nesnesi
   */
  skip(skip: number): TypedQuery<T, R> {
    this.query = this.query.skip(skip);
    return this;
  }

  /**
   * Sorguya lean ekler
   * @returns Zincir sorgu nesnesi
   */
  lean(): TypedQuery<T, R> {
    this.query = this.query.lean();
    return this;
  }

  /**
   * Sorgu sonucunu döndürür (Promise olarak)
   * @returns Sorgu sonucu
   */
  then<TResult1 = R, TResult2 = never>(
    onfulfilled?: ((value: R) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  /**
   * Sorgu sonucunu döndürür (Promise olarak)
   * @returns Sorgu sonucu
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<R | TResult> {
    return this.exec().catch(onrejected);
  }
};

/**
 * Mongoose model metodlarını tip güvenli hale getiren yardımcı fonksiyon
 * @template T - Doküman tipi
 * @template M - Model tipi (opsiyonel)
 * @param model - Mongoose model
 * @returns Tip güvenli model metodları
 */
export function createModelHelper<T extends Document, M = any>(model: M & { modelName?: string }) {
  return {
    /**
     * Belirtilen filtreye göre tek bir doküman bulur
     * @param filter - Filtre
     * @param projection - Projeksiyon
     * @param options - Seçenekler
     * @returns Bulunan doküman veya null
     */
    findOne(
      filter: mongoose.FilterQuery<T>,
      projection?: mongoose.ProjectionType<T>,
      options?: mongoose.QueryOptions
    ): TypedQuery<T, T | null> {
      try {
        const query = (model as any).findOne(filter, projection, options);
        return new TypedQuery<T, T | null>(query);
      } catch (error) {
        logger.error(`${model.modelName}.findOne hatası`, { error: (error as Error).message, filter });
        throw error;
      }
    },

    /**
     * ID'ye göre doküman bulur
     * @param id - Doküman ID'si
     * @param projection - Projeksiyon
     * @param options - Seçenekler
     * @returns Bulunan doküman veya null
     */
    findById(
      id: mongoose.Types.ObjectId | string,
      projection?: mongoose.ProjectionType<T>,
      options?: mongoose.QueryOptions
    ): TypedQuery<T, T | null> {
      try {
        const query = (model as any).findById(id, projection, options);
        return new TypedQuery<T, T | null>(query);
      } catch (error) {
        logger.error(`${model.modelName}.findById hatası`, { error: (error as Error).message, id });
        throw error;
      }
    },

    /**
     * Belirtilen filtreye göre dokümanları bulur
     * @param filter - Filtre
     * @param projection - Projeksiyon
     * @param options - Seçenekler
     * @returns Bulunan dokümanlar
     */
    find(
      filter: mongoose.FilterQuery<T>,
      projection?: mongoose.ProjectionType<T>,
      options?: mongoose.QueryOptions
    ): TypedQuery<T, T[]> {
      try {
        const query = (model as any).find(filter, projection, options);
        return new TypedQuery<T, T[]>(query);
      } catch (error) {
        logger.error(`${model.modelName}.find hatası`, { error: (error as Error).message, filter });
        throw error;
      }
    },

    /**
     * Yeni doküman oluşturur
     * @param doc - Doküman verileri
     * @returns Oluşturulan doküman
     */
    async create(doc: mongoose.AnyKeys<T>): Promise<T> {
      try {
        return await (model as any).create(doc);
      } catch (error) {
        logger.error(`${model.modelName}.create hatası`, { error: (error as Error).message });
        throw error;
      }
    },

    /**
     * Birden fazla doküman oluşturur
     * @param docs - Doküman verileri dizisi
     * @returns Oluşturulan dokümanlar
     */
    async createMany(docs: mongoose.AnyKeys<T>[]): Promise<T[]> {
      try {
        return await (model as any).create(docs);
      } catch (error) {
        logger.error(`${model.modelName}.createMany hatası`, { error: (error as Error).message });
        throw error;
      }
    },

    /**
     * Belirtilen filtreye göre dokümanı günceller
     * @param filter - Filtre
     * @param update - Güncelleme verileri
     * @param options - Seçenekler
     * @returns Güncellenen doküman veya null
     */
    async findOneAndUpdate(
      filter: mongoose.FilterQuery<T>,
      update: mongoose.UpdateQuery<T>,
      options?: mongoose.QueryOptions
    ): Promise<T | null> {
      try {
        return await (model as any).findOneAndUpdate(filter, update, { new: true, ...options });
      } catch (error) {
        logger.error(`${model.modelName}.findOneAndUpdate hatası`, { error: (error as Error).message, filter });
        throw error;
      }
    },

    /**
     * ID'ye göre dokümanı günceller
     * @param id - Doküman ID'si
     * @param update - Güncelleme verileri
     * @param options - Seçenekler
     * @returns Güncellenen doküman veya null
     */
    async findByIdAndUpdate(
      id: mongoose.Types.ObjectId | string,
      update: mongoose.UpdateQuery<T>,
      options?: mongoose.QueryOptions
    ): Promise<T | null> {
      try {
        return await (model as any).findByIdAndUpdate(id, update, { new: true, ...options });
      } catch (error) {
        logger.error(`${model.modelName}.findByIdAndUpdate hatası`, { error: (error as Error).message, id });
        throw error;
      }
    },

    /**
     * Belirtilen filtreye göre dokümanı siler
     * @param filter - Filtre
     * @param options - Seçenekler
     * @returns Silinen doküman veya null
     */
    async findOneAndDelete(
      filter: mongoose.FilterQuery<T>,
      options?: mongoose.QueryOptions
    ): Promise<T | null> {
      try {
        return await (model as any).findOneAndDelete(filter, options);
      } catch (error) {
        logger.error(`${model.modelName}.findOneAndDelete hatası`, { error: (error as Error).message, filter });
        throw error;
      }
    },

    /**
     * ID'ye göre dokümanı siler
     * @param id - Doküman ID'si
     * @param options - Seçenekler
     * @returns Silinen doküman veya null
     */
    async findByIdAndDelete(
      id: mongoose.Types.ObjectId | string,
      options?: mongoose.QueryOptions
    ): Promise<T | null> {
      try {
        return await (model as any).findByIdAndDelete(id, options);
      } catch (error) {
        logger.error(`${model.modelName}.findByIdAndDelete hatası`, { error: (error as Error).message, id });
        throw error;
      }
    },

    /**
     * Belirtilen filtreye göre dokümanları sayar
     * @param filter - Filtre
     * @returns Doküman sayısı
     */
    async countDocuments(filter: mongoose.FilterQuery<T>): Promise<number> {
      try {
        return await (model as any).countDocuments(filter);
      } catch (error) {
        logger.error(`${model.modelName}.countDocuments hatası`, { error: (error as Error).message, filter });
        throw error;
      }
    },



    /**
     * Belirtilen filtreye göre dokümanları günceller
     * @param filter - Filtre
     * @param update - Güncelleme verileri
     * @param options - Seçenekler
     * @returns Güncelleme sonucu
     */
    async updateMany(
      filter: mongoose.FilterQuery<T>,
      update: mongoose.UpdateQuery<T>,
      options?: mongoose.QueryOptions
    ): Promise<mongoose.UpdateWriteOpResult> {
      try {
        return await (model as any).updateMany(filter, update, options);
      } catch (error) {
        logger.error(`${model.modelName}.updateMany hatası`, { error: (error as Error).message, filter });
        throw error;
      }
    },

    /**
     * Belirtilen filtreye göre dokümanları siler
     * @param filter - Filtre
     * @param options - Seçenekler
     * @returns Silme sonucu
     */
    async deleteMany(
      filter: mongoose.FilterQuery<T>,
      options?: mongoose.QueryOptions
    ): Promise<mongoose.DeleteResult> {
      try {
        return await (model as any).deleteMany(filter, options);
      } catch (error) {
        logger.error(`${model.modelName}.deleteMany hatası`, { error: (error as Error).message, filter });
        throw error;
      }
    },



    /**
     * Orijinal model nesnesini döndürür
     * @returns Orijinal model nesnesi
     */
    getModel(): typeof model {
      return model;
    }
  };
}

/**
 * String veya ObjectId'yi ObjectId'ye dönüştürür
 * @param id - String veya ObjectId
 * @returns ObjectId
 */
export function toObjectId(id: string | mongoose.Types.ObjectId | { _id?: any; id?: string } | unknown): mongoose.Types.ObjectId {
  if (typeof id === 'string') {
    return new mongoose.Types.ObjectId(id);
  }
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }
  if (id && typeof id === 'object') {
    if ('_id' in id && id._id) {
      return toObjectId((id as any)._id);
    }
    if ('id' in id && (id as any).id && typeof (id as any).id === 'string') {
      return new mongoose.Types.ObjectId((id as any).id);
    }
  }
  throw new Error(`Invalid ObjectId: ${id}`);
}

/**
 * İki ObjectId'nin eşit olup olmadığını kontrol eder
 * @param id1 - Birinci ObjectId
 * @param id2 - İkinci ObjectId
 * @returns Eşit ise true, değilse false
 */
export function objectIdEquals(
  id1: mongoose.Types.ObjectId | string | { _id?: any; id?: string } | unknown | undefined | null,
  id2: mongoose.Types.ObjectId | string | { _id?: any; id?: string } | unknown | undefined | null
): boolean {
  if (!id1 || !id2) return false;

  try {
    let objId1: mongoose.Types.ObjectId | null = null;
    let objId2: mongoose.Types.ObjectId | null = null;

    // İlk ID'yi dönüştür
    if (typeof id1 === 'string') {
      objId1 = new mongoose.Types.ObjectId(id1);
    } else if (id1 instanceof mongoose.Types.ObjectId) {
      objId1 = id1;
    } else if (id1 && typeof id1 === 'object') {
      if ('_id' in id1 && id1._id) {
        objId1 = toObjectId(id1._id);
      } else if ('id' in id1 && id1.id && typeof id1.id === 'string') {
        objId1 = new mongoose.Types.ObjectId(id1.id);
      }
    }

    // İkinci ID'yi dönüştür
    if (typeof id2 === 'string') {
      objId2 = new mongoose.Types.ObjectId(id2);
    } else if (id2 instanceof mongoose.Types.ObjectId) {
      objId2 = id2;
    } else if (id2 && typeof id2 === 'object') {
      if ('_id' in id2 && id2._id) {
        objId2 = toObjectId(id2._id);
      } else if ('id' in id2 && id2.id && typeof id2.id === 'string') {
        objId2 = new mongoose.Types.ObjectId(id2.id);
      }
    }

    if (!objId1 || !objId2) return false;

    return objId1.equals(objId2);
  } catch (error) {
    return false;
  }
}

const mongooseHelpers = {
  createModelHelper,
  toObjectId,
  objectIdEquals
};

export default mongooseHelpers;