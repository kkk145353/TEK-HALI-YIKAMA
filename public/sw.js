// Bildirimler: dükkan sahibine "yeni randevu", müşteriye "halının durumu"
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Ana ekran simgesindeki sayı (assets/rozet.js ile aynı sayaçlar)
async function rozetArtir(alan) {
  try {
    const kasa = await caches.open("rozet-v1");
    const oku = async (a) => { const r = await kasa.match("/__rozet/" + a); return r ? parseInt(await r.text(), 10) || 0 : 0; };
    await kasa.put("/__rozet/" + alan, new Response(String((await oku(alan)) + 1)));
    const toplam = (await oku("admin")) + (await oku("musteri"));
    if (self.navigator.setAppBadge) await self.navigator.setAppBadge(toplam);
  } catch {}
}

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { metin: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.baslik || "Yeni randevu", {
      body: d.metin || "Yönetim panelinde yeni bir randevu var.",
      icon: "/assets/icon-192.png",
      badge: "/assets/badge-72.png",
      tag: d.tip === "durum" ? d.kod + "-" + (d.durum || "") : d.kod || "randevu",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: d.url || "/admin", tip: d.tip || "yeni-randevu" },
    });
    await rozetArtir(d.tip === "durum" ? "musteri" : "admin");
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    pencereler.forEach((p) => p.postMessage({ tip: d.tip || "yeni-randevu", kod: d.kod }));
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin";
  const panelMi = url.startsWith("/admin");
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const p of pencereler) {
      const yol = new URL(p.url).pathname;
      if (panelMi ? yol.startsWith("/admin") : !yol.startsWith("/admin")) {
        await p.focus();
        if (!panelMi && "navigate" in p) await p.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
