/**
 * Yardım Sayfası TypeScript
 */
document.addEventListener('DOMContentLoaded', function() {
  // Yardım menüsü bağlantıları
  const helpMenuLinks: NodeListOf<HTMLAnchorElement> = document.querySelectorAll('.help-menu a');
  const helpSections: NodeListOf<HTMLElement> = document.querySelectorAll('.help-section');

  // Menü bağlantılarına tıklama olayı ekle
  helpMenuLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();

      // Aktif bağlantıyı güncelle
      helpMenuLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');

      // Hedef bölümü göster
      const targetId = this.getAttribute('href')?.substring(1) || '';
      helpSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetId) {
          section.classList.add('active');
        }
      });

      // Sayfa başına kaydır
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  });

  // SSS bölümü
  const faqItems: NodeListOf<HTMLElement> = document.querySelectorAll('.help-faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.help-faq-question');

    question?.addEventListener('click', function() {
      // Aktif durumu değiştir
      item.classList.toggle('active');
    });
  });

  // Arama işlevi
  const searchInput = document.getElementById('helpSearch') as HTMLInputElement;
  const searchButton = document.getElementById('helpSearchBtn') as HTMLButtonElement;

  function performSearch(): void {
    const searchTerm = searchInput.value.toLowerCase().trim();

    if (searchTerm.length < 2) {
      return;
    }

    // Tüm başlıkları ve paragrafları ara
    const headings: NodeListOf<HTMLHeadingElement> = document.querySelectorAll('.help-section h1, .help-section h2, .help-section h3');
    const paragraphs: NodeListOf<HTMLParagraphElement> = document.querySelectorAll('.help-section p');

    let foundInSection: string | null = null;

    // Başlıklarda ara
    headings.forEach(heading => {
      if (heading.textContent?.toLowerCase().includes(searchTerm)) {
        // En yakın bölümü bul
        const section = heading.closest('.help-section');
        if (section) {
          foundInSection = section.id;
        }
      }
    });

    // Paragraflarda ara (eğer başlıklarda bulunamadıysa)
    if (!foundInSection) {
      paragraphs.forEach(paragraph => {
        if (paragraph.textContent?.toLowerCase().includes(searchTerm)) {
          // En yakın bölümü bul
          const section = paragraph.closest('.help-section');
          if (section) {
            foundInSection = section.id;
          }
        }
      });
    }

    // Eğer bir bölüm bulunduysa, o bölüme git
    if (foundInSection) {
      // Aktif bölümü güncelle
      helpSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === foundInSection) {
          section.classList.add('active');
        }
      });

      // Aktif menü bağlantısını güncelle
      helpMenuLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${foundInSection}`) {
          link.classList.add('active');
        }
      });

      // Sayfa başına kaydır
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      // Arama terimini vurgula
      highlightSearchTerm(searchTerm);
    } else {
      alert('Arama sonucu bulunamadı.');
    }
  }

  // Arama düğmesine tıklama olayı ekle
  searchButton.addEventListener('click', performSearch);

  // Enter tuşuna basma olayı ekle
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // Arama terimini vurgulama işlevi
  function highlightSearchTerm(term: string): void {
    // Aktif bölümdeki tüm metin içeriklerini al
    const activeSection = document.querySelector('.help-section.active');
    if (!activeSection) return;

    const textElements = activeSection.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');

    // Vurgulamaları temizle
    const existingHighlights = document.querySelectorAll('.search-highlight');
    existingHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });

    // Yeni vurgulamaları ekle
    const regex = new RegExp(`(${term})`, 'gi');

    textElements.forEach(element => {
      const nodes = Array.from(element.childNodes);

      nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (text.toLowerCase().includes(term.toLowerCase())) {
            const newHtml = text.replace(regex, '<span class="search-highlight">$1</span>');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newHtml;

            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
              fragment.appendChild(tempDiv.firstChild);
            }

            if (node.parentNode) {
              node.parentNode.replaceChild(fragment, node);
            }
          }
        }
      });
    });

    // İlk vurgulamaya kaydır
    const firstHighlight = document.querySelector('.search-highlight');
    if (firstHighlight) {
      firstHighlight.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }

  // Sayfa yüklendiğinde URL hash'i varsa ilgili bölüme git
  if (window.location.hash) {
    const targetId = window.location.hash.substring(1);
    const targetLink = document.querySelector(`.help-menu a[href="#${targetId}"]`);

    if (targetLink) {
      (targetLink as HTMLElement).click();
    }
  }
});
