import { loadPublicProject } from "./catalog.js";
import { setupReportButton } from "./report-form.js";
import { auth } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const requestedId = new URLSearchParams(location.search).get("v")?.trim() || "";
const loading = document.querySelector("#project-loading");
const errorView = document.querySelector("#project-error");
const content = document.querySelector("#project-content");
const reviewForm = document.querySelector("#project-review-form");
const reviewStatus = document.querySelector("#review-form-status");
let currentProject = null;
setupReportButton(document.querySelector("#report-project"), () => ({ targetType: "project", targetId: requestedId }));

function dateLabel(value) {
  if (!value) return "—";
  const raw = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(raw.getTime()) ? "—" : raw.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function setText(selector, value) { document.querySelector(selector).textContent = value; }

function profileLink(name) { return `profiles.html?v=${encodeURIComponent(name)}`; }

function renderProject(project, reviews) {
  document.title = `${project.name || "Project"} — ZOS Store`;
  const suspended = project.status === "suspended";
  document.querySelector("#project-moderation-notice").hidden = !suspended;
  document.querySelector("#report-project").hidden = suspended;
  const icon = document.querySelector("#project-icon");
  if (project.icon) icon.src = project.icon;
  if (project.banner) {
    document.querySelector("#project-banner-image").src = project.banner;
    document.querySelector("#project-banner").hidden = false;
  }
  if (Array.isArray(project.screenshots) && project.screenshots.length) {
    document.querySelector("#project-screenshots").hidden = false;
    document.querySelector("#screenshot-gallery").replaceChildren(...project.screenshots.slice(0, 5).map((source, index) => {
      const img = document.createElement("img"); img.src = source; img.alt = `${project.name || "Project"} screenshot ${index + 1}`; return img;
    }));
  }
  setText("#project-type", project.type === "game" ? ".zgame" : ".zapp");
  setText("#project-state", project.status || "draft");
  setText("#project-name", project.name || project.projectDisplayName || "Untitled project");
  setText("#project-description", project.description || "No description has been added yet.");
  setText("#project-id", project.projectId || requestedId);
  setText("#project-version", project.version || project.projectVersion || "—");
  setText("#release-date", project.releaseDate ? dateLabel(project.releaseDate) : "Not released");
  setText("#update-date", dateLabel(project.mostRecentUpdate || project.updatedAt));
  const downloads = Number(project.downloads || 0);
  setText("#download-count", `${downloads.toLocaleString()} ${downloads === 1 ? "download" : "downloads"}`);
  const reviewCount = Number(project.reviewCount ?? reviews.length);
  const average = Number(project.ratingAverage || 0);
  setText("#project-rating", reviewCount ? `${average.toFixed(1)} ★` : "No reviews");
  setText("#review-summary", reviewCount ? `${average.toFixed(1)} / 5 · ${reviewCount}` : "No rating");

  const creator = document.querySelector("#project-creator");
  creator.textContent = project.creator || "Unknown creator";
  creator.href = profileLink(project.creator || "");
  document.querySelector("#platform-list").replaceChildren(...(project.supportedPlatforms || []).map((name) => { const item = document.createElement("span"); item.textContent = name; return item; }));
  const people = [project.creator, ...(Array.isArray(project.contributors) ? project.contributors : [])].filter(Boolean);
  document.querySelector("#contributor-list").replaceChildren(...people.map((name) => { const link = document.createElement("a"); link.href = profileLink(name); link.textContent = name; return link; }));

  const reviewNodes = reviews.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).map((review) => {
    const item = document.createElement("article"); item.className = "review";
    const head = document.createElement("div"); head.className = "review-head";
    const authorGroup = document.createElement("div"); authorGroup.className = "review-author";
    if (review.avatar) { const avatar = document.createElement("img"); avatar.src = review.avatar; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; authorGroup.append(avatar); }
    else { const fallback = document.createElement("span"); fallback.className = "review-avatar-fallback"; fallback.textContent = (review.author || "S").trim().charAt(0).toUpperCase(); authorGroup.append(fallback); }
    const author = document.createElement("strong"); author.textContent = review.author || "Store user"; authorGroup.append(author);
    const stars = document.createElement("span"); stars.className = "review-stars"; stars.setAttribute("aria-label", `${Number(review.stars || 0)} out of 5 stars`);
    const filled = Math.max(0, Math.min(5, Number(review.stars || 0))); stars.innerHTML = `<span aria-hidden="true">${"★".repeat(filled)}<span class="empty-stars">${"★".repeat(5 - filled)}</span></span>`;
    head.append(authorGroup, stars);
    item.append(head);
    if (review.body) { const body = document.createElement("p"); body.textContent = review.body; item.append(body); }
    return item;
  });
  document.querySelector("#reviews-list").replaceChildren(...reviewNodes);
  document.querySelector("#reviews-empty").hidden = reviews.length > 0;

  const downloadButton = document.querySelector("#download-button");
  const available = project.status === "published" && Boolean(project.downloadUrl);
  downloadButton.disabled = !available;
  downloadButton.firstChild.textContent = available ? "Download " : project.status === "published" ? "Unavailable " : "Not released ";
  downloadButton.onclick = available ? () => { location.href = project.downloadUrl; } : null;
}

async function syncMyReview(user) {
  if (!currentProject) return;
  if (currentProject.status !== "published") { document.querySelector("#review-signin").hidden = true; reviewForm.hidden = true; return; }
  document.querySelector("#review-signin").hidden = Boolean(user);
  reviewForm.hidden = !user;
  if (!user) return;
  try {
    const mine = await storeApi("my-project-review", { projectId: currentProject.id });
    reviewForm.querySelectorAll('input[name="stars"]').forEach((input) => { input.checked = Number(input.value) === Number(mine?.stars || 0); });
    reviewForm.classList.toggle("has-rating", Boolean(mine?.stars));
    document.querySelector("#review-body").value = mine?.body || "";
    document.querySelector("#save-project-review").textContent = mine ? "Update review" : "Post review";
    document.querySelector("#delete-project-review").hidden = !mine;
  } catch (error) { reviewStatus.textContent = error.message || "Your review could not be loaded."; }
}

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentProject) return;
  const button = document.querySelector("#save-project-review"); button.disabled = true; reviewStatus.textContent = "Saving review…";
  try {
    await storeApi("project-review-save", { projectId: currentProject.id, stars: Number(reviewForm.querySelector('input[name="stars"]:checked')?.value || 0), body: document.querySelector("#review-body").value.trim() });
    currentProject = await loadPublicProject(currentProject.id);
    renderProject(currentProject, currentProject.reviews || []);
    await syncMyReview(auth.currentUser);
    reviewStatus.textContent = "Review saved.";
  } catch (error) { reviewStatus.textContent = error.message || "Review could not be saved."; }
  finally { button.disabled = false; }
});

document.querySelector("#delete-project-review").addEventListener("click", async () => {
  if (!currentProject || !confirm("Delete your review?")) return;
  reviewStatus.textContent = "Deleting review…";
  try {
    await storeApi("project-review-delete", { projectId: currentProject.id });
    currentProject = await loadPublicProject(currentProject.id);
    renderProject(currentProject, currentProject.reviews || []);
    await syncMyReview(auth.currentUser);
    reviewStatus.textContent = "Review deleted.";
  } catch (error) { reviewStatus.textContent = error.message || "Review could not be deleted."; }
});

onAuthStateChanged(auth, (user) => syncMyReview(user));

reviewForm.querySelectorAll('input[name="stars"]').forEach((input) => input.addEventListener("change", () => reviewForm.classList.add("has-rating")));

async function init() {
  if (!requestedId) { loading.hidden = true; errorView.hidden = false; return; }
  try {
    const project = await loadPublicProject(requestedId);
    currentProject = project;
    document.querySelector("#review-signin-link").href = `login.html?next=${encodeURIComponent(`projects.html?v=${requestedId}`)}`;
    renderProject(project, project.reviews || []);
    syncMyReview(auth.currentUser);
    loading.hidden = true; content.hidden = false;
  } catch (error) {
    console.error("Unable to load project:", error);
    errorView.querySelector("h1").textContent = error.message || "That project isn’t here.";
    loading.hidden = true; errorView.hidden = false;
  }
}

init();
