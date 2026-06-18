// CONFIGURAÇÃO DO FIREBASE
// 1) Crie um projeto no Firebase.
// 2) Ative Authentication com e-mail/senha.
// 3) Ative Firestore Database.
// 4) Ative Storage.
// 5) Cole os dados do SDK Web abaixo.
// Enquanto estiver com valores vazios, o app funciona em modo demonstração local no navegador.

export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Opcional para push real via Firebase Cloud Messaging.
// Gere em: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates.
export const VAPID_KEY = "";
