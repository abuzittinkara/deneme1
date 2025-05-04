// modules/categoryManager.js
const Category = require('../models/Category');
const Channel = require('../models/Channel');
const Group = require('../models/Group');

/**
 * Kategori oluşturur
 * @param {string} groupId - Grup ID'si
 * @param {string} name - Kategori adı
 * @param {number} position - Pozisyon
 * @returns {Promise<Object>} - Oluşturulan kategori bilgileri
 */
async function createCategory(groupId, name, position) {
  const group = await Group.findOne({ groupId });
  if (!group) {
    throw new Error('Grup bulunamadı.');
  }
  
  const category = new Category({
    name,
    group: group._id,
    position: position || 0
  });
  
  await category.save();
  
  return {
    id: category._id,
    name: category.name,
    position: category.position
  };
}

/**
 * Kategori günceller
 * @param {string} categoryId - Kategori ID'si
 * @param {Object} updates - Güncellenecek alanlar
 * @returns {Promise<Object>} - Güncellenmiş kategori bilgileri
 */
async function updateCategory(categoryId, updates) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error('Kategori bulunamadı.');
  }
  
  if (updates.name) category.name = updates.name;
  if (updates.position !== undefined) category.position = updates.position;
  
  await category.save();
  
  return {
    id: category._id,
    name: category.name,
    position: category.position
  };
}

/**
 * Kategori siler
 * @param {string} categoryId - Kategori ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function deleteCategory(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error('Kategori bulunamadı.');
  }
  
  // Kategorideki kanalları güncelle
  await Channel.updateMany(
    { category: categoryId },
    { $unset: { category: 1 } }
  );
  
  await Category.deleteOne({ _id: categoryId });
  
  return { success: true, message: 'Kategori başarıyla silindi.' };
}

/**
 * Kanalı kategoriye taşır
 * @param {string} channelId - Kanal ID'si
 * @param {string} categoryId - Kategori ID'si (null ise kategoriden çıkarır)
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function moveChannelToCategory(channelId, categoryId) {
  const channel = await Channel.findOne({ channelId });
  if (!channel) {
    throw new Error('Kanal bulunamadı.');
  }
  
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Kategori bulunamadı.');
    }
    
    // Kategori ve kanal aynı gruba ait mi kontrol et
    if (category.group.toString() !== channel.group.toString()) {
      throw new Error('Kanal ve kategori aynı gruba ait değil.');
    }
    
    channel.category = categoryId;
  } else {
    // Kategoriden çıkar
    channel.category = undefined;
  }
  
  await channel.save();
  
  return { success: true, message: 'Kanal başarıyla taşındı.' };
}

/**
 * Grup kategorilerini getirir
 * @param {string} groupId - Grup ID'si
 * @returns {Promise<Array>} - Kategoriler listesi
 */
async function getCategoriesForGroup(groupId) {
  const group = await Group.findOne({ groupId });
  if (!group) {
    throw new Error('Grup bulunamadı.');
  }
  
  const categories = await Category.find({ group: group._id }).sort('position');
  
  return categories.map(cat => ({
    id: cat._id,
    name: cat.name,
    position: cat.position
  }));
}

/**
 * Kategorideki kanalları getirir
 * @param {string} categoryId - Kategori ID'si
 * @returns {Promise<Array>} - Kanallar listesi
 */
async function getChannelsInCategory(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error('Kategori bulunamadı.');
  }
  
  const channels = await Channel.find({ 
    category: categoryId,
    isArchived: false
  }).sort('position');
  
  return channels.map(channel => ({
    id: channel.channelId,
    name: channel.name,
    type: channel.type,
    position: channel.position,
    description: channel.description
  }));
}

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  moveChannelToCategory,
  getCategoriesForGroup,
  getChannelsInCategory
};
