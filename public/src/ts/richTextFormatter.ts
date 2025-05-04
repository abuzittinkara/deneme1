/**
 * public/src/ts/richTextFormatter.ts
 * Zengin metin biçimlendirme modülü
 * Markdown benzeri sözdizimi ile metin biçimlendirme işlevselliği sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

/**
 * Zengin metin biçimlendirmeyi başlatır
 * @param socket - Socket.io socket
 */
export function initRichTextFormatter(socket: Socket): void {
  // Metin giriş alanlarına araç çubuğu ekle
  addFormattingToolbar();

  // Klavye kısayollarını dinle
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!e.ctrlKey) {
      return;
    }

    const inputElement = document.activeElement as HTMLTextAreaElement;
    if (
      !inputElement ||
      !inputElement.tagName ||
      inputElement.tagName.toLowerCase() !== 'textarea'
    ) {
      return;
    }

    // Ctrl+B: Kalın
    if (e.key === 'b') {
      e.preventDefault();
      applyFormatting(inputElement, '**', '**');
    }

    // Ctrl+I: İtalik
    if (e.key === 'i') {
      e.preventDefault();
      applyFormatting(inputElement, '*', '*');
    }

    // Ctrl+U: Altı çizili
    if (e.key === 'u') {
      e.preventDefault();
      applyFormatting(inputElement, '__', '__');
    }

    // Ctrl+S: Üstü çizili
    if (e.key === 's') {
      e.preventDefault();
      applyFormatting(inputElement, '~~', '~~');
    }

    // Ctrl+K: Kod
    if (e.key === 'k') {
      e.preventDefault();
      applyFormatting(inputElement, '`', '`');
    }
  });
}

/**
 * Metin giriş alanlarına biçimlendirme araç çubuğu ekler
 */
function addFormattingToolbar(): void {
  // Metin kanalı giriş alanına araç çubuğu ekle
  const textChannelInput = document.querySelector('#textChatInputBar');
  if (textChannelInput) {
    const toolbar = createFormattingToolbar();
    textChannelInput.insertBefore(toolbar, textChannelInput.firstChild);
  }

  // DM giriş alanına araç çubuğu ekle
  const dmInput = document.querySelector('#dmChatInputBar');
  if (dmInput) {
    const toolbar = createFormattingToolbar();
    dmInput.insertBefore(toolbar, dmInput.firstChild);
  }
}

/**
 * Biçimlendirme araç çubuğu oluşturur
 * @returns Biçimlendirme araç çubuğu elementi
 */
function createFormattingToolbar(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'formatting-toolbar';

  // Kalın düğmesi
  const boldBtn = document.createElement('button');
  boldBtn.className = 'formatting-btn bold-btn';
  boldBtn.innerHTML = '<span class="material-icons">format_bold</span>';
  boldBtn.title = 'Kalın (Ctrl+B)';
  boldBtn.addEventListener('click', () => {
    const textarea = toolbar.parentElement?.querySelector('textarea');
    if (textarea) {
      applyFormatting(textarea, '**', '**');
    }
  });

  // İtalik düğmesi
  const italicBtn = document.createElement('button');
  italicBtn.className = 'formatting-btn italic-btn';
  italicBtn.innerHTML = '<span class="material-icons">format_italic</span>';
  italicBtn.title = 'İtalik (Ctrl+I)';
  italicBtn.addEventListener('click', () => {
    const textarea = toolbar.parentElement?.querySelector('textarea');
    if (textarea) {
      applyFormatting(textarea, '*', '*');
    }
  });

  // Altı çizili düğmesi
  const underlineBtn = document.createElement('button');
  underlineBtn.className = 'formatting-btn underline-btn';
  underlineBtn.innerHTML = '<span class="material-icons">format_underlined</span>';
  underlineBtn.title = 'Altı Çizili (Ctrl+U)';
  underlineBtn.addEventListener('click', () => {
    const textarea = toolbar.parentElement?.querySelector('textarea');
    if (textarea) {
      applyFormatting(textarea, '__', '__');
    }
  });

  // Üstü çizili düğmesi
  const strikethroughBtn = document.createElement('button');
  strikethroughBtn.className = 'formatting-btn strikethrough-btn';
  strikethroughBtn.innerHTML = '<span class="material-icons">strikethrough_s</span>';
  strikethroughBtn.title = 'Üstü Çizili (Ctrl+S)';
  strikethroughBtn.addEventListener('click', () => {
    const textarea = toolbar.parentElement?.querySelector('textarea');
    if (textarea) {
      applyFormatting(textarea, '~~', '~~');
    }
  });

  // Kod düğmesi
  const codeBtn = document.createElement('button');
  codeBtn.className = 'formatting-btn code-btn';
  codeBtn.innerHTML = '<span class="material-icons">code</span>';
  codeBtn.title = 'Kod (Ctrl+K)';
  codeBtn.addEventListener('click', () => {
    const textarea = toolbar.parentElement?.querySelector('textarea');
    if (textarea) {
      applyFormatting(textarea, '`', '`');
    }
  });

  // Düğmeleri araç çubuğuna ekle
  toolbar.appendChild(boldBtn);
  toolbar.appendChild(italicBtn);
  toolbar.appendChild(underlineBtn);
  toolbar.appendChild(strikethroughBtn);
  toolbar.appendChild(codeBtn);

  return toolbar;
}

/**
 * Seçili metne biçimlendirme uygular
 * @param textarea - Metin giriş alanı
 * @param prefix - Biçimlendirme ön eki
 * @param suffix - Biçimlendirme son eki
 */
function applyFormatting(textarea: HTMLTextAreaElement, prefix: string, suffix: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);

  // Seçili metin varsa, biçimlendirme uygula
  if (selectedText) {
    const formattedText = prefix + selectedText + suffix;
    textarea.setRangeText(formattedText, start, end, 'select');
    textarea.focus();
  } else {
    // Seçili metin yoksa, biçimlendirme işaretlerini ekle ve imleci aralarına yerleştir
    const cursorPos = textarea.selectionStart;
    textarea.setRangeText(prefix + suffix, cursorPos, cursorPos, 'select');
    textarea.selectionStart = cursorPos + prefix.length;
    textarea.selectionEnd = cursorPos + prefix.length;
    textarea.focus();
  }
}

/**
 * Metindeki biçimlendirme işaretlerini HTML'e dönüştürür
 * @param text - Biçimlendirilecek metin
 * @returns HTML olarak biçimlendirilmiş metin
 */
export function formatText(text: string): string {
  if (!text) {
    return '';
  }

  // Kod bloklarını işle
  text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Satır içi kodu işle
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Kalın metni işle
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // İtalik metni işle
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Altı çizili metni işle
  text = text.replace(/__(.*?)__/g, '<u>$1</u>');

  // Üstü çizili metni işle
  text = text.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Bağlantıları işle
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Satır sonlarını işle
  text = text.replace(/\n/g, '<br>');

  return text;
}
