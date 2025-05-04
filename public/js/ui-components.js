/**
 * UI Bileşenleri
 * Kullanıcı arayüzü bileşenleri için yardımcı fonksiyonlar
 */

/**
 * Toast bildirimi gösterir
 * @param {string} message Bildirim mesajı
 * @param {string} type Bildirim türü ('success', 'error', 'warning', 'info')
 * @param {number} duration Bildirim süresi (ms)
 */
function showToast(message, type = 'info', duration = 3000) {
  // Toast container'ı kontrol et, yoksa oluştur
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Toast elementini oluştur
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background-color: ${getToastColor(type)};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    margin-bottom: 10px;
    min-width: 250px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    animation: fadeIn 0.3s ease;
    transition: all 0.3s ease;
  `;
  
  // Toast içeriğini oluştur
  const content = document.createElement('div');
  content.textContent = message;
  
  // Kapatma düğmesi
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    margin-left: 10px;
  `;
  closeButton.onclick = () => {
    removeToast(toast);
  };
  
  // Toast elementini birleştir
  toast.appendChild(content);
  toast.appendChild(closeButton);
  
  // Toast'u container'a ekle
  toastContainer.appendChild(toast);
  
  // Otomatik kapatma
  setTimeout(() => {
    removeToast(toast);
  }, duration);
  
  return toast;
}

/**
 * Toast rengini döndürür
 * @param {string} type Bildirim türü
 * @returns {string} Renk kodu
 */
function getToastColor(type) {
  switch (type) {
    case 'success':
      return '#28a745';
    case 'error':
      return '#dc3545';
    case 'warning':
      return '#ffc107';
    case 'info':
    default:
      return '#17a2b8';
  }
}

/**
 * Toast bildirimini kaldırır
 * @param {HTMLElement} toast Toast elementi
 */
function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(20px)';
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/**
 * Modal dialog gösterir
 * @param {Object} options Modal seçenekleri
 * @param {string} options.title Modal başlığı
 * @param {string} options.content Modal içeriği (HTML olabilir)
 * @param {Array} options.buttons Modal düğmeleri
 * @param {boolean} options.closeOnBackdrop Arka plana tıklandığında kapansın mı?
 * @param {string} options.size Modal boyutu ('small', 'medium', 'large')
 * @returns {Promise} Modal sonucu
 */
function showModal(options) {
  return new Promise((resolve) => {
    const defaults = {
      title: 'Bilgi',
      content: '',
      buttons: [
        { text: 'Tamam', value: 'ok', type: 'primary' }
      ],
      closeOnBackdrop: true,
      size: 'medium'
    };
    
    const settings = { ...defaults, ...options };
    
    // Modal container'ı kontrol et, yoksa oluştur
    let modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'modal-container';
      document.body.appendChild(modalContainer);
    }
    
    // Modal elementini oluştur
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    // Modal içeriğini oluştur
    const modalContent = document.createElement('div');
    modalContent.className = `modal-content modal-${settings.size}`;
    modalContent.style.cssText = `
      background-color: white;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      max-width: ${getModalWidth(settings.size)};
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      transform: translateY(-20px);
      transition: transform 0.3s ease;
    `;
    
    // Modal başlığını oluştur
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.style.cssText = `
      padding: 15px;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const modalTitle = document.createElement('h5');
    modalTitle.textContent = settings.title;
    modalTitle.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    `;
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;
    closeButton.onclick = () => {
      closeModal(modal);
      resolve(null);
    };
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal gövdesini oluştur
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.cssText = `
      padding: 15px;
    `;
    
    if (typeof settings.content === 'string') {
      modalBody.innerHTML = settings.content;
    } else if (settings.content instanceof HTMLElement) {
      modalBody.appendChild(settings.content);
    }
    
    // Modal alt kısmını oluştur
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    modalFooter.style.cssText = `
      padding: 15px;
      border-top: 1px solid #e9ecef;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    `;
    
    // Düğmeleri oluştur
    settings.buttons.forEach(button => {
      const btn = document.createElement('button');
      btn.textContent = button.text;
      btn.className = `btn btn-${button.type || 'secondary'}`;
      btn.style.cssText = `
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        border: none;
        background-color: ${getButtonColor(button.type || 'secondary')};
        color: white;
      `;
      btn.onclick = () => {
        closeModal(modal);
        resolve(button.value);
      };
      modalFooter.appendChild(btn);
    });
    
    // Modal elementlerini birleştir
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modal.appendChild(modalContent);
    
    // Arka plana tıklandığında kapat
    if (settings.closeOnBackdrop) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal(modal);
          resolve(null);
        }
      });
    }
    
    // Modal'ı container'a ekle
    modalContainer.appendChild(modal);
    
    // Modal'ı göster
    setTimeout(() => {
      modal.style.opacity = '1';
      modalContent.style.transform = 'translateY(0)';
    }, 10);
    
    // ESC tuşuna basıldığında kapat
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal(modal);
        resolve(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Modal kapatma fonksiyonu
    function closeModal(modal) {
      modal.style.opacity = '0';
      const modalContent = modal.querySelector('.modal-content');
      modalContent.style.transform = 'translateY(-20px)';
      
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
        document.removeEventListener('keydown', handleKeyDown);
      }, 300);
    }
  });
}

/**
 * Modal genişliğini döndürür
 * @param {string} size Modal boyutu
 * @returns {string} Genişlik değeri
 */
function getModalWidth(size) {
  switch (size) {
    case 'small':
      return '300px';
    case 'large':
      return '800px';
    case 'medium':
    default:
      return '500px';
  }
}

/**
 * Düğme rengini döndürür
 * @param {string} type Düğme türü
 * @returns {string} Renk kodu
 */
function getButtonColor(type) {
  switch (type) {
    case 'primary':
      return '#007bff';
    case 'success':
      return '#28a745';
    case 'danger':
      return '#dc3545';
    case 'warning':
      return '#ffc107';
    case 'info':
      return '#17a2b8';
    case 'secondary':
    default:
      return '#6c757d';
  }
}

/**
 * Onay dialog'u gösterir
 * @param {string} message Onay mesajı
 * @param {string} title Dialog başlığı
 * @returns {Promise<boolean>} Onay sonucu
 */
function showConfirm(message, title = 'Onay') {
  return showModal({
    title,
    content: message,
    buttons: [
      { text: 'İptal', value: false, type: 'secondary' },
      { text: 'Tamam', value: true, type: 'primary' }
    ]
  });
}

/**
 * Uyarı dialog'u gösterir
 * @param {string} message Uyarı mesajı
 * @param {string} title Dialog başlığı
 * @returns {Promise<void>} Dialog sonucu
 */
function showAlert(message, title = 'Uyarı') {
  return showModal({
    title,
    content: message,
    buttons: [
      { text: 'Tamam', value: true, type: 'primary' }
    ]
  });
}

/**
 * Giriş dialog'u gösterir
 * @param {string} message Giriş mesajı
 * @param {string} defaultValue Varsayılan değer
 * @param {string} title Dialog başlığı
 * @returns {Promise<string|null>} Giriş değeri
 */
function showPrompt(message, defaultValue = '', title = 'Giriş') {
  const content = document.createElement('div');
  
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultValue;
  input.style.cssText = `
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    margin-top: 10px;
  `;
  
  content.appendChild(messageElement);
  content.appendChild(input);
  
  return showModal({
    title,
    content,
    buttons: [
      { text: 'İptal', value: null, type: 'secondary' },
      { text: 'Tamam', value: 'ok', type: 'primary' }
    ]
  }).then(result => {
    return result === 'ok' ? input.value : null;
  });
}

/**
 * Yükleniyor göstergesi gösterir
 * @param {string} message Yükleniyor mesajı
 * @returns {Object} Yükleniyor göstergesi kontrolü
 */
function showLoading(message = 'Yükleniyor...') {
  // Yükleniyor container'ı kontrol et, yoksa oluştur
  let loadingContainer = document.getElementById('loading-container');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loading-container';
    document.body.appendChild(loadingContainer);
  }
  
  // Yükleniyor elementini oluştur
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  
  // Spinner oluştur
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
  `;
  
  // Animasyon tanımla
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  // Mesaj oluştur
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  messageElement.style.cssText = `
    color: white;
    margin-top: 15px;
    font-size: 16px;
  `;
  
  // Yükleniyor elementini birleştir
  loading.appendChild(spinner);
  loading.appendChild(messageElement);
  
  // Yükleniyor elementini container'a ekle
  loadingContainer.appendChild(loading);
  
  // Yükleniyor göstergesini kapat
  const hide = () => {
    if (loading.parentNode) {
      loading.parentNode.removeChild(loading);
    }
  };
  
  // Mesajı güncelle
  const updateMessage = (newMessage) => {
    messageElement.textContent = newMessage;
  };
  
  return {
    hide,
    updateMessage
  };
}

// Dışa aktar
window.UI = {
  showToast,
  showModal,
  showConfirm,
  showAlert,
  showPrompt,
  showLoading
};
