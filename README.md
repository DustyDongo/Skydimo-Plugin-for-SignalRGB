# Skydimo SK0L27 plugin for SignalRGB

SignalRGB device plugin for the four-zone, 27-inch Skydimo SK0L27 monitor light strip.

[![Add this repository to SignalRGB](https://raw.githubusercontent.com/SRGBmods/QMK-Images/main/images/add-to-signalrgb.png)](https://srgbmods.net/s?p=addon/install?url=https://github.com/DustyDongo/Skydimo-Plugin-for-SignalRGB)

## Supported hardware

- Model: `SK0L27`
- USB ID: `VID 1A86 / PID 7523` (CH340 serial adapter)
- Serial settings: `115200 8-N-1`
- Layout: four SignalRGB subdevices
  - CH1: 17 LEDs
  - CH2: 31 LEDs
  - CH3: 17 LEDs
  - CH4: 31 LEDs
- Total: 96 LEDs

## Installation

1. Close SignalRGB completely.
2. Click **Add to SignalRGB** above and allow the addon installation.
3. Start SignalRGB and wait until plugin scanning finishes.
4. If the controller was already connected and appears first as generic `LED Strip`, reconnect its USB cable once. This is a SignalRGB 2.5.74 device-discovery ordering issue; no file patch is required.

The repository intentionally contains only one JavaScript device plugin. SignalRGB scans every `.js` file in an addon as a potential device plugin, so helper libraries and unrelated device plugins must not be stored here.

## What changed from upstream

- Dedicated configuration for SK0L27; model detection is not required.
- Creates CH1-CH4 immediately, before serial connection retries.
- Uses the COM port already assigned to the plugin by current SignalRGB versions.
- Limits output to 30 FPS so 96-LED frames stay below the 115200-baud link capacity.
- Reconnect attempts are rate-limited so a missing or busy port cannot freeze SignalRGB.
- Detects failed color writes and automatically reopens a stalled COM port instead of requiring a USB replug.
- Correct 96-LED Adalight packet and shutdown-color handling.
- Correct LED naming for all four segments.
- Removed SK0902 and WLED text JavaScript files that were being scanned as device plugins and could crash plugin discovery.

## Compatibility

Test targets: SignalRGB 2.5.74 and 2.5.80 on Windows with SK0L27.

SignalRGB officially supports persistent custom plugins overriding built-in plugins, but future application versions may change the plugin API. If that happens, update this repository rather than copying helper JavaScript files into the addon.
