import serial from "@SignalRGB/serial";

export function Name() { return "Skydimo SK0L27"; }
export function VendorId() { return 0x1A86; }
export function ProductId() { return [0x7523]; }
export function Publisher() { return "DustyDongo"; }
export function Documentation() { return "troubleshooting/skydimo"; }
export function Type() { return "serial"; }
export function DeviceType() { return "lightingcontroller"; }
export function SubdeviceController() { return true; }
export function Size() { return [96, 1]; }
export function ImageUrl() { return "https://assets.signalrgb.com/devices/brands/skydimo/misc/skydimo-strip.png"; }

/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
*/
export function ControllableParameters() {
    return [
        { property: "shutdownColor", group: "lighting", label: "Shutdown Color", description: "Color used when SignalRGB or Windows shuts down", min: "0", max: "360", type: "color", default: "#000000" },
        { property: "LightingMode", group: "lighting", label: "Lighting Mode", description: "Use the SignalRGB canvas or a fixed color", type: "combobox", values: ["Canvas", "Forced"], default: "Canvas" },
        { property: "forcedColor", group: "lighting", label: "Forced Color", description: "Color used in Forced mode", min: "0", max: "360", type: "color", default: "#009bde" },
    ];
}

const SERIAL_OPTIONS = {
    baudRate: 115200,
    parity: "None",
    dataBits: 8,
    stopBits: "One",
};
const DEVICE_IMAGE = "https://assets.signalrgb.com/devices/brands/skydimo/misc/skydimo-strip.png";
const MODEL_QUERY = [0x4D, 0x6F, 0x6E, 0x69, 0x2D, 0x41];
const ZONE_LED_COUNTS = [17, 31, 17, 31];
const LED_COUNT = 96;
// A 294-byte 8-N-1 frame at 60 FPS needs 176400 baud. Keep enough headroom
// for the controller's 115200-baud link so its transmit buffer cannot grow.
const FRAME_RATE = 30;
const RECONNECT_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_WRITE_FAILURES = 3;

let layoutCreated = false;
let lastReconnectAttempt = 0;
let consecutiveWriteFailures = 0;

export function Initialize() {
    setupLayout();
    connect();
}

export function Render() {
    if (!serial.isConnected()) {
        const now = Date.now();
        if (now - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {
            lastReconnectAttempt = now;
            connect();
        }
        return;
    }

    sendColors();
}

export function Shutdown(SystemSuspending) {
    if (!serial.isConnected()) return;

    sendColors(SystemSuspending ? "#000000" : shutdownColor);
    serial.disconnect();
}

function setupLayout() {
    if (layoutCreated) return;

    device.setName("Skydimo SK0L27");
    device.setImageFromUrl(DEVICE_IMAGE);
    device.setSize([LED_COUNT, 1]);
    device.setFrameRateTarget(FRAME_RATE);
    device.SetLedLimit(LED_COUNT);
    device.SetIsSubdeviceController(true);

    let ledOffset = 0;
    for (let zoneIndex = 0; zoneIndex < ZONE_LED_COUNTS.length; zoneIndex++) {
        const channel = `CH${zoneIndex + 1}`;
        const zoneLedCount = ZONE_LED_COUNTS[zoneIndex];

        device.createSubdevice(channel);
        device.setSubdeviceName(channel, `Segment ${zoneIndex + 1}`);
        device.setSubdeviceSize(channel, zoneLedCount, 1);
        device.setSubdeviceLeds(
            channel,
            createLedNames(zoneLedCount, ledOffset),
            createLedPositions(zoneLedCount)
        );
        device.setSubdeviceImageUrl(channel, DEVICE_IMAGE);

        ledOffset += zoneLedCount;
    }

    layoutCreated = true;
    device.log("SK0L27 layout initialized: CH1-CH4, 96 LEDs.");
}

function connect() {
    if (serial.isConnected()) return true;

    serial.disconnect();
    const connected = serial.connect(SERIAL_OPTIONS);

    if (!connected || !serial.isConnected()) {
        device.log("SK0L27 serial connection is not available; retrying in the background.");
        return false;
    }

    consecutiveWriteFailures = 0;

    // Keep the controller's original initialization sequence, but do not make
    // layout creation depend on a model-query response.
    serial.write(MODEL_QUERY);
    device.log(`SK0L27 connected on ${getPortName()}.`);
    return true;
}

function getPortName() {
    if (typeof serial.getPortName !== "function") return "the assigned COM port";
    return serial.getPortName() || "the assigned COM port";
}

function sendColors(overrideColor) {
    if (!serial.isConnected()) return false;

    const rgbData = [];

    for (let zoneIndex = 0; zoneIndex < ZONE_LED_COUNTS.length; zoneIndex++) {
        const zoneLedCount = ZONE_LED_COUNTS[zoneIndex];

        for (let ledIndex = 0; ledIndex < zoneLedCount; ledIndex++) {
            let color;

            if (overrideColor) {
                color = hexToRgb(overrideColor);
            } else if (LightingMode === "Forced") {
                color = hexToRgb(forcedColor);
            } else {
                color = device.subdeviceColor(`CH${zoneIndex + 1}`, ledIndex, 0);
            }

            rgbData.push(color[0], color[1], color[2]);
        }
    }

    const lastLedIndex = LED_COUNT - 1;
    const packet = [
        0x41, 0x64, 0x61, 0x00,
        (lastLedIndex >> 8) & 0xFF,
        lastLedIndex & 0xFF,
        ...rgbData,
    ];

    const success = serial.write(packet);

    if (success) {
        consecutiveWriteFailures = 0;
        return true;
    }

    consecutiveWriteFailures++;
    if (consecutiveWriteFailures >= MAX_CONSECUTIVE_WRITE_FAILURES) {
        recoverSerialConnection();
    }

    return false;
}

function recoverSerialConnection() {
    device.log("SK0L27 stopped accepting color frames; reopening the serial port.");
    serial.disconnect();
    consecutiveWriteFailures = 0;
    lastReconnectAttempt = Date.now();
}

function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return [0, 0, 0];

    return [
        parseInt(match[1], 16),
        parseInt(match[2], 16),
        parseInt(match[3], 16),
    ];
}

function createLedNames(count, offset) {
    const names = [];
    for (let index = 0; index < count; index++) {
        names.push(`LED ${offset + index + 1}`);
    }
    return names;
}

function createLedPositions(count) {
    const positions = [];
    for (let index = 0; index < count; index++) {
        positions.push([index, 0]);
    }
    return positions;
}
