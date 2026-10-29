# SyncPro — pre-launch site (`syncpro.org`)

A standalone static marketing/teaser site. It is **deliberately decoupled** from
the product app in `apps/frontend` — no auth, no backend, no shared imports — so
it can be deployed and iterated independently, and so nothing of the real product
is exposed.

> **Disclosure guardrail:** this site is intentionally **vision-only**. It does
> not describe the architecture (graph schema, confidence-gated commit pipeline,
> counter-party trust scoring, disambiguation method) or the product roadmap.
> Keep it that way until Provisional 1 is filed — see
> `docs/strategy/00_FUTURE_PLAN.md`, Pre-Launch Checklist. Turn the disclosure
> dial up only after the priority date is secured.

## Stack

Vite + React 19 + TypeScript. Styling is the shared SyncPro design system
(`src/syncpro.css`, copied from `design-mockups/assets/syncpro.css`) plus a small
`src/site.css` for page-local layout. Icons via `lucide-react`.

## Develop

```bash
cd apps/site
cp .env.example .env        # optional — see "Waitlist form" below
npm install
npm run dev                 # http://localhost:5173
```

## Build

```bash
npm run build               # outputs static files to apps/site/dist/
npm run preview             # serve the production build locally
```

## Waitlist form

The form (`src/lib/waitlist.ts`) posts JSON to whatever URL you put in
`VITE_WAITLIST_ENDPOINT`. Any service that accepts a form POST works — e.g.
[Formspree](https://formspree.io), [Web3Forms](https://web3forms.com),
[Formspark](https://formspark.io). Set it as an env var on your host.

If `VITE_WAITLIST_ENDPOINT` is **unset**, the form falls back to opening a
pre-filled `mailto:` to `VITE_CONTACT_EMAIL` (default `founders@syncpro.org`), so
the site is still useful before a form backend is wired up.

## Deploy

The build is fully static (`dist/`), so any static host works.

**Vercel / Netlify / Cloudflare Pages** — point at this subdirectory:

| Setting          | Value          |
| ---------------- | -------------- |
| Root / base dir  | `apps/site`    |
| Build command    | `npm run build`|
| Output directory | `dist`         |
| Env var          | `VITE_WAITLIST_ENDPOINT`, `VITE_CONTACT_EMAIL` |

### Point `syncpro.org` at it

1. Add `syncpro.org` (and `www.syncpro.org`) as a custom domain in your host.
2. At your DNS registrar, create the records the host shows you — typically:
   - apex `syncpro.org` → `A`/`ALIAS` to the host's IP/target, and
   - `www` → `CNAME` to the host's target.
3. Enable the auto-provisioned TLS certificate. Done.
