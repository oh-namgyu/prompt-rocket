# Contributing to Prompt Rocket 🚀

Thanks for your interest — it's a toy, so keep it fun and simple.

## Development setup

```bash
npm start            # node server.js -> http://127.0.0.1:6030
```

No build step and no runtime dependencies. The client is plain JS in `public/`
(Three.js is vendored). CI runs `node --check` on the scripts.

## Guidelines

- Keep it zero-dependency and the client static (so the GitHub Pages demo keeps
  working — asset paths must stay relative).
- Server-side endpoints (leaderboard/SSE) must degrade gracefully when absent.
- Describe what changed and how you tested it (a screenshot/GIF helps for visual
  changes).
