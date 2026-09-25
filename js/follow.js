import { auth } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

export function setupFollow(button, target) {
  if (!button) return;
  let following = false;
  const label = target.type === "project" ? "project" : target.type === "organization" ? "organization" : "developer";
  const update = () => { button.textContent = following ? `Following ${label} ✓` : `Follow ${label}`; };
  update();
  onAuthStateChanged(auth, async (user) => {
    if (!user) { following = false; update(); return; }
    try { following = (await storeApi("follow-status", target)).following; update(); }
    catch (error) { console.warn("Follow status unavailable:", error); }
  });
  button.addEventListener("click", async () => {
    if (!auth.currentUser) { location.href = `login.html?next=${encodeURIComponent(location.pathname.split("/").at(-1) + location.search)}`; return; }
    button.disabled = true;
    const permission = !following && "Notification" in window && Notification.permission === "default" ? Notification.requestPermission() : null;
    try {
      following = (await storeApi("follow-set", { ...target, follow: !following })).following;
      update();
      if (permission) await permission;
    } catch (error) { alert(error.message || "Could not update your follow."); }
    finally { button.disabled = false; }
  });
}
