# ai_licia® Overlays

A static Next.js application that ships three configurable overlays for OBS/browser sources:
1. Top chatters leaderboard
2. Message-rate pulse card
3. Joint chat feed (cross-platform chat + EventSub events)

It uses `ai_licia-client@1.4.0` for public chat and unified EventSub streaming.

## Quick start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to launch the studio, drop in your channel API key + channel name, and copy the generated overlay link directly into an OBS browser source.

## Commands

| Script | Description |
| --- | --- |
| `pnpm dev` | Run the local dev server |
| `pnpm build` | Compile and statically export the site (output goes to `out/`) |

## Overlay anatomy

- **Leaderboard configurator (`/configure`)**: Collects API key, channel name, role filters, visual settings, and context generation cadence.
- **Message-rate configurator (`/configure/message-rate`)**: Exposes pulse-card-specific setup.
- **Joint-chat configurator (`/configure/joint-chat`)**: Adds platform filters (Twitch, Kick, YouTube, TikTok), EventSub toggles, profanity masking, timing controls, and lifecycle animation settings.
- **Overlay routes**:
  - `/overlay` for leaderboard
  - `/overlay/total` for standalone message-rate card
  - `/overlay/joint-chat` for the unified chat/events feed

## Query parameters (leaderboard + total rate)

| Param | Description |
| --- | --- |
| `apiKey` | Channel API key (required) |
| `channel` | Channel name (required) |
| `baseUrl` | Override api base (defaults to `https://api.getailicia.com/v1`) |
| `roles` | Comma-separated list from `Mod,VIP,AI,Viewer,Streamer` |
| `excluded` | Comma-separated usernames to ignore |
| `contextInterval` | Interval in ms for context sync (default `60000`) |
| `overtakeNotifications` | `1`/`0` toggle for top-chatter overtake notifications (default `1`) |
| `overtakeInterval` | Interval in ms for overtake digests (default `0` = immediate) |
| `theme` | One of `aurora`, `ember`, `lumen` |
| `rank1`, `rank2`, `rank3` | Optional gradient overrides in the form `#from-#to` |
| `layout` | `horizontal` (default) or `vertical` |
| `showRates` | `1`/`0` toggle for per-chatter msg/min (default `1`) |
| `showTotalRates` | `1` to render the stream-wide msg/min card |

## Query parameters (joint chat overlay)

Route: `/overlay/joint-chat`

| Param | Description |
| --- | --- |
| `apiKey` | Channel API key (required) |
| `channel` | Channel name (required) |
| `baseUrl` | Override api base (defaults to `https://api.getailicia.com/v1`) |
| `platforms` | Comma-separated list from `TWITCH,KICK,YOUTUBE,TIKTOK` |
| `maxItems` | Maximum on-screen rows before oldest is dropped |
| `chatSec` | Visible duration for chat rows (seconds, default `20`) |
| `eventSec` | Visible duration for event rows (seconds, default `20`) |
| `enterMs` | Entry animation duration (ms) |
| `exitMs` | Exit animation duration (ms) |
| `showStatus` | `1`/`0` toggle for status chips |
| `profanity` | `1`/`0` toggle for profanity masking |
| `disabledEvents` | Comma-separated EventSub event types to hide |
| `disabledChannelEvents` | Comma-separated documented channel-event categories to hide (`follow,subscription,cheer,raid`) |

Legacy note: older `chatMs` / `eventMs` links are still accepted and migrated to seconds for backward compatibility.

### Routes

- `/overlay` → three-card leaderboard (default)
- `/overlay/total` → stand-alone total message rate overlay (same query params supported)
- `/overlay/joint-chat` → unified cross-platform chat + EventSub events feed

Only overlay routes consume these params so the app can be hosted on GitHub Pages or any static host with zero server logic.

## Deploying to GitHub Pages without `/repo` in the URL

By default, the GitHub Actions workflow exports the site under `/{repo-name}` so project pages like `https://user.github.io/ai_licia-core/` work out-of-the-box. If you want to serve the overlay examples from a custom domain such as `https://overlay.example.com/`, configure the workflow inputs and DNS as follows:

1. **DNS**: Point your domain (or subdomain) to GitHub Pages by adding a `CNAME` record that targets `<username>.github.io`.
2. **Repository variables** (Settings → Secrets and variables → Variables):
   - `OVERLAYS_CUSTOM_DOMAIN`: set to the exact domain you pointed at GitHub Pages (e.g. `overlay.example.com`). The deploy job will write this value to `out/CNAME` before publishing so Pages knows to use it.
   - `OVERLAYS_BASE_PATH`: set to `/` (or leave blank) to disable the auto `/ai_licia-core` base path. (As a safeguard, the build also drops the repo base automatically whenever `OVERLAYS_CUSTOM_DOMAIN` is defined.)
3. Redeploy (push to `main` or run the `Deploy Overlay Examples to Pages` workflow manually). Once the Pages build finishes, the site is available at your custom domain without a repo suffix.

When developing locally you can mimic the production base path by exporting `NEXT_PUBLIC_BASE_PATH` (the same value the workflow injects from `OVERLAYS_BASE_PATH`).
