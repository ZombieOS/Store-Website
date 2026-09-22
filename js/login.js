import { auth } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { signInWithGoogle, signInWithGitHub } from "./providers.js";

const loginForm = document.querySelector("#login-form");
const passwordInput = document.querySelector("#password");
const togglePassword = document.querySelector("#toggle-password");
const popupOverlay = document.querySelector("#popup-overlay");
const popupTitle = document.querySelector("#popup-title");
const popupMessage = document.querySelector("#popup-message");
const popupConfirm = document.querySelector("#popup-confirm");
const popupCancel = document.querySelector("#popup-cancel");

let loginInProgress = false;
let popupCallback = null;

function showPopup(title, message, callback = null) {
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  popupCallback = callback;
  popupCancel.hidden = callback === null;
  popupOverlay.hidden = false;
  popupConfirm.focus();
}

function closePopup(runCallback = false) {
  popupOverlay.hidden = true;
  const callback = popupCallback;
  popupCallback = null;
  if (runCallback && callback) callback();
}

function goToDashboard() {
  const next = new URLSearchParams(window.location.search).get("next");
  window.location.href = next && !next.includes(":") && !next.startsWith("//") ? next : "dashboard/";
}

popupConfirm.addEventListener("click", () => closePopup(true));
popupCancel.addEventListener("click", () => closePopup(false));
popupOverlay.addEventListener("click", (event) => {
  if (event.target === popupOverlay && popupCallback === null) closePopup(false);
});

togglePassword.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.textContent = showing ? "Show" : "Hide";
  togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

onAuthStateChanged(auth, (user) => {
  if (!user || loginInProgress) return;
  goToDashboard();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;

  if (!email || !password) {
    showPopup("Missing Information", "Please enter your email and password.");
    return;
  }

  loginInProgress = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    goToDashboard();
  } catch (error) {
    loginInProgress = false;
    const messages = {
      "auth/user-not-found": "No account exists with that email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/network-request-failed": "Network error. Please try again."
    };
    console.error("Login failed:", error);
    showPopup("Login Failed", messages[error?.code] || "Login failed.");
  }
});

async function providerLogin(providerName, loginFunction) {
  loginInProgress = true;
  try {
    await loginFunction();
    goToDashboard();
  } catch (error) {
    loginInProgress = false;
    console.error(`${providerName} login failed:`, error);
    let message = `Unable to sign in with ${providerName}.`;
    if (error?.code === "auth/account-exists-with-different-credential") message = `A ZombieOS account already exists with this email. Sign in using your existing method, then link ${providerName} from your account settings.`;
    else if (error?.code === "auth/popup-blocked") message = "Your browser blocked the sign-in popup. Allow popups and try again.";
    else if (error?.code === "auth/popup-closed-by-user") message = "The sign-in window was closed before login finished.";
    else if (error?.code === "auth/network-request-failed") message = "A network error occurred. Check your connection and try again.";
    showPopup(`${providerName} Login`, message);
  }
}

document.querySelector("#google-login")?.addEventListener("click", () => providerLogin("Google", signInWithGoogle));
document.querySelector("#github-login")?.addEventListener("click", () => providerLogin("GitHub", signInWithGitHub));
