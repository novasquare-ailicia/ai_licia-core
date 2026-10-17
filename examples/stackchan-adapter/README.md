# ai_licia StackChan adapter

This adapter drives the factory StackChan firmware from `avatar.protocol.v1`. It supports mouth amplitude, semantic expressions, side LEDs, head movement, and reaction actions. It does not flash or modify the robot.

## First hardware test

1. Open ai_licia Desktop, sign in, and select **Integrations > StackChan** for the live setup status.
2. On StackChan, open the **Dance** app. This enables the factory BLE avatar controls.
3. From this directory, run:

   ```bash
   npm install
   npm start
   ```

4. Approve the `ai_licia StackChan` access request in Desktop the first time.
5. Start an ai_licia conversation. Speech should animate the mouth, expressions, side LEDs, and head.

The approval credential is stored in `~/.ai_licia/stackchan-adapter.json` with user-only permissions, so normal restarts do not require another approval.

The adapter automatically reconnects when Desktop restarts or Bluetooth briefly drops. If Bluetooth disconnects, its Desktop presence is also closed, so the integration card and header never report a stale robot connection.

## Preview every eye style

With StackChan open in **Dance**, run:

```bash
npm run hardware:eyes
```

The preview cycles through all six factory eye presets: Neutral, Happy, Angry, Sad, Doubt, and Sleepy. It then shows the adapter's custom Surprised preset and restores Neutral.

During normal avatar playback, semantic expressions use complete eye presets instead of blending their geometry with Neutral. This keeps Happy, Angry, Sad, and Sleepy visually recognizable on the small geometric display. The protocol's expression weight still controls the accompanying head pose.

## Test without hardware

Run `npm run simulate`. The adapter connects to Desktop but prints every StackChan command instead of using Bluetooth.

## Limitations of the factory firmware

- Angry mode uses angled eyes and red side LEDs. Changing the actual eye fill colour requires custom firmware.
- The firmware also contains Heart, Angry, Sweat, Shy, and Dizzy decorative overlays, but Dance mode does not expose decorators through its BLE JSON controls. Those overlays require a custom firmware extension.
- Only reactions at the beginning of an utterance trigger a precisely timed action in this initial version. Later segment timing requires aligned TTS cue timestamps.
- Keep StackChan in Dance mode while the adapter is running.
