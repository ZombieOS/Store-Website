import { auth } from "./firebase.js";
import { STORE_API_URL } from "./store-config.js";

// The Cloudflare Worker verifies ZombieOS sign-in and writes to Z# Firestore.
const endpoint = STORE_API_URL.replace(/\/$/, "");

export async function storeApi(action, data = null) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with your ZombieOS account first.");
  if (!endpoint) throw new Error("The Store API is not connected yet. Add the Cloudflare Worker URL to js/store-config.js.");
  const token = await user.getIdToken();
  const options = { headers: { Authorization: `Bearer ${token}` } };
  let url = endpoint;
  if (data === null) url += `?action=${encodeURIComponent(action)}`;
  else {
    options.method = "POST";
    options.headers["Content-Type"] = "application/json";
    const payload = { ...data, action };
    if (action === "join" && typeof payload.avatar === "string" && payload.avatar.length > 350_000) delete payload.avatar;
    options.body = JSON.stringify(payload);
  }
  let response;
  try { response = await fetch(url, options); }
  catch { throw new Error("The Store API is unavailable. Check the Cloudflare Worker URL in js/store-config.js."); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.error || `Store API error (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export async function storeUpload(action, fields, file) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with your ZombieOS account first.");
  if (!endpoint) throw new Error("The Store API is not connected.");
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
  body.set("package", file);
  let response;
  try {
    response = await fetch(`${endpoint}?action=${encodeURIComponent(action)}`, {
      method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body
    });
  } catch { throw new Error("The Store API is unavailable. Try again shortly."); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.error || `Upload failed (${response.status}).`);
  return result.data;
}

export async function storeDownload(action, id) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with your ZombieOS account first.");
  const response = await fetch(`${endpoint}?action=${encodeURIComponent(action)}&id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `Download failed (${response.status}).`);
  }
  const header = response.headers.get("Content-Disposition") || "";
  const filename = /filename="([^"]+)"/.exec(header)?.[1] || "source-package";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
