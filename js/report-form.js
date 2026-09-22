import { auth } from "./firebase.js";
import { storeApi } from "./store-api.js";

export function setupReportButton(button, getTarget) {
  if (!button) return;
  const overlay = document.createElement("div"); overlay.className = "report-overlay"; overlay.hidden = true;
  const dialog = document.createElement("section"); dialog.className = "report-dialog"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
  const title = document.createElement("h2"); title.textContent = "Report to Store staff";
  const copy = document.createElement("p"); copy.textContent = "Tell staff what needs attention. Your report is private.";
  const form = document.createElement("form");
  const reasonLabel = document.createElement("label"); reasonLabel.textContent = "Reason";
  const reason = document.createElement("select"); reason.required = true;
  for (const [value, label] of [["", "Choose a reason"], ["inappropriate_name", "Inappropriate name"], ["inappropriate_content", "Inappropriate content"], ["malware", "Malware"], ["stolen_assets", "Stolen assets"]]) reason.add(new Option(label, value));
  reasonLabel.append(reason);
  const detailsLabel = document.createElement("label"); detailsLabel.textContent = "Details";
  const details = document.createElement("textarea"); details.maxLength = 2000; details.rows = 5; details.placeholder = "Extra context (optional)."; detailsLabel.append(details);
  const status = document.createElement("p"); status.className = "report-status"; status.setAttribute("role", "status");
  const actions = document.createElement("div"); actions.className = "report-actions";
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "back-button"; cancel.textContent = "Cancel";
  const send = document.createElement("button"); send.type = "submit"; send.className = "primary-button"; send.textContent = "Send report";
  actions.append(cancel, send); form.append(reasonLabel, detailsLabel, status, actions); dialog.append(title, copy, form); overlay.append(dialog); document.body.append(overlay);
  const close = () => { overlay.hidden = true; status.textContent = ""; };
  cancel.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  button.addEventListener("click", () => {
    if (!auth.currentUser) { location.href = `login.html?next=${encodeURIComponent(location.pathname.split("/").at(-1) + location.search)}`; return; }
    form.reset(); status.textContent = ""; send.hidden = false; overlay.hidden = false; reason.focus();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = getTarget();
    if (!target?.targetId) { status.textContent = "This item could not be identified."; return; }
    send.disabled = true; status.textContent = "Sending report…";
    try {
      await storeApi("report-submit", { ...target, reason: reason.value.trim(), details: details.value.trim() });
      status.textContent = "Report sent to Store staff. Thank you.";
      send.hidden = true;
    } catch (error) { status.textContent = error.message || "The report could not be sent."; }
    finally { send.disabled = false; }
  });
}
