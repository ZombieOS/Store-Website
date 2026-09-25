import { auth } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const targetSelect = document.querySelector("#verify-target");
const progress = document.querySelector("#verify-progress");
const message = document.querySelector("#verification-message");
const challengePanel = document.querySelector("#verify-challenge");

function selected() {
  const [type, id] = targetSelect.value.split(":");
  return { type, id };
}

function showChallenge(challenge) {
  challengePanel.hidden = !challenge;
  if (!challenge) return;
  document.querySelector("#verify-record-name").textContent = challenge.recordName;
  document.querySelector("#verify-record-value").textContent = challenge.recordValue;
  document.querySelector("#verify-domain").value = challenge.domain;
}

async function refreshStatus() {
  if (!targetSelect.value) return;
  const state = await storeApi("verification-status", selected());
  progress.textContent = state.verified
    ? `Verified ${state.method === "dns" ? `with ${state.verifiedDomain}` : `through ${Number(state.downloads).toLocaleString()} downloads`}.`
    : `${Number(state.downloads).toLocaleString()} / ${Number(state.threshold).toLocaleString()} downloads toward automatic verification.`;
  showChallenge(state.challenge);
}

targetSelect.addEventListener("change", () => { message.textContent = ""; refreshStatus().catch((error) => { progress.textContent = error.message; }); });
document.querySelector("#verification-start-form").addEventListener("submit", async (event) => {
  event.preventDefault(); message.textContent = "Creating your DNS challenge…";
  try {
    const challenge = await storeApi("verification-start", { ...selected(), domain: document.querySelector("#verify-domain").value.trim() });
    showChallenge(challenge); message.textContent = "Add the TXT record, then press Check DNS.";
  } catch (error) { message.textContent = error.message || "The DNS challenge could not be created."; }
});
document.querySelector("#verify-check").addEventListener("click", async () => {
  const button = document.querySelector("#verify-check"); button.disabled = true; message.textContent = "Checking DNS…";
  try { await storeApi("verification-check", selected()); message.textContent = "Domain verified. Your checkmark is live."; await refreshStatus(); }
  catch (error) { message.textContent = error.message || "The TXT record is not visible yet."; }
  finally { button.disabled = false; }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("../login.html?next=dashboard/verify.html"); return; }
  try {
    const [state, organizations] = await Promise.all([storeApi("me"), storeApi("organizations")]);
    const name = state.profile?.username || user.displayName || "ZombieOS user";
    document.querySelector("#dashboard-name").textContent = name;
    document.querySelector("#dashboard-avatar").textContent = name.charAt(0).toUpperCase();
    targetSelect.add(new Option(`${name} (developer)`, `developer:${state.profile?.id || state.member.profileId}`));
    for (const organization of organizations.filter((item) => item.ownerId === user.uid || item.memberRoles?.includes("verification"))) targetSelect.add(new Option(`${organization.name} (organization)`, `organization:${organization.id}`));
    document.body.classList.remove("dashboard-pending");
    await refreshStatus();
  } catch (error) { document.body.classList.remove("dashboard-pending"); progress.textContent = error.message || "Verification could not be loaded."; }
});
