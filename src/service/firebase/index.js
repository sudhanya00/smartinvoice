// --- Firebase Configuration for Local Development ---
const firebaseConfigString = process.env.REACT_APP_FIREBASE_CONFIG;
let firebaseConfig;
if (firebaseConfigString !== undefined) {
  try {
    firebaseConfig = JSON.parse(firebaseConfigString);
  } catch (err) {
    console.error("Error parsing Firebase config:", err);
  }
} else {
  console.error("Firebase config not found");
}
const appId = process.env.REACT_APP_APP_ID || "default-app-id";

module.exports = { firebaseConfig, appId };
