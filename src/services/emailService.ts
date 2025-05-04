/**
 * src/services/emailService.ts
 * E-posta gönderme servisi
 */
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// E-posta gönderici yapılandırması
const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: env.EMAIL_SECURE,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD
  }
});

/**
 * E-posta gönderir
 * @param to - Alıcı e-posta adresi
 * @param subject - E-posta konusu
 * @param html - E-posta içeriği (HTML)
 * @returns İşlem sonucu
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const mailOptions = {
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('E-posta gönderildi', {
      messageId: info.messageId,
      to
    });

    return true;
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
 * Hoş geldiniz e-postası gönderir
 * @param to - Alıcı e-posta adresi
 * @param data - E-posta verileri
 * @returns İşlem sonucu
 */
export async function sendWelcomeEmail(to: string, data: { username: string }): Promise<boolean> {
  const subject = 'Fisqos\'a Hoş Geldiniz!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Merhaba ${data.username},</h2>
      <p>Fisqos'a hoş geldiniz! Hesabınız başarıyla oluşturuldu.</p>
      <p>Fisqos ile arkadaşlarınızla iletişim kurabilir, gruplar oluşturabilir ve daha fazlasını yapabilirsiniz.</p>
      <p>Herhangi bir sorunuz varsa, lütfen bizimle iletişime geçmekten çekinmeyin.</p>
      <p>Saygılarımızla,<br>Fisqos Ekibi</p>
    </div>
  `;

  return await sendEmail(to, subject, html);
}

/**
 * E-posta doğrulama e-postası gönderir
 * @param to - Alıcı e-posta adresi
 * @param data - E-posta verileri
 * @returns İşlem sonucu
 */
export async function sendVerificationEmail(
  to: string,
  data: { username: string; verificationUrl: string }
): Promise<boolean> {
  const subject = 'Fisqos E-posta Doğrulama';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Merhaba ${data.username},</h2>
      <p>Fisqos hesabınızı oluşturduğunuz için teşekkür ederiz. Hesabınızı etkinleştirmek için lütfen e-posta adresinizi doğrulayın.</p>
      <p>Aşağıdaki bağlantıya tıklayarak e-posta adresinizi doğrulayabilirsiniz:</p>
      <p>
        <a href="${data.verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">E-posta Adresimi Doğrula</a>
      </p>
      <p>Veya bu bağlantıyı tarayıcınıza kopyalayabilirsiniz:</p>
      <p>${data.verificationUrl}</p>
      <p>Bu bağlantı 48 saat boyunca geçerlidir.</p>
      <p>Eğer bu hesabı siz oluşturmadıysanız, lütfen bu e-postayı dikkate almayın.</p>
      <p>Saygılarımızla,<br>Fisqos Ekibi</p>
    </div>
  `;

  return await sendEmail(to, subject, html);
}

/**
 * Şifre sıfırlama e-postası gönderir
 * @param to - Alıcı e-posta adresi
 * @param data - E-posta verileri
 * @returns İşlem sonucu
 */
export async function sendPasswordResetEmail(
  to: string,
  data: { username: string; resetUrl: string }
): Promise<boolean> {
  const subject = 'Fisqos Şifre Sıfırlama';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Merhaba ${data.username},</h2>
      <p>Fisqos hesabınız için bir şifre sıfırlama isteği aldık. Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
      <p>
        <a href="${data.resetUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Şifremi Sıfırla</a>
      </p>
      <p>Veya bu bağlantıyı tarayıcınıza kopyalayabilirsiniz:</p>
      <p>${data.resetUrl}</p>
      <p>Bu bağlantı 24 saat boyunca geçerlidir.</p>
      <p>Eğer şifre sıfırlama isteğinde bulunmadıysanız, lütfen bu e-postayı dikkate almayın veya bizimle iletişime geçin.</p>
      <p>Saygılarımızla,<br>Fisqos Ekibi</p>
    </div>
  `;

  return await sendEmail(to, subject, html);
}

/**
 * Şifre değişikliği bildirimi e-postası gönderir
 * @param to - Alıcı e-posta adresi
 * @param data - E-posta verileri
 * @returns İşlem sonucu
 */
export async function sendPasswordChangeNotification(
  to: string,
  data: { username: string; ipAddress: string; userAgent: string }
): Promise<boolean> {
  const subject = 'Fisqos Şifre Değişikliği Bildirimi';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Merhaba ${data.username},</h2>
      <p>Fisqos hesabınızın şifresi az önce değiştirildi.</p>
      <p>Değişiklik bilgileri:</p>
      <ul>
        <li>Tarih ve Saat: ${new Date().toLocaleString()}</li>
        <li>IP Adresi: ${data.ipAddress}</li>
        <li>Cihaz: ${data.userAgent}</li>
      </ul>
      <p>Eğer bu değişikliği siz yapmadıysanız, lütfen hemen şifrenizi sıfırlayın ve bizimle iletişime geçin.</p>
      <p>Saygılarımızla,<br>Fisqos Ekibi</p>
    </div>
  `;

  return await sendEmail(to, subject, html);
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeNotification
};
