// controllers/roomController.js
const { Room, User } = require('../models');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

// Tüm odaları getir
const getAllRooms = async (req, res, next) => {
  try {
    // Kullanıcının erişebileceği odaları getir
    const rooms = await Room.find({
      $or: [
        { isPrivate: false }, // Herkese açık odalar
        { owner: req.user.id }, // Kullanıcının sahibi olduğu odalar
        { moderators: req.user.id }, // Kullanıcının moderatör olduğu odalar
        { members: req.user.id } // Kullanıcının üye olduğu odalar
      ]
    })
    .populate('owner', 'username name surname')
    .populate('moderators', 'username name surname')
    .select('-password');
    
    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
};

// Belirli bir odayı getir
const getRoomById = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('owner', 'username name surname')
      .populate('moderators', 'username name surname')
      .populate('members', 'username name surname')
      .populate('channels')
      .select('-password');
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcının odaya erişim izni var mı kontrol et
    if (room.isPrivate && !room.canJoin(req.user.id)) {
      throw new ForbiddenError('Bu odaya erişim izniniz yok');
    }
    
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

// Yeni oda oluştur
const createRoom = async (req, res, next) => {
  try {
    const { name, description, isPrivate, password, maxUsers } = req.body;
    
    // Oda oluştur
    const room = new Room({
      name,
      description,
      owner: req.user.id,
      isPrivate: isPrivate || false,
      password: password || null,
      maxUsers: maxUsers || 50
    });
    
    // Oda sahibini üye ve moderatör olarak ekle
    room.members.push(req.user.id);
    room.moderators.push(req.user.id);
    
    await room.save();
    
    // Şifreyi yanıtta gönderme
    const roomResponse = room.toObject();
    delete roomResponse.password;
    
    res.status(201).json({ success: true, data: roomResponse });
  } catch (error) {
    next(error);
  }
};

// Odayı güncelle
const updateRoom = async (req, res, next) => {
  try {
    const { name, description, isPrivate, password, maxUsers } = req.body;
    
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcının odayı düzenleme izni var mı kontrol et
    if (!room.canEdit(req.user.id)) {
      throw new ForbiddenError('Bu odayı düzenleme izniniz yok');
    }
    
    // Odayı güncelle
    if (name) room.name = name;
    if (description !== undefined) room.description = description;
    if (isPrivate !== undefined) room.isPrivate = isPrivate;
    if (password !== undefined) room.password = password;
    if (maxUsers) room.maxUsers = maxUsers;
    
    await room.save();
    
    // Şifreyi yanıtta gönderme
    const roomResponse = room.toObject();
    delete roomResponse.password;
    
    res.status(200).json({ success: true, data: roomResponse });
  } catch (error) {
    next(error);
  }
};

// Odayı sil
const deleteRoom = async (req, res, next) => {
  try {
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcının odayı silme izni var mı kontrol et
    if (!room.canDelete(req.user.id)) {
      throw new ForbiddenError('Bu odayı silme izniniz yok');
    }
    
    await room.remove();
    
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// Odaya katıl
const joinRoom = async (req, res, next) => {
  try {
    const { password } = req.body;
    
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Oda şifreli mi kontrol et
    if (room.password && room.password !== password) {
      throw new ForbiddenError('Geçersiz oda şifresi');
    }
    
    // Kullanıcı zaten üye mi kontrol et
    const isMember = room.members.some(memberId => memberId.toString() === req.user.id);
    
    if (!isMember) {
      // Kullanıcıyı odaya ekle
      room.members.push(req.user.id);
      await room.save();
    }
    
    res.status(200).json({ success: true, data: { message: 'Odaya başarıyla katıldınız' } });
  } catch (error) {
    next(error);
  }
};

// Odadan ayrıl
const leaveRoom = async (req, res, next) => {
  try {
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcı oda sahibi mi kontrol et
    if (room.owner.toString() === req.user.id) {
      throw new BadRequestError('Oda sahibi odadan ayrılamaz. Odayı silmek için silme işlemi yapın.');
    }
    
    // Kullanıcıyı odadan çıkar
    await room.removeMember(req.user.id);
    
    res.status(200).json({ success: true, data: { message: 'Odadan başarıyla ayrıldınız' } });
  } catch (error) {
    next(error);
  }
};

// Kullanıcıyı odaya ekle (sadece oda sahibi veya moderatörler)
const addMember = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcının odayı düzenleme izni var mı kontrol et
    if (!room.canEdit(req.user.id)) {
      throw new ForbiddenError('Bu odaya kullanıcı ekleme izniniz yok');
    }
    
    // Eklenecek kullanıcıyı bul
    const user = await User.findById(userId);
    
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    
    // Kullanıcıyı odaya ekle
    await room.addMember(userId);
    
    res.status(200).json({ success: true, data: { message: 'Kullanıcı odaya başarıyla eklendi' } });
  } catch (error) {
    next(error);
  }
};

// Kullanıcıyı odadan çıkar (sadece oda sahibi veya moderatörler)
const removeMember = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcının odayı düzenleme izni var mı kontrol et
    if (!room.canEdit(req.user.id)) {
      throw new ForbiddenError('Bu odadan kullanıcı çıkarma izniniz yok');
    }
    
    // Çıkarılacak kullanıcı oda sahibi mi kontrol et
    if (room.owner.toString() === userId) {
      throw new BadRequestError('Oda sahibi odadan çıkarılamaz');
    }
    
    // Moderatör, başka bir moderatörü çıkarmaya çalışıyor mu kontrol et
    if (room.moderators.some(modId => modId.toString() === userId) && 
        room.owner.toString() !== req.user.id) {
      throw new ForbiddenError('Sadece oda sahibi moderatörleri odadan çıkarabilir');
    }
    
    // Kullanıcıyı odadan çıkar
    await room.removeMember(userId);
    
    res.status(200).json({ success: true, data: { message: 'Kullanıcı odadan başarıyla çıkarıldı' } });
  } catch (error) {
    next(error);
  }
};

// Kullanıcıyı moderatör yap (sadece oda sahibi)
const addModerator = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcı oda sahibi mi kontrol et
    if (room.owner.toString() !== req.user.id) {
      throw new ForbiddenError('Sadece oda sahibi moderatör ekleyebilir');
    }
    
    // Eklenecek kullanıcıyı bul
    const user = await User.findById(userId);
    
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    
    // Kullanıcıyı moderatör yap
    await room.addModerator(userId);
    
    res.status(200).json({ success: true, data: { message: 'Kullanıcı moderatör olarak eklendi' } });
  } catch (error) {
    next(error);
  }
};

// Kullanıcının moderatörlüğünü kaldır (sadece oda sahibi)
const removeModerator = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    // Odayı bul
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      throw new NotFoundError('Oda bulunamadı');
    }
    
    // Kullanıcı oda sahibi mi kontrol et
    if (room.owner.toString() !== req.user.id) {
      throw new ForbiddenError('Sadece oda sahibi moderatörlüğü kaldırabilir');
    }
    
    // Kullanıcının moderatörlüğünü kaldır
    await room.removeModerator(userId);
    
    res.status(200).json({ success: true, data: { message: 'Kullanıcının moderatörlüğü kaldırıldı' } });
  } catch (error) {
    next(error);
  }
};

// Kullanıcının odalarını getir
const getUserRooms = async (req, res, next) => {
  try {
    // Kullanıcının sahibi olduğu, moderatör olduğu veya üye olduğu odaları getir
    const rooms = await Room.find({
      $or: [
        { owner: req.user.id },
        { moderators: req.user.id },
        { members: req.user.id }
      ]
    })
    .populate('owner', 'username name surname')
    .select('-password');
    
    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  joinRoom,
  leaveRoom,
  addMember,
  removeMember,
  addModerator,
  removeModerator,
  getUserRooms
};
