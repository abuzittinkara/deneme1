/**
 * src/utils/themeManager.ts
 * Tema yönetimi için yardımcı sınıf
 */
import { logger } from './logger';
import { 
  Theme, 
  ThemeType, 
  DEFAULT_THEME, 
  getTheme, 
  generateCSSVariables 
} from '../config/themes';
import fs from 'fs';
import path from 'path';

// Tema CSS dosyası yolu
const THEME_CSS_PATH = path.join(__dirname, '..', '..', 'public', 'css', 'theme.css');

/**
 * Tema yöneticisi
 */
class ThemeManager {
  private currentTheme: ThemeType = DEFAULT_THEME;
  
  /**
   * Tema yöneticisini başlatır
   */
  constructor() {
    logger.info('Tema yöneticisi başlatıldı', { defaultTheme: DEFAULT_THEME });
  }
  
  /**
   * Mevcut temayı döndürür
   * @returns Mevcut tema
   */
  getCurrentTheme(): Theme {
    return getTheme(this.currentTheme);
  }
  
  /**
   * Mevcut tema türünü döndürür
   * @returns Mevcut tema türü
   */
  getCurrentThemeType(): ThemeType {
    return this.currentTheme;
  }
  
  /**
   * Temayı değiştirir
   * @param type Tema türü
   * @returns Başarılı mı?
   */
  changeTheme(type: ThemeType): boolean {
    try {
      // Tema türünü kontrol et
      if (type !== 'light' && type !== 'dark' && type !== 'system') {
        logger.warn(`Geçersiz tema türü: ${type}`);
        return false;
      }
      
      // Temayı değiştir
      this.currentTheme = type;
      
      // CSS dosyasını güncelle
      this.generateThemeCSS();
      
      logger.info(`Tema değiştirildi: ${type}`);
      return true;
    } catch (error) {
      logger.error('Tema değiştirilirken hata oluştu', { error: (error as Error).message });
      return false;
    }
  }
  
  /**
   * Tema CSS dosyasını oluşturur
   * @returns Başarılı mı?
   */
  generateThemeCSS(): boolean {
    try {
      // Tema CSS'ini oluştur
      const theme = this.getCurrentTheme();
      const css = generateCSSVariables(theme);
      
      // CSS dosyasını kaydet
      fs.writeFileSync(THEME_CSS_PATH, css, 'utf8');
      
      logger.info('Tema CSS dosyası oluşturuldu', { theme: theme.name });
      return true;
    } catch (error) {
      logger.error('Tema CSS dosyası oluşturulurken hata oluştu', { error: (error as Error).message });
      return false;
    }
  }
  
  /**
   * Tema CSS dosyasını döndürür
   * @returns Tema CSS dosyası
   */
  getThemeCSS(): string {
    try {
      // CSS dosyası varsa oku
      if (fs.existsSync(THEME_CSS_PATH)) {
        return fs.readFileSync(THEME_CSS_PATH, 'utf8');
      }
      
      // CSS dosyası yoksa oluştur
      this.generateThemeCSS();
      return fs.readFileSync(THEME_CSS_PATH, 'utf8');
    } catch (error) {
      logger.error('Tema CSS dosyası okunurken hata oluştu', { error: (error as Error).message });
      
      // Hata durumunda CSS'i doğrudan oluştur
      const theme = this.getCurrentTheme();
      return generateCSSVariables(theme);
    }
  }
  
  /**
   * Tema CSS dosyasını döndürür (Express middleware için)
   * @param req Express isteği
   * @param res Express yanıtı
   */
  serveThemeCSS(req: any, res: any): void {
    try {
      // Tema CSS'ini al
      const css = this.getThemeCSS();
      
      // CSS yanıtını gönder
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 gün
      res.send(css);
    } catch (error) {
      logger.error('Tema CSS dosyası servis edilirken hata oluştu', { error: (error as Error).message });
      res.status(500).send('/* Tema CSS dosyası yüklenemedi */');
    }
  }
}

// Tema yöneticisi örneği
export const themeManager = new ThemeManager();

export default themeManager;
