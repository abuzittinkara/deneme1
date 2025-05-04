// Oda Yönetimi
class RoomManager {
  constructor() {
    this.rooms = [];
    this.selectedRoom = null;
    this.roomListElement = document.getElementById('roomList');
    this.createRoomBtn = document.getElementById('createRoomBtn');
    this.roomModal = document.getElementById('roomModal');
    this.roomDetailModal = document.getElementById('roomDetailModal');
    
    this.init();
  }
  
  // Başlangıç
  init() {
    // Oda oluşturma butonuna tıklama olayı
    if (this.createRoomBtn) {
      this.createRoomBtn.addEventListener('click', () => this.showCreateRoomModal());
    }
    
    // Oda oluşturma modalı butonlarına tıklama olayları
    const createRoomModalBtn = document.getElementById('createRoomModalBtn');
    const closeRoomModalBtn = document.getElementById('closeRoomModalBtn');
    
    if (createRoomModalBtn) {
      createRoomModalBtn.addEventListener('click', () => this.createRoom());
    }
    
    if (closeRoomModalBtn) {
      closeRoomModalBtn.addEventListener('click', () => this.hideRoomModal());
    }
    
    // Oda detay modalı butonlarına tıklama olayları
    const closeRoomDetailModalBtn = document.getElementById('closeRoomDetailModalBtn');
    const editRoomBtn = document.getElementById('editRoomBtn');
    const deleteRoomBtn = document.getElementById('deleteRoomBtn');
    
    if (closeRoomDetailModalBtn) {
      closeRoomDetailModalBtn.addEventListener('click', () => this.hideRoomDetailModal());
    }
    
    if (editRoomBtn) {
      editRoomBtn.addEventListener('click', () => this.showEditRoomModal());
    }
    
    if (deleteRoomBtn) {
      deleteRoomBtn.addEventListener('click', () => this.deleteRoom());
    }
    
    // Odaları yükle
    this.loadRooms();
  }
  
  // Odaları yükle
  async loadRooms() {
    try {
      const response = await fetch('/api/rooms', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.rooms = data.data;
        this.renderRoomList();
      } else {
        console.error('Odalar yüklenirken bir hata oluştu:', data.message);
      }
    } catch (error) {
      console.error('Odalar yüklenirken bir hata oluştu:', error);
    }
  }
  
  // Oda listesini render et
  renderRoomList() {
    if (!this.roomListElement) return;
    
    this.roomListElement.innerHTML = '';
    
    if (this.rooms.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <div class="empty-state-icon">
          <span class="material-icons">meeting_room</span>
        </div>
        <div class="empty-state-text">
          <h3>Henüz oda yok</h3>
          <p>Yeni bir oda oluşturmak için "+" butonuna tıklayın.</p>
        </div>
      `;
      this.roomListElement.appendChild(emptyState);
      return;
    }
    
    this.rooms.forEach(room => {
      const roomElement = document.createElement('div');
      roomElement.className = 'room-item';
      roomElement.dataset.id = room._id;
      
      if (this.selectedRoom && this.selectedRoom._id === room._id) {
        roomElement.classList.add('active');
      }
      
      roomElement.innerHTML = `
        <div class="room-icon">
          <span class="material-icons">${room.isPrivate ? 'lock' : 'meeting_room'}</span>
        </div>
        <div class="room-info">
          <div class="room-name">${room.name}</div>
          <div class="room-description">${room.description || 'Açıklama yok'}</div>
        </div>
        <div class="room-actions">
          <button class="room-action-btn room-info-btn" title="Oda Bilgileri">
            <span class="material-icons">info</span>
          </button>
          ${room.owner === localStorage.getItem('userId') ? `
            <button class="room-action-btn room-edit-btn" title="Odayı Düzenle">
              <span class="material-icons">edit</span>
            </button>
            <button class="room-action-btn room-delete-btn" title="Odayı Sil">
              <span class="material-icons">delete</span>
            </button>
          ` : ''}
        </div>
      `;
      
      // Oda öğesine tıklama olayı
      roomElement.addEventListener('click', (e) => {
        if (!e.target.closest('.room-action-btn')) {
          this.selectRoom(room._id);
        }
      });
      
      // Oda bilgileri butonuna tıklama olayı
      const infoBtn = roomElement.querySelector('.room-info-btn');
      if (infoBtn) {
        infoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showRoomDetail(room._id);
        });
      }
      
      // Oda düzenleme butonuna tıklama olayı
      const editBtn = roomElement.querySelector('.room-edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showEditRoomModal(room._id);
        });
      }
      
      // Oda silme butonuna tıklama olayı
      const deleteBtn = roomElement.querySelector('.room-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteRoom(room._id);
        });
      }
      
      this.roomListElement.appendChild(roomElement);
    });
  }
  
  // Oda seç
  async selectRoom(roomId) {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.selectedRoom = data.data;
        
        // Aktif oda öğesini güncelle
        const roomItems = this.roomListElement.querySelectorAll('.room-item');
        roomItems.forEach(item => {
          item.classList.remove('active');
          if (item.dataset.id === roomId) {
            item.classList.add('active');
          }
        });
        
        // Oda kanallarını yükle
        this.loadRoomChannels();
      } else {
        console.error('Oda seçilirken bir hata oluştu:', data.message);
      }
    } catch (error) {
      console.error('Oda seçilirken bir hata oluştu:', error);
    }
  }
  
  // Oda kanallarını yükle
  loadRoomChannels() {
    if (!this.selectedRoom) return;
    
    // Kanal listesini temizle
    const channelList = document.getElementById('channelList');
    if (channelList) {
      channelList.innerHTML = '';
      
      // Kanalları listele
      this.selectedRoom.channels.forEach(channel => {
        const channelElement = document.createElement('div');
        channelElement.className = 'channel-item';
        channelElement.dataset.id = channel._id;
        channelElement.dataset.type = channel.type;
        
        channelElement.innerHTML = `
          <div class="channel-icon">
            <span class="material-icons">${channel.type === 'text' ? 'tag' : 'volume_up'}</span>
          </div>
          <div class="channel-name">${channel.name}</div>
        `;
        
        // Kanal öğesine tıklama olayı
        channelElement.addEventListener('click', () => {
          // Kanal seçme işlemi
          if (window.selectChannel) {
            window.selectChannel(channel._id);
          }
        });
        
        channelList.appendChild(channelElement);
      });
    }
  }
  
  // Oda oluşturma modalını göster
  showCreateRoomModal() {
    if (!this.roomModal) return;
    
    // Form alanlarını temizle
    const roomNameInput = document.getElementById('roomNameInput');
    const roomDescriptionInput = document.getElementById('roomDescriptionInput');
    const roomPrivateCheckbox = document.getElementById('roomPrivateCheckbox');
    const roomPasswordInput = document.getElementById('roomPasswordInput');
    
    if (roomNameInput) roomNameInput.value = '';
    if (roomDescriptionInput) roomDescriptionInput.value = '';
    if (roomPrivateCheckbox) roomPrivateCheckbox.checked = false;
    if (roomPasswordInput) {
      roomPasswordInput.value = '';
      roomPasswordInput.disabled = true;
    }
    
    // Modal başlığını güncelle
    const modalTitle = this.roomModal.querySelector('.room-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Yeni Oda Oluştur';
    }
    
    // Gönder butonunu güncelle
    const submitBtn = this.roomModal.querySelector('.form-submit');
    if (submitBtn) {
      submitBtn.textContent = 'Oluştur';
      submitBtn.onclick = () => this.createRoom();
    }
    
    // Modalı göster
    this.roomModal.style.display = 'flex';
  }
  
  // Oda düzenleme modalını göster
  showEditRoomModal(roomId) {
    if (!this.roomModal) return;
    
    // Düzenlenecek odayı bul
    const room = this.rooms.find(r => r._id === roomId);
    if (!room) return;
    
    // Form alanlarını doldur
    const roomNameInput = document.getElementById('roomNameInput');
    const roomDescriptionInput = document.getElementById('roomDescriptionInput');
    const roomPrivateCheckbox = document.getElementById('roomPrivateCheckbox');
    const roomPasswordInput = document.getElementById('roomPasswordInput');
    
    if (roomNameInput) roomNameInput.value = room.name;
    if (roomDescriptionInput) roomDescriptionInput.value = room.description || '';
    if (roomPrivateCheckbox) roomPrivateCheckbox.checked = room.isPrivate;
    if (roomPasswordInput) {
      roomPasswordInput.disabled = !room.isPrivate;
      roomPasswordInput.value = ''; // Şifreyi gösterme
    }
    
    // Modal başlığını güncelle
    const modalTitle = this.roomModal.querySelector('.room-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Odayı Düzenle';
    }
    
    // Gönder butonunu güncelle
    const submitBtn = this.roomModal.querySelector('.form-submit');
    if (submitBtn) {
      submitBtn.textContent = 'Güncelle';
      submitBtn.onclick = () => this.updateRoom(roomId);
    }
    
    // Modalı göster
    this.roomModal.style.display = 'flex';
  }
  
  // Oda modalını gizle
  hideRoomModal() {
    if (!this.roomModal) return;
    
    this.roomModal.style.display = 'none';
  }
  
  // Oda detaylarını göster
  async showRoomDetail(roomId) {
    if (!this.roomDetailModal) return;
    
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        const room = data.data;
        
        // Oda detaylarını doldur
        const roomNameElement = document.getElementById('roomDetailName');
        const roomDescriptionElement = document.getElementById('roomDetailDescription');
        const roomOwnerElement = document.getElementById('roomDetailOwner');
        const roomPrivateElement = document.getElementById('roomDetailPrivate');
        const roomMembersElement = document.getElementById('roomDetailMembers');
        const roomChannelsElement = document.getElementById('roomDetailChannels');
        
        if (roomNameElement) roomNameElement.textContent = room.name;
        if (roomDescriptionElement) roomDescriptionElement.textContent = room.description || 'Açıklama yok';
        if (roomOwnerElement) roomOwnerElement.textContent = room.owner.username;
        if (roomPrivateElement) roomPrivateElement.textContent = room.isPrivate ? 'Evet' : 'Hayır';
        
        // Üyeleri listele
        if (roomMembersElement) {
          roomMembersElement.innerHTML = '';
          
          if (room.members.length === 0) {
            roomMembersElement.innerHTML = '<div class="empty-text">Henüz üye yok</div>';
          } else {
            room.members.forEach(member => {
              const memberElement = document.createElement('div');
              memberElement.className = 'room-member-item';
              
              let role = 'Üye';
              if (room.owner._id === member._id) {
                role = 'Kurucu';
              } else if (room.moderators.some(mod => mod._id === member._id)) {
                role = 'Moderatör';
              }
              
              memberElement.innerHTML = `
                <div class="room-member-avatar">
                  ${member.username.substring(0, 2).toUpperCase()}
                </div>
                <div class="room-member-info">
                  <div class="room-member-name">${member.username}</div>
                  <div class="room-member-role">${role}</div>
                </div>
                ${room.owner._id === localStorage.getItem('userId') && member._id !== room.owner._id ? `
                  <div class="room-member-actions">
                    ${!room.moderators.some(mod => mod._id === member._id) ? `
                      <button class="room-member-action-btn make-mod-btn" title="Moderatör Yap" data-id="${member._id}">
                        <span class="material-icons">admin_panel_settings</span>
                      </button>
                    ` : `
                      <button class="room-member-action-btn remove-mod-btn" title="Moderatörlüğü Kaldır" data-id="${member._id}">
                        <span class="material-icons">remove_moderator</span>
                      </button>
                    `}
                    <button class="room-member-action-btn remove-member-btn" title="Üyeyi Çıkar" data-id="${member._id}">
                      <span class="material-icons">person_remove</span>
                    </button>
                  </div>
                ` : ''}
              `;
              
              // Moderatör yapma butonuna tıklama olayı
              const makeModBtn = memberElement.querySelector('.make-mod-btn');
              if (makeModBtn) {
                makeModBtn.addEventListener('click', () => this.addModerator(room._id, member._id));
              }
              
              // Moderatörlüğü kaldırma butonuna tıklama olayı
              const removeModBtn = memberElement.querySelector('.remove-mod-btn');
              if (removeModBtn) {
                removeModBtn.addEventListener('click', () => this.removeModerator(room._id, member._id));
              }
              
              // Üyeyi çıkarma butonuna tıklama olayı
              const removeMemberBtn = memberElement.querySelector('.remove-member-btn');
              if (removeMemberBtn) {
                removeMemberBtn.addEventListener('click', () => this.removeMember(room._id, member._id));
              }
              
              roomMembersElement.appendChild(memberElement);
            });
          }
        }
        
        // Kanalları listele
        if (roomChannelsElement) {
          roomChannelsElement.innerHTML = '';
          
          if (room.channels.length === 0) {
            roomChannelsElement.innerHTML = '<div class="empty-text">Henüz kanal yok</div>';
          } else {
            room.channels.forEach(channel => {
              const channelElement = document.createElement('div');
              channelElement.className = 'room-channel-item';
              channelElement.dataset.id = channel._id;
              
              channelElement.innerHTML = `
                <div class="room-channel-icon">
                  <span class="material-icons">${channel.type === 'text' ? 'tag' : 'volume_up'}</span>
                </div>
                <div class="room-channel-info">
                  <div class="room-channel-name">${channel.name}</div>
                  <div class="room-channel-type">${channel.type === 'text' ? 'Metin Kanalı' : 'Ses Kanalı'}</div>
                </div>
              `;
              
              // Kanal öğesine tıklama olayı
              channelElement.addEventListener('click', () => {
                this.hideRoomDetailModal();
                
                // Kanal seçme işlemi
                if (window.selectChannel) {
                  window.selectChannel(channel._id);
                }
              });
              
              roomChannelsElement.appendChild(channelElement);
            });
          }
        }
        
        // Düzenleme ve silme butonlarını göster/gizle
        const editRoomBtn = document.getElementById('editRoomBtn');
        const deleteRoomBtn = document.getElementById('deleteRoomBtn');
        
        if (editRoomBtn) {
          editRoomBtn.style.display = room.owner._id === localStorage.getItem('userId') ? 'block' : 'none';
        }
        
        if (deleteRoomBtn) {
          deleteRoomBtn.style.display = room.owner._id === localStorage.getItem('userId') ? 'block' : 'none';
        }
        
        // Modalı göster
        this.roomDetailModal.style.display = 'flex';
      } else {
        console.error('Oda detayları yüklenirken bir hata oluştu:', data.message);
      }
    } catch (error) {
      console.error('Oda detayları yüklenirken bir hata oluştu:', error);
    }
  }
  
  // Oda detay modalını gizle
  hideRoomDetailModal() {
    if (!this.roomDetailModal) return;
    
    this.roomDetailModal.style.display = 'none';
  }
  
  // Oda oluştur
  async createRoom() {
    try {
      const roomNameInput = document.getElementById('roomNameInput');
      const roomDescriptionInput = document.getElementById('roomDescriptionInput');
      const roomPrivateCheckbox = document.getElementById('roomPrivateCheckbox');
      const roomPasswordInput = document.getElementById('roomPasswordInput');
      
      if (!roomNameInput || !roomNameInput.value.trim()) {
        alert('Lütfen oda adını girin');
        return;
      }
      
      const roomData = {
        name: roomNameInput.value.trim(),
        description: roomDescriptionInput ? roomDescriptionInput.value.trim() : '',
        isPrivate: roomPrivateCheckbox ? roomPrivateCheckbox.checked : false,
        password: roomPrivateCheckbox && roomPrivateCheckbox.checked && roomPasswordInput ? roomPasswordInput.value : null
      };
      
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(roomData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Modalı gizle
        this.hideRoomModal();
        
        // Odaları yeniden yükle
        this.loadRooms();
        
        // Başarı mesajı göster
        alert('Oda başarıyla oluşturuldu');
      } else {
        console.error('Oda oluşturulurken bir hata oluştu:', data.message);
        alert(`Oda oluşturulurken bir hata oluştu: ${data.message}`);
      }
    } catch (error) {
      console.error('Oda oluşturulurken bir hata oluştu:', error);
      alert('Oda oluşturulurken bir hata oluştu');
    }
  }
  
  // Oda güncelle
  async updateRoom(roomId) {
    try {
      const roomNameInput = document.getElementById('roomNameInput');
      const roomDescriptionInput = document.getElementById('roomDescriptionInput');
      const roomPrivateCheckbox = document.getElementById('roomPrivateCheckbox');
      const roomPasswordInput = document.getElementById('roomPasswordInput');
      
      if (!roomNameInput || !roomNameInput.value.trim()) {
        alert('Lütfen oda adını girin');
        return;
      }
      
      const roomData = {
        name: roomNameInput.value.trim(),
        description: roomDescriptionInput ? roomDescriptionInput.value.trim() : '',
        isPrivate: roomPrivateCheckbox ? roomPrivateCheckbox.checked : false
      };
      
      // Şifre değiştirildiyse ekle
      if (roomPrivateCheckbox && roomPrivateCheckbox.checked && roomPasswordInput && roomPasswordInput.value) {
        roomData.password = roomPasswordInput.value;
      }
      
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(roomData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Modalı gizle
        this.hideRoomModal();
        
        // Odaları yeniden yükle
        this.loadRooms();
        
        // Başarı mesajı göster
        alert('Oda başarıyla güncellendi');
      } else {
        console.error('Oda güncellenirken bir hata oluştu:', data.message);
        alert(`Oda güncellenirken bir hata oluştu: ${data.message}`);
      }
    } catch (error) {
      console.error('Oda güncellenirken bir hata oluştu:', error);
      alert('Oda güncellenirken bir hata oluştu');
    }
  }
  
  // Oda sil
  async deleteRoom(roomId) {
    try {
      if (!confirm('Bu odayı silmek istediğinizden emin misiniz?')) {
        return;
      }
      
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Oda detay modalını gizle
        this.hideRoomDetailModal();
        
        // Odaları yeniden yükle
        this.loadRooms();
        
        // Başarı mesajı göster
        alert('Oda başarıyla silindi');
      } else {
        console.error('Oda silinirken bir hata oluştu:', data.message);
        alert(`Oda silinirken bir hata oluştu: ${data.message}`);
      }
    } catch (error) {
      console.error('Oda silinirken bir hata oluştu:', error);
      alert('Oda silinirken bir hata oluştu');
    }
  }
  
  // Moderatör ekle
  async addModerator(roomId, userId) {
    try {
      const response = await fetch(`/api/rooms/${roomId}/moderators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Oda detaylarını yeniden yükle
        this.showRoomDetail(roomId);
        
        // Başarı mesajı göster
        alert('Kullanıcı moderatör olarak eklendi');
      } else {
        console.error('Moderatör eklenirken bir hata oluştu:', data.message);
        alert(`Moderatör eklenirken bir hata oluştu: ${data.message}`);
      }
    } catch (error) {
      console.error('Moderatör eklenirken bir hata oluştu:', error);
      alert('Moderatör eklenirken bir hata oluştu');
    }
  }
  
  // Moderatörlüğü kaldır
  async removeModerator(roomId, userId) {
    try {
      const response = await fetch(`/api/rooms/${roomId}/moderators`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Oda detaylarını yeniden yükle
        this.showRoomDetail(roomId);
        
        // Başarı mesajı göster
        alert('Kullanıcının moderatörlüğü kaldırıldı');
      } else {
        console.error('Moderatörlük kaldırılırken bir hata oluştu:', data.message);
        alert(`Moderatörlük kaldırılırken bir hata oluştu: ${data.message}`);
      }
    } catch (error) {
      console.error('Moderatörlük kaldırılırken bir hata oluştu:', error);
      alert('Moderatörlük kaldırılırken bir hata oluştu');
    }
  }
  
  // Üye çıkar
  async removeMember(roomId, userId) {
    try {
      if (!confirm('Bu üyeyi odadan çıkarmak istediğinizden emin misiniz?')) {
        return;
      }
      
      const response = await fetch(`/api/rooms/${roomId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Oda detaylarını yeniden yükle
        this.showRoomDetail(roomId);
        
        // Başarı mesajı göster
        alert('Üye odadan çıkarıldı');
      } else {
        console.error('Üye çıkarılırken bir hata oluştu:', data.message);
        alert(`Üye çıkarılırken bir hata oluştu: ${data.message}`);
      }
    } catch (error) {
      console.error('Üye çıkarılırken bir hata oluştu:', error);
      alert('Üye çıkarılırken bir hata oluştu');
    }
  }
}

// Sayfa yüklendiğinde oda yöneticisini başlat
document.addEventListener('DOMContentLoaded', () => {
  window.roomManager = new RoomManager();
});
