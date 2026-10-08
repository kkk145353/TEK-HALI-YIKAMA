import { getStore } from "@netlify/blobs";
import { handle } from "../../lib/api.mjs";

// Randevular Netlify Blobs içinde "randevular" deposunda saklanır.
export default async (req) =>
  handle(req, getStore({ name: "randevular", consistency: "strong" }), {
    ADMIN_SIFRE: process.env.ADMIN_SIFRE,
  });

export const config = { path: "/api/*" };
