/**
 * src/modules/emailNotifications.ts
 * E-posta bildirimleri işlemleri
 */
import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

// E-posta sonucu arayüzü
export interface EmailResult {
  success: boolean;
  messageId?: string;
  message?: string;
}

// E-posta gönderici yapılandırması (gerçek uygulamada .env dosyasından alınmalı)
const transporter: Transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

/**
 * E-posta bildirimi gönderir
 * @param to - Alıcı e-posta adresi
 * @param subject - E-posta konusu
 * @param html - E-posta içeriği (HTML)
 * @returns İşlem sonucu
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  try {
    const mailOptions = {
      from: `"Fisqos" <${process.env.SMTP_USER || 'info@fisqos.com.tr'}>`,
      to,
      subject,
      html
    };

    const info: SentMessageInfo = await transporter.sendMail(mailOptions);

    logger.info('E-posta gönderildi', { to, subject, messageId: info.messageId });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('E-posta gönderme hatası', {
      error: (error as Error).message,
      to,
      subject
    });
    throw error;
  }
}

/**
 * Kullanıcıya e-posta bildirimi gönderir
 * @param userId - Kullanıcı ID'si
 * @param subject - E-posta konusu
 * @param html - E-posta içeriği (HTML)
 * @returns İşlem sonucu
 */
export async function sendEmailToUser(
  userId: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn('Kullanıcı bulunamadı', { userId });
      return { success: false, message: 'Kullanıcı bulunamadı' };
    }

    const email = user.get('email');
    if (!email) {
      logger.warn('Kullanıcı e-posta adresi bulunamadı', { userId });
      return { success: false, message: 'Kullanıcı e-posta adresi bulunamadı' };
    }

    // Kullanıcı e-posta bildirimi tercihini kontrol et
    const preferences = user.get('preferences');
    if (preferences && preferences.emailNotifications === false) {
      logger.debug('Kullanıcı e-posta bildirimlerini devre dışı bırakmış', { userId });
      return { success: false, message: 'Kullanıcı e-posta bildirimlerini devre dışı bırakmış' };
    }

    return await sendEmail(email, subject, html);
  } catch (error) {
    logger.error('Kullanıcıya e-posta gönderme hatası', {
      error: (error as Error).message,
      userId,
      subject
    });
    throw error;
  }
}

/**
 * Yeni mesaj e-posta bildirimi gönderir
 * @param userId - Kullanıcı ID'si
 * @param senderName - Gönderen kullanıcı adı
 * @param messageContent - Mesaj içeriği
 * @param channelName - Kanal adı (opsiyonel, DM için null)
 * @returns İşlem sonucu
 */
export async function sendNewMessageEmail(
  userId: string,
  senderName: string,
  messageContent: string,
  channelName: string | null = null
): Promise<EmailResult> {
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
 * @param userId - Kullanıcı ID'si
 * @param senderName - Gönderen kullanıcı adı
 * @returns İşlem sonucu
 */
export async function sendFriendRequestEmail(
  userId: string,
  senderName: string
): Promise<EmailResult> {
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
 * @param userId - Kullanıcı ID'si
 * @param senderName - Davet eden kullanıcı adı
 * @param groupName - Grup adı
 * @returns İşlem sonucu
 */
export async function sendGroupInviteEmail(
  userId: string,
  senderName: string,
  groupName: string
): Promise<EmailResult> {
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

/**
 * Şifre sıfırlama e-postası gönderir
 * @param userId - Kullanıcı ID'si
 * @param resetToken - Sıfırlama token'ı
 * @returns İşlem sonucu
 */
export async function sendPasswordResetEmail(
  userId: string,
  resetToken: string
): Promise<EmailResult> {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    const email = user.get('email');
    if (!email) {
      throw new NotFoundError('Kullanıcı e-posta adresi bulunamadı');
    }

    const name = user.get('name');
    const username = user.get('username');

    const subject = 'Şifre Sıfırlama İsteği';
    const resetUrl = `https://fisqos.com.tr/reset-password?token=${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://fisqos.com.tr/images/logo.png" alt="Fisqos Logo" style="max-width: 150px;">
        </div>
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <h2 style="color: #c61884; margin-top: 0;">Şifre Sıfırlama İsteği</h2>
          <p style="color: #666;">Merhaba ${name || username},</p>
          <p style="color: #666;">Hesabınız için bir şifre sıfırlama isteği aldık. Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${resetUrl}" style="background-color: #c61884; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Şifremi Sıfırla</a>
          </div>
          <p style="color: #666;">Bu bağlantı 24 saat boyunca geçerlidir.</p>
          <p style="color: #666;">Eğer şifre sıfırlama isteğinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>Bu e-posta, Fisqos hesabınızla ilgili bir işlem nedeniyle gönderilmiştir.</p>
          <p>Herhangi bir sorunuz varsa, lütfen <a href="mailto:support@fisqos.com.tr" style="color: #c61884;">support@fisqos.com.tr</a> adresine e-posta gönderin.</p>
        </div>
      </div>
    `;

    return await sendEmail(email, subject, html);
  } catch (error) {
    logger.error('Şifre sıfırlama e-postası gönderme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

export default {
  sendEmail,
  sendEmailToUser,
  sendNewMessageEmail,
  sendFriendRequestEmail,
  sendGroupInviteEmail,
  sendPasswordResetEmail
};
