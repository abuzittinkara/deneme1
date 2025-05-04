/**
 * public/src/ts/feedback.ts
 * Kullanıcı geri bildirimi modülü
 * Toast bildirimleri, yükleme göstergeleri ve hata mesajları için kullanılır
 */

// Toast tipi
type ToastType = 'info' | 'success' | 'warning' | 'error';

// Toast seçenekleri arayüzü
interface ToastOptions {
  type?: ToastType;
  duration?: number;
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
  showProgress?: boolean;
  closable?: boolean;
}

/**
 * Kullanıcı geri bildirimi sistemini başlatır
 */
export function initFeedback(): void {
  // Toast konteyneri oluştur
  createToastContainer();

  // Yükleme göstergesi konteyneri oluştur
  createLoadingContainer();

  // Global hata yakalama
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Formlar için geri bildirim
  document.addEventListener('submit', handleFormSubmit);

  // Butonlar için geri bildirim
  document.addEventListener('click', handleButtonClick);
}

/**
 * Toast konteyneri oluşturur
 */
function createToastContainer(): void {
  // Mevcut konteyneri kontrol et
  let container = document.getElementById('toast-container');

  // Konteyner yoksa oluştur
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

/**
 * Yükleme göstergesi konteyneri oluşturur
 */
function createLoadingContainer(): void {
  // Mevcut konteyneri kontrol et
  let container = document.getElementById('loading-container');

  // Konteyner yoksa oluştur
  if (!container) {
    container = document.createElement('div');
    container.id = 'loading-container';
    container.className = 'loading-container';
    document.body.appendChild(container);
  }
}

/**
 * Global hata olaylarını işler
 * @param event - Hata olayı
 */
function handleGlobalError(event: ErrorEvent): void {
  console.error('Global hata:', event.error || event.message);

  // Kullanıcıya bildir
  showToast('Bir hata oluştu: ' + (event.error?.message || event.message), {
    type: 'error',
    duration: 5000,
  });
}

/**
 * İşlenmeyen promise reddetmelerini işler
 * @param event - Promise reddetme olayı
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  console.error('İşlenmeyen promise reddetmesi:', event.reason);

  // Kullanıcıya bildir
  showToast('Bir hata oluştu: ' + (event.reason?.message || 'Bilinmeyen hata'), {
    type: 'error',
    duration: 5000,
  });
}

/**
 * Form gönderimlerini işler
 * @param event - Form gönderme olayı
 */
function handleFormSubmit(event: Event): void {
  const form = event.target as HTMLFormElement;

  // Form gönderim geri bildirimi
  if (form && form.tagName === 'FORM') {
    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    if (submitButton) {
      // Buton metnini kaydet
      const originalText = submitButton.textContent || '';

      // Yükleniyor durumunu göster
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="loading-spinner-small"></span> Gönderiliyor...';

      // Form gönderiminden sonra butonu eski haline getir
      setTimeout(() => {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }, 2000);
    }
  }
}

/**
 * Buton tıklamalarını işler
 * @param event - Tıklama olayı
 */
function handleButtonClick(event: Event): void {
  const target = event.target as HTMLElement;
  const button = target.closest('button:not([type="submit"])') as HTMLButtonElement;

  // Buton tıklama geri bildirimi
  if (button && !button.classList.contains('no-feedback')) {
    // Dalga efekti ekle
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';

    const rect = button.getBoundingClientRect();
    const x = (event as MouseEvent).clientX - rect.left;
    const y = (event as MouseEvent).clientY - rect.top;

    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    button.appendChild(ripple);

    // Dalga efektini kaldır
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }
}

/**
 * Toast bildirimi gösterir
 * @param message - Bildirim mesajı
 * @param options - Bildirim seçenekleri
 */
export function showToast(message: string, options: ToastOptions = {}): void {
  // Varsayılan seçenekler
  const defaultOptions: ToastOptions = {
    type: 'info',
    duration: 3000,
    position: 'bottom-center',
    showProgress: true,
    closable: true,
  };

  // Seçenekleri birleştir
  const settings = { ...defaultOptions, ...options };

  // Toast konteyneri
  const container = document.getElementById('toast-container');
  if (!container) {
    return;
  }

  // Toast pozisyonunu ayarla
  container.className = 'toast-container ' + settings.position;

  // Toast elementi oluştur
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + settings.type;

  // Toast içeriği
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-message">${message}</div>
      ${settings.closable ? '<button class="toast-close">&times;</button>' : ''}
    </div>
    ${settings.showProgress ? '<div class="toast-progress"></div>' : ''}
  `;

  // Toastı konteynere ekle
  container.appendChild(toast);

  // İlerleme çubuğu
  const progressBar = toast.querySelector('.toast-progress') as HTMLElement;
  if (progressBar && settings.showProgress) {
    progressBar.style.animationDuration = settings.duration + 'ms';
  }

  // Kapatma düğmesi
  const closeButton = toast.querySelector('.toast-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      removeToast(toast);
    });
  }

  // Belirli bir süre sonra toastı kaldır
  setTimeout(() => {
    removeToast(toast);
  }, settings.duration);
}

/**
 * Toast bildirimini kaldırır
 * @param toast - Toast elementi
 */
function removeToast(toast: HTMLElement): void {
  toast.classList.add('toast-hide');

  // Animasyon tamamlandıktan sonra elementi kaldır
  toast.addEventListener('animationend', () => {
    toast.remove();
  });
}

/**
 * Yükleme göstergesini gösterir
 * @param message - Yükleme mesajı
 */
export function showLoading(message = 'Yükleniyor...'): void {
  // Yükleme konteyneri
  const container = document.getElementById('loading-container');
  if (!container) {
    return;
  }

  // Mevcut yükleme göstergesini temizle
  container.innerHTML = '';

  // Yükleme göstergesi oluştur
  const loader = document.createElement('div');
  loader.className = 'loading-overlay';
  loader.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-message">${message}</div>
  `;

  // Yükleme göstergesini konteynere ekle
  container.appendChild(loader);
  container.style.display = 'flex';
}

/**
 * Yükleme göstergesini gizler
 */
export function hideLoading(): void {
  // Yükleme konteyneri
  const container = document.getElementById('loading-container');
  if (!container) {
    return;
  }

  // Yükleme göstergesini gizle
  container.style.display = 'none';
  container.innerHTML = '';
}

/**
 * Hata mesajı gösterir
 * @param message - Hata mesajı
 * @param title - Hata başlığı
 */
export function showError(message: string, title = 'Hata'): void {
  // Modal oluştur
  const modal = document.createElement('div');
  modal.className = 'error-modal';
  modal.innerHTML = `
    <div class="error-modal-content">
      <div class="error-modal-header">
        <h2>${title}</h2>
        <button class="error-modal-close">&times;</button>
      </div>
      <div class="error-modal-body">
        <p>${message}</p>
      </div>
      <div class="error-modal-footer">
        <button class="error-modal-ok">Tamam</button>
      </div>
    </div>
  `;

  // Modalı body'e ekle
  document.body.appendChild(modal);

  // Kapatma düğmesi
  const closeButton = modal.querySelector('.error-modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      modal.remove();
    });
  }

  // Tamam düğmesi
  const okButton = modal.querySelector('.error-modal-ok');
  if (okButton) {
    okButton.addEventListener('click', () => {
      modal.remove();
    });
  }

  // ESC tuşu ile kapatma
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

/**
 * Onay mesajı gösterir
 * @param message - Onay mesajı
 * @param onConfirm - Onay fonksiyonu
 * @param onCancel - İptal fonksiyonu
 * @param title - Onay başlığı
 */
export function showConfirm(
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  title = 'Onay'
): void {
  // Modal oluştur
  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <div class="confirm-modal-header">
        <h2>${title}</h2>
        <button class="confirm-modal-close">&times;</button>
      </div>
      <div class="confirm-modal-body">
        <p>${message}</p>
      </div>
      <div class="confirm-modal-footer">
        <button class="confirm-modal-cancel">İptal</button>
        <button class="confirm-modal-confirm">Onayla</button>
      </div>
    </div>
  `;

  // Modalı body'e ekle
  document.body.appendChild(modal);

  // Kapatma düğmesi
  const closeButton = modal.querySelector('.confirm-modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      modal.remove();
      if (onCancel) {
        onCancel();
      }
    });
  }

  // İptal düğmesi
  const cancelButton = modal.querySelector('.confirm-modal-cancel');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      modal.remove();
      if (onCancel) {
        onCancel();
      }
    });
  }

  // Onay düğmesi
  const confirmButton = modal.querySelector('.confirm-modal-confirm');
  if (confirmButton) {
    confirmButton.addEventListener('click', () => {
      modal.remove();
      onConfirm();
    });
  }

  // ESC tuşu ile kapatma
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      modal.remove();
      if (onCancel) {
        onCancel();
      }
      document.removeEventListener('keydown', escHandler);
    }
  });
}
