# Monitor Elétrica SENAI HUB — PWA

Aplicativo PWA para gestão de atividades dos monitores da elétrica.

## O que o app faz

- Login por perfil: coordenador/admin e monitor.
- Cadastro de monitores.
- Cadastro de demandas individuais.
- Notificação interna para o monitor.
- Controle de início do serviço.
- Controle de baixa/fim do serviço.
- Anexo de imagens como evidência.
- Aprovação ou devolução pelo coordenador.
- Dashboard com pendentes, atrasadas, em andamento e concluídas.
- Relatório por monitor.
- Exportação JSON.
- Instalação na tela inicial do Android/iOS como PWA.
- Modo demonstração local sem Firebase.
- Preparado para Firebase Authentication, Firestore e Storage.

---

## Acessos de teste local

Enquanto você não configurar o Firebase, o app roda no navegador usando `localStorage`.

| Perfil | E-mail | Senha |
|---|---|---|
| Coordenador | jmm.engiot@gmail.com | 123456 |
| Larissa | larissa.eletrica@senai.local | 123456 |
| Maysa | maysa.eletrica@senai.local | 123456 |
| Gabriel | gabriel.eletrica@senai.local | 123456 |

---

## Como testar no computador

1. Extraia a pasta do projeto.
2. Abra o arquivo `index.html` no navegador.
3. Entre com o acesso de coordenador.
4. Cadastre demandas e teste com os monitores.

Observação: para o PWA instalar corretamente, publique em HTTPS no Vercel, Firebase Hosting, Netlify ou GitHub Pages.

---

## Como publicar no Vercel

1. Crie um repositório no GitHub.
2. Envie todos os arquivos da pasta do projeto.
3. Acesse a Vercel.
4. Clique em **Add New Project**.
5. Selecione o repositório.
6. Deploy.
7. Abra o link gerado.
8. No celular, abra o link no navegador e instale o app.

---

## Como instalar no Android

1. Abra o link do app no Google Chrome.
2. Toque nos três pontinhos.
3. Toque em **Adicionar à tela inicial** ou **Instalar aplicativo**.
4. Confirme.

---

## Como instalar no iPhone/iOS

1. Abra o link no Safari.
2. Toque no botão de compartilhar.
3. Toque em **Adicionar à Tela de Início**.
4. Confirme.

---

# Configuração com Firebase

## 1. Criar o projeto

1. Acesse o Firebase Console.
2. Crie um projeto.
3. Crie um aplicativo Web.
4. Copie as chaves do SDK.

## 2. Editar o arquivo `firebase-config.js`

Cole suas chaves aqui:

```js
export const FIREBASE_CONFIG = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

## 3. Ativar Authentication

No Firebase:

- Authentication
- Sign-in method
- Ative **Email/Password**

Crie o usuário administrador:

```txt
jmm.engiot@gmail.com
```

## 4. Ativar Firestore Database

Crie o Firestore em modo produção.

Cole as regras do arquivo `firestore.rules`.

## 5. Ativar Storage

Ative o Firebase Storage.

Cole as regras do arquivo `storage.rules`.

---

# Observação sobre cadastro de usuários no Firebase

Por segurança, um site estático não deve criar usuários de Authentication livremente sem controle de administrador.

Na versão local, o cadastro funciona diretamente.

Na versão Firebase, você tem duas opções:

1. Criar os usuários dos monitores manualmente no Firebase Authentication.
2. Usar Cloud Functions para criação automática controlada pelo administrador.

A pasta `functions` contém um modelo inicial para evoluir essa parte.

---

# Estrutura de banco Firestore

```txt
usuarios/{uid}
  nome
  email
  perfil: admin | monitor | gestor
  area
  ativo
  responsabilidades[]

demandas/{demandaId}
  titulo
  descricao
  local
  tipo
  prioridade
  status
  responsavelUid
  responsavelNome
  prazo
  dueAt
  exigeFoto
  exigeAprovacao
  criadoPorUid
  criadoPorNome
  criadoEm
  iniciadoEm
  finalizadoEm
  aprovadoEm
  observacaoFinal
  materiais
  anexos[]
  historico[]

notificacoes/{notificacaoId}
  usuarioUid
  titulo
  mensagem
  tipo
  lida
  criadaEm
```

---

# Recomendação de uso

O fluxo ideal é:

1. Coordenador cria demanda.
2. Monitor recebe notificação no app.
3. Monitor clica em **Iniciar serviço**.
4. Sistema registra data e hora.
5. Monitor executa.
6. Monitor anexa foto.
7. Monitor clica em **Dar baixa**.
8. Coordenador aprova ou devolve.
9. Relatório fica registrado.

---

# Próximas melhorias possíveis

- Notificação push real pelo Firebase Cloud Messaging.
- Envio automático por WhatsApp.
- QR Code por bancada.
- Checklist por tipo de serviço.
- Assinatura digital.
- Painel para TV no laboratório.
- Relatório PDF com logomarca.
- Modo offline sincronizado com Firestore.
