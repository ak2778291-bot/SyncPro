# SyncPro — Frontend

Modern React frontend for the AI-powered construction schedule analysis platform.

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Animations & transitions |
| **Self-hosted auth** | Email/password (Postgres-backed via the API) + Google sign-in |
| **@react-oauth/google** | Google Identity Services button (ID-token flow) |
| **React Router** | Client-side routing |
| **Plotly.js** | Flowline & Gantt charts |
| **Zustand** | Chat state management |
| **Lucide React** | Icon library |
| **shadcn/ui** | UI component library |

## Prerequisites

- **Node.js 18+**
- **npm** or **yarn**
- Backend running on `http://localhost:8000` (provides the auth API)
- _(Optional)_ A **Google OAuth 2.0 Web Client ID** to enable "Continue with Google"

## Setup

### 1. Navigate to frontend
```bash
cd Syncpro_frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file:
```env
# Backend API URL
VITE_BACKEND_API=http://localhost:8000

# Google OAuth 2.0 Web Client ID (optional — leave blank to disable Google sign-in).
# Create at https://console.cloud.google.com/apis/credentials
# Authorized JavaScript origin: http://localhost:5173
VITE_GOOGLE_CLIENT_ID=
```

> Email/password sign-up & login work with no extra config. The "Continue with
> Google" button is disabled until both `VITE_GOOGLE_CLIENT_ID` (frontend) and
> `GOOGLE_CLIENT_ID` (backend) are set to the **same** Client ID.

### 4. Run dev server
```bash
npm run dev
```

Frontend runs at: **http://localhost:5173**

### 5. Build for production
```bash
npm run build
```

Output in `dist/` folder.

## Pages & Features

### Landing Page (`/`)
- nPlan/Alice-inspired design
- Multi-section scrollable layout
- "Get Started" → /signup ("Sign In" → /login)
- Supported formats showcase
- How it works (4-step flow)
- Platform capabilities grid

### Project Hub (after login, no project selected)
- Grid of all user's previous projects
- Project cards with name, filename, task count, date
- "Create New Knowledge Graph" button
- Click a project to open its workspace
- Sign-out button

### Dashboard (project selected)
- **Schedule Table** — All tasks in sortable table with search/filter
- **KG Viewer** — Interactive knowledge graph visualization (iframe)
- **Flowline Chart** — WBS Flowline + Gantt view (Plotly.js)
- **LLM Chat** — AI chat with project-scoped queries

### LLM Chat
- Multi-model selector (Groq Llama 3.3 70B, Llama 3.1 8B)
- Per-project chat sessions (persisted in localStorage)
- Auto-detects schedule queries → routes to Cypher agent
- General chat for non-schedule questions
- Markdown table rendering for query results

## Project Structure

```
Syncpro_frontend/
├── index.html              # Entry HTML (dark mode, no white flash)
├── package.json            # Dependencies & scripts
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript config
├── .env                    # Environment variables (DO NOT COMMIT)
├── public/                 # Static assets
└── src/
    ├── main.tsx            # Entry point (GoogleOAuthProvider + AuthProvider + Router + App)
    ├── App.tsx             # Routes (/, /login, /signup, /dashboard) + auth sync
    ├── index.css           # Global styles (dark theme, scrollbar)
    ├── context/
    │   ├── AuthContext.tsx      # JWT auth state (user, login/signup/google/logout)
    │   └── ScheduleContext.tsx  # Project state (projects, activeProject, userId)
    ├── pages/                   # Route-level pages ONLY
    │   ├── LandingPage.tsx      # Public landing page (/)
    │   ├── Login.tsx            # /login
    │   ├── Signup.tsx           # /signup
    │   ├── Dashboard.tsx        # /dashboard workspace shell
    │   └── LLMChat/
    │       ├── ChatLayout.tsx   # Chat page layout
    │       ├── ChatSidebar.tsx  # Chat session list
    │       ├── ChatWindow.tsx   # Chat messages & input
    │       ├── ChatMessage.tsx  # Single message bubble
    │       └── chatStore.ts     # MobX chat state (per-project)
    ├── components/              # Reusable, non-route components
    │   ├── Sidebar.tsx          # Dashboard navigation sidebar
    │   ├── ProjectHub.tsx       # Project selection hub
    │   ├── Loader.tsx           # Branded loading screen
    │   ├── ScheduleTable.tsx    # Task table view
    │   ├── KGViewer.tsx         # Knowledge graph iframe
    │   ├── FlowlineChart.tsx    # Flowline & Gantt charts
    │   ├── FileUploader.tsx     # Schedule file upload
    │   ├── EvalDashboard.tsx    # Evaluation metrics panel
    │   ├── GoogleAuthButton.tsx # Google sign-in button (placeholder-aware)
    │   └── ui/                  # shadcn/ui primitives (button, card, input, …)
    ├── api/
    │   └── client.ts            # Backend HTTP client + auth token helpers
    ├── lib/
    │   └── utils.ts             # Utility functions (cn)
    └── assets/                  # Images & icons
```

> Imports use the `@/` alias throughout (e.g. `@/components/Sidebar`,
> `@/context/AuthContext`). `pages/` holds only route targets; everything reusable
> lives in `components/`.

## Authentication Flow

Self-hosted: `AuthContext` (src/context/AuthContext.tsx) holds the user + a JWT
in localStorage and exposes the same `{ user, isLoaded }` shape the app consumed
before. Email/password and Google both resolve to one Postgres user with a single
`userId` (the Postgres UUID).

```
User visits / → LandingPage → "Get Started" → /signup (or "Sign In" → /login)
  → POST /auth/signup | /auth/login | /auth/google → { token, user }
  → token saved to localStorage (key: auth_token); user.id → ScheduleContext + chatStore
  → Navigate to /dashboard (guarded; redirects to /login if unauthenticated)
  → On reload, AuthContext rehydrates via GET /auth/me (clears token on 401)
  → Projects fetched from backend (filtered by userId)
  → No projects → ProjectHub ("Create New" or empty state)
  → Has projects → ProjectHub (click to open)
  → Active project → Dashboard workspace (Schedule, KG, Flowline, Chat)
```

## State Management

| Store | Library | Scope | Persistence |
|-------|---------|-------|-------------|
| **ScheduleContext** | React Context | App-wide | API (Neo4j) |
| **chatStore** | Zustand | Chat sessions | localStorage (per user + project) |
| **Component state** | useState | Local | None |

## Design System

| Element | Value |
|---------|-------|
| Background (page) | `bg-slate-950` (#020617) |
| Background (panel) | `bg-slate-900` |
| Background (card) | `bg-white/[0.02]` |
| Accent | `bg-blue-600` |
| Border | `border-white/[0.06]` |
| Text (primary) | `text-white` |
| Text (secondary) | `text-gray-400` |
| Text (muted) | `text-gray-500` |
| Font | System default (sans-serif) |
| Animations | Framer Motion, `duration: 0.25` |

## Commands Reference

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Deploy to Vercel
npm i -g vercel
vercel

# Install specific packages used
npm install react-router-dom
npm install @clerk/clerk-react
npm install framer-motion
npm install lucide-react
npm install react-plotly.js plotly.js
npm install zustand
npm install file-saver
npm install @types/file-saver -D
```

## Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```
Set environment variables in Vercel dashboard:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_BACKEND_API` (your deployed backend URL)
- `VITE_API_URL` (same as above)

### Netlify
```bash
npm run build
# Deploy dist/ folder
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm i -g serve
CMD ["serve", "-s", "dist", "-l", "3000"]
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| White flash on load | Ensure `index.html` has `class="dark"` on `<html>` |
| `useSchedule` error | Ensure `<ScheduleProvider>` wraps all routes in `App.tsx` |
| Google button disabled | Set `VITE_GOOGLE_CLIENT_ID` (frontend) **and** `GOOGLE_CLIENT_ID` (backend) to the same Web Client ID; add `http://localhost:5173` as an authorized JS origin |
| `401` on every API call | Token missing/expired — sign in again (clears & reissues the JWT) |
| CORS errors | Backend must allow `http://localhost:5173` origin |
| Chat not persisting | Check localStorage — key is `chat_sessions_{userId}_{projectId}` |
| KG not loading | Check that `graphs/graph_{projectId}.html` exists on backend |
| Models dropdown empty | Backend `/models` endpoint must return available models |

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+