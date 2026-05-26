# My Wellness Hub

Personal wellness tracker — schedule, workouts, recipes, and daily logging.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/wellness-hub/](http://localhost:5173/wellness-hub/).

## Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build + publish to GitHub Pages (`gh-pages` branch) |

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- No backend — data lives in `localStorage` (4 keys)
- Export / import via JSON backup (Recipes tab → Export data)
