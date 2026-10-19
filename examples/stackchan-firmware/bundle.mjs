import {createHash} from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const upstream = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
const buildDirectory = resolve(
  process.argv[2] ?? join(root, "build", "StackChan", "firmware", "build"),
);
const bundleId = `ai-licia-stackchan-${upstream.firmwareVersion}-${upstream.aiLiciaBundleVersion}`;
const outputDirectory = resolve(process.argv[3] ?? join(root, "dist", bundleId));

const fail = (message) => {
  console.error(`Firmware bundle error: ${message}`);
  process.exit(1);
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`);
  }
};

const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

if (!existsSync(buildDirectory)) {
  fail(`ESP-IDF build directory does not exist: ${buildDirectory}`);
}
if (existsSync(outputDirectory) && readdirSync(outputDirectory).length > 0) {
  fail(`output directory is not empty: ${outputDirectory}`);
}

const flasher = readJson(join(buildDirectory, "flasher_args.json"));
const expectedSettings = {
  flash_mode: "dio",
  flash_size: "16MB",
  flash_freq: "80m",
};
for (const [key, value] of Object.entries(expectedSettings)) {
  if (flasher.flash_settings?.[key] !== value) {
    fail(`expected ${key}=${value}, got ${flasher.flash_settings?.[key]}`);
  }
}
if (flasher.extra_esptool_args?.chip !== "esp32s3") {
  fail(`expected ESP32-S3 build, got ${flasher.extra_esptool_args?.chip}`);
}

const expectedSegments = [
  {
    offset: 0x0,
    source: "bootloader/bootloader.bin",
    file: "bootloader.bin",
    region: "bootloader",
    maximumSize: 0x8000,
  },
  {
    offset: 0x8000,
    source: "partition_table/partition-table.bin",
    file: "partition-table.bin",
    region: "partition-table",
    maximumSize: 0x1000,
  },
  {
    offset: 0xd000,
    source: "ota_data_initial.bin",
    file: "ota-data-initial.bin",
    region: "otadata",
    maximumSize: 0x2000,
  },
  {
    offset: 0x20000,
    source: "stack-chan.bin",
    file: "stack-chan.bin",
    region: "ota_0",
    maximumSize: 0x4f0000,
  },
  {
    offset: 0xa00000,
    source: "generated_assets.bin",
    file: "generated-assets.bin",
    region: "assets",
    maximumSize: 0x400000,
  },
];

for (const segment of expectedSegments) {
  const offsetHex = `0x${segment.offset.toString(16)}`;
  if (flasher.flash_files?.[offsetHex] !== segment.source) {
    fail(
      `expected ${segment.source} at ${offsetHex}, got ${flasher.flash_files?.[offsetHex]}`,
    );
  }
  const sourcePath = join(buildDirectory, segment.source);
  if (!existsSync(sourcePath)) fail(`missing build artifact: ${sourcePath}`);
  const size = statSync(sourcePath).size;
  if (size <= 0 || size > segment.maximumSize) {
    fail(
      `${segment.source} size ${size} exceeds ${segment.region} capacity ${segment.maximumSize}`,
    );
  }
}

const sourceRoot = dirname(buildDirectory);
const sdkconfigPath = join(sourceRoot, "sdkconfig");
if (!existsSync(sdkconfigPath)) fail(`missing build sdkconfig: ${sdkconfigPath}`);
const sdkconfig = readFileSync(sdkconfigPath, "utf8");
for (const requiredLine of [
  'CONFIG_IDF_TARGET="esp32s3"',
  "CONFIG_BOARD_TYPE_M5STACK_STACK_CHAN=y",
  'CONFIG_ESPTOOLPY_FLASHSIZE="16MB"',
]) {
  if (!sdkconfig.includes(requiredLine)) {
    fail(`sdkconfig does not identify the intended target: ${requiredLine}`);
  }
}

mkdirSync(outputDirectory, {recursive: true});
const segments = expectedSegments.map((segment) => {
  const sourcePath = join(buildDirectory, segment.source);
  const outputPath = join(outputDirectory, segment.file);
  copyFileSync(sourcePath, outputPath);
  return {
    offset: segment.offset,
    offsetHex: `0x${segment.offset.toString(16)}`,
    file: segment.file,
    region: segment.region,
    size: statSync(outputPath).size,
    maximumSize: segment.maximumSize,
    sha256: sha256(outputPath),
  };
});

const patchPath = join(root, "patches", "stackchan-ai-licia.patch");
const manifest = {
  schemaVersion: 1,
  bundleId,
  protocol: "avatar.protocol.v1",
  target: {
    product: "M5Stack StackChan",
    board: "m5stack-stack-chan",
    chip: "esp32s3",
    flashSize: 16 * 1024 * 1024,
    identityWarning:
      "ESP32-S3 identity alone cannot attest that the connected device is a StackChan.",
  },
  build: {
    upstreamRepository: upstream.repository,
    upstreamCommit: upstream.commit,
    upstreamFirmwareVersion: upstream.firmwareVersion,
    aiLiciaBundleVersion: upstream.aiLiciaBundleVersion,
    espIdfVersion: upstream.espIdfVersion,
    extensionPatchSha256: sha256(patchPath),
  },
  esptool: {
    before: "default_reset",
    after: "hard_reset",
    useStub: true,
    flashMode: "dio",
    flashFrequency: "80m",
    flashSize: "16MB",
    eraseFlash: false,
  },
  preflight: {
    requireChip: "esp32s3",
    requireFlashSize: 16 * 1024 * 1024,
    requireSecureBootDisabled: true,
    requireFlashEncryptionDisabled: true,
    requireFullBackup: true,
  },
  backup: {
    offset: 0,
    size: 16 * 1024 * 1024,
    containsSecrets: true,
    note: "Store locally. The full flash may contain Wi-Fi and account credentials.",
  },
  install: {
    strategy: "sparse-segments",
    preserveUnwrittenRegions: true,
    segments,
  },
  preservedRegions: [
    {name: "nvs", offset: 0x9000, size: 0x4000},
    {name: "phy_init", offset: 0xf000, size: 0x1000},
    {name: "ota_1", offset: 0x510000, size: 0x4f0000},
    {name: "coredump", offset: 0xe00000, size: 0x10000},
  ],
  recovery: {
    preferred: "write the verified 16 MB backup at offset 0x0",
    fallback: "M5Stack official firmware installer",
    neverEraseBeforeBackup: true,
  },
};

const manifestPath = join(outputDirectory, "firmware-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Created ${bundleId}`);
console.log(`Manifest: ${manifestPath}`);
for (const segment of segments) {
  console.log(
    `${segment.offsetHex.padEnd(10)} ${String(segment.size).padStart(8)} ${segment.sha256} ${basename(segment.file)}`,
  );
}
