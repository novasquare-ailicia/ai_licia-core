import {
  AvatarProtocolValidationIssue,
  AvatarSpeechPreparedEvent,
  AvatarStateSnapshotEvent,
  AvatarSubscribedMessage,
  validateAvatarProtocolMessage
} from './avatarProtocol';

export const AVATAR_LIVE_CHECK_IDS = [
  'capability',
  'authorization',
  'reconnect',
  'subscription',
  'initial_snapshot',
  'delivery_sequence',
  'exact_identity',
  'speech_started',
  'amplitude',
  'active_snapshot',
  'final_zero',
  'speech_ended'
] as const;

export type AvatarLiveCheckId = typeof AVATAR_LIVE_CHECK_IDS[number];
export type AvatarLiveCheckStatus = 'pending' | 'passed' | 'failed';

export interface AvatarLiveCheckResult {
  id: AvatarLiveCheckId;
  status: AvatarLiveCheckStatus;
  detail?: string;
}

export interface AvatarLiveConformanceIssue {
  code: string;
  message: string;
}

export interface AvatarLiveConformanceReport {
  schemaVersion: 1;
  protocolVersion: 1;
  status: 'passed' | 'failed';
  endpoint: string;
  startedAt: string;
  completedAt: string;
  checks: AvatarLiveCheckResult[];
  metrics: {
    events: number;
    amplitudeSamples: number;
    positiveAmplitudeSamples: number;
    snapshots: number;
    preparedUtterances: number;
    startedUtterances: number;
    endedUtterances: number;
    lastDeliverySequence: number;
  };
  issues: AvatarLiveConformanceIssue[];
}

export interface AvatarLiveConformanceMonitorOptions {
  endpoint: string;
  startedAt?: string;
}

const REQUIRED_PROFILES = [
  'avatar.speech.lifecycle.v1',
  'avatar.mouth.amplitude.v1'
] as const;

const REQUIRED_CHECKS = new Set<AvatarLiveCheckId>(AVATAR_LIVE_CHECK_IDS);

type LastAmplitude = { value: number; offsetMs: number };

export class AvatarLiveConformanceMonitor {
  public readonly endpoint: string;
  public readonly startedAt: string;
  public readonly checks = new Map<AvatarLiveCheckId, AvatarLiveCheckResult>();
  public readonly issues: AvatarLiveConformanceIssue[] = [];
  public subscriptionId?: string;
  public lastDeliverySequence?: number;

  private avatarSessionId?: string;
  private activeSnapshotRequestId?: string;
  private eventCount = 0;
  private amplitudeSamples = 0;
  private positiveAmplitudeSamples = 0;
  private snapshots = 0;
  private readonly preparedUtterances = new Map<
    string,
    AvatarSpeechPreparedEvent['payload']['data']
  >();
  private readonly lastAmplitudeByUtterance = new Map<string, LastAmplitude>();
  private readonly startedUtterances = new Set<string>();
  private readonly endedUtterances = new Set<string>();

  constructor(options: AvatarLiveConformanceMonitorOptions) {
    this.endpoint = options.endpoint;
    this.startedAt = options.startedAt ?? new Date().toISOString();
    AVATAR_LIVE_CHECK_IDS.forEach((id) => {
      this.checks.set(id, { id, status: 'pending' });
    });
  }

  public pass(id: AvatarLiveCheckId, detail?: string): void {
    this.setCheck(id, 'passed', detail);
  }

  public fail(id: AvatarLiveCheckId, code: string, message: string): void {
    this.setCheck(id, 'failed', message);
    this.addIssue(code, message);
  }

  public setSubscription(subscription: AvatarSubscribedMessage['payload']): void {
    this.subscriptionId = subscription.subscriptionId;
    this.avatarSessionId = subscription.avatarSessionId;
    const missingProfiles = REQUIRED_PROFILES.filter(
      (profile) => !subscription.acceptedProfiles.includes(profile)
    );
    if (missingProfiles.length > 0) {
      this.fail(
        'subscription',
        'missing_required_profile',
        `Subscription did not accept: ${missingProfiles.join(', ')}.`
      );
      return;
    }
    this.pass('subscription');
  }

  public expectActiveSnapshot(requestId: string): void {
    this.activeSnapshotRequestId = requestId;
  }

  public addProtocolValidationIssues(issues: readonly AvatarProtocolValidationIssue[]): void {
    issues.forEach((issue) => {
      this.addIssue('invalid_protocol_message', `${issue.path}: ${issue.message}`);
    });
  }

  public observeEvent(input: unknown): void {
    const validation = validateAvatarProtocolMessage(input);
    if (!validation.success) {
      this.addProtocolValidationIssues(validation.issues);
      return;
    }
    const message = validation.value;
    if (message.type !== 'event') return;
    const metadata = message.payload.data;
    this.eventCount += 1;

    if (this.subscriptionId && metadata.subscriptionId !== this.subscriptionId) {
      this.fail(
        'delivery_sequence',
        'subscription_changed',
        `Received event for subscription ${metadata.subscriptionId}.`
      );
      return;
    }
    if (this.avatarSessionId && metadata.avatarSessionId !== this.avatarSessionId) {
      this.fail(
        'delivery_sequence',
        'avatar_session_changed',
        `Received event for avatar session ${metadata.avatarSessionId}.`
      );
      return;
    }
    this.observeSequence(metadata.deliverySequence);

    switch (message.payload.name) {
      case 'avatar.state.snapshot':
        this.observeSnapshot(message.payload.data);
        break;
      case 'avatar.speech.prepared':
        this.observePrepared(message.payload.data);
        break;
      case 'avatar.speech.started':
        this.startedUtterances.add(message.payload.data.utteranceId);
        this.pass('speech_started');
        break;
      case 'avatar.speech.resumed':
        this.startedUtterances.add(message.payload.data.utteranceId);
        break;
      case 'avatar.mouth.amplitude': {
        const data = message.payload.data;
        this.amplitudeSamples += 1;
        this.lastAmplitudeByUtterance.set(data.utteranceId, {
          value: data.value,
          offsetMs: data.offsetMs
        });
        if (data.value > 0) {
          this.positiveAmplitudeSamples += 1;
          this.pass('amplitude');
        }
        break;
      }
      case 'avatar.speech.paused': {
        const data = message.payload.data;
        if (!this.hasFinalZero(data.utteranceId, data.playbackOffsetMs)) {
          this.addIssue(
            'pause_without_zero',
            `Utterance ${data.utteranceId} paused without a matching zero amplitude.`
          );
        }
        break;
      }
      case 'avatar.speech.ended': {
        const data = message.payload.data;
        this.endedUtterances.add(data.utteranceId);
        if (this.hasFinalZero(data.utteranceId, data.playbackOffsetMs)) {
          this.pass('final_zero');
        } else {
          this.fail(
            'final_zero',
            'end_without_zero',
            `Utterance ${data.utteranceId} ended without a matching zero amplitude.`
          );
        }
        this.pass('speech_ended', data.reason);
        break;
      }
      default:
        break;
    }
  }

  public addIssue(code: string, message: string): void {
    if (this.issues.some((issue) => issue.code === code && issue.message === message)) {
      return;
    }
    this.issues.push({ code, message });
  }

  public isComplete(): boolean {
    return AVATAR_LIVE_CHECK_IDS.every(
      (id) => this.checks.get(id)?.status === 'passed'
    );
  }

  public finish(options: { timedOut?: boolean; fatalError?: string } = {}): AvatarLiveConformanceReport {
    if (options.timedOut) {
      this.addIssue(
        'timeout',
        'Timed out before a complete TTS utterance and active snapshot were observed.'
      );
    }
    if (options.fatalError) this.addIssue('fatal_error', options.fatalError);
    this.checks.forEach((result) => {
      if (result.status === 'pending') {
        result.status = 'failed';
        result.detail = options.timedOut
          ? 'Not observed before timeout.'
          : 'Not completed.';
      }
    });
    const checks = [...this.checks.values()];
    const status =
      checks.every((result) => result.status === 'passed') && this.issues.length === 0
        ? 'passed'
        : 'failed';
    return {
      schemaVersion: 1,
      protocolVersion: 1,
      status,
      endpoint: this.endpoint,
      startedAt: this.startedAt,
      completedAt: new Date().toISOString(),
      checks,
      metrics: {
        events: this.eventCount,
        amplitudeSamples: this.amplitudeSamples,
        positiveAmplitudeSamples: this.positiveAmplitudeSamples,
        snapshots: this.snapshots,
        preparedUtterances: this.preparedUtterances.size,
        startedUtterances: this.startedUtterances.size,
        endedUtterances: this.endedUtterances.size,
        lastDeliverySequence: this.lastDeliverySequence ?? 0
      },
      issues: this.issues
    };
  }

  private observeSequence(deliverySequence: number): void {
    const expected = this.lastDeliverySequence === undefined
      ? 1
      : this.lastDeliverySequence + 1;
    if (deliverySequence !== expected) {
      this.fail(
        'delivery_sequence',
        'delivery_sequence_gap',
        `Expected delivery sequence ${expected}, received ${deliverySequence}.`
      );
    } else if (this.checks.get('delivery_sequence')?.status !== 'failed') {
      this.pass('delivery_sequence');
    }
    this.lastDeliverySequence = deliverySequence;
  }

  private observeSnapshot(data: AvatarStateSnapshotEvent['payload']['data']): void {
    this.snapshots += 1;
    if (this.snapshots === 1 && data.deliverySequence === 1) {
      this.pass('initial_snapshot');
    }
    if (this.activeSnapshotRequestId && data.requestId === this.activeSnapshotRequestId) {
      const prepared = data.activeUtterance
        ? this.preparedUtterances.get(data.activeUtterance.utteranceId)
        : undefined;
      if (
        data.activeUtterance &&
        this.startedUtterances.has(data.activeUtterance.utteranceId) &&
        data.activeUtterance.sourceMessageId &&
        data.activeUtterance.audioItemId &&
        prepared?.sourceMessageId === data.activeUtterance.sourceMessageId &&
        prepared?.audioItemId === data.activeUtterance.audioItemId
      ) {
        this.pass('active_snapshot');
      } else {
        this.fail(
          'active_snapshot',
          'invalid_active_snapshot',
          'Requested snapshot did not recover the active utterance with exact identity.'
        );
      }
    }
  }

  private observePrepared(data: AvatarSpeechPreparedEvent['payload']['data']): void {
    this.preparedUtterances.set(data.utteranceId, data);
    if (data.sourceMessageId && data.audioItemId) {
      this.pass('exact_identity');
    } else {
      this.fail(
        'exact_identity',
        'missing_exact_identity',
        `Prepared utterance ${data.utteranceId} lacks sourceMessageId or audioItemId.`
      );
    }
  }

  private hasFinalZero(utteranceId: string, playbackOffsetMs: number): boolean {
    const amplitude = this.lastAmplitudeByUtterance.get(utteranceId);
    return amplitude?.value === 0 && amplitude.offsetMs === playbackOffsetMs;
  }

  private setCheck(
    id: AvatarLiveCheckId,
    status: AvatarLiveCheckStatus,
    detail?: string
  ): void {
    if (!REQUIRED_CHECKS.has(id)) throw new Error(`Unknown check: ${id}`);
    const current = this.checks.get(id);
    if (current?.status === 'failed' && status === 'passed') return;
    this.checks.set(id, { id, status, ...(detail ? { detail } : {}) });
  }
}
