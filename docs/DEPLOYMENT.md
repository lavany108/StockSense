# StockSense Pro — Deployment Environment Variables

## Server (Render.com)

Set these 5 environment variables in the Render dashboard under **Environment**:

| Variable | Required | Example / Notes |
|---|---|---|
| `DATABASE_URL` | YES | `postgresql://user:pass@host/db?sslmode=require` - Neon or Render PostgreSQL URL |
| `JWT_SECRET` | YES | Minimum 32-character random string. Generate: `openssl rand -hex 32` |
| `CLIENT_URL` | YES | Your Vercel frontend URL, e.g. `https://stocksense.vercel.app` - Used for CORS origin |
| `NODE_ENV` | YES | `production` - Enables SameSite=None; Secure cookies and disables dev OTP logging |
| `JWT_EXPIRES_IN` | NO | `24h` (default). Adjust token lifetime if needed |

Build Command: `npm install && npm run build`
Start Command: `npm start` (runs `node dist/server.js`)
Root Directory: `server`

After first deploy, run the database seed via Render Shell:
  cd server && npx ts-node prisma/seed.ts

Or run `npm run seed:reset` to wipe and re-seed for a demo reset.

---

## Client (Vercel)

Set these 2 environment variables in the Vercel dashboard under Environment Variables:

| Variable | Required | Example / Notes |
|---|---|---|
| `VITE_API_URL` | YES | `https://stocksense-api.onrender.com/api/v1` - Must end with `/api/v1` |
| `VITE_SOCKET_URL` | YES | `https://stocksense-api.onrender.com` - Root URL only (no path) for Socket.io |

Framework Preset: Vite
Root Directory: `client`
Build Command: `npm run build`
Output Directory: `dist`

The `vercel.json` at the repo root handles SPA rewrites so React Router routes work on direct URL access.

---

## Local Development

Server (port 5001):
  DATABASE_URL=postgresql://...
  JWT_SECRET=your-dev-secret
  CLIENT_URL=http://localhost:5173
  NODE_ENV=development
  PORT=5001

Client (port 5173):
  VITE_API_URL=http://localhost:5001/api/v1
  VITE_SOCKET_URL=http://localhost:5001
