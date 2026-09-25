import { auth, db as accountDb } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { storeApi } from "./store-api.js";

const accountControl = document.querySelector("[data-account-control]");

function accountLabel(user) {
  return user.displayName || user.email?.split("@")[0] || "ZombieOS user";
}

function avatarFallback(user) {
  return accountLabel(user).trim().charAt(0).toUpperCase() || "Z";
}

function showSignedOut() {
  if (!accountControl) return;
  const replacement = document.createElement("a");
  replacement.className = "nav-cta";
  replacement.dataset.accountControl = "";
  replacement.href = "login.html";
  replacement.innerHTML = "Sign in <span aria-hidden=\"true\">→</span>";
  accountControl.replaceWith(replacement);
}

function showSignedIn(user) {
  if (!accountControl) return;
  const wrapper = document.createElement("div");
  wrapper.className = "user-account";

  const button = document.createElement("button");
  button.className = "account-avatar";
  button.type = "button";
  button.setAttribute("aria-label", "Open account menu");
  button.setAttribute("aria-expanded", "false");

  if (user.photoURL) {
    const image = document.createElement("img");
    image.src = user.photoURL;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    button.append(image);
  } else {
    button.textContent = avatarFallback(user);
  }

  const menu = document.createElement("div");
  menu.className = "account-menu";
  menu.hidden = true;

  const header = document.createElement("div");
  header.className = "account-menu-header";
  const name = document.createElement("strong");
  name.textContent = accountLabel(user);
  const email = document.createElement("span");
  email.textContent = user.email || "ZombieOS account";
  header.append(name, email);

  const dashboard = document.createElement("a");
  dashboard.href = "dashboard/";
  dashboard.textContent = "Dashboard";
  const settings = document.createElement("a");
  settings.href = "dashboard/settings.html";
  settings.textContent = "Settings";
  const notifications = document.createElement("a");
  notifications.href = "notifications.html";
  notifications.textContent = "Notifications";
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "Log out";
  logout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  menu.append(header, dashboard, notifications, settings, logout);
  wrapper.append(button, menu);
  accountControl.replaceWith(wrapper);

  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });
}

async function checkNotifications(user) {
  try {
    const feed = await storeApi("notifications");
    const link = document.querySelector('.account-menu a[href="notifications.html"]');
    if (link) link.textContent = feed.unread ? `Notifications (${feed.unread})` : "Notifications";
    const storageKey = `zos-store-notified-${user.uid}`;
    const previous = Number(localStorage.getItem(storageKey) || 0);
    if (!previous) { localStorage.setItem(storageKey, String(Date.now())); return; }
    const fresh = feed.notifications.filter((item) => item.at > previous);
    if (fresh.length && "Notification" in window && Notification.permission === "granted") {
      const latest = fresh[0];
      const notice = new Notification("ZOS Store", { body: latest.title, icon: "https://www.zsharp.zombieos.com/zsharp.png" });
      notice.onclick = () => { window.focus(); location.href = latest.url; };
    }
    if (fresh.length) localStorage.setItem(storageKey, String(Math.max(...fresh.map((item) => item.at))));
  } catch (error) { console.warn("Store notifications unavailable:", error); }
}

async function showStaffNavigation(user) {
  try {
    if (!/\/(index\.html)?$/.test(window.location.pathname)) return;
    const account = await getDoc(doc(accountDb, "users", user.uid));
    const badges = account.data()?.badges;
    if (!Array.isArray(badges) || !badges.some((badge) => String(badge).toUpperCase() === "STAFF")) return;
    const nav = document.querySelector(".site-header nav");
    if (!nav || nav.querySelector('[data-staff-reviews]')) return;
    const reviews = document.createElement("a"); reviews.href = "reviews.html"; reviews.dataset.staffReviews = ""; reviews.textContent = "Reviews";
    const reports = document.createElement("a"); reports.href = "reports.html"; reports.textContent = "Reports";
    nav.append(reviews, reports);
  } catch (error) { console.warn("Staff navigation could not be checked:", error); }
}

onAuthStateChanged(auth, (user) => {
  if (user) { showSignedIn(user); showStaffNavigation(user); checkNotifications(user); setInterval(() => { if (auth.currentUser?.uid === user.uid) checkNotifications(user); }, 60_000); }
  else showSignedOut();
});
