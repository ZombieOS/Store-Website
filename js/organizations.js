import { auth, db as accountDb } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const grid = document.querySelector("#organization-grid");
const empty = document.querySelector("#organizations-empty");
const modal = document.querySelector("#organization-modal");
const form = document.querySelector("#organization-form");
const linksContainer = document.querySelector("#custom-links");
const nameInput = document.querySelector("#organization-name");
const status = document.querySelector("#organization-status");
let organizations = [];
let editingId = "";

function slugify(value) {
  return value.trim().replaceAll("/", "-").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 50);
}

function addLink(data = {}) {
  const row = document.createElement("div");
  row.className = "custom-link";
  const label = document.createElement("input");
  label.className = "link-label"; label.maxLength = 30; label.placeholder = "Label"; label.value = data.label || "";
  const url = document.createElement("input");
  url.className = "link-url"; url.type = "url"; url.placeholder = "https://..."; url.value = data.url || "";
  const remove = document.createElement("button");
  remove.type = "button"; remove.ariaLabel = "Remove link"; remove.textContent = "×"; remove.addEventListener("click", () => row.remove());
  row.append(label, url, remove);
  linksContainer.append(row);
}

function openEditor(org = null) {
  editingId = org?.id || "";
  form.reset(); linksContainer.replaceChildren();
  nameInput.disabled = Boolean(org);
  nameInput.value = org?.name || "";
  document.querySelector("#organization-bio").value = org?.bio || "";
  document.querySelector("#organization-logo").value = org?.logo || "";
  document.querySelector("#organization-banner").value = org?.banner || "";
  (org?.links || [{}]).forEach(addLink);
  document.querySelector("#organization-slug").textContent = org?.id || "organization";
  document.querySelector("#organization-form-title").textContent = org ? "Edit organization" : "Create an organization";
  status.textContent = "";
  modal.hidden = false;
}

function render() {
  grid.replaceChildren(...organizations.map((org) => {
    const card = document.createElement("article"); card.className = "organization-card";
    const head = document.createElement("div"); head.className = "organization-card-head";
    const image = document.createElement("img"); image.src = org.logo || "https://www.zsharp.zombieos.com/zsharp.png"; image.alt = "";
    const title = document.createElement("h2"); title.textContent = org.name; head.append(image, title);
    const bio = document.createElement("p"); bio.textContent = org.bio || "No bio yet.";
    const actions = document.createElement("div"); actions.className = "organization-card-actions";
    const view = document.createElement("a"); view.href = `../profiles.html?v=${encodeURIComponent(org.id)}`; view.textContent = "View profile ↗";
    const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit"; edit.addEventListener("click", () => openEditor(org));
    actions.append(view, edit); card.append(head, bio, actions); return card;
  }));
  empty.hidden = organizations.length > 0;
}

document.querySelector("#new-organization").addEventListener("click", () => openEditor());
document.querySelector("#empty-create").addEventListener("click", () => openEditor());
document.querySelector("#organization-close").addEventListener("click", () => { modal.hidden = true; });
document.querySelector("#organization-cancel").addEventListener("click", () => { modal.hidden = true; });
document.querySelector("#add-link").addEventListener("click", () => addLink());
nameInput.addEventListener("input", () => { document.querySelector("#organization-slug").textContent = slugify(nameInput.value) || "organization"; });
modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = editingId || slugify(nameInput.value);
  if (!id) { status.textContent = "Enter an organization name."; return; }
  const links = [...linksContainer.querySelectorAll(".custom-link")].map((row) => ({
    label: row.querySelector(".link-label").value.trim(), url: row.querySelector(".link-url").value.trim()
  })).filter((link) => link.label && link.url);
  const data = { id, name: nameInput.value.trim(), bio: document.querySelector("#organization-bio").value.trim(),
    logo: document.querySelector("#organization-logo").value.trim(), banner: document.querySelector("#organization-banner").value.trim(), links };
  status.textContent = "Saving...";
  try {
    await storeApi("organization", data);
    organizations = await storeApi("organizations");
    render(); modal.hidden = true;
  } catch (error) {
    console.error("Unable to save organization:", error);
    status.textContent = error.message;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("../login.html"); return; }
  try {
    const account = await getDoc(doc(accountDb, "users", user.uid));
    const profile = account.data() || {};
    document.querySelector("#dashboard-name").textContent = profile.username || user.displayName || "ZombieOS user";
    const avatar = profile.avatarBase64 || user.photoURL;
    if (avatar) {
      const img = document.createElement("img"); img.src = avatar; img.alt = "";
      document.querySelector("#dashboard-avatar").replaceChildren(img);
      document.querySelector("#dashboard-avatar").classList.add("has-image");
    }
    organizations = await storeApi("organizations");
    render();
  } catch (error) {
    console.error("Unable to load organizations:", error);
    empty.querySelector("h3").textContent = "Organizations unavailable.";
    empty.querySelector("p").textContent = error.message;
  } finally { document.body.classList.remove("dashboard-pending"); }
});
