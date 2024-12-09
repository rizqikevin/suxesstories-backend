const firebase = require("firebase");
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBSBHbOjMgpJGSLRoRSQquZ5gAy8NNdHBM",
  authDomain: "suxesstories-3ee3d.firebaseapp.com",
  projectId: "suxesstories-3ee3d",
  storageBucket: "suxesstories-3ee3d.firebasestorage.app",
  messagingSenderId: "568427976444",
  appId: "1:568427976444:web:b4ddf7cfda0a2ea8c7a979",
};

// Initialize Firebase
const firebaseInit = firebase.initializeApp(firebaseConfig);

module.exports = firebaseInit;
