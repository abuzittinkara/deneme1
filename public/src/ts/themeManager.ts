/**
 * public/src/ts/themeManager.ts
 * Tema yönetimi için TypeScript modülü
 */

// Tema türleri
export type ThemeType = 'light' | 'dark' | 'high-contrast';

// Tema yöneticisi arayüzü
export interface ThemeManager {
  getCurrentTheme(): ThemeType;
  setTheme(theme: ThemeType): void;
  toggleTheme(): void;
  applyTheme(theme: ThemeType): void;
  init(): void;
}

// Tema yöneticisi sınıfı
class ThemeManagerImpl implements ThemeManager {
  private currentTheme: ThemeType;
  private readonly storageKey = 'theme';
  private readonly defaultTheme: ThemeType = 'dark';
  private readonly themeChangeEvent = 'themeChange';

  constructor() {
    // Yerel depolamadan tema tercihini al veya varsayılan temayı kullan
    const savedTheme = localStorage.getItem(this.storageKey) as ThemeType;
    this.currentTheme = savedTheme || this.defaultTheme;
  }

  /**
   * Mevcut temayı döndürür
   * @returns Mevcut tema
   */
  public getCurrentTheme(): ThemeType {
    return this.currentTheme;
  }

  /**
   * Temayı değiştirir
   * @param theme - Yeni tema
   */
  public setTheme(theme: ThemeType): void {
    if (this.currentTheme === theme) {
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    this.saveTheme(theme);
    this.dispatchThemeChangeEvent(theme);
  }

  /**
   * Temayı değiştirir (açık/koyu/yüksek kontrast)
   */
  public toggleTheme(): void {
    const themes: ThemeType[] = ['light', 'dark', 'high-contrast'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  /**
   * Temayı uygular
   * @param theme - Uygulanacak tema
   */
  public applyTheme(theme: ThemeType): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Tema yöneticisini başlatır
   */
  public init(): void {
    // Mevcut temayı uygula
    this.applyTheme(this.currentTheme);

    // Tema değiştirme düğmelerini dinle
    this.setupThemeToggleListeners();

    console.log(`Tema yöneticisi başlatıldı: ${this.currentTheme}`);
  }

  /**
   * Temayı yerel depolamaya kaydeder
   * @param theme - Kaydedilecek tema
   */
  private saveTheme(theme: ThemeType): void {
    localStorage.setItem(this.storageKey, theme);
  }

  /**
   * Tema değişikliği olayını tetikler
   * @param theme - Yeni tema
   */
  private dispatchThemeChangeEvent(theme: ThemeType): void {
    const event = new CustomEvent(this.themeChangeEvent, {
      detail: { theme }
    });
    document.dispatchEvent(event);
  }

  /**
   * Tema değiştirme düğmelerini dinler
   */
  private setupThemeToggleListeners(): void {
    // Tema değiştirme düğmelerini seç
    const themeToggleButtons = document.querySelectorAll('[data-theme-toggle]');

    // Her düğmeye tıklama olayı ekle
    themeToggleButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        const targetTheme = (event.currentTarget as HTMLElement).getAttribute('data-theme-value') as ThemeType;
        
        if (targetTheme) {
          this.setTheme(targetTheme);
        } else {
          this.toggleTheme();
        }
      });
    });
  }
}

// Tema yöneticisi örneğini oluştur
export const themeManager: ThemeManager = new ThemeManagerImpl();

// Tema yöneticisini dışa aktar
export default themeManager;
