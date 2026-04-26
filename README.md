# ⚡ Swift — Swap with a message

A conversational crypto swap app powered by Groq AI and Delora.

---

## Setup (Windows)

### 1. Install dependencies
```
npm install
```

### 2. Add your Groq API key
Open the `.env` file in the project folder.
Replace `your_groq_api_key_here` with your real key from https://console.groq.com

### 3. Run locally
```
npm run dev
```
Open http://localhost:5173

---

## Setup (Mac/Linux)

### 1. Install dependencies
```bash
npm install
```

### 2. Copy and fill env file
```bash
cp .env.example .env
```
Then open `.env` and paste your Groq API key.

### 3. Run locally
```bash
npm run dev
```

---

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import your repo
3. In Vercel project settings → Environment Variables → add:
   - `VITE_GROQ_API_KEY` = your Groq key
4. Deploy

---

## What's inside

- `src/App.tsx` — Main app (chat UI, wallet connection, Groq parsing, Delora widget)
- `index.html` — Loads the Delora widget script
- `.env` — Your Groq API key (never commit this — protected by .gitignore)

---

## Credentials
- Delora API Key: ppk_80ca6e...240ec
- Delora Partner String: SWIFTAPP
- Fee: 0.5%
- Default chain: Base
