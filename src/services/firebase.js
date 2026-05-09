import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const missingConfigKeys = requiredConfigKeys.filter(
  (key) => !firebaseConfig[key],
);

export let db = null;
export let firebaseInitError = null;

if (missingConfigKeys.length > 0) {
  firebaseInitError = `Missing Firebase env vars: ${missingConfigKeys.join(", ")}`;
  console.error(firebaseInitError);
} else {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (error) {
    firebaseInitError =
      error instanceof Error ? error.message : "Failed to initialize Firebase.";
    console.error("Firebase initialization failed:", error);
  }
}
