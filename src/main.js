// src/main.js
import * as THREE from "three";
import { AppState } from "./core/AppState.js";
import { SceneManager } from "./renderer/SceneManager.js";
import { TopologyRenderer } from "./renderer/TopologyRenderer.js";
import { Notification } from "./ui/Notification.js";
import { UIBinder } from "./ui/UIBinder.js";
import { setLang } from "./utils/i18n.js";
import { Mechanism } from "./core/Mechanism.js";
import { computeCornerRadius, getFixedCorners } from "./utils/GeometryUtils.js";

// ===== 获取DOM容器 =====
const container = document.getElementById("canvas-container");
const notifContainer = document.getElementById("notification-container");
const topoCanvas = document.getElementById("topology-canvas");

// ===== 初始化核心模块 =====
const sceneManager = new SceneManager(container);
const appState = new AppState(sceneManager);
const notification = new Notification(notifContainer, {
  maxItems: 3,
  defaultDuration: 2000,
});
const topologyRenderer = new TopologyRenderer(topoCanvas, appState);
const uiBinder = new UIBinder(
  appState,
  sceneManager,
  topologyRenderer,
  notification
);

// ===== 暴露到全局用于调试 =====
window.__app = {
  appState,
  sceneManager,
  topologyRenderer,
  notification,
  uiBinder,
};
window.__appState = appState;

// ===== 添加初始机构（包含圆角信息）=====
// 🔹 如果要禁用自动生成机构，请注释掉下方从 const initCube = 1; 到 appState._saveState(); 的整个代码块。
const initCube = 1;
const initThick = 0.125;
const initRadius = computeCornerRadius(initCube, initThick);
const corners = getFixedCorners();

const initMech = new Mechanism({
  id: 1,
  position: new THREE.Vector3(0.5, 0.5, 0.5),
  worldRotation: new THREE.Euler(0, 0, 0, "XYZ"),
  l1Angle: 0,
  l2Angle: 0,
  armSize: 0.75,
  thickness: initThick,
  cubeSize: initCube,
  axisRadius: 0.125,
});
appState.addMechanism(initMech, true);
appState.setActive(0);
appState._saveState();

// ✅ 强制首次同步刷新（避免 rAF 时序问题）
uiBinder._refreshUI();

// ===== 设置语言 =====
setLang("zh");

// ===== 启动动画循环 =====
function animate(now) {
  requestAnimationFrame(animate);
  appState.updateAnimation(now);
  sceneManager.render();
}
animate();

// ===== 窗口关闭清理 =====
window.addEventListener("beforeunload", () => {
  appState.destroy();
  sceneManager.dispose();
  uiBinder.destroy();
  notification.clear();
  topologyRenderer.setEnabled(false);
});

// ===== 控制台提示 =====
console.log("✅ 应用已启动");
console.log("📖 快捷键按 ? 查看帮助");
