import { GithubAuthProvider, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { auth } from "./firebase.js";

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithGitHub() {
  return signInWithPopup(auth, githubProvider);
}
