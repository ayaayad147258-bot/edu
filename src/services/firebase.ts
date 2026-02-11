import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBvTHMQKOJ3wc3iz-MiOYCBG9j2o3oDOGc",
    authDomain: "educators-academy.firebaseapp.com",
    projectId: "educators-academy",
    storageBucket: "educators-academy.firebasestorage.app",
    messagingSenderId: "827874514960",
    appId: "1:827874514960:web:4ab3a29c04b447b413d295",
    measurementId: "G-TDZ7DD1HQL"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
