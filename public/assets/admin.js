(() => {
  const D = window.DUKKAN;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  $$("[data-dukkan]").forEach((el) => (el.textContent = D[el.dataset.dukkan]));

  const ADIMLAR = [
    ["yeni", "Randevu alındı"],
    ["teslim_alindi", "Teslim alındı"],
    ["yikaniyor", "Yıkanıyor"],
    ["hazir", "Hazır"],
    ["teslim_edildi", "Teslim edildi"],
  ];
  const ETIKET = Object.fromEntries(ADIMLAR);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const bugun = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const yerelGun = (iso) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const tarihYaz = (t) => new Date(t + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" });
  const zamanYaz = (iso) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  let sifre = "";
  try { sifre = localStorage.getItem("adminSifre") || ""; } catch {}
  let kayitlar = [];
  let sekme = "aktif";
  let vurgulu = null;
  let esik = null; // bu tarihten sonra gelenler "YENİ" sayılır (zil rozeti)
  try { esik = localStorage.getItem("sonGorulme"); } catch {}
  if (!esik) { esik = new Date().toISOString(); try { localStorage.setItem("sonGorulme", esik); } catch {} }
  let bilinenKodlar = null;

  // ---- API ----
  async function api(yol, govde) {
    const r = await fetch("/api/admin/" + yol, {
      method: govde ? "POST" : "GET",
      headers: { "x-admin-sifre": sifre, ...(govde ? { "content-type": "application/json" } : {}) },
      body: govde ? JSON.stringify(govde) : undefined,
    });
    const v = await r.json().catch(() => ({}));
    if (r.status === 401) { cikis(); throw new Error(v.hata || "Şifre hatalı."); }
    if (!r.ok) throw new Error(v.hata || "Bir sorun oluştu.");
    return v;
  }

  function bildir(m) {
    $(".bildirim")?.remove();
    const d = document.createElement("div");
    d.className = "bildirim";
    d.setAttribute("role", "status");
    d.textContent = m;
    document.body.append(d);
    setTimeout(() => d.remove(), 3000);
  }

  // ---- Giriş / çıkış ----
  const girisForm = $("#form-giris");
  girisForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    sifre = girisForm.sifre.value;
    const hata = $(".form-hata", girisForm);
    hata.hidden = true;
    try {
      await api("kontrol");
      try { localStorage.setItem("adminSifre", sifre); } catch {}
      panelAc();
    } catch (err) {
      hata.textContent = err.message === "Failed to fetch" ? "Sunucuya ulaşılamadı." : err.message;
      hata.hidden = false;
      $("#giris").hidden = false;
      $("#panel").hidden = true;
    }
  });
  function cikis() {
    sifre = "";
    try { localStorage.removeItem("adminSifre"); } catch {}
    $("#panel").hidden = true;
    $("#giris").hidden = false;
    girisForm.sifre.value = "";
  }
  $("#cikis").addEventListener("click", cikis);

  let zamanlayici;
  function panelAc() {
    $("#giris").hidden = true;
    $("#panel").hidden = false;
    yukle();
    clearInterval(zamanlayici);
    zamanlayici = setInterval(() => document.visibilityState === "visible" && yukle(true), 20000);
    aboneligiTazele();
    seritCiz();
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && sifre && !$("#panel").hidden) yukle(true); });

  // ---- Veri ----
  async function yukle(sessiz) {
    const btn = $("#yenile");
    btn.disabled = true;
    try {
      const v = await api("liste");
      kayitlar = v.kayitlar;
      const kodlar = new Set(kayitlar.map((k) => k.kod));
      if (bilinenKodlar) {
        const yeni = kayitlar.filter((k) => !bilinenKodlar.has(k.kod));
        if (yeni.length) {
          bildir(`🔔 ${yeni.length} yeni randevu geldi`);
          cal();
          const z = $("#zil");
          z.classList.remove("cinliyor"); void z.offsetWidth; z.classList.add("cinliyor");
        }
      }
      bilinenKodlar = kodlar;
      $("#guncelleme").textContent = "Güncellendi " + new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      ciz();
    } catch (err) {
      if (!sessiz && sifre) bildir(err.message === "Failed to fetch" ? "Sunucuya ulaşılamadı." : err.message);
    } finally {
      btn.disabled = false;
    }
  }
  $("#yenile").addEventListener("click", () => yukle());

  const siraAnahtari = (k) => (k.tarih || yerelGun(k.olusturma)) + (k.saat || "99") + k.olusturma;

  function ciz() {
    const aktif = kayitlar.filter((k) => k.durum !== "teslim_edildi").sort((a, b) => siraAnahtari(a).localeCompare(siraAnahtari(b)));
    const gecmis = kayitlar.filter((k) => k.durum === "teslim_edildi").sort((a, b) => (b.teslimEdildi || "").localeCompare(a.teslimEdildi || ""));

    $("#o-yeni").textContent = aktif.filter((k) => k.durum === "yeni").length;
    $("#o-islem").textContent = aktif.filter((k) => k.durum === "teslim_alindi" || k.durum === "yikaniyor").length;
    $("#o-hazir").textContent = aktif.filter((k) => k.durum === "hazir").length;
    $("#o-bugun").textContent = gecmis.filter((k) => k.teslimEdildi && yerelGun(k.teslimEdildi) === bugun).length;
    $("#s-aktif").textContent = aktif.length;
    $("#s-gecmis").textContent = gecmis.length;
    const yeniSayi = aktif.filter((k) => k.olusturma > esik).length;
    document.title = (yeniSayi ? `(${yeniSayi}) ` : "") + "Yönetim Paneli · " + D.ad;
    $("#zil-sayi").textContent = yeniSayi > 99 ? "99+" : yeniSayi;
    $("#zil-sayi").hidden = !yeniSayi;
    try { navigator.setAppBadge?.(yeniSayi || undefined); if (!yeniSayi) navigator.clearAppBadge?.(); } catch {}
    if (!$("#zil-panel").hidden) zilListeCiz();

    const q = $("#ara").value.trim().toLocaleLowerCase("tr");
    const qRakam = q.replace(/\D/g, "");
    const f = $("#filtre").value;
    const kaynak = sekme === "aktif" ? aktif : gecmis;
    const gorunen = kaynak
      .map((k, i) => [k, i + 1])
      .filter(([k]) => (!f || k.tur === f) && (!q ||
        [k.ad, k.adres, k.kod, k.not].join(" ").toLocaleLowerCase("tr").includes(q) ||
        (qRakam.length >= 3 && k.telefonRakam.includes(qRakam))));

    const liste = $("#liste");
    if (!gorunen.length) {
      liste.innerHTML = `<div class="liste-bos">${q || f ? "Aramanıza uygun sipariş yok." : sekme === "aktif" ? "Şu an aktif sipariş yok. Yeni randevular burada sırayla görünecek." : "Teslim edilen siparişler burada listelenir."}</div>`;
    } else {
      liste.innerHTML = gorunen.map(([k, sira]) => kart(k, sira)).join("");
    }
    // kod kutusundaki kartı tazele
    if (vurgulu) kodSonucCiz(vurgulu);
  }

  function kart(k, sira) {
    const telRakam = k.telefonRakam.startsWith("0") ? "9" + k.telefonRakam : k.telefonRakam.length === 10 ? "90" + k.telefonRakam : k.telefonRakam;
    const haritaUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(k.adres);
    const simdiki = ADIMLAR.findIndex(([d]) => d === k.durum);
    const rozetler = [
      k.tur === "adres" ? '<span class="rozet r-adres">Adresten alınacak</span>' : '<span class="rozet r-dukkan">Dükkana getirecek</span>',
      k.kanal === "whatsapp" ? '<span class="rozet r-wp">WhatsApp</span>' : '<span class="rozet">Site</span>',
      k.durum === "yeni" && k.tarih === bugun ? '<span class="rozet r-bugun">Bugün</span>' : "",
      k.durum !== "teslim_edildi" && k.olusturma > esik ? '<span class="rozet r-yeni">YENİ</span>' : "",
    ].join("");
    const satirlar = [
      ["Telefon", `<span class="tel-sira"><a href="tel:+${esc(telRakam)}">${esc(k.telefon)}</a><a href="https://wa.me/${esc(telRakam)}" target="_blank" rel="noopener" style="color:var(--wp)">WhatsApp</a></span>`],
      k.adres ? ["Adres", `<a href="${haritaUrl}" target="_blank" rel="noopener" style="font-weight:500;color:var(--murekkep);text-decoration:underline;text-decoration-color:var(--cizgi)">${esc(k.adres)}</a>`] : null,
      k.tarih ? ["Alım", `<b>${esc(tarihYaz(k.tarih))}</b> · ${esc(k.saat)}`] : null,
      k.not ? ["Not", esc(k.not)] : null,
      ["Kayıt", esc(zamanYaz(k.olusturma))],
      k.teslimEdildi ? ["Teslim", esc(zamanYaz(k.teslimEdildi))] : null,
    ].filter(Boolean);
    const solSatirlar = satirlar.slice(0, 1).concat(satirlar.filter(([b]) => b === "Alım" || b === "Kayıt" || b === "Teslim"));
    const sagSatirlar = satirlar.filter(([b]) => b === "Adres" || b === "Not");
    const dl = (arr) => `<dl class="s-bilgi">${arr.map(([b, d]) => `<dt>${b}</dt><dd>${d}</dd>`).join("")}</dl>`;

    const butonlar = ADIMLAR.map(([d, ad], i) =>
      `<button type="button" data-kod="${k.kod}" data-durum="${d}" class="${i < simdiki ? "gecti" : i === simdiki ? "simdi" : ""}" ${i === simdiki ? 'aria-current="step"' : ""}>${ad}</button>`
    ).join("");

    return `<article class="siparis d-${k.durum}${vurgulu === k.kod ? " vurgulu" : ""}" data-kart="${k.kod}">
      <div class="s-ust"><span class="sira">#${sira}</span><span class="kod-rozet">${k.kod}</span>${rozetler}</div>
      <div class="s-govde"><h3>${esc(k.ad)}</h3>${dl(solSatirlar)}${sagSatirlar.length ? dl(sagSatirlar) : ""}</div>
      <div class="s-alt"><div class="durum-adim" role="group" aria-label="Durum">${butonlar}</div>
        <div class="s-sag"><button type="button" class="btn btn-wp-hafif btn-kucuk" data-yaz="${k.kod}"><svg class="ik"><use href="#i-wp"/></svg>Müşteriye bildir</button>
        <button type="button" class="btn btn-tehlike btn-kucuk" data-sil="${k.kod}">Sil</button></div></div>
    </article>`;
  }

  // ---- Durum değiştir / sil ----
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-durum]");
    if (b) {
      const k = kayitlar.find((x) => x.kod === b.dataset.kod);
      if (!k || k.durum === b.dataset.durum) return;
      if (b.dataset.durum === "teslim_edildi" && !confirm(`${k.kod} — ${k.ad}\n\nTeslim edildi olarak işaretlensin mi? Sipariş "Geçmiş Siparişler" bölümüne taşınacak.`)) return;
      const kartEl = b.closest(".siparis");
      kartEl.classList.add("yukleniyor");
      try {
        const v = await api("durum", { kod: k.kod, durum: b.dataset.durum });
        Object.assign(k, v.kayit);
        if (!v.kayit.teslimEdildi) delete k.teslimEdildi;
        bildir(`${k.kod}: ${ETIKET[k.durum]}${k.durum === "teslim_edildi" ? " — geçmişe taşındı" : ""}`);
        ciz();
        musteriBildirAc(k, true);
      } catch (err) {
        bildir(err.message);
        kartEl.classList.remove("yukleniyor");
      }
      return;
    }
    const y = e.target.closest("[data-yaz]");
    if (y) {
      const k = kayitlar.find((x) => x.kod === y.dataset.yaz);
      if (k) musteriBildirAc(k, false);
      return;
    }
    const s = e.target.closest("[data-sil]");
    if (s) {
      const k = kayitlar.find((x) => x.kod === s.dataset.sil);
      if (!k || !confirm(`${k.kod} — ${k.ad}\n\nBu kayıt kalıcı olarak silinsin mi?`)) return;
      try {
        await api("sil", { kod: k.kod });
        kayitlar = kayitlar.filter((x) => x.kod !== k.kod);
        if (vurgulu === k.kod) { vurgulu = null; $("#kod-sonuc").innerHTML = ""; }
        bildir(`${k.kod} silindi`);
        ciz();
      } catch (err) { bildir(err.message); }
    }
  });

  // ---- Sekme, arama, filtre ----
  $$(".sekmeler button").forEach((b) => b.addEventListener("click", () => {
    sekme = b.dataset.sekme;
    $$(".sekmeler button").forEach((x) => x.classList.toggle("aktif", x === b));
    ciz();
  }));
  $("#ara").addEventListener("input", ciz);
  $("#filtre").addEventListener("change", ciz);

  // ---- Kod ile bul ----
  const kodForm = $("#form-kod");
  kodForm.kod.addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  function kodSonucCiz(kod) {
    const k = kayitlar.find((x) => x.kod === kod);
    const kutu = $("#kod-sonuc");
    if (!k) { kutu.innerHTML = `<p class="bos">${esc(kod)} kodlu bir sipariş bulunamadı.</p>`; return; }
    const liste = k.durum === "teslim_edildi" ? kayitlar.filter((x) => x.durum === "teslim_edildi") : kayitlar.filter((x) => x.durum !== "teslim_edildi").sort((a, b) => siraAnahtari(a).localeCompare(siraAnahtari(b)));
    const sira = k.durum === "teslim_edildi" ? "–" : liste.indexOf(k) + 1;
    kutu.innerHTML = kart(k, sira);
  }
  kodForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const kod = kodForm.kod.value.trim();
    if (!kod) { vurgulu = null; $("#kod-sonuc").innerHTML = ""; return; }
    if (!kayitlar.some((k) => k.kod === kod)) await yukle(true);
    vurgulu = kod;
    kodSonucCiz(kod);
  });

  // ---- Müşteriye WhatsApp ile durum bildirimi ----
  const waNumara = (k) => (k.telefonRakam.startsWith("0") ? "9" + k.telefonRakam : k.telefonRakam.length === 10 ? "90" + k.telefonRakam : k.telefonRakam);
  function musteriMesaji(k) {
    const bas = `Merhaba ${k.ad},`;
    const takip = `\n\nHalınızın durumunu buradan takip edebilirsiniz:\n${location.origin}/?kod=${k.kod}`;
    let m;
    switch (k.durum) {
      case "yeni":
        m = k.tur === "adres"
          ? `${bas} ${tarihYaz(k.tarih)}, ${k.saat} arası için halı alım randevunuz oluşturuldu. ✅\nTeslimat kodunuz: *${k.kod}*`
          : `${bas} kaydınız oluşturuldu. ✅\nTeslimat kodunuz: *${k.kod}*\nHalınızı getirmeden önce lütfen mutlaka bizi arayın: ${[D.telefon, D.telefon2].filter(Boolean).join(" / ")}`;
        m += takip; break;
      case "teslim_alindi":
        m = `${bas} halınızı teslim aldık. 🧺\nTeslimat kodunuz: *${k.kod}*\nYıkamaya başladığımızda size haber vereceğiz.` + takip; break;
      case "yikaniyor":
        m = `${bas} halınız şu an yıkanıyor. 🫧\nTemizlik bitince size haber vereceğiz.` + takip; break;
      case "hazir":
        m = k.tur === "adres"
          ? `${bas} halınız tertemiz oldu ve teslime hazır! ✨\nTeslimat için uygun olduğunuz saati bize yazabilirsiniz.`
          : `${bas} halınız tertemiz oldu ve teslime hazır! ✨\nDükkanımızdan teslim alabilirsiniz. Gelmeden önce lütfen arayın: ${[D.telefon, D.telefon2].filter(Boolean).join(" / ")}\nAdres: ${D.adres}`;
        m += `\nTeslimat kodunuz: *${k.kod}*`; break;
      case "teslim_edildi":
        m = `${bas} halınız teslim edildi. Bizi tercih ettiğiniz için teşekkür ederiz! 🙏`; break;
      default:
        m = `${bas}`;
    }
    return m + `\n\n${D.ad}`;
  }
  const mb = $("#mb");
  let mbKayit = null;
  function mbLink() { $("#mb-gonder").href = `https://wa.me/${waNumara(mbKayit)}?text=${encodeURIComponent($("#mb-metin").value)}`; }
  function musteriBildirAc(k, durumDegisti) {
    mbKayit = k;
    $("#mb-baslik").textContent = durumDegisti ? "Müşteriye bildirilsin mi?" : "Müşteriye durum bildir";
    $("#mb-alt").textContent = `${k.ad} · ${k.telefon} · Durum: ${ETIKET[k.durum]}`;
    $("#mb-metin").value = musteriMesaji(k);
    mbLink();
    mb.hidden = false;
    document.body.style.overflow = "hidden";
    $("#mb-gonder").focus();
  }
  function mbKapat() { mb.hidden = true; document.body.style.overflow = ""; }
  $("#mb-metin").addEventListener("input", mbLink);
  $("#mb-gonder").addEventListener("click", () => setTimeout(mbKapat, 300));
  $("#mb-iptal").addEventListener("click", mbKapat);
  mb.addEventListener("click", (e) => { if (e.target === mb) mbKapat(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!mb.hidden) mbKapat(); else if (!$("#zil-panel").hidden) zilKapat(); } });

  // ---- Zil: yeni randevular ve telefon bildirimleri ----
  function cal() {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      [[0, 784], [0.18, 1046]].forEach(([t, f]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.value = f; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(0.0001, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.35);
        o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.4);
      });
    } catch {}
  }
  const zilPanel = $("#zil-panel");
  function zilListeCiz() {
    const yeni = kayitlar.filter((k) => k.durum !== "teslim_edildi" && k.olusturma > esik).sort((a, b) => b.olusturma.localeCompare(a.olusturma));
    $("#zil-liste").innerHTML = yeni.length
      ? yeni.map((k) => `<button type="button" class="zil-oge" data-git="${k.kod}"><span class="kod-rozet">${k.kod}</span><b>${esc(k.ad)}</b><small>${k.tur === "adres" ? esc(tarihYaz(k.tarih) + " · " + k.saat) : "Dükkana getirecek"} · ${esc(zamanYaz(k.olusturma))}</small></button>`).join("")
      : '<p class="zil-bos">Okunmamış yeni randevu yok.</p>';
    $("#zil-okundu").hidden = !yeni.length;
  }
  function zilAc() { zilPanel.hidden = false; $("#zil").setAttribute("aria-expanded", "true"); zilListeCiz(); izinCiz(); }
  function zilKapat() { zilPanel.hidden = true; $("#zil").setAttribute("aria-expanded", "false"); }
  $("#zil").addEventListener("click", () => (zilPanel.hidden ? zilAc() : zilKapat()));
  $("#zil-kapat").addEventListener("click", zilKapat);
  document.addEventListener("click", (e) => { if (!zilPanel.hidden && !zilPanel.contains(e.target) && !e.target.closest("#zil")) zilKapat(); });
  $("#zil-okundu").addEventListener("click", () => {
    esik = new Date().toISOString();
    try { localStorage.setItem("sonGorulme", esik); } catch {}
    ciz(); zilKapat();
  });
  $("#zil-liste").addEventListener("click", (e) => {
    const o = e.target.closest("[data-git]");
    if (!o) return;
    zilKapat();
    kodForm.kod.value = o.dataset.git;
    kodForm.requestSubmit();
    $(".kod-kutu").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const pushDestek = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const iosMu = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const anaEkranda = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.tip === "yeni-randevu" && sifre) yukle(true); });
  }
  const b64 = (s) => {
    const p = "=".repeat((4 - (s.length % 4)) % 4);
    const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(r, (c) => c.charCodeAt(0));
  };
  async function mevcutAbonelik() {
    if (!pushDestek) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? reg.pushManager.getSubscription() : null;
  }
  // Panel her açıldığında: bildirimler bu cihazda açık değilse üstte uyarı göster
  async function seritCiz() {
    const serit = $("#serit");
    let gizle = false;
    try { gizle = sessionStorage.getItem("seritGizle") === "1"; } catch {}
    let durum = "kapali";
    if (!pushDestek) durum = iosMu && !anaEkranda ? "ios" : "destek-yok";
    else if (Notification.permission === "denied") durum = "engelli";
    else if (Notification.permission === "granted" && (await mevcutAbonelik().catch(() => null))) durum = "acik";
    if (durum === "acik" || gizle) { serit.hidden = true; return; }
    const metin = {
      kapali: ["Bildirimler kapalı", "Yeni randevu geldiğinde telefonunuza bildirim gelmesi için bildirimleri açın."],
      ios: ["Bildirimler kapalı", "iPhone'da bildirim için önce Safari'de Paylaş → Ana Ekrana Ekle yapın, paneli ana ekrandaki simgeden açın."],
      engelli: ["Bildirimler engellenmiş", "Tarayıcı ayarlarından bu site için Bildirimler → İzin ver yapın, sonra sayfayı yenileyin."],
      "destek-yok": ["Bildirimler kapalı", "Bu tarayıcı telefon bildirimi desteklemiyor. Android'de Chrome ile açın."],
    }[durum];
    serit.innerHTML = `<span class="serit-ikon" aria-hidden="true"><svg><use href="#i-zil"/></svg></span>
      <div class="serit-metin"><b>${metin[0]}</b><span>${metin[1]}</span></div>
      <div class="serit-butonlar">${durum === "kapali" ? '<button type="button" class="btn btn-ana btn-kucuk" id="serit-ac">🔔 Bildirimleri Aç</button>' : ""}
        <button type="button" class="serit-kapat" id="serit-kapat">Şimdilik kapat</button></div>`;
    serit.hidden = false;
    $("#serit-ac")?.addEventListener("click", async (e) => { e.target.disabled = true; await bildirimAc(); });
    $("#serit-kapat").addEventListener("click", () => {
      try { sessionStorage.setItem("seritGizle", "1"); } catch {}
      serit.hidden = true;
    });
  }

  async function izinCiz() {
    seritCiz();
    const kutu = $("#zil-izin");
    kutu.className = "zil-izin";
    if (!pushDestek) {
      kutu.classList.add("uyari-ton");
      kutu.innerHTML = iosMu && !anaEkranda
        ? "<b>iPhone'da telefon bildirimi için:</b><span>Safari'de alttaki <b>Paylaş</b> düğmesine basıp <b>Ana Ekrana Ekle</b>'yi seçin. Sonra paneli ana ekrandaki <b>Tek Panel</b> simgesinden açıp buradan bildirimleri açın.</span>"
        : "<span>Bu tarayıcı telefon bildirimlerini desteklemiyor. Android'de <b>Chrome</b> ile açın.</span>";
      return;
    }
    if (Notification.permission === "denied") {
      kutu.classList.add("uyari-ton");
      kutu.innerHTML = "<span>Bildirimler bu cihazda engellenmiş. Tarayıcı ayarlarından bu site için <b>Bildirimler → İzin ver</b> yapın, sonra sayfayı yenileyin.</span>";
      return;
    }
    const sub = Notification.permission === "granted" ? await mevcutAbonelik() : null;
    if (sub) {
      kutu.classList.add("acik");
      kutu.innerHTML = `<b>✓ Bu cihazda bildirimler açık</b><span>Yeni randevu gelince panel kapalı olsa da telefonunuza bildirim gelir.</span>
        <div class="zil-izin-sira"><button type="button" class="btn btn-hafif btn-kucuk" id="b-test">Deneme gönder</button><button type="button" class="btn btn-hafif btn-kucuk" id="b-kapat">Kapat</button></div>`;
      $("#b-test").onclick = testGonder;
      $("#b-kapat").onclick = bildirimKapat;
    } else {
      kutu.innerHTML = `<b>Telefon bildirimleri kapalı</b><span>Açarsanız yeni randevu geldiğinde panel kapalı olsa bile bu cihaza bildirim gelir.</span>
        <button type="button" class="btn btn-ana btn-kucuk" id="b-ac">🔔 Bildirimleri Aç</button>`;
      $("#b-ac").onclick = bildirimAc;
    }
  }
  async function bildirimAc() {
    const btn = $("#b-ac");
    if (btn) btn.disabled = true;
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") throw new Error("Bildirim izni verilmedi.");
      const { anahtar } = await api("bildirim-anahtar");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(anahtar) });
      await api("bildirim-abone", { abonelik: sub.toJSON() });
      bildir("Bildirimler açıldı. Deneme bildirimi gönderiliyor…");
      await api("bildirim-test", {});
    } catch (err) {
      bildir(err.message || "Bildirim açılamadı.");
    }
    izinCiz();
  }
  async function bildirimKapat() {
    try {
      const sub = await mevcutAbonelik();
      if (sub) { await api("bildirim-kapat", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
      bildir("Bu cihazda bildirimler kapatıldı");
    } catch (err) { bildir(err.message); }
    izinCiz();
  }
  async function testGonder() {
    try {
      const v = await api("bildirim-test", {});
      bildir(v.gonderilen ? `Deneme bildirimi gönderildi (${v.gonderilen} cihaz)` : "Bildirim gönderilemedi. Kapatıp tekrar açmayı deneyin.");
    } catch (err) { bildir(err.message); }
  }
  // Bu cihaz daha önce abone olduysa sunucudaki kaydı tazele
  async function aboneligiTazele() {
    try {
      if (!pushDestek || Notification.permission !== "granted") return;
      const sub = await mevcutAbonelik();
      if (sub) await api("bildirim-abone", { abonelik: sub.toJSON() });
    } catch {}
  }

  // ---- Başlangıç ----
  if (sifre) {
    api("kontrol").then(panelAc).catch(() => cikis());
  }
})();
