import { auth, db as accountDb } from "./firebase.js";
import { storeApi, storeDownload } from "./store-api.js?v=2";
import { renderMarkdown } from "./markdown.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const modal = document.querySelector("#review-modal");
const errorView = document.querySelector("#review-error");
const dialogError = document.querySelector("#review-dialog-error");
let active = null;

function hasStaff(data) { return Array.isArray(data?.badges) && data.badges.some((badge) => String(badge).toUpperCase() === "STAFF"); }
function tag(value, className = "") { const node = document.createElement("span"); node.textContent = value; node.className = className; return node; }

function card(item) {
  const article = document.createElement("article"); article.className = "version-review-card";
  const content = document.createElement("div");
  const title = document.createElement("h3"); title.textContent = `${item.projectName || item.projectId} · ${item.version}`;
  const summary = document.createElement("p"); summary.textContent = item.displayName || "Untitled version";
  const tags = document.createElement("div"); tags.className = "review-tags";
  tags.append(tag(item.priority || "VERSION", item.priority === "NEW" ? "tag-new" : ""), tag(item.status || "pending", item.status === "denied" ? "tag-denied" : ""));
  if (item.requiresVrReview) tags.append(tag("VR", "tag-vr"));
  const meta = document.createElement("div"); meta.className = "review-meta";
  meta.textContent = `${item.type === "game" ? ".zgame" : ".zapp"} · ${item.creator || "Unknown publisher"} · ${new Date(item.submittedAt).toLocaleDateString()}`;
  content.append(title, summary, tags, meta);
  const open = document.createElement("button"); open.type = "button"; open.textContent = "Open submission →";
  open.addEventListener("click", () => openSubmission(item.id));
  article.append(content, open); return article;
}

function renderQueue(items) {
  const pending = items.filter((item) => item.status === "pending");
  const vr = items.filter((item) => item.status === "vr_review");
  const history = items.filter((item) => !["pending", "vr_review"].includes(item.status)).sort((a, b) => Number(b.reviewedAt || b.submittedAt) - Number(a.reviewedAt || a.submittedAt));
  document.querySelector("#pending-count").textContent = String(pending.length);
  document.querySelector("#vr-count").textContent = String(vr.length);
  document.querySelector("#total-count").textContent = String(items.length);
  document.querySelector("#version-review-list").replaceChildren(...pending.map(card));
  document.querySelector("#vr-review-list").replaceChildren(...vr.map(card));
  document.querySelector("#review-history-list").replaceChildren(...history.map(card));
  document.querySelector("#reviews-empty").hidden = pending.length > 0;
  document.querySelector("#vr-empty").hidden = vr.length > 0;
  document.querySelector("#history-empty").hidden = history.length > 0;
}

async function loadQueue() {
  const items = await storeApi("review-queue");
  errorView.hidden = true;
  renderQueue(items);
}

function fact(label, value) {
  const box = document.createElement("div"); const small = document.createElement("small"); const strong = document.createElement("strong");
  small.textContent = label; strong.textContent = value || "—"; box.append(small, strong); return box;
}

async function openSubmission(id) {
  dialogError.textContent = "";
  try {
    active = await storeApi("review-detail", { id });
    document.querySelector("#review-dialog-title").textContent = `${active.projectName || active.projectId} · ${active.version}`;
    document.querySelector("#review-dialog-tags").replaceChildren(tag(active.priority || "VERSION"), tag(active.status || "pending"), ...(active.requiresVrReview ? [tag("VR / OpenXR")] : []));
    document.querySelector("#review-dialog-facts").replaceChildren(
      fact("Version display name", active.displayName), fact("Z# version", active.zsharpVersion),
      fact("Publisher", active.creator), fact("Package", `${active.fileName || "Source"} · ${Math.round((active.fileSize || 0) / 1024)} KB`),
      fact("SHA-256", active.sha256), fact("Review stage", active.reviewStage)
    );
    renderMarkdown(document.querySelector("#review-changelog"), active.changelog);
    document.querySelector("#deny-form").hidden = true;
    document.querySelector("#review-dialog-actions").hidden = false;
    const pending = ["pending", "vr_review"].includes(active.status);
    document.querySelector("#review-deny").hidden = !pending;
    document.querySelector("#review-accept").hidden = !pending;
    document.querySelector("#review-accept").firstChild.textContent = active.status === "vr_review" ? "Approve VR release " : active.requiresVrReview ? "Send to VR review " : "Accept and publish ";
    modal.hidden = false;
  } catch (error) {
    errorView.textContent = error.message;
    errorView.hidden = false;
  }
}

function closeModal() { modal.hidden = true; active = null; }
document.querySelector("#review-close").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.querySelector("#review-download").addEventListener("click", async () => {
  if (!active) return;
  dialogError.textContent = "";
  try { await storeDownload("review-download", active.id, active.fileName || "source-package.zapp"); }
  catch (error) { dialogError.textContent = error.message; }
});
document.querySelector("#review-deny").addEventListener("click", () => {
  document.querySelector("#review-dialog-actions").hidden = true;
  document.querySelector("#deny-form").hidden = false;
  document.querySelector("#deny-reason").focus();
});
document.querySelector("#deny-cancel").addEventListener("click", () => {
  document.querySelector("#deny-form").hidden = true;
  document.querySelector("#review-dialog-actions").hidden = false;
});

async function decide(decision) {
  if (!active) return;
  const reason = document.querySelector("#deny-reason").value.trim();
  if (decision === "deny" && reason.length < 5) { dialogError.textContent = "Give the publisher a clear reason for denial."; return; }
  const button = document.querySelector(decision === "deny" ? "#deny-confirm" : "#review-accept");
  button.disabled = true; dialogError.textContent = decision === "deny" ? "Sending denial..." : "Recording approval...";
  try {
    await storeApi("review-decision", { id: active.id, decision, reason });
    closeModal(); await loadQueue();
  } catch (error) { dialogError.textContent = error.message; }
  finally { button.disabled = false; }
}
document.querySelector("#deny-confirm").addEventListener("click", () => decide("deny"));
document.querySelector("#review-accept").addEventListener("click", () => decide("accept"));

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("login.html?next=reviews.html"); return; }
  try {
    const account = await getDoc(doc(accountDb, "users", user.uid));
    if (!hasStaff(account.data())) {
      document.querySelector("#standard-section").hidden = true;
      document.querySelector("#vr-section").hidden = true;
      document.querySelector("#history-section").hidden = true;
      document.querySelector("#staff-denied").hidden = false;
      return;
    }
    await loadQueue();
  } catch (error) {
    console.error("Unable to load review queue:", error);
    errorView.textContent = error.message || "The review queue could not be loaded.";
    errorView.hidden = false;
  }
});
