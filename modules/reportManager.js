// modules/reportManager.js
const Report = require('../models/Report');
const User = require('../models/User');
const Message = require('../models/Message');
const DMMessage = require('../models/DmMessage');

/**
 * Kullanıcı raporu oluşturur
 * @param {string} reporterId - Raporu oluşturan kullanıcı ID'si
 * @param {string} reportedUsername - Raporlanan kullanıcı adı
 * @param {string} reason - Rapor nedeni
 * @param {string} description - Rapor açıklaması
 * @param {Array} relatedMessageIds - İlgili mesaj ID'leri
 * @param {Array} relatedDMMessageIds - İlgili DM mesaj ID'leri
 * @returns {Promise<Object>} - Oluşturulan rapor
 */
async function createUserReport(reporterId, reportedUsername, reason, description, relatedMessageIds = [], relatedDMMessageIds = []) {
  try {
    // Raporlanan kullanıcıyı bul
    const reportedUser = await User.findOne({ username: reportedUsername });
    if (!reportedUser) {
      throw new Error('Raporlanan kullanıcı bulunamadı');
    }
    
    // Kendini raporlama kontrolü
    if (reporterId.toString() === reportedUser._id.toString()) {
      throw new Error('Kendinizi raporlayamazsınız');
    }
    
    // Rapor oluştur
    const report = new Report({
      reporter: reporterId,
      reportedUser: reportedUser._id,
      reason,
      description,
      relatedMessages: relatedMessageIds,
      relatedDMMessages: relatedDMMessageIds
    });
    
    await report.save();
    
    // Raporu populate et
    const populatedReport = await Report.findById(report._id)
      .populate('reporter', 'username')
      .populate('reportedUser', 'username');
    
    return populatedReport;
  } catch (err) {
    console.error('Kullanıcı raporu oluşturma hatası:', err);
    throw err;
  }
}

/**
 * Kullanıcının raporlarını getirir
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Array>} - Raporlar listesi
 */
async function getUserReports(userId) {
  try {
    const reports = await Report.find({ reporter: userId })
      .populate('reportedUser', 'username')
      .sort({ createdAt: -1 });
    
    return reports;
  } catch (err) {
    console.error('Kullanıcı raporlarını getirme hatası:', err);
    throw err;
  }
}

/**
 * Rapor durumunu günceller
 * @param {string} reportId - Rapor ID'si
 * @param {string} status - Yeni durum
 * @param {string} adminId - İşlemi yapan admin ID'si
 * @param {string} resolution - Çözüm açıklaması
 * @returns {Promise<Object>} - Güncellenen rapor
 */
async function updateReportStatus(reportId, status, adminId, resolution = '') {
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new Error('Rapor bulunamadı');
    }
    
    report.status = status;
    report.updatedAt = new Date();
    
    if (status === 'resolved' || status === 'dismissed') {
      report.resolvedBy = adminId;
      report.resolution = resolution;
    }
    
    await report.save();
    
    // Raporu populate et
    const populatedReport = await Report.findById(report._id)
      .populate('reporter', 'username')
      .populate('reportedUser', 'username')
      .populate('resolvedBy', 'username');
    
    return populatedReport;
  } catch (err) {
    console.error('Rapor durumu güncelleme hatası:', err);
    throw err;
  }
}

/**
 * Raporu arşivler
 * @param {string} reportId - Rapor ID'si
 * @returns {Promise<Object>} - Arşivlenen rapor
 */
async function archiveReport(reportId) {
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new Error('Rapor bulunamadı');
    }
    
    report.isArchived = true;
    report.updatedAt = new Date();
    
    await report.save();
    return report;
  } catch (err) {
    console.error('Rapor arşivleme hatası:', err);
    throw err;
  }
}

/**
 * Bekleyen raporları getirir
 * @param {number} limit - Maksimum rapor sayısı
 * @returns {Promise<Array>} - Bekleyen raporlar listesi
 */
async function getPendingReports(limit = 10) {
  try {
    const reports = await Report.find({ status: 'pending', isArchived: false })
      .populate('reporter', 'username')
      .populate('reportedUser', 'username')
      .sort({ createdAt: 1 })
      .limit(limit);
    
    return reports;
  } catch (err) {
    console.error('Bekleyen raporları getirme hatası:', err);
    throw err;
  }
}

/**
 * Raporla ilgili mesajları getirir
 * @param {string} reportId - Rapor ID'si
 * @returns {Promise<Object>} - Mesajlar
 */
async function getReportMessages(reportId) {
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new Error('Rapor bulunamadı');
    }
    
    // İlgili mesajları getir
    const messages = await Message.find({ _id: { $in: report.relatedMessages } })
      .populate('user', 'username')
      .sort({ timestamp: 1 });
    
    // İlgili DM mesajlarını getir
    const dmMessages = await DMMessage.find({ _id: { $in: report.relatedDMMessages } })
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .sort({ timestamp: 1 });
    
    return {
      messages,
      dmMessages
    };
  } catch (err) {
    console.error('Rapor mesajlarını getirme hatası:', err);
    throw err;
  }
}

module.exports = {
  createUserReport,
  getUserReports,
  updateReportStatus,
  archiveReport,
  getPendingReports,
  getReportMessages
};
