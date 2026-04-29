# LORGAR Pricing Tool v2 — Vercel Edition

AI-powered competitive pricing intelligence for ASBIS sales & category teams.
Migrated from Netlify to Vercel for **5-minute function timeout** (vs Netlify's 10s on free tier).

## What's new

- **Hosted on Vercel**: 5-minute function timeout = comfortable margin for Sonnet + 10× web_search
- **Two-agent architecture**: Sonnet builds the competitive map, Haiku scouts prices in parallel
- **7 separate markets**: Poland, Czechia, Hungary, Romania, Estonia, Latvia, Lithuania
- **Real-competition filter**: only products available at >=1 of the top 4 retailers per country
- **Per-product, per-country, per-date snapshots**: ready for pivot in Excel / DB
- **Two export formats**: CSV and XLSX

## Deploy to Vercel (5 minutes)

1. **Push this folder to GitHub** (you can re-use your existing repo or create a new one — `pricing-tool-v2` recommended)

2. Go to **[vercel.com](https://vercel.com)** → **Sign Up** with your GitHub account

3. Click **Add New → Project** → **Import** your repo

4. **Configure project**:
   - Framework Preset: **Vite** (auto-detected)
   - Build Command: `npm run build` (auto)
   - Output Directory: `dist` (auto)
   - **Don't deploy yet — first add the env variable below**

5. Expand **Environment Variables** section:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-...` (your Anthropic key — same one as before)
   - Environments: leave all 3 checked (Production, Preview, Development)

6. Click **Deploy**

7. Done — URL: `https://your-project-name.vercel.app`

## Differences from Netlify version

- Function file moved: `netlify/functions/claude.js` → `api/claude.js`
- Config: `netlify.toml` → `vercel.json`
- Endpoint: `/.netlify/functions/claude` → `/api/claude`
- Runtime: Deno (Netlify Edge) → Node.js 20 (Vercel default)
- **Timeout: 10s → 300s (5 minutes)** ← problem solved

The application logic, UI, scoring, storage — all identical to Netlify version.

## Stack

- **Frontend**: React + Vite (static build)
- **Backend**: Vercel Serverless Function (Node.js 20)
- **Storage**: localStorage per user account
- **Auth**: nick + 8-digit PIN

## File structure

```
pricing-app-vercel/
├── src/
│   ├── main.jsx        Entry
│   ├── App.jsx         Top-level UI: tabs, sidebar, results, history
│   ├── Login.jsx       Nick + PIN screen
│   ├── data.js         Products, markets, retailers, brands
│   ├── api.js          Two-agent research pipeline + scoring
│   └── storage.js      Per-user localStorage + CSV/XLSX export
├── api/
│   └── claude.js       Vercel serverless function (API proxy)
├── index.html
├── package.json
├── vite.config.js
└── vercel.json         Vercel config (5-minute timeout)
```

## Cost reminder

- Per SKU per market: **$0.05–0.12**
- Full scan 26 SKU one country: **~$2–3, ~15-20 min**
- Full scan all 7 countries: **~$15-20, ~2 hours**
- Vercel Hobby (free) tier: 100GB bandwidth, 1000 function invocations/day, 60GB-hours of function execution per month — more than enough for weekly scans by a 10-person team.
