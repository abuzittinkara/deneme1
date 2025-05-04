/**
 * render-app.ts
 * Render.com için basitleştirilmiş uygulama
 */
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as path from 'path';

// Express uygulaması ve HTTP sunucusu oluştur
const app = express();
const server = http.createServer(app);

// Middleware'ler
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sağlık kontrolü endpoint'i
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ana sayfa
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <html>
      <head>
        <title>Sesli Sohbet Uygulaması</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          h1 {
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          .status {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .success {
            color: green;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <h1>Sesli Sohbet Uygulaması</h1>
        <div class="status">
          <p>Sunucu Durumu: <span class="success">Çalışıyor</span></p>
          <p>Sunucu Zamanı: ${new Date().toLocaleString()}</p>
          <p>Çalışma Süresi: ${process.uptime().toFixed(2)} saniye</p>
          <p>Ortam: ${process.env.NODE_ENV || 'development'}</p>
        </div>
        <h2>Render.com Dağıtımı</h2>
        <p>Bu sayfa, uygulamanın Render.com'da başarıyla dağıtıldığını göstermektedir.</p>
        <p>Tam uygulama için gerekli bağımlılıklar ve yapılandırmalar tamamlanmalıdır.</p>
      </body>
    </html>
  `);
});

// 404 hatası için middleware
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Kaynak bulunamadı',
    code: 'NOT_FOUND'
  });
});

// Hata işleyici middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Uygulama hatası:', err);
  res.status(500).json({
    success: false,
    message: 'Sunucu hatası',
    code: 'SERVER_ERROR'
  });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

export default app;
