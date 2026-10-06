import { loadCatalog } from "./catalog.js";

let storePackages = [];

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

function visiblePackages() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const matches = storePackages.filter((item) => {
    const searchable = `${item.name ?? ""} ${item.publisher ?? ""} ${item.description ?? ""}`.toLocaleLowerCase();
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

function packageCard(item) {
  const card = document.createElement("a");
  card.className = "app-card";
  card.href = item.url || "#";

  const icon = document.createElement("img");
  icon.src = item.icon || "https://www.zsharp.zombieos.com/zsharp.png";
  icon.alt = "";

  const details = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = item.name || "Untitled package";
  const publisher = document.createElement("span");
  publisher.className = "app-publisher";
  publisher.textContent = item.publisher || "Unknown publisher";
  details.append(title, publisher);

  const description = document.createElement("p");
  description.className = "app-description";
  description.textContent = item.description || "No description provided.";

  const date = document.createElement("time");
  date.className = "app-date";
  date.dateTime = item.publishedAt || "";
  date.textContent = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "";

  card.append(icon, details, description, date);
  return card;
}

function renderPackages() {
  const packages = visiblePackages();
  const hasQuery = searchInput.value.trim().length > 0;

  appsGrid.replaceChildren(...packages.map(packageCard));
  resultCount.textContent = String(packages.length);
  resultLabel.textContent = packages.length === 1 ? "package" : "packages";
  clearSearch.hidden = !hasQuery;
  emptyState.hidden = packages.length > 0;

  if (packages.length === 0 && hasQuery) {
    emptyTitle.textContent = "No matching packages.";
    emptyCopy.textContent = `Nothing matched “${searchInput.value.trim()}”. Try a different search.`;
  } else {
    emptyTitle.textContent = "No packages published yet.";
    emptyCopy.textContent = "The first reviewed .zpackage release will appear here automatically.";
  }
}

searchInput.addEventListener("input", renderPackages);
sortSelect.addEventListener("change", renderPackages);
clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  renderPackages();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

emptyTitle.textContent = "Loading packages…";
emptyCopy.textContent = "Checking the latest reviewed releases.";
loadCatalog().then((catalog) => {
  storePackages = catalog.filter((project) => project.type === "package");
  renderPackages();
}).catch((error) => {
  emptyTitle.textContent = "Packages unavailable.";
  emptyCopy.textContent = error.message || "Try again in a moment.";
});
