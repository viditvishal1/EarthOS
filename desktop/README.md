# Argus Desktop (G41)

Minimal [Tauri v2](https://v2.tauri.app/) scaffold wrapping the hosted Argus web app.

## Prerequisites

- Rust toolchain (`rustup`)
- Platform deps per [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

```bash
npm install -g @tauri-apps/cli@latest
cd desktop
npm install
```

## Development

Point at local Next.js:

```bash
# terminal 1
npm run dev

# terminal 2
cd desktop && ARGUS_DEV_URL=http://localhost:3000 npm run tauri dev
```

## Production build

Set `ARGUS_APP_URL` to your deployed instance (e.g. Vercel):

```bash
ARGUS_APP_URL=https://your-argus.vercel.app npm run tauri build
```

The desktop shell loads the web app in a native window with system tray and notifications (extend `src-tauri/` as needed).
