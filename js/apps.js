import { loadCatalog } from "./catalog.js";

let storeApps = [];

const searchInput = document.querySelector("#app-search");
const sortSelect = document.querySelector("#app-sort");
const appsGrid = document.querySelector("#apps-grid");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const resultCount = document.querySelector("#result-count");
const resultLabel = document.querySelector("#result-label");
const clearSearch = document.querySelector("#clear-search");

function normalizedDate(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function visibleApps() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const matches = storeApps.filter((app) => {
    const searchable = `${app.name ?? ""} ${app.publisher ?? ""} ${app.description ?? ""}`.toLocaleLowerCase();
    return searchable.includes(query);
  });

  return matches.sort((a, b) => {
    if (sortSelect.value === "newest") return normalizedDate(b.publishedAt) - normalizedDate(a.publishedAt);
    if (sortSelect.value === "oldest") return normalizedDate(a.publishedAt) - normalizedDate(b.publishedAt);
    if (sortSelect.value === "updated") return normalizedDate(b.updatedAt || b.publishedAt) - normalizedDate(a.updatedAt || a.publishedAt);
    if (sortSelect.value === "downloads") return Number(b.downloads || 0) - Number(a.downloads || 0);
    return String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" });
  });
}

function appCard(app) {
  const card = document.createElement("a");
  card.className = "app-card";
  card.href = app.url || "#";

  const icon = document.createElement("img");
  icon.src = app.icon || "https://www.zsharp.zombieos.com/zsharp.png";
  icon.alt = "";

  const details = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = app.name || "Untitled app";
  const publisher = document.createElement("span");
  publisher.className = "app-publisher";
  publisher.textContent = app.publisher || "Unknown publisher";
  details.append(title, publisher);

  const description = document.createElement("p");
  description.className = "app-description";
  description.textContent = app.description || "No description provided.";

  const date = document.createElement("time");
  date.className = "app-date";
  date.dateTime = app.publishedAt || "";
  date.textContent = app.publishedAt ? new Date(app.publishedAt).toLocaleDateString() : "";

  card.append(icon, details, description, date);
  return card;
}

function renderApps() {
  const apps = visibleApps();
  const hasQuery = searchInput.value.trim().length > 0;

  appsGrid.replaceChildren(...apps.map(appCard));
  resultCount.textContent = String(apps.length);
  resultLabel.textContent = apps.length === 1 ? "app" : "apps";
  clearSearch.hidden = !hasQuery;
  emptyState.hidden = apps.length > 0;

  if (apps.length === 0 && hasQuery) {
    emptyTitle.textContent = "No matching apps.";
    emptyCopy.textContent = `Nothing matched “${searchInput.value.trim()}”. Try a different search.`;
  } else {
    emptyTitle.textContent = "No apps published yet.";
    emptyCopy.textContent = "The first reviewed .zapp release will appear here automatically.";
  }
}

searchInput.addEventListener("input", renderApps);
sortSelect.addEventListener("change", renderApps);
clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  renderApps();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

emptyTitle.textContent = "Loading apps…";
emptyCopy.textContent = "Checking the latest reviewed releases.";
loadCatalog().then((catalog) => {
  storeApps = catalog.filter((project) => project.type === "app");
  renderApps();
}).catch((error) => {
  emptyTitle.textContent = "Apps unavailable.";
  emptyCopy.textContent = error.message || "Try again in a moment.";
});
