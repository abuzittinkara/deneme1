/**
 * public/src/ts/tips.ts
 * İpuçları modülü
 * Kullanıcılara uygulama kullanımı hakkında ipuçları gösterir
 */

// İpucu arayüzü
interface Tip {
  id: string;
  title: string;
  content: string;
  pages: string[];
  showOnce: boolean;
  icon?: string;
}

// Tur adımı arayüzü
interface TourStep {
  element: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// Görüntülenen ipuçlarını takip etmek için yerel depolama anahtarı
const TIPS_STORAGE_KEY = 'fisqos_tips_seen';

// İpuçları listesi
const tips: Tip[] = [
  {
    id: 'groups_tip',
    title: 'Gruplar',
    content:
      'Gruplar, farklı konular veya projeler için ayrı alanlar oluşturmanıza olanak tanır. Her grupta metin ve ses kanalları oluşturabilirsiniz.',
    pages: ['main'],
    showOnce: true,
    icon: 'groups',
  },
  {
    id: 'channels_tip',
    title: 'Kanallar',
    content:
      'Kanallar, grup içinde farklı konular için ayrı sohbet alanlarıdır. Metin kanallarında mesajlaşabilir, ses kanallarında konuşabilirsiniz.',
    pages: ['main'],
    showOnce: true,
    icon: 'tag',
  },
  {
    id: 'dm_tip',
    title: 'Direkt Mesajlar',
    content:
      'Direkt mesajlar, diğer kullanıcılarla özel olarak iletişim kurmanızı sağlar. Arkadaşlarınızla bire bir sohbet edebilirsiniz.',
    pages: ['main'],
    showOnce: true,
    icon: 'chat',
  },
  {
    id: 'voice_tip',
    title: 'Ses Kanalları',
    content:
      'Ses kanallarına katılarak diğer kullanıcılarla sesli sohbet edebilirsiniz. Mikrofonunuzu açıp kapatabilirsiniz.',
    pages: ['main'],
    showOnce: true,
    icon: 'mic',
  },
  {
    id: 'file_upload_tip',
    title: 'Dosya Yükleme',
    content:
      'Mesaj yazarken dosya ekleyebilirsiniz. Resimler, belgeler ve diğer dosya türlerini paylaşabilirsiniz.',
    pages: ['main'],
    showOnce: true,
    icon: 'attach_file',
  },
  {
    id: 'search_tip',
    title: 'Mesaj Arama',
    content: 'Kanal başlığındaki arama düğmesini kullanarak mesajlarda arama yapabilirsiniz.',
    pages: ['main'],
    showOnce: true,
    icon: 'search',
  },
  {
    id: 'emoji_tip',
    title: 'Emoji Kullanımı',
    content: 'Mesajlara emoji ekleyebilir veya mesajlara tepki olarak emoji kullanabilirsiniz.',
    pages: ['main'],
    showOnce: false,
    icon: 'emoji_emotions',
  },
  {
    id: 'mentions_tip',
    title: 'Bahsetmeler',
    content:
      'Bir kullanıcıdan bahsetmek için @ işaretini kullanabilirsiniz. Bahsedilen kullanıcı bildirim alacaktır.',
    pages: ['main'],
    showOnce: false,
    icon: 'alternate_email',
  },
  {
    id: 'shortcuts_tip',
    title: 'Klavye Kısayolları',
    content:
      'Ctrl+K ile kanal arama, Ctrl+F ile mesaj arama, Esc ile açık pencereleri kapatma gibi kısayolları kullanabilirsiniz.',
    pages: ['main'],
    showOnce: false,
    icon: 'keyboard',
  },
];

// Karşılama turu adımları
const welcomeTourSteps: TourStep[] = [
  {
    element: '.sidebar',
    title: 'Kenar Çubuğu',
    content: 'Buradan gruplarınızı, kanallarınızı ve direkt mesajlarınızı görebilirsiniz.',
    position: 'right',
  },
  {
    element: '#groupList',
    title: 'Gruplar',
    content:
      'Gruplarınız burada listelenir. Yeni grup oluşturmak için + düğmesine tıklayabilirsiniz.',
    position: 'right',
  },
  {
    element: '#roomList',
    title: 'Kanallar',
    content:
      'Seçili gruptaki kanallar burada görüntülenir. Metin ve ses kanalları oluşturabilirsiniz.',
    position: 'right',
  },
  {
    element: '#dmList',
    title: 'Direkt Mesajlar',
    content: 'Diğer kullanıcılarla özel mesajlaşmalarınız burada listelenir.',
    position: 'right',
  },
  {
    element: '.user-panel',
    title: 'Kullanıcı Paneli',
    content: 'Buradan mikrofonunuzu açıp kapatabilir ve kullanıcı ayarlarınıza erişebilirsiniz.',
    position: 'top',
  },
];

/**
 * İpuçları sistemini başlatır
 */
export function initTips(): void {
  // Kullanıcı giriş yaptığında ipuçlarını göster
  document.addEventListener('loginSuccess', () => {
    // Sayfa yüklendiğinde ipuçlarını göster
    setTimeout(() => {
      showTipsForCurrentPage();

      // Yeni kullanıcı kontrolü
      checkNewUser();
    }, 2000); // Kullanıcının arayüzü görmesi için kısa bir gecikme
  });

  // İpucu düğmesini ekle
  addTipButton();
}

/**
 * Mevcut sayfa için ipuçlarını gösterir
 */
function showTipsForCurrentPage(): void {
  const currentPage = getCurrentPage();
  const seenTips = getSeenTips();

  // Mevcut sayfa için uygun ipuçlarını filtrele
  const eligibleTips = tips.filter(tip => {
    // Sayfa kontrolü
    if (!tip.pages.includes(currentPage)) {
      return false;
    }

    // Bir kez gösterilecek ipuçları için kontrol
    if (tip.showOnce && seenTips.includes(tip.id)) {
      return false;
    }

    return true;
  });

  // Rastgele bir ipucu seç
  if (eligibleTips.length > 0) {
    const randomTip = eligibleTips[Math.floor(Math.random() * eligibleTips.length)];
    if (randomTip) {
      showTip(randomTip);

      // İpucunu görüldü olarak işaretle
      if (randomTip.showOnce) {
        markTipAsSeen(randomTip.id);
      }
    }
  }
}

/**
 * Yeni kullanıcı kontrolü yapar
 */
function checkNewUser(): void {
  const isNewUser = !localStorage.getItem('fisqos_user_seen');

  if (isNewUser) {
    // Yeni kullanıcı için karşılama turu göster
    showWelcomeTour();

    // Kullanıcıyı görüldü olarak işaretle
    localStorage.setItem('fisqos_user_seen', 'true');
  }
}

/**
 * Karşılama turunu gösterir
 */
function showWelcomeTour(): void {
  // Mevcut turu temizle
  const existingTour = document.getElementById('welcomeTour');
  if (existingTour) {
    existingTour.remove();
  }

  // Tur konteyneri oluştur
  const tourContainer = document.createElement('div');
  tourContainer.id = 'welcomeTour';
  tourContainer.className = 'welcome-tour';
  document.body.appendChild(tourContainer);

  // Tur başlığı
  const tourTitle = document.createElement('div');
  tourTitle.className = 'welcome-tour-title';
  tourTitle.innerHTML = `
    <h2>Fisqos'a Hoş Geldiniz!</h2>
    <p>Size uygulamayı tanıtmak için kısa bir tur hazırladık.</p>
  `;
  tourContainer.appendChild(tourTitle);

  // Tur düğmeleri
  const tourButtons = document.createElement('div');
  tourButtons.className = 'welcome-tour-buttons';
  tourButtons.innerHTML = `
    <button id="startTourBtn" class="btn primary">Tura Başla</button>
    <button id="skipTourBtn" class="btn secondary">Şimdi Değil</button>
  `;
  tourContainer.appendChild(tourButtons);

  // Tur başlatma düğmesi
  const startTourBtn = document.getElementById('startTourBtn');
  if (startTourBtn) {
    startTourBtn.addEventListener('click', () => {
      startWelcomeTour();
      tourContainer.remove();
    });
  }

  // Turu atlama düğmesi
  const skipTourBtn = document.getElementById('skipTourBtn');
  if (skipTourBtn) {
    skipTourBtn.addEventListener('click', () => {
      tourContainer.remove();
    });
  }
}

/**
 * Karşılama turunu başlatır
 */
function startWelcomeTour(): void {
  const currentStep = 0;

  // İlk adımı göster
  showTourStep(currentStep);

  // Tur adımını gösterir
  function showTourStep(stepIndex: number): void {
    if (stepIndex >= welcomeTourSteps.length) {
      // Tur tamamlandı
      return;
    }

    const step = welcomeTourSteps[stepIndex];
    if (!step) return;
    const targetElement = document.querySelector(step.element) as HTMLElement;

    if (!targetElement) {
      // Hedef element bulunamadı, sonraki adıma geç
      showTourStep(stepIndex + 1);
      return;
    }

    // Mevcut adım göstergesini temizle
    const existingStep = document.getElementById('tourStep');
    if (existingStep) {
      existingStep.remove();
    }

    // Adım göstergesi oluştur
    const stepElement = document.createElement('div');
    stepElement.id = 'tourStep';
    stepElement.className = 'tour-step';
    stepElement.innerHTML = `
      <div class="tour-step-content">
        <h3>${step?.title || ''}</h3>
        <p>${step?.content || ''}</p>
        <div class="tour-step-buttons">
          ${stepIndex > 0 ? '<button id="prevStepBtn" class="btn secondary">Önceki</button>' : ''}
          ${
            stepIndex < welcomeTourSteps.length - 1
              ? '<button id="nextStepBtn" class="btn primary">Sonraki</button>'
              : '<button id="finishTourBtn" class="btn primary">Turu Tamamla</button>'
          }
        </div>
      </div>
    `;

    // Adım göstergesini konumlandır
    positionTourStep(stepElement, targetElement, step?.position || 'bottom');

    // Adım göstergesini body'e ekle
    document.body.appendChild(stepElement);

    // Hedef elementi vurgula
    targetElement.classList.add('tour-highlight');

    // Önceki düğmesi
    const prevStepBtn = document.getElementById('prevStepBtn');
    if (prevStepBtn) {
      prevStepBtn.addEventListener('click', () => {
        targetElement.classList.remove('tour-highlight');
        showTourStep(stepIndex - 1);
      });
    }

    // Sonraki düğmesi
    const nextStepBtn = document.getElementById('nextStepBtn');
    if (nextStepBtn) {
      nextStepBtn.addEventListener('click', () => {
        targetElement.classList.remove('tour-highlight');
        showTourStep(stepIndex + 1);
      });
    }

    // Tamamla düğmesi
    const finishTourBtn = document.getElementById('finishTourBtn');
    if (finishTourBtn) {
      finishTourBtn.addEventListener('click', () => {
        targetElement.classList.remove('tour-highlight');
        stepElement.remove();
        showTourCompleteMessage();
      });
    }
  }

  // Adım göstergesini konumlandırır
  function positionTourStep(
    stepElement: HTMLElement,
    targetElement: HTMLElement,
    position: string
  ): void {
    const targetRect = targetElement.getBoundingClientRect();
    const stepWidth = 300; // Adım genişliği
    const stepHeight = 150; // Adım yüksekliği
    const margin = 10; // Kenar boşluğu

    let left = 0;
    let top = 0;

    switch (position) {
      case 'top':
        left = targetRect.left + targetRect.width / 2 - stepWidth / 2;
        top = targetRect.top - stepHeight - margin;
        break;
      case 'bottom':
        left = targetRect.left + targetRect.width / 2 - stepWidth / 2;
        top = targetRect.bottom + margin;
        break;
      case 'left':
        left = targetRect.left - stepWidth - margin;
        top = targetRect.top + targetRect.height / 2 - stepHeight / 2;
        break;
      case 'right':
        left = targetRect.right + margin;
        top = targetRect.top + targetRect.height / 2 - stepHeight / 2;
        break;
    }

    // Ekran sınırlarını kontrol et
    if (left < 0) {
      left = margin;
    }
    if (top < 0) {
      top = margin;
    }
    if (left + stepWidth > window.innerWidth) {
      left = window.innerWidth - stepWidth - margin;
    }
    if (top + stepHeight > window.innerHeight) {
      top = window.innerHeight - stepHeight - margin;
    }

    // Konumu ayarla
    stepElement.style.left = left + 'px';
    stepElement.style.top = top + 'px';
  }

  // Tur tamamlandı mesajını gösterir
  function showTourCompleteMessage(): void {
    const messageElement = document.createElement('div');
    messageElement.className = 'tour-complete-message';
    messageElement.innerHTML = `
      <div class="tour-complete-content">
        <h3>Tur Tamamlandı!</h3>
        <p>Artık Fisqos'u kullanmaya başlayabilirsiniz. Daha fazla ipucu için sağ alt köşedeki ipucu düğmesine tıklayabilirsiniz.</p>
        <button id="closeTourBtn" class="btn primary">Tamam</button>
      </div>
    `;

    // Mesajı body'e ekle
    document.body.appendChild(messageElement);

    // Kapat düğmesi
    const closeTourBtn = document.getElementById('closeTourBtn');
    if (closeTourBtn) {
      closeTourBtn.addEventListener('click', () => {
        messageElement.remove();
      });
    }
  }
}

/**
 * İpucu düğmesini ekler
 */
function addTipButton(): void {
  // Mevcut düğmeyi kontrol et
  let tipButton = document.getElementById('tipButton');

  if (!tipButton) {
    // Düğme oluştur
    tipButton = document.createElement('button');
    tipButton.id = 'tipButton';
    tipButton.className = 'tip-button';
    tipButton.innerHTML = '<span class="material-icons">lightbulb</span>';
    tipButton.title = 'İpucu Göster';

    // Düğmeyi body'e ekle
    document.body.appendChild(tipButton);

    // Düğme tıklama olayı
    tipButton.addEventListener('click', () => {
      showRandomTip();
    });
  }
}

/**
 * Bir ipucu gösterir
 * @param tip - Gösterilecek ipucu
 */
function showTip(tip: Tip): void {
  // Mevcut ipucunu temizle
  const existingTip = document.getElementById('tipPopup');
  if (existingTip) {
    existingTip.remove();
  }

  // İpucu popup'ı oluştur
  const tipPopup = document.createElement('div');
  tipPopup.id = 'tipPopup';
  tipPopup.className = 'tip-popup';
  tipPopup.innerHTML = `
    <div class="tip-header">
      <span class="material-icons">${tip.icon || 'lightbulb'}</span>
      <h3>${tip.title}</h3>
      <button class="tip-close">&times;</button>
    </div>
    <div class="tip-content">
      <p>${tip.content}</p>
    </div>
  `;

  // İpucunu body'e ekle
  document.body.appendChild(tipPopup);

  // Kapatma düğmesi
  const closeButton = tipPopup.querySelector('.tip-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      tipPopup.remove();
    });
  }

  // Belirli bir süre sonra ipucunu kaldır
  setTimeout(() => {
    if (tipPopup.parentNode) {
      tipPopup.classList.add('tip-hide');

      // Animasyon tamamlandıktan sonra elementi kaldır
      tipPopup.addEventListener('animationend', () => {
        if (tipPopup.parentNode) {
          tipPopup.remove();
        }
      });
    }
  }, 10000);
}

/**
 * Rastgele bir ipucu gösterir
 */
function showRandomTip(): void {
  const currentPage = getCurrentPage();

  // Mevcut sayfa için uygun ipuçlarını filtrele
  const eligibleTips = tips.filter(tip => tip.pages.includes(currentPage));

  if (eligibleTips.length > 0) {
    // Rastgele bir ipucu seç
    const randomTip = eligibleTips[Math.floor(Math.random() * eligibleTips.length)];
    if (randomTip) {
      showTip(randomTip);
    }
  }
}

/**
 * Görülen ipuçlarını alır
 * @returns Görülen ipuçları listesi
 */
function getSeenTips(): string[] {
  const seenTipsJson = localStorage.getItem(TIPS_STORAGE_KEY);
  return seenTipsJson ? JSON.parse(seenTipsJson) : [];
}

/**
 * Bir ipucunu görüldü olarak işaretler
 * @param tipId - İpucu ID'si
 */
function markTipAsSeen(tipId: string): void {
  const seenTips = getSeenTips();

  if (!seenTips.includes(tipId)) {
    seenTips.push(tipId);
    localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(seenTips));
  }
}

/**
 * Mevcut sayfayı belirler
 * @returns Sayfa adı
 */
function getCurrentPage(): string {
  // URL'ye göre sayfa adını belirle
  const path = window.location.pathname;

  if (path.includes('/help')) {
    return 'help';
  } else if (path.includes('/settings')) {
    return 'settings';
  } else if (path.includes('/profile')) {
    return 'profile';
  } else {
    return 'main';
  }
}
