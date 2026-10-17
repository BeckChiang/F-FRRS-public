F-FRRS (Fractal-FRRS) - 3D mechanism visualization editor based on Three.js
Three.js v0.160.0 is bundled in vendor/ - no internet connection required.

Quick start:
  Windows   : double-click start.bat
  Any OS    : python -m http.server 8080   (or: npx serve .)
  Then open  : http://localhost:8080

Note: ES Modules require HTTP - opening index.html via file:// will NOT work.

Project structure:
  F-FRRS/
  |-- index.html        main page (HTML + CSS + importmap)
  |-- start.bat         Windows launcher
  |-- readme.txt        this file
  |-- vendor/           Three.js v0.160.0 (local, offline)
  |-- Sample_Mechanisms/  sample mechanism JSON files (English names)
  |   |-- robot_state_*.json          individual mechanisms
  |   `-- robotic_arm_sequence/       19-step assembly sequence (import in order)
  `-- src/
      |-- main.js       entry point
      |-- core/         AppState / Mechanism / Connection / History
      |-- renderer/     SceneManager / TopologyRenderer / ConnectionMatrixRenderer / Screenshot
      |-- ui/           PanelManager / UIBinder / Notification
      `-- utils/        GeometryUtils / AnimationUtils / ConnectionMatrix / Renumber / i18n

Load a sample: start the platform, then use the import button in the
"Generate" panel (or Ctrl+O) and pick any robot_state_*.json.

See README.md for full bilingual documentation.
