/**
 * src/modules/richTextFormatter.ts
 * Zengin metin biçimlendirme işlemleri
 */
import { logger } from '../utils/logger';

// Regular expressions for parsing markdown-like formatting
const BOLD_REGEX = /\*\*(.*?)\*\*/g;
const ITALIC_REGEX = /\*(.*?)\*/g;
const UNDERLINE_REGEX = /__(.*?)__/g;
const STRIKETHROUGH_REGEX = /~~(.*?)~~/g;
const CODE_REGEX = /`(.*?)`/g;
const CODE_BLOCK_REGEX = /```(.*?)```/gs;
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const EMOJI_REGEX = /:([\w+-]+):/g;

// URL metadata arayüzü
export interface UrlMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string | null;
}

// Common emojis mapping
export const EMOJI_MAP: Record<string, string> = {
  smile: '😊',
  laugh: '😂',
  wink: '😉',
  heart: '❤️',
  thumbsup: '👍',
  thumbsdown: '👎',
  clap: '👏',
  fire: '🔥',
  tada: '🎉',
  thinking: '🤔',
  check: '✅',
  x: '❌',
  warning: '⚠️',
  question: '❓',
  exclamation: '❗',
  rocket: '🚀',
  eyes: '👀',
  sob: '😭',
  angry: '😠',
  cool: '😎',
  party: '🥳',
  wave: '👋',
  pray: '🙏',
  ok: '👌',
  love: '😍',
  confused: '😕',
  cry: '😢',
  sleep: '😴',
  tongue: '😛',
  shocked: '😱',
  sick: '🤢',
  devil: '😈',
  angel: '😇',
  star: '⭐',
  sparkles: '✨',
  rainbow: '🌈',
  sun: '☀️',
  moon: '🌙',
  cloud: '☁️',
  rain: '🌧️',
  snow: '❄️',
  music: '🎵',
  gift: '🎁',
  balloon: '🎈',
  cake: '🎂',
  coffee: '☕',
  pizza: '🍕',
  hamburger: '🍔',
  beer: '🍺',
  wine: '🍷',
};

/**
 * Function to format text with markdown-like syntax
 * @param text - Input text
 * @returns Formatted text with HTML tags
 */
export function formatText(text: string): string {
  if (!text) return '';

  // Replace code blocks first (to avoid formatting inside code blocks)
  let formattedText = text.replace(CODE_BLOCK_REGEX, (match, p1) => {
    return `<pre><code>${p1}</code></pre>`;
  });

  // Replace inline code
  formattedText = formattedText.replace(CODE_REGEX, (match, p1) => {
    return `<code>${p1}</code>`;
  });

  // Apply other formatting
  formattedText = formattedText
    .replace(BOLD_REGEX, '<strong>$1</strong>')
    .replace(ITALIC_REGEX, '<em>$1</em>')
    .replace(UNDERLINE_REGEX, '<u>$1</u>')
    .replace(STRIKETHROUGH_REGEX, '<del>$1</del>');

  // Convert URLs to links
  formattedText = formattedText.replace(URL_REGEX, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Convert emoji codes to actual emojis
  formattedText = formattedText.replace(EMOJI_REGEX, (match, emojiName) => {
    return EMOJI_MAP[emojiName] || match;
  });

  return formattedText;
}

/**
 * Function to sanitize text to prevent XSS
 * @param text - Input text
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Function to process text (sanitize and then format)
 * @param text - Input text
 * @returns Processed text
 */
export function processText(text: string): string {
  const sanitized = sanitizeText(text);
  return formatText(sanitized);
}

/**
 * Function to extract URL metadata for link previews
 * @param url - URL to extract metadata from
 * @returns URL metadata
 */
export async function extractUrlMetadata(url: string): Promise<UrlMetadata | null> {
  try {
    // This would typically use a library like 'metascraper' or 'open-graph-scraper'
    // For simplicity, we'll return a basic structure
    return {
      url,
      title: 'Link Preview',
      description: 'Description would be extracted from the page',
      image: null,
    };
  } catch (error) {
    logger.error('Extract URL metadata error:', { error: (error as Error).message, url });
    return null;
  }
}

export default {
  formatText,
  sanitizeText,
  processText,
  extractUrlMetadata,
  EMOJI_MAP,
};
