# Katkıda Bulunma Rehberi

Fisqos projesine katkıda bulunmak istediğiniz için teşekkür ederiz! Bu rehber, projeye katkıda bulunmak isteyenler için adım adım talimatlar içerir.

## Geliştirme Ortamı Kurulumu

1. Repoyu fork edin ve klonlayın:
   ```bash
   git clone https://github.com/[KULLANICI_ADINIZ]/fisqos.git
   cd fisqos
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env` dosyasını oluşturun:
   ```bash
   cp .env.example .env
   ```

4. Geliştirme modunda çalıştırın:
   ```bash
   npm run dev
   ```

## Kod Standartları

Bu projede aşağıdaki kod standartlarını kullanıyoruz:

- **TypeScript**: Tüm yeni kod TypeScript ile yazılmalıdır.
- **ESLint**: Kod kalitesini sağlamak için ESLint kullanıyoruz.
- **Prettier**: Kod formatını standartlaştırmak için Prettier kullanıyoruz.
- **Commit Mesajları**: [Conventional Commits](https://www.conventionalcommits.org/) formatını kullanıyoruz.

## Geliştirme İş Akışı

1. Yeni bir branch oluşturun:
   ```bash
   git checkout -b feature/[ÖZELLIK_ADI]
   ```

2. Değişikliklerinizi yapın ve test edin.

3. Kod kalitesini kontrol edin:
   ```bash
   npm run lint
   npm run typecheck
   ```

4. Değişikliklerinizi commit edin:
   ```bash
   git commit -m "feat: add amazing feature"
   ```

5. Branch'inizi push edin:
   ```bash
   git push origin feature/[ÖZELLIK_ADI]
   ```

6. GitHub üzerinden bir Pull Request oluşturun.

## Pull Request Süreci

1. PR başlığı ve açıklaması, değişiklikleri açıkça belirtmelidir.
2. PR, mevcut testleri geçmelidir.
3. Yeni özellikler için testler eklenmelidir.
4. Kod incelemesi gereklidir.
5. CI/CD kontrolleri geçmelidir.

## Testler

Yeni özellikler veya hata düzeltmeleri için testler yazın:

```bash
npm test
```

## Belgelendirme

- Kod içi belgelendirme için JSDoc kullanın.
- API değişiklikleri için README.md veya ilgili belgeleri güncelleyin.
- Karmaşık işlevler için açıklayıcı yorumlar ekleyin.

## Hata Raporlama

Bir hata bulduysanız, lütfen GitHub Issues üzerinden bir rapor oluşturun. Hata raporları şunları içermelidir:

- Hatanın açık bir açıklaması
- Hatayı yeniden oluşturmak için adımlar
- Beklenen davranış
- Gerçekleşen davranış
- Ekran görüntüleri (varsa)
- Ortam bilgileri (tarayıcı, işletim sistemi, vb.)

## Özellik İstekleri

Yeni bir özellik önermek için, GitHub Issues üzerinden bir istek oluşturun. Özellik istekleri şunları içermelidir:

- Özelliğin açık bir açıklaması
- Özelliğin neden gerekli olduğuna dair gerekçe
- Özelliğin nasıl uygulanabileceğine dair öneriler (varsa)

## İletişim

Sorularınız veya önerileriniz için:

- GitHub Issues
- E-posta: [info@fisqos.com.tr](mailto:info@fisqos.com.tr)

## Lisans

Katkıda bulunarak, katkılarınızın projenin lisansı altında yayınlanacağını kabul etmiş olursunuz.
