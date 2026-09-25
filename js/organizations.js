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
let memberOrganization = null;
let signedInUid = "";

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
    if (org.verified || org.verificationMethod === "dns") { const badge = document.createElement("span"); badge.className = "organization-verified"; badge.textContent = "✓"; badge.title = "Verified Store organization"; head.append(badge); }
    const bio = document.createElement("p"); bio.textContent = org.bio || "No bio yet.";
    const actions = document.createElement("div"); actions.className = "organization-card-actions";
    const view = document.createElement("a"); view.href = `../profiles.html?v=${encodeURIComponent(org.id)}`; view.textContent = "View profile ↗";
    if (org.ownerId === signedInUid || org.memberRoles?.includes("manager")) {
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit"; edit.addEventListener("click", () => openEditor(org)); actions.append(edit);
      const team = document.createElement("button"); team.type = "button"; team.textContent = "Team"; team.addEventListener("click", () => openMembers(org)); actions.append(team);
    }
    actions.prepend(view); card.append(head, bio, actions); return card;
  }));
  empty.hidden = organizations.length > 0;
}

async function openMembers(org) {
  memberOrganization = org;
  const panel = document.querySelector("#members-panel"); panel.hidden = false;
  document.querySelector("#members-title").textContent = `${org.name} members`;
  const container = document.querySelector("#member-list"); container.textContent = "Loading team…";
  try {
    const members = await storeApi("organization-members", { id: org.id });
    container.replaceChildren(...members.map((member) => {
      const row = document.createElement("div"); row.className = "member-row";
      const link = document.createElement("a"); link.href = `../profiles.html?v=${encodeURIComponent(member.profileId)}`;
      const avatar = document.createElement("img"); avatar.src = member.avatar || "https://www.zsharp.zombieos.com/zsharp.png"; avatar.alt = "";
      link.append(avatar, document.createTextNode(member.name));
      const roles = document.createElement("span"); roles.textContent = member.role;
      row.append(link, roles);
      if (org.ownerId === signedInUid && member.uid !== signedInUid) {
        const permissions = document.createElement("div"); permissions.className = "member-permissions";
        for (const role of ["manager", "publisher", "verification"]) {
          const label = document.createElement("label"); const box = document.createElement("input"); box.type = "checkbox"; box.value = role; box.checked = member.roles.includes(role);
          label.append(box, document.createTextNode(role)); permissions.append(label);
        }
        const save = document.createElement("button"); save.type = "button"; save.textContent = "Save permissions";
        save.addEventListener("click", async () => {
          try { await storeApi("organization-member-roles", { organizationId: org.id, uid: member.uid, roles: [...permissions.querySelectorAll(":checked")].map((box) => box.value) }); await openMembers(org); }
          catch (error) { document.querySelector("#members-status").textContent = error.message; }
        });
        const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove";
        remove.addEventListener("click", async () => { if (!confirm(`Remove ${member.name} from ${org.name}?`)) return; try { await storeApi("organization-member-remove", { organizationId: org.id, uid: member.uid }); await openMembers(org); } catch (error) { document.querySelector("#members-status").textContent = error.message; } });
        row.append(permissions, save, remove);
      }
      return row;
    }));
    document.querySelector("#revenue-rows").replaceChildren(...members.map((member) => {
      const label = document.createElement("label"); label.textContent = member.name;
      const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = "100"; input.placeholder = "%"; input.disabled = true;
      label.append(input); return label;
    }));
  } catch (error) { container.textContent = error.message; }
  panel.scrollIntoView({ behavior: "smooth" });
}

document.querySelector("#invite-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#members-status"); message.textContent = "Sending invitation…";
  try {
    await storeApi("organization-invite", { organizationId: memberOrganization.id, username: document.querySelector("#invite-username").value.trim(), roles: [...document.querySelectorAll('#invite-form input[type="checkbox"]:checked')].map((item) => item.value) });
    message.textContent = "Invitation sent. They must accept it from their Organizations dashboard.";
    event.target.reset();
  } catch (error) { message.textContent = error.message; }
});

async function loadInvites() {
  const invites = await storeApi("organization-invites");
  const panel = document.querySelector("#organization-invites"); panel.hidden = !invites.length;
  document.querySelector("#invite-list").replaceChildren(...invites.map((invite) => {
    const row = document.createElement("div"); row.className = "invite-row";
    const label = document.createElement("strong"); label.textContent = `${invite.organizationName} invited you (${invite.roles.join(", ")})`;
    for (const [accept, caption] of [[true, "Accept"], [false, "Decline"]]) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = caption;
      button.addEventListener("click", async () => { button.disabled = true; try { await storeApi("organization-invite-decision", { id: invite.id, accept }); organizations = await storeApi("organizations"); render(); await loadInvites(); } catch (error) { button.disabled = false; alert(error.message); } });
      row.append(button);
    }
    row.prepend(label); return row;
  }));
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
  signedInUid = user.uid;
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
    await loadInvites();
  } catch (error) {
    console.error("Unable to load organizations:", error);
    empty.querySelector("h3").textContent = "Organizations unavailable.";
    empty.querySelector("p").textContent = error.message;
  } finally { document.body.classList.remove("dashboard-pending"); }
});
