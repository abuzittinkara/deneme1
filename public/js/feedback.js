// public/js/feedback.js

/**
 * Kullanıcı geri bildirimi modülü
 * Toast bildirimleri, yükleme göstergeleri ve hata mesajları için kullanılır
 */

/**
 * Kullanıcı geri bildirimi sistemini başlatır
 */
export function initFeedback() {
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
function createToastContainer() {
  if (!document.getElementById('toastContainer')) {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
}

/**
 * Yükleme göstergesi konteyneri oluşturur
 */
function createLoadingContainer() {
  if (!document.getElementById('loadingContainer')) {
    const container = document.createElement('div');
    container.id = 'loadingContainer';
    container.className = 'loading-container hidden';
    
    container.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      <div class="loading-text">Yükleniyor...</div>
    `;
    
    document.body.appendChild(container);
  }
}

/**
 * Global hata olayını işler
 * @param {ErrorEvent} event - Hata olayı
 */
function handleGlobalError(event) {
  console.error('Global error:', event.error || event.message);
  
  // Kullanıcıya hata bildirimi göster
  showToast('Bir hata oluştu: ' + (event.error?.message || event.message), 'error');
  
  // Yükleme göstergesini gizle (varsa)
  hideLoading();
}

/**
 * İşlenmeyen promise reddetmelerini işler
 * @param {PromiseRejectionEvent} event - Promise reddetme olayı
 */
function handleUnhandledRejection(event) {
  console.error('Unhandled rejection:', event.reason);
  
  // Kullanıcıya hata bildirimi göster
  showToast('Bir hata oluştu: ' + (event.reason?.message || 'Bilinmeyen hata'), 'error');
  
  // Yükleme göstergesini gizle (varsa)
  hideLoading();
}

/**
 * Form gönderimlerini işler
 * @param {Event} event - Form gönderme olayı
 */
function handleFormSubmit(event) {
  const form = event.target;
  
  // Sadece data-feedback özelliği olan formları işle
  if (form.tagName === 'FORM' && form.hasAttribute('data-feedback')) {
    // Yükleme göstergesini göster
    showLoading(form.getAttribute('data-feedback-text') || 'Gönderiliyor...');
    
    // Form gönderim başarılı olduğunda
    const originalSubmit = form.onsubmit;
    form.onsubmit = function(e) {
      if (originalSubmit) {
        const result = originalSubmit.call(this, e);
        if (result === false) {
          hideLoading();
        }
        return result;
      }
    };
  }
}

/**
 * Buton tıklamalarını işler
 * @param {Event} event - Tıklama olayı
 */
function handleButtonClick(event) {
  const button = event.target.closest('button, .btn');
  
  // Sadece data-feedback özelliği olan butonları işle
  if (button && button.hasAttribute('data-feedback')) {
    // Butonun durumunu güncelle
    updateButtonState(button, 'loading');
    
    // Yükleme göstergesini göster (gerekirse)
    if (button.hasAttribute('data-show-loading')) {
      showLoading(button.getAttribute('data-feedback-text') || 'İşleniyor...');
    }
    
    // İşlem tamamlandığında
    setTimeout(() => {
      // Bu sadece örnek amaçlıdır, gerçek uygulamada işlem tamamlandığında çağrılmalıdır
      updateButtonState(button, 'normal');
      hideLoading();
    }, 2000);
  }
}

/**
 * Buton durumunu günceller
 * @param {HTMLElement} button - Buton elementi
 * @param {string} state - Buton durumu (normal, loading, success, error)
 */
function updateButtonState(button, state) {
  // Önceki durumu temizle
  button.classList.remove('btn-loading', 'btn-success', 'btn-error');
  
  // Yeni durumu ayarla
  switch (state) {
    case 'loading':
      button.classList.add('btn-loading');
      button.disabled = true;
      
      // Orijinal metni sakla
      if (!button.hasAttribute('data-original-text')) {
        button.setAttribute('data-original-text', button.textContent);
      }
      
      // Yükleme metni
      const loadingText = button.getAttribute('data-loading-text');
      if (loadingText) {
        button.textContent = loadingText;
      }
      break;
    
    case 'success':
      button.classList.add('btn-success');
      button.disabled = false;
      
      // Başarı metni
      const successText = button.getAttribute('data-success-text');
      if (successText) {
        button.textContent = successText;
        
        // Belirli bir süre sonra normal duruma dön
        setTimeout(() => {
          updateButtonState(button, 'normal');
        }, 2000);
      } else {
        // Orijinal metne dön
        if (button.hasAttribute('data-original-text')) {
          button.textContent = button.getAttribute('data-original-text');
        }
      }
      break;
    
    case 'error':
      button.classList.add('btn-error');
      button.disabled = false;
      
      // Hata metni
      const errorText = button.getAttribute('data-error-text');
      if (errorText) {
        button.textContent = errorText;
        
        // Belirli bir süre sonra normal duruma dön
        setTimeout(() => {
          updateButtonState(button, 'normal');
        }, 2000);
      } else {
        // Orijinal metne dön
        if (button.hasAttribute('data-original-text')) {
          button.textContent = button.getAttribute('data-original-text');
        }
      }
      break;
    
    case 'normal':
    default:
      button.disabled = false;
      
      // Orijinal metne dön
      if (button.hasAttribute('data-original-text')) {
        button.textContent = button.getAttribute('data-original-text');
      }
      break;
  }
}

/**
 * Toast bildirimi gösterir
 * @param {string} message - Bildirim mesajı
 * @param {string} type - Bildirim türü (success, error, warning, info)
 * @param {number} duration - Bildirim süresi (ms)
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Toast konteyneri
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    createToastContainer();
    toastContainer = document.getElementById('toastContainer');
  }
  
  // Toast oluştur
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Toast içeriği
  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-icons">${getToastIcon(type)}</span>
    </div>
    <div class="toast-message">${message}</div>
    <button class="toast-close">
      <span class="material-icons">close</span>
    </button>
  `;
  
  // Toast'u konteynere ekle
  toastContainer.appendChild(toast);
  
  // Kapatma düğmesi olayı
  const closeButton = toast.querySelector('.toast-close');
  closeButton.addEventListener('click', () => {
    toast.classList.add('closing');
    setTimeout(() => {
      toast.remove();
    }, 300);
  });
  
  // Otomatik kapanma
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('closing');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }, duration);
  
  // Toast animasyonu
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
}

/**
 * Bildirim türüne göre ikon döndürür
 * @param {string} type - Bildirim türü
 * @returns {string} - Material icon adı
 */
function getToastIcon(type) {
  switch (type) {
    case 'success':
      return 'check_circle';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Yükleme göstergesini gösterir
 * @param {string} message - Yükleme mesajı
 */
export function showLoading(message = 'Yükleniyor...') {
  const loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    createLoadingContainer();
  }
  
  const loadingText = document.querySelector('#loadingContainer .loading-text');
  if (loadingText) {
    loadingText.textContent = message;
  }
  
  document.getElementById('loadingContainer').classList.remove('hidden');
}

/**
 * Yükleme göstergesini gizler
 */
export function hideLoading() {
  const loadingContainer = document.getElementById('loadingContainer');
  if (loadingContainer) {
    loadingContainer.classList.add('hidden');
  }
}

/**
 * Form doğrulama hatalarını gösterir
 * @param {HTMLFormElement} form - Form elementi
 * @param {Object} errors - Hata nesnesi (alan adı: hata mesajı)
 */
export function showFormErrors(form, errors) {
  // Önceki hataları temizle
  const previousErrors = form.querySelectorAll('.form-error');
  previousErrors.forEach(error => error.remove());
  
  // Hata sınıflarını temizle
  form.querySelectorAll('.has-error').forEach(field => {
    field.classList.remove('has-error');
  });
  
  // Yeni hataları göster
  Object.keys(errors).forEach(fieldName => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (field) {
      // Alan için hata sınıfı ekle
      field.classList.add('has-error');
      
      // Hata mesajı oluştur
      const errorElement = document.createElement('div');
      errorElement.className = 'form-error';
      errorElement.textContent = errors[fieldName];
      
      // Hata mesajını alandan sonra ekle
      field.parentNode.insertBefore(errorElement, field.nextSibling);
    }
  });
  
  // İlk hatalı alana odaklan
  const firstErrorField = form.querySelector('.has-error');
  if (firstErrorField) {
    firstErrorField.focus();
  }
}

/**
 * Onay iletişim kutusu gösterir
 * @param {string} message - Onay mesajı
 * @param {string} confirmText - Onay düğmesi metni
 * @param {string} cancelText - İptal düğmesi metni
 * @returns {Promise<boolean>} - Kullanıcı onayı
 */
export function showConfirm(message, confirmText = 'Evet', cancelText = 'İptal') {
  return new Promise(resolve => {
    // Mevcut onay iletişim kutusunu kaldır
    const existingModal = document.getElementById('confirmModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Yeni onay iletişim kutusu oluştur
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal';
    
    // Modal içeriği
    modal.innerHTML = `
      <div class="modal-content confirm-modal">
        <div class="confirm-message">${message}</div>
        <div class="confirm-actions">
          <button id="confirmCancel" class="btn secondary">${cancelText}</button>
          <button id="confirmOk" class="btn primary">${confirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Düğme olayları
    document.getElementById('confirmOk').addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });
    
    document.getElementById('confirmCancel').addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });
    
    // ESC tuşu ile iptal
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        modal.remove();
        resolve(false);
      }
    });
    
    // Modal dışına tıklama ile iptal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    });
  });
}

// Global olarak erişilebilir yap
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showConfirm = showConfirm;
