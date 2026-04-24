import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBU3S6c9QD5XA-9lw8Z9zKwVGUoSeOJMs0",
  authDomain: "barbershop-app-90fe1.firebaseapp.com",
  projectId: "barbershop-app-90fe1",
  storageBucket: "barbershop-app-90fe1.firebasestorage.app",
  messagingSenderId: "252413740284",
  appId: "1:252413740284:web:fd00ae402f59743d4c4379",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
