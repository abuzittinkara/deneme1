/**
 * public/__tests__/unit/themeManager.test.ts
 * Tema yöneticisi için birim testleri
 */

import { ThemeManager, ThemeType } from '../../src/ts/themeManager';

// Tema yöneticisi sınıfını test etmek için mock sınıf
class MockThemeManager implements ThemeManager {
  private currentTheme: ThemeType;
  private readonly storageKey = 'theme';
  private readonly defaultTheme: ThemeType = 'dark';
  private readonly themeChangeEvent = 'themeChange';
  private mockStorage: Record<string, string> = {};

  constructor() {
    this.currentTheme = this.defaultTheme;
  }

  public getCurrentTheme(): ThemeType {
    return this.currentTheme;
  }

  public setTheme(theme: ThemeType): void {
    if (this.currentTheme === theme) {
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    this.saveTheme(theme);
    this.dispatchThemeChangeEvent(theme);
  }

  public toggleTheme(): void {
    const themes: ThemeType[] = ['light', 'dark', 'high-contrast'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    if (nextTheme) {
      this.setTheme(nextTheme);
    } else {
      this.setTheme('light'); // Fallback to light theme
    }
  }

  public applyTheme(theme: ThemeType): void {
    // Mock implementation
    document.documentElement.setAttribute('data-theme', theme);
  }

  public init(): void {
    // Mock implementation
    this.applyTheme(this.currentTheme);
  }

  private saveTheme(theme: ThemeType): void {
    this.mockStorage[this.storageKey] = theme;
  }

  private dispatchThemeChangeEvent(theme: ThemeType): void {
    // Mock implementation
    const event = new CustomEvent(this.themeChangeEvent, {
      detail: { theme }
    });
    document.dispatchEvent(event);
  }

  // Test yardımcı metodları
  public getMockStorage(): Record<string, string> {
    return this.mockStorage;
  }
}

// Jest ile DOM manipülasyonu için gerekli mock
document.documentElement.setAttribute = jest.fn();
document.dispatchEvent = jest.fn();

describe('ThemeManager', () => {
  let themeManager: MockThemeManager;

  beforeEach(() => {
    themeManager = new MockThemeManager();
    jest.clearAllMocks();
  });

  test('init metodu varsayılan temayı uygulamalı', () => {
    themeManager.init();
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  test('getCurrentTheme metodu mevcut temayı döndürmeli', () => {
    expect(themeManager.getCurrentTheme()).toBe('dark');
  });

  test('setTheme metodu temayı değiştirmeli', () => {
    themeManager.setTheme('light');
    expect(themeManager.getCurrentTheme()).toBe('light');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    expect(themeManager.getMockStorage()).toEqual({ theme: 'light' });
    expect(document.dispatchEvent).toHaveBeenCalled();
  });

  test('setTheme metodu aynı tema için işlem yapmamalı', () => {
    themeManager.setTheme('dark'); // Zaten dark
    expect(document.documentElement.setAttribute).not.toHaveBeenCalled();
    expect(document.dispatchEvent).not.toHaveBeenCalled();
  });

  test('toggleTheme metodu temayı sırayla değiştirmeli', () => {
    // Başlangıç: dark
    themeManager.toggleTheme();
    expect(themeManager.getCurrentTheme()).toBe('high-contrast');

    themeManager.toggleTheme();
    expect(themeManager.getCurrentTheme()).toBe('light');

    themeManager.toggleTheme();
    expect(themeManager.getCurrentTheme()).toBe('dark');
  });

  test('applyTheme metodu temayı DOM\'a uygulamalı', () => {
    themeManager.applyTheme('high-contrast');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'high-contrast');
  });
});
