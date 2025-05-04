/**
 * public/src/ts/friendRequests.ts
 * Arkadaşlık istekleri modülü
 * Arkadaşlık isteklerini gönderme, kabul etme, reddetme ve listeleme işlevlerini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Arkadaşlık isteği yanıtı arayüzü
interface FriendRequestResponse {
  success: boolean;
  message?: string;
  requests?: FriendRequest[];
  friends?: Friend[];
}

// Arkadaşlık isteği arayüzü
interface FriendRequest {
  from?: string;
  to?: string;
  status?: string;
  createdAt?: string;
}

// Arkadaş arayüzü
interface Friend {
  username: string;
  online?: boolean;
  status?: string;
  lastSeen?: string;
}

/**
 * Arkadaşlık istekleri özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initFriendRequests(socket: Socket): void {
  // Tüm seçili öğelerden "selected" sınıfını kaldıran yardımcı fonksiyon
  function removeSelectedStates(): void {
    const dmFriendsButtons = document.querySelectorAll('.dm-friends-button.selected');
    dmFriendsButtons.forEach(btn => btn.classList.remove('selected'));
    const selectedContentItems = document.querySelectorAll('.dm-content-item.selected');
    selectedContentItems.forEach(item => item.classList.remove('selected'));
  }

  // dmChannelTitle elementini alıyoruz (dmChannelTitle, dmContentArea ile birlikte dm modunda
  // üst kısımda yer alacak; dmPanel ise sabit DM listesi ve arama kutusunu barındıracak)
  const dmChannelTitle = document.getElementById('dmChannelTitle');
  if (!dmChannelTitle) {
    console.error('dmChannelTitle not found');
    return;
  }

  // DM içerik alanını oluşturan veya mevcut alanı döndüren yardımcı fonksiyon
  function ensureDmContentArea(): HTMLElement {
    let dmContentArea = document.getElementById('dmContentArea');
    if (!dmContentArea) {
      dmContentArea = document.createElement('div');
      dmContentArea.id = 'dmContentArea';
      dmContentArea.style.display = 'none';
      dmContentArea.style.flex = '1';
      dmContentArea.style.overflow = 'auto';

      // dmContentArea'yı main-content'e ekle
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(dmContentArea);
      }
    }
    return dmContentArea;
  }

  // DM içerik öğesi oluşturan yardımcı fonksiyon
  function createDmContentItem(text: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'dm-content-item';
    item.textContent = text;
    return item;
  }

  // Global event delegation: document üzerinde, dmChannelTitle içindeki dm-filter-item tıklamalarını yakalıyoruz.
  document.addEventListener('click', function (e: MouseEvent) {
    const target = e.target as HTMLElement;
    const dmTitleElem = target.closest('#dmChannelTitle');
    if (dmTitleElem && target.classList.contains('dm-filter-item')) {
      removeSelectedStates();
      const filter = target.getAttribute('data-filter');
      const dmContentArea = ensureDmContentArea();
      dmContentArea.style.display = 'block';
      dmContentArea.innerHTML = '';

      if (filter === 'add') {
        // Arkadaş ekleme formu
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'friendSearchInput';
        input.placeholder = 'Kullanıcı adı girin...';
        input.className = 'dm-search-input';

        const sendButton = document.createElement('button');
        sendButton.textContent = 'Arkadaşlık İsteği Gönder';
        sendButton.id = 'sendFriendRequestButton';
        sendButton.className = 'dm-send-request-btn';

        dmContentArea.appendChild(input);
        dmContentArea.appendChild(sendButton);

        function sendFriendRequest(): void {
          const targetUsername = input.value.trim();
          if (targetUsername === '') {
            return;
          }
          socket.emit(
            'sendFriendRequest',
            { to: targetUsername },
            (response: FriendRequestResponse) => {
              if (response.success) {
                alert('Arkadaşlık isteği gönderildi.');
                input.value = '';
              } else {
                alert('İstek gönderilemedi: ' + response.message);
              }
            }
          );
        }

        sendButton.addEventListener('click', sendFriendRequest);
        input.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            sendFriendRequest();
          }
        });
      } else if (filter === 'sent') {
        // Beklemede: Gelen ve gönderilen arkadaşlık isteklerini göster.
        socket.emit('getPendingFriendRequests', {}, (incomingResponse: FriendRequestResponse) => {
          socket.emit(
            'getOutgoingFriendRequests',
            {},
            (outgoingResponse: FriendRequestResponse) => {
              const incomingHeader = document.createElement('h3');
              incomingHeader.textContent = 'Gelen Arkadaşlık İstekleri';
              dmContentArea.appendChild(incomingHeader);

              if (
                incomingResponse.success &&
                Array.isArray(incomingResponse.requests) &&
                incomingResponse.requests.length > 0
              ) {
                const incomingList = document.createElement('ul');
                incomingResponse.requests.forEach(req => {
                  const li = document.createElement('li');
                  li.className = 'dm-content-item';
                  li.textContent = req.from || '';

                  const acceptBtn = document.createElement('button');
                  acceptBtn.className = 'friend-accept-btn';
                  acceptBtn.innerHTML =
                    '<span class="material-icons" style="color: green;">check</span>';
                  acceptBtn.addEventListener('click', () => {
                    socket.emit(
                      'acceptFriendRequest',
                      { from: req.from },
                      (resp: FriendRequestResponse) => {
                        if (resp.success) {
                          alert('Arkadaşlık isteği kabul edildi.');
                          li.remove();
                        } else {
                          alert('İstek kabul edilemedi: ' + resp.message);
                        }
                      }
                    );
                  });

                  const rejectBtn = document.createElement('button');
                  rejectBtn.className = 'friend-reject-btn';
                  rejectBtn.innerHTML =
                    '<span class="material-icons" style="color: red;">close</span>';
                  rejectBtn.addEventListener('click', () => {
                    socket.emit(
                      'rejectFriendRequest',
                      { from: req.from },
                      (resp: FriendRequestResponse) => {
                        if (resp.success) {
                          alert('Arkadaşlık isteği reddedildi.');
                          li.remove();
                        } else {
                          alert('İstek reddedilemedi: ' + resp.message);
                        }
                      }
                    );
                  });

                  li.appendChild(acceptBtn);
                  li.appendChild(rejectBtn);
                  incomingList.appendChild(li);
                });
                dmContentArea.appendChild(incomingList);
              } else {
                dmContentArea.appendChild(
                  createDmContentItem('Gelen arkadaşlık isteği bulunmuyor.')
                );
              }

              const outgoingHeader = document.createElement('h3');
              outgoingHeader.textContent = 'Gönderilen Arkadaşlık İstekleri';
              dmContentArea.appendChild(outgoingHeader);

              if (
                outgoingResponse.success &&
                Array.isArray(outgoingResponse.requests) &&
                outgoingResponse.requests.length > 0
              ) {
                const outgoingList = document.createElement('ul');
                outgoingResponse.requests.forEach(req => {
                  const li = document.createElement('li');
                  li.className = 'dm-content-item';
                  li.textContent = `To: ${req.to}`;
                  outgoingList.appendChild(li);
                });
                dmContentArea.appendChild(outgoingList);
              } else {
                dmContentArea.appendChild(
                  createDmContentItem('Gönderilen arkadaşlık isteği bulunmuyor.')
                );
              }
            }
          );
        });
      } else if (filter === 'all') {
        // Hepsi: Kabul edilmiş arkadaşları listele.
        socket.emit('getAcceptedFriendRequests', {}, (response: FriendRequestResponse) => {
          if (response.success && Array.isArray(response.friends)) {
            if (response.friends.length === 0) {
              dmContentArea.appendChild(createDmContentItem('Hiç arkadaşınız yok.'));
            } else {
              response.friends.forEach(friend => {
                const friendItem = document.createElement('div');
                friendItem.className = 'dm-content-item';
                friendItem.textContent = friend.username;
                friendItem.addEventListener('click', () => {
                  removeSelectedStates();
                  friendItem.classList.add('selected');
                  const selectedDMBar = document.getElementById('selectedDMBar');
                  if (selectedDMBar) {
                    selectedDMBar.innerHTML = '';
                    const h2 = document.createElement('h2');
                    h2.id = 'dmChannelTitle';
                    h2.className = 'dm-channel-title';
                    h2.textContent = friend.username;
                    selectedDMBar.appendChild(h2);
                  }

                  // Artık aktif DM sohbeti için yeni dmChat modülünü çağırıyoruz:
                  import('./dmChat')
                    .then(module => {
                      module.initDMChat(socket, friend.username);
                    })
                    .catch(err => console.error(err));
                });
                dmContentArea.appendChild(friendItem);
              });
            }
          } else {
            dmContentArea.appendChild(createDmContentItem('Arkadaşlar alınırken hata oluştu.'));
          }
        });
      } else if (filter === 'online') {
        // Çevrimiçi arkadaşları listele.
        socket.emit('getAcceptedFriendRequests', {}, (response: FriendRequestResponse) => {
          if (response.success && Array.isArray(response.friends)) {
            if (response.friends.length === 0) {
              dmContentArea.appendChild(createDmContentItem('Hiç arkadaşınız yok.'));
            } else {
              const onlineFriends = response.friends.filter(friend => friend.online);
              if (onlineFriends.length === 0) {
                dmContentArea.appendChild(createDmContentItem('Çevrimiçi hiç arkadaşınız yok.'));
              } else {
                onlineFriends.forEach(friend => {
                  const friendItem = document.createElement('div');
                  friendItem.className = 'dm-content-item';
                  friendItem.textContent = friend.username;
                  friendItem.addEventListener('click', () => {
                    removeSelectedStates();
                    friendItem.classList.add('selected');
                    const selectedDMBar = document.getElementById('selectedDMBar');
                    if (selectedDMBar) {
                      selectedDMBar.innerHTML = '';
                      const h2 = document.createElement('h2');
                      h2.id = 'dmChannelTitle';
                      h2.className = 'dm-channel-title';
                      h2.textContent = friend.username;
                      selectedDMBar.appendChild(h2);
                    }

                    import('./dmChat')
                      .then(module => {
                        module.initDMChat(socket, friend.username);
                      })
                      .catch(err => console.error(err));
                  });
                  dmContentArea.appendChild(friendItem);
                });
              }
            }
          } else {
            dmContentArea.appendChild(createDmContentItem('Arkadaşlar alınırken hata oluştu.'));
          }
        });
      } else if (filter === 'blocked') {
        // Engellenen arkadaşları listele.
        socket.emit('getBlockedFriends', {}, (response: FriendRequestResponse) => {
          if (response.success && Array.isArray(response.friends)) {
            if (response.friends.length === 0) {
              dmContentArea.appendChild(createDmContentItem('Engellenen arkadaş bulunmuyor.'));
            } else {
              response.friends.forEach(friend => {
                const friendItem = document.createElement('div');
                friendItem.className = 'dm-content-item';
                friendItem.textContent = friend.username;
                friendItem.addEventListener('click', () => {
                  removeSelectedStates();
                  friendItem.classList.add('selected');
                  const selectedDMBar = document.getElementById('selectedDMBar');
                  if (selectedDMBar) {
                    selectedDMBar.innerHTML = '';
                    const h2 = document.createElement('h2');
                    h2.id = 'dmChannelTitle';
                    h2.className = 'dm-channel-title';
                    h2.textContent = friend.username;
                    selectedDMBar.appendChild(h2);
                  }

                  import('./dmChat')
                    .then(module => {
                      module.initDMChat(socket, friend.username);
                    })
                    .catch(err => console.error(err));
                });
                dmContentArea.appendChild(friendItem);
              });
            }
          } else {
            dmContentArea.appendChild(
              createDmContentItem('Engellenen arkadaşlar alınırken hata oluştu.')
            );
          }
        });
      }
    }
  });

  // dmPanel'deki "Arkadaşlar" butonunun işlevi: dmPanel içeriğini render eder.
  const toggleDMButton = document.getElementById('toggleDMButton');
  if (toggleDMButton) {
    toggleDMButton.addEventListener('click', () => {
      removeSelectedStates();
      renderFriendList();
    });
  }

  /**
   * Varsayılan DM kanal başlığı HTML'ini döndürür
   * @returns HTML içeriği
   */
  function getDefaultDmChannelTitleHtml(): string {
    return `
      <span class="dm-title-text">Arkadaşlar</span>
      <span class="dm-divider"></span>
      <span class="dm-filter-item" data-filter="online">Çevrimiçi</span>
      <span class="dm-filter-item" data-filter="all">Hepsi</span>
      <span class="dm-filter-item" data-filter="sent">Beklemede</span>
      <span class="dm-filter-item" data-filter="blocked">Engellenen</span>
      <span class="dm-filter-item" data-filter="add">Arkadaş ekle</span>
    `;
  }

  /**
   * Arkadaş listesini render eder
   */
  function renderFriendList(): void {
    const dmPanel = document.getElementById('dmPanel');
    if (!dmPanel) {
      console.error('dmPanel not found');
      return;
    }

    dmPanel.style.padding = '0';
    dmPanel.innerHTML = '';

    const dmPanelHeader = document.createElement('div');
    dmPanelHeader.className = 'dm-panel-header';
    dmPanel.appendChild(dmPanelHeader);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Bir konuşma bulun veya başlatın...';
    searchInput.className = 'dm-search-input';
    searchInput.addEventListener('input', function () {
      const query = searchInput.value.toLowerCase();
      const friendItems = dmPanel.querySelectorAll('.dm-friend-item');
      friendItems.forEach(item => {
        const itemText = item.textContent || '';
        if (itemText.toLowerCase().indexOf(query) > -1) {
          (item as HTMLElement).style.display = 'block';
        } else {
          (item as HTMLElement).style.display = 'none';
        }
      });
    });

    dmPanelHeader.appendChild(searchInput);
    dmPanel.appendChild(dmPanelHeader);

    const friendsButton = document.createElement('button');
    friendsButton.innerHTML = '<span class="material-icons dm-group-icon">group</span>Arkadaşlar';
    friendsButton.className = 'dm-friends-button';
    friendsButton.addEventListener('click', () => {
      removeSelectedStates();
      friendsButton.classList.add('selected');
      const selectedDMBar = document.getElementById('selectedDMBar');
      if (selectedDMBar) {
        selectedDMBar.innerHTML = '';
        const h2 = document.createElement('h2');
        h2.id = 'dmChannelTitle';
        h2.className = 'dm-channel-title';
        h2.innerHTML = getDefaultDmChannelTitleHtml();
        selectedDMBar.appendChild(h2);
      }

      const dmContentArea = ensureDmContentArea();
      dmContentArea.innerHTML = '';
    });

    dmPanel.appendChild(friendsButton);

    socket.emit('getAcceptedFriendRequests', {}, (response: FriendRequestResponse) => {
      if (response.success && Array.isArray(response.friends)) {
        if (response.friends.length === 0) {
          const noFriends = document.createElement('div');
          noFriends.textContent = 'Hiç arkadaşınız yok.';
          noFriends.style.padding = '10px';
          dmPanel.appendChild(noFriends);
        } else {
          response.friends.forEach(friend => {
            const friendItem = createUserItem(friend.username, friend.online || false);
            friendItem.addEventListener('click', () => {
              removeSelectedStates();
              friendItem.classList.add('selected');
              const selectedDMBar = document.getElementById('selectedDMBar');
              if (selectedDMBar) {
                selectedDMBar.innerHTML = '';
                const h2 = document.createElement('h2');
                h2.id = 'dmChannelTitle';
                h2.className = 'dm-channel-title';
                h2.textContent = friend.username;
                selectedDMBar.appendChild(h2);
              }

              // Artık aktif DM sohbet arayüzü için dmChat modülünü çağırıyoruz.
              import('./dmChat')
                .then(module => {
                  module.initDMChat(socket, friend.username);
                })
                .catch(err => console.error(err));
            });

            dmPanel.appendChild(friendItem);
          });
        }
      } else {
        dmPanel.textContent = 'Arkadaşlar alınırken hata oluştu.';
      }
    });
  }

  /**
   * Kullanıcı öğesi oluşturur
   * @param username - Kullanıcı adı
   * @param isOnline - Çevrimiçi durumu
   * @returns Kullanıcı öğesi
   */
  function createUserItem(username: string, isOnline: boolean): HTMLElement {
    const userItem = document.createElement('div');
    userItem.classList.add('user-item', 'dm-friend-item');
    userItem.style.cursor = 'pointer';

    const avatar = document.createElement('img');
    avatar.classList.add('user-profile-pic');
    avatar.src = '/images/default-avatar.png';
    avatar.alt = '';

    const userNameSpan = document.createElement('span');
    userNameSpan.classList.add('user-name');
    userNameSpan.textContent = username;
    userNameSpan.style.marginLeft = '8px';

    userItem.appendChild(avatar);
    userItem.appendChild(userNameSpan);

    return userItem;
  }
}
