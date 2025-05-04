/**
 * src/routes/api/directMessages.ts
 * Direkt mesaj API endpoint'leri
 */
import express from 'express';

const router = express.Router();

// Placeholder route
router.get('/', (req, res) => {
  res.json({
    message: 'Direct Messages API'
  });
});

export default router;
