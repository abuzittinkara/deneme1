// public/js/help.js

/**
 * Yardım merkezi JavaScript dosyası
 * Yardım merkezi sayfasının etkileşimli özelliklerini yönetir
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Yardım merkezi sayfası yüklendi');

  // Menü bağlantıları
  initMenuLinks();

  // SSS bölümü
  initFaqItems();

  // Arama işlevi
  initSearch();

  // Tema kontrolü
  checkDarkTheme();
});

/**
 * Menü bağlantılarını başlatır
 */
function initMenuLinks() {
  const menuLinks = document.querySelectorAll('.help-menu a');

  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // Aktif bağlantıyı güncelle
      menuLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Hedef bölümü göster
      const targetId = link.getAttribute('href').substring(1);
      const sections = document.querySelectorAll('.help-section');

      sections.forEach(section => {
        section.classList.remove('active');
      });

      document.getElementById(targetId).classList.add('active');

      // Sayfa başlığını güncelle
      const sectionTitle = document.getElementById(targetId).querySelector('h1').textContent;
      document.title = `${sectionTitle} - Fisqos Yardım Merkezi`;

      // URL'yi güncelle
      history.pushState(null, null, `#${targetId}`);

      // Sayfayı yukarı kaydır
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // URL'deki hash'e göre bölüm göster
  const hash = window.location.hash;
  if (hash) {
    const targetLink = document.querySelector(`.help-menu a[href="${hash}"]`);
    if (targetLink) {
      targetLink.click();
    }
  }
}

/**
 * SSS öğelerini başlatır
 */
function initFaqItems() {
  const faqItems = document.querySelectorAll('.help-faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.help-faq-question');

    question.addEventListener('click', () => {
      // Diğer öğeleri kapat
      faqItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
        }
      });

      // Bu öğeyi aç/kapat
      item.classList.toggle('active');
    });
  });
}

/**
 * Arama işlevini başlatır
 */
function initSearch() {
  const searchInput = document.getElementById('helpSearch');
  const searchButton = document.getElementById('helpSearchBtn');

  if (!searchInput || !searchButton) return;

  // Arama düğmesine tıklama
  searchButton.addEventListener('click', () => {
    performSearch(searchInput.value);
  });

  // Enter tuşuna basma
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
}

/**
 * Arama gerçekleştirir
 * @param {string} query - Arama sorgusu
 */
function performSearch(query) {
  if (!query.trim()) return;

  // Arama sorgusunu küçük harfe çevir
  query = query.trim().toLowerCase();

  // Tüm bölümleri ara
  const sections = document.querySelectorAll('.help-section');
  let results = [];

  sections.forEach(section => {
    const sectionId = section.id;
    const sectionTitle = section.querySelector('h1').textContent;

    // Bölüm başlığında ara
    if (sectionTitle.toLowerCase().includes(query)) {
      results.push({
        id: sectionId,
        title: sectionTitle,
        type: 'section',
        score: 10 // Bölüm başlığı eşleşmesi yüksek puan
      });
    }

    // Bölüm içeriğinde ara
    const cards = section.querySelectorAll('.help-card');
    cards.forEach(card => {
      const cardTitle = card.querySelector('h2')?.textContent || '';
      const cardContent = card.textContent;

      // Kart başlığında ara
      if (cardTitle.toLowerCase().includes(query)) {
        results.push({
          id: sectionId,
          title: cardTitle,
          type: 'card',
          score: 8 // Kart başlığı eşleşmesi orta-yüksek puan
        });
      }
      // Kart içeriğinde ara
      else if (cardContent.toLowerCase().includes(query)) {
        results.push({
          id: sectionId,
          title: cardTitle || sectionTitle,
          type: 'content',
          score: 5 // İçerik eşleşmesi orta puan
        });
      }
    });

    // SSS bölümünde özel arama
    if (sectionId === 'faq') {
      const faqItems = section.querySelectorAll('.help-faq-item');
      faqItems.forEach(item => {
        const question = item.querySelector('.help-faq-question h3').textContent;
        const answer = item.querySelector('.help-faq-answer p').textContent;

        // Soru veya cevapta ara
        if (question.toLowerCase().includes(query) || answer.toLowerCase().includes(query)) {
          results.push({
            id: sectionId,
            title: question,
            type: 'faq',
            score: question.toLowerCase().includes(query) ? 9 : 6, // Soru eşleşmesi yüksek, cevap eşleşmesi orta puan
            element: item
          });
        }
      });
    }
  });

  // Sonuçları puana göre sırala
  results.sort((a, b) => b.score - a.score);

  // Sonuçları göster
  displaySearchResults(results, query);
}

/**
 * Arama sonuçlarını gösterir
 * @param {Array} results - Arama sonuçları
 * @param {string} query - Arama sorgusu
 */
function displaySearchResults(results, query) {
  // Mevcut sonuçları temizle
  const existingResults = document.getElementById('searchResults');
  if (existingResults) {
    existingResults.remove();
  }

  // Sonuç yoksa bilgi ver
  if (results.length === 0) {
    alert(`"${query}" için sonuç bulunamadı.`);
    return;
  }

  // İlk sonuca git
  const firstResult = results[0];

  // Bölümü göster
  const menuLink = document.querySelector(`.help-menu a[href="#${firstResult.id}"]`);
  if (menuLink) {
    menuLink.click();
  }

  // SSS öğesini aç
  if (firstResult.type === 'faq' && firstResult.element) {
    firstResult.element.classList.add('active');

    // Öğeye kaydır
    setTimeout(() => {
      firstResult.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Öğeyi vurgula
      firstResult.element.classList.add('highlight');
      setTimeout(() => {
        firstResult.element.classList.remove('highlight');
      }, 2000);
    }, 500);
  }

  // Birden fazla sonuç varsa sonuç listesi göster
  if (results.length > 1) {
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'searchResults';
    resultsContainer.className = 'search-results';

    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'search-results-header';
    resultsHeader.innerHTML = `
      <h3>"${query}" için ${results.length} sonuç bulundu</h3>
      <button class="search-results-close">
        <span class="material-icons">close</span>
      </button>
    `;

    const resultsList = document.createElement('div');
    resultsList.className = 'search-results-list';

    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.className = 'search-result-item';
      resultItem.innerHTML = `
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-type">${getResultTypeText(result.type)}</div>
      `;

      resultItem.addEventListener('click', () => {
        // Bölümü göster
        const menuLink = document.querySelector(`.help-menu a[href="#${result.id}"]`);
        if (menuLink) {
          menuLink.click();
        }

        // SSS öğesini aç
        if (result.type === 'faq' && result.element) {
          result.element.classList.add('active');

          // Öğeye kaydır
          setTimeout(() => {
            result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Öğeyi vurgula
            result.element.classList.add('highlight');
            setTimeout(() => {
              result.element.classList.remove('highlight');
            }, 2000);
          }, 500);
        }

        // Sonuç listesini kapat
        resultsContainer.remove();
      });

      resultsList.appendChild(resultItem);
    });

    resultsContainer.appendChild(resultsHeader);
    resultsContainer.appendChild(resultsList);

    document.body.appendChild(resultsContainer);

    // Kapatma düğmesi olayı
    const closeButton = resultsContainer.querySelector('.search-results-close');
    closeButton.addEventListener('click', () => {
      resultsContainer.remove();
    });
  }
}

/**
 * Koyu tema kontrolü
 */
function checkDarkTheme() {
  // Sayfanın koyu tema kullanıp kullanmadığını kontrol et
  const isDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Koyu tema için ek sınıf ekle
  if (isDarkTheme) {
    document.body.classList.add('dark-theme');
  }

  // Tema değişikliklerini dinle
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (e.matches) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  });
}

/**
 * Sonuç türü metnini döndürür
 * @param {string} type - Sonuç türü
 * @returns {string} - Sonuç türü metni
 */
function getResultTypeText(type) {
  switch (type) {
    case 'section':
      return 'Bölüm';
    case 'card':
      return 'Konu';
    case 'content':
      return 'İçerik';
    case 'faq':
      return 'Sık Sorulan Soru';
    default:
      return '';
  }
}
