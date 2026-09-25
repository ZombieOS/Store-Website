import { auth, db as accountDb } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const grid = document.querySelector("#project-grid");
const emptyState = document.querySelector("#projects-empty");
const searchInput = document.querySelector("#project-search");
const modal = document.querySelector("#project-modal");
const form = document.querySelector("#project-form");
const nameInput = document.querySelector("#project-name");
const idInput = document.querySelector("#project-id");
const status = document.querySelector("#project-status");
const membershipOverlay = document.querySelector("#membership-overlay");
const dashboardName = document.querySelector("#dashboard-name");
const dashboardAvatar = document.querySelector("#dashboard-avatar");

let activeUser = null;
let projects = [];
let idEdited = false;
let creatorName = "";
let ownedOrganizations = [];

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

function setIdentity(user, profile) {
  const name = profile.username || user.displayName || user.email?.split("@")[0] || "ZombieOS user";
  dashboardName.textContent = name;
  const avatar = profile.avatarBase64 || user.photoURL;
  if (avatar) {
    const image = document.createElement("img");
    image.src = avatar; image.alt = ""; image.referrerPolicy = "no-referrer";
    dashboardAvatar.replaceChildren(image); dashboardAvatar.classList.add("has-image");
  } else dashboardAvatar.textContent = name.charAt(0).toUpperCase() || "Z";
}

function updateCounts() {
  document.querySelector("#project-count").textContent = String(projects.length);
  document.querySelector("#app-count").textContent = String(projects.filter((project) => project.type === "app").length);
  document.querySelector("#game-count").textContent = String(projects.filter((project) => project.type === "game").length);
}

function projectCard(project) {
  const article = document.createElement("article");
  article.className = "project-card";
  const top = document.createElement("div");
  top.className = "project-card-top";
  const kind = document.createElement("span");
  kind.className = "project-kind";
  kind.textContent = project.type === "game" ? ".zgame" : ".zapp";
  const state = document.createElement("span");
  state.className = "project-state";
  const isDraft = String(project.status || "draft").toLowerCase() === "draft";
  state.textContent = project.status || "Draft";
  top.append(kind, state);
  const title = document.createElement("h3");
  title.textContent = project.name;
  const identifier = document.createElement("span");
  identifier.className = "project-identifier";
  identifier.textContent = project.projectId;
  const description = document.createElement("p");
  description.textContent = project.description || "No description yet.";
  const manage = document.createElement("a");
  manage.href = `project.html?v=${encodeURIComponent(project.id || project.slug)}`;
  manage.textContent = isDraft ? "Edit draft →" : "Manage versions →";
  article.append(top, title, identifier, description);
  if (project.lastDenial?.reason) {
    const denial = document.createElement("div"); denial.className = "project-denial";
    denial.textContent = `Version denied: ${project.lastDenial.reason}`;
    article.append(denial);
  }
  article.append(manage);
  return article;
}

function renderProjects() {
  const term = searchInput.value.trim().toLowerCase();
  const visible = projects.filter((project) => `${project.name} ${project.projectId} ${project.description || ""}`.toLowerCase().includes(term));
  grid.replaceChildren(...visible.map(projectCard));
  emptyState.hidden = projects.length > 0 || term.length > 0;
}

async function loadProjects() {
  projects = (await storeApi("projects")).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  updateCounts(); renderProjects();
}

function openModal() {
  form.reset(); idEdited = false; status.textContent = ""; modal.hidden = false; nameInput.focus();
}
function closeModal() { modal.hidden = true; }

document.querySelector("#new-project-button").addEventListener("click", openModal);
document.querySelector("#empty-create-button").addEventListener("click", openModal);
document.querySelector("#dialog-close").addEventListener("click", closeModal);
document.querySelector("#dialog-cancel").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
searchInput.addEventListener("input", renderProjects);
nameInput.addEventListener("input", () => { if (!idEdited) idInput.value = slugify(nameInput.value); });
idInput.addEventListener("input", () => { idEdited = true; idInput.value = slugify(idInput.value); });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const slug = slugify(idInput.value);
  const type = new FormData(form).get("project-type");
  if (!name || !slug) { status.textContent = "Enter a project name and ID."; return; }
  const projectId = `zos.${slug}`;
  const documentId = slug;
  status.textContent = "Creating project...";
  try {
    if (projects.some((project) => project.slug === slug)) { status.textContent = "You already have a project with that ID."; return; }
    const now = Date.now();
    const formData = new FormData(form);
    const contributors = String(document.querySelector("#project-contributors").value || "").split(",").map((name) => name.trim()).filter(Boolean);
    const publisherValue = document.querySelector("#project-publisher").value;
    const organization = publisherValue.startsWith("organization:") ? ownedOrganizations.find((item) => item.id === publisherValue.slice(13)) : null;
    const publisherName = organization?.name || creatorName;
    const project = {
      ownerId: activeUser.uid,
      name,
      projectDisplayName: name,
      projectId,
      slug,
      type,
      description: document.querySelector("#project-description").value.trim(),
      version: document.querySelector("#project-version").value.trim(),
      projectVersion: document.querySelector("#project-version").value.trim(),
      creator: publisherName,
      creatorType: organization ? "organization" : "developer",
      organizationId: organization?.id || null,
      contributors: [...new Set(contributors.filter((name) => name.toLowerCase() !== publisherName.toLowerCase()))],
      supportedPlatforms: formData.getAll("platform"),
      status: "draft",
      downloads: 0,
      reviewCount: 0,
      ratingAverage: 0,
      releaseDate: null,
      mostRecentUpdate: now,
      createdAt: now,
      updatedAt: now
    };
    const created = await storeApi("project", project);
    window.location.href = `project.html?v=${encodeURIComponent(created.id)}`;
  } catch (error) {
    console.error("Unable to create project:", error);
    status.textContent = error.message || "The project could not be created.";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("../login.html"); return; }
  activeUser = user;
  try {
    const accountSnapshot = await getDoc(doc(accountDb, "users", user.uid));
    const profile = accountSnapshot.exists() ? accountSnapshot.data() : {};
    let state;
    try { state = await storeApi("me"); }
    catch (error) {
      if (error.status !== 403 || !profile.zdpMembership?.website) {
        if (error.status !== 403) throw error;
        document.body.classList.remove("dashboard-pending"); membershipOverlay.hidden = false; return;
      }
      await storeApi("join", { website: profile.zdpMembership.website, username: profile.username || user.displayName || "", avatar: profile.avatarBase64 || user.photoURL || "" });
      state = await storeApi("me");
    }
    setIdentity(user, profile);
    creatorName = state.profile?.username || state.member.profileId;
    ownedOrganizations = (await storeApi("organizations")).filter((item) => item.ownerId === user.uid || item.memberRoles?.some((role) => ["publisher", "manager"].includes(role)));
    const publisherSelect = document.querySelector("#project-publisher");
    publisherSelect.options[0].textContent = creatorName;
    ownedOrganizations.forEach((organization) => publisherSelect.add(new Option(organization.name, `organization:${organization.id}`)));
    await loadProjects();
    document.body.classList.remove("dashboard-pending");
    if (new URLSearchParams(window.location.search).get("new") === "1") openModal();
  } catch (error) {
    console.error("Unable to load projects:", error);
    document.body.classList.remove("dashboard-pending");
    emptyState.querySelector("h3").textContent = "Projects unavailable.";
    emptyState.querySelector("p").textContent = error.message || "The Store API could not load your projects.";
  }
});
