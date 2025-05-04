/**************************************
 * typingIndicator.ts
 * 
 * Bu modül, metin kanalı seçili iken kullanıcının 
 * metin giriş alanında (id="textChannelMessageInput") yazı yazdığını algılayıp, 
 * "X yazıyor..." göstergesini, yalnızca diğer kullanıcılara gösterecek şekilde çalışır.
 *
 * Yerel kullanıcı kendi yazarken ekranında typing göstergesi görünmez.
 * Socket üzerinden "typing" ve "stop typing" event'leri gönderilir; 
 * diğer istemciler (aynı text kanalda) bu event'leri aldığında ilgili kullanıcının adını kullanarak 
 * "X yazıyor…" mesajını gösterir.
 *
 * Kullanım:
 * import { initTypingIndicator } from './js/typingIndicator.js';
 * initTypingIndicator(socket, () => currentTextChannel, () => username);
 **************************************/

import { Socket } from 'socket.io-client';

interface TypingData {
  username: string;
  channel: string;
}

interface ChannelChangedEvent extends CustomEvent {
  detail: {
    newChannel: string;
  };
}

export function initTypingIndicator(
  socket: Socket, 
  getCurrentTextChannel: () => string, 
  getLocalUsername: () => string
): void {
  // Metin giriş alanını alıyoruz (input elementi)
  const inputField = document.getElementById('textChannelMessageInput') as HTMLInputElement;
  if (!inputField) {
    console.error("Text chat input field (id='textChannelMessageInput') bulunamadı!");
    return;
  }
  
  // Typing indicator için container: inputField'ın parent elementini kullanıyoruz
  let typingIndicator = document.getElementById('typingIndicator');
  if (!typingIndicator) {
    typingIndicator = document.createElement('div');
    typingIndicator.id = 'typingIndicator';
    // Konumlandırma: inputField'ın parent öğesinin position: relative olduğunu varsayarak absolute konumlandırıyoruz.
    typingIndicator.style.position = 'absolute';
    // inputField'ın hemen altında, 5px boşluk bırakacak şekilde konumlandırıyoruz.
    typingIndicator.style.top = "calc(100% + 5px)";
    typingIndicator.style.left = "10px";
    typingIndicator.style.fontSize = '0.9em';
    typingIndicator.style.color = '#aaa';
    // Başlangıçta görünmez olsun
    typingIndicator.style.visibility = 'hidden';
    // Indicator'ın bağlı olduğu kanal bilgisini saklamak için attribute ekliyoruz
    typingIndicator.setAttribute('data-channel', getCurrentTextChannel());
    
    if (inputField.parentElement) {
      inputField.parentElement.appendChild(typingIndicator);
    }
  }
  
  // Aktif kanalda diğer kullanıcıların typing eventlerini saklamak için bir set kullanıyoruz
  const activeTypers = new Set<string>();
  
  // Typing indicator'ı güncelleyen yardımcı fonksiyon
  function updateIndicator(): void {
    if (!typingIndicator) return;
    
    if (activeTypers.size > 0) {
      const names = Array.from(activeTypers).join(', ');
      typingIndicator.textContent = names + " yazıyor...";
      typingIndicator.style.visibility = 'visible';
    } else {
      typingIndicator.textContent = "";
      typingIndicator.style.visibility = 'hidden';
    }
  }
  
  // Diğer kullanıcılardan gelen typing eventlerini dinliyoruz
  socket.on('typing', (data: TypingData) => {
    // data: { username, channel }
    if (data.channel === getCurrentTextChannel() && data.username !== getLocalUsername()) {
      activeTypers.add(data.username);
      updateIndicator();
    }
  });
  
  socket.on('stop typing', (data: TypingData) => {
    if (data.channel === getCurrentTextChannel() && data.username !== getLocalUsername()) {
      activeTypers.delete(data.username);
      updateIndicator();
    }
  });
  
  // Yerel input alanındaki değişiklikleri dinliyoruz.
  // NOT: Yerel kullanıcı kendi typing event'lerini indicator'a eklemiyoruz.
  let typingInterval: number | null = null;
  
  inputField.addEventListener('input', () => {
    if (!typingIndicator) return;
    
    // Her input değişiminde indicator'ın bağlı olduğu kanal bilgisini güncelliyoruz.
    typingIndicator.setAttribute('data-channel', getCurrentTextChannel());
    const inputText = inputField.value.trim();
    
    if (inputText !== "") {
      socket.emit('typing', { username: getLocalUsername(), channel: getCurrentTextChannel() });
      
      if (!typingInterval) {
        typingInterval = window.setInterval(() => {
          if (inputField.value.trim() !== "") {
            socket.emit('typing', { username: getLocalUsername(), channel: getCurrentTextChannel() });
          } else {
            if (typingInterval !== null) {
              clearInterval(typingInterval);
              typingInterval = null;
            }
            socket.emit('stop typing', { username: getLocalUsername(), channel: getCurrentTextChannel() });
          }
        }, 2000);
      }
    } else {
      if (typingInterval !== null) {
        clearInterval(typingInterval);
        typingInterval = null;
      }
      socket.emit('stop typing', { username: getLocalUsername(), channel: getCurrentTextChannel() });
    }
  });
  
  // Fonksiyon: Kanal değişikliğini kontrol eder.
  // Eğer getCurrentTextChannel() değeri, indicator'ın mevcut "data-channel" attribute'undan farklıysa,
  // indicator güncellenir, aktif typing listesi temizlenir.
  function checkChannelChange(): void {
    if (!typingIndicator) return;
    
    const currentChannel = getCurrentTextChannel();
    if (typingIndicator.getAttribute('data-channel') !== currentChannel) {
      typingIndicator.setAttribute('data-channel', currentChannel);
      activeTypers.clear();
      updateIndicator();
    }
  }
  
  // Kanal değişikliğini düzenli olarak kontrol etmek için polling ekliyoruz (500ms aralıkla).
  setInterval(checkChannelChange, 500);
  
  // Ayrıca socket üzerinden veya global event üzerinden kanal değişikliğini dinlemeye çalışıyoruz:
  socket.on('updateCurrentChannel', (data: { channel: string }) => {
    if (!typingIndicator) return;
    
    if (data && data.channel) {
      typingIndicator.setAttribute('data-channel', data.channel);
      activeTypers.clear();
      updateIndicator();
    }
  });
  
  document.addEventListener('channelChanged', ((e: Event) => {
    if (!typingIndicator) return;
    
    const customEvent = e as ChannelChangedEvent;
    if (customEvent.detail && customEvent.detail.newChannel) {
      typingIndicator.setAttribute('data-channel', customEvent.detail.newChannel);
      activeTypers.clear();
      updateIndicator();
    }
  }) as EventListener);
}
