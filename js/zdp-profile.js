import { auth, db as accountDb } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const form = document.querySelector("#zdp-profile-form");
const nameInput = document.querySelector("#zdp-name");
const bioInput = document.querySelector("#zdp-bio");
const avatarInput = document.querySelector("#avatar-input");
const bannerInput = document.querySelector("#banner-input");
const avatarPreview = document.querySelector("#avatar-preview");
const bannerPreview = document.querySelector("#banner-preview");
const profileSlug = document.querySelector("#profile-slug");
const publicProfileLink = document.querySelector("#public-profile-link");
const saveStatus = document.querySelector("#save-status");
const membershipOverlay = document.querySelector("#membership-overlay");
const dashboardName = document.querySelector("#dashboard-name");
const dashboardAvatar = document.querySelector("#dashboard-avatar");

let activeUser = null;
let accountProfile = {};
let activeProfile = {};
let activeProfileId = "";
let avatarBase64 = "";
let bannerBase64 = "";

function setIdentity(user, profile) {
  const name = profile.username || user.displayName || user.email?.split("@")[0] || "ZombieOS user";
  dashboardName.textContent = name;
  const imageSource = profile.avatarBase64 || user.photoURL;
  if (imageSource) {
    const image = document.createElement("img");
    image.src = imageSource; image.alt = ""; image.referrerPolicy = "no-referrer";
    dashboardAvatar.replaceChildren(image); dashboardAvatar.classList.add("has-image");
  } else dashboardAvatar.textContent = name.charAt(0).toUpperCase() || "Z";
}

function updatePublicUrl(name) {
  profileSlug.textContent = name || "name";
  publicProfileLink.href = `../profiles.html?v=${encodeURIComponent(name)}`;
}

function populateEditor(profile) {
  activeProfile = profile;
  nameInput.value = profile.username || activeProfileId;
  bioInput.value = profile.bio || "";
  avatarBase64 = profile.avatarBase64 || "";
  bannerBase64 = profile.bannerBase64 || "";
  avatarPreview.src = avatarBase64 || "https://www.zsharp.zombieos.com/zsharp.png";
  if (bannerBase64) bannerPreview.src = bannerBase64;
  else bannerPreview.removeAttribute("src");
  document.querySelector("#social-github").value = profile.socials?.github || "";
  document.querySelector("#social-youtube").value = profile.socials?.youtube || "";
  document.querySelector("#social-discord").value = profile.socials?.discord || "";
  updatePublicUrl(nameInput.value);
}

async function compactImage(file, widthLimit) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, widthLimit / bitmap.width);
  let width = Math.max(1, Math.round(bitmap.width * scale));
  let height = Math.max(1, Math.round(bitmap.height * scale));
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    const result = canvas.toDataURL("image/webp", Math.max(.35, .84 - attempt * .08));
    if (result.length < 350_000) { bitmap.close(); return result; }
    width = Math.max(1, Math.round(width * .8));
    height = Math.max(1, Math.round(height * .8));
  }
  bitmap.close();
  throw new Error("That image could not be reduced enough. Try a smaller image.");
}

function imageUpload(input, preview, setter, widthLimit) {
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      saveStatus.className = "error"; saveStatus.textContent = "Choose an image under 10 MB."; return;
    }
    try {
      const result = await compactImage(file, widthLimit);
      setter(result); preview.src = result;
      saveStatus.textContent = "";
    } catch (error) {
      saveStatus.className = "error"; saveStatus.textContent = error.message;
    }
  });
}

imageUpload(avatarInput, avatarPreview, (value) => { avatarBase64 = value; }, 512);
imageUpload(bannerInput, bannerPreview, (value) => { bannerBase64 = value; }, 1600);
nameInput.addEventListener("input", () => updatePublicUrl(nameInput.value.trim()));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const newName = nameInput.value.trim();
  if (newName.length < 3 || newName.length > 40 || newName.includes("/")) {
    saveStatus.className = "error"; saveStatus.textContent = "Use 3–40 characters and do not include / in the profile name."; return;
  }

  saveStatus.className = ""; saveStatus.textContent = "Saving...";
  try {
    if (avatarBase64.startsWith("data:image/") && avatarBase64.length > 350_000) {
      avatarBase64 = await compactImage(await (await fetch(avatarBase64)).blob(), 512);
    }
    if (bannerBase64.startsWith("data:image/") && bannerBase64.length > 350_000) {
      bannerBase64 = await compactImage(await (await fetch(bannerBase64)).blob(), 1600);
    }
    const updatedProfile = {
      ...activeProfile,
      uid: activeUser.uid,
      username: newName,
      bio: bioInput.value.trim(),
      avatarBase64,
      bannerBase64,
      badges: Array.isArray(activeProfile.badges) ? activeProfile.badges : ["DEV"],
      visibleBadges: activeProfile.visibleBadges || { DEV: true },
      displayBadges: true,
      publicProfile: true,
      socials: {
        ...(activeProfile.socials || {}),
        github: document.querySelector("#social-github").value.trim(),
        youtube: document.querySelector("#social-youtube").value.trim(),
        discord: document.querySelector("#social-discord").value.trim()
      },
      updatedAt: Date.now()
    };

    const saved = await storeApi("profile", updatedProfile);
    activeProfileId = saved.profileId; activeProfile = updatedProfile;
    updatePublicUrl(newName);
    saveStatus.className = "success"; saveStatus.textContent = "ZDP profile saved.";
  } catch (error) {
    console.error("Unable to save ZDP profile:", error);
    saveStatus.className = "error"; saveStatus.textContent = error.message || "The profile could not be saved.";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("../login.html"); return; }
  activeUser = user;
  try {
    const accountSnapshot = await getDoc(doc(accountDb, "users", user.uid));
    accountProfile = accountSnapshot.exists() ? accountSnapshot.data() : {};
    setIdentity(user, accountProfile);
    let state;
    try { state = await storeApi("me"); }
    catch (error) {
      if (error.status !== 403 || !accountProfile.zdpMembership?.website) {
        if (error.status !== 403) throw error;
        document.body.classList.remove("dashboard-pending"); membershipOverlay.hidden = false; return;
      }
      await storeApi("join", { website: accountProfile.zdpMembership.website, username: accountProfile.username || user.displayName || "", avatar: accountProfile.avatarBase64 || user.photoURL || "" });
      state = await storeApi("me");
    }
    activeProfileId = state.profile.id;
    populateEditor(state.profile);
    document.body.classList.remove("dashboard-pending");
  } catch (error) {
    console.error("Unable to load ZDP profile:", error);
    document.body.classList.remove("dashboard-pending");
    saveStatus.className = "error"; saveStatus.textContent = error.message || "The ZDP profile could not be loaded.";
  }
});
