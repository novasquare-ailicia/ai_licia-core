import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  AVATAR_PROTOCOL_CAPABILITY,
  validateAvatarProtocolMessage
} from '../packages/ai_licia-client/dist/avatarProtocol.js';

const port = Number(process.env.AVATAR_SIMULATOR_PORT || 51744);
const host = '127.0.0.1';
const server = new WebSocketServer({ host, port });
const reconnectCredentials = new Set();
const supportedProfiles = new Set([
  'avatar.speech.lifecycle.v1',
  'avatar.mouth.amplitude.v1'
]);

const send = (socket, message) => socket.send(JSON.stringify(message));

server.on('connection', (socket) => {
  let authorized = false;
  let subscription = null;
  let timer = null;

  const stopPlayback = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString('utf8'));
    } catch {
      send(socket, { type: 'error', payload: { code: 'invalid_request', message: 'Invalid JSON.' } });
      return;
    }

    if (message.type === 'hello') {
      authorized = reconnectCredentials.has(message?.payload?.reconnectCredential);
      send(socket, {
        type: 'welcome',
        payload: {
          capabilities: ['events', 'state', 'integration.auth', AVATAR_PROTOCOL_CAPABILITY],
          authorizedScopes: authorized ? ['avatar.events.read'] : []
        }
      });
      return;
    }

    if (message.type === 'request_access') {
      authorized = true;
      const requestId = `req_${randomUUID()}`;
      const reconnectCredential = `sim_${randomUUID()}`;
      reconnectCredentials.add(reconnectCredential);
      send(socket, { type: 'access_pending', payload: { requestId } });
      send(socket, {
        type: 'access_granted',
        payload: {
          requestId,
          scopes: ['avatar.events.read'],
          reconnectCredential
        }
      });
      return;
    }

    const validation = validateAvatarProtocolMessage(message);
    if (!validation.success) {
      send(socket, {
        type: 'avatar.subscription_error',
        payload: {
          requestId: message?.payload?.requestId || 'unknown',
          code: 'invalid_request',
          message: validation.issues[0]?.message || 'Invalid avatar protocol message.'
        }
      });
      return;
    }

    if (validation.value.type === 'avatar.subscribe') {
      if (!authorized) {
        send(socket, {
          type: 'avatar.subscription_error',
          payload: {
            requestId: validation.value.payload.requestId,
            code: 'not_authorized',
            message: 'avatar.events.read is required.'
          }
        });
        return;
      }
      stopPlayback();
      const requiredUnsupported = validation.value.payload.profiles.find(
        (profile) => profile.required && !supportedProfiles.has(profile.id)
      );
      if (requiredUnsupported) {
        send(socket, {
          type: 'avatar.subscription_error',
          payload: {
            requestId: validation.value.payload.requestId,
            code: 'required_profile_unsupported',
            message: `Required profile ${requiredUnsupported.id} is not supported.`,
            profileId: requiredUnsupported.id
          }
        });
        return;
      }
      const acceptedProfiles = validation.value.payload.profiles
        .map((profile) => profile.id)
        .filter((profile) => supportedProfiles.has(profile));
      if (acceptedProfiles.length === 0) {
        send(socket, {
          type: 'avatar.subscription_error',
          payload: {
            requestId: validation.value.payload.requestId,
            code: 'invalid_request',
            message: 'The subscription does not contain a supported profile.'
          }
        });
        return;
      }
      const rejectedProfiles = validation.value.payload.profiles
        .filter((profile) => !supportedProfiles.has(profile.id))
        .map((profile) => ({ id: profile.id, reason: 'unsupported' }));
      subscription = {
        id: `asub_${randomUUID()}`,
        sessionId: `avs_${randomUUID()}`,
        sequence: 0,
        acceptedProfiles
      };
      send(socket, {
        type: 'avatar.subscribed',
        payload: {
          requestId: validation.value.payload.requestId,
          protocolVersion: 1,
          avatarSessionId: subscription.sessionId,
          subscriptionId: subscription.id,
          acceptedProfiles,
          rejectedProfiles
        }
      });
      const event = (name, data) => ({
        type: 'event',
        payload: {
          name,
          data: {
            schemaVersion: 1,
            avatarSessionId: subscription.sessionId,
            subscriptionId: subscription.id,
            deliverySequence: ++subscription.sequence,
            emittedAtMs: Date.now(),
            ...data
          }
        }
      });
      send(socket, event('avatar.state.snapshot', {
        selectedProfiles: acceptedProfiles,
        activeUtterance: null
      }));

      const utteranceId = `utt_${randomUUID()}`;
      const availableProfiles = acceptedProfiles.filter((profile) => profile.startsWith('avatar.mouth.'));
      const activeSpeechDriver = availableProfiles.includes('avatar.mouth.amplitude.v1')
        ? 'avatar.mouth.amplitude.v1'
        : availableProfiles[0];
      if (!activeSpeechDriver) return;
      send(socket, event('avatar.speech.prepared', {
        utteranceId,
        durationMs: 4000,
        activeSpeechDriver,
        availableProfiles
      }));
      send(socket, event('avatar.speech.started', { utteranceId, playbackOffsetMs: 0 }));
      let offsetMs = 0;
      timer = setInterval(() => {
        offsetMs += 50;
        if (offsetMs >= 4000) {
          stopPlayback();
          send(socket, event('avatar.mouth.amplitude', { utteranceId, offsetMs: 4000, value: 0 }));
          send(socket, event('avatar.speech.ended', {
            utteranceId,
            playbackOffsetMs: 4000,
            reason: 'completed'
          }));
          return;
        }
        const value = 0.12 + Math.abs(Math.sin(offsetMs / 140)) * 0.78;
        send(socket, event('avatar.mouth.amplitude', { utteranceId, offsetMs, value }));
      }, 50);
      return;
    }

    if (validation.value.type === 'avatar.get_state' && subscription) {
      send(socket, {
        type: 'event',
        payload: {
          name: 'avatar.state.snapshot',
          data: {
            schemaVersion: 1,
            avatarSessionId: subscription.sessionId,
            subscriptionId: subscription.id,
            deliverySequence: ++subscription.sequence,
            emittedAtMs: Date.now(),
            requestId: validation.value.payload.requestId,
            selectedProfiles: subscription.acceptedProfiles,
            activeUtterance: null
          }
        }
      });
    }
  });

  socket.on('close', stopPlayback);
});

server.on('listening', () => {
  console.log(`Avatar protocol simulator listening on ws://${host}:${port}`);
});

server.on('error', (error) => {
  console.error(`Avatar protocol simulator failed: ${error.message}`);
  process.exitCode = 1;
});
