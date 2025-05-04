// Ses Seviyesi Göstergeleri
class AudioLevelIndicator {
  constructor() {
    this.audioContext = null;
    this.audioStream = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    this.volume = 0;
    this.speaking = false;
    this.muted = false;
    this.speakingThreshold = 0.05;
    this.indicators = new Map();
    this.animationFrameId = null;
    this.initialized = false;
    
    // Ses ayarları
    this.microphoneGain = 1.0;
    this.speakerVolume = 1.0;
    this.noiseSuppressionEnabled = true;
    this.echoCancellationEnabled = true;
    
    // Kullanıcı durumu
    this.userStatus = 'online'; // online, idle, dnd, offline
    
    this.init();
  }
  
  // Başlangıç
  async init() {
    try {
      // AudioContext oluştur
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Kullanıcı arayüzü elemanlarını oluştur
      this.createUserStatusMenu();
      this.createAudioSettingsPanel();
      
      // Kullanıcı durumu butonuna tıklama olayı
      const userStatusBtn = document.getElementById('userStatusBtn');
      if (userStatusBtn) {
        userStatusBtn.addEventListener('click', () => this.toggleUserStatusMenu());
      }
      
      // Ses ayarları butonuna tıklama olayı
      const audioSettingsBtn = document.getElementById('audioSettingsBtn');
      if (audioSettingsBtn) {
        audioSettingsBtn.addEventListener('click', () => this.toggleAudioSettingsPanel());
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Ses seviyesi göstergeleri başlatılırken hata oluştu:', error);
    }
  }
  
  // Mikrofon akışını başlat
  async startMicrophoneStream() {
    try {
      if (!this.initialized) {
        await this.init();
      }
      
      // Mikrofon erişimi iste
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.echoCancellationEnabled,
          noiseSuppression: this.noiseSuppressionEnabled,
          autoGainControl: true
        }
      });
      
      // Mikrofon kaynağını oluştur
      this.microphone = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Gain node oluştur (mikrofon seviyesi için)
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.microphoneGain;
      
      // Analyser node oluştur
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      // Bağlantıları yap
      this.microphone.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      
      // Ses seviyesi ölçümünü başlat
      this.startLevelMeasurement();
      
      return true;
    } catch (error) {
      console.error('Mikrofon akışı başlatılırken hata oluştu:', error);
      return false;
    }
  }
  
  // Mikrofon akışını durdur
  stopMicrophoneStream() {
    try {
      // Animasyon çerçevesini iptal et
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      
      // Bağlantıları kapat
      if (this.microphone) {
        this.microphone.disconnect();
        this.microphone = null;
      }
      
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      
      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }
      
      // Ses akışını kapat
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      // Tüm göstergeleri sıfırla
      this.indicators.forEach(indicator => {
        this.updateIndicator(indicator.element, 0, false, false);
      });
      
      return true;
    } catch (error) {
      console.error('Mikrofon akışı durdurulurken hata oluştu:', error);
      return false;
    }
  }
  
  // Ses seviyesi ölçümünü başlat
  startLevelMeasurement() {
    const updateLevels = () => {
      // Ses verilerini al
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Ses seviyesini hesapla (0-1 arasında)
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      this.volume = sum / (this.dataArray.length * 255);
      
      // Konuşma durumunu güncelle
      this.speaking = this.volume > this.speakingThreshold && !this.muted;
      
      // Tüm göstergeleri güncelle
      this.indicators.forEach(indicator => {
        this.updateIndicator(indicator.element, this.volume, this.speaking, this.muted);
      });
      
      // Ses seviyesi ölçerini güncelle
      this.updateAudioMeter(this.volume);
      
      // Bir sonraki çerçeve için tekrar çağır
      this.animationFrameId = requestAnimationFrame(updateLevels);
    };
    
    // İlk çerçeveyi başlat
    this.animationFrameId = requestAnimationFrame(updateLevels);
  }
  
  // Gösterge oluştur
  createIndicator(containerId, userId = 'local') {
    try {
      const container = document.getElementById(containerId);
      if (!container) return null;
      
      // Gösterge elemanını oluştur
      const indicator = document.createElement('div');
      indicator.className = 'audio-level-indicator';
      indicator.dataset.userId = userId;
      
      // Ses seviyesi çubuğunu oluştur
      const bar = document.createElement('div');
      bar.className = 'audio-level-bar';
      indicator.appendChild(bar);
      
      // Göstergeyi konteynere ekle
      container.appendChild(indicator);
      
      // Göstergeyi kaydet
      this.indicators.set(userId, {
        element: indicator,
        containerId
      });
      
      return indicator;
    } catch (error) {
      console.error('Gösterge oluşturulurken hata oluştu:', error);
      return null;
    }
  }
  
  // Göstergeyi güncelle
  updateIndicator(indicator, volume, speaking, muted) {
    try {
      if (!indicator) return;
      
      const bar = indicator.querySelector('.audio-level-bar');
      if (!bar) return;
      
      // Ses seviyesi çubuğunun genişliğini güncelle
      bar.style.width = `${volume * 100}%`;
      
      // Konuşma ve sessiz durumlarını güncelle
      bar.classList.toggle('speaking', speaking);
      bar.classList.toggle('muted', muted);
    } catch (error) {
      console.error('Gösterge güncellenirken hata oluştu:', error);
    }
  }
  
  // Göstergeyi kaldır
  removeIndicator(userId) {
    try {
      const indicator = this.indicators.get(userId);
      if (!indicator) return;
      
      // Göstergeyi DOM'dan kaldır
      indicator.element.remove();
      
      // Göstergeyi haritadan kaldır
      this.indicators.delete(userId);
    } catch (error) {
      console.error('Gösterge kaldırılırken hata oluştu:', error);
    }
  }
  
  // Tüm göstergeleri kaldır
  removeAllIndicators() {
    try {
      this.indicators.forEach((indicator, userId) => {
        this.removeIndicator(userId);
      });
    } catch (error) {
      console.error('Tüm göstergeler kaldırılırken hata oluştu:', error);
    }
  }
  
  // Mikrofon durumunu değiştir
  setMuted(muted) {
    this.muted = muted;
    
    // Mikrofon akışını güncelle
    if (this.audioStream) {
      this.audioStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }
  
  // Mikrofon seviyesini ayarla
  setMicrophoneGain(gain) {
    this.microphoneGain = Math.max(0, Math.min(2, gain));
    
    if (this.gainNode) {
      this.gainNode.gain.value = this.microphoneGain;
    }
  }
  
  // Hoparlör seviyesini ayarla
  setSpeakerVolume(volume) {
    this.speakerVolume = Math.max(0, Math.min(1, volume));
    
    // Tüm ses elementlerinin seviyesini güncelle
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.volume = this.speakerVolume;
    });
  }
  
  // Gürültü bastırma durumunu ayarla
  setNoiseSuppression(enabled) {
    this.noiseSuppressionEnabled = enabled;
    
    // Mikrofon akışını yeniden başlat
    if (this.audioStream) {
      this.stopMicrophoneStream();
      this.startMicrophoneStream();
    }
  }
  
  // Yankı engelleme durumunu ayarla
  setEchoCancellation(enabled) {
    this.echoCancellationEnabled = enabled;
    
    // Mikrofon akışını yeniden başlat
    if (this.audioStream) {
      this.stopMicrophoneStream();
      this.startMicrophoneStream();
    }
  }
  
  // Kullanıcı durumunu ayarla
  setUserStatus(status) {
    this.userStatus = status;
    
    // Kullanıcı durumu göstergesini güncelle
    const userStatusIndicator = document.getElementById('userStatusIndicator');
    if (userStatusIndicator) {
      userStatusIndicator.className = `user-status-indicator ${status}`;
    }
    
    // Kullanıcı durumu menüsünü güncelle
    const statusOptions = document.querySelectorAll('.user-status-option');
    statusOptions.forEach(option => {
      option.classList.toggle('selected', option.dataset.status === status);
    });
    
    // Kullanıcı durumu butonunu güncelle
    const userStatusBtn = document.getElementById('userStatusBtn');
    if (userStatusBtn) {
      const statusIcon = userStatusBtn.querySelector('.material-icons');
      if (statusIcon) {
        switch (status) {
          case 'online':
            statusIcon.textContent = 'circle';
            statusIcon.style.color = '#2ecc71';
            break;
          case 'idle':
            statusIcon.textContent = 'access_time';
            statusIcon.style.color = '#f39c12';
            break;
          case 'dnd':
            statusIcon.textContent = 'do_not_disturb_on';
            statusIcon.style.color = '#e74c3c';
            break;
          case 'offline':
            statusIcon.textContent = 'circle';
            statusIcon.style.color = '#95a5a6';
            break;
        }
      }
    }
    
    // Kullanıcı durumunu sunucuya bildir
    if (window.socket) {
      window.socket.emit('user:status', { status });
    }
  }
  
  // Kullanıcı durumu menüsünü oluştur
  createUserStatusMenu() {
    try {
      // Menü konteyneri oluştur
      const menuContainer = document.createElement('div');
      menuContainer.id = 'userStatusMenu';
      menuContainer.className = 'user-status-menu';
      
      // Durum seçeneklerini oluştur
      const statuses = [
        { id: 'online', text: 'Çevrimiçi', color: '#2ecc71' },
        { id: 'idle', text: 'Boşta', color: '#f39c12' },
        { id: 'dnd', text: 'Rahatsız Etmeyin', color: '#e74c3c' },
        { id: 'offline', text: 'Çevrimdışı Görün', color: '#95a5a6' }
      ];
      
      statuses.forEach(status => {
        const option = document.createElement('div');
        option.className = 'user-status-option';
        option.dataset.status = status.id;
        
        if (status.id === this.userStatus) {
          option.classList.add('selected');
        }
        
        const icon = document.createElement('div');
        icon.className = 'user-status-option-icon';
        icon.style.backgroundColor = status.color;
        
        const text = document.createElement('div');
        text.className = 'user-status-option-text';
        text.textContent = status.text;
        
        option.appendChild(icon);
        option.appendChild(text);
        
        // Durum seçeneğine tıklama olayı
        option.addEventListener('click', () => {
          this.setUserStatus(status.id);
          this.toggleUserStatusMenu();
        });
        
        menuContainer.appendChild(option);
      });
      
      // Menüyü sayfaya ekle
      document.body.appendChild(menuContainer);
    } catch (error) {
      console.error('Kullanıcı durumu menüsü oluşturulurken hata oluştu:', error);
    }
  }
  
  // Kullanıcı durumu menüsünü göster/gizle
  toggleUserStatusMenu() {
    try {
      const menu = document.getElementById('userStatusMenu');
      if (!menu) return;
      
      menu.classList.toggle('active');
      
      // Menü dışına tıklandığında menüyü kapat
      if (menu.classList.contains('active')) {
        const closeMenu = (event) => {
          if (!menu.contains(event.target) && event.target.id !== 'userStatusBtn') {
            menu.classList.remove('active');
            document.removeEventListener('click', closeMenu);
          }
        };
        
        // Bir sonraki tıklamada olay dinleyicisini ekle (mevcut tıklamayı yok say)
        setTimeout(() => {
          document.addEventListener('click', closeMenu);
        }, 0);
      }
    } catch (error) {
      console.error('Kullanıcı durumu menüsü gösterilirken/gizlenirken hata oluştu:', error);
    }
  }
  
  // Ses ayarları panelini oluştur
  createAudioSettingsPanel() {
    try {
      // Panel konteyneri oluştur
      const panelContainer = document.createElement('div');
      panelContainer.id = 'audioSettingsPanel';
      panelContainer.className = 'audio-settings-container';
      panelContainer.style.display = 'none';
      panelContainer.style.position = 'fixed';
      panelContainer.style.top = '50%';
      panelContainer.style.left = '50%';
      panelContainer.style.transform = 'translate(-50%, -50%)';
      panelContainer.style.zIndex = '1000';
      panelContainer.style.width = '350px';
      
      // Panel başlığı
      const header = document.createElement('div');
      header.className = 'audio-settings-header';
      
      const title = document.createElement('div');
      title.className = 'audio-settings-title';
      title.textContent = 'Ses Ayarları';
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'audio-settings-close';
      closeBtn.innerHTML = '<span class="material-icons">close</span>';
      closeBtn.addEventListener('click', () => this.toggleAudioSettingsPanel());
      
      header.appendChild(title);
      header.appendChild(closeBtn);
      
      // Mikrofon ayarları
      const micSection = document.createElement('div');
      micSection.className = 'audio-settings-section';
      
      const micTitle = document.createElement('div');
      micTitle.className = 'audio-settings-section-title';
      micTitle.textContent = 'Mikrofon';
      
      // Mikrofon seviyesi
      const micLevelControl = document.createElement('div');
      micLevelControl.className = 'audio-settings-control';
      
      const micLevelLabel = document.createElement('div');
      micLevelLabel.className = 'audio-settings-label';
      micLevelLabel.textContent = 'Seviye';
      
      const micLevelSlider = document.createElement('input');
      micLevelSlider.type = 'range';
      micLevelSlider.min = '0';
      micLevelSlider.max = '2';
      micLevelSlider.step = '0.1';
      micLevelSlider.value = this.microphoneGain.toString();
      micLevelSlider.className = 'audio-settings-slider';
      
      const micLevelValue = document.createElement('div');
      micLevelValue.className = 'audio-settings-value';
      micLevelValue.textContent = `${Math.round(this.microphoneGain * 100)}%`;
      
      micLevelSlider.addEventListener('input', () => {
        const gain = parseFloat(micLevelSlider.value);
        this.setMicrophoneGain(gain);
        micLevelValue.textContent = `${Math.round(gain * 100)}%`;
      });
      
      micLevelControl.appendChild(micLevelLabel);
      micLevelControl.appendChild(micLevelSlider);
      micLevelControl.appendChild(micLevelValue);
      
      // Gürültü bastırma
      const noiseSuppressionControl = document.createElement('div');
      noiseSuppressionControl.className = 'audio-settings-control';
      
      const noiseSuppressionLabel = document.createElement('div');
      noiseSuppressionLabel.className = 'audio-settings-label';
      noiseSuppressionLabel.textContent = 'Gürültü Bastırma';
      
      const noiseSuppressionCheckbox = document.createElement('input');
      noiseSuppressionCheckbox.type = 'checkbox';
      noiseSuppressionCheckbox.checked = this.noiseSuppressionEnabled;
      
      noiseSuppressionCheckbox.addEventListener('change', () => {
        this.setNoiseSuppression(noiseSuppressionCheckbox.checked);
      });
      
      noiseSuppressionControl.appendChild(noiseSuppressionLabel);
      noiseSuppressionControl.appendChild(noiseSuppressionCheckbox);
      
      // Yankı engelleme
      const echoCancellationControl = document.createElement('div');
      echoCancellationControl.className = 'audio-settings-control';
      
      const echoCancellationLabel = document.createElement('div');
      echoCancellationLabel.className = 'audio-settings-label';
      echoCancellationLabel.textContent = 'Yankı Engelleme';
      
      const echoCancellationCheckbox = document.createElement('input');
      echoCancellationCheckbox.type = 'checkbox';
      echoCancellationCheckbox.checked = this.echoCancellationEnabled;
      
      echoCancellationCheckbox.addEventListener('change', () => {
        this.setEchoCancellation(echoCancellationCheckbox.checked);
      });
      
      echoCancellationControl.appendChild(echoCancellationLabel);
      echoCancellationControl.appendChild(echoCancellationCheckbox);
      
      // Mikrofon testi
      const micTestButton = document.createElement('button');
      micTestButton.className = 'audio-test-button';
      micTestButton.innerHTML = '<span class="material-icons">mic</span> Mikrofonu Test Et';
      
      micTestButton.addEventListener('click', async () => {
        if (micTestButton.classList.contains('testing')) {
          // Testi durdur
          this.stopMicrophoneStream();
          micTestButton.classList.remove('testing');
          micTestButton.innerHTML = '<span class="material-icons">mic</span> Mikrofonu Test Et';
        } else {
          // Testi başlat
          const success = await this.startMicrophoneStream();
          if (success) {
            micTestButton.classList.add('testing');
            micTestButton.innerHTML = '<span class="material-icons">stop</span> Testi Durdur';
          }
        }
      });
      
      // Ses seviyesi ölçer
      const audioMeter = document.createElement('div');
      audioMeter.className = 'audio-meter';
      audioMeter.id = 'audioMeter';
      
      const audioMeterBar = document.createElement('div');
      audioMeterBar.className = 'audio-meter-bar';
      audioMeterBar.id = 'audioMeterBar';
      
      const audioMeterTicks = document.createElement('div');
      audioMeterTicks.className = 'audio-meter-ticks';
      
      // Ölçek çizgileri ekle
      for (let i = 0; i < 10; i++) {
        const tick = document.createElement('div');
        tick.className = 'audio-meter-tick';
        audioMeterTicks.appendChild(tick);
      }
      
      audioMeter.appendChild(audioMeterBar);
      audioMeter.appendChild(audioMeterTicks);
      
      micSection.appendChild(micTitle);
      micSection.appendChild(micLevelControl);
      micSection.appendChild(noiseSuppressionControl);
      micSection.appendChild(echoCancellationControl);
      micSection.appendChild(micTestButton);
      micSection.appendChild(audioMeter);
      
      // Hoparlör ayarları
      const speakerSection = document.createElement('div');
      speakerSection.className = 'audio-settings-section';
      
      const speakerTitle = document.createElement('div');
      speakerTitle.className = 'audio-settings-section-title';
      speakerTitle.textContent = 'Hoparlör';
      
      // Hoparlör seviyesi
      const speakerLevelControl = document.createElement('div');
      speakerLevelControl.className = 'audio-settings-control';
      
      const speakerLevelLabel = document.createElement('div');
      speakerLevelLabel.className = 'audio-settings-label';
      speakerLevelLabel.textContent = 'Seviye';
      
      const speakerLevelSlider = document.createElement('input');
      speakerLevelSlider.type = 'range';
      speakerLevelSlider.min = '0';
      speakerLevelSlider.max = '1';
      speakerLevelSlider.step = '0.1';
      speakerLevelSlider.value = this.speakerVolume.toString();
      speakerLevelSlider.className = 'audio-settings-slider';
      
      const speakerLevelValue = document.createElement('div');
      speakerLevelValue.className = 'audio-settings-value';
      speakerLevelValue.textContent = `${Math.round(this.speakerVolume * 100)}%`;
      
      speakerLevelSlider.addEventListener('input', () => {
        const volume = parseFloat(speakerLevelSlider.value);
        this.setSpeakerVolume(volume);
        speakerLevelValue.textContent = `${Math.round(volume * 100)}%`;
      });
      
      speakerLevelControl.appendChild(speakerLevelLabel);
      speakerLevelControl.appendChild(speakerLevelSlider);
      speakerLevelControl.appendChild(speakerLevelValue);
      
      // Hoparlör testi
      const speakerTestButton = document.createElement('button');
      speakerTestButton.className = 'audio-test-button';
      speakerTestButton.innerHTML = '<span class="material-icons">volume_up</span> Hoparlörü Test Et';
      
      speakerTestButton.addEventListener('click', () => {
        // Test sesi çal
        const audio = new Audio('/sounds/test-sound.mp3');
        audio.volume = this.speakerVolume;
        audio.play();
      });
      
      speakerSection.appendChild(speakerTitle);
      speakerSection.appendChild(speakerLevelControl);
      speakerSection.appendChild(speakerTestButton);
      
      // Paneli oluştur
      panelContainer.appendChild(header);
      panelContainer.appendChild(micSection);
      panelContainer.appendChild(speakerSection);
      
      // Paneli sayfaya ekle
      document.body.appendChild(panelContainer);
    } catch (error) {
      console.error('Ses ayarları paneli oluşturulurken hata oluştu:', error);
    }
  }
  
  // Ses ayarları panelini göster/gizle
  toggleAudioSettingsPanel() {
    try {
      const panel = document.getElementById('audioSettingsPanel');
      if (!panel) return;
      
      const isVisible = panel.style.display === 'block';
      
      if (isVisible) {
        // Paneli gizle
        panel.style.display = 'none';
        
        // Mikrofon testini durdur
        this.stopMicrophoneStream();
        
        const micTestButton = panel.querySelector('.audio-test-button');
        if (micTestButton) {
          micTestButton.classList.remove('testing');
          micTestButton.innerHTML = '<span class="material-icons">mic</span> Mikrofonu Test Et';
        }
      } else {
        // Paneli göster
        panel.style.display = 'block';
      }
    } catch (error) {
      console.error('Ses ayarları paneli gösterilirken/gizlenirken hata oluştu:', error);
    }
  }
  
  // Ses seviyesi ölçerini güncelle
  updateAudioMeter(volume) {
    try {
      const audioMeterBar = document.getElementById('audioMeterBar');
      if (!audioMeterBar) return;
      
      audioMeterBar.style.width = `${volume * 100}%`;
    } catch (error) {
      console.error('Ses seviyesi ölçeri güncellenirken hata oluştu:', error);
    }
  }
}

// Sayfa yüklendiğinde ses seviyesi göstergelerini başlat
document.addEventListener('DOMContentLoaded', () => {
  window.audioLevelIndicator = new AudioLevelIndicator();
});
