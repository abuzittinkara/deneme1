/**
 * src/types/mongoose-model.ts
 * Mongoose model için tip tanımlamaları
 */
import mongoose, {
  Document,
  Model,
  Schema,
  Query,
  HydratedDocument,
  QueryWithHelpers,
  FilterQuery,
  UpdateQuery,
  PipelineStage,
  ProjectionType,
  SchemaDefinitionProperty,
  SchemaOptions,
  SchemaDefinition,
} from 'mongoose';

/**
 * Mongoose model için tam tip tanımı
 * @template TRawDocType - Doküman tipi
 * @template TQueryHelpers - Sorgu yardımcıları
 * @template TInstanceMethods - Örnek metodları
 * @template TVirtuals - Sanal alanlar
 * @template TStaticMethods - Statik metodlar
 */
export type FullModelType<
  TRawDocType extends Document,
  TQueryHelpers = {},
  TInstanceMethods = {},
  TVirtuals = {},
  TStaticMethods = {},
  TSchema extends Schema<any, any, any> = Schema<
    TRawDocType,
    Model<TRawDocType, TQueryHelpers, TInstanceMethods, TVirtuals>,
    TInstanceMethods,
    TQueryHelpers,
    TVirtuals,
    TStaticMethods
  >,
  TSchemaDefinition = SchemaDefinition<SchemaDefinitionProperty<TRawDocType>>,
  TSchemaOptions = SchemaOptions,
  THydratedDocumentType = HydratedDocument<TRawDocType, TVirtuals, TInstanceMethods>,
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
> &
  TStaticMethods & {
    new (data: Partial<TRawDocType>): THydratedDocumentType;
  };

/**
 * Mongoose model için temel statik metodlar
 * @template T - Doküman tipi
 */
export interface BaseModelMethods<T extends Document> {
  findById(id: mongoose.Types.ObjectId | string): Query<T | null, T>;
  findOne(filter?: FilterQuery<T>, projection?: ProjectionType<T>): Query<T | null, T>;
  find(filter?: FilterQuery<T>, projection?: ProjectionType<T>): Query<T[], T>;
  create(doc: Partial<T>): Promise<T>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Query<mongoose.UpdateWriteOpResult, T>;
  updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Query<mongoose.UpdateWriteOpResult, T>;
  deleteOne(filter: FilterQuery<T>): Query<mongoose.DeleteResult, T>;
  deleteMany(filter: FilterQuery<T>): Query<mongoose.DeleteResult, T>;
  countDocuments(filter?: FilterQuery<T>): Query<number, T>;
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
  TStaticMethods = {},
  TSchema extends Schema<any, any, any> = Schema<
    T,
    Model<T, TQueryHelpers, TInstanceMethods, TVirtuals>,
    TInstanceMethods,
    TQueryHelpers,
    TVirtuals,
    TStaticMethods
  >,
  TSchemaDefinition = SchemaDefinition<SchemaDefinitionProperty<T>>,
  TSchemaOptions = SchemaOptions,
  THydratedDocumentType = HydratedDocument<T, TVirtuals, TInstanceMethods>,
>(
  model: Model<
    T,
    TQueryHelpers,
    TInstanceMethods,
    TVirtuals,
    THydratedDocumentType,
    TSchema,
    TSchemaDefinition,
    TSchemaOptions,
    TStaticMethods
  >
): FullModelType<
  T,
  TQueryHelpers,
  TInstanceMethods,
  TVirtuals,
  TStaticMethods,
  TSchema,
  TSchemaDefinition,
  TSchemaOptions,
  THydratedDocumentType
> {
  return model as FullModelType<
    T,
    TQueryHelpers,
    TInstanceMethods,
    TVirtuals,
    TStaticMethods,
    TSchema,
    TSchemaDefinition,
    TSchemaOptions,
    THydratedDocumentType
  >;
}

/**
 * Mongoose belge tipi için yardımcı tip
 * @template T - Doküman tipi
 * @template TInstanceMethods - Örnek metodları
 */
export type TypedDocument<T, TInstanceMethods = {}> = Document<unknown, {}, T> &
  T &
  TInstanceMethods;

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
