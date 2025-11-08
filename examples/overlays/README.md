# ai_licia® Overlays

A static Next.js application that ships a configurable “Top Chatters” overlay for OBS/browser sources. It consumes the public ai_licia® chat stream, mirrors the latest leaderboard, and sends context/generation events back to ai_licia® using the official `ai_licia-client@1.1.0`.

## Quick start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to launch the studio, drop in your channel API key + channel name, and copy the generated `/overlay?...` link directly into an OBS browser source (recommended size: 800×500).

## Commands

| Script | Description |
| --- | --- |
| `pnpm dev` | Run the local dev server |
| `pnpm build` | Compile and statically export the site (output goes to `out/`) |

## Overlay anatomy

- **Configurator (/**): Collects API key, channel name, roles to include, excluded usernames, and the cadence used to push leaderboard context back to ai_licia®.
- **Overlay (`/overlay?...`)**: Pure glassmorphism card stack showing the top 3 chatters only. Pick between three presets (Aurora, Ember, Lumen), switch between horizontal/vertical layouts, surface individual message rates, and optionally show a total stream-wide msg/min card.
- **API calls**:
  - Every *N* milliseconds (`contextInterval`) we call `client.sendEvent(...)` with a compact leaderboard summary so ai_licia® keeps up-to-date context.
  - Whenever someone dethrones the current leader we call `client.triggerGeneration(...)` to let ai_licia® celebrate the promotion.

## Query parameters

| Param | Description |
| --- | --- |
| `apiKey` | Channel API key (required) |
| `channel` | Channel name (required) |
| `baseUrl` | Override api base (defaults to `https://api.getailicia.com/v1`) |
| `roles` | Comma-separated list from `Mod,VIP,AI,Viewer,Streamer` |
| `excluded` | Comma-separated usernames to ignore |
| `contextInterval` | Interval in ms for context sync (default `60000`) |
| `theme` | One of `aurora`, `ember`, `lumen` |
| `rank1`, `rank2`, `rank3` | Optional gradient overrides in the form `#from-#to` |
| `layout` | `horizontal` (default) or `vertical` |
| `showRates` | `1`/`0` toggle for per-chatter msg/min (default `1`) |
| `showTotalRates` | `1` to render the stream-wide msg/min card |

### Routes

- `/overlay` → three-card leaderboard (default)
- `/overlay/total` → stand-alone total message rate overlay (same query params supported)

Only overlay routes consume these params so the app can be hosted on GitHub Pages or any static host with zero server logic.
