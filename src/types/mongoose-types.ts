/**
 * src/types/mongoose-types.ts
 * Mongoose için tip yardımcıları
 */
import mongoose, {
  Document,
  Model,
  Schema,
  HydratedDocument,
  QueryWithHelpers,
  FilterQuery,
  UpdateQuery,
  PipelineStage
} from 'mongoose';

/**
 * Mongoose model tipi için basitleştirilmiş tip yardımcısı
 * Bu tip, Model<T> kullanırken gerekli olan tüm tip parametrelerini otomatik olarak doldurur
 */
export type TypedModel<T, TQueryHelpers = {}> = mongoose.Model<
  T,
  TQueryHelpers,
  {},
  {},
  mongoose.Document<unknown, {}, T> & T,
  mongoose.Schema<T>,
  {},
  {},
  {},
  {},
  {}
>;

/**
 * Mongoose belge tipi için basitleştirilmiş tip yardımcısı
 * @template T - Doküman tipi
 * @template TInstanceMethods - Örnek metodları
 */
export type TypedDocument<T, TInstanceMethods = {}> = Document<unknown, {}, T> & T & TInstanceMethods;

/**
 * Mongoose model statik metodları için tip yardımcısı
 * @template T - Doküman tipi
 */
export interface BaseModelMethods<T> {
  findById(id: ID): Promise<T | null>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  find(filter: FilterQuery<T>): Promise<T[]>;
  create(doc: Partial<T>): Promise<T>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  updateMany(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  deleteOne(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  deleteMany(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  countDocuments(filter: FilterQuery<T>): Promise<number>;
}

/**
 * Mongoose model için tam tip tanımı
 * @template T - Doküman tipi
 * @template TQueryHelpers - Sorgu yardımcıları
 * @template TInstanceMethods - Örnek metodları
 */
export type FullModelType<T, TQueryHelpers = {}, TInstanceMethods = {}> = mongoose.Model<
  T,
  TQueryHelpers,
  TInstanceMethods,
  {},
  mongoose.Document<unknown, {}, T> & T & TInstanceMethods,
  mongoose.Schema<T, mongoose.Model<T, TQueryHelpers, TInstanceMethods>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, T>,
  {},
  {},
  {},
  {},
  {}
> & {
  findById(id: ID): Promise<TypedDocument<T> | null>;
  findOne(filter: FilterQuery<T>): Promise<TypedDocument<T> | null>;
  find(filter: FilterQuery<T>): Promise<TypedDocument<T>[]>;
  create(doc: Partial<T>): Promise<TypedDocument<T>>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  updateMany(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  deleteOne(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  deleteMany(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  countDocuments(filter: FilterQuery<T>): Promise<number>;
  aggregate(pipeline: PipelineStage[]): mongoose.Aggregate<any[]>;
};

/**
 * Mongoose sorgu tipi için basitleştirilmiş tip yardımcısı
 */
export type TypedQuery<T, TQueryHelpers = {}> = QueryWithHelpers<
  Array<T>,
  T,
  TQueryHelpers,
  T
>;

/**
 * Mongoose tekil sorgu tipi için basitleştirilmiş tip yardımcısı
 */
export type TypedQuerySingle<T, TQueryHelpers = {}> = QueryWithHelpers<
  T | null,
  T,
  TQueryHelpers,
  T
>;

/**
 * Mongoose ObjectId tipi için kısaltma
 */
export type ObjectId = mongoose.Types.ObjectId;

/**
 * ObjectId veya string tipi için birleşik tip
 */
export type ID = mongoose.Types.ObjectId | string;

/**
 * Mongoose model statik metodları için tip yardımcısı
 */
export interface BaseModelStaticMethods<T extends Document> {
  findByField?(field: string, value: any): Promise<T | null>;
}

/**
 * Mongoose model için temel statik metodlar
 */
export interface CommonModelStaticMethods<T extends Document> {
  findById(id: ID): Promise<T | null>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  find(filter: FilterQuery<T>): Promise<T[]>;
  create(doc: Partial<T>): Promise<T>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  updateMany(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  deleteOne(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  deleteMany(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  countDocuments(filter: FilterQuery<T>): Promise<number>;
  aggregate(pipeline: PipelineStage[]): mongoose.Aggregate<any[]>;
}
