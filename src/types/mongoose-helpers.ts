/**
 * src/types/mongoose-helpers.ts
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
  PipelineStage,
  ProjectionType,
} from 'mongoose';

/**
 * Mongoose model tipi için güncellenmiş tip yardımcısı
 * Bu tip, Model<T> kullanırken gerekli olan tüm tip parametrelerini otomatik olarak doldurur
 */
export type TypedModel<
  TRawDocType,
  TQueryHelpers = {},
  TInstanceMethods = {},
  TVirtuals = {},
  THydratedDocumentType = HydratedDocument<TRawDocType, TVirtuals, TInstanceMethods>,
  TSchema = any,
  TSchemaDefinition = any,
  TSchemaOptions = any,
  TStaticMethods = {},
> = Model<
  TRawDocType,
  TQueryHelpers,
  TInstanceMethods,
  TVirtuals,
  THydratedDocumentType,
  TSchema,
  TSchemaDefinition,
  TSchemaOptions,
  TStaticMethods
>;

/**
 * Mongoose belge tipi için güncellenmiş tip yardımcısı
 * @template T - Doküman tipi
 * @template TInstanceMethods - Örnek metodları
 */
export type TypedDocument<T, TInstanceMethods = {}> = Document<unknown, {}, T> &
  T &
  TInstanceMethods;

/**
 * Mongoose model için temel statik metodlar
 */
export interface CommonModelStaticMethods<T extends Document> {
  findById(id: mongoose.Types.ObjectId | string): MongooseQuery<T | null>;
  findOne(filter: FilterQuery<T>, projection?: ProjectionType<T>): MongooseQuery<T | null>;
  find(filter: FilterQuery<T>, projection?: ProjectionType<T>): MongooseQuery<T[]>;
  create(doc: Partial<T>): Promise<T>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  updateMany(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<mongoose.UpdateWriteOpResult>;
  deleteOne(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  deleteMany(filter: FilterQuery<T>): Promise<mongoose.DeleteResult>;
  countDocuments(filter: FilterQuery<T>): Promise<number>;
  aggregate(pipeline: PipelineStage[]): mongoose.Aggregate<any[]>;
}

/**
 * Mongoose model için yardımcı fonksiyon
 * @param model - Mongoose model
 * @returns Tip güvenli model
 */
export function createModelHelper<
  T extends Document,
  TQueryHelpers = {},
  TInstanceMethods = {},
  TVirtuals = {},
  THydratedDocumentType = HydratedDocument<T, TVirtuals, TInstanceMethods>,
>(
  model: Model<T, TQueryHelpers, TInstanceMethods, TVirtuals, THydratedDocumentType>
): Model<T, TQueryHelpers, TInstanceMethods, TVirtuals, THydratedDocumentType> &
  CommonModelStaticMethods<T> {
  return model as Model<T, TQueryHelpers, TInstanceMethods, TVirtuals, THydratedDocumentType> &
    CommonModelStaticMethods<T>;
}

/**
 * ObjectId veya string tipi için birleşik tip
 */
export type ID = mongoose.Types.ObjectId | string;

/**
 * ObjectId oluşturmak için yardımcı fonksiyon
 * @param id - ID değeri
 * @returns ObjectId
 */
export function toObjectId(id: ID): mongoose.Types.ObjectId {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

/**
 * Mongoose Query tipi
 * @template T - Doküman tipi
 */
export type MongooseQuery<T> = mongoose.Query<T, Document> & {
  exec(): Promise<T>;
  select(projection: string | object): MongooseQuery<T>;
  sort(sort: string | object): MongooseQuery<T>;
  limit(limit: number): MongooseQuery<T>;
  skip(skip: number): MongooseQuery<T>;
  populate(path: string, select?: string): MongooseQuery<T>;
  populate(options: object): MongooseQuery<T>;
  lean(lean?: boolean): MongooseQuery<T>;
  where(path: string, val?: any): MongooseQuery<T>;
  equals(val: any): MongooseQuery<T>;
  ne(val: any): MongooseQuery<T>;
  gt(val: any): MongooseQuery<T>;
  gte(val: any): MongooseQuery<T>;
  lt(val: any): MongooseQuery<T>;
  lte(val: any): MongooseQuery<T>;
  in(val: any[]): MongooseQuery<T>;
  nin(val: any[]): MongooseQuery<T>;
  or(conditions: any[]): MongooseQuery<T>;
  and(conditions: any[]): MongooseQuery<T>;
  count(): Promise<number>;
  distinct(field: string): Promise<any[]>;
};

/**
 * Mongoose model için temel metodlar
 * @template T - Doküman tipi
 */
export interface BaseModelMethods<T extends Document> {
  find(filter?: any, projection?: any, options?: any): MongooseQuery<T[]>;
  findOne(filter?: any, projection?: any, options?: any): MongooseQuery<T | null>;
  findById(id: ID, projection?: any, options?: any): MongooseQuery<T | null>;
  create(doc: Partial<T>): Promise<T>;
  updateOne(filter: any, update: any, options?: any): Promise<mongoose.UpdateWriteOpResult>;
  updateMany(filter: any, update: any, options?: any): Promise<mongoose.UpdateWriteOpResult>;
  deleteOne(filter: any, options?: any): Promise<mongoose.DeleteResult>;
  deleteMany(filter: any, options?: any): Promise<mongoose.DeleteResult>;
  countDocuments(filter?: any): Promise<number>;
  findByIdAndUpdate(id: ID, update: any, options?: any): MongooseQuery<T | null>;
  findByIdAndDelete(id: ID, options?: any): MongooseQuery<T | null>;
  aggregate(pipeline: any[]): mongoose.Aggregate<any[]>;
  distinct(field: string, filter?: any): Promise<any[]>;
}

/**
 * Mongoose model için tam tip tanımı
 * @template T - Doküman tipi
 * @template TQueryHelpers - Sorgu yardımcıları
 * @template TInstanceMethods - Örnek metodları
 * @template TStaticMethods - Statik metodlar
 */
export type FullModelType<
  T extends Document,
  TQueryHelpers = {},
  TInstanceMethods = {},
  TStaticMethods = {},
  TVirtuals = {},
  THydratedDocumentType = HydratedDocument<T, TVirtuals, TInstanceMethods>,
> = Model<T, TQueryHelpers, TInstanceMethods, TVirtuals, THydratedDocumentType> &
  BaseModelMethods<T> &
  TStaticMethods & {
    new (data: Partial<T>): T;
  };
