/**
 * src/validations/groupValidation.ts
 * Grup doğrulama şemaları
 */
import Joi from 'joi';

/**
 * Grup oluşturma doğrulama şeması
 */
const createGroup = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.base': 'Grup adı metin olmalıdır',
    'string.empty': 'Grup adı boş olamaz',
    'string.min': 'Grup adı en az {#limit} karakter olmalıdır',
    'string.max': 'Grup adı en fazla {#limit} karakter olabilir',
    'any.required': 'Grup adı zorunludur',
  }),

  description: Joi.string().max(200).allow('').optional().messages({
    'string.base': 'Grup açıklaması metin olmalıdır',
    'string.max': 'Grup açıklaması en fazla {#limit} karakter olabilir',
  }),

  isPrivate: Joi.boolean().optional().messages({
    'boolean.base': 'Özel grup değeri boolean olmalıdır',
  }),
});

/**
 * Gruba katılma doğrulama şeması
 */
const joinGroup = Joi.object({
  inviteCode: Joi.string().required().messages({
    'string.base': 'Davet kodu metin olmalıdır',
    'string.empty': 'Davet kodu boş olamaz',
    'any.required': 'Davet kodu zorunludur',
  }),
});

/**
 * Grup güncelleme doğrulama şeması
 */
const updateGroup = Joi.object({
  name: Joi.string().min(2).max(50).optional().messages({
    'string.base': 'Grup adı metin olmalıdır',
    'string.empty': 'Grup adı boş olamaz',
    'string.min': 'Grup adı en az {#limit} karakter olmalıdır',
    'string.max': 'Grup adı en fazla {#limit} karakter olabilir',
  }),

  description: Joi.string().max(200).allow('').optional().messages({
    'string.base': 'Grup açıklaması metin olmalıdır',
    'string.max': 'Grup açıklaması en fazla {#limit} karakter olabilir',
  }),

  isPrivate: Joi.boolean().optional().messages({
    'boolean.base': 'Özel grup değeri boolean olmalıdır',
  }),
});

/**
 * Kanal oluşturma doğrulama şeması
 */
const createChannel = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.base': 'Kanal adı metin olmalıdır',
    'string.empty': 'Kanal adı boş olamaz',
    'string.min': 'Kanal adı en az {#limit} karakter olmalıdır',
    'string.max': 'Kanal adı en fazla {#limit} karakter olabilir',
    'any.required': 'Kanal adı zorunludur',
  }),

  description: Joi.string().max(200).allow('').optional().messages({
    'string.base': 'Kanal açıklaması metin olmalıdır',
    'string.max': 'Kanal açıklaması en fazla {#limit} karakter olabilir',
  }),

  type: Joi.string().valid('text', 'voice').required().messages({
    'string.base': 'Kanal tipi metin olmalıdır',
    'string.empty': 'Kanal tipi boş olamaz',
    'any.only': 'Kanal tipi text veya voice olmalıdır',
    'any.required': 'Kanal tipi zorunludur',
  }),
});

/**
 * Üye ekleme doğrulama şeması
 */
const addMember = Joi.object({
  userId: Joi.string().required().messages({
    'string.base': 'Kullanıcı ID metin olmalıdır',
    'string.empty': 'Kullanıcı ID boş olamaz',
    'any.required': 'Kullanıcı ID zorunludur',
  }),

  role: Joi.string().valid('admin', 'member').default('member').optional().messages({
    'string.base': 'Rol metin olmalıdır',
    'any.only': 'Rol admin veya member olmalıdır',
  }),
});

export const groupValidation = {
  createGroup,
  joinGroup,
  updateGroup,
  createChannel,
  addMember,
};

export default groupValidation;
