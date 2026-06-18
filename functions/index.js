import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

initializeApp();

const ADMIN_EMAILS = ["jmm.engiot@gmail.com"];

async function assertAdmin(uid) {
  const user = await getAuth().getUser(uid);
  if (!ADMIN_EMAILS.includes(user.email)) {
    const profile = await getFirestore().doc(`usuarios/${uid}`).get();
    if (!profile.exists || profile.data().perfil !== "admin") {
      throw new HttpsError("permission-denied", "Somente administrador pode executar esta ação.");
    }
  }
}

export const createMonitorUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  await assertAdmin(request.auth.uid);

  const { nome, email, senha = "123456", area = "Área de Elétrica", responsabilidades = [] } = request.data || {};
  if (!nome || !email) throw new HttpsError("invalid-argument", "Nome e e-mail são obrigatórios.");

  const user = await getAuth().createUser({
    email,
    password: senha,
    displayName: nome,
    disabled: false
  });

  await getFirestore().doc(`usuarios/${user.uid}`).set({
    uid: user.uid,
    nome,
    email,
    perfil: "monitor",
    area,
    ativo: true,
    responsabilidades,
    criadoEm: FieldValue.serverTimestamp()
  }, { merge: true });

  return { uid: user.uid, email };
});

export const notifyNewDemand = onDocumentCreated("demandas/{demandaId}", async (event) => {
  const demanda = event.data?.data();
  if (!demanda?.responsavelUid) return;

  const tokensSnap = await getFirestore()
    .collection(`usuarios/${demanda.responsavelUid}/tokens`)
    .get();

  const tokens = tokensSnap.docs.map((doc) => doc.id);
  if (!tokens.length) return;

  await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "Nova demanda atribuída",
      body: `${demanda.titulo || "Nova atividade"} · prazo: ${demanda.prazo || ""}`
    },
    webpush: {
      notification: {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png"
      }
    }
  });
});
