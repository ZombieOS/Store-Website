import { auth, db as accountDb } from "./firebase.js";
import { storeApi, storeUpload } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const requestedId = new URLSearchParams(location.search).get("v")?.trim() || "";
const form = document.querySelector("#project-edit-form");
const errorView = document.querySelector("#editor-error");
const saveStatus = document.querySelector("#save-status");
const saveButton = document.querySelector("#save-project");
const iconPreview = document.querySelector("#icon-preview");
const bannerPreview = document.querySelector("#banner-preview");
const bannerPlaceholder = document.querySelector("#banner-placeholder");
let project = null;
let icon = "";
let banner = "";
let screenshots = [];
let imageBusy = false;

function setIdentity(user, profile) {
  const name = profile.username || user.displayName || user.email?.split("@")[0] || "ZombieOS user";
  document.querySelector("#dashboard-name").textContent = name;
  const source = profile.avatarBase64 || user.photoURL;
  if (source) {
    const img = document.createElement("img"); img.src = source; img.alt = "";
    document.querySelector("#dashboard-avatar").replaceChildren(img);
    document.querySelector("#dashboard-avatar").classList.add("has-image");
  } else document.querySelector("#dashboard-avatar").textContent = name.charAt(0).toUpperCase() || "Z";
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

function showError(message) {
  errorView.textContent = message;
  errorView.hidden = false;
  document.body.classList.remove("dashboard-pending");
}

function renderArtwork() {
  iconPreview.src = icon || "https://www.zsharp.zombieos.com/zsharp.png";
  if (banner) {
    bannerPreview.src = banner;
    bannerPreview.hidden = false;
    bannerPlaceholder.hidden = true;
  } else {
    bannerPreview.removeAttribute("src");
    bannerPreview.hidden = true;
    bannerPlaceholder.hidden = false;
  }
  const list = document.querySelector("#screenshot-list");
  list.replaceChildren(...screenshots.map((source, index) => {
    const item = document.createElement("div"); item.className = "screenshot-item";
    const img = document.createElement("img"); img.src = source; img.alt = `Screenshot ${index + 1}`;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.ariaLabel = `Remove screenshot ${index + 1}`;
    remove.addEventListener("click", () => { screenshots.splice(index, 1); renderArtwork(); });
    item.append(img, remove); return item;
  }));
  document.querySelector("#screenshot-input").disabled = screenshots.length >= 5;
}

function renderDenial(value) {
  const alert = document.querySelector("#denial-alert");
  const denial = value.lastDenial;
  alert.hidden = !denial?.reason;
  if (denial?.reason) document.querySelector("#denial-reason").textContent = `${denial.version || "Version"}: ${denial.reason}`;
}

function populate(value) {
  project = value;
  document.title = `Edit ${value.name || "draft"} — ZOS Store`;
  document.querySelector("#editor-heading").textContent = value.name || "Edit draft.";
  document.querySelector("#project-state").textContent = value.status || "draft";
  document.querySelector("#display-name").value = value.name || value.projectDisplayName || "";
  document.querySelector("#project-slug").value = value.slug || value.id;
  document.querySelector("#project-type").value = value.type || "app";
  document.querySelector("#project-publisher").value = value.organizationId ? `organization:${value.organizationId}` : "profile";
  document.querySelector("#project-version").value = value.version || value.projectVersion || "0.1.0";
  document.querySelector("#project-description").value = value.description || "";
  document.querySelector("#description-count").textContent = String((value.description || "").length);
  document.querySelector("#project-contributors").value = (value.contributors || []).join(", ");
  for (const input of form.querySelectorAll('input[name="platform"]')) input.checked = (value.supportedPlatforms || []).includes(input.value);
  icon = value.icon || "";
  banner = value.banner || "";
  screenshots = Array.isArray(value.screenshots) ? value.screenshots.slice(0, 5) : [];
  renderArtwork();
  renderDenial(value);
  form.hidden = false;
  document.querySelector("#release-panel").hidden = false;
  if (String(value.status || "draft").toLowerCase() !== "draft") {
    document.querySelector("#editor-heading").textContent = value.name || "Manage project";
    for (const control of form.querySelectorAll("input, select, textarea, button")) control.disabled = true;
    saveStatus.textContent = "Project details are locked after the first release. You can still submit and delete versions below.";
  }
  document.body.classList.remove("dashboard-pending");
}

async function compactImage(file, widthLimit, maxLength) {
  if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("Choose a PNG, JPEG, or WebP image under 10 MB.");
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, widthLimit / bitmap.width);
  let width = Math.max(1, Math.round(bitmap.width * scale));
  let height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    for (let attempt = 0; attempt < 9; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
      const data = canvas.toDataURL("image/webp", Math.max(.35, .82 - attempt * .07));
      if (data.length <= maxLength) return data;
      scale *= .8;
      width = Math.max(1, Math.round(bitmap.width * scale));
      height = Math.max(1, Math.round(bitmap.height * scale));
    }
  } finally { bitmap.close(); }
  throw new Error("That image could not be reduced enough. Try a smaller image.");
}

function bindImage(inputId, setter, width, length) {
  document.querySelector(inputId).addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    imageBusy = true; saveButton.disabled = true;
    saveStatus.className = ""; saveStatus.textContent = "Preparing image...";
    try {
      setter(await compactImage(file, width, length));
      renderArtwork(); saveStatus.textContent = "Image ready. Save the draft to keep it.";
    } catch (error) {
      saveStatus.className = "error"; saveStatus.textContent = error.message;
    } finally { imageBusy = false; saveButton.disabled = false; }
  });
}

bindImage("#project-icon-input", (value) => { icon = value; }, 512, 160_000);
bindImage("#project-banner-input", (value) => { banner = value; }, 1600, 320_000);
document.querySelector("#screenshot-input").addEventListener("change", async (event) => {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  if (screenshots.length + files.length > 5) { saveStatus.className = "error"; saveStatus.textContent = "You can add up to five screenshots."; event.target.value = ""; return; }
  imageBusy = true; saveButton.disabled = true; saveStatus.className = ""; saveStatus.textContent = "Preparing screenshots...";
  try {
    for (const file of files) screenshots.push(await compactImage(file, 1000, 60_000));
    renderArtwork(); saveStatus.textContent = "Screenshots ready. Save the draft to keep them.";
  } catch (error) { saveStatus.className = "error"; saveStatus.textContent = error.message; }
  finally { imageBusy = false; saveButton.disabled = false; event.target.value = ""; }
});
document.querySelector("#remove-icon").addEventListener("click", () => { icon = ""; document.querySelector("#project-icon-input").value = ""; renderArtwork(); });
document.querySelector("#remove-banner").addEventListener("click", () => { banner = ""; document.querySelector("#project-banner-input").value = ""; renderArtwork(); });
document.querySelector("#project-slug").addEventListener("input", (event) => { event.target.value = slugify(event.target.value); });
document.querySelector("#project-description").addEventListener("input", (event) => { document.querySelector("#description-count").textContent = String(event.target.value.length); });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!project || imageBusy) return;
  const publisher = document.querySelector("#project-publisher").value;
  const next = {
    id: project.id,
    slug: slugify(document.querySelector("#project-slug").value),
    name: document.querySelector("#display-name").value.trim(),
    type: document.querySelector("#project-type").value,
    organizationId: publisher.startsWith("organization:") ? publisher.slice(13) : null,
    version: document.querySelector("#project-version").value.trim(),
    icon, banner, screenshots,
    description: document.querySelector("#project-description").value.trim(),
    contributors: document.querySelector("#project-contributors").value.split(",").map((value) => value.trim()).filter(Boolean),
    supportedPlatforms: [...form.querySelectorAll('input[name="platform"]:checked')].map((input) => input.value)
  };
  saveButton.disabled = true; saveStatus.className = ""; saveStatus.textContent = "Saving draft...";
  try {
    const result = await storeApi("project-update", next);
    project = { ...project, ...next, id: result.id, projectId: result.projectId };
    history.replaceState(null, "", `project.html?v=${encodeURIComponent(result.id)}`);
    document.querySelector("#editor-heading").textContent = next.name;
    document.title = `Edit ${next.name} — ZOS Store`;
    saveStatus.textContent = "Draft saved.";
  } catch (error) {
    saveStatus.className = "error"; saveStatus.textContent = error.message || "The draft could not be saved.";
  } finally { saveButton.disabled = false; }
});

const versionModal = document.querySelector("#version-modal");
const versionForm = document.querySelector("#version-form");
const versionStatus = document.querySelector("#version-status");

function closeVersionModal() { versionModal.hidden = true; }
document.querySelector("#version-close").addEventListener("click", closeVersionModal);
document.querySelector("#version-cancel").addEventListener("click", closeVersionModal);
versionModal.addEventListener("click", (event) => { if (event.target === versionModal) closeVersionModal(); });
document.querySelector("#new-version-button").addEventListener("click", () => {
  if (!project) return;
  versionForm.reset(); versionStatus.textContent = "";
  const extension = project.type === "game" ? ".zgame" : ".zapp";
  document.querySelector("#version-file").accept = extension;
  document.querySelector("#package-extension").textContent = extension;
  document.querySelector("#version-number").value = project.status === "draft" ? (project.version || "0.1.0") : "";
  document.querySelector("#version-display-name").value = project.name || "";
  document.querySelector("#version-vr").checked = (project.supportedPlatforms || []).some((name) => ["Meta Quest", "OpenXR"].includes(name));
  versionModal.hidden = false;
});

function renderVersions(items) {
  const list = document.querySelector("#release-list");
  document.querySelector("#release-empty").hidden = items.length > 0;
  list.replaceChildren(...items.map((item) => {
    const card = document.createElement("article"); card.className = "release-card";
    const body = document.createElement("div");
    const title = document.createElement("h3"); title.textContent = `${item.displayName || project.name} · ${item.version}`;
    const meta = document.createElement("p"); meta.textContent = `Z# ${item.zsharpVersion || "—"} · ${new Date(item.submittedAt).toLocaleDateString()}`;
    const tags = document.createElement("div"); tags.className = "release-tags";
    for (const value of [item.priority || "NEW", item.status || "pending", ...(item.requiresVrReview ? ["VR"] : [])]) {
      const tag = document.createElement("span"); tag.textContent = value; if (value === "denied") tag.className = "denied"; tags.append(tag);
    }
    const notes = document.createElement("p"); notes.textContent = item.denialReason ? `Denied: ${item.denialReason}` : item.changelog || "No changelog.";
    body.append(title, meta, tags, notes);
    const actions = document.createElement("div"); actions.className = "release-actions";
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete version";
    remove.addEventListener("click", async () => {
      if (!confirm(`Delete version ${item.version}? Its uploaded file will be removed too.`)) return;
      remove.disabled = true;
      try {
        await storeApi("version-delete", { projectId: project.id, id: item.id });
        location.reload();
      } catch (error) { document.querySelector("#release-status").textContent = error.message; remove.disabled = false; }
    });
    actions.append(remove); card.append(body, actions); return card;
  }));
}

async function loadVersions() {
  const versions = await storeApi("project-versions", { id: project.id });
  renderVersions(versions);
}

versionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!project) return;
  const file = document.querySelector("#version-file").files?.[0];
  const extension = project.type === "game" ? ".zgame" : ".zapp";
  if (!file || !file.name.toLowerCase().endsWith(extension)) { versionStatus.textContent = `Select one ${extension} file.`; return; }
  if (file.size > 40 * 1024 * 1024) { versionStatus.textContent = "Choose a package under 40 MB."; return; }
  const header = new TextDecoder().decode(await file.slice(0, 6).arrayBuffer());
  if (header === "ZSPKG1") { versionStatus.textContent = "This package is bytecoded. Upload an unbytecoded source package."; return; }
  const button = document.querySelector("#submit-version");
  button.disabled = true; versionStatus.textContent = "Uploading source package...";
  try {
    await storeUpload("submit-version", {
      projectId: project.id,
      version: document.querySelector("#version-number").value.trim(),
      displayName: document.querySelector("#version-display-name").value.trim(),
      zsharpVersion: document.querySelector("#zsharp-version").value.trim(),
      changelog: document.querySelector("#version-changelog").value.trim(),
      vrSupported: document.querySelector("#version-vr").checked
    }, file);
    closeVersionModal();
    document.querySelector("#release-status").textContent = "Version submitted for review.";
    await loadVersions();
  } catch (error) { versionStatus.textContent = error.message || "The version could not be submitted."; }
  finally { button.disabled = false; }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("../login.html"); return; }
  if (!requestedId) { showError("No project ID was provided. Open a draft from the Projects page."); return; }
  try {
    const account = await getDoc(doc(accountDb, "users", user.uid));
    setIdentity(user, account.data() || {});
    const state = await storeApi("me");
    const organizations = await storeApi("organizations");
    const publisher = document.querySelector("#project-publisher");
    publisher.options[0].textContent = state.profile?.username || "Your ZDP profile";
    for (const org of organizations) publisher.add(new Option(org.name, `organization:${org.id}`));
    const value = await storeApi("project-detail", { id: requestedId });
    populate(value);
    await loadVersions();
  } catch (error) {
    console.error("Unable to open project editor:", error);
    showError(error.message || "This draft could not be opened.");
  }
});
