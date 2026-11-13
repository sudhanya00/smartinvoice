# SmartInvoice

**Photograph a receipt, get a tracked expense.** SmartInvoice reads receipts
and invoices with Gemini vision, files them by category, and lets you set
budgets and goals, schedule payment reminders, and ask questions about your
own spending in a chat.

**Live:** https://smartinvoice-eight.vercel.app

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28?logo=firebase&logoColor=black)
![Gemini](https://img.shields.io/badge/Gemini-Vision-4285F4?logo=google&logoColor=white)

## Features

- **Scan.** Upload or photograph a receipt. Gemini extracts the vendor, final
  amount paid, currency, date, category and a short description into
  structured JSON, which you can review before it is saved.
- **Invoices.** A searchable list of everything scanned, in seven
  currencies.
- **Dashboard.** Spending by category against your budgets, plus AI-written
  insights on recent activity.
- **Budgets and goals.** An overall limit and per-category limits, with
  savings goals tracked alongside.
- **Alerts.** Reminders for upcoming bills and payments.
- **Chat.** Ask about your spending in plain language. The model answers from
  your own invoices and budgets, and conversations are saved as sessions with
  generated titles.

## How it's built

- **React 18** single-page app with a bottom-tab layout designed for phones,
  styled with Tailwind and animated with Framer Motion.
- **Firebase Auth** (email and password) and **Firestore**. All data is stored
  per user, and live listeners keep every screen in sync.
- **Gemini** handles receipt parsing (image in, JSON out), dashboard insights,
  chat replies and chat titles, all through one small service class
  (`src/services/gemini.js`) with shared error handling. Calls go through a
  Vercel serverless function (`api/gemini.js`) that holds the key.
- Code is split by role: `screens/` for the eight tabs and pages, `services/`
  for Firebase, Firestore and Gemini, `hooks/` for auth and data
  subscriptions, `components/` for shared UI.

## Run locally

```bash
npm install
```

Create a `.env` file in the project root:

```
REACT_APP_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
REACT_APP_APP_ID=smartinvoice
GEMINI_API_KEY=your-gemini-key
```

`GEMINI_API_KEY` is read only by the server function. Set `GEMINI_MODEL` to
choose a different Gemini model.

The AI features need the server function, so run the app with the Vercel
CLI, which serves `api/` alongside the React dev server:

```bash
npx vercel dev
```

`npm start` also works (Tailwind watcher plus React dev server at
http://localhost:3000), but AI calls will fail without the function.

## Security

- **The Gemini key never reaches the browser.** The app calls its own
  serverless function (`api/gemini.js`), which holds the key in the server
  environment and forwards the request.
- **The function only serves signed-in users.** The browser sends the
  user's Firebase ID token; the function verifies its signature against
  Google's published certificates and checks audience, issuer and expiry
  before calling Gemini.
- **The function chooses the model and the fields.** Only `contents` and
  `generationConfig` are forwarded, so it cannot be used as a general proxy
  to other endpoints or models.
- **The build refuses to leak it.** Create React App copies every
  `REACT_APP_*` variable into the bundle whether or not the code reads it,
  so `scripts/build.js` blanks the old `REACT_APP_GEMINI_API_KEY` name before
  the client build runs.
- Receipt photos are scaled down in the browser before upload, which keeps
  requests small and fast.

## Limitations

- There is no per-user rate limit on AI calls yet.
- Built in 2025 as an early project; there is no automated test suite beyond
  the Create React App default.
