// routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticate } = require('../middleware/auth');

// Tüm rotalar için kimlik doğrulama gerekli
router.use(authenticate);

// Oda yönetimi rotaları
router.get('/', roomController.getAllRooms);
router.get('/user', roomController.getUserRooms);
router.get('/:id', roomController.getRoomById);
router.post('/', roomController.createRoom);
router.put('/:id', roomController.updateRoom);
router.delete('/:id', roomController.deleteRoom);

// Oda üyelik yönetimi rotaları
router.post('/:id/join', roomController.joinRoom);
router.post('/:id/leave', roomController.leaveRoom);
router.post('/:id/members', roomController.addMember);
router.delete('/:id/members', roomController.removeMember);
router.post('/:id/moderators', roomController.addModerator);
router.delete('/:id/moderators', roomController.removeModerator);

module.exports = router;
