/**
 * public/src/ts/microphoneHelper.ts
 * Mikrofon sorunlarını çözmek için yardımcı fonksiyonlar
 */

/**
 * Mikrofon sorunları için yardım modalını gösterir
 */
export function showMicrophoneHelp(): void {
  // Modal oluştur
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';

  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content microphone-help-modal">
      <h2>Mikrofon Sorunları</h2>

      <div class="help-section">
        <h3>Mikrofon Bulunamadı</h3>
        <p>Sistem mikrofonunuza erişemiyor. Lütfen şu adımları kontrol edin:</p>
        <ol>
          <li>Mikrofonunuzun bilgisayarınıza fiziksel olarak bağlı olduğundan emin olun.</li>
          <li>Kulaklık kullanıyorsanız, kulaklığınızın mikrofon özelliğinin açık olduğundan emin olun.</li>
          <li>Sistem ayarlarında mikrofonunuzun etkinleştirildiğinden emin olun:
            <ul>
              <li><strong>Windows:</strong> Ayarlar > Sistem > Ses > Giriş</li>
              <li><strong>macOS:</strong> Sistem Tercihleri > Ses > Giriş</li>
              <li><strong>Linux:</strong> Sistem Ayarları > Ses > Giriş</li>
            </ul>
          </li>
          <li>Başka bir uygulama mikrofonunuzu kullanıyorsa, o uygulamayı kapatın.</li>
          <li>Tarayıcınızı yeniden başlatın ve tekrar deneyin.</li>
        </ol>
      </div>

      <div class="help-section">
        <h3>Mikrofon İzni Reddedildi</h3>
        <p>Tarayıcınızda mikrofon izinlerini kontrol edin:</p>
        <ol>
          <li><strong>Chrome:</strong> Adres çubuğundaki kilit simgesine tıklayın > Site Ayarları > Mikrofon</li>
          <li><strong>Firefox:</strong> Adres çubuğundaki kilit simgesine tıklayın > İzinleri Düzenle > Mikrofon</li>
          <li><strong>Edge:</strong> Adres çubuğundaki kilit simgesine tıklayın > Site İzinleri > Mikrofon</li>
        </ol>
      </div>

      <div class="help-section">
        <h3>Mikrofonsuz Kullanım</h3>
        <p>Mikrofonunuz yoksa veya çalışmıyorsa, uygulamayı "Salt Dinleme" modunda kullanabilirsiniz:</p>
        <button id="enableListenOnlyMode" class="btn primary">Salt Dinleme Modunu Etkinleştir</button>
      </div>

      <div class="modal-buttons">
        <button id="closeMicHelpModal" class="btn secondary">Kapat</button>
      </div>
    </div>
  `;

  // Modalı sayfaya ekle
  document.body.appendChild(modal);

  // Kapatma düğmesi olayı
  const closeButton = modal.querySelector('#closeMicHelpModal');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      modal.remove();
    });
  }

  // Salt dinleme modu düğmesi olayı
  const listenOnlyButton = modal.querySelector('#enableListenOnlyMode');
  if (listenOnlyButton) {
    listenOnlyButton.addEventListener('click', () => {
      enableListenOnlyMode();
      modal.remove();
    });
  }
}

/**
 * Salt dinleme modunu etkinleştirir
 */
export function enableListenOnlyMode(): void {
  // Global değişkenleri güncelle
  (window as any).audioPermissionGranted = false;
  (window as any).micEnabled = false;
  (window as any).selfDeafened = true;

  // Kullanıcıya bilgi ver
  if (typeof (window as any).showToast === 'function') {
    (window as any).showToast(
      'Salt dinleme modu etkinleştirildi. Sizi duyamayacaklar ama siz diğerlerini duyabileceksiniz.',
      'info',
      5000
    );
  } else {
    alert(
      'Salt dinleme modu etkinleştirildi. Sizi duyamayacaklar ama siz diğerlerini duyabileceksiniz.'
    );
  }

  // Mikrofon durumunu güncelle
  if (typeof (window as any).applyAudioStates === 'function') {
    (window as any).applyAudioStates();
  }

  // Sunucuya bildir
  if ((window as any).socket) {
    (window as any).socket.emit('audioStateChanged', { micEnabled: false, selfDeafened: true });
  }
}

/**
 * Mikrofon cihazlarını listeler
 * @returns Mikrofon cihazları listesi
 */
export async function listAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    // MediaDevices API'sinin varlığını kontrol et
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      throw new Error('Bu tarayıcı cihaz listesine erişimi desteklemiyor.');
    }

    // Cihazları listele
    const devices = await navigator.mediaDevices.enumerateDevices();

    // Sadece mikrofon cihazlarını filtrele
    const audioInputDevices = devices.filter(device => device.kind === 'audioinput');

    return audioInputDevices;
  } catch (err) {
    console.error('Ses cihazları listelenirken hata oluştu:', err);
    return [];
  }
}

/**
 * Mikrofon izni istemeden önce kullanılabilir mikrofon olup olmadığını kontrol eder
 * @returns Mikrofon var mı
 */
export async function checkMicrophoneAvailability(): Promise<boolean> {
  try {
    const devices = await listAudioDevices();
    return devices.length > 0;
  } catch (err) {
    console.error('Mikrofon kontrolü sırasında hata:', err);
    return false;
  }
}

/**
 * Mikrofon izinlerini kontrol eder ve gerekirse izin ister
 * @returns Mikrofon izni verildi mi
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    // Önce mikrofon var mı kontrol et
    const hasMicrophone = await checkMicrophoneAvailability();
    if (!hasMicrophone) {
      console.warn('Kullanılabilir mikrofon bulunamadı');
      return false;
    }

    // Mikrofon izni iste
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // İzin alındı, akışı kapat
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Mikrofon izni alınamadı:', err);

    // Hata türüne göre farklı işlem yap
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        // Kullanıcı izin vermedi
        showMicrophoneHelp();
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        // Mikrofon bulunamadı
        showMicrophoneHelp();
      }
    }

    return false;
  }
}
