import { auth } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const errorView = document.querySelector("#reports-error");
const reasonLabels = { inappropriate_name: "Inappropriate name", inappropriate_content: "Inappropriate content", malware: "Malware", stolen_assets: "Stolen assets" };

function reportCard(item) {
  const article = document.createElement("article"); article.className = "version-review-card";
  const content = document.createElement("div");
  const title = document.createElement("h3"); title.textContent = `${item.targetType === "project" ? "Project" : "Profile"}: ${item.targetName || item.targetId}`;
  const reason = document.createElement("p"); reason.textContent = reasonLabels[item.reason] || item.reason;
  const details = document.createElement("p"); details.textContent = item.details || "No extra details provided.";
  const meta = document.createElement("div"); meta.className = "review-meta"; meta.textContent = `${item.reporterName || "Store user"} · ${new Date(item.createdAt).toLocaleString()} · ${item.status}${item.action && item.action !== "none" ? ` · ${item.action}` : ""}`;
  const link = document.createElement("a"); link.href = item.targetType === "project" ? `projects.html?v=${encodeURIComponent(item.targetId)}` : `profiles.html?v=${encodeURIComponent(item.targetId)}`; link.textContent = "View reported item →";
  content.append(title, reason, details, meta, link);
  if (item.staffNote) { const note = document.createElement("p"); note.textContent = `Staff note: ${item.staffNote}`; content.append(note); }
  if (item.restoredAt) { const restored = document.createElement("p"); restored.textContent = `Action lifted ${new Date(item.restoredAt).toLocaleString()}. Verification must be earned again.`; content.append(restored); }
  article.append(content);
  if (item.status === "open") {
    const controls = document.createElement("div"); controls.className = "report-controls";
    const note = document.createElement("textarea"); note.rows = 3; note.maxLength = 1000; note.placeholder = "Optional staff note";
    const action = document.createElement("select"); action.setAttribute("aria-label", "Moderation action");
    for (const [value, label] of [["none", "Resolve without action"], ["suspend", "Suspend"], ["remove", "Delete from Store"], ["ban", "Ban"]]) action.add(new Option(label, value));
    const resolve = document.createElement("button"); resolve.type = "button"; resolve.className = "primary-button"; resolve.textContent = "Resolve report";
    const dismiss = document.createElement("button"); dismiss.type = "button"; dismiss.className = "back-button"; dismiss.textContent = "Dismiss";
    for (const [button, status] of [[resolve, "resolved"], [dismiss, "dismissed"]]) button.addEventListener("click", async () => {
      if (status === "resolved" && action.value !== "none" && !confirm(`${action.options[action.selectedIndex].text} ${item.targetName || item.targetId}? This will hide it and revoke its verification badge.`)) return;
      resolve.disabled = dismiss.disabled = true;
      try { await storeApi("report-decision", { id: item.id, status, moderationAction: status === "resolved" ? action.value : "none", note: note.value.trim() }); await loadReports(); }
      catch (error) { errorView.textContent = error.message || "The report could not be updated."; errorView.hidden = false; resolve.disabled = dismiss.disabled = false; }
    });
    controls.append(note, action, resolve, dismiss); article.append(controls);
  } else if (item.status === "resolved" && item.action && item.action !== "none" && !item.restoredAt) {
    const restore = document.createElement("button"); restore.type = "button"; restore.className = "back-button"; restore.textContent = "Lift action";
    restore.addEventListener("click", async () => {
      if (!confirm(`Lift the ${item.action} action on ${item.targetName || item.targetId}? Verification will stay revoked.`)) return;
      restore.disabled = true;
      try { await storeApi("report-restore", { id: item.id }); await loadReports(); }
      catch (error) { errorView.textContent = error.message || "The action could not be lifted."; errorView.hidden = false; restore.disabled = false; }
    });
    article.append(restore);
  }
  return article;
}

async function loadReports() {
  const items = await storeApi("staff-reports");
  const open = items.filter((item) => item.status === "open");
  const handled = items.filter((item) => item.status !== "open");
  document.querySelector("#open-count").textContent = `${open.length} open`;
  document.querySelector("#open-reports").replaceChildren(...open.map(reportCard));
  document.querySelector("#handled-reports").replaceChildren(...handled.map(reportCard));
  document.querySelector("#open-empty").hidden = open.length > 0;
  document.querySelector("#handled-empty").hidden = handled.length > 0;
  errorView.hidden = true;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("login.html?next=reports.html"); return; }
  try { await loadReports(); }
  catch (error) { errorView.textContent = error.status === 403 ? "A STAFF badge is required to view reports." : error.message || "Reports could not be loaded."; errorView.hidden = false; }
});
