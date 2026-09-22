import { auth, db as accountDb } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { storeApi } from "./store-api.js";

const form = document.querySelector("#zdp-signup-form");
const websiteInput = document.querySelector("#developer-website");
const status = document.querySelector("#signup-status");
const signinRequired = document.querySelector("#signin-required");
let activeUser = null;

function validWebsite(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

onAuthStateChanged(auth, async (user) => {
  activeUser = user;
  form.hidden = !user;
  signinRequired.hidden = Boolean(user);
  if (!user) return;
  const account = await getDoc(doc(accountDb, "users", user.uid));
  const membership = account.data()?.zdpMembership;
  if (membership?.active) {
    websiteInput.value = membership.website || "";
    status.style.color = "var(--green-soft)";
    status.textContent = "You’re already a ZDP member.";
    form.querySelector("button").innerHTML = "Connect ZDP to the Store <span>→</span>";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeUser) return;
  const website = validWebsite(websiteInput.value.trim());
  if (!website) { status.textContent = "Enter a complete website address, including https://"; return; }
  const button = form.querySelector("button");
  button.disabled = true; status.style.color = ""; status.textContent = "Joining ZDP...";
  try {
    const account = await getDoc(doc(accountDb, "users", activeUser.uid));
    const profile = account.data() || {};
    await storeApi("join", { website, username: profile.username || activeUser.displayName || "", avatar: profile.avatarBase64 || activeUser.photoURL || "" });
    await setDoc(doc(accountDb, "users", activeUser.uid), { zdpMembership: { active: true, website, joinedAt: Date.now(), domainVerified: false } }, { merge: true });
    window.location.href = "dashboard/profile.html";
  } catch (error) {
    console.error("Unable to join ZDP:", error);
    status.textContent = error.message || "The Store could not create your membership.";
    button.disabled = false;
  }
});
