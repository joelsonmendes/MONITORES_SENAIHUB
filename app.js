import { FIREBASE_CONFIG, VAPID_KEY } from "./firebase-config.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ADMIN_EMAILS = ["jmm.engiot@gmail.com"];

const STATUS = {
  pending: { label: "Pendente", badge: "pending" },
  progress: { label: "Em andamento", badge: "progress" },
  review: { label: "Aguardando aprovação", badge: "review" },
  done: { label: "Concluída", badge: "done" },
  returned: { label: "Devolvida", badge: "returned" },
  canceled: { label: "Cancelada", badge: "neutral" }
};

const PRIORITY = {
  baixa: { label: "Baixa", badge: "low" },
  media: { label: "Média", badge: "medium" },
  alta: { label: "Alta", badge: "high" },
  urgente: { label: "Urgente", badge: "urgent" }
};

const SERVICE_TYPES = [
  "Organização de laboratório",
  "Manutenção preventiva",
  "Manutenção corretiva",
  "Apoio em aula prática",
  "Separação de materiais",
  "Instalação elétrica",
  "Checklist de bancada",
  "Inventário",
  "Limpeza técnica",
  "Outro"
];

const RESPONSIBILITIES = [
  "Organizar bancadas de comandos elétricos, motores, CLP e instalações elétricas.",
  "Separar materiais das aulas práticas com antecedência e registrar pendências.",
  "Conferir ferramentas, cabos, instrumentos e componentes após as aulas.",
  "Apoiar professores durante aulas práticas, mantendo segurança, ordem e controle.",
  "Registrar imagens antes/depois dos serviços e dar baixa somente com evidência.",
  "Comunicar falta de material, falhas em equipamentos e riscos elétricos identificados."
];

let firebase = {
  enabled: false,
  app: null,
  auth: null,
  db: null,
  storage: null,
  modules: null
};

let state = {
  currentUser: null,
  users: [],
  tasks: [],
  notifications: [],
  page: "dashboard",
  unsubscribers: []
};

const localKey = "monitor_eletrica_state_v1";

function isFirebaseReady() {
  return FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;
}

function uid() {
  return "id_" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatDate(value) {
  if (!value) return "—";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function isLate(task) {
  if (!task?.dueAt || ["done", "canceled"].includes(task.status)) return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const area = $("#alertArea");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  area.appendChild(item);
  setTimeout(() => item.remove(), 4200);
}

function browserNotify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    navigator.serviceWorker?.ready?.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png"
      });
    }).catch(() => new Notification(title, { body, icon: "./icons/icon-192.png" }));
  }
}

function getLocalData() {
  const raw = localStorage.getItem(localKey);
  if (raw) return JSON.parse(raw);

  const seedUsers = [
    {
      uid: "admin_joelson",
      nome: "Joelson Mendes",
      email: "jmm.engiot@gmail.com",
      senha: "123456",
      perfil: "admin",
      area: "Coordenação da Área de Energia",
      telefone: "",
      ativo: true,
      responsabilidades: RESPONSIBILITIES
    },
    {
      uid: "mon_larissa",
      nome: "Larissa",
      email: "larissa.eletrica@senai.local",
      senha: "123456",
      perfil: "monitor",
      area: "Laboratório de Energia",
      telefone: "",
      ativo: true,
      responsabilidades: [
        "Organização das bancadas de energia e apoio nas práticas.",
        "Separação de materiais para aulas práticas.",
        "Registro fotográfico das atividades concluídas."
      ]
    },
    {
      uid: "mon_maysa",
      nome: "Maysa",
      email: "maysa.eletrica@senai.local",
      senha: "123456",
      perfil: "monitor",
      area: "Laboratório de Instalações Elétricas",
      telefone: "",
      ativo: true,
      responsabilidades: [
        "Checklist de materiais e acompanhamento das demandas dos professores.",
        "Controle de ferramentas e componentes após as aulas.",
        "Registro de pendências e baixa das atividades executadas."
      ]
    },
    {
      uid: "mon_gabriel",
      nome: "Gabriel Neves",
      email: "gabriel.eletrica@senai.local",
      senha: "123456",
      perfil: "monitor",
      area: "Laboratório de Comandos Elétricos",
      telefone: "",
      ativo: true,
      responsabilidades: [
        "Organização e manutenção básica das bancadas de comandos elétricos.",
        "Separação de contatores, relés, disjuntores e cabos.",
        "Apoio operacional nas aulas práticas."
      ]
    }
  ];

  const seedTasks = [
    {
      id: uid(),
      titulo: "Organizar bancada de comandos elétricos",
      descricao: "Separar contatores, relés, disjuntores, cabos banana e identificar materiais faltantes.",
      local: "Laboratório de Comandos Elétricos",
      tipo: "Organização de laboratório",
      prioridade: "alta",
      status: "pending",
      responsavelUid: "mon_gabriel",
      responsavelNome: "Gabriel Neves",
      prazo: new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16),
      dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      exigeFoto: true,
      exigeAprovacao: true,
      criadoPorUid: "admin_joelson",
      criadoPorNome: "Joelson Mendes",
      criadoEm: nowIso(),
      iniciadoEm: "",
      finalizadoEm: "",
      aprovadoEm: "",
      observacaoFinal: "",
      materiais: "",
      anexos: [],
      historico: [
        { dataHora: nowIso(), usuario: "Joelson Mendes", acao: "Demanda criada", observacao: "Atividade inicial de demonstração." }
      ]
    }
  ];

  const data = { users: seedUsers, tasks: seedTasks, notifications: [] };
  localStorage.setItem(localKey, JSON.stringify(data));
  return data;
}

function setLocalData(data) {
  localStorage.setItem(localKey, JSON.stringify(data));
}

async function initFirebase() {
  if (!isFirebaseReady()) return false;
  try {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const storageMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js");

    firebase.app = appMod.initializeApp(FIREBASE_CONFIG);
    firebase.auth = authMod.getAuth(firebase.app);
    firebase.db = fsMod.getFirestore(firebase.app);
    firebase.storage = storageMod.getStorage(firebase.app);
    firebase.modules = { appMod, authMod, fsMod, storageMod };
    firebase.enabled = true;

    try {
      const msgMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");
      firebase.modules.msgMod = msgMod;
      if (await msgMod.isSupported()) {
        firebase.messaging = msgMod.getMessaging(firebase.app);
      }
    } catch (err) {
      console.warn("Messaging indisponível:", err);
    }

    return true;
  } catch (err) {
    console.error(err);
    toast("Não foi possível iniciar o Firebase. O app entrou em modo local.");
    firebase.enabled = false;
    return false;
  }
}

async function localLogin(email, password) {
  const data = getLocalData();
  const user = data.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.senha === password && u.ativo);
  if (!user) throw new Error("E-mail, senha ou usuário inativo.");
  state.currentUser = user;
  state.users = data.users;
  state.tasks = data.tasks;
  state.notifications = data.notifications || [];
}

async function login(email, password) {
  if (firebase.enabled) {
    const { signInWithEmailAndPassword } = firebase.modules.authMod;
    await signInWithEmailAndPassword(firebase.auth, email, password);
    return;
  }
  await localLogin(email, password);
  afterLogin();
}

async function logout() {
  state.unsubscribers.forEach((fn) => typeof fn === "function" && fn());
  state.unsubscribers = [];
  if (firebase.enabled) {
    await firebase.modules.authMod.signOut(firebase.auth);
  }
  state.currentUser = null;
  $("#mainView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}

async function syncFirebaseUser(authUser) {
  const { doc, getDoc, setDoc, serverTimestamp } = firebase.modules.fsMod;
  const ref = doc(firebase.db, "usuarios", authUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    state.currentUser = { uid: authUser.uid, ...snap.data() };
  } else {
    const profile = {
      uid: authUser.uid,
      nome: authUser.displayName || authUser.email.split("@")[0],
      email: authUser.email,
      perfil: ADMIN_EMAILS.includes(authUser.email) ? "admin" : "monitor",
      area: "Área de Elétrica",
      ativo: true,
      responsabilidades: [],
      criadoEm: serverTimestamp()
    };
    await setDoc(ref, profile, { merge: true });
    state.currentUser = profile;
  }
}

function subscribeLocal() {
  const data = getLocalData();
  state.users = data.users;
  state.tasks = data.tasks;
  state.notifications = data.notifications || [];
}

function emitLocal() {
  const data = {
    users: state.users,
    tasks: state.tasks,
    notifications: state.notifications
  };
  setLocalData(data);
  renderCurrentPage();
}

function subscribeFirebase() {
  const { collection, onSnapshot, query, orderBy } = firebase.modules.fsMod;

  state.unsubscribers.push(onSnapshot(collection(firebase.db, "usuarios"), (snap) => {
    state.users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    renderCurrentPage();
  }));

  state.unsubscribers.push(onSnapshot(query(collection(firebase.db, "demandas"), orderBy("criadoEm", "desc")), (snap) => {
    state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCurrentPage();
  }));

  state.unsubscribers.push(onSnapshot(query(collection(firebase.db, "notificacoes"), orderBy("criadaEm", "desc")), (snap) => {
    state.notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCurrentPage();
  }));
}

async function saveTask(task) {
  if (firebase.enabled) {
    const { doc, collection, addDoc, setDoc, serverTimestamp } = firebase.modules.fsMod;
    const payload = { ...task };
    if (!payload.criadoEm) payload.criadoEm = serverTimestamp();

    if (task.id) {
      const ref = doc(firebase.db, "demandas", task.id);
      delete payload.id;
      await setDoc(ref, payload, { merge: true });
    } else {
      delete payload.id;
      await addDoc(collection(firebase.db, "demandas"), payload);
    }
    return;
  }

  if (task.id) {
    const index = state.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) state.tasks[index] = task;
  } else {
    task.id = uid();
    state.tasks.unshift(task);
  }
  emitLocal();
}

async function saveUser(user) {
  if (firebase.enabled) {
    const { doc, setDoc, serverTimestamp } = firebase.modules.fsMod;
    const id = user.uid || uid();
    const payload = { ...user, uid: id, atualizadoEm: serverTimestamp() };
    await setDoc(doc(firebase.db, "usuarios", id), payload, { merge: true });
    return;
  }

  if (user.uid) {
    const index = state.users.findIndex((u) => u.uid === user.uid);
    if (index >= 0) state.users[index] = user;
  } else {
    user.uid = uid();
    user.senha = user.senha || "123456";
    state.users.push(user);
  }
  emitLocal();
}

async function saveNotification(notification) {
  if (firebase.enabled) {
    const { collection, addDoc, serverTimestamp } = firebase.modules.fsMod;
    await addDoc(collection(firebase.db, "notificacoes"), {
      ...notification,
      criadaEm: serverTimestamp()
    });
    return;
  }

  notification.id = uid();
  notification.criadaEm = nowIso();
  state.notifications.unshift(notification);
  emitLocal();
}

async function markNotificationRead(id) {
  if (firebase.enabled) {
    const { doc, setDoc } = firebase.modules.fsMod;
    await setDoc(doc(firebase.db, "notificacoes", id), { lida: true }, { merge: true });
    return;
  }
  const n = state.notifications.find((item) => item.id === id);
  if (n) n.lida = true;
  emitLocal();
}

async function uploadImage(taskId, file) {
  if (firebase.enabled) {
    const { ref, uploadBytes, getDownloadURL } = firebase.modules.storageMod;
    const path = `demandas/${taskId}/${Date.now()}_${file.name}`;
    const storageRef = ref(firebase.storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });
}

function isAdmin() {
  return state.currentUser?.perfil === "admin";
}

function visibleTasks() {
  const all = state.tasks.map((task) => ({
    ...task,
    computedLate: isLate(task)
  }));

  if (isAdmin()) return all;
  return all.filter((task) => task.responsavelUid === state.currentUser?.uid);
}

function getMonitorUsers() {
  return state.users.filter((u) => u.perfil === "monitor");
}

function setPage(page) {
  state.page = page;
  renderShell();
  renderCurrentPage();
}

function renderShell() {
  const user = state.currentUser;
  $("#userName").textContent = user?.nome || "Usuário";
  $("#modeBadge").textContent = firebase.enabled ? "Firebase" : "Local";
  $("#modeBadge").className = `badge ${firebase.enabled ? "done" : "neutral"}`;

  const nav = isAdmin()
    ? [
        ["dashboard", "📊 Dashboard"],
        ["tasks", "📋 Demandas"],
        ["newTask", "➕ Nova demanda"],
        ["monitors", "👷 Monitores"],
        ["notifications", "🔔 Notificações"],
        ["reports", "📄 Relatórios"]
      ]
    : [
        ["tasks", "✅ Minhas demandas"],
        ["notifications", "🔔 Notificações"],
        ["reports", "📄 Meu relatório"]
      ];

  $("#navMenu").innerHTML = nav.map(([page, label]) => `
    <button class="btn nav-link ${state.page === page ? "active" : ""}" data-page="${page}">
      ${label}
    </button>
  `).join("");

  $$(".nav-link").forEach((btn) => btn.addEventListener("click", () => {
    setPage(btn.dataset.page);
    $(".sidebar").classList.remove("open");
  }));
}

function renderCurrentPage() {
  $$(".page").forEach((page) => page.classList.add("hidden"));

  const titles = {
    dashboard: ["Dashboard", "Acompanhamento geral das demandas"],
    tasks: [isAdmin() ? "Demandas" : "Minhas demandas", isAdmin() ? "Controle das atividades dos monitores" : "Suas tarefas, prazos e baixas"],
    newTask: ["Nova demanda", "Criar atividade individual para um monitor"],
    monitors: ["Monitores", "Responsabilidades e cadastro"],
    notifications: ["Notificações", "Avisos de novas demandas e atualizações"],
    reports: ["Relatórios", "Indicadores de produtividade e conclusão"]
  };

  const [title, subtitle] = titles[state.page] || titles.dashboard;
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = subtitle;

  if (state.page === "dashboard") renderDashboard();
  if (state.page === "tasks") renderTasks();
  if (state.page === "newTask") renderNewTask();
  if (state.page === "monitors") renderMonitors();
  if (state.page === "notifications") renderNotifications();
  if (state.page === "reports") renderReports();
}

function renderDashboard() {
  $("#dashboardPage").classList.remove("hidden");
  const tasks = visibleTasks();
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    progress: tasks.filter((t) => t.status === "progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
    late: tasks.filter((t) => isLate(t)).length
  };

  const monitorRows = getMonitorUsers().map((u) => {
    const own = state.tasks.filter((t) => t.responsavelUid === u.uid);
    return `
      <tr>
        <td><strong>${escapeHtml(u.nome)}</strong><br><span class="muted">${escapeHtml(u.area || "")}</span></td>
        <td>${own.filter((t) => t.status === "pending").length}</td>
        <td>${own.filter((t) => t.status === "progress").length}</td>
        <td>${own.filter((t) => t.status === "review").length}</td>
        <td>${own.filter((t) => t.status === "done").length}</td>
        <td>${own.filter((t) => isLate(t)).length}</td>
      </tr>
    `;
  }).join("");

  $("#dashboardPage").innerHTML = `
    <div class="grid cols-4">
      ${statCard("Total de demandas", stats.total)}
      ${statCard("Pendentes", stats.pending)}
      ${statCard("Em andamento", stats.progress)}
      ${statCard("Atrasadas", stats.late)}
    </div>

    <div class="section-title">
      <div>
        <h3>Demandas aguardando atenção</h3>
        <p>Priorize atrasadas, pendentes e aguardando aprovação.</p>
      </div>
      ${isAdmin() ? `<button class="btn primary" data-go-new>Nova demanda</button>` : ""}
    </div>

    <div class="task-list">
      ${tasks
        .filter((t) => isLate(t) || ["pending", "review", "returned"].includes(t.status))
        .slice(0, 8)
        .map(taskCard)
        .join("") || `<div class="empty">Nenhuma demanda crítica no momento.</div>`}
    </div>

    ${isAdmin() ? `
      <div class="section-title">
        <div>
          <h3>Resumo por monitor</h3>
          <p>Visualize pendências, andamento, conclusão e atrasos.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Monitor</th>
              <th>Pendente</th>
              <th>Em andamento</th>
              <th>Aguardando aprovação</th>
              <th>Concluída</th>
              <th>Atrasada</th>
            </tr>
          </thead>
          <tbody>${monitorRows || `<tr><td colspan="6">Nenhum monitor cadastrado.</td></tr>`}</tbody>
        </table>
      </div>
    ` : ""}
  `;

  bindTaskButtons();
  $("[data-go-new]")?.addEventListener("click", () => setPage("newTask"));
}

function statCard(label, value) {
  return `<div class="card stat-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function taskBadge(task) {
  if (isLate(task)) return `<span class="badge late">Atrasada</span>`;
  const s = STATUS[task.status] || STATUS.pending;
  return `<span class="badge ${s.badge}">${s.label}</span>`;
}

function priorityBadge(value) {
  const p = PRIORITY[value] || PRIORITY.media;
  return `<span class="badge ${p.badge}">${p.label}</span>`;
}

function taskCard(task) {
  return `
    <article class="card task-card">
      <div class="task-head">
        <div>
          <h3>${escapeHtml(task.titulo)}</h3>
          <p class="task-desc">${escapeHtml(task.descricao || "")}</p>
        </div>
        <div class="task-meta">
          ${taskBadge(task)}
          ${priorityBadge(task.prioridade)}
        </div>
      </div>
      <div class="task-meta">
        <span class="badge neutral">👷 ${escapeHtml(task.responsavelNome || "Sem responsável")}</span>
        <span class="badge neutral">📍 ${escapeHtml(task.local || "Sem local")}</span>
        <span class="badge neutral">⏰ ${formatDateTime(task.dueAt || task.prazo)}</span>
      </div>
      <div class="task-actions">
        <button class="btn ghost small" data-view-task="${task.id}">Ver detalhes</button>
        ${taskActions(task)}
      </div>
    </article>
  `;
}

function taskActions(task) {
  if (isAdmin()) {
    if (task.status === "review") {
      return `
        <button class="btn success small" data-approve-task="${task.id}">Aprovar</button>
        <button class="btn warning small" data-return-task="${task.id}">Devolver</button>
      `;
    }
    if (task.status !== "done" && task.status !== "canceled") {
      return `<button class="btn danger ghost small" data-cancel-task="${task.id}">Cancelar</button>`;
    }
    return "";
  }

  if (task.responsavelUid !== state.currentUser.uid) return "";

  if (task.status === "pending" || task.status === "returned") {
    return `<button class="btn primary small" data-start-task="${task.id}">Iniciar serviço</button>`;
  }

  if (task.status === "progress") {
    return `
      <button class="btn ghost small" data-photo-task="${task.id}">Anexar foto</button>
      <button class="btn success small" data-finish-task="${task.id}">Dar baixa</button>
    `;
  }

  return "";
}

function renderTasks() {
  $("#tasksPage").classList.remove("hidden");
  const tasks = visibleTasks();

  const monitorOptions = isAdmin()
    ? `<select id="filterMonitor"><option value="">Todos os monitores</option>${getMonitorUsers().map((u) => `<option value="${u.uid}">${escapeHtml(u.nome)}</option>`).join("")}</select>`
    : "";

  $("#tasksPage").innerHTML = `
    <div class="toolbar">
      <input id="filterSearch" placeholder="Buscar demanda, local ou descrição" />
      <select id="filterStatus">
        <option value="">Todos os status</option>
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
        <option value="late">Atrasadas</option>
      </select>
      <select id="filterPriority">
        <option value="">Todas as prioridades</option>
        ${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
      </select>
      ${monitorOptions}
      ${isAdmin() ? `<button class="btn primary" data-go-new>Nova demanda</button>` : ""}
    </div>
    <div id="taskList" class="task-list"></div>
  `;

  const renderFiltered = () => {
    const q = ($("#filterSearch").value || "").toLowerCase();
    const status = $("#filterStatus").value;
    const priority = $("#filterPriority").value;
    const monitor = $("#filterMonitor")?.value || "";

    const filtered = tasks.filter((t) => {
      const text = `${t.titulo} ${t.descricao} ${t.local} ${t.responsavelNome}`.toLowerCase();
      const okText = !q || text.includes(q);
      const okStatus = !status || (status === "late" ? isLate(t) : t.status === status);
      const okPriority = !priority || t.prioridade === priority;
      const okMonitor = !monitor || t.responsavelUid === monitor;
      return okText && okStatus && okPriority && okMonitor;
    });

    $("#taskList").innerHTML = filtered.map(taskCard).join("") || `<div class="empty">Nenhuma demanda encontrada.</div>`;
    bindTaskButtons();
  };

  ["filterSearch", "filterStatus", "filterPriority", "filterMonitor"].forEach((id) => {
    $(`#${id}`)?.addEventListener("input", renderFiltered);
    $(`#${id}`)?.addEventListener("change", renderFiltered);
  });

  $("[data-go-new]")?.addEventListener("click", () => setPage("newTask"));
  renderFiltered();
}

function renderNewTask() {
  if (!isAdmin()) {
    setPage("tasks");
    return;
  }

  $("#newTaskPage").classList.remove("hidden");
  const monitors = getMonitorUsers();

  $("#newTaskPage").innerHTML = `
    <form id="newTaskForm" class="card form-card">
      <div class="form-row">
        <label>
          Título da demanda
          <input name="titulo" placeholder="Ex.: Organizar bancada de comandos elétricos" required />
        </label>
        <label>
          Monitor responsável
          <select name="responsavelUid" required>
            <option value="">Selecione o monitor</option>
            ${monitors.map((u) => `<option value="${u.uid}">${escapeHtml(u.nome)} · ${escapeHtml(u.area || "")}</option>`).join("")}
          </select>
        </label>
      </div>

      <label>
        Descrição da atividade
        <textarea name="descricao" placeholder="Descreva exatamente o que precisa ser feito, materiais envolvidos e critério de conclusão." required></textarea>
      </label>

      <div class="form-row">
        <label>
          Local
          <input name="local" placeholder="Ex.: Laboratório de Instalações Elétricas" required />
        </label>
        <label>
          Tipo de serviço
          <select name="tipo">
            ${SERVICE_TYPES.map((t) => `<option>${escapeHtml(t)}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="form-row">
        <label>
          Prioridade
          <select name="prioridade">
            <option value="baixa">Baixa</option>
            <option value="media" selected>Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </label>
        <label>
          Prazo para conclusão
          <input name="prazo" type="datetime-local" required />
        </label>
      </div>

      <div class="form-row">
        <label>
          Exigir foto de evidência?
          <select name="exigeFoto">
            <option value="true" selected>Sim</option>
            <option value="false">Não</option>
          </select>
        </label>
        <label>
          Exigir aprovação do coordenador?
          <select name="exigeAprovacao">
            <option value="true" selected>Sim</option>
            <option value="false">Não</option>
          </select>
        </label>
      </div>

      <label>
        Observações para o monitor
        <textarea name="observacoes" placeholder="Ex.: Deixar materiais identificados e anexar foto do antes e depois."></textarea>
      </label>

      <button class="btn primary" type="submit">Criar demanda e notificar monitor</button>
    </form>
  `;

  $("#newTaskForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const monitor = state.users.find((u) => u.uid === form.get("responsavelUid"));
    if (!monitor) return toast("Selecione um monitor válido.");

    const prazo = form.get("prazo");
    const task = {
      titulo: form.get("titulo"),
      descricao: form.get("descricao"),
      local: form.get("local"),
      tipo: form.get("tipo"),
      prioridade: form.get("prioridade"),
      status: "pending",
      responsavelUid: monitor.uid,
      responsavelNome: monitor.nome,
      prazo,
      dueAt: new Date(prazo).toISOString(),
      exigeFoto: form.get("exigeFoto") === "true",
      exigeAprovacao: form.get("exigeAprovacao") === "true",
      observacoes: form.get("observacoes"),
      criadoPorUid: state.currentUser.uid,
      criadoPorNome: state.currentUser.nome,
      criadoEm: nowIso(),
      iniciadoEm: "",
      finalizadoEm: "",
      aprovadoEm: "",
      observacaoFinal: "",
      materiais: "",
      anexos: [],
      historico: [
        { dataHora: nowIso(), usuario: state.currentUser.nome, acao: "Demanda criada", observacao: "Monitor notificado pelo aplicativo." }
      ]
    };

    await saveTask(task);
    await saveNotification({
      usuarioUid: monitor.uid,
      titulo: "Nova demanda atribuída",
      mensagem: `${task.titulo} · prazo: ${formatDateTime(task.dueAt)}`,
      tipo: "nova_demanda",
      lida: false
    });

    toast("Demanda criada e notificação registrada para o monitor.");
    browserNotify("Nova demanda criada", `${monitor.nome}: ${task.titulo}`);
    event.currentTarget.reset();
    setPage("tasks");
  });
}

function renderMonitors() {
  if (!isAdmin()) {
    setPage("tasks");
    return;
  }

  $("#monitorsPage").classList.remove("hidden");
  const rows = getMonitorUsers().map((u) => `
    <tr>
      <td><strong>${escapeHtml(u.nome)}</strong><br><span class="muted">${escapeHtml(u.email || "")}</span></td>
      <td>${escapeHtml(u.area || "—")}</td>
      <td>${u.ativo ? `<span class="badge done">Ativo</span>` : `<span class="badge neutral">Inativo</span>`}</td>
      <td>${(u.responsabilidades || []).map((r) => `• ${escapeHtml(r)}`).join("<br>") || "—"}</td>
      <td><button class="btn ghost small" data-edit-monitor="${u.uid}">Editar</button></td>
    </tr>
  `).join("");

  $("#monitorsPage").innerHTML = `
    <div class="grid cols-2">
      <form id="monitorForm" class="card form-card">
        <h3>Cadastrar monitor</h3>
        <div class="form-row">
          <label>
            Nome
            <input name="nome" required placeholder="Nome do monitor" />
          </label>
          <label>
            E-mail
            <input name="email" type="email" required placeholder="email@exemplo.com" />
          </label>
        </div>

        <div class="form-row">
          <label>
            Área/Laboratório
            <input name="area" placeholder="Ex.: Laboratório de Energia" />
          </label>
          <label>
            Senha inicial local
            <input name="senha" value="123456" />
          </label>
        </div>

        <label>
          Responsabilidades
          <textarea name="responsabilidades" placeholder="Uma responsabilidade por linha">${RESPONSIBILITIES.join("\n")}</textarea>
        </label>

        <button class="btn primary" type="submit">Salvar monitor</button>
      </form>

      <div class="card responsibility-card">
        <h3>Responsabilidade padrão do monitor</h3>
        <p class="muted">Cada demanda criada fica individualizada, com início, fim, fotos, baixa e aprovação.</p>
        <ul>
          ${RESPONSIBILITIES.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
        </ul>
      </div>
    </div>

    <div class="section-title">
      <div>
        <h3>Monitores cadastrados</h3>
        <p>Controle de acesso, área e responsabilidades.</p>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Monitor</th>
            <th>Área</th>
            <th>Status</th>
            <th>Responsabilidades</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5">Nenhum monitor cadastrado.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  $("#monitorForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const user = {
      nome: form.get("nome"),
      email: form.get("email"),
      senha: form.get("senha") || "123456",
      perfil: "monitor",
      area: form.get("area"),
      ativo: true,
      responsabilidades: String(form.get("responsabilidades") || "").split("\n").map((x) => x.trim()).filter(Boolean)
    };
    await saveUser(user);
    toast("Monitor salvo.");
    event.currentTarget.reset();
  });

  $$("[data-edit-monitor]").forEach((btn) => {
    btn.addEventListener("click", () => showMonitorDialog(btn.dataset.editMonitor));
  });
}

function showMonitorDialog(userId) {
  const user = state.users.find((u) => u.uid === userId);
  if (!user) return;

  const html = `
    <h2>Editar monitor</h2>
    <form id="editMonitorForm" class="form-card">
      <label>Nome<input name="nome" value="${escapeHtml(user.nome)}" required /></label>
      <label>E-mail<input name="email" type="email" value="${escapeHtml(user.email)}" required /></label>
      <label>Área<input name="area" value="${escapeHtml(user.area || "")}" /></label>
      <label>Status
        <select name="ativo">
          <option value="true" ${user.ativo ? "selected" : ""}>Ativo</option>
          <option value="false" ${!user.ativo ? "selected" : ""}>Inativo</option>
        </select>
      </label>
      <label>Responsabilidades
        <textarea name="responsabilidades">${escapeHtml((user.responsabilidades || []).join("\n"))}</textarea>
      </label>
      <button class="btn primary" type="submit">Atualizar monitor</button>
    </form>
  `;

  openDialog(html);

  $("#editMonitorForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveUser({
      ...user,
      nome: form.get("nome"),
      email: form.get("email"),
      area: form.get("area"),
      ativo: form.get("ativo") === "true",
      responsabilidades: String(form.get("responsabilidades") || "").split("\n").map((x) => x.trim()).filter(Boolean)
    });
    $("#taskDialog").close();
    toast("Monitor atualizado.");
  });
}

function renderNotifications() {
  $("#notificationsPage").classList.remove("hidden");
  const list = state.notifications
    .filter((n) => isAdmin() || n.usuarioUid === state.currentUser.uid)
    .sort((a, b) => new Date(b.criadaEm?.toDate ? b.criadaEm.toDate() : b.criadaEm || 0) - new Date(a.criadaEm?.toDate ? a.criadaEm.toDate() : a.criadaEm || 0));

  $("#notificationsPage").innerHTML = `
    <div class="notification-list">
      ${list.map((n) => `
        <article class="card notification-card ${n.lida ? "" : "unread"}">
          <div class="task-head">
            <div>
              <h3>${escapeHtml(n.titulo)}</h3>
              <p class="task-desc">${escapeHtml(n.mensagem)}</p>
              <p class="muted">${formatDateTime(n.criadaEm)}</p>
            </div>
            <span class="badge ${n.lida ? "neutral" : "pending"}">${n.lida ? "Lida" : "Não lida"}</span>
          </div>
          ${!n.lida ? `<button class="btn ghost small" data-read-notification="${n.id}">Marcar como lida</button>` : ""}
        </article>
      `).join("") || `<div class="empty">Nenhuma notificação encontrada.</div>`}
    </div>
  `;

  $$("[data-read-notification]").forEach((btn) => {
    btn.addEventListener("click", () => markNotificationRead(btn.dataset.readNotification));
  });
}

function renderReports() {
  $("#reportsPage").classList.remove("hidden");
  const tasks = visibleTasks();
  const done = tasks.filter((t) => t.status === "done").length;
  const late = tasks.filter((t) => isLate(t)).length;
  const review = tasks.filter((t) => t.status === "review").length;

  const rows = tasks.map((t) => `
    <tr>
      <td><strong>${escapeHtml(t.titulo)}</strong><br><span class="muted">${escapeHtml(t.local || "")}</span></td>
      <td>${escapeHtml(t.responsavelNome || "")}</td>
      <td>${taskBadge(t)}</td>
      <td>${priorityBadge(t.prioridade)}</td>
      <td>${formatDateTime(t.iniciadoEm)}</td>
      <td>${formatDateTime(t.finalizadoEm)}</td>
      <td>${formatDateTime(t.dueAt || t.prazo)}</td>
    </tr>
  `).join("");

  $("#reportsPage").innerHTML = `
    <div class="grid cols-4">
      ${statCard("Demandas", tasks.length)}
      ${statCard("Concluídas", done)}
      ${statCard("Aguardando aprovação", review)}
      ${statCard("Atrasadas", late)}
    </div>

    <div class="toolbar" style="margin-top: 18px;">
      <button class="btn primary" onclick="window.print()">Gerar PDF / Imprimir</button>
      <button class="btn ghost" id="exportJsonBtn">Exportar JSON</button>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Demanda</th>
            <th>Monitor</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7">Sem registros para relatório.</td></tr>`}</tbody>
      </table>
    </div>

    <p class="footer-note">SENAI HUB Inovação e Tecnologia | Desenvolvido por Joelson M. Mendes – Esp. em Energia e IoT.</p>
  `;

  $("#exportJsonBtn").addEventListener("click", () => {
    const data = JSON.stringify({ users: state.users, tasks: state.tasks, notifications: state.notifications }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "backup-monitor-eletrica.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function bindTaskButtons() {
  $$("[data-view-task]").forEach((btn) => btn.addEventListener("click", () => showTaskDialog(btn.dataset.viewTask)));
  $$("[data-start-task]").forEach((btn) => btn.addEventListener("click", () => startTask(btn.dataset.startTask)));
  $$("[data-finish-task]").forEach((btn) => btn.addEventListener("click", () => finishTaskDialog(btn.dataset.finishTask)));
  $$("[data-photo-task]").forEach((btn) => btn.addEventListener("click", () => photoTaskDialog(btn.dataset.photoTask)));
  $$("[data-approve-task]").forEach((btn) => btn.addEventListener("click", () => approveTask(btn.dataset.approveTask)));
  $$("[data-return-task]").forEach((btn) => btn.addEventListener("click", () => returnTaskDialog(btn.dataset.returnTask)));
  $$("[data-cancel-task]").forEach((btn) => btn.addEventListener("click", () => cancelTask(btn.dataset.cancelTask)));
}

function getTask(id) {
  return state.tasks.find((t) => t.id === id);
}

async function startTask(id) {
  const task = getTask(id);
  if (!task) return;
  task.status = "progress";
  task.iniciadoEm = nowIso();
  task.historico = task.historico || [];
  task.historico.push({ dataHora: nowIso(), usuario: state.currentUser.nome, acao: "Serviço iniciado", observacao: "Monitor iniciou a execução pelo aplicativo." });
  await saveTask(task);
  await saveNotification({
    usuarioUid: task.criadoPorUid,
    titulo: "Serviço iniciado",
    mensagem: `${task.responsavelNome} iniciou: ${task.titulo}`,
    tipo: "servico_iniciado",
    lida: false
  });
  toast("Serviço iniciado. O horário foi registrado.");
}

function finishTaskDialog(id) {
  const task = getTask(id);
  if (!task) return;

  openDialog(`
    <h2>Dar baixa no serviço</h2>
    <p class="muted">Informe a conclusão e anexe imagem se necessário.</p>
    <form id="finishTaskForm" class="form-card">
      <label>
        Observação final
        <textarea name="observacaoFinal" placeholder="Descreva o que foi feito, pendências e resultado final." required>${escapeHtml(task.observacaoFinal || "")}</textarea>
      </label>
      <label>
        Materiais utilizados ou pendências
        <textarea name="materiais" placeholder="Ex.: Cabos separados, disjuntores testados, falta etiqueta...">${escapeHtml(task.materiais || "")}</textarea>
      </label>
      <label>
        Fotos do serviço
        <input name="fotos" type="file" accept="image/*" multiple ${task.exigeFoto && !(task.anexos || []).length ? "required" : ""} />
      </label>
      <button class="btn success" type="submit">Confirmar baixa do serviço</button>
    </form>
  `);

  $("#finishTaskForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = [...form.getAll("fotos")].filter((f) => f && f.size);

    const anexos = [...(task.anexos || [])];
    for (const file of files) {
      const url = await uploadImage(task.id, file);
      anexos.push({
        id: uid(),
        url,
        nome: file.name,
        enviadoPor: state.currentUser.nome,
        enviadoEm: nowIso()
      });
    }

    if (task.exigeFoto && anexos.length === 0) {
      return toast("Esta demanda exige pelo menos uma foto de comprovação.");
    }

    task.observacaoFinal = form.get("observacaoFinal");
    task.materiais = form.get("materiais");
    task.anexos = anexos;
    task.finalizadoEm = nowIso();
    task.status = task.exigeAprovacao ? "review" : "done";
    task.historico = task.historico || [];
    task.historico.push({
      dataHora: nowIso(),
      usuario: state.currentUser.nome,
      acao: task.exigeAprovacao ? "Baixa enviada para aprovação" : "Serviço concluído",
      observacao: task.observacaoFinal
    });

    await saveTask(task);
    await saveNotification({
      usuarioUid: task.criadoPorUid,
      titulo: "Demanda aguardando aprovação",
      mensagem: `${task.responsavelNome} deu baixa em: ${task.titulo}`,
      tipo: "baixa_servico",
      lida: false
    });

    $("#taskDialog").close();
    toast("Baixa registrada. A demanda foi enviada para aprovação.");
  });
}

function photoTaskDialog(id) {
  const task = getTask(id);
  if (!task) return;

  openDialog(`
    <h2>Anexar imagens</h2>
    <form id="photoTaskForm" class="form-card">
      <label>
        Selecione uma ou mais imagens
        <input name="fotos" type="file" accept="image/*" multiple required />
      </label>
      <button class="btn primary" type="submit">Enviar imagens</button>
    </form>
  `);

  $("#photoTaskForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = [...form.getAll("fotos")].filter((f) => f && f.size);
    const anexos = [...(task.anexos || [])];

    for (const file of files) {
      const url = await uploadImage(task.id, file);
      anexos.push({
        id: uid(),
        url,
        nome: file.name,
        enviadoPor: state.currentUser.nome,
        enviadoEm: nowIso()
      });
    }

    task.anexos = anexos;
    task.historico = task.historico || [];
    task.historico.push({ dataHora: nowIso(), usuario: state.currentUser.nome, acao: "Imagem anexada", observacao: `${files.length} imagem(ns) enviada(s).` });
    await saveTask(task);
    $("#taskDialog").close();
    toast("Imagem anexada com sucesso.");
  });
}

async function approveTask(id) {
  const task = getTask(id);
  if (!task) return;

  task.status = "done";
  task.aprovadoEm = nowIso();
  task.historico = task.historico || [];
  task.historico.push({ dataHora: nowIso(), usuario: state.currentUser.nome, acao: "Serviço aprovado", observacao: "Baixa validada pelo coordenador." });
  await saveTask(task);

  await saveNotification({
    usuarioUid: task.responsavelUid,
    titulo: "Serviço aprovado",
    mensagem: `Sua demanda foi aprovada: ${task.titulo}`,
    tipo: "aprovacao",
    lida: false
  });

  toast("Serviço aprovado.");
}

function returnTaskDialog(id) {
  const task = getTask(id);
  if (!task) return;

  openDialog(`
    <h2>Devolver demanda</h2>
    <form id="returnTaskForm" class="form-card">
      <label>
        Motivo da devolução
        <textarea name="motivo" placeholder="Descreva o que precisa corrigir." required></textarea>
      </label>
      <button class="btn warning" type="submit">Devolver para correção</button>
    </form>
  `);

  $("#returnTaskForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const motivo = new FormData(event.currentTarget).get("motivo");
    task.status = "returned";
    task.historico = task.historico || [];
    task.historico.push({ dataHora: nowIso(), usuario: state.currentUser.nome, acao: "Demanda devolvida", observacao: motivo });
    await saveTask(task);
    await saveNotification({
      usuarioUid: task.responsavelUid,
      titulo: "Demanda devolvida",
      mensagem: `${task.titulo}: ${motivo}`,
      tipo: "devolucao",
      lida: false
    });
    $("#taskDialog").close();
    toast("Demanda devolvida ao monitor.");
  });
}

async function cancelTask(id) {
  const task = getTask(id);
  if (!task) return;
  if (!confirm("Deseja cancelar esta demanda?")) return;

  task.status = "canceled";
  task.historico = task.historico || [];
  task.historico.push({ dataHora: nowIso(), usuario: state.currentUser.nome, acao: "Demanda cancelada", observacao: "Cancelada pelo coordenador." });
  await saveTask(task);
  await saveNotification({
    usuarioUid: task.responsavelUid,
    titulo: "Demanda cancelada",
    mensagem: `A demanda foi cancelada: ${task.titulo}`,
    tipo: "cancelamento",
    lida: false
  });
  toast("Demanda cancelada.");
}

function showTaskDialog(id) {
  const task = getTask(id);
  if (!task) return;

  const images = (task.anexos || []).map((a) => `<a href="${a.url}" target="_blank" rel="noopener"><img src="${a.url}" alt="${escapeHtml(a.nome || "Imagem anexada")}" /></a>`).join("");
  const history = (task.historico || []).map((h) => `
    <div class="timeline-item">
      <strong>${escapeHtml(h.acao)}</strong>
      <span>${formatDateTime(h.dataHora)} · ${escapeHtml(h.usuario || "")}</span>
      ${h.observacao ? `<p>${escapeHtml(h.observacao)}</p>` : ""}
    </div>
  `).join("");

  openDialog(`
    <h2>${escapeHtml(task.titulo)}</h2>
    <p class="task-desc">${escapeHtml(task.descricao || "")}</p>

    <div class="grid cols-2" style="margin-top: 16px;">
      <div class="card">
        <h3>Dados da demanda</h3>
        <dl class="kv">
          <div><dt>Status</dt><dd>${taskBadge(task)}</dd></div>
          <div><dt>Prioridade</dt><dd>${priorityBadge(task.prioridade)}</dd></div>
          <div><dt>Responsável</dt><dd>${escapeHtml(task.responsavelNome || "—")}</dd></div>
          <div><dt>Local</dt><dd>${escapeHtml(task.local || "—")}</dd></div>
          <div><dt>Tipo</dt><dd>${escapeHtml(task.tipo || "—")}</dd></div>
          <div><dt>Prazo</dt><dd>${formatDateTime(task.dueAt || task.prazo)}</dd></div>
          <div><dt>Criada em</dt><dd>${formatDateTime(task.criadoEm)}</dd></div>
          <div><dt>Iniciada em</dt><dd>${formatDateTime(task.iniciadoEm)}</dd></div>
          <div><dt>Finalizada em</dt><dd>${formatDateTime(task.finalizadoEm)}</dd></div>
          <div><dt>Aprovada em</dt><dd>${formatDateTime(task.aprovadoEm)}</dd></div>
        </dl>
      </div>

      <div class="card">
        <h3>Baixa do serviço</h3>
        <p><strong>Observação final:</strong><br>${escapeHtml(task.observacaoFinal || "Ainda não informada.")}</p>
        <p><strong>Materiais/Pendências:</strong><br>${escapeHtml(task.materiais || "Nada informado.")}</p>
        <p><strong>Observações iniciais:</strong><br>${escapeHtml(task.observacoes || "Sem observações.")}</p>
      </div>
    </div>

    <div class="section-title">
      <div>
        <h3 style="color:#0f172a">Imagens anexadas</h3>
        <p style="color:#64748b">Evidências do antes, durante ou depois do serviço.</p>
      </div>
    </div>
    <div class="image-grid">${images || `<div class="muted">Nenhuma imagem anexada.</div>`}</div>

    <div class="section-title">
      <div>
        <h3 style="color:#0f172a">Histórico</h3>
        <p style="color:#64748b">Linha do tempo da demanda.</p>
      </div>
    </div>
    <div class="timeline">${history || `<div class="muted">Sem histórico.</div>`}</div>
  `);
}

function openDialog(html) {
  $("#taskDialogContent").innerHTML = html;
  $("#taskDialog").showModal();
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    toast("Este navegador não possui suporte a notificações.");
    return;
  }

  const result = await Notification.requestPermission();
  if (result === "granted") {
    toast("Notificações ativadas.");

    if (firebase.enabled && firebase.messaging && VAPID_KEY) {
      try {
        const { getToken } = firebase.modules.msgMod;
        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(firebase.messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        console.log("Token FCM:", token);
      } catch (err) {
        console.warn(err);
      }
    }
  } else {
    toast("Notificações não foram autorizadas.");
  }
}

async function registerPwa() {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("./service-worker.js");
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    $("#installBtn").classList.remove("hidden");
  });

  $("#installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) {
      toast("No iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início.");
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("#installBtn").classList.add("hidden");
  });
}

function afterLogin() {
  $("#loginView").classList.add("hidden");
  $("#mainView").classList.remove("hidden");
  if (state.page === "newTask" && !isAdmin()) state.page = "tasks";
  renderShell();
  renderCurrentPage();

  const unread = state.notifications.filter((n) => n.usuarioUid === state.currentUser.uid && !n.lida);
  if (unread.length) {
    toast(`Você tem ${unread.length} notificação(ões) não lida(s).`);
  }
}

async function boot() {
  await registerPwa();
  await initFirebase();

  setTimeout(() => {
    $("#splash").classList.add("hidden");
    $("#app").classList.remove("hidden");
  }, 650);

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const email = $("#loginEmail").value.trim();
      const password = $("#loginPassword").value;
      await login(email, password);
    } catch (err) {
      toast(err.message || "Falha no login.");
    }
  });

  $$(".demo-login").forEach((btn) => {
    btn.addEventListener("click", async () => {
      $("#loginEmail").value = btn.dataset.email;
      $("#loginPassword").value = btn.dataset.password;
      await login(btn.dataset.email, btn.dataset.password);
    });
  });

  $("#logoutBtn").addEventListener("click", logout);
  $("#notifyPermissionBtn").addEventListener("click", requestNotificationPermission);
  $("#menuToggle").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  document.addEventListener("click", (event) => {
    if (window.innerWidth <= 820 && !event.target.closest(".sidebar") && !event.target.closest("#menuToggle")) {
      $(".sidebar").classList.remove("open");
    }
  });

  if (firebase.enabled) {
    const { onAuthStateChanged } = firebase.modules.authMod;
    onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) return;
      await syncFirebaseUser(user);
      subscribeFirebase();
      afterLogin();
    });
  } else {
    subscribeLocal();
  }
}

boot();
