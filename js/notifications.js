import { auth } from "./firebase.js";
import { storeApi } from "./store-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const list = document.querySelector("#notification-list");
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace(`login.html?next=${encodeURIComponent("notifications.html")}`); return; }
  try {
    const feed = await storeApi("notifications");
    if (!feed.notifications.length) { list.innerHTML = "<p>No notifications yet. Follow a Store project or publisher to get updates here.</p>"; return; }
    list.replaceChildren(...feed.notifications.map((item) => {
      const link = document.createElement("a"); link.href = item.url; link.setAttribute("role", "listitem");
      if (item.at > feed.lastReadAt) link.classList.add("unread");
      const title = document.createElement("strong"); title.textContent = item.title;
      const date = document.createElement("span"); date.textContent = new Date(item.at).toLocaleString();
      link.append(title, date); return link;
    }));
    await storeApi("notifications-read", {});
  } catch (error) { list.replaceChildren(); const message = document.createElement("p"); message.textContent = error.message || "Notifications are unavailable."; list.append(message); }
});
