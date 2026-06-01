import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCXDomd6g6lCfcWY3WEpaBGKPmiRq_uXRY",
  authDomain: "clothes-94ef3.firebaseapp.com",
  projectId: "clothes-94ef3",
  storageBucket: "clothes-94ef3.firebasestorage.app",
  messagingSenderId: "79457663325",
  appId: "1:79457663325:web:f9d783f03e20cdff3790b4",
  measurementId: "G-M0L6WTLBST"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
