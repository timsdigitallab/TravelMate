// Firebase Authentication - Email/Password only. There is deliberately no
// public sign-up in the app UI (see js/views/login.js): the one account is
// created once via the Firebase Console, so a random visitor to the public
// GitHub Pages URL can't create their own account and consume the
// project's Firebase quota.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

let authInstance = null;
let currentUser = null;
let resolveReady;

export const authReady = new Promise((resolve) => {
  resolveReady = resolve;
});

export function initAuth() {
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  authInstance = getAuth(app);
  let first = true;
  onAuthStateChanged(authInstance, (user) => {
    currentUser = user;
    if (first) {
      first = false;
      resolveReady(user);
    }
  });
  return authInstance;
}

export function getCurrentUser() {
  return currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(authInstance, callback);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(authInstance, email, password).then((cred) => cred.user);
}

export function signOutUser() {
  return fbSignOut(authInstance);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(authInstance, email);
}

export function getFirebaseApp() {
  return getApps()[0];
}
