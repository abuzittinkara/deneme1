/**
 * Help Center JavaScript
 * Bu dosya, yardım merkezi sayfasının işlevselliğini sağlar.
 */

document.addEventListener('DOMContentLoaded', function () {
  // Menü bağlantıları ve bölümler
  const helpMenuLinks = document.querySelectorAll('.help-menu a');
  const helpSections = document.querySelectorAll('.help-section');

  // Menü bağlantılarına tıklama olayı ekle
  helpMenuLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      
      // Tüm bağlantılardan active sınıfını kaldır
      helpMenuLinks.forEach(l => l.classList.remove('active'));
      
      // Tıklanan bağlantıya active sınıfını ekle
      this.classList.add('active');
      
      // Hedef bölümü bul
      const targetId = this.getAttribute('href')?.substring(1) || '';
      
      // Tüm bölümlerden active sınıfını kaldır ve hedef bölüme active sınıfını ekle
      helpSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetId) {
          section.classList.add('active');
        }
      });
      
      // Sayfayı yukarı kaydır
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // SSS öğeleri
  const faqItems = document.querySelectorAll('.help-faq-item');
  
  // SSS öğelerine tıklama olayı ekle
  faqItems.forEach(item => {
    const question = item.querySelector('.help-faq-question');
    question?.addEventListener('click', function () {
      item.classList.toggle('active');
    });
  });

  // Arama işlevselliği
  const searchInput = document.getElementById('helpSearch') as HTMLInputElement;
  const searchButton = document.getElementById('helpSearchBtn');

  // Arama işlevi
  function performSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // En az 2 karakter gerekli
    if (searchTerm.length < 2) {
      return;
    }
    
    // Başlıklar ve paragraflar
    const headings = document.querySelectorAll('.help-section h1, .help-section h2, .help-section h3');
    const paragraphs = document.querySelectorAll('.help-section p');
    
    let foundInSection = null;
    
    // Başlıklarda ara
    for (const heading of headings) {
      if (heading.textContent?.toLowerCase().includes(searchTerm)) {
        const section = heading.closest('.help-section');
        if (section) {
          foundInSection = section.id;
          break;
        }
      }
    }
    
    // Paragraflarda ara
    if (!foundInSection) {
      for (const paragraph of paragraphs) {
        if (paragraph.textContent?.toLowerCase().includes(searchTerm)) {
          const section = paragraph.closest('.help-section');
          if (section) {
            foundInSection = section.id;
            break;
          }
        }
      }
    }
    
    // Sonuç bulunduysa
    if (foundInSection) {
      // İlgili bölümü göster
      helpSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === foundInSection) {
          section.classList.add('active');
        }
      });
      
      // İlgili menü bağlantısını aktif et
      helpMenuLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${foundInSection}`) {
          link.classList.add('active');
        }
      });
      
      // Sayfayı yukarı kaydır
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Arama terimini vurgula
      highlightSearchTerm(searchTerm);
    } else {
      alert('Arama sonucu bulunamadı.');
    }
  }

  // Arama düğmesine tıklama olayı ekle
  searchButton?.addEventListener('click', performSearch);
  
  // Arama kutusunda Enter tuşuna basma olayı ekle
  searchInput?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // Arama terimini vurgulama işlevi
  function highlightSearchTerm(term: string) {
    const activeSection = document.querySelector('.help-section.active');
    if (!activeSection) return;
    
    // Metin öğeleri
    const textElements = activeSection.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');
    
    // Mevcut vurgulamaları kaldır
    const existingHighlights = document.querySelectorAll('.search-highlight');
    existingHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
    
    // Yeni vurgulamalar ekle
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
      firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // URL'de hash varsa ilgili bölümü göster
  if (window.location.hash) {
    const targetId = window.location.hash.substring(1);
    const targetLink = document.querySelector(`.help-menu a[href="#${targetId}"]`);
    if (targetLink) {
      (targetLink as HTMLElement).click();
    }
  }
});
