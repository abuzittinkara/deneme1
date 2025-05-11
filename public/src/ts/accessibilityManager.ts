/**
 * public/src/ts/accessibilityManager.ts
 * Erişilebilirlik yönetimi için TypeScript modülü
 */

// Erişilebilirlik ayarları arayüzü
export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
}

// Erişilebilirlik yöneticisi arayüzü
export interface AccessibilityManager {
  getSettings(): AccessibilitySettings;
  toggleHighContrast(): void;
  toggleLargeText(): void;
  toggleReducedMotion(): void;
  toggleScreenReader(): void;
  applySettings(settings: AccessibilitySettings): void;
  init(): void;
}

// Erişilebilirlik yöneticisi sınıfı
class AccessibilityManagerImpl implements AccessibilityManager {
  private settings: AccessibilitySettings;
  private readonly storageKey = 'accessibility';
  private readonly settingsChangeEvent = 'accessibilitySettingsChange';

  constructor() {
    // Varsayılan ayarlar
    const defaultSettings: AccessibilitySettings = {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      screenReader: false
    };

    // Yerel depolamadan ayarları al veya varsayılan ayarları kullan
    const savedSettings = localStorage.getItem(this.storageKey);
    this.settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  }

  /**
   * Mevcut erişilebilirlik ayarlarını döndürür
   * @returns Erişilebilirlik ayarları
   */
  public getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  /**
   * Yüksek kontrast modunu açar/kapatır
   */
  public toggleHighContrast(): void {
    this.settings.highContrast = !this.settings.highContrast;
    this.applySettings(this.settings);
    this.saveSettings();
  }

  /**
   * Büyük yazı tipi modunu açar/kapatır
   */
  public toggleLargeText(): void {
    this.settings.largeText = !this.settings.largeText;
    this.applySettings(this.settings);
    this.saveSettings();
  }

  /**
   * Azaltılmış animasyon modunu açar/kapatır
   */
  public toggleReducedMotion(): void {
    this.settings.reducedMotion = !this.settings.reducedMotion;
    this.applySettings(this.settings);
    this.saveSettings();
  }

  /**
   * Ekran okuyucu modunu açar/kapatır
   */
  public toggleScreenReader(): void {
    this.settings.screenReader = !this.settings.screenReader;
    this.applySettings(this.settings);
    this.saveSettings();
  }

  /**
   * Erişilebilirlik ayarlarını uygular
   * @param settings - Uygulanacak ayarlar
   */
  public applySettings(settings: AccessibilitySettings): void {
    // HTML elementine veri özniteliklerini ekle
    document.documentElement.setAttribute('data-high-contrast', settings.highContrast.toString());
    document.documentElement.setAttribute('data-large-text', settings.largeText.toString());
    document.documentElement.setAttribute('data-reduced-motion', settings.reducedMotion.toString());
    document.documentElement.setAttribute('data-screen-reader', settings.screenReader.toString());

    // Arayüz elementlerini güncelle
    this.updateUIElements();

    // Ayarlar değişikliği olayını tetikle
    this.dispatchSettingsChangeEvent(settings);
  }

  /**
   * Erişilebilirlik yöneticisini başlatır
   */
  public init(): void {
    // Mevcut ayarları uygula
    this.applySettings(this.settings);

    // Erişilebilirlik panelini oluştur
    this.createAccessibilityPanel();

    // Erişilebilirlik düğmelerini dinle
    this.setupAccessibilityListeners();

    console.log('Erişilebilirlik yöneticisi başlatıldı');
  }

  /**
   * Ayarları yerel depolamaya kaydeder
   */
  private saveSettings(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
  }

  /**
   * Ayarlar değişikliği olayını tetikler
   * @param settings - Yeni ayarlar
   */
  private dispatchSettingsChangeEvent(settings: AccessibilitySettings): void {
    const event = new CustomEvent(this.settingsChangeEvent, {
      detail: { settings }
    });
    document.dispatchEvent(event);
  }

  /**
   * Arayüz elementlerini günceller
   */
  private updateUIElements(): void {
    // Yüksek kontrast modu düğmesi
    const highContrastBtn = document.getElementById('high-contrast-btn');
    if (highContrastBtn) {
      if (this.settings.highContrast) {
        highContrastBtn.classList.add('active');
      } else {
        highContrastBtn.classList.remove('active');
      }
    }

    // Büyük yazı tipi modu düğmesi
    const largeTextBtn = document.getElementById('large-text-btn');
    if (largeTextBtn) {
      if (this.settings.largeText) {
        largeTextBtn.classList.add('active');
      } else {
        largeTextBtn.classList.remove('active');
      }
    }

    // Azaltılmış animasyon modu düğmesi
    const reducedMotionBtn = document.getElementById('reduced-motion-btn');
    if (reducedMotionBtn) {
      if (this.settings.reducedMotion) {
        reducedMotionBtn.classList.add('active');
      } else {
        reducedMotionBtn.classList.remove('active');
      }
    }

    // Ekran okuyucu modu düğmesi
    const screenReaderBtn = document.getElementById('screen-reader-btn');
    if (screenReaderBtn) {
      if (this.settings.screenReader) {
        screenReaderBtn.classList.add('active');
      } else {
        screenReaderBtn.classList.remove('active');
      }
    }
  }

  /**
   * Erişilebilirlik panelini oluşturur
   */
  private createAccessibilityPanel(): void {
    // Erişilebilirlik menüsü düğmesi
    const accessibilityMenu = document.createElement('div');
    accessibilityMenu.className = 'accessibility-menu';
    accessibilityMenu.setAttribute('aria-label', 'Erişilebilirlik menüsünü aç');
    accessibilityMenu.innerHTML = '<span class="material-icons accessibility-menu-icon">accessibility</span>';
    
    // Erişilebilirlik paneli
    const accessibilityPanel = document.createElement('div');
    accessibilityPanel.className = 'accessibility-panel';
    accessibilityPanel.innerHTML = `
      <h3>Erişilebilirlik Ayarları</h3>
      <div class="accessibility-panel-option">
        <button id="high-contrast-btn" class="accessibility-button ${this.settings.highContrast ? 'active' : ''}">
          Yüksek Kontrast
        </button>
      </div>
      <div class="accessibility-panel-option">
        <button id="large-text-btn" class="accessibility-button ${this.settings.largeText ? 'active' : ''}">
          Büyük Yazı Tipi
        </button>
      </div>
      <div class="accessibility-panel-option">
        <button id="reduced-motion-btn" class="accessibility-button ${this.settings.reducedMotion ? 'active' : ''}">
          Azaltılmış Animasyon
        </button>
      </div>
      <div class="accessibility-panel-option">
        <button id="screen-reader-btn" class="accessibility-button ${this.settings.screenReader ? 'active' : ''}">
          Ekran Okuyucu Desteği
        </button>
      </div>
    `;
    
    // Belgeye ekle
    document.body.appendChild(accessibilityMenu);
    document.body.appendChild(accessibilityPanel);
    
    // Menü düğmesine tıklama olayı ekle
    accessibilityMenu.addEventListener('click', () => {
      accessibilityPanel.classList.toggle('active');
    });
    
    // Belge tıklaması ile paneli kapat
    document.addEventListener('click', (event) => {
      if (!accessibilityMenu.contains(event.target as Node) && 
          !accessibilityPanel.contains(event.target as Node)) {
        accessibilityPanel.classList.remove('active');
      }
    });
  }

  /**
   * Erişilebilirlik düğmelerini dinler
   */
  private setupAccessibilityListeners(): void {
    // Yüksek kontrast modu düğmesi
    const highContrastBtn = document.getElementById('high-contrast-btn');
    if (highContrastBtn) {
      highContrastBtn.addEventListener('click', () => this.toggleHighContrast());
    }
    
    // Büyük yazı tipi modu düğmesi
    const largeTextBtn = document.getElementById('large-text-btn');
    if (largeTextBtn) {
      largeTextBtn.addEventListener('click', () => this.toggleLargeText());
    }
    
    // Azaltılmış animasyon modu düğmesi
    const reducedMotionBtn = document.getElementById('reduced-motion-btn');
    if (reducedMotionBtn) {
      reducedMotionBtn.addEventListener('click', () => this.toggleReducedMotion());
    }
    
    // Ekran okuyucu modu düğmesi
    const screenReaderBtn = document.getElementById('screen-reader-btn');
    if (screenReaderBtn) {
      screenReaderBtn.addEventListener('click', () => this.toggleScreenReader());
    }
  }
}

// Erişilebilirlik yöneticisi örneğini oluştur
export const accessibilityManager: AccessibilityManager = new AccessibilityManagerImpl();

// Erişilebilirlik yöneticisini dışa aktar
export default accessibilityManager;
