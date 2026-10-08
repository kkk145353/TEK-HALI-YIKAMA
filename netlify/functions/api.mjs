import { getStore } from "@netlify/blobs";
import { handle } from "../../lib/api.mjs";
import { pushHizmeti } from "../../lib/push.mjs";

// Netlify'da ADMIN_SIFRE eklenmemişse kullanılan varsayılan şifrenin özeti (sha256).
// Şifrenin kendisi kodda açık yazmaz. Varsayılan şifre: pendik2026
const VARSAYILAN_SIFRE_OZETI = "f4413304efd511db3ab85aa0b63b6cd0752240fd87295664c923aa9397c91d0a";

// Değişken adı Türkçe klavyeyle yazılmış olsa da (ADMİN_ŞİFRE vb.) bulur.
function ortamSifresi() {
  try {
    const v = globalThis.Netlify?.env?.get("ADMIN_SIFRE");
    if (v && v.trim()) return v.trim();
  } catch {}
  const sade = (k) =>
    k.replace(/[İıi]/g, "I").replace(/[Şş]/g, "S").toUpperCase().replace(/[^A-Z]/g, "");
  for (const [k, v] of Object.entries(process.env)) {
    if (["ADMINSIFRE", "ADMINSIFRESI", "SIFRE", "ADMINPASSWORD"].includes(sade(k)) && v && v.trim())
      return v.trim();
  }
  return "";
}

async function ozet(metin) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(metin));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export default async (req) => {
  let sifre = ortamSifresi();
  if (!sifre) {
    // Varsayılan şifre: gelen şifrenin özeti eşleşirse kabul et
    const gelen = (req.headers.get("x-admin-sifre") || "").trim();
    sifre = gelen && (await ozet(gelen)) === VARSAYILAN_SIFRE_OZETI ? gelen : crypto.randomUUID();
  }
  const store = getStore({ name: "randevular", consistency: "strong" });
  const push = pushHizmeti(store, new URL(req.url).origin);
  return handle(req, store, { ADMIN_SIFRE: sifre, push });
};

export const config = { path: "/api/*" };
