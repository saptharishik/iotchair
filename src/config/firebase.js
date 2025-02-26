import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyDDZlc2HE0QypPIDchtJQZOQEkoF2UORu4",
    authDomain: "iot-chair-94559.firebaseapp.com",
    databaseURL: "https://iot-chair-94559-default-rtdb.firebaseio.com",
    projectId: "iot-chair-94559",
    storageBucket: "iot-chair-94559.firebasestorage.app",
    messagingSenderId: "803306201103",
    appId: "1:803306201103:web:83709ea48af81e49c5c37a",
    measurementId: "G-TF83NV1HPG"
  };
  
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export default app;



