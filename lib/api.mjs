// Randevu sisteminin bütün sunucu mantığı.
// Netlify fonksiyonu (netlify/functions/api.mjs) bunu gerçek veri deposuyla çağırır,
// testler de sahte bir depoyla çağırır.

const ALFABE = "ABCDEFGHJKLMNPRSTUVYZ23456789"; // karışabilecek O/0, I/1 yok
export const DURUMLAR = {
  yeni: "Randevu alındı",
  teslim_alindi: "Halı teslim alındı",
  yikaniyor: "Yıkanıyor",
  hazir: "Teslime hazır",
  teslim_edildi: "Teslim edildi",
};
const SAATLER = ["09:00–12:00", "12:00–15:00", "15:00–18:00", "18:00–21:00"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const hata = (mesaj, status = 400) => json({ hata: mesaj }, status);
const temiz = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cokSatir = (v, max) => String(v ?? "").trim().slice(0, max);
const rakam = (v) => String(v ?? "").replace(/\D/g, "");
const bugunIstanbul = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

function kodUret() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  let k = "";
  for (const x of b) k += ALFABE[x % ALFABE.length];
  return k;
}

function esitMi(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const anahtar = (kod) => "r/" + kod;

async function hepsi(store) {
  const { blobs } = await store.list({ prefix: "r/" });
  const kayitlar = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return kayitlar.filter(Boolean);
}

async function randevuOlustur(req, store, env) {
  let g;
  try {
    g = await req.json();
  } catch {
    return hata("Geçersiz istek.");
  }
  if (g.website) return json({ kod: "------" }, 201); // bot tuzağı

  const tur = g.tur === "dukkan" ? "dukkan" : "adres";
  const kanal = g.kanal === "whatsapp" ? "whatsapp" : "site";
  const ad = temiz(g.ad, 80);
  const telefon = temiz(g.telefon, 25);
  const telefonRakam = rakam(telefon);
  const adres = cokSatir(g.adres, 400);
  const not = temiz(g.not, 500);
  const tarih = temiz(g.tarih, 10);
  const saat = temiz(g.saat, 20);

  if (ad.length < 3) return hata("Lütfen adınızı ve soyadınızı yazın.");
  if (telefonRakam.length < 10 || telefonRakam.length > 13)
    return hata("Lütfen geçerli bir telefon numarası yazın.");
  if (tur === "adres") {
    if (adres.length < 10) return hata("Lütfen açık adresinizi yazın.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return hata("Lütfen alım tarihini seçin.");
    if (tarih < bugunIstanbul()) return hata("Geçmiş bir tarih seçilemez.");
    if (!SAATLER.includes(saat)) return hata("Lütfen bir saat aralığı seçin.");
  }

  let kod = null;
  for (let i = 0; i < 10 && !kod; i++) {
    const k = kodUret();
    if (!(await store.get(anahtar(k)))) kod = k;
  }
  if (!kod) return hata("Kod üretilemedi, lütfen tekrar deneyin.", 500);

  const simdi = new Date().toISOString();
  const kayit = {
    kod, tur, kanal, ad, telefon, telefonRakam,
    adres: tur === "adres" ? adres : adres || "",
    tarih: tur === "adres" ? tarih : "",
    saat: tur === "adres" ? saat : "",
    not,
    durum: "yeni",
    olusturma: simdi,
    gecmis: [{ durum: "yeni", zaman: simdi }],
  };
  await store.setJSON(anahtar(kod), kayit);
  await yeniRandevuBildir(env, kayit);
  return json({ kod, tur, kanal, tarih: kayit.tarih, saat: kayit.saat }, 201);
}

// Dükkan sahibinin telefonuna "yeni randevu" bildirimi (en fazla 6 sn bekler, hata olursa randevuyu bozmaz)
async function yeniRandevuBildir(env, k) {
  if (!env.push) return;
  const tarih = k.tarih
    ? new Date(k.tarih + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })
    : "";
  const mesaj = {
    baslik: `Yeni randevu · ${k.kod}`,
    metin: k.tur === "adres"
      ? `${k.ad} · ${tarih} ${k.saat}\n${k.adres.slice(0, 80)}`
      : `${k.ad} · Dükkana kendisi getirecek\n${k.telefon}`,
    kod: k.kod,
    url: "/admin",
  };
  try {
    await Promise.race([env.push.gonder(mesaj), new Promise((r) => setTimeout(r, 6000))]);
  } catch (e) {
    console.error("Bildirim hatası:", e?.message);
  }
}

async function sorgula(url, store) {
  const kod = temiz(url.searchParams.get("kod"), 10).toUpperCase();
  const tel4 = rakam(url.searchParams.get("tel4"));
  if (kod.length !== 6 || tel4.length !== 4) return hata("Kodu ve telefonun son 4 hanesini yazın.");
  const k = await store.get(anahtar(kod), { type: "json" });
  if (!k || !k.telefonRakam.endsWith(tel4)) return hata("Bu bilgilerle bir kayıt bulunamadı.", 404);
  return json({
    kod: k.kod, tur: k.tur, tarih: k.tarih, saat: k.saat,
    durum: k.durum, durumEtiket: DURUMLAR[k.durum], gecmis: k.gecmis,
  });
}

// Müşterinin telefonuna halının durum bildirimi
function musteriMesaji(k) {
  const m = {
    yeni: ["Randevunuz alındı ✓", `${k.kod} kodlu kaydınız oluşturuldu.`],
    teslim_alindi: ["Halınızı teslim aldık 🧺", `${k.kod} kodlu halınız dükkanımıza ulaştı, yıkama sırasına alındı.`],
    yikaniyor: ["Halınız yıkanıyor 🫧", `${k.kod} kodlu halınızın yıkaması başladı. Bitince haber vereceğiz.`],
    hazir: ["Halınız teslime hazır ✨", k.tur === "adres"
      ? `${k.kod} kodlu halınız tertemiz oldu. Teslimat için sizinle iletişime geçeceğiz.`
      : `${k.kod} kodlu halınız tertemiz oldu. Dükkanımızdan alabilirsiniz, gelmeden önce lütfen arayın.`],
    teslim_edildi: ["Halınız teslim edildi 🙏", "Bizi tercih ettiğiniz için teşekkür ederiz."],
  }[k.durum];
  return { baslik: m[0], metin: m[1], kod: k.kod, durum: k.durum, tip: "durum", url: "/?kod=" + k.kod };
}

async function musteriBildir(env, k) {
  if (!env.push) return 0;
  try {
    return await Promise.race([env.push.musteriGonder(k.kod, musteriMesaji(k)), new Promise((r) => setTimeout(() => r(0), 6000))]);
  } catch (e) {
    console.error("Müşteri bildirimi hatası:", e?.message);
    return 0;
  }
}

// Müşteri kendi koduyla bildirim açar/kapatır (kod + telefonun son 4 hanesi doğrulanır)
async function musteriBildirim(req, store, env, islem) {
  if (!env.push) return hata("Bildirim sistemi kullanılamıyor.", 503);
  if (islem === "anahtar") return json({ anahtar: await env.push.acikAnahtar() });
  const g = await req.json().catch(() => ({}));
  const kod = temiz(g.kod, 10).toUpperCase();
  const tel4 = rakam(g.tel4);
  const k = kod.length === 6 && tel4.length === 4 ? await store.get(anahtar(kod), { type: "json" }) : null;
  if (!k || !k.telefonRakam.endsWith(tel4)) return hata("Bu bilgilerle bir kayıt bulunamadı.", 404);
  if (islem === "abone") {
    try { await env.push.musteriAboneEkle(kod, g.abonelik); } catch { return hata("Bildirim kaydı yapılamadı."); }
    return json({ ok: true });
  }
  if (islem === "kapat") { await env.push.musteriAboneSil(kod, g.endpoint); return json({ ok: true }); }
  if (islem === "durum") return json({ acik: (await env.push.musteriAboneSayisi(kod)) > 0 });
  return hata("Bulunamadı.", 404);
}

async function durumGuncelle(req, store, env) {
  const g = await req.json().catch(() => ({}));
  const kod = temiz(g.kod, 10).toUpperCase();
  if (!DURUMLAR[g.durum]) return hata("Geçersiz durum.");
  const k = await store.get(anahtar(kod), { type: "json" });
  if (!k) return hata("Kayıt bulunamadı.", 404);
  if (k.durum !== g.durum) {
    const simdi = new Date().toISOString();
    k.durum = g.durum;
    k.gecmis = [...(k.gecmis || []), { durum: g.durum, zaman: simdi }];
    if (g.durum === "teslim_edildi") k.teslimEdildi = simdi;
    else delete k.teslimEdildi;
    await store.setJSON(anahtar(kod), k);
    const gonderilen = g.durum === "yeni" ? 0 : await musteriBildir(env, k);
    return json({ kayit: k, musteriBildirim: gonderilen });
  }
  return json({ kayit: k, musteriBildirim: 0 });
}

async function sil(req, store, env) {
  const g = await req.json().catch(() => ({}));
  const kod = temiz(g.kod, 10).toUpperCase();
  if (!(await store.get(anahtar(kod)))) return hata("Kayıt bulunamadı.", 404);
  await store.delete(anahtar(kod));
  if (env.push) await env.push.musteriTumunuSil(kod).catch(() => {});
  return json({ ok: true });
}

export async function handle(req, store, env) {
  const url = new URL(req.url);
  const yol = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const m = req.method;
  try {
    if (yol === "randevu" && m === "POST") return await randevuOlustur(req, store, env);
    if (yol === "sorgula" && m === "GET") return await sorgula(url, store);
    if (yol === "bildirim/anahtar" && m === "GET") return await musteriBildirim(req, store, env, "anahtar");
    if (["bildirim/abone", "bildirim/kapat", "bildirim/durum"].includes(yol) && m === "POST")
      return await musteriBildirim(req, store, env, yol.split("/")[1]);

    if (yol.startsWith("admin/")) {
      if (!env.ADMIN_SIFRE)
        return hata("Admin şifresi ayarlanmamış. Netlify'da ADMIN_SIFRE ortam değişkenini ekleyin.", 503);
      if (!esitMi(req.headers.get("x-admin-sifre") || "", env.ADMIN_SIFRE))
        return hata("Şifre hatalı.", 401);
      const alt = yol.slice(6);
      if (alt === "kontrol") return json({ ok: true });
      if (alt === "liste" && m === "GET")
        return json({
          kayitlar: await hepsi(store),
          durumlar: DURUMLAR,
          bildirimli: env.push ? await env.push.musteriKodlari().catch(() => []) : [],
        });
      if (alt === "durum" && m === "POST") return await durumGuncelle(req, store, env);
      if (alt === "sil" && m === "POST") return await sil(req, store, env);
      if (alt.startsWith("bildirim-")) {
        if (!env.push) return hata("Bildirim sistemi kullanılamıyor.", 503);
        const g = m === "POST" ? await req.json().catch(() => ({})) : {};
        if (alt === "bildirim-anahtar") return json({ anahtar: await env.push.acikAnahtar(), cihaz: await env.push.aboneSayisi() });
        if (alt === "bildirim-abone" && m === "POST") {
          try { await env.push.aboneEkle(g.abonelik); } catch { return hata("Bildirim kaydı yapılamadı."); }
          return json({ ok: true, cihaz: await env.push.aboneSayisi() });
        }
        if (alt === "bildirim-kapat" && m === "POST") { await env.push.aboneSil(g.endpoint); return json({ ok: true }); }
        if (alt === "bildirim-test" && m === "POST") {
          const n = await env.push.gonder({ baslik: "Deneme bildirimi ✓", metin: "Yeni randevular bu şekilde telefonunuza gelecek.", url: "/admin" });
          return json({ gonderilen: n });
        }
      }
    }
    return hata("Bulunamadı.", 404);
  } catch (e) {
    console.error(e);
    return hata("Sunucu hatası, lütfen tekrar deneyin.", 500);
  }
}
