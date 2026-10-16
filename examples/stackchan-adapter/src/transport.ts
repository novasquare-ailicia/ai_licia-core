import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import {
  fragmentStackChanPayload,
  STACKCHAN_CHARACTERISTIC_UUIDS,
  STACKCHAN_SERVICE_UUIDS,
  type StackChanChannel,
  type StackChanCommand,
} from "./stackchanCommands.js";

export interface StackChanTransport {
  connect(): Promise<void>;
  send(command: StackChanCommand): Promise<void>;
  close(): Promise<void>;
}

export class SimulatedStackChanTransport implements StackChanTransport {
  public readonly commands: StackChanCommand[] = [];

  async connect(): Promise<void> {
    console.log("[StackChan simulator] connected");
  }

  async send(command: StackChanCommand): Promise<void> {
    this.commands.push(command);
    console.log(`[StackChan simulator] ${command.channel}`, JSON.stringify(command.payload));
  }

  async close(): Promise<void> {
    console.log("[StackChan simulator] disconnected");
  }
}

export class BleStackChanTransport implements StackChanTransport {
  private peripheral?: Peripheral;
  private readonly characteristics = new Map<StackChanChannel, Characteristic>();
  private writeQueue = Promise.resolve();

  async connect(): Promise<void> {
    await this.waitForPoweredOn();
    console.log("Scanning for StackChan. Open Dance mode on the robot.");
    const peripheral = await this.findStackChan();
    await noble.stopScanningAsync();
    await peripheral.connectAsync();
    this.peripheral = peripheral;
    const discovered = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
      [...STACKCHAN_SERVICE_UUIDS],
      Object.values(STACKCHAN_CHARACTERISTIC_UUIDS),
    );
    for (const characteristic of discovered.characteristics) {
      const channel = (Object.entries(STACKCHAN_CHARACTERISTIC_UUIDS) as Array<[
        StackChanChannel,
        string,
      ]>).find(([, uuid]) => uuid === characteristic.uuid)?.[0];
      if (channel) this.characteristics.set(channel, characteristic);
    }
    const missing = (Object.keys(STACKCHAN_CHARACTERISTIC_UUIDS) as StackChanChannel[])
      .filter((channel) => !this.characteristics.has(channel));
    if (missing.length > 0) throw new Error(`StackChan is missing BLE characteristics: ${missing.join(", ")}`);
    console.log(`Connected to ${peripheral.advertisement.localName ?? peripheral.id}`);
  }

  async send(command: StackChanCommand): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const characteristic = this.characteristics.get(command.channel);
      if (!characteristic) throw new Error(`StackChan ${command.channel} characteristic is not connected.`);
      const packets = fragmentStackChanPayload(JSON.stringify(command.payload));
      for (const packet of packets) await characteristic.writeAsync(packet, false);
    });
    return this.writeQueue;
  }

  async close(): Promise<void> {
    await this.writeQueue.catch(() => undefined);
    if (this.peripheral?.state === "connected") await this.peripheral.disconnectAsync();
    this.characteristics.clear();
  }

  private async waitForPoweredOn(): Promise<void> {
    if (noble.state === "poweredOn") return;
    await new Promise<void>((resolve, reject) => {
      const onState = (state: string) => {
        if (state === "poweredOn") {
          noble.off("stateChange", onState);
          resolve();
        } else if (state === "unsupported" || state === "unauthorized") {
          noble.off("stateChange", onState);
          reject(new Error(`Bluetooth is ${state}.`));
        }
      };
      noble.on("stateChange", onState);
    });
  }

  private async findStackChan(): Promise<Peripheral> {
    return new Promise<Peripheral>((resolve) => {
      const onDiscover = (peripheral: Peripheral) => {
        const serviceUuids = peripheral.advertisement.serviceUuids ?? [];
        if (
          peripheral.advertisement.localName?.toLowerCase().includes("stackchan") ||
          serviceUuids.some((uuid) => (STACKCHAN_SERVICE_UUIDS as readonly string[]).includes(uuid))
        ) {
          noble.off("discover", onDiscover);
          resolve(peripheral);
        }
      };
      noble.on("discover", onDiscover);
      void noble.startScanningAsync([], false);
    });
  }
}
