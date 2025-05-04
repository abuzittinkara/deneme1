/**
 * src/validations/channelValidation.ts
 * Kanal doğrulama şemaları
 */
import Joi from 'joi';

/**
 * Kanal oluşturma doğrulama şeması
 */
const createChannel = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.base': 'Kanal adı metin olmalıdır',
      'string.empty': 'Kanal adı boş olamaz',
      'string.min': 'Kanal adı en az {#limit} karakter olmalıdır',
      'string.max': 'Kanal adı en fazla {#limit} karakter olabilir',
      'any.required': 'Kanal adı zorunludur'
    }),
  
  description: Joi.string()
    .max(200)
    .allow('')
    .optional()
    .messages({
      'string.base': 'Kanal açıklaması metin olmalıdır',
      'string.max': 'Kanal açıklaması en fazla {#limit} karakter olabilir'
    }),
  
  type: Joi.string()
    .valid('text', 'voice')
    .required()
    .messages({
      'string.base': 'Kanal tipi metin olmalıdır',
      'string.empty': 'Kanal tipi boş olamaz',
      'any.only': 'Kanal tipi text veya voice olmalıdır',
      'any.required': 'Kanal tipi zorunludur'
    }),
  
  isPrivate: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Özel kanal değeri boolean olmalıdır'
    })
});

/**
 * Kanal güncelleme doğrulama şeması
 */
const updateChannel = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.base': 'Kanal adı metin olmalıdır',
      'string.empty': 'Kanal adı boş olamaz',
      'string.min': 'Kanal adı en az {#limit} karakter olmalıdır',
      'string.max': 'Kanal adı en fazla {#limit} karakter olabilir'
    }),
  
  description: Joi.string()
    .max(200)
    .allow('')
    .optional()
    .messages({
      'string.base': 'Kanal açıklaması metin olmalıdır',
      'string.max': 'Kanal açıklaması en fazla {#limit} karakter olabilir'
    }),
  
  isPrivate: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Özel kanal değeri boolean olmalıdır'
    })
});

/**
 * Mesaj gönderme doğrulama şeması
 */
const sendMessage = Joi.object({
  content: Joi.string()
    .max(2000)
    .when('attachments', {
      is: Joi.array().length(0).required(),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.base': 'Mesaj içeriği metin olmalıdır',
      'string.empty': 'Mesaj içeriği boş olamaz',
      'string.max': 'Mesaj içeriği en fazla {#limit} karakter olabilir',
      'any.required': 'Mesaj içeriği veya ek zorunludur'
    }),
  
  attachments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid('image', 'video', 'audio', 'file')
          .required()
          .messages({
            'string.base': 'Dosya tipi metin olmalıdır',
            'any.only': 'Dosya tipi image, video, audio veya file olmalıdır',
            'any.required': 'Dosya tipi zorunludur'
          }),
        
        url: Joi.string()
          .required()
          .messages({
            'string.base': 'Dosya URL metin olmalıdır',
            'string.empty': 'Dosya URL boş olamaz',
            'any.required': 'Dosya URL zorunludur'
          }),
        
        name: Joi.string()
          .optional()
          .messages({
            'string.base': 'Dosya adı metin olmalıdır'
          }),
        
        size: Joi.number()
          .optional()
          .messages({
            'number.base': 'Dosya boyutu sayı olmalıdır'
          }),
        
        mimeType: Joi.string()
          .optional()
          .messages({
            'string.base': 'MIME tipi metin olmalıdır'
          })
      })
    )
    .optional()
    .messages({
      'array.base': 'Ekler bir dizi olmalıdır'
    })
});

/**
 * Mesaj güncelleme doğrulama şeması
 */
const updateMessage = Joi.object({
  content: Joi.string()
    .max(2000)
    .required()
    .messages({
      'string.base': 'Mesaj içeriği metin olmalıdır',
      'string.empty': 'Mesaj içeriği boş olamaz',
      'string.max': 'Mesaj içeriği en fazla {#limit} karakter olabilir',
      'any.required': 'Mesaj içeriği zorunludur'
    })
});

export const channelValidation = {
  createChannel,
  updateChannel,
  sendMessage,
  updateMessage
};

export default channelValidation;
