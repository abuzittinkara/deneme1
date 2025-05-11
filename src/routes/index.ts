/**
 * src/routes/index.ts
 * Ana router
 */
import express from 'express';
import apiRoutes from './api';

const router = express.Router();

// API routes
router.use('/api', apiRoutes);

// Ana sayfa
router.get('/', (req, res) => {
  res.send('Fisqos API');
});

// 404 handler
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Sayfa bulunamadı',
  });
});

export default router;
