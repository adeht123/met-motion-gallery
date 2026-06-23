# The MET Motion Gallery

An exploratory gallery web app connected to The Metropolitan Museum of Art Collection API. The first screen uses a black editorial canvas with measured artwork cards, then lets users search, filter, open object details, save works locally, and retry failed requests.

## Run

```bash
npm start
```

Open `http://localhost:4173`.

Development mode uses Node watch:

```bash
npm run dev
```

## Deploy to Vercel

This project deploys as static files plus a Vercel Function for `/api/met/*`.

1. Push the project to a GitHub repository.
2. In Vercel, create a new project from that repository.
3. Use Framework Preset `Other`.
4. Leave Build Command empty and keep Output Directory as the project root.
5. After deployment, verify `/api/met/departments`, search, and artwork detail views on the `*.vercel.app` URL.

Vercel Hobby is suitable for personal, non-commercial demos. Commercial use requires a paid Vercel plan.

## Update Workflow

After the GitHub repository is connected to Vercel:

```bash
npm test
git add .
git commit -m "Describe the change"
git push
```

Pushing to `main` will trigger a new Vercel production deployment. The public URL stays the same.

Current production URL: `https://met-motion-gallery.vercel.app`.

## Verify

```bash
npm test
node --check src/main.js
node --check src/metApi.js
node --check src/normalizer.js
node --check src/fallbackData.js
node --check server.mjs
```

## API Behavior

- Uses the public MET Collection API, with no API key.
- In the browser, requests go through the local `/api/met/*` proxy so upstream HTTP failures are returned as structured JSON and handled by the app's retry/error UI instead of surfacing as browser resource errors.
- Search maps UI controls to official query parameters: `q`, `departmentId`, `medium`, `dateBegin`, `dateEnd`, `hasImages`, `isHighlight`, and `isOnView`.
- Object details are loaded from the object endpoint and normalized before rendering.
- Requests support timeout, abort, retry, request de-duplication, in-memory cache, and `localStorage` cache.
- The local curated collection is a clearly separated fallback for first paint, offline mode, stale cache recovery, and API failure states. It is not treated as the normal production data source.

## Design System Notes

- Token source: CSS custom properties in `styles.css` and grid/card rules in `src/cardSystem.js`.
- Background: primitive `#030303`, semantic `--color-bg`.
- Card surface: `--color-card` `#efede6`, hover surface `--color-card-hover` `#f7f5ee`.
- Desktop layout: 12 calculated columns, 16px gap, page max width 1440px, page margin `clamp(24px, 4vw, 72px)`.
- Tablet layout: 8 columns, 14px gap below 1080px gallery width.
- Mobile layout: 4 columns, 12px gap below 560px gallery width, 16px page margin.
- Card spans: Feature 4 columns, Feature landscape 5 columns, Standard 3 columns, Compact 2 columns; mobile cards are 2-up with periodic full-width rhythm.
- Cards use 5px radius, tokenized 18/16/14px regular padding, 15/14/12px compact padding, and measured elevation tokens.
- Motion uses shared duration/easing tokens for reveal, layout, hover/focus, image load, dialog transitions, and supports `prefers-reduced-motion`.

## Fallback Conditions

Fallback cards can appear when:

- The first API hydration has not completed yet.
- The MET API or the network is unavailable.
- A cached object is used after a failed refresh.
- The service worker serves local shell assets while offline.

The UI labels these states through the API status dock, state panels, and retry actions.
