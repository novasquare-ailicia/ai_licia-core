import type { AvatarActionTriggeredEvent, AvatarExpressionStateEvent } from "ai_licia-client";
import {
  actionMotion,
  expressionCommands,
  motionCommand,
  mouthCommand,
} from "./stackchanCommands.js";
import type { StackChanTransport } from "./transport.js";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class StackChanController {
  private actionGeneration = 0;
  private lastMouthSentAt = 0;

  constructor(private readonly transport: StackChanTransport) {}

  async setMouth(value: number): Promise<void> {
    const now = Date.now();
    if (value > 0 && now - this.lastMouthSentAt < 80) return;
    this.lastMouthSentAt = now;
    await this.transport.send(mouthCommand(value));
  }

  async setExpression(data: AvatarExpressionStateEvent["payload"]["data"]): Promise<void> {
    for (const command of expressionCommands(data)) await this.transport.send(command);
  }

  async triggerAction(data: AvatarActionTriggeredEvent["payload"]["data"]): Promise<void> {
    const steps = actionMotion(data.actionId);
    if (steps.length === 0) return;
    const generation = ++this.actionGeneration;
    for (const step of steps) {
      if (generation !== this.actionGeneration) return;
      if (step.delayMs > 0) await wait(step.delayMs);
      if (generation !== this.actionGeneration) return;
      await this.transport.send(motionCommand(step));
    }
  }

  async reset(): Promise<void> {
    this.actionGeneration += 1;
    await this.setMouth(0);
  }
}
