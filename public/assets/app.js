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
      : `Halınızı ${D.adres} adresine bırakabilirsiniz.`;
    $("#kopyala").textContent = "Kodu kopyala";
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

  sorguForm.kod.addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  sorguForm.tel4.addEventListener("input", (e) => (e.target.value = e.target.value.replace(/\D/g, "")));
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
      sorguSonuc.innerHTML = `<h3>Kod ${v.kod}: ${v.durumEtiket}</h3>${ust}<ol class="adimlar-zaman">${satir}</ol>`;
    } catch (err) {
      sorguSonuc.classList.add("hatali");
      sorguSonuc.textContent = err.message === "Failed to fetch" ? "Bağlantı kurulamadı." : err.message;
    }
  });
})();
