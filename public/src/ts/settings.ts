/**
 * public/src/ts/settings.ts
 * Ayarlar sayfası işlevselliği
 */

import { socket } from './socket';
import * as mediasoupClient from './mediasoupClient';

// Ayarlar durumu
interface SettingsState {
  audio: {
    inputDevice: string;
    outputDevice: string;
    micVolume: number;
    speakerVolume: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
  };
  video: {
    videoDevice: string;
    quality: string;
    hardwareAcceleration: boolean;
    backgroundBlur: boolean;
  };
  advanced: {
    iceServers: string;
    maxBitrate: number;
    simulcast: boolean;
    bandwidthEstimation: boolean;
    preferMediasoup: boolean;
    codecPreference: string;
  };
  localStream: MediaStream | null;
  availableDevices: {
    audioinput: MediaDeviceInfo[];
    audiooutput: MediaDeviceInfo[];
    videoinput: MediaDeviceInfo[];
  };
}

// Ayarlar durumunu başlat
const settingsState: SettingsState = {
  audio: {
    inputDevice: '',
    outputDevice: '',
    micVolume: 100,
    speakerVolume: 100,
    echoCancellation: true,
    noiseSuppression: true
  },
  video: {
    videoDevice: '',
    quality: 'medium',
    hardwareAcceleration: true,
    backgroundBlur: false
  },
  advanced: {
    iceServers: 'stun:stun.l.google.com:19302',
    maxBitrate: 1000,
    simulcast: true,
    bandwidthEstimation: true,
    preferMediasoup: true,
    codecPreference: 'h264'
  },
  localStream: null,
  availableDevices: {
    audioinput: [],
    audiooutput: [],
    videoinput: []
  }
};

// Video kalite ayarları
const videoQualitySettings = {
  low: {
    width: { ideal: 320 },
    height: { ideal: 240 },
    frameRate: { max: 15 }
  },
  medium: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { max: 30 }
  },
  high: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { max: 30 }
  },
  hd: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { max: 30 }
  }
};

/**
 * Sayfa yüklendiğinde çalışır
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Sekme değiştirme işlevselliği
  setupTabSwitching();

  // Ayarları yükle
  loadSettings();

  // Cihazları listele
  await listDevices();

  // Ses ayarları
  setupAudioSettings();

  // Video ayarları
  setupVideoSettings();

  // Gelişmiş ayarlar
  setupAdvancedSettings();

  // Ayarları kaydetme
  setupSaveSettings();
});

/**
 * Sekme değiştirme işlevselliğini ayarlar
 */
function setupTabSwitching() {
  // Ayarlar sekmelerini seç
  const settingsTabs = document.querySelectorAll('.settings-nav-item');

  // Her sekme için tıklama olayı ekle
  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Aktif sekmeyi kaldır
      document.querySelector('.settings-nav-item.active')?.classList.remove('active');

      // Yeni sekmeyi aktif yap
      tab.classList.add('active');

      // Sekme içeriğini göster
      const sectionId = tab.getAttribute('data-section');

      // Tüm sekme içeriklerini gizle
      document.querySelectorAll('.settings-section').forEach(section => {
        section.classList.remove('active');
      });

      // İlgili sekme içeriğini göster
      document.getElementById(`${sectionId}-section`)?.classList.add('active');
    });
  });

  // Ses ve video ayarları sekmeleri
  const voiceTabs = document.querySelectorAll('.settings-tab');

  // Her sekme için tıklama olayı ekle
  voiceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Aktif sekmeyi kaldır
      document.querySelector('.settings-tab.active')?.classList.remove('active');

      // Yeni sekmeyi aktif yap
      tab.classList.add('active');

      // Sekme içeriğini göster
      const tabId = tab.getAttribute('data-tab');

      // Tüm sekme içeriklerini gizle
      document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
      });

      // İlgili sekme içeriğini göster
      document.getElementById(`${tabId}-tab`)?.classList.add('active');
    });
  });
}

/**
 * Ayarları yükler
 */
function loadSettings() {
  // Yerel depolamadan ayarları yükle
  const savedSettings = localStorage.getItem('mediaSettings');

  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);

      // Ses ayarları
      if (parsedSettings.audio) {
        settingsState.audio = { ...settingsState.audio, ...parsedSettings.audio };
      }

      // Video ayarları
      if (parsedSettings.video) {
        settingsState.video = { ...settingsState.video, ...parsedSettings.video };
      }

      // Gelişmiş ayarlar
      if (parsedSettings.advanced) {
        settingsState.advanced = { ...settingsState.advanced, ...parsedSettings.advanced };
      }

      console.log('Ayarlar yüklendi:', settingsState);
    } catch (error) {
      console.error('Ayarlar yüklenirken hata oluştu:', error);
    }
  }
}

/**
 * Cihazları listeler
 */
async function listDevices() {
  try {
    // Kullanıcıdan izin iste
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

    // Cihazları listele
    const devices = await navigator.mediaDevices.enumerateDevices();

    // Cihazları türlerine göre ayır
    settingsState.availableDevices.audioinput = devices.filter(device => device.kind === 'audioinput');
    settingsState.availableDevices.audiooutput = devices.filter(device => device.kind === 'audiooutput');
    settingsState.availableDevices.videoinput = devices.filter(device => device.kind === 'videoinput');

    // Ses giriş cihazlarını listele
    const inputDeviceSelect = document.getElementById('inputDevice') as HTMLSelectElement;
    inputDeviceSelect.innerHTML = '<option value="">Cihaz seçin...</option>';

    settingsState.availableDevices.audioinput.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Mikrofon ${inputDeviceSelect.options.length}`;
      inputDeviceSelect.appendChild(option);
    });

    // Varsayılan ses giriş cihazını seç
    if (settingsState.audio.inputDevice) {
      inputDeviceSelect.value = settingsState.audio.inputDevice;
    }

    // Ses çıkış cihazlarını listele
    const outputDeviceSelect = document.getElementById('outputDevice') as HTMLSelectElement;
    outputDeviceSelect.innerHTML = '<option value="">Cihaz seçin...</option>';

    settingsState.availableDevices.audiooutput.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Hoparlör ${outputDeviceSelect.options.length}`;
      outputDeviceSelect.appendChild(option);
    });

    // Varsayılan ses çıkış cihazını seç
    if (settingsState.audio.outputDevice) {
      outputDeviceSelect.value = settingsState.audio.outputDevice;
    }

    // Video cihazlarını listele
    const videoDeviceSelect = document.getElementById('videoDevice') as HTMLSelectElement;
    videoDeviceSelect.innerHTML = '<option value="">Cihaz seçin...</option>';

    settingsState.availableDevices.videoinput.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Kamera ${videoDeviceSelect.options.length}`;
      videoDeviceSelect.appendChild(option);
    });

    // Varsayılan video cihazını seç
    if (settingsState.video.videoDevice) {
      videoDeviceSelect.value = settingsState.video.videoDevice;
    }

    console.log('Cihazlar listelendi:', settingsState.availableDevices);
  } catch (error) {
    console.error('Cihazlar listelenirken hata oluştu:', error);
  }
}

/**
 * Ses ayarlarını yapılandırır
 */
function setupAudioSettings() {
  // Ses giriş cihazı değiştiğinde
  const inputDeviceSelect = document.getElementById('inputDevice') as HTMLSelectElement;
  inputDeviceSelect.addEventListener('change', () => {
    settingsState.audio.inputDevice = inputDeviceSelect.value;
    updateAudioSettings();
  });

  // Ses çıkış cihazı değiştiğinde
  const outputDeviceSelect = document.getElementById('outputDevice') as HTMLSelectElement;
  outputDeviceSelect.addEventListener('change', () => {
    settingsState.audio.outputDevice = outputDeviceSelect.value;
    updateAudioSettings();
  });

  // Mikrofon seviyesi değiştiğinde
  const micVolumeSlider = document.getElementById('micVolume') as HTMLInputElement;
  const micLevelDisplay = document.getElementById('micLevel') as HTMLElement;

  micVolumeSlider.value = settingsState.audio.micVolume.toString();
  micLevelDisplay.textContent = `${settingsState.audio.micVolume}%`;

  micVolumeSlider.addEventListener('input', () => {
    const value = parseInt(micVolumeSlider.value);
    settingsState.audio.micVolume = value;
    micLevelDisplay.textContent = `${value}%`;

    // Mikrofon seviyesini güncelle
    if (settingsState.localStream) {
      const audioTracks = settingsState.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = value > 0;
      }
    }
  });

  // Hoparlör seviyesi değiştiğinde
  const speakerVolumeSlider = document.getElementById('speakerVolume') as HTMLInputElement;
  const speakerLevelDisplay = document.getElementById('speakerLevel') as HTMLElement;

  speakerVolumeSlider.value = settingsState.audio.speakerVolume.toString();
  speakerLevelDisplay.textContent = `${settingsState.audio.speakerVolume}%`;

  speakerVolumeSlider.addEventListener('input', () => {
    const value = parseInt(speakerVolumeSlider.value);
    settingsState.audio.speakerVolume = value;
    speakerLevelDisplay.textContent = `${value}%`;
  });

  // Yankı engelleme değiştiğinde
  const echoCancellationToggle = document.getElementById('enableEchoCancellation') as HTMLInputElement;
  echoCancellationToggle.checked = settingsState.audio.echoCancellation;

  echoCancellationToggle.addEventListener('change', () => {
    settingsState.audio.echoCancellation = echoCancellationToggle.checked;
    updateAudioSettings();
  });

  // Gürültü bastırma değiştiğinde
  const noiseSuppressionToggle = document.getElementById('enableNoiseSuppression') as HTMLInputElement;
  noiseSuppressionToggle.checked = settingsState.audio.noiseSuppression;

  noiseSuppressionToggle.addEventListener('change', () => {
    settingsState.audio.noiseSuppression = noiseSuppressionToggle.checked;
    updateAudioSettings();
  });

  // Mikrofon test butonu
  const testMicBtn = document.getElementById('testMicBtn') as HTMLButtonElement;
  const micMeter = document.getElementById('micMeter') as HTMLElement;

  testMicBtn.addEventListener('click', async () => {
    try {
      // Mikrofon akışını al
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settingsState.audio.inputDevice ? { exact: settingsState.audio.inputDevice } : undefined,
          echoCancellation: settingsState.audio.echoCancellation,
          noiseSuppression: settingsState.audio.noiseSuppression
        }
      });

      // Ses seviyesini ölç
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);
      analyser.connect(javascriptNode);
      javascriptNode.connect(audioContext.destination);

      javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;

        const length = array.length;
        for (let i = 0; i < length; i++) {
          values += (array[i]);
        }

        const average = values / length;
        const volume = Math.min(100, Math.round(average * 2));

        // Ses seviyesi göstergesini güncelle
        micMeter.style.width = `${volume}%`;
      };

      // Test sırasında buton metnini değiştir
      testMicBtn.textContent = 'Dinleniyor...';
      testMicBtn.disabled = true;

      // 3 saniye sonra testi durdur
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        javascriptNode.disconnect();
        analyser.disconnect();
        microphone.disconnect();
        audioContext.close();

        testMicBtn.innerHTML = '<span class="material-icons">mic</span> Test Et';
        testMicBtn.disabled = false;

        // Ses seviyesi göstergesini sıfırla
        setTimeout(() => {
          micMeter.style.width = '0%';
        }, 500);
      }, 3000);
    } catch (error) {
      console.error('Mikrofon testi sırasında hata oluştu:', error);
      alert('Mikrofon erişimi sağlanamadı. Lütfen izinleri kontrol edin.');
    }
  });

  // Hoparlör test butonu
  const testSpeakerBtn = document.getElementById('testSpeakerBtn') as HTMLButtonElement;

  testSpeakerBtn.addEventListener('click', () => {
    try {
      // Test sesi çal
      const audio = new Audio('sounds/test-sound.mp3');

      // Ses seviyesini ayarla
      audio.volume = settingsState.audio.speakerVolume / 100;

      // Ses çıkış cihazını ayarla (destekleniyorsa)
      if (settingsState.audio.outputDevice && (audio as any).setSinkId) {
        (audio as any).setSinkId(settingsState.audio.outputDevice)
          .then(() => {
            audio.play();
          })
          .catch((error: any) => {
            console.error('Ses çıkış cihazı ayarlanırken hata oluştu:', error);
            audio.play();
          });
      } else {
        audio.play();
      }

      // Test sırasında buton metnini değiştir
      testSpeakerBtn.textContent = 'Çalınıyor...';
      testSpeakerBtn.disabled = true;

      // Ses bittiğinde butonu sıfırla
      audio.onended = () => {
        testSpeakerBtn.innerHTML = '<span class="material-icons">volume_up</span> Test Et';
        testSpeakerBtn.disabled = false;
      };
    } catch (error) {
      console.error('Hoparlör testi sırasında hata oluştu:', error);
    }
  });
}

/**
 * Ses ayarlarını günceller
 */
async function updateAudioSettings() {
  try {
    // Mevcut akışı durdur
    if (settingsState.localStream) {
      settingsState.localStream.getTracks().forEach(track => track.stop());
    }

    // Yeni ses akışını al
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: settingsState.audio.inputDevice ? { exact: settingsState.audio.inputDevice } : undefined,
        echoCancellation: settingsState.audio.echoCancellation,
        noiseSuppression: settingsState.audio.noiseSuppression
      }
    });

    // Akışı kaydet
    settingsState.localStream = stream;

    console.log('Ses ayarları güncellendi');
  } catch (error) {
    console.error('Ses ayarları güncellenirken hata oluştu:', error);
  }
}

/**
 * Video ayarlarını yapılandırır
 */
function setupVideoSettings() {
  // Video cihazı değiştiğinde
  const videoDeviceSelect = document.getElementById('videoDevice') as HTMLSelectElement;
  videoDeviceSelect.addEventListener('change', () => {
    settingsState.video.videoDevice = videoDeviceSelect.value;
    stopVideoPreview();
  });

  // Video kalitesi değiştiğinde
  const videoQualitySelect = document.getElementById('videoQuality') as HTMLSelectElement;
  videoQualitySelect.value = settingsState.video.quality;

  videoQualitySelect.addEventListener('change', () => {
    settingsState.video.quality = videoQualitySelect.value;
    if (settingsState.localStream && settingsState.localStream.getVideoTracks().length > 0) {
      startVideoPreview();
    }
  });

  // Donanım hızlandırma değiştiğinde
  const hardwareAccelerationToggle = document.getElementById('enableHardwareAcceleration') as HTMLInputElement;
  hardwareAccelerationToggle.checked = settingsState.video.hardwareAcceleration;

  hardwareAccelerationToggle.addEventListener('change', () => {
    settingsState.video.hardwareAcceleration = hardwareAccelerationToggle.checked;
  });

  // Arka plan bulanıklaştırma değiştiğinde
  const backgroundBlurToggle = document.getElementById('enableBackgroundBlur') as HTMLInputElement;
  backgroundBlurToggle.checked = settingsState.video.backgroundBlur;

  backgroundBlurToggle.addEventListener('change', () => {
    settingsState.video.backgroundBlur = backgroundBlurToggle.checked;
    if (settingsState.localStream && settingsState.localStream.getVideoTracks().length > 0) {
      applyBackgroundBlur();
    }
  });

  // Video önizleme başlat butonu
  const startVideoPreviewBtn = document.getElementById('startVideoPreviewBtn') as HTMLButtonElement;
  const stopVideoPreviewBtn = document.getElementById('stopVideoPreviewBtn') as HTMLButtonElement;

  startVideoPreviewBtn.addEventListener('click', () => {
    startVideoPreview();
  });

  stopVideoPreviewBtn.addEventListener('click', () => {
    stopVideoPreview();
  });
}

/**
 * Video önizlemeyi başlatır
 */
async function startVideoPreview() {
  try {
    // Mevcut video akışını durdur
    stopVideoPreview();

    // Video kalite ayarlarını al
    const qualitySettings = videoQualitySettings[settingsState.video.quality as keyof typeof videoQualitySettings];

    // Yeni video akışını al
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: settingsState.video.videoDevice ? { exact: settingsState.video.videoDevice } : undefined,
        ...qualitySettings
      }
    });

    // Akışı kaydet
    settingsState.localStream = stream;

    // Video elementini al
    const videoPreview = document.getElementById('videoPreview') as HTMLVideoElement;
    videoPreview.srcObject = stream;

    // Arka plan bulanıklaştırma uygula
    if (settingsState.video.backgroundBlur) {
      applyBackgroundBlur();
    }

    // Butonları güncelle
    const startVideoPreviewBtn = document.getElementById('startVideoPreviewBtn') as HTMLButtonElement;
    const stopVideoPreviewBtn = document.getElementById('stopVideoPreviewBtn') as HTMLButtonElement;

    startVideoPreviewBtn.style.display = 'none';
    stopVideoPreviewBtn.style.display = 'inline-flex';

    console.log('Video önizleme başlatıldı');
  } catch (error) {
    console.error('Video önizleme başlatılırken hata oluştu:', error);
    alert('Kamera erişimi sağlanamadı. Lütfen izinleri kontrol edin.');
  }
}

/**
 * Video önizlemeyi durdurur
 */
function stopVideoPreview() {
  try {
    // Video elementini al
    const videoPreview = document.getElementById('videoPreview') as HTMLVideoElement;

    // Akışı durdur
    if (settingsState.localStream) {
      settingsState.localStream.getTracks().forEach(track => track.stop());
      settingsState.localStream = null;
    }

    // Video elementini temizle
    videoPreview.srcObject = null;

    // Butonları güncelle
    const startVideoPreviewBtn = document.getElementById('startVideoPreviewBtn') as HTMLButtonElement;
    const stopVideoPreviewBtn = document.getElementById('stopVideoPreviewBtn') as HTMLButtonElement;

    startVideoPreviewBtn.style.display = 'inline-flex';
    stopVideoPreviewBtn.style.display = 'none';

    console.log('Video önizleme durduruldu');
  } catch (error) {
    console.error('Video önizleme durdurulurken hata oluştu:', error);
  }
}

/**
 * Arka plan bulanıklaştırma uygular
 */
async function applyBackgroundBlur() {
  // Not: Bu fonksiyon gerçek bir arka plan bulanıklaştırma uygulamaz
  // TensorFlow.js veya benzeri bir kütüphane kullanılarak gerçekleştirilebilir
  console.log('Arka plan bulanıklaştırma:', settingsState.video.backgroundBlur ? 'Açık' : 'Kapalı');
}

/**
 * Gelişmiş ayarları yapılandırır
 */
function setupAdvancedSettings() {
  // ICE sunucuları
  const iceServersTextarea = document.getElementById('iceServers') as HTMLTextAreaElement;
  iceServersTextarea.value = settingsState.advanced.iceServers;

  iceServersTextarea.addEventListener('change', () => {
    settingsState.advanced.iceServers = iceServersTextarea.value;
  });

  // Maksimum bit hızı
  const maxBitrateInput = document.getElementById('maxBitrate') as HTMLInputElement;
  maxBitrateInput.value = settingsState.advanced.maxBitrate.toString();

  maxBitrateInput.addEventListener('change', () => {
    settingsState.advanced.maxBitrate = parseInt(maxBitrateInput.value);
  });

  // Simulcast
  const simulcastToggle = document.getElementById('enableSimulcast') as HTMLInputElement;
  simulcastToggle.checked = settingsState.advanced.simulcast;

  simulcastToggle.addEventListener('change', () => {
    settingsState.advanced.simulcast = simulcastToggle.checked;
  });

  // Bant genişliği tahmini
  const bandwidthEstimationToggle = document.getElementById('enableBandwidthEstimation') as HTMLInputElement;
  bandwidthEstimationToggle.checked = settingsState.advanced.bandwidthEstimation;

  bandwidthEstimationToggle.addEventListener('change', () => {
    settingsState.advanced.bandwidthEstimation = bandwidthEstimationToggle.checked;
  });

  // MediaSoup tercihi
  const preferMediasoupToggle = document.getElementById('preferMediasoup') as HTMLInputElement;
  preferMediasoupToggle.checked = settingsState.advanced.preferMediasoup;

  preferMediasoupToggle.addEventListener('change', () => {
    settingsState.advanced.preferMediasoup = preferMediasoupToggle.checked;
  });

  // Codec tercihi
  const codecPreferenceSelect = document.getElementById('codecPreference') as HTMLSelectElement;
  codecPreferenceSelect.value = settingsState.advanced.codecPreference;

  codecPreferenceSelect.addEventListener('change', () => {
    settingsState.advanced.codecPreference = codecPreferenceSelect.value;
  });
}

/**
 * Ayarları kaydetme işlevselliğini ayarlar
 */
function setupSaveSettings() {
  // Ayarları kaydet butonu
  const saveVoiceBtn = document.getElementById('saveVoiceBtn') as HTMLButtonElement;

  saveVoiceBtn.addEventListener('click', () => {
    // Ayarları yerel depolamaya kaydet
    localStorage.setItem('mediaSettings', JSON.stringify({
      audio: settingsState.audio,
      video: settingsState.video,
      advanced: settingsState.advanced
    }));

    // Kullanıcıya bildir
    alert('Ayarlar başarıyla kaydedildi.');
  });

  // Ayarları sıfırla butonu
  const resetVoiceBtn = document.getElementById('resetVoiceBtn') as HTMLButtonElement;

  resetVoiceBtn.addEventListener('click', () => {
    if (confirm('Tüm ayarları varsayılan değerlere sıfırlamak istediğinizden emin misiniz?')) {
      // Ayarları sıfırla
      settingsState.audio = {
        inputDevice: '',
        outputDevice: '',
        micVolume: 100,
        speakerVolume: 100,
        echoCancellation: true,
        noiseSuppression: true
      };

      settingsState.video = {
        videoDevice: '',
        quality: 'medium',
        hardwareAcceleration: true,
        backgroundBlur: false
      };

      settingsState.advanced = {
        iceServers: 'stun:stun.l.google.com:19302',
        maxBitrate: 1000,
        simulcast: true,
        bandwidthEstimation: true,
        preferMediasoup: true,
        codecPreference: 'h264'
      };

      // Yerel depolamadan ayarları sil
      localStorage.removeItem('mediaSettings');

      // Sayfayı yenile
      window.location.reload();
    }
  });
}
