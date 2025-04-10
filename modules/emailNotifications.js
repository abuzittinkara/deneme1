// modules/emailNotifications.js
const nodemailer = require('nodemailer');
const User = require('../models/User');

// E-posta gönderici yapılandırması (gerçek uygulamada .env dosyasından alınmalı)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

/**
 * E-posta bildirimi gönderir
 * @param {string} to - Alıcı e-posta adresi
 * @param {string} subject - E-posta konusu
 * @param {string} html - E-posta içeriği (HTML)
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendEmail(to, subject, html) {
  try {
    const mailOptions = {
      from: `"Fisqos" <${process.env.SMTP_USER || 'info@fisqos.com.tr'}>`,
      to,
      subject,
      html
    };
    
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('E-posta gönderme hatası:', error);
    throw error;
  }
}

/**
 * Kullanıcıya e-posta bildirimi gönderir
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} subject - E-posta konusu
 * @param {string} html - E-posta içeriği (HTML)
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendEmailToUser(userId, subject, html) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.email) {
      return { success: false, message: 'Kullanıcı e-posta adresi bulunamadı' };
    }
    
    // Kullanıcı e-posta bildirimi tercihini kontrol et
    if (user.preferences && user.preferences.emailNotifications === false) {
      return { success: false, message: 'Kullanıcı e-posta bildirimlerini devre dışı bırakmış' };
    }
    
    return await sendEmail(user.email, subject, html);
  } catch (error) {
    console.error('Kullanıcıya e-posta gönderme hatası:', error);
    throw error;
  }
}

/**
 * Yeni mesaj e-posta bildirimi gönderir
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} senderName - Gönderen kullanıcı adı
 * @param {string} messageContent - Mesaj içeriği
 * @param {string} channelName - Kanal adı (opsiyonel, DM için null)
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendNewMessageEmail(userId, senderName, messageContent, channelName = null) {
  const subject = channelName 
    ? `${channelName} kanalında yeni mesaj` 
    : `${senderName} size mesaj gönderdi`;
  
  const preview = messageContent.length > 150 
    ? messageContent.substring(0, 147) + '...' 
    : messageContent;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://fisqos.com.tr/images/logo.png" alt="Fisqos Logo" style="max-width: 150px;">
      </div>
      <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h2 style="color: #c61884; margin-top: 0;">${subject}</h2>
        <p style="color: #666;">Merhaba,</p>
        <p style="color: #666;">${channelName ? `<strong>${senderName}</strong>, <strong>${channelName}</strong> kanalında bir mesaj gönderdi:` : `<strong>${senderName}</strong> size bir mesaj gönderdi:`}</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #c61884; margin: 15px 0; border-radius: 4px;">
          <p style="margin: 0; color: #333;">${preview}</p>
        </div>
        <p style="color: #666;">Mesajı görüntülemek ve yanıtlamak için uygulamaya giriş yapın.</p>
        <div style="text-align: center; margin-top: 20px;">
          <a href="https://fisqos.com.tr" style="background-color: #c61884; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Uygulamaya Git</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Bu e-posta, Fisqos bildirim ayarlarınız nedeniyle gönderilmiştir.</p>
        <p>Bildirim ayarlarınızı değiştirmek için <a href="https://fisqos.com.tr/settings" style="color: #c61884;">profil ayarlarınızı</a> ziyaret edin.</p>
      </div>
    </div>
  `;
  
  return sendEmailToUser(userId, subject, html);
}

/**
 * Arkadaşlık isteği e-posta bildirimi gönderir
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} senderName - Gönderen kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendFriendRequestEmail(userId, senderName) {
  const subject = 'Yeni Arkadaşlık İsteği';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://fisqos.com.tr/images/logo.png" alt="Fisqos Logo" style="max-width: 150px;">
      </div>
      <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h2 style="color: #c61884; margin-top: 0;">Yeni Arkadaşlık İsteği</h2>
        <p style="color: #666;">Merhaba,</p>
        <p style="color: #666;"><strong>${senderName}</strong> size arkadaşlık isteği gönderdi.</p>
        <p style="color: #666;">İsteği kabul etmek veya reddetmek için uygulamaya giriş yapın.</p>
        <div style="text-align: center; margin-top: 20px;">
          <a href="https://fisqos.com.tr/friends" style="background-color: #c61884; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Arkadaşlık İsteklerini Görüntüle</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Bu e-posta, Fisqos bildirim ayarlarınız nedeniyle gönderilmiştir.</p>
        <p>Bildirim ayarlarınızı değiştirmek için <a href="https://fisqos.com.tr/settings" style="color: #c61884;">profil ayarlarınızı</a> ziyaret edin.</p>
      </div>
    </div>
  `;
  
  return sendEmailToUser(userId, subject, html);
}

/**
 * Grup daveti e-posta bildirimi gönderir
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} senderName - Davet eden kullanıcı adı
 * @param {string} groupName - Grup adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendGroupInviteEmail(userId, senderName, groupName) {
  const subject = 'Grup Daveti';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://fisqos.com.tr/images/logo.png" alt="Fisqos Logo" style="max-width: 150px;">
      </div>
      <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h2 style="color: #c61884; margin-top: 0;">Grup Daveti</h2>
        <p style="color: #666;">Merhaba,</p>
        <p style="color: #666;"><strong>${senderName}</strong> sizi <strong>${groupName}</strong> grubuna davet etti.</p>
        <p style="color: #666;">Daveti kabul etmek veya reddetmek için uygulamaya giriş yapın.</p>
        <div style="text-align: center; margin-top: 20px;">
          <a href="https://fisqos.com.tr/groups" style="background-color: #c61884; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Grup Davetlerini Görüntüle</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Bu e-posta, Fisqos bildirim ayarlarınız nedeniyle gönderilmiştir.</p>
        <p>Bildirim ayarlarınızı değiştirmek için <a href="https://fisqos.com.tr/settings" style="color: #c61884;">profil ayarlarınızı</a> ziyaret edin.</p>
      </div>
    </div>
  `;
  
  return sendEmailToUser(userId, subject, html);
}

module.exports = {
  sendEmail,
  sendEmailToUser,
  sendNewMessageEmail,
  sendFriendRequestEmail,
  sendGroupInviteEmail
};
