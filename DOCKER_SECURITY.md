# Docker Güvenlik İyileştirmeleri

Bu belge, Docker imajlarımızdaki güvenlik açıklarını gidermek için yaptığımız değişiklikleri açıklar.

## Güvenlik Açıkları

Önceki Docker yapılandırmamızda aşağıdaki güvenlik açıkları tespit edildi:

1. `node:18.20.0-alpine3.19` imajında 1 kritik ve 4 yüksek güvenlik açığı
2. `node:20.12.1-slim` imajında 3 yüksek güvenlik açığı
3. `node:20.13.1-bookworm-slim` imajında 3 yüksek güvenlik açığı

## Çözüm: Chainguard Distroless İmajı

Güvenlik açıklarını gidermek için Chainguard Distroless imajını kullanmaya karar verdik. Bu imaj, sıfır güvenlik açığı içeren minimal bir Node.js çalışma ortamı sağlar.

### Chainguard Distroless İmajı Nedir?

Chainguard Distroless imajları, sadece uygulamanızı çalıştırmak için gereken minimum bileşenleri içerir. Bu imajlarda:

- Kabuk (shell) yoktur
- Paket yöneticisi yoktur
- Gereksiz sistem araçları yoktur
- Sadece uygulamanızı çalıştırmak için gereken çalışma zamanı bileşenleri vardır

Bu minimalist yaklaşım, güvenlik açıklarının sayısını önemli ölçüde azaltır ve imaj boyutunu küçültür.

### Avantajları

1. **Sıfır Güvenlik Açığı**: Chainguard Distroless imajları, güvenlik açıklarını en aza indirmek için tasarlanmıştır.
2. **Küçük İmaj Boyutu**: Gereksiz bileşenler olmadığı için imaj boyutu küçüktür.
3. **Güvenli Varsayılan Ayarlar**: İmajlar, güvenli varsayılan ayarlarla gelir.
4. **Düzenli Güncellemeler**: Chainguard, imajları düzenli olarak günceller ve güvenlik yamaları uygular.

### Kullanım

Chainguard Distroless imajını kullanmak için çoklu aşamalı (multi-stage) bir Dockerfile oluşturduk:

1. İlk aşamada, `cgr.dev/chainguard/node:latest-dev` imajını kullanarak bağımlılıkları yüklüyoruz.
2. İkinci aşamada, `cgr.dev/chainguard/node:latest` imajını kullanarak sadece gerekli dosyaları kopyalıyoruz.

Bu yaklaşım, geliştirme araçlarını ve gereksiz bağımlılıkları son imajdan çıkararak güvenliği artırır.

## Yapılan Değişiklikler

1. Tüm Dockerfile'ları Chainguard Distroless imajını kullanacak şekilde güncelledik:
   - `Dockerfile.full`
   - `Dockerfile.prod`
   - `docker-demo/Dockerfile`

2. Çoklu aşamalı yapı kullanarak sadece gerekli dosyaları üretim imajına kopyaladık.

3. Root olmayan kullanıcı yapılandırmasını kaldırdık, çünkü Chainguard Distroless imajları zaten güvenli bir kullanıcı ile çalışır.

## Sonuç

Bu değişikliklerle Docker ortamımız artık daha güvenli ve optimize edilmiş durumda. Güvenlik açıklarını düzenli olarak kontrol etmek ve imajlarımızı güncel tutmak önemlidir.
