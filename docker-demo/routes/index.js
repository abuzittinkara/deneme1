// routes/index.js
const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const channelRoutes = require('./channelRoutes');
const messageRoutes = require('./messageRoutes');
const groupRoutes = require('./groupRoutes');
const roomRoutes = require('./roomRoutes');

// API rotaları
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/channels', channelRoutes);
router.use('/messages', messageRoutes);
router.use('/groups', groupRoutes);
router.use('/rooms', roomRoutes);

module.exports = router;
