/**
 * src/routes/api.ts
 * API rotaları
 */
import express from 'express';
// import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import groupRoutes from './groupRoutes';
import channelRoutes from './channelRoutes';
import messageRoutes from './messageRoutes';
import fileRoutes from './fileRoutes';
import notificationRoutes from './notificationRoutes';
import searchRoutes from './searchRoutes';

const router = express.Router();

// API rotaları
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);
// router.use('/groups', groupRoutes);
// router.use('/channels', channelRoutes);
// router.use('/messages', messageRoutes);
// router.use('/files', fileRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/search', searchRoutes);

// Sağlık kontrolü
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime()
  });
});

// Detaylı sağlık kontrolü
router.get('/health/detailed', (req, res) => {
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    }
  });
});

export default router;
