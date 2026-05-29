import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAIyu2--F2t_-sLXNESwtyJY17fzNshD5E",
  authDomain: "planificador-598e5.firebaseapp.com",
  projectId: "planificador-598e5",
  storageBucket: "planificador-598e5.firebasestorage.app",
  messagingSenderId: "453707484862",
  appId: "1:453707484862:web:3146f4390929094bc518ef",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);