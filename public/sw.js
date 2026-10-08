// Yönetim paneli bildirimleri
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { metin: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.baslik || "Yeni randevu", {
      body: d.metin || "Yönetim panelinde yeni bir randevu var.",
      icon: "/assets/icon-192.png",
      badge: "/assets/badge-72.png",
      tag: d.kod || "randevu",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: d.url || "/admin" },
    });
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    pencereler.forEach((p) => p.postMessage({ tip: "yeni-randevu", kod: d.kod }));
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin";
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const p of pencereler) {
      if (p.url.includes("/admin")) { await p.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});
