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
  let esik = null; // bu tarihten sonra gelenler "YENİ"
  try { esik = localStorage.getItem("sonGorulme"); localStorage.setItem("sonGorulme", new Date().toISOString()); } catch {}
  esik = esik || new Date().toISOString();
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
    zamanlayici = setInterval(() => document.visibilityState === "visible" && yukle(true), 30000);
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
        if (yeni.length) bildir(`${yeni.length} yeni randevu geldi`);
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
    document.title = (yeniSayi ? `(${yeniSayi}) ` : "") + "Yönetim Paneli · Halı Yıkama";

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
        <button type="button" class="btn btn-tehlike btn-kucuk" data-sil="${k.kod}">Sil</button></div>
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
      } catch (err) {
        bildir(err.message);
        kartEl.classList.remove("yukleniyor");
      }
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

  // ---- Başlangıç ----
  if (sifre) {
    api("kontrol").then(panelAc).catch(() => cikis());
  }
})();
