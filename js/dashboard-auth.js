import { auth, db as accountDb } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const dashboardName = document.querySelector("#dashboard-name");
const dashboardAvatar = document.querySelector("#dashboard-avatar");
const membershipOverlay = document.querySelector("#membership-overlay");
const dashboardProfileLink = document.querySelector("#dashboard-profile-link");
const projectStatus = document.querySelector("#dashboard-project-status");
const projectList = document.querySelector("#dashboard-project-list");
const projectEmpty = document.querySelector("#dashboard-project-empty");

function unlockDashboard() {
  document.body.classList.remove("dashboard-pending");
}

function blockDashboard() {
  unlockDashboard();
  membershipOverlay.hidden = false;
}

function showDashboardError(error) {
  unlockDashboard();
  membershipOverlay.hidden = false;
  membershipOverlay.querySelector("h2").textContent = "Dashboard unavailable.";
  membershipOverlay.querySelector(".membership-popup>p:not(.section-label)").textContent = error.message || "The Store API could not be reached.";
}

function setDashboardIdentity(user, profile) {
  const name = profile.username || user.displayName || user.email?.split("@")[0] || "ZombieOS user";
  dashboardName.textContent = name;
  dashboardProfileLink.href = "profile.html";

  const avatarSource = profile.avatarBase64 || user.photoURL;
  if (avatarSource) {
    const image = document.createElement("img");
    image.src = avatarSource;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    dashboardAvatar.replaceChildren(image);
    dashboardAvatar.classList.add("has-image");
  } else {
    dashboardAvatar.textContent = name.trim().charAt(0).toUpperCase() || "Z";
  }
}

function renderOverview(projects) {
  const published = projects.filter((project) => project.status === "published");
  document.querySelector("#dashboard-downloads").textContent = published.reduce((total, project) => total + Number(project.downloads || 0), 0).toLocaleString();
  document.querySelector("#dashboard-published").textContent = String(published.length);
  document.querySelector("#dashboard-apps").textContent = String(published.filter((project) => project.type === "app").length);
  document.querySelector("#dashboard-games").textContent = String(published.filter((project) => project.type === "game").length);
  projectStatus.hidden = true;
  projectEmpty.hidden = projects.length > 0;
  projectList.hidden = projects.length === 0;
  projectList.replaceChildren(...projects.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 5).map((project) => {
    const link = document.createElement("a");
    link.className = "dashboard-project-item";
    link.href = `project.html?v=${encodeURIComponent(project.id)}`;
    const details = document.createElement("div");
    const title = document.createElement("strong"); title.textContent = project.name || project.projectDisplayName || project.id;
    const meta = document.createElement("span"); meta.textContent = `${project.type === "game" ? "Game" : "App"} · ${project.projectId || project.id}`;
    details.append(title, meta);
    const state = document.createElement("span"); state.className = "dashboard-project-state"; state.textContent = project.status || "draft";
    link.append(details, state);
    return link;
  }));
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("../login.html");
    return;
  }

  const accountPromise = getDoc(doc(accountDb, "users", user.uid)).then((snapshot) => snapshot.exists() ? snapshot.data() : {}).catch(() => ({}));
  let projectsPromise = storeApi("projects").then((data) => ({ data }), (error) => ({ error }));
  try {
    let membership;
    try { membership = await storeApi("me"); }
    catch (error) {
      if (error.status !== 403) throw error;
      const profile = await accountPromise;
      if (!profile.zdpMembership?.website) { blockDashboard(); return; }
      await storeApi("join", { website: profile.zdpMembership.website, username: profile.username || user.displayName || "", avatar: profile.avatarBase64 || user.photoURL || "" });
      membership = await storeApi("me");
      projectsPromise = storeApi("projects").then((data) => ({ data }), (retryError) => ({ error: retryError }));
    }
    setDashboardIdentity(user, membership?.profile || {});
    unlockDashboard();
    accountPromise.then((profile) => setDashboardIdentity(user, profile)).catch(() => {});
    const result = await projectsPromise;
    if (result.error) throw result.error;
    renderOverview(result.data);
  } catch (error) {
    console.error("Unable to load dashboard:", error);
    if (document.body.classList.contains("dashboard-pending")) showDashboardError(error);
    else { projectStatus.textContent = error.message || "Your projects could not be loaded."; projectStatus.hidden = false; }
  }
});
