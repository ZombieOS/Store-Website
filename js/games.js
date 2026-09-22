import { loadCatalog } from "./catalog.js";

let storeGames = [];

const searchInput = document.querySelector("#app-search");
const sortSelect = document.querySelector("#app-sort");
const gamesGrid = document.querySelector("#apps-grid");
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

function visibleGames() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const matches = storeGames.filter((game) => {
    const searchable = `${game.name ?? ""} ${game.publisher ?? ""} ${game.description ?? ""}`.toLocaleLowerCase();
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

function gameCard(game) {
  const card = document.createElement("a");
  card.className = "app-card";
  card.href = game.url || "#";
  const icon = document.createElement("img");
  icon.src = game.icon || "https://www.zsharp.zombieos.com/zsharp.png";
  icon.alt = "";
  const details = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = game.name || "Untitled game";
  const publisher = document.createElement("span");
  publisher.className = "app-publisher";
  publisher.textContent = game.publisher || "Unknown publisher";
  details.append(title, publisher);
  const description = document.createElement("p");
  description.className = "app-description";
  description.textContent = game.description || "No description provided.";
  const date = document.createElement("time");
  date.className = "app-date";
  date.dateTime = game.publishedAt || "";
  date.textContent = game.publishedAt ? new Date(game.publishedAt).toLocaleDateString() : "";
  card.append(icon, details, description, date);
  return card;
}

function renderGames() {
  const games = visibleGames();
  const hasQuery = searchInput.value.trim().length > 0;
  gamesGrid.replaceChildren(...games.map(gameCard));
  resultCount.textContent = String(games.length);
  resultLabel.textContent = games.length === 1 ? "game" : "games";
  clearSearch.hidden = !hasQuery;
  emptyState.hidden = games.length > 0;
  if (games.length === 0 && hasQuery) {
    emptyTitle.textContent = "No matching games.";
    emptyCopy.textContent = `Nothing matched “${searchInput.value.trim()}”. Try a different search.`;
  } else {
    emptyTitle.textContent = "No games published yet.";
    emptyCopy.textContent = "The first reviewed .zgame release will appear here automatically.";
  }
}

searchInput.addEventListener("input", renderGames);
sortSelect.addEventListener("change", renderGames);
clearSearch.addEventListener("click", () => { searchInput.value = ""; searchInput.focus(); renderGames(); });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.focus(); }
});

emptyTitle.textContent = "Loading games…";
emptyCopy.textContent = "Checking the latest reviewed releases.";
loadCatalog().then((catalog) => {
  storeGames = catalog.filter((project) => project.type === "game");
  renderGames();
}).catch((error) => {
  emptyTitle.textContent = "Games unavailable.";
  emptyCopy.textContent = error.message || "Try again in a moment.";
});
