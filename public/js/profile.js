/**
 * public/js/profile.js
 * Profil sayfası işlevselliği
 */

// Socket.IO bağlantısı
const socket = io({
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
  forceNew: true
});

// Profil verileri
let profileData = {
  username: '',
  status: 'online',
  customStatus: '',
  bio: '',
  name: '',
  email: '',
  phone: '',
  joinDate: '',
  avatar: 'images/default-avatar.png'
};

// DOM elementleri
const profileUsername = document.getElementById('profileUsername');
const profileAvatar = document.getElementById('profileAvatar');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const customStatus = document.getElementById('customStatus');
const profileBio = document.getElementById('profileBio');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profileJoinDate = document.getElementById('profileJoinDate');

// Modal elementleri
const editProfileBtn = document.getElementById('editProfileBtn');
const editProfileModal = document.getElementById('editProfileModal');
const closeProfileModal = document.getElementById('closeProfileModal');
const cancelEditProfile = document.getElementById('cancelEditProfile');
const editProfileForm = document.getElementById('editProfileForm');
const editUsername = document.getElementById('editUsername');
const editStatus = document.getElementById('editStatus');
const editCustomStatus = document.getElementById('editCustomStatus');
const editBio = document.getElementById('editBio');
const editName = document.getElementById('editName');
const editEmail = document.getElementById('editEmail');
const editPhone = document.getElementById('editPhone');
const editProfileAvatarPreview = document.getElementById('editProfileAvatarPreview');
const avatarUpload = document.getElementById('avatarUpload');

// Sekme elementleri
const profileTabs = document.querySelectorAll('.profile-tab');
const profileTabContents = document.querySelectorAll('.profile-tab-content');

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  console.log('Profil sayfası yüklendi');

  // Socket.IO bağlantı olayları
  socket.on('connect', () => {
    console.log('Socket.IO bağlantısı kuruldu:', socket.id);
    loadProfileData();
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO bağlantısı kesildi');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO bağlantı hatası:', error);
  });

  // Profil düzenleme modalını aç
  editProfileBtn.addEventListener('click', () => {
    openEditProfileModal();
  });

  // Profil düzenleme modalını kapat
  closeProfileModal.addEventListener('click', () => {
    closeEditProfileModal();
  });

  cancelEditProfile.addEventListener('click', () => {
    closeEditProfileModal();
  });

  // Profil düzenleme formunu gönder
  editProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveProfileData();
  });

  // Profil fotoğrafı yükleme
  avatarUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        editProfileAvatarPreview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Sekme değiştirme
  profileTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Aktif sekmeyi değiştir
      profileTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Aktif içeriği değiştir
      const tabId = tab.getAttribute('data-tab');
      profileTabContents.forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });

  // Profil verilerini yükle
  loadProfileData();
});

/**
 * Profil verilerini yükler
 */
function loadProfileData() {
  // Gerçek uygulamada sunucudan veri alınır
  // Şimdilik örnek veri kullanıyoruz
  socket.emit('getUserProfile', (response) => {
    if (response && response.success) {
      profileData = response.profile;
    } else {
      // Örnek veri
      profileData = {
        username: 'admin',
        status: 'online',
        customStatus: 'Fisqos geliştiriyorum!',
        bio: 'Merhaba, ben Fisqos kullanıcısıyım. Bu platform üzerinde sesli, görüntülü ve yazılı iletişim kuruyorum.',
        name: 'Admin Kullanıcı',
        email: 'admin@example.com',
        phone: '+90 555 123 4567',
        joinDate: '01.01.2023',
        avatar: 'images/default-avatar.png'
      };
    }

    // Profil verilerini göster
    updateProfileUI();
  });
}

/**
 * Profil arayüzünü günceller
 */
function updateProfileUI() {
  // Profil bilgilerini güncelle
  profileUsername.textContent = profileData.username;
  profileAvatar.src = profileData.avatar;

  // Durum göstergesini güncelle
  statusIndicator.className = `status-indicator ${profileData.status}`;

  // Durum metnini güncelle
  switch (profileData.status) {
    case 'online':
      statusText.textContent = 'Çevrimiçi';
      break;
    case 'idle':
      statusText.textContent = 'Boşta';
      break;
    case 'dnd':
      statusText.textContent = 'Rahatsız Etmeyin';
      break;
    case 'invisible':
      statusText.textContent = 'Görünmez';
      break;
    default:
      statusText.textContent = 'Çevrimiçi';
  }

  // Özel durum metnini güncelle
  customStatus.textContent = profileData.customStatus || '';

  // Biyografiyi güncelle
  profileBio.textContent = profileData.bio || 'Henüz bir biyografi eklenmemiş.';

  // Kişisel bilgileri güncelle
  profileName.textContent = profileData.name || '-';
  profileEmail.textContent = profileData.email || '-';
  profilePhone.textContent = profileData.phone || '-';
  profileJoinDate.textContent = profileData.joinDate || '-';
}

/**
 * Profil düzenleme modalını açar
 */
function openEditProfileModal() {
  // Form alanlarını doldur
  editUsername.value = profileData.username;
  editStatus.value = profileData.status;
  editCustomStatus.value = profileData.customStatus || '';
  editBio.value = profileData.bio || '';
  editName.value = profileData.name || '';
  editEmail.value = profileData.email || '';
  editPhone.value = profileData.phone || '';
  editProfileAvatarPreview.src = profileData.avatar;

  // Modalı göster
  editProfileModal.style.display = 'block';
}

/**
 * Profil düzenleme modalını kapatır
 */
function closeEditProfileModal() {
  editProfileModal.style.display = 'none';
}

/**
 * Profil verilerini kaydeder
 */
function saveProfileData() {
  // Form verilerini al
  const updatedProfile = {
    status: editStatus.value,
    customStatus: editCustomStatus.value,
    bio: editBio.value,
    name: editName.value,
    email: editEmail.value,
    phone: editPhone.value
  };

  // Profil fotoğrafı değiştiyse
  if (editProfileAvatarPreview.src !== profileData.avatar) {
    updatedProfile.avatar = editProfileAvatarPreview.src;
  }

  // Sunucuya gönder
  socket.emit('updateProfile', updatedProfile, (response) => {
    if (response && response.success) {
      // Profil verilerini güncelle
      Object.assign(profileData, updatedProfile);

      // Arayüzü güncelle
      updateProfileUI();

      // Modalı kapat
      closeEditProfileModal();

      // Başarı mesajı göster
      alert('Profil başarıyla güncellendi.');
    } else {
      // Hata mesajı göster
      alert('Profil güncellenirken bir hata oluştu: ' + (response?.message || 'Bilinmeyen hata'));
    }
  });
}

// Modalın dışına tıklandığında kapat
window.addEventListener('click', (e) => {
  if (e.target === editProfileModal) {
    closeEditProfileModal();
  }
});
