F-FRRS (Fractal-FRRS) - 3D mechanism visualization editor based on Three.js
Three.js v0.160.0 is bundled in vendor/ - no internet connection required.

Quick start:
  Windows   : double-click start.bat  (auto-starts serve.py on port 8080,
              reuses the server if the port is already occupied)
  Any OS    : python serve.py 8080     (no-cache dev server, recommended)
              or: python -m http.server 8080 / npx serve .
  Then open : http://localhost:8080

Note: ES Modules require HTTP - opening index.html via file:// will NOT work.
      serve.py sends "Cache-Control: no-store" so browser never serves
      stale JS/CSS after edits (plain http.server does NOT).

Recent updates (2026-10-18):
  - Connection matrix: x/y/z coordinate columns always shown (incl. zeros),
    bold red/green/blue text, no background highlight, adaptive font
    shrink-to-fit; thumbnail and zoomed view share the same rendering.
  - Connection list: click an item to highlight both planes of that
    connection in 3D (cyan/purple); click again to cancel.
  - Topology graph: auto-refresh when mechanisms <= threshold (default 10,
    adjustable via the "Auto <=" input in the toolbar); above the threshold
    it only redraws on demand - Refresh button or Ctrl+Shift+R (forced).
    The old "Draw" toggle was removed (superseded by the threshold + button).
  - Save dialogs: all exports use the system "Save As" picker where
    supported (Chromium/Edge), so the destination folder is choosable.
  - Dev server: serve.py replaces python -m http.server in start.bat.

Project structure:
  F-FRRS/
  |-- index.html        main page (HTML + CSS + importmap)
  |-- start.bat         Windows launcher (port check + serve.py)
  |-- serve.py          no-cache local dev server (Cache-Control: no-store)
  |-- readme.txt        this file
  |-- vendor/           Three.js v0.160.0 (local, offline)
  |-- Sample_Mechanisms/  sample mechanism JSON files (English names)
  |   |-- robot_state_*.json          individual mechanisms
  |   `-- robotic_arm_sequence/       19-step assembly sequence (import in order)
  `-- src/
      |-- main.js       entry point
      |-- core/         AppState / Mechanism / Connection / History
      |-- renderer/     SceneManager / TopologyRenderer / ConnectionMatrixRenderer / Screenshot
      |-- ui/           UIBinder / Notification
      `-- utils/        GeometryUtils / ConnectionMatrix / Renumber / i18n

Load a sample: start the platform, then use the import button in the
"Generate" panel (or Ctrl+O) and pick any robot_state_*.json.

See README.md for full bilingual documentation.
