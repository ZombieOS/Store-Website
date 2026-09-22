import { loadCatalog } from "./catalog.js";

loadCatalog().then((catalog) => {
  const featured = catalog.sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))[0];
  if (!featured) return;
  document.querySelector("#featured-icon").src = featured.icon || "https://www.zsharp.zombieos.com/zsharp.png";
  document.querySelector("#featured-label").textContent = featured.type === "game" ? "FEATURED GAME" : "FEATURED APPLICATION";
  document.querySelector("#featured-name").textContent = featured.name;
  document.querySelector("#featured-description").textContent = featured.description || `Published by ${featured.publisher}`;
  const link = document.querySelector("#featured-link");
  link.href = featured.url;
  link.hidden = false;
}).catch((error) => console.warn("Featured Store project unavailable:", error));
