/**
 * src/config/themes.ts
 * Tema ve görünüm yapılandırması
 */
import { logger } from '../utils/logger';

// Tema türleri
export type ThemeType = 'light' | 'dark' | 'system';

// Tema renkleri
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  light: string;
  dark: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  divider: string;
  shadow: string;
  overlay: string;
}

// Tema yazı tipleri
export interface ThemeFonts {
  primary: string;
  secondary: string;
  monospace: string;
  sizes: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  weights: {
    light: number;
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
}

// Tema boşlukları
export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

// Tema yuvarlak köşeleri
export interface ThemeRadius {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  pill: string;
  circle: string;
}

// Tema gölgeleri
export interface ThemeShadows {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

// Tema geçişleri
export interface ThemeTransitions {
  fast: string;
  normal: string;
  slow: string;
}

// Tema yapılandırması
export interface Theme {
  name: string;
  type: ThemeType;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadows: ThemeShadows;
  transitions: ThemeTransitions;
}

// Açık tema
export const lightTheme: Theme = {
  name: 'light',
  type: 'light',
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    light: '#f8f9fa',
    dark: '#343a40',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#212529',
    textSecondary: '#6c757d',
    border: '#dee2e6',
    divider: '#e9ecef',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)'
  },
  fonts: {
    primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    secondary: "'Arial', sans-serif",
    monospace: "'Consolas', 'Monaco', 'Andale Mono', monospace",
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.25rem',
      xl: '1.5rem',
      xxl: '2rem'
    },
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem'
  },
  radius: {
    xs: '0.125rem',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '1rem',
    pill: '50rem',
    circle: '50%'
  },
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 2px 4px rgba(0, 0, 0, 0.075)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.125)',
    xl: '0 12px 28px rgba(0, 0, 0, 0.15)'
  },
  transitions: {
    fast: '0.15s ease',
    normal: '0.3s ease',
    slow: '0.5s ease'
  }
};

// Koyu tema
export const darkTheme: Theme = {
  name: 'dark',
  type: 'dark',
  colors: {
    primary: '#0d6efd',
    secondary: '#6c757d',
    success: '#198754',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#0dcaf0',
    light: '#f8f9fa',
    dark: '#212529',
    background: '#121212',
    surface: '#1e1e1e',
    text: '#f8f9fa',
    textSecondary: '#adb5bd',
    border: '#495057',
    divider: '#343a40',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)'
  },
  fonts: {
    primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    secondary: "'Arial', sans-serif",
    monospace: "'Consolas', 'Monaco', 'Andale Mono', monospace",
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.25rem',
      xl: '1.5rem',
      xxl: '2rem'
    },
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem'
  },
  radius: {
    xs: '0.125rem',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '1rem',
    pill: '50rem',
    circle: '50%'
  },
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.2)',
    sm: '0 2px 4px rgba(0, 0, 0, 0.25)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.35)',
    xl: '0 12px 28px rgba(0, 0, 0, 0.4)'
  },
  transitions: {
    fast: '0.15s ease',
    normal: '0.3s ease',
    slow: '0.5s ease'
  }
};

// Tüm temalar
export const themes: Record<string, Theme> = {
  light: lightTheme,
  dark: darkTheme
};

// Varsayılan tema
export const DEFAULT_THEME: ThemeType = 'light';

/**
 * Tema alır
 * @param type Tema türü
 * @returns Tema
 */
export function getTheme(type: ThemeType = DEFAULT_THEME): Theme {
  if (type === 'system') {
    // Sistem temasını belirle (tarayıcı veya işletim sistemi)
    // Bu sadece istemci tarafında çalışır, sunucu tarafında varsayılan tema kullanılır
    return themes[DEFAULT_THEME];
  }
  
  return themes[type] || themes[DEFAULT_THEME];
}

/**
 * CSS değişkenlerini oluşturur
 * @param theme Tema
 * @returns CSS değişkenleri
 */
export function generateCSSVariables(theme: Theme): string {
  try {
    let css = `:root {\n`;
    
    // Renkler
    Object.entries(theme.colors).forEach(([key, value]) => {
      css += `  --color-${key}: ${value};\n`;
    });
    
    // Yazı tipleri
    css += `  --font-primary: ${theme.fonts.primary};\n`;
    css += `  --font-secondary: ${theme.fonts.secondary};\n`;
    css += `  --font-monospace: ${theme.fonts.monospace};\n`;
    
    // Yazı tipi boyutları
    Object.entries(theme.fonts.sizes).forEach(([key, value]) => {
      css += `  --font-size-${key}: ${value};\n`;
    });
    
    // Yazı tipi ağırlıkları
    Object.entries(theme.fonts.weights).forEach(([key, value]) => {
      css += `  --font-weight-${key}: ${value};\n`;
    });
    
    // Boşluklar
    Object.entries(theme.spacing).forEach(([key, value]) => {
      css += `  --spacing-${key}: ${value};\n`;
    });
    
    // Yuvarlak köşeler
    Object.entries(theme.radius).forEach(([key, value]) => {
      css += `  --radius-${key}: ${value};\n`;
    });
    
    // Gölgeler
    Object.entries(theme.shadows).forEach(([key, value]) => {
      css += `  --shadow-${key}: ${value};\n`;
    });
    
    // Geçişler
    Object.entries(theme.transitions).forEach(([key, value]) => {
      css += `  --transition-${key}: ${value};\n`;
    });
    
    css += `}\n`;
    
    return css;
  } catch (error) {
    logger.error('CSS değişkenleri oluşturulurken hata oluştu', { error: (error as Error).message });
    return '';
  }
}

export default {
  lightTheme,
  darkTheme,
  themes,
  DEFAULT_THEME,
  getTheme,
  generateCSSVariables
};
