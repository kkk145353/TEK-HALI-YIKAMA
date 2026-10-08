// Telefon bildirimleri (Web Push). Anahtarlar ilk kullanımda otomatik üretilir
// ve veri deposunda saklanır; Netlify'da hiçbir ayar gerekmez.
import webpush from "web-push";

const ozet = async (metin) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(metin));
  return [...new Uint8Array(b)].slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
};

export function pushHizmeti(store, konu) {
  async function anahtarlar() {
    let v = await store.get("ayar/vapid", { type: "json" });
    if (!v?.publicKey) {
      v = webpush.generateVAPIDKeys();
      await store.setJSON("ayar/vapid", v);
    }
    return v;
  }

  return {
    async acikAnahtar() {
      return (await anahtarlar()).publicKey;
    },

    async aboneEkle(abonelik) {
      if (!abonelik?.endpoint || !abonelik?.keys?.p256dh || !abonelik?.keys?.auth) throw new Error("Geçersiz abonelik");
      await store.setJSON("abone/" + (await ozet(abonelik.endpoint)), {
        endpoint: abonelik.endpoint,
        keys: { p256dh: abonelik.keys.p256dh, auth: abonelik.keys.auth },
        eklendi: new Date().toISOString(),
      });
    },

    async aboneSil(endpoint) {
      if (endpoint) await store.delete("abone/" + (await ozet(endpoint)));
    },

    async aboneSayisi() {
      const { blobs } = await store.list({ prefix: "abone/" });
      return blobs.length;
    },

    // Tüm kayıtlı cihazlara bildirim gönderir; başarılı gönderim sayısını döner.
    async gonder(mesaj) {
      const v = await anahtarlar();
      const { blobs } = await store.list({ prefix: "abone/" });
      const sonuclar = await Promise.allSettled(
        blobs.map(async ({ key }) => {
          const a = await store.get(key, { type: "json" });
          if (!a) return false;
          try {
            await webpush.sendNotification(a, JSON.stringify(mesaj), {
              vapidDetails: { subject: konu, publicKey: v.publicKey, privateKey: v.privateKey },
              TTL: 24 * 3600,
              urgency: "high",
              timeout: 5000,
            });
            return true;
          } catch (e) {
            // Cihaz aboneliği iptal etmişse sil
            if (e?.statusCode === 404 || e?.statusCode === 410) await store.delete(key);
            else console.error("Bildirim gönderilemedi:", e?.statusCode || e?.message);
            return false;
          }
        })
      );
      return sonuclar.filter((s) => s.status === "fulfilled" && s.value).length;
    },
  };
}
