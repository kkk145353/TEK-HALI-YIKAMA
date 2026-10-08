(() => {
  const D = window.DUKKAN;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const telLink = "tel:" + D.telefon.replace(/[^\d+]/g, "");
  const haritaQ = encodeURIComponent(D.adres);
  const wa = (metin) => `https://wa.me/${D.whatsapp}?text=${encodeURIComponent(metin)}`;

  // ---- Dükkan bilgilerini yerleştir ----
  $$("[data-dukkan]").forEach((el) => (el.textContent = D[el.dataset.dukkan]));
  $$("[data-tel-link]").forEach((el) => (el.href = telLink));
  $$("[data-harita-link]").forEach((el) => (el.href = `https://www.google.com/maps/search/?api=1&query=${haritaQ}`));
  $$("[data-tarif-link]").forEach((el) => (el.href = `https://www.google.com/maps/dir/?api=1&destination=${haritaQ}`));
  $$("[data-wp-link]").forEach((el) => (el.href = wa("Merhaba, halı yıkama hakkında bilgi almak istiyorum.")));
  const iframe = $("[data-harita-embed]");

  // ---- Telefon numaraları (bir veya iki) ----
  const telefonlar = [D.telefon, D.telefon2].filter(Boolean);
  const telHref = (t) => "tel:" + t.replace(/[^\d+]/g, "");
  const telIkon = '<svg class="ik"><use href="#i-tel"/></svg>';
  $$("[data-tel-liste]").forEach((el) => {
    el.innerHTML = telefonlar.map((t) => `<a class="dukkan-tel" href="${telHref(t)}">${el.classList.contains("satir") ? "" : telIkon}<span>${t}</span></a>`).join("");
  });
  $$("[data-ara-butonlar]").forEach((el) => {
    el.innerHTML = telefonlar.map((t) => `<a class="btn btn-ana btn-kucuk" href="${telHref(t)}">${telIkon}${t.replace(/^\+90\s?/, "0")}</a>`).join("");
  });

  // ---- Fiyat listeleri ----
  const tl = (n) => n.toLocaleString("tr-TR") + " ₺";
  $$("[data-fiyat]").forEach((bolum) => {
    const liste = D.fiyatlar?.[bolum.dataset.fiyat] || [];
    if (!liste.length) return (bolum.hidden = true);
    const adrestenFiyat = Object.fromEntries((D.fiyatlar.randevu || []).map((x) => [x.ad, x.fiyat]));
    $(".fiyat-liste", bolum).innerHTML = liste.map((x) => {
      const eski = bolum.dataset.fiyat === "dukkan" && adrestenFiyat[x.ad] > x.fiyat ? `<s title="Adresten alım fiyatı">${tl(adrestenFiyat[x.ad])}</s>` : "";
      return `<li><span class="f-ad">${x.ad}</span><span class="f-fiyat">${eski}<b>${tl(x.fiyat)}</b><small>/ ${x.birim || "m²"}</small></span></li>`;
    }).join("");
  });

  // ---- Sekmeler ----
  function sekmeAc(ad) {
    $$(".secim-kart").forEach((b) => {
      const aktif = b.dataset.sekme === ad;
      b.classList.toggle("aktif", aktif);
      b.setAttribute("aria-selected", aktif);
    });
    $("#panel-randevu").hidden = ad !== "randevu";
    $("#panel-dukkan").hidden = ad !== "dukkan";
    if (ad === "dukkan" && !iframe.src) iframe.src = `https://maps.google.com/maps?q=${haritaQ}&z=16&output=embed`;
  }
  $$(".secim-kart").forEach((b) => b.addEventListener("click", () => sekmeAc(b.dataset.sekme)));
  if (location.hash === "#dukkan") sekmeAc("dukkan");

  // ---- Tarih: bugünden önce seçilemesin ----
  const bugun = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const tarihInput = $("#form-randevu [name=tarih]");
  tarihInput.min = bugun;

  const tarihYaz = (t) =>
    t ? new Date(t + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" }) : "";

  // ---- Form gönderimi ----
  function hataGoster(form, mesaj, alan) {
    const p = $(".form-hata", form);
    p.textContent = mesaj;
    p.hidden = !mesaj;
    $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
    if (alan) {
      const el = form.elements[alan];
      if (el && el.setAttribute) { el.setAttribute("aria-invalid", "true"); el.focus(); }
    }
  }

  function denetle(form, v) {
    if (v.ad.trim().length < 3) return ["Lütfen adınızı ve soyadınızı yazın.", "ad"];
    const t = v.telefon.replace(/\D/g, "");
    if (t.length < 10 || t.length > 13) return ["Lütfen geçerli bir telefon numarası yazın.", "telefon"];
    if (v.tur === "adres") {
      if (v.adres.trim().length < 10) return ["Lütfen açık adresinizi yazın.", "adres"];
      if (!v.tarih) return ["Lütfen alım tarihini seçin.", "tarih"];
      if (v.tarih < bugun) return ["Geçmiş bir tarih seçilemez.", "tarih"];
      if (!v.saat) return ["Lütfen bir saat aralığı seçin.", null];
    }
    return null;
  }

  function waMesaji(v, kod) {
    const satirlar = v.tur === "adres"
      ? ["Merhaba, halı yıkama randevusu almak istiyorum.", "", `Teslimat kodum: ${kod}`, `Ad Soyad: ${v.ad}`, `Telefon: ${v.telefon}`, `Adres: ${v.adres}`, `Alım: ${tarihYaz(v.tarih)}, ${v.saat}`]
      : ["Merhaba, halımı dükkana kendim bırakacağım.", "", `Teslimat kodum: ${kod}`, `Ad Soyad: ${v.ad}`, `Telefon: ${v.telefon}`];
    if (v.adres && v.tur !== "adres") satirlar.push(`Adres: ${v.adres}`);
    if (v.not) satirlar.push(`Not: ${v.not}`);
    return satirlar.join("\n");
  }

  async function gonder(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const kanal = e.submitter?.dataset.kanal || "site";
    const v = Object.fromEntries(new FormData(form));
    v.saat = v.saat || "";
    v.kanal = kanal;
    const sorun = denetle(form, v);
    if (sorun) return hataGoster(form, ...sorun);
    hataGoster(form, "");

    const butonlar = $$("button[type=submit]", form);
    butonlar.forEach((b) => (b.disabled = true));
    try {
      const r = await fetch("/api/randevu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(v),
      });
      const veri = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(veri.hata || "Bir sorun oluştu, lütfen tekrar deneyin.");
      try { localStorage.setItem("sonKod", JSON.stringify({ kod: veri.kod, tel4: v.telefon.replace(/\D/g, "").slice(-4) })); } catch {}
      kodEkle(veri.kod, v.telefon.replace(/\D/g, "").slice(-4));
      sonucGoster(v, veri.kod, kanal);
      form.reset();
      sonKoduGoster();
    } catch (err) {
      hataGoster(form, err.message === "Failed to fetch" ? "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin." : err.message);
    } finally {
      butonlar.forEach((b) => (b.disabled = false));
    }
  }
  $("#form-randevu").addEventListener("submit", gonder);
  $("#form-dukkan").addEventListener("submit", gonder);

  // ---- Sonuç penceresi ----
  const sonuc = $("#sonuc");
  let sonOdak = null;
  function sonucGoster(v, kod, kanal) {
    sonOdak = document.activeElement;
    $("#sonuc-kod").textContent = kod;
    const wpBtn = $("#sonuc-wp");
    wpBtn.href = wa(waMesaji(v, kod));
    if (kanal === "whatsapp") {
      $("#sonuc-baslik").textContent = "Son adım: WhatsApp'tan gönderin";
      $("#sonuc-alt").textContent = "Kodunuz oluşturuldu ve dükkana iletildi. Aşağıdaki butona basarak bilgilerinizi WhatsApp'tan da gönderin.";
      wpBtn.innerHTML = `<svg class="ik"><use href="#i-wp"/></svg>WhatsApp'ta Gönder`;
    } else {
      $("#sonuc-baslik").textContent = v.tur === "adres" ? "Randevunuz alındı" : "Kodunuz hazır";
      $("#sonuc-alt").textContent = "Halınızı teslim ederken bu kodu görevliye söyleyin.";
      wpBtn.innerHTML = `<svg class="ik"><use href="#i-wp"/></svg>Kodu WhatsApp'tan da Al`;
    }
    $("#sonuc-detay").textContent = v.tur === "adres"
      ? `${tarihYaz(v.tarih)}, ${v.saat} arasında adresinizden alınacak.`
      : `Halınızı ${D.adres} adresine bırakabilirsiniz. Gelmeden önce lütfen mutlaka arayın: ${telefonlar.join(" / ")}`;
    $("#kopyala").textContent = "Kodu kopyala";
    bildirimKutusu($("#sonuc-bildirim"), kod, v.telefon.replace(/\D/g, "").slice(-4));
    sonuc.hidden = false;
    document.body.style.overflow = "hidden";
    (kanal === "whatsapp" ? wpBtn : $("#sonuc-kapat")).focus();
  }
  function sonucKapat() {
    sonuc.hidden = true;
    document.body.style.overflow = "";
    sonOdak?.focus?.();
  }
  $("#sonuc-kapat").addEventListener("click", sonucKapat);
  sonuc.addEventListener("click", (e) => { if (e.target === sonuc) sonucKapat(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sonuc.hidden) sonucKapat(); });
  $("#kopyala").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#sonuc-kod").textContent); $("#kopyala").textContent = "Kopyalandı ✓"; }
    catch { $("#kopyala").textContent = "Kopyalanamadı"; }
  });

  // ---- Kod sorgulama ----
  const sorguForm = $("#form-sorgu");
  const sorguSonuc = $("#sorgu-sonuc");
  const ADIMLAR = [
    ["yeni", "Randevu alındı"],
    ["teslim_alindi", "Halı teslim alındı"],
    ["yikaniyor", "Yıkanıyor"],
    ["hazir", "Teslime hazır"],
    ["teslim_edildi", "Teslim edildi"],
  ];
  const zamanYaz = (iso) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  function sonKoduGoster() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem("sonKod")); } catch {}
    const kutu = $("#son-kod");
    if (!s?.kod) return (kutu.hidden = true);
    kutu.hidden = false;
    $("button", kutu).textContent = s.kod;
    $("button", kutu).onclick = () => {
      sorguForm.kod.value = s.kod;
      sorguForm.tel4.value = s.tel4 || "";
      sorguForm.requestSubmit();
    };
  }
  sonKoduGoster();

  // WhatsApp'tan gelen takip linki: /?kod=XXXXXX
  const urlKod = new URLSearchParams(location.search).get("kod");
  if (urlKod) {
    sorguForm.kod.value = urlKod.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    let s = null;
    try { s = JSON.parse(localStorage.getItem("sonKod")); } catch {}
    if (s?.kod === sorguForm.kod.value && s.tel4) {
      sorguForm.tel4.value = s.tel4;
      setTimeout(() => sorguForm.requestSubmit(), 0);
    }
    $("#sorgula").scrollIntoView({ block: "center" });
    if (!sorguForm.tel4.value) setTimeout(() => sorguForm.tel4.focus({ preventScroll: true }), 300);
  }

  sorguForm.kod.addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  sorguForm.tel4.addEventListener("input", (e) => (e.target.value = e.target.value.replace(/\D/g, "")));
  let sessiz = false;
  sorguForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const kod = sorguForm.kod.value.trim();
    const tel4 = sorguForm.tel4.value.trim();
    sorguSonuc.hidden = false;
    sorguSonuc.classList.remove("hatali");
    if (kod.length !== 6 || tel4.length !== 4) {
      sorguSonuc.classList.add("hatali");
      sorguSonuc.textContent = "6 haneli kodu ve telefonunuzun son 4 hanesini yazın.";
      return;
    }
    sorguSonuc.textContent = "Sorgulanıyor…";
    try {
      const r = await fetch(`/api/sorgula?kod=${encodeURIComponent(kod)}&tel4=${encodeURIComponent(tel4)}`);
      const v = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(v.hata || "Sorgulanamadı.");
      const zamanlar = Object.fromEntries((v.gecmis || []).map((g) => [g.durum, g.zaman]));
      const simdiki = ADIMLAR.findIndex(([k]) => k === v.durum);
      const satir = ADIMLAR.map(([k, ad], i) => {
        const cls = i < simdiki ? "tamam" : i === simdiki ? "tamam simdi" : "";
        const z = zamanlar[k] && i <= simdiki ? `<small>${zamanYaz(zamanlar[k])}</small>` : "";
        return `<li class="${cls}"><span class="nokta">${i <= simdiki ? '<svg class="ik" style="width:16px;height:16px"><use href="#i-tik"/></svg>' : ""}</span><span><b>${ad}</b>${z}</span></li>`;
      }).join("");
      const ust = v.tur === "adres" && v.tarih ? `<p style="color:var(--soluk)">Alım: ${tarihYaz(v.tarih)}, ${v.saat}</p>` : "";
      sorguSonuc.innerHTML = `<h3>Kod ${v.kod}: ${v.durumEtiket}</h3>${ust}<ol class="adimlar-zaman">${satir}</ol><div class="bildirim-kutu" hidden></div>`;
      if (v.durum !== "teslim_edildi") bildirimKutusu($(".bildirim-kutu", sorguSonuc), v.kod, tel4);
      kodEkle(v.kod, tel4);
    } catch (err) {
      if (sessiz) return;
      sorguSonuc.classList.add("hatali");
      sorguSonuc.textContent = err.message === "Failed to fetch" ? "Bağlantı kurulamadı." : err.message;
    }
  });

  // ---- Müşteriye telefon bildirimi (halının durumu değişince) ----
  const pushDestek = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const iosMu = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const anaEkranda = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const b64 = (s) => {
    const p = "=".repeat((4 - (s.length % 4)) % 4);
    return Uint8Array.from(atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  };
  const acikKodlar = () => { try { return JSON.parse(localStorage.getItem("bildirimKodlar")) || []; } catch { return []; } };
  const acikKodKaydet = (kodlar) => { try { localStorage.setItem("bildirimKodlar", JSON.stringify(kodlar)); } catch {} };
  async function mevcutAbonelik() {
    if (!pushDestek) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? reg.pushManager.getSubscription() : null;
  }
  async function bildirimAcikMi(kod) {
    if (!pushDestek || Notification.permission !== "granted" || !acikKodlar().includes(kod)) return false;
    return !!(await mevcutAbonelik().catch(() => null));
  }
  const zilIkon = '<svg class="ik"><use href="#i-zil"/></svg>';

  async function bildirimKutusu(kutu, kod, tel4) {
    if (!kutu) return;
    kutu.className = "bildirim-kutu";
    if (!pushDestek) {
      if (iosMu && !anaEkranda) {
        kutu.innerHTML = `<span class="bk-ikon">${zilIkon}</span><div><b>Durum bildirimi almak ister misiniz?</b><span>iPhone'da önce Safari'de <b>Paylaş → Ana Ekrana Ekle</b> yapın, siteyi ana ekrandaki simgeden açıp kodunuzu sorgulayın.</span></div>`;
        kutu.hidden = false;
      } else kutu.hidden = true;
      return;
    }
    if (Notification.permission === "denied") {
      kutu.classList.add("bk-kapali");
      kutu.innerHTML = `<span class="bk-ikon">${zilIkon}</span><div><b>Bildirimler kapalı</b><span>Bu telefonda bildirimler engellenmiş. Tarayıcı ayarlarından bu site için bildirimlere izin verebilirsiniz.</span></div>`;
      kutu.hidden = false;
      return;
    }
    if (await bildirimAcikMi(kod)) {
      kutu.classList.add("bk-acik");
      kutu.innerHTML = `<span class="bk-ikon">${zilIkon}</span><div><b>✓ Bildirimler açık</b><span>Halınız teslim alındığında, yıkanırken ve hazır olduğunda bu telefona bildirim gelecek.</span></div>`;
      kutu.hidden = false;
      return;
    }
    kutu.innerHTML = `<span class="bk-ikon">${zilIkon}</span><div><b>Halınızın durumunu bildirimle öğrenin</b><span>Teslim alındı, yıkanıyor, hazır… Her adımda telefonunuza bildirim gelsin.</span>
      <button type="button" class="btn btn-ana btn-kucuk bk-ac">🔔 Bildirimleri Aç</button></div>`;
    kutu.hidden = false;
    $(".bk-ac", kutu).addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Açılıyor…";
      try {
        const izin = await Notification.requestPermission();
        if (izin !== "granted") throw new Error("Bildirim izni verilmedi.");
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const r = await fetch("/api/bildirim/anahtar");
          const { anahtar } = await r.json();
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(anahtar) });
        }
        const r = await fetch("/api/bildirim/abone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kod, tel4, abonelik: sub.toJSON() }),
        });
        const v = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(v.hata || "Bildirim açılamadı.");
        acikKodKaydet([...new Set([...acikKodlar(), kod])].slice(-20));
      } catch (err) {
        alert(err.message === "Failed to fetch" ? "Bağlantı kurulamadı." : err.message);
      }
      bildirimKutusu(kutu, kod, tel4);
    });
  }

  // Bildirim gelince sayfa açıksa durumu tazele
  if (pushDestek) {
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.tip === "durum" && !sorguSonuc.hidden && sorguForm.kod.value === e.data.kod) {
        sessiz = true;
        sorguForm.requestSubmit();
        setTimeout(() => (sessiz = false), 3000);
      }
    });
  }

  // ---- Bildirimlerim (uygulama içi gelen kutusu) ----
  // Bu telefonda alınan/sorgulanan kodlar saklanır; durum geçmişleri sunucudan çekilip bildirim olarak listelenir.
  function kodlarim() {
    try { return JSON.parse(localStorage.getItem("kodlarim")) || []; } catch { return []; }
  }
  function kodlarimKaydet(liste) {
    try { localStorage.setItem("kodlarim", JSON.stringify(liste.slice(-10))); } catch {}
  }
  function kodEkle(kod, tel4) {
    if (!kod || !tel4) return;
    const liste = kodlarim().filter((x) => x.kod !== kod);
    liste.push({ kod, tel4 });
    kodlarimKaydet(liste);
    setTimeout(bildirimleriYukle, 500);
  }
  // Önceki sürümden kalan son kodu listeye taşı
  if (!kodlarim().length) {
    try { const s = JSON.parse(localStorage.getItem("sonKod")); if (s?.kod && s?.tel4) kodlarimKaydet([s]); } catch {}
  }

  const MESAJLAR = {
    teslim_alindi: () => ["Halınızı teslim aldık 🧺", "Dükkanımıza ulaştı, yıkama sırasına alındı."],
    yikaniyor: () => ["Halınız yıkanıyor 🫧", "Yıkaması başladı, bitince haber vereceğiz."],
    hazir: (tur) => ["Halınız teslime hazır ✨", tur === "adres" ? "Tertemiz oldu. Teslimat için sizinle iletişime geçeceğiz." : "Tertemiz oldu. Dükkanımızdan alabilirsiniz, gelmeden önce arayın."],
    teslim_edildi: () => ["Halınız teslim edildi 🙏", "Bizi tercih ettiğiniz için teşekkür ederiz."],
  };
  const mZil = $("#m-zil");
  const mPanel = $("#m-zil-panel");
  let mBildirimler = [];
  let vurguEsik = null; // panel açıkken, açılmadan önce okunmamış olanlar vurgulu kalsın
  const okunduZamani = () => { try { return localStorage.getItem("bildirimOkundu") || ""; } catch { return ""; } };
  const okunmamisSayisi = () => mBildirimler.filter((b) => b.zaman > okunduZamani()).length;

  async function bildirimleriYukle() {
    const kodlar = kodlarim();
    const sonuclar = await Promise.all(kodlar.map(async ({ kod, tel4 }) => {
      try {
        const r = await fetch(`/api/sorgula?kod=${encodeURIComponent(kod)}&tel4=${encodeURIComponent(tel4)}`);
        if (r.status === 404) return { silindi: kod };
        return r.ok ? await r.json() : null;
      } catch { return null; }
    }));
    const silinen = sonuclar.filter((x) => x?.silindi).map((x) => x.silindi);
    if (silinen.length) kodlarimKaydet(kodlar.filter((k) => !silinen.includes(k.kod)));
    mBildirimler = sonuclar
      .filter((v) => v && !v.silindi)
      .flatMap((v) => (v.gecmis || []).filter((g) => MESAJLAR[g.durum]).map((g) => ({ kod: v.kod, tur: v.tur, durum: g.durum, zaman: g.zaman })))
      .sort((a, b) => b.zaman.localeCompare(a.zaman))
      .slice(0, 30);
    mZilCiz();
    if (!mPanel.hidden) mPanelCiz(false);
  }

  function mZilCiz() {
    const n = okunmamisSayisi();
    const sayi = $("#m-zil-sayi");
    sayi.textContent = n > 9 ? "9+" : n;
    sayi.hidden = !n;
    mZil.setAttribute("aria-label", n ? `Bildirimler (${n} okunmamış)` : "Bildirimler");
    window.Rozet?.ayarla("musteri", n);
  }

  function mPanelCiz(okunduYap) {
    const okundu = vurguEsik ?? okunduZamani();
    $("#m-zil-liste").innerHTML = mBildirimler.length
      ? mBildirimler.map((b) => {
          const [baslik, metin] = MESAJLAR[b.durum](b.tur);
          return `<button type="button" class="zil-oge${b.zaman > okundu ? " okunmamis" : ""}" data-kod="${b.kod}">
            <span class="kod-rozet">${b.kod}</span><b>${baslik}</b><small>${metin} · ${zamanYaz(b.zaman)}</small></button>`;
        }).join("")
      : `<p class="zil-bos">${kodlarim().length ? "Henüz bildirim yok. Halınız teslim alındığında, yıkanırken ve hazır olduğunda burada görünecek." : "Randevu aldığınızda halınızın durum bildirimleri burada görünür."}</p>`;
    const son = kodlarim().slice(-1)[0];
    if (son) bildirimKutusu($("#m-zil-izin"), son.kod, son.tel4);
    else $("#m-zil-izin").hidden = true;
    if (okunduYap && mBildirimler.length) {
      try { localStorage.setItem("bildirimOkundu", new Date().toISOString()); } catch {}
      setTimeout(mZilCiz, 400);
      // Bildirim çubuğundaki durum bildirimlerini temizle
      if (pushDestek) navigator.serviceWorker.getRegistration("/").then((reg) => reg?.getNotifications()).then((liste) => (liste || []).forEach((n) => n.data?.tip === "durum" && n.close())).catch(() => {});
    }
  }

  function mPanelAc() {
    vurguEsik = okunduZamani();
    mPanel.hidden = false;
    mZil.setAttribute("aria-expanded", "true");
    mPanelCiz(true);
    bildirimleriYukle();
  }
  function mPanelKapat() {
    mPanel.hidden = true;
    vurguEsik = null;
    mZil.setAttribute("aria-expanded", "false");
    $$(".zil-oge.okunmamis", mPanel).forEach((el) => el.classList.remove("okunmamis"));
  }
  mZil.addEventListener("click", () => (mPanel.hidden ? mPanelAc() : mPanelKapat()));
  $("#m-zil-kapat").addEventListener("click", mPanelKapat);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !mPanel.hidden) mPanelKapat(); });
  document.addEventListener("click", (e) => { if (!mPanel.hidden && !mPanel.contains(e.target) && !mZil.contains(e.target)) mPanelKapat(); });
  $("#m-zil-liste").addEventListener("click", (e) => {
    const oge = e.target.closest("[data-kod]");
    if (!oge) return;
    const k = kodlarim().find((x) => x.kod === oge.dataset.kod);
    mPanelKapat();
    sorguForm.kod.value = oge.dataset.kod;
    sorguForm.tel4.value = k?.tel4 || "";
    sorguForm.requestSubmit();
    $("#sorgula").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  bildirimleriYukle();
  setInterval(() => document.visibilityState === "visible" && bildirimleriYukle(), 60000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && bildirimleriYukle());
  if (pushDestek) navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.tip === "durum") bildirimleriYukle(); });
})();
