# ai_licia mode for StackChan

This is a narrow extension of M5Stack's open-source factory firmware. It adds an **AI_LICIA** app while retaining Launcher, AI Agent, Avatar, ESP-NOW, App Center, Ezdata, Dance, and Setup.

The app is a direct `avatar.protocol.v1` renderer. It discovers ai_licia Desktop through `_ailicia-avatar._tcp.local`, requests `avatar.events.read`, stores the approved reconnect credential in the robot's application settings, and reconnects after Desktop, Wi-Fi, or IP address changes. There is no StackChan-specific network protocol and no bridge process.

The same WebSocket carries:

- speech lifecycle and mouth amplitude;
- semantic expressions and actions;
- 16-bit mono PCM audio;
- renderer-local mappings for the screen, servos, and RGB lights.

PCM received at 44.1 or 48 kHz is resampled to StackChan's 24 kHz speaker rate on the device.

## Prepare the source

Requirements: Git, Node.js, Python 3, and ESP-IDF 5.5.4.

```bash
node prepare.mjs
cd build/StackChan/firmware
python3 fetch_repos.py
idf.py build
```

The M5Stack source revision is pinned in `upstream.json`. `prepare.mjs` refuses to apply the extension if the upstream patch no longer matches cleanly.

## Flash and restore

Back up the factory flash before the first test. Then connect StackChan over USB and run:

```bash
idf.py flash monitor
```

Flashing replaces the installed firmware image, but this build retains the factory applications in source. A factory backup or M5Stack's official flasher remains the recovery path until the guided Desktop flasher is shipped.

## First connection

1. In ai_licia Desktop, open **Integrations > StackChan** and enable local-network avatar devices.
2. Open **AI_LICIA** on StackChan.
3. If more than one Desktop is found, select the intended Desktop on the robot.
4. Approve the avatar access request in Desktop.
5. Start a conversation. The face, mouth, lights, servos, and speaker should react from the same protocol stream.

The robot stores only the selected Desktop identity and its opaque reconnect credential. It never receives ai_licia API keys, chat credentials, REST access, or Vision access.

