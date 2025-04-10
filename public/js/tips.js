// public/js/tips.js

/**
 * İpuçları modülü
 * Uygulama içi ipuçları ve rehberlik sağlar
 */

// İpuçları listesi
const tips = [
  {
    id: 'welcome',
    title: 'Fisqos\'a Hoş Geldiniz!',
    content: 'Fisqos, arkadaşlarınızla iletişim kurmanızı sağlayan bir platformdur. Başlamak için sol menüdeki "+" düğmesine tıklayarak bir grup oluşturabilir veya mevcut bir gruba katılabilirsiniz.',
    icon: 'waving_hand',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'create-group',
    title: 'Grup Oluşturma',
    content: 'Yeni bir grup oluşturmak için sol menüdeki "+" düğmesine tıklayın ve "Grup Oluştur" seçeneğini seçin. Grubunuza bir isim verin ve oluşturun.',
    icon: 'group_add',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'create-channel',
    title: 'Kanal Oluşturma',
    content: 'Bir gruba katıldıktan sonra, grup adının yanındaki "+" düğmesine tıklayarak yeni bir kanal oluşturabilirsiniz. Metin veya ses kanalı seçeneğini belirleyin.',
    icon: 'add_comment',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'voice-channel',
    title: 'Sesli Kanala Katılma',
    content: 'Bir ses kanalına tıklayarak sesli sohbete katılabilirsiniz. Mikrofonunuzu açmak/kapatmak için mikrofon simgesine tıklayın.',
    icon: 'mic',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'file-upload',
    title: 'Dosya Paylaşımı',
    content: 'Dosya paylaşmak için mesaj kutusunun yanındaki ataç simgesine tıklayın veya dosyayı sürükleyip bırakın.',
    icon: 'attach_file',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'message-formatting',
    title: 'Mesaj Biçimlendirme',
    content: 'Mesajlarınızı biçimlendirmek için Markdown kullanabilirsiniz. **Kalın**, *italik*, ~~üstü çizili~~ ve `kod` gibi.',
    icon: 'format_bold',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'emoji-reactions',
    title: 'Emoji Tepkileri',
    content: 'Bir mesaja tepki vermek için mesajın üzerine gelin ve emoji simgesine tıklayın.',
    icon: 'emoji_emotions',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'message-search',
    title: 'Mesaj Arama',
    content: 'Mesajlarda arama yapmak için Ctrl+F tuşlarına basın veya kanal başlığındaki arama simgesine tıklayın.',
    icon: 'search',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Klavye Kısayolları',
    content: 'Fisqos\'ta birçok klavye kısayolu bulunmaktadır. Ctrl+K ile hızlı arama yapabilir, Alt+↑/↓ ile kanallar arasında geçiş yapabilirsiniz.',
    icon: 'keyboard',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'profile-settings',
    title: 'Profil Ayarları',
    content: 'Profil ayarlarınızı güncellemek için sağ alt köşedeki kullanıcı simgenize tıklayın ve "Profil Ayarları" seçeneğini seçin.',
    icon: 'settings',
    showOnce: true,
    pages: ['index']
  },
  {
    id: 'help-center',
    title: 'Yardım Merkezi',
    content: 'Daha fazla bilgi ve yardım için Yardım Merkezi\'ni ziyaret edebilirsiniz.',
    icon: 'help',
    showOnce: false,
    pages: ['index'],
    action: {
      text: 'Yardım Merkezi\'ni Aç',
      url: '/help.html'
    }
  }
];

// Görüntülenen ipuçlarını takip etmek için yerel depolama anahtarı
const TIPS_STORAGE_KEY = 'fisqos_tips_seen';

/**
 * İpuçları sistemini başlatır
 */
export function initTips() {
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
function showTipsForCurrentPage() {
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
    showTip(randomTip);

    // İpucunu görüldü olarak işaretle
    if (randomTip.showOnce) {
      markTipAsSeen(randomTip.id);
    }
  }
}

/**
 * Yeni kullanıcı kontrolü yapar
 */
function checkNewUser() {
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
function showWelcomeTour() {
  // Mevcut turu temizle
  const existingTour = document.getElementById('welcomeTour');
  if (existingTour) {
    existingTour.remove();
  }

  // Tur adımları
  const tourSteps = [
    {
      target: '#toggleDMButton',
      title: 'Menü Geçişi',
      content: 'Gruplar ve doğrudan mesajlar arasında geçiş yapmak için bu düğmeyi kullanabilirsiniz.',
      position: 'right'
    },
    {
      target: '#createGroupButton',
      title: 'Grup Oluşturma',
      content: 'Yeni bir grup oluşturmak için bu düğmeye tıklayın.',
      position: 'right'
    },
    {
      target: '#groupDropdownIcon',
      title: 'Grup Ayarları',
      content: 'Grup ayarlarına erişmek ve yeni kanallar oluşturmak için bu menüyü kullanabilirsiniz.',
      position: 'right'
    },
    {
      target: '#emptyStateContainer',
      title: 'Kanal Seçimi',
      content: 'Sol taraftan bir kanal seçerek sohbete başlayabilirsiniz. Kanal seçilmediğinde bu boş durum ekranı görüntülenir.',
      position: 'left'
    },
    {
      target: '#settingsButton',
      title: 'Kullanıcı Ayarları',
      content: 'Profil ve uygulama ayarlarına erişmek için bu düğmeye tıklayın.',
      position: 'top'
    },
    {
      target: '#micToggleButton',
      title: 'Mikrofon Kontrolü',
      content: 'Mikrofonunuzu açmak veya kapatmak için bu düğmeyi kullanabilirsiniz.',
      position: 'top'
    }
  ];

  // Tur konteynerini oluştur
  const tourContainer = document.createElement('div');
  tourContainer.id = 'welcomeTour';
  tourContainer.className = 'welcome-tour';

  // İlk adımı göster
  showTourStep(tourContainer, tourSteps, 0);

  document.body.appendChild(tourContainer);
}

/**
 * Tur adımını gösterir
 * @param {HTMLElement} container - Tur konteyneri
 * @param {Array} steps - Tur adımları
 * @param {number} index - Mevcut adım indeksi
 */
function showTourStep(container, steps, index) {
  if (index >= steps.length) {
    // Tur tamamlandı
    container.remove();
    return;
  }

  const step = steps[index];
  const target = document.querySelector(step.target);

  if (!target) {
    // Hedef bulunamadı, sonraki adıma geç
    showTourStep(container, steps, index + 1);
    return;
  }

  // Hedefin konumunu al
  const targetRect = target.getBoundingClientRect();
  const targetCenter = {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + targetRect.height / 2
  };

  // Adım içeriğini oluştur
  const stepContent = document.createElement('div');
  stepContent.className = `tour-step tour-step-${step.position}`;

  // Adım konumunu ayarla
  switch (step.position) {
    case 'top':
      stepContent.style.left = `${targetCenter.x}px`;
      stepContent.style.top = `${targetRect.top - 10}px`;
      stepContent.style.transform = 'translate(-50%, -100%)';
      break;
    case 'right':
      stepContent.style.left = `${targetRect.right + 10}px`;
      stepContent.style.top = `${targetCenter.y}px`;
      stepContent.style.transform = 'translateY(-50%)';
      break;
    case 'bottom':
      stepContent.style.left = `${targetCenter.x}px`;
      stepContent.style.top = `${targetRect.bottom + 10}px`;
      stepContent.style.transform = 'translate(-50%, 0)';
      break;
    case 'left':
      stepContent.style.left = `${targetRect.left - 10}px`;
      stepContent.style.top = `${targetCenter.y}px`;
      stepContent.style.transform = 'translate(-100%, -50%)';
      break;
  }

  // Adım HTML'i
  stepContent.innerHTML = `
    <div class="tour-step-content">
      <h3 class="tour-step-title">${step.title}</h3>
      <p>${step.content}</p>
      <div class="tour-step-actions">
        <button class="tour-step-skip">Turu Geç</button>
        <button class="tour-step-next">${index === steps.length - 1 ? 'Bitir' : 'Sonraki'}</button>
      </div>
    </div>
  `;

  // Hedefi vurgula
  target.classList.add('tour-target');

  // Konteynere ekle
  container.innerHTML = '';
  container.appendChild(stepContent);

  // Düğme olayları
  const skipButton = stepContent.querySelector('.tour-step-skip');
  const nextButton = stepContent.querySelector('.tour-step-next');

  skipButton.addEventListener('click', () => {
    // Vurgulamayı kaldır
    target.classList.remove('tour-target');

    // Turu kapat
    container.remove();
  });

  nextButton.addEventListener('click', () => {
    // Vurgulamayı kaldır
    target.classList.remove('tour-target');

    // Sonraki adıma geç
    showTourStep(container, steps, index + 1);
  });
}

/**
 * İpucu gösterir
 * @param {Object} tip - İpucu nesnesi
 */
function showTip(tip) {
  // Mevcut ipucunu temizle
  const existingTip = document.getElementById('tipContainer');
  if (existingTip) {
    existingTip.remove();
  }

  // İpucu konteyneri oluştur
  const tipContainer = document.createElement('div');
  tipContainer.id = 'tipContainer';
  tipContainer.className = 'tip-container';

  // İpucu içeriği
  tipContainer.innerHTML = `
    <div class="tip-content">
      <div class="tip-icon">
        <span class="material-icons">${tip.icon}</span>
      </div>
      <div class="tip-text">
        <h3 class="tip-title">${tip.title}</h3>
        <p class="tip-description">${tip.content}</p>
        ${tip.action ? `<button class="tip-action">${tip.action.text}</button>` : ''}
      </div>
      <button class="tip-close">
        <span class="material-icons">close</span>
      </button>
    </div>
  `;

  document.body.appendChild(tipContainer);

  // Kapatma düğmesi olayı
  const closeButton = tipContainer.querySelector('.tip-close');
  closeButton.addEventListener('click', () => {
    tipContainer.classList.add('closing');
    setTimeout(() => {
      tipContainer.remove();
    }, 300);
  });

  // Eylem düğmesi olayı
  if (tip.action) {
    const actionButton = tipContainer.querySelector('.tip-action');
    actionButton.addEventListener('click', () => {
      if (tip.action.url) {
        window.open(tip.action.url, '_blank');
      }

      tipContainer.classList.add('closing');
      setTimeout(() => {
        tipContainer.remove();
      }, 300);
    });
  }

  // Otomatik kapanma
  setTimeout(() => {
    if (tipContainer.parentNode) {
      tipContainer.classList.add('closing');
      setTimeout(() => {
        tipContainer.remove();
      }, 300);
    }
  }, 10000);

  // İpucu animasyonu
  setTimeout(() => {
    tipContainer.classList.add('show');
  }, 10);
}

/**
 * İpucu düğmesini ekler
 */
function addTipButton() {
  // Mevcut düğmeyi kontrol et
  if (document.getElementById('tipButton')) {
    return;
  }

  // Düğme oluştur
  const tipButton = document.createElement('button');
  tipButton.id = 'tipButton';
  tipButton.className = 'tip-button';
  tipButton.title = 'İpucu Göster';
  tipButton.innerHTML = '<span class="material-icons">lightbulb</span>';

  // Düğmeyi ekle
  document.body.appendChild(tipButton);

  // Düğme olayı
  tipButton.addEventListener('click', () => {
    showRandomTip();
  });
}

/**
 * Rastgele bir ipucu gösterir
 */
function showRandomTip() {
  const currentPage = getCurrentPage();

  // Mevcut sayfa için uygun ipuçlarını filtrele
  const eligibleTips = tips.filter(tip => tip.pages.includes(currentPage));

  if (eligibleTips.length > 0) {
    // Rastgele bir ipucu seç
    const randomTip = eligibleTips[Math.floor(Math.random() * eligibleTips.length)];
    showTip(randomTip);
  }
}

/**
 * Görülen ipuçlarını alır
 * @returns {Array} - Görülen ipuçları listesi
 */
function getSeenTips() {
  const seenTipsJson = localStorage.getItem(TIPS_STORAGE_KEY);
  return seenTipsJson ? JSON.parse(seenTipsJson) : [];
}

/**
 * İpucunu görüldü olarak işaretler
 * @param {string} tipId - İpucu ID'si
 */
function markTipAsSeen(tipId) {
  const seenTips = getSeenTips();

  if (!seenTips.includes(tipId)) {
    seenTips.push(tipId);
    localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(seenTips));
  }
}

/**
 * Mevcut sayfayı alır
 * @returns {string} - Sayfa adı
 */
function getCurrentPage() {
  const path = window.location.pathname;

  if (path.endsWith('index.html') || path === '/' || path === '') {
    return 'index';
  }

  if (path.endsWith('help.html')) {
    return 'help';
  }

  return path.split('/').pop().split('.')[0];
}
