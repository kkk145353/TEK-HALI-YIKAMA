# Halı Yıkama Sitesi — Kurulum

## Neler var?
- **Müşteri sitesi** (`/`): Randevu Al (adresten alım) · Kendim Bırakacağım (adres + harita) · WhatsApp ile randevu · "Halım ne durumda?" kod sorgulama
- **Admin paneli** (`/admin`): aktif siparişler sırayla, teslimat kodu ile bulma, durum adımları, **Teslim edildi** denince Geçmiş Siparişler'e taşınır
- Teslimat kodu sistem tarafından **tek seferde** üretilir; site ve WhatsApp aynı kodu kullanır, kayıt anında admin paneline düşer.

## Dükkan bilgilerini değiştirme
`public/assets/config.js` dosyasında dükkan adı, telefon, WhatsApp numarası ve adres var. Sadece burayı değiştirin.

## Yayına alma (GitHub + Netlify)
1. GitHub'da yeni bir depo (repository) açın ve bu klasördeki **tüm dosyaları** yükleyin (`netlify.toml`, `package.json`, `lib`, `netlify`, `public`).
2. netlify.com → **Add new site → Import an existing project → GitHub** → depoyu seçin. Ayarlar `netlify.toml`'dan otomatik gelir, **Deploy**'a basın.
3. Netlify'da **Site configuration → Environment variables → Add a variable**:
   - Key: `ADMIN_SIFRE`
   - Value: admin paneli şifreniz (güçlü bir şifre seçin)
4. **Deploys → Trigger deploy → Deploy site** ile bir kez daha yayınlayın (şifrenin etkin olması için).
5. Site: `https://SITEADINIZ.netlify.app` — Admin: `https://SITEADINIZ.netlify.app/admin`

Randevular Netlify'ın kendi veri deposunda (Netlify Blobs) saklanır, ayrı bir veritabanı gerekmez.

> Not: Netlify'ın "sürükle-bırak" yüklemesi sadece sabit sayfaları yayınlar, randevu sistemi (sunucu fonksiyonu) çalışmaz. Bu yüzden GitHub bağlantısı ile kurun.

## Durum adımları
Randevu alındı → Teslim alındı → Yıkanıyor → Hazır → **Teslim edildi** (Geçmiş Siparişler)
Yanlışlıkla basılırsa geçmişteki siparişte başka bir adıma basarak geri alabilirsiniz.
