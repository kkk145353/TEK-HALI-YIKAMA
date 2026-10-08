// Ana ekran simgesindeki bildirim sayısı (uygulama rozeti).
// Sayaçlar Cache Storage'da tutulur; böylece arka plan çalışanı (sw.js) da aynı sayıları okuyup yazabilir.
//   "admin"   → panelde okunmamış yeni randevular
//   "musteri" → müşterinin okunmamış halı durum bildirimleri
window.Rozet = (() => {
  const KASA = "rozet-v1";
  const destek = "caches" in window;
  async function oku(alan) {
    if (!destek) return 0;
    try {
      const r = await (await caches.open(KASA)).match("/__rozet/" + alan);
      return r ? parseInt(await r.text(), 10) || 0 : 0;
    } catch { return 0; }
  }
  async function yaz(alan, n) {
    if (!destek) return;
    try { await (await caches.open(KASA)).put("/__rozet/" + alan, new Response(String(Math.max(0, n | 0)))); } catch {}
  }
  async function uygula() {
    const toplam = (await oku("admin")) + (await oku("musteri"));
    try {
      if (toplam > 0 && navigator.setAppBadge) await navigator.setAppBadge(toplam);
      else if (navigator.clearAppBadge) await navigator.clearAppBadge();
    } catch {}
    return toplam;
  }
  return {
    async ayarla(alan, n) { await yaz(alan, n); return uygula(); },
    oku,
    uygula,
  };
})();
