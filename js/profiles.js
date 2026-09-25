import { zsharpDb } from "./zsharp-firebase.js";
import { setupReportButton } from "./report-form.js";
import { loadPublicProfile } from "./catalog.js";
import { db as accountDb } from "./firebase.js";
import { setupFollow } from "./follow.js";
import { collection, doc, getDoc, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const requestedName = new URLSearchParams(window.location.search).get("v")?.trim() || "";
const loading = document.querySelector("#profile-loading");
const errorPanel = document.querySelector("#profile-error");
const errorCopy = document.querySelector("#profile-error-copy");
const profilePanel = document.querySelector("#public-profile");
let activeProfileId = requestedName;
setupReportButton(document.querySelector("#report-profile"), () => ({ targetType: "profile", targetId: activeProfileId }));

async function firstQuery(database, collectionName, field, value) {
  const results = await getDocs(query(collection(database, collectionName), where(field, "==", value), limit(1)));
  if (results.empty) return null;
  const match = results.docs[0];
  return { id: match.id, ...match.data() };
}

async function findProfile(name) {
  try { return await loadPublicProfile(name); }
  catch (error) { if (error.status !== 404) throw error; }
  try {
    const publicProfileById = await getDoc(doc(zsharpDb, "publicProfiles", name));
    if (publicProfileById.exists()) return { kind: "user", data: { id: publicProfileById.id, ...publicProfileById.data() } };

    const user = await firstQuery(zsharpDb, "publicProfiles", "username", name);
    if (user) return { kind: "user", data: user };

    const organizationById = await getDoc(doc(zsharpDb, "organizations", name));
    if (organizationById.exists()) return { kind: "organization", data: { id: organizationById.id, ...organizationById.data() } };

    const organization = await firstQuery(zsharpDb, "organizations", "name", name);
    if (organization) return { kind: "organization", data: organization };
  } catch (error) {
    if (error?.code !== "permission-denied") throw error;
    console.warn("Z# profiles are not readable yet; checking the migration source.");
  }

  // Temporary migration fallback for ZDP profiles that have not been copied
  // from the ZombieOS database into Z# yet.
  const legacyById = await getDoc(doc(accountDb, "publicProfiles", name));
  if (legacyById.exists()) return { kind: "user", data: { id: legacyById.id, ...legacyById.data(), migrationSource: "zombieos" } };

  const legacyUser = await firstQuery(accountDb, "publicProfiles", "username", name);
  if (legacyUser) return { kind: "user", data: { ...legacyUser, migrationSource: "zombieos" } };
  return null;
}

function validWebUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function showError(message) {
  loading.hidden = true;
  errorCopy.textContent = message;
  errorPanel.hidden = false;
}

function renderBadges(data) {
  const container = document.querySelector("#profile-badges");
  const badges = data.displayBadges === false ? [] : (Array.isArray(data.badges) ? data.badges : []);
  const visible = badges.filter((badge) => data.visibleBadges?.[badge] !== false);
  if (!visible.length) {
    const empty = document.createElement("span");
    empty.className = "profile-empty-copy";
    empty.textContent = "No public badges.";
    container.append(empty);
    return;
  }
  visible.forEach((badge) => {
    const element = document.createElement("span");
    element.className = "profile-badge";
    element.textContent = badge;
    container.append(element);
  });
}

function renderSocials(data) {
  const container = document.querySelector("#profile-socials");
  const socials = data.socials || {};
  const labels = { youtube:"YouTube", github:"GitHub", discord:"Discord", instagram:"Instagram", facebook:"Facebook", twitter:"Twitter / X" };
  let count = 0;
  Object.entries(labels).forEach(([key, label]) => {
    const value = socials[key];
    if (!value) return;
    const url = validWebUrl(value);
    const element = document.createElement(url ? "a" : "span");
    element.textContent = url ? label : `${label}: ${value}`;
    if (url) { element.href = url; element.target = "_blank"; element.rel = "noreferrer"; }
    container.append(element);
    count += 1;
  });
  if (!count) {
    const empty = document.createElement("span");
    empty.className = "profile-empty-copy";
    empty.textContent = "No social links.";
    container.append(empty);
  }
}

const popularLinkIcons = [
  [/youtube\.com|youtu\.be/i, "https://cdn.simpleicons.org/youtube/ff0000"],
  [/discord\.gg|discord\.com/i, "https://cdn.simpleicons.org/discord/5865F2"],
  [/github\.com/i, "https://cdn.simpleicons.org/github/ffffff"],
  [/twitch\.tv/i, "https://cdn.simpleicons.org/twitch/9146FF"],
  [/(^|\.)x\.com|twitter\.com/i, "https://cdn.simpleicons.org/x/ffffff"],
  [/instagram\.com/i, "https://cdn.simpleicons.org/instagram/E4405F"],
  [/tiktok\.com/i, "https://cdn.simpleicons.org/tiktok/ffffff"],
  [/reddit\.com/i, "https://cdn.simpleicons.org/reddit/FF4500"]
];

function renderCustomLinks(data) {
  const container = document.querySelector("#profile-socials");
  const customLinks = Array.isArray(data.links) ? data.links : [];
  customLinks.forEach((link) => {
    const url = validWebUrl(link.url);
    if (!url) return;
    const anchor = document.createElement("a"); anchor.href = url; anchor.target = "_blank"; anchor.rel = "noreferrer";
    const iconUrl = popularLinkIcons.find(([pattern]) => pattern.test(url))?.[1];
    if (iconUrl) { const icon = document.createElement("img"); icon.src = iconUrl; icon.alt = ""; anchor.append(icon); }
    anchor.append(document.createTextNode(link.label || new URL(url).hostname)); container.append(anchor);
  });
  if (!container.children.length) { const empty = document.createElement("span"); empty.className = "profile-empty-copy"; empty.textContent = "No links added."; container.append(empty); }
}

async function renderProjects(name, providedProjects) {
  const container = document.querySelector("#profile-project-list");
  if (Array.isArray(providedProjects)) {
    if (!providedProjects.length) return;
    container.replaceChildren(...providedProjects.map((project) => {
      const link = document.createElement("a"); link.className = "profile-project-item"; link.href = `projects.html?v=${encodeURIComponent(project.id || project.projectId)}`;
      const icon = document.createElement("img"); icon.src = project.icon || "https://www.zsharp.zombieos.com/zsharp.png"; icon.alt = "";
      const details = document.createElement("div"); const title = document.createElement("strong"); title.textContent = project.name;
      const copy = document.createElement("span"); copy.textContent = project.description || (project.type === "game" ? ".zgame" : ".zapp"); details.append(title, copy);
      const arrow = document.createElement("b"); arrow.textContent = "→"; link.append(icon, details, arrow); return link;
    }));
    return;
  }
  try {
    const results = await getDocs(query(collection(zsharpDb, "projects"), where("creator", "==", name), where("status", "==", "published")));
    if (results.empty) return;
    container.replaceChildren(...results.docs.map((result) => {
      const project = result.data(); const link = document.createElement("a"); link.className = "profile-project-item"; link.href = `projects.html?v=${encodeURIComponent(project.projectId)}`;
      const icon = document.createElement("img"); icon.src = project.icon || "https://www.zsharp.zombieos.com/zsharp.png"; icon.alt = "";
      const details = document.createElement("div"); const title = document.createElement("strong"); title.textContent = project.name || project.projectDisplayName; const copy = document.createElement("span"); copy.textContent = project.description || (project.type === "game" ? ".zgame" : ".zapp"); details.append(title, copy);
      const arrow = document.createElement("b"); arrow.textContent = "→"; link.append(icon, details, arrow); return link;
    }));
  } catch (error) { console.warn("Published projects could not be loaded:", error); }
}

function renderProfile(profile) {
  const { kind, data } = profile;
  activeProfileId = data.id || requestedName;
  const isOrganization = kind === "organization";
  const name = data.username || data.name || requestedName;
  const handle = data.handle ? `@${String(data.handle).replace(/^@/, "")}` : (isOrganization ? "Organization" : "ZombieOS account");
  const avatar = data.avatarBase64 || data.avatar || data.logo || "https://www.zsharp.zombieos.com/zsharp.png";
  const banner = data.bannerBase64 || data.banner || "";

  document.title = `${name} — ZOS Store`;
  const moderated = data.moderationStatus && data.moderationStatus !== "active";
  document.querySelector("#profile-moderation-notice").hidden = !moderated;
  document.querySelector("#report-profile").hidden = Boolean(moderated);
  document.querySelector("#profile-type").textContent = isOrganization ? "ORGANIZATION" : "DEVELOPER";
  profilePanel.classList.toggle("organization-profile", isOrganization);
  document.querySelector("#profile-name").textContent = name;
  const verification = document.querySelector("#profile-verification");
  verification.hidden = moderated || data.verified !== true;
  verification.title = data.verificationMethod === "dns" ? `Verified domain: ${data.verifiedDomain}` : "Verified by 500,000 Store downloads";
  document.querySelector("#profile-handle").textContent = handle;
  document.querySelector("#profile-downloads").textContent = Number(data.totalDownloads || 0).toLocaleString();
  const memberCount = document.querySelector("#profile-member-count");
  memberCount.hidden = !isOrganization;
  memberCount.textContent = isOrganization ? `${Number(data.memberCount || 1).toLocaleString()} members` : "";
  const members = document.querySelector("#profile-members");
  members.hidden = !isOrganization;
  if (isOrganization) document.querySelector("#profile-member-list").replaceChildren(...(data.members || []).map((member) => {
    const link = document.createElement("a"); link.className = "profile-member"; link.href = `profiles.html?v=${encodeURIComponent(member.profileId)}`;
    const picture = document.createElement("img"); picture.src = member.avatar || "https://www.zsharp.zombieos.com/zsharp.png"; picture.alt = "";
    const name = document.createElement("span"); name.textContent = member.name;
    const role = document.createElement("b"); role.textContent = member.role || "Member";
    link.append(picture, name, role); return link;
  }));
  setupFollow(document.querySelector("#profile-follow"), { type: isOrganization ? "organization" : "developer", id: activeProfileId });
  document.querySelector("#profile-avatar").src = avatar;
  const bannerImage = document.querySelector("#profile-banner");
  if (banner) bannerImage.src = banner;
  else bannerImage.removeAttribute("src");
  document.querySelector("#profile-bio").textContent = data.bio || data.description || "This profile has not added a bio yet.";
  document.querySelector("#profile-pronouns").textContent = data.pronouns ? `Pronouns: ${data.pronouns}` : "";
  if (!isOrganization) renderBadges(data);
  document.querySelector("#links-label").textContent = isOrganization ? "LINKS" : "SOCIALS";
  if (isOrganization) renderCustomLinks(data); else renderSocials(data);
  renderProjects(name, data.projects);
  loading.hidden = true;
  profilePanel.hidden = false;
}

async function loadProfile() {
  if (!requestedName) {
    showError("Add ?v=USERNAME to the address to view a Store profile.");
    return;
  }
  try {
    const profile = await findProfile(requestedName);
    if (!profile) showError(`No user or organization named “${requestedName}” was found.`);
    else if (profile.kind === "user" && profile.data.publicProfile === false) showError("This ZombieOS profile is private.");
    else renderProfile(profile);
  } catch (error) {
    console.error("Unable to load Store profile:", error);
    showError("The Store could not load this profile. Please try again later.");
  }
}

loadProfile();
