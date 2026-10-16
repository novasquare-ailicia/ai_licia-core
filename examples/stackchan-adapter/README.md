# ai_licia StackChan adapter

This adapter drives the factory StackChan firmware from `avatar.protocol.v1`. It supports mouth amplitude, semantic expressions, side LEDs, head movement, and reaction actions. It does not flash or modify the robot.

## First hardware test

1. Install the current ai_licia Desktop development build and sign in.
2. On StackChan, open the **Dance** app. This enables the factory BLE avatar controls.
3. From this directory, run:

   ```bash
   npm install
   npm start
   ```

4. Approve the `ai_licia StackChan` access request in Desktop the first time.
5. Start an ai_licia conversation. Speech should animate the mouth, expressions, side LEDs, and head.

The approval credential is stored in `~/.ai_licia/stackchan-adapter.json` with user-only permissions, so normal restarts do not require another approval.

## Test without hardware

Run `npm run simulate`. The adapter connects to Desktop but prints every StackChan command instead of using Bluetooth.

## Limitations of the factory firmware

- Angry mode uses angled eyes and red side LEDs. Changing the actual eye fill colour requires custom firmware.
- Only reactions at the beginning of an utterance trigger a precisely timed action in this initial version. Later segment timing requires aligned TTS cue timestamps.
- Keep StackChan in Dance mode while the adapter is running.
