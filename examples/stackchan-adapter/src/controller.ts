import type { AvatarActionTriggeredEvent, AvatarExpressionStateEvent } from "ai_licia-client";
import {
  actionPerformance,
  actionStepCommands,
  expressionCommands,
  expressionPoseCommand,
  motionCommand,
  mouthCommand,
  speakingMotionStep,
} from "./stackchanCommands.js";
import type { StackChanTransport } from "./transport.js";

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
export type Delay = (milliseconds: number) => Promise<void>;

export class StackChanController {
  private actionGeneration = 0;
  private activeActionGeneration: number | undefined;
  private expressionState?: AvatarExpressionStateEvent["payload"]["data"];
  private pendingMouthValue: number | undefined;
  private mouthPump: Promise<void> | undefined;
  private speaking = false;
  private speakingGeneration = 0;
  private speakingTask: Promise<void> | undefined;

  constructor(
    private readonly transport: StackChanTransport,
    private readonly delay: Delay = wait,
  ) {}

  setMouth(value: number): Promise<void> {
    // Mouth samples are ephemeral. BLE writes can take longer than the 50 ms
    // producer cadence, so queueing every sample makes the robot perform stale
    // audio. Retain only the newest value while a write is in flight.
    this.pendingMouthValue = value;
    this.mouthPump ??= this.flushMouth().finally(() => {
      this.mouthPump = undefined;
    });
    return this.mouthPump;
  }

  async setExpression(data: AvatarExpressionStateEvent["payload"]["data"]): Promise<void> {
    this.expressionState = data;
    if (this.activeActionGeneration !== undefined) return;
    for (const command of expressionCommands(data)) {
      if (this.activeActionGeneration !== undefined) return;
      await this.transport.send(command);
    }
  }

  startSpeaking(): Promise<void> {
    if (this.speaking && this.speakingTask) return this.speakingTask;
    this.speaking = true;
    const generation = ++this.speakingGeneration;
    const task = this.runSpeakingMotion(generation);
    this.speakingTask = task;
    void task.then(
      () => {
        if (this.speakingTask === task) this.speakingTask = undefined;
      },
      () => {
        if (this.speakingTask === task) this.speakingTask = undefined;
      },
    );
    return task;
  }

  async stopSpeaking(): Promise<void> {
    this.speaking = false;
    this.speakingGeneration += 1;
    this.speakingTask = undefined;
    if (this.activeActionGeneration === undefined) {
      await this.transport.send(expressionPoseCommand(this.expressionState));
    }
  }

  async triggerAction(data: AvatarActionTriggeredEvent["payload"]["data"]): Promise<void> {
    const steps = actionPerformance(data.actionId);
    if (steps.length === 0 || data.intensity === 0) return;
    const generation = ++this.actionGeneration;
    this.activeActionGeneration = generation;
    try {
      for (const step of steps) {
        if (generation !== this.actionGeneration) return;
        if (step.delayMs > 0) await this.delay(step.delayMs);
        if (generation !== this.actionGeneration) return;
        for (const command of actionStepCommands(step, this.expressionState, data.intensity ?? 1)) {
          if (generation !== this.actionGeneration) return;
          await this.transport.send(command);
        }
      }
    } finally {
      if (this.activeActionGeneration === generation) {
        await this.restoreExpression(generation);
        if (this.activeActionGeneration === generation) this.activeActionGeneration = undefined;
      }
    }
  }

  async reset(): Promise<void> {
    this.speaking = false;
    this.speakingGeneration += 1;
    this.speakingTask = undefined;
    this.actionGeneration += 1;
    this.activeActionGeneration = undefined;
    await this.setMouth(0);
    await this.restoreExpression();
  }

  private async flushMouth(): Promise<void> {
    while (this.pendingMouthValue !== undefined) {
      const value = this.pendingMouthValue;
      this.pendingMouthValue = undefined;
      await this.transport.send(mouthCommand(value));
    }
  }

  private async runSpeakingMotion(generation: number): Promise<void> {
    let stepIndex = 0;
    while (this.speaking && generation === this.speakingGeneration) {
      const step = speakingMotionStep(stepIndex, this.expressionState);
      stepIndex += 1;
      await this.delay(step.delayMs);
      if (!this.speaking || generation !== this.speakingGeneration) return;
      if (this.activeActionGeneration !== undefined) continue;
      await this.transport.send(motionCommand(speakingMotionStep(stepIndex - 1, this.expressionState)));
    }
  }

  private async restoreExpression(ownerActionGeneration?: number): Promise<void> {
    for (const command of expressionCommands(this.expressionState)) {
      if (
        ownerActionGeneration !== undefined &&
        this.activeActionGeneration !== ownerActionGeneration
      ) return;
      await this.transport.send(command);
    }
  }
}
