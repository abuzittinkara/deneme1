/**
 * src/config/swagger.ts
 * Swagger API dokümantasyonu yapılandırması
 */
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { logger } from '../utils/logger';
import { env } from './env';

// Swagger seçenekleri
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${env.APP_NAME || 'Fisqos'} API`,
      version: env.APP_VERSION || '1.0.0',
      description: 'Fisqos Uygulaması API Dokümantasyonu',
      termsOfService: 'https://fisqos.com/terms',
      contact: {
        name: 'API Destek',
        url: 'https://fisqos.com/support',
        email: 'support@fisqos.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `${env.API_URL}/api`,
        description: 'API Sunucusu'
      },
      {
        url: `http://localhost:${env.PORT || '9092'}/api`,
        description: 'Yerel Geliştirme Sunucusu'
      }
    ],
    externalDocs: {
      description: 'API Kullanım Kılavuzu',
      url: 'https://fisqos.com/docs'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT kimlik doğrulama token\'ı. Format: Bearer [token]'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'İşlem başarı durumu'
            },
            error: {
              type: 'object',
              required: ['message'],
              properties: {
                message: {
                  type: 'string',
                  example: 'Bir hata oluştu',
                  description: 'Hata mesajı'
                },
                code: {
                  type: 'string',
                  example: 'ERROR_CODE',
                  description: 'Hata kodu'
                },
                statusCode: {
                  type: 'integer',
                  example: 400,
                  description: 'HTTP durum kodu'
                },
                details: {
                  type: 'object',
                  description: 'Hata detayları',
                  additionalProperties: true
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2023-01-01T12:00:00.000Z',
                  description: 'Hata zamanı'
                }
              }
            }
          }
        },
        ValidationError: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              required: ['message', 'code', 'details'],
              properties: {
                message: {
                  type: 'string',
                  example: 'Doğrulama hatası'
                },
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR'
                },
                statusCode: {
                  type: 'integer',
                  example: 400
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        example: 'email'
                      },
                      message: {
                        type: 'string',
                        example: 'Geçerli bir e-posta adresi girilmelidir'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'İşlem başarı durumu'
            },
            data: {
              type: 'object',
              description: 'Yanıt verisi',
              additionalProperties: true
            },
            message: {
              type: 'string',
              example: 'İşlem başarıyla tamamlandı',
              description: 'Başarı mesajı'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T12:00:00.000Z',
              description: 'İşlem zamanı'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          required: ['success', 'data', 'pagination'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  example: 100,
                  description: 'Toplam öğe sayısı'
                },
                page: {
                  type: 'integer',
                  example: 1,
                  description: 'Mevcut sayfa'
                },
                limit: {
                  type: 'integer',
                  example: 10,
                  description: 'Sayfa başına öğe sayısı'
                },
                pages: {
                  type: 'integer',
                  example: 10,
                  description: 'Toplam sayfa sayısı'
                },
                hasNext: {
                  type: 'boolean',
                  example: true,
                  description: 'Sonraki sayfa var mı'
                },
                hasPrev: {
                  type: 'boolean',
                  example: false,
                  description: 'Önceki sayfa var mı'
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '60d21b4667d0d8992e610c85'
            },
            username: {
              type: 'string',
              example: 'johndoe'
            },
            email: {
              type: 'string',
              example: 'john@example.com'
            },
            displayName: {
              type: 'string',
              example: 'John Doe'
            },
            avatar: {
              type: 'string',
              example: 'https://example.com/avatar.jpg'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'moderator'],
              example: 'user'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'banned', 'suspended'],
              example: 'active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T12:00:00.000Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T12:00:00.000Z'
            }
          }
        },
        Token: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            expiresIn: {
              type: 'integer',
              example: 900
            }
          }
        }
      },
      parameters: {
        limitParam: {
          name: 'limit',
          in: 'query',
          description: 'Sayfa başına öğe sayısı',
          schema: {
            type: 'integer',
            default: 10,
            minimum: 1,
            maximum: 100
          }
        },
        pageParam: {
          name: 'page',
          in: 'query',
          description: 'Sayfa numarası',
          schema: {
            type: 'integer',
            default: 1,
            minimum: 1
          }
        },
        sortParam: {
          name: 'sort',
          in: 'query',
          description: 'Sıralama alanı ve yönü (örn: createdAt:desc)',
          schema: {
            type: 'string'
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Kimlik doğrulama hatası',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Yetkisiz erişim hatası',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Doğrulama hatası',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Kaynak bulunamadı hatası',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ServerError: {
          description: 'Sunucu hatası',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: [] as string[]
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Kimlik doğrulama ve yetkilendirme işlemleri',
        externalDocs: {
          description: 'Kimlik Doğrulama Kılavuzu',
          url: 'https://fisqos.com/docs/auth'
        }
      },
      {
        name: 'Users',
        description: 'Kullanıcı yönetimi işlemleri',
        externalDocs: {
          description: 'Kullanıcı Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/users'
        }
      },
      {
        name: 'Groups',
        description: 'Grup yönetimi işlemleri',
        externalDocs: {
          description: 'Grup Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/groups'
        }
      },
      {
        name: 'Channels',
        description: 'Kanal yönetimi işlemleri',
        externalDocs: {
          description: 'Kanal Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/channels'
        }
      },
      {
        name: 'Messages',
        description: 'Mesaj yönetimi işlemleri',
        externalDocs: {
          description: 'Mesaj Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/messages'
        }
      },
      {
        name: 'Files',
        description: 'Dosya yönetimi işlemleri',
        externalDocs: {
          description: 'Dosya Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/files'
        }
      },
      {
        name: 'Notifications',
        description: 'Bildirim yönetimi işlemleri',
        externalDocs: {
          description: 'Bildirim Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/notifications'
        }
      },
      {
        name: 'Search',
        description: 'Arama işlemleri',
        externalDocs: {
          description: 'Arama Kılavuzu',
          url: 'https://fisqos.com/docs/search'
        }
      },
      {
        name: 'Diagnostics',
        description: 'Tanılama ve izleme işlemleri',
        externalDocs: {
          description: 'Tanılama Kılavuzu',
          url: 'https://fisqos.com/docs/diagnostics'
        }
      },
      {
        name: 'Performance',
        description: 'Performans izleme işlemleri',
        externalDocs: {
          description: 'Performans İzleme Kılavuzu',
          url: 'https://fisqos.com/docs/performance'
        }
      },
      {
        name: 'Database',
        description: 'Veritabanı yönetimi işlemleri',
        externalDocs: {
          description: 'Veritabanı Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/database'
        }
      },
      {
        name: 'Memory',
        description: 'Bellek yönetimi işlemleri',
        externalDocs: {
          description: 'Bellek Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/memory'
        }
      },
      {
        name: 'Config',
        description: 'Yapılandırma yönetimi işlemleri',
        externalDocs: {
          description: 'Yapılandırma Yönetimi Kılavuzu',
          url: 'https://fisqos.com/docs/config'
        }
      },
      {
        name: 'Errors',
        description: 'Hata izleme işlemleri',
        externalDocs: {
          description: 'Hata İzleme Kılavuzu',
          url: 'https://fisqos.com/docs/errors'
        }
      }
    ]
  },
  apis: [
    './src/routes/**/*.ts',
    './src/controllers/**/*.ts',
    './src/models/**/*.ts',
    './src/types/**/*.ts',
    './src/middleware/**/*.ts',
    './src/utils/**/*.ts',
    './src/config/**/*.ts'
  ]
};

// Swagger dokümantasyonunu oluştur
const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Express uygulamasına Swagger dokümantasyonunu ekler
 * @param app - Express uygulaması
 */
export function setupSwagger(app: Express): void {
  try {
    // Swagger UI yapılandırması
    const swaggerUiOptions = {
      explorer: true,
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 30px 0 }
        .swagger-ui .scheme-container { padding: 15px 0 }
        .swagger-ui .opblock-tag { font-size: 18px }
        .swagger-ui .opblock-tag small { font-size: 14px }
        .swagger-ui .opblock-summary-method { font-weight: bold }
        .swagger-ui table tbody tr td { padding: 8px 0 }
        .swagger-ui .response-col_status { width: 80px }
        .swagger-ui .markdown p { margin: 0 0 10px }
        .swagger-ui .btn { font-weight: normal }
      `,
      customSiteTitle: `${env.APP_NAME || 'Fisqos'} API Dokümantasyonu`,
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 3,
        defaultModelExpandDepth: 3,
        showExtensions: true,
        showCommonExtensions: true,
        deepLinking: true,
        syntaxHighlight: {
          activate: true,
          theme: 'agate'
        },
        tryItOutEnabled: env.isDevelopment,
        requestSnippetsEnabled: true,
        displayOperationId: false,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha'
      }
    };

    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

    // Swagger JSON
    app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Swagger UI'a yönlendirme
    app.get('/docs', (_req, res) => {
      res.redirect('/api-docs');
    });

    logger.info('Swagger API dokümantasyonu yapılandırıldı', {
      url: `${env.API_URL}/api-docs`,
      jsonUrl: `${env.API_URL}/api-docs.json`
    });
  } catch (error) {
    logger.error('Swagger yapılandırma hatası', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}

export default {
  setupSwagger,
  swaggerSpec
};
