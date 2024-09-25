import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.FB_APIKEY,
  authDomain: process.env.FB_AUTHDOMAIN,
  projectId: process.env.FB_PROJECTID,
  storageBucket: process.env.FB_STORAGEBUCKET,
  messagingSenderId: process.env.FB_MESSAGINGSENDERID,
  appId: process.env.FB_APPID,
};

// 파이어베이스 객체를 사용하는 작업이 아직 없으므로 반환 없음.
export function initFirebaseApp() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } else {
    getApps()[0];
    console.log("Firebase app already initialized");
  }
}
