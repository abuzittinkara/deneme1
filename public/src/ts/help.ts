/**
 * public/src/ts/help.ts
 * Yardım merkezi JavaScript dosyası
 * Yardım merkezi sayfasının etkileşimli özelliklerini yönetir
 */

// Arama sonucu arayüzü
interface SearchResult {
  id: string;
  title: string;
  type: 'section' | 'card' | 'content' | 'faq';
  score: number;
  element?: HTMLElement;
}

/**
 * Yardım merkezi özelliklerini başlatır
 */
export function initHelp(): void {
  document.addEventListener('DOMContentLoaded', () => {
    // Menü bağlantıları
    initMenuLinks();

    // SSS bölümü
    initFaqItems();

    // Arama işlevi
    initSearch();
  });
}

/**
 * Menü bağlantılarını başlatır
 */
function initMenuLinks(): void {
  const menuLinks = document.querySelectorAll('.help-menu a');

  menuLinks.forEach(link => {
    link.addEventListener('click', (e: Event) => {
      e.preventDefault();

      // Aktif bağlantıyı güncelle
      menuLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Hedef bölümü göster
      const targetId = (link as HTMLAnchorElement).getAttribute('href')?.substring(1);
      if (!targetId) {
        return;
      }

      const sections = document.querySelectorAll('.help-section');

      sections.forEach(section => {
        section.classList.remove('active');
      });

      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');

        // Sayfa başlığını güncelle
        const sectionTitle = targetSection.querySelector('h1')?.textContent;
        if (sectionTitle) {
          document.title = `${sectionTitle} - Fisqos Yardım Merkezi`;
        }

        // URL'yi güncelle
        history.pushState({}, '', `#${targetId}`);

        // Sayfayı yukarı kaydır
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // URL'deki hash'e göre bölüm göster
  const hash = window.location.hash;
  if (hash) {
    const targetLink = document.querySelector(`.help-menu a[href="${hash}"]`) as HTMLElement;
    if (targetLink) {
      targetLink.click();
    }
  }
}

/**
 * SSS öğelerini başlatır
 */
function initFaqItems(): void {
  const faqItems = document.querySelectorAll('.help-faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.help-faq-question');

    if (question) {
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
    }
  });
}

/**
 * Arama işlevini başlatır
 */
function initSearch(): void {
  const searchInput = document.getElementById('helpSearch') as HTMLInputElement;
  const searchButton = document.getElementById('helpSearchBtn');

  if (!searchInput || !searchButton) {
    return;
  }

  // Arama düğmesine tıklama
  searchButton.addEventListener('click', () => {
    performSearch(searchInput.value);
  });

  // Enter tuşuna basma
  searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
}

/**
 * Arama gerçekleştirir
 * @param query - Arama sorgusu
 */
function performSearch(query: string): void {
  if (!query.trim()) {
    return;
  }

  // Arama sorgusunu küçük harfe çevir
  query = query.trim().toLowerCase();

  // Tüm bölümleri ara
  const sections = document.querySelectorAll('.help-section');
  const results: SearchResult[] = [];

  sections.forEach(section => {
    const sectionId = section.id;
    const sectionTitle = section.querySelector('h1')?.textContent || '';

    // Bölüm başlığında ara
    if (sectionTitle.toLowerCase().includes(query)) {
      results.push({
        id: sectionId,
        title: sectionTitle,
        type: 'section',
        score: 10, // Bölüm başlığı eşleşmesi yüksek puan
      });
    }

    // Bölüm içeriğinde ara
    const cards = section.querySelectorAll('.help-card');
    cards.forEach(card => {
      const cardTitle = card.querySelector('h2')?.textContent || '';
      const cardContent = card.textContent || '';

      // Kart başlığında ara
      if (cardTitle.toLowerCase().includes(query)) {
        results.push({
          id: sectionId,
          title: cardTitle,
          type: 'card',
          score: 8, // Kart başlığı eşleşmesi orta-yüksek puan
        });
      }
      // Kart içeriğinde ara
      else if (cardContent.toLowerCase().includes(query)) {
        results.push({
          id: sectionId,
          title: cardTitle || sectionTitle,
          type: 'content',
          score: 5, // İçerik eşleşmesi orta puan
        });
      }
    });

    // SSS bölümünde özel arama
    if (sectionId === 'faq') {
      const faqItems = section.querySelectorAll('.help-faq-item');
      faqItems.forEach(item => {
        const question = item.querySelector('.help-faq-question h3')?.textContent || '';
        const answer = item.querySelector('.help-faq-answer p')?.textContent || '';

        // Soru veya cevapta ara
        if (question.toLowerCase().includes(query) || answer.toLowerCase().includes(query)) {
          results.push({
            id: sectionId,
            title: question,
            type: 'faq',
            score: question.toLowerCase().includes(query) ? 9 : 6, // Soru eşleşmesi yüksek, cevap eşleşmesi orta puan
            element: item as HTMLElement,
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
 * @param results - Arama sonuçları
 * @param query - Arama sorgusu
 */
function displaySearchResults(results: SearchResult[], query: string): void {
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

  if (firstResult) {
    // Bölümü göster
    const menuLink = document.querySelector(`.help-menu a[href="#${firstResult.id}"]`) as HTMLElement;
    if (menuLink) {
      menuLink.click();
    }

    // SSS öğesini aç
    if (firstResult.type === 'faq' && firstResult.element) {
      firstResult.element.classList.add('active');

      // Öğeye kaydır
      setTimeout(() => {
        if (firstResult.element) {
          firstResult.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Öğeyi vurgula
          firstResult.element.classList.add('highlight');
          setTimeout(() => {
            if (firstResult.element) {
              firstResult.element.classList.remove('highlight');
            }
          }, 2000);
        }
      }, 500);
    }
  }

  // Sonuç listesini oluştur
  const resultsContainer = document.createElement('div');
  resultsContainer.id = 'searchResults';
  resultsContainer.className = 'search-results';

  const resultsHeader = document.createElement('div');
  resultsHeader.className = 'search-results-header';
  resultsHeader.innerHTML = `
    <h3>Arama Sonuçları: "${query}"</h3>
    <span class="search-results-count">${results.length} sonuç bulundu</span>
    <button class="search-results-close">
      <span class="material-icons">close</span>
    </button>
  `;

  const resultsList = document.createElement('div');
  resultsList.className = 'search-results-list';

  // Sonuçları listele
  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';

    let typeIcon = '';
    switch (result.type) {
      case 'section':
        typeIcon = 'article';
        break;
      case 'card':
        typeIcon = 'topic';
        break;
      case 'content':
        typeIcon = 'text_snippet';
        break;
      case 'faq':
        typeIcon = 'help';
        break;
    }

    resultItem.innerHTML = `
      <div class="search-result-icon">
        <span class="material-icons">${typeIcon}</span>
      </div>
      <div class="search-result-content">
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-type">${getResultTypeText(result.type)}</div>
      </div>
    `;

    resultItem.addEventListener('click', () => {
      // Bölümü göster
      const menuLink = document.querySelector(`.help-menu a[href="#${result.id}"]`) as HTMLElement;
      if (menuLink) {
        menuLink.click();
      }

      // SSS öğesini aç
      if (result.type === 'faq' && result.element) {
        result.element.classList.add('active');

        // Öğeye kaydır
        setTimeout(() => {
          if (result.element) {
            result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Öğeyi vurgula
            result.element.classList.add('highlight');
            setTimeout(() => {
              if (result.element) {
                result.element.classList.remove('highlight');
              }
            }, 2000);
          }
        }, 500);
      }

      // Sonuç listesini kapat
      resultsContainer.remove();
    });

    resultsList.appendChild(resultItem);
  });

  // Sonuç listesini oluştur
  resultsContainer.appendChild(resultsHeader);
  resultsContainer.appendChild(resultsList);

  // Sayfaya ekle
  document.body.appendChild(resultsContainer);

  // Kapatma düğmesi olayı
  const closeBtn = resultsContainer.querySelector('.search-results-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      resultsContainer.remove();
    });
  }
}

/**
 * Sonuç türünün metin karşılığını döndürür
 * @param type - Sonuç türü
 * @returns Sonuç türü metni
 */
function getResultTypeText(type: string): string {
  switch (type) {
    case 'section':
      return 'Bölüm';
    case 'card':
      return 'Kart';
    case 'content':
      return 'İçerik';
    case 'faq':
      return 'Sık Sorulan Soru';
    default:
      return '';
  }
}
