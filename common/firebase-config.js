/**
 * Firebase configuration and initialization
 *
 * Configuration values come from environment variables via env-config.js
 * Get your Firebase configuration from: https://console.firebase.google.com/project/kukbuk-tf/settings/general
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { ENV } from "./env-config.js";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
let auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
  throw error;
}

export { app, auth };
