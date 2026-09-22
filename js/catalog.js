import { STORE_API_URL } from "./store-config.js";

export async function loadCatalog() {
  const endpoint = STORE_API_URL.replace(/\/$/, "");
  if (!endpoint) throw new Error("The Store catalog is not connected yet.");
  const response = await fetch(`${endpoint}?action=catalog`);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok || !Array.isArray(result.data)) {
    throw new Error(result?.error || "The Store catalog could not be loaded.");
  }
  return result.data;
}

export async function loadPublicProject(id) {
  const endpoint = STORE_API_URL.replace(/\/$/, "");
  if (!endpoint) throw new Error("The Store is not connected yet.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try { response = await fetch(`${endpoint}?action=public-project&id=${encodeURIComponent(id)}`, { signal: controller.signal }); }
  catch (error) { throw new Error(error.name === "AbortError" ? "The project took too long to load. Try refreshing." : "The Store API could not be reached."); }
  finally { clearTimeout(timeout); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.error || "This project could not be loaded.");
  return result.data;
}

export async function loadPublicProfile(name) {
  const endpoint = STORE_API_URL.replace(/\/$/, "");
  if (!endpoint) throw new Error("The Store is not connected yet.");
  const response = await fetch(`${endpoint}?action=public-profile&name=${encodeURIComponent(name)}`);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.error || "This profile could not be loaded.");
    error.status = response.status;
    throw error;
  }
  return result.data;
}
