// src/ui/UIBinder.js
import * as THREE from "three";
import { t, setLang, getLang } from "../utils/i18n.js";
import {
  roundToCent,
  normalizeAngleDeg,
  quatToEulerDeg,
  createMechanism,
  getPlaneWorldCenter,
  shortestAngleDelta,
  easeInOutCubic,
} from "../utils/GeometryUtils.js";
import { Mechanism } from "../core/Mechanism.js";
import { formatPlaneFull } from "../utils/GeometryUtils.js";
import { ConnectionMatrixRenderer } from "../renderer/ConnectionMatrixRenderer.js";
import { buildConnectionMatrix } from "../utils/ConnectionMatrix.js";

/** 拓扑图自动刷新机构数上限：≤ 此值自动刷新，超过则仅手动（点击刷新控件） */
const TOPO_AUTO_MAX = 10;

export class UIBinder {
  constructor(appState, sceneManager, topologyRenderer, notification) {
    this.appState = appState;
    this.sceneManager = sceneManager;
    this.topologyRenderer = topologyRenderer;
    this.notification = notification;
    this._currentPanel = "ui";

    this.dom = this._collectDOM();
    this.previewGroup = null;
    this.previewTimeout = null;
    this.previewPending = false;
    this.genRotationQuat = new THREE.Quaternion();
    this.animEnabled = true;
    this.animDuration = 400;
    this.multiSelectEnabled = false;
    this.dark = true;
    this._boundEvents = [];
    this._lastTopoRefreshTime = 0;

    this.topoAutoUpdate = true; // 初始为自动
    this.topoAutoMax = TOPO_AUTO_MAX; // 自动绘制数量界限（可在界面上实时调整）
    this._lastMechCount = 0;

    this._bindAll();
    this.appState.onUpdate = () => this._refreshUI();
    this._initUI();
    this._refreshUI();

    // 同步动画状态到 appState
    this.appState._animEnabled = this.animEnabled;
    // 监听相机控制器的变化，实时更新左下角显示
    this.sceneManager.controls.addEventListener("change", () => {
      this._updateCameraDisplay();
      this._syncUIFromCamera(); // 同时同步界面面板的输入值
    });
    // 连接矩阵渲染器
    const matrixCanvas = document.getElementById("connection-matrix-canvas");
    this.matrixRenderer = matrixCanvas
      ? new ConnectionMatrixRenderer(matrixCanvas, appState)
      : null;
    this._ScreenshotClass = null;
  }

  _collectDOM() {
    return {
      btnUi: document.getElementById("btn-ui-panel"),
      btnGen: document.getElementById("btn-gen-panel"),
      btnOp: document.getElementById("btn-op-panel"),
      btnConn: document.getElementById("btn-conn-panel"),
      uiPanel: document.getElementById("ui-panel"),
      genPanel: document.getElementById("gen-panel"),
      opPanel: document.getElementById("op-panel"),
      connPanel: document.getElementById("conn-panel"),
      mechPanel: document.getElementById("mech-panel"),
      mechPanelContent: document.getElementById("mech-panel-content"),
      btnMechList: document.getElementById("btn-mech-list"),
      themeToggle: document.getElementById("theme-toggle"),
      gridSizeInput: document.getElementById("grid-size"),
      focusX: document.getElementById("focus-x"),
      focusY: document.getElementById("focus-y"),
      focusZ: document.getElementById("focus-z"),
      btnFocusApply: document.getElementById("btn-focus-apply"),
      camDistance: document.getElementById("cam-distance"),
      camTheta: document.getElementById("cam-theta"),
      camPhi: document.getElementById("cam-phi"),
      btnCameraApply: document.getElementById("btn-camera-apply"),
      genX: document.getElementById("gen-x"),
      genY: document.getElementById("gen-y"),
      genZ: document.getElementById("gen-z"),
      genCubeSize: document.getElementById("gen-cube-size"),
      genThick: document.getElementById("gen-thick"),
      genArmSize: document.getElementById("gen-arm-size"),
      genAxisDiameter: document.getElementById("gen-axis-diameter"),
      genRx: document.getElementById("gen-rx"),
      genRy: document.getElementById("gen-ry"),
      genRz: document.getElementById("gen-rz"),
      genA1: document.getElementById("gen-a1"),
      genA2: document.getElementById("gen-a2"),
      genSizeHint: document.getElementById("gen-size-hint"),
      genScaleFactor: document.getElementById("gen-scale-factor"),
      btnGenerate: document.getElementById("btn-generate"),
      genScaleUp: document.getElementById("gen-scale-up"),
      genScaleDown: document.getElementById("gen-scale-down"),
      renameId: document.getElementById("rename-id"),
      selPlane: document.getElementById("sel-plane"),
      selMechId: document.getElementById("sel-mech-id"),
      selPos: document.getElementById("sel-pos"),
      selNormalStart: document.getElementById("sel-normal-start"),
      selNormalDir: document.getElementById("sel-normal-dir"),
      selPlaneCenter: document.getElementById("sel-plane-center"),
      posX: document.getElementById("pos-x"),
      posY: document.getElementById("pos-y"),
      posZ: document.getElementById("pos-z"),
      rotX: document.getElementById("rot-x"),
      rotY: document.getElementById("rot-y"),
      rotZ: document.getElementById("rot-z"),
      l1Angle: document.getElementById("l1-angle"),
      l2Angle: document.getElementById("l2-angle"),
      btnRename: document.getElementById("btn-rename"),
      btnDelete: document.getElementById("btn-delete"),
      btnClearAll: document.getElementById("btn-clear-all"),
      connAInfo: document.getElementById("conn-a-info"),
      connBInfo: document.getElementById("conn-b-info"),
      btnConnect: document.getElementById("btn-connect"),
      btnConnClear: document.getElementById("btn-conn-clear"),
      connListDiv: document.getElementById("conn-list"),
      chainInfoL1: document.getElementById("chain-info-l1"),
      chainInfoL2: document.getElementById("chain-info-l2"),
      multiCheckbox: document.getElementById("multi-checkbox"),
      modeLabel: document.getElementById("mode-label"),
      modeStatusBadgeText: document.getElementById("mode-status-badge-text"),
      btnUndo: document.getElementById("btn-undo"),
      btnRedo: document.getElementById("btn-redo"),
      btnExport: document.getElementById("btn-export"),
      fileInput: document.getElementById("file-input"),
      hideTrigger: document.getElementById("hide-trigger"),
      btnScreenshot: document.getElementById("btn-screenshot"),
      screenshotRes: document.getElementById("screenshot-res"),
      screenshotCustom: document.getElementById("screenshot-custom"),
      screenshotCustomWidth: document.getElementById("screenshot-custom-width"),
      screenshotCustomHeight: document.getElementById(
        "screenshot-custom-height"
      ),
      btnHelp: document.getElementById("btn-help"),
      helpPanel: document.getElementById("help-panel"),
      helpClose: document.getElementById("help-close"),
      helpBody: document.getElementById("help-body"),
      animCheckbox: document.getElementById("anim-checkbox"),
      animDurationInput: document.getElementById("anim-duration-input"),
      animDurationReset: document.getElementById("anim-duration-reset"),
      animStatusBadge: document.getElementById("anim-status-badge"),
      animStatusDisplay: document.getElementById("anim-status-display"),
      multiStatusDisplay: document.getElementById("multi-status-display"),
      topoStatusDisplay: document.getElementById("topo-status-display"),
      topologyCanvas: document.getElementById("topology-canvas"),
      topoModal: document.getElementById("topo-modal"),
      topoModalCanvas: document.getElementById("topo-modal-canvas"),
      topoZoomBtn: document.getElementById("topo-zoom-btn"),
      topoSaveBtn: document.getElementById("topo-save-btn"),
      topoRefreshBtn: document.getElementById("topo-refresh-btn"),
      topoAutoMaxInput: document.getElementById("topo-auto-max-input"),
      topoModalSaveBtn: document.getElementById("topo-modal-save-btn"),
      topoModalCloseBtn: document.getElementById("topo-modal-close-btn"),
      langButtons: document.querySelectorAll(".lang-btn"),
      curFx: document.getElementById("cur-fx"),
      curFy: document.getElementById("cur-fy"),
      curFz: document.getElementById("cur-fz"),
      camX: document.getElementById("cam-x"),
      camY: document.getElementById("cam-y"),
      camZ: document.getElementById("cam-z"),
      loadingOverlay: document.getElementById("loading-overlay"),
      loadingMsg: document.getElementById("loading-msg"),
      progressFill: document.getElementById("progress-fill"),
      // 连接矩阵
      matrixCanvas: document.getElementById("connection-matrix-canvas"),
      matrixZoomBtn: document.getElementById("matrix-zoom-btn"),
      matrixSaveBtn: document.getElementById("matrix-save-btn"),
      matrixModeBtns: document.querySelectorAll(".matrix-mode-btn"),
      matrixModal: document.getElementById("matrix-modal"),
      matrixModalCanvas: document.getElementById("matrix-modal-canvas"),
      matrixModalSaveBtn: document.getElementById("matrix-modal-save-btn"),
      matrixModalCloseBtn: document.getElementById("matrix-modal-close-btn"),
      // 重排序 + 排序导出
      btnRenumber: document.getElementById("btn-renumber"),
      btnExportSorted: document.getElementById("btn-export-sorted"),
    };
  }

  _bind(id, event, handler) {
    const el = typeof id === "string" ? this.dom[id] : id;
    if (!el) return;
    el.addEventListener(event, handler);
    this._boundEvents.push({ target: el, event, handler });
  }

  _bindAll() {
    // 面板切换
    this._bind("btnUi", "click", () => this._showPanel("ui"));
    this._bind("btnGen", "click", () => this._showPanel("gen"));
    this._bind("btnOp", "click", () => this._showPanel("op"));
    this._bind("btnConn", "click", () => this._showPanel("conn"));

    // 主题
    this._bind("themeToggle", "click", () => this._toggleTheme());

    // 聚焦点
    this._bind("btnFocusApply", "click", () => this._applyFocus());

    // 相机
    this._bind("btnCameraApply", "click", () => this._applyCamera());

    // 生成
    this._bind("btnGenerate", "click", () => this._onGenerate());
    this._bind("genScaleUp", "click", () => this._scaleGen(1));
    this._bind("genScaleDown", "click", () => this._scaleGen(-1));

    // 操作
    this._bind("btnRename", "click", () => this._onRename());
    this._bind("btnDelete", "click", () => this._onDelete());
    this._bind("btnClearAll", "click", () => this._onClearAll());

    // 旋转按钮
    this._bindRotationButtons();

    // 步进按钮
    this._bindStepButtons();

    // 输入事件
    this._bindInputs();

    // 连接
    this._bind("multiCheckbox", "change", () => this._onMultiToggle());
    this._bind("btnConnect", "click", () => this._onConnect());
    this._bind("btnConnClear", "click", () => this._onConnClear());

    // 撤销/重做
    this._bind("btnUndo", "click", () => this._undo());
    this._bind("btnRedo", "click", () => this._redo());

    // 导入导出
    this._bind("btnExport", "click", () => this._export());
    // 重新排序
    this._bind("btnRenumber", "click", () => this._onRenumber());
    // 排序并导出
    this._bind("btnExportSorted", "click", () => this._exportSorted());

    // 连接矩阵：模式切换
    this.dom.matrixModeBtns.forEach((btn) => {
      this._bind(btn, "click", () =>
        this._onMatrixModeChange(btn.dataset.mode)
      );
    });
    this._bind("matrixZoomBtn", "click", () => this._openMatrixModal());
    this._bind("matrixSaveBtn", "click", () => this._saveMatrix());
    this._bind("matrixModalCloseBtn", "click", () => this._closeMatrixModal());
    this._bind("matrixModalSaveBtn", "click", () => this._saveMatrixModal());
    this._bind("matrixModal", "click", (e) => {
      if (e.target === this.dom.matrixModal) this._closeMatrixModal();
    });
    this._bind("fileInput", "change", (e) => this._import(e));

    // 机构列表
    this._bind("btnMechList", "click", () => this._toggleMechList());

    // 隐藏控件
    this._bind("hideTrigger", "click", () => this._toggleHideUI());

    // 截图
    this._bind("btnScreenshot", "click", () => this._takeScreenshot());
    this._bind("screenshotRes", "change", () => this._onScreenshotResChange());

    // 帮助
    this._bind("btnHelp", "click", () => this._toggleHelp());
    this._bind("helpClose", "click", () => this._toggleHelp());

    // 动画
    this._bind("animCheckbox", "change", () => {
      this.animEnabled = this.dom.animCheckbox.checked;
      this.appState._animEnabled = this.animEnabled;
      if (!this.animEnabled && this.appState.animState.active) {
        this.appState.animState.active = false;
      }
      this._updateAnimStatus();
    });
    this._bind("animDurationInput", "change", () => {
      let v = parseInt(this.dom.animDurationInput.value);
      if (isNaN(v) || v < 50) v = 50;
      if (v > 2000) v = 2000;
      this.dom.animDurationInput.value = v;
      this.animDuration = v;
    });
    this._bind("animDurationReset", "click", () => {
      this.dom.animDurationInput.value = 400;
      this.animDuration = 400;
      this.notification.showSuccess(t("anim-reset"));
    });

    // 拓扑图
    this._bind("topoRefreshBtn", "click", () => {
      // 手动刷新控件：任何模式下都强制重绘（手动模式下这是唯一的自动刷新途径）
      this.topologyRenderer.forceRefresh(this.appState._topoHighlightId);
      this.notification.showSuccess(t("topo-refreshed"), 1500);
    });
    // 自动绘制数量界限：实时调整
    if (this.dom.topoAutoMaxInput) {
      this._bind("topoAutoMaxInput", "input", () => this._onTopoAutoMaxChange());
      this._bind("topoAutoMaxInput", "change", () => this._onTopoAutoMaxChange());
    }
    this._bind("topoZoomBtn", "click", () => this._openTopoModal());
    this._bind("topoSaveBtn", "click", () => this._saveTopo());
    this._bind("topoModalCloseBtn", "click", () => this._closeTopoModal());
    this._bind("topoModalSaveBtn", "click", () => this._saveTopoModal());
    this._bind("topoModal", "click", (e) => {
      if (e.target === this.dom.topoModal) this._closeTopoModal();
    });

    // 语言
    this.dom.langButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setLang(btn.dataset.lang);
        this._updateAllTexts();
        this._refreshUI();
      });
    });

    // 场景点击
    this._setupRaycaster();

    // 键盘快捷键
    this._setupKeyboard();

    // 网格
    this._bind("gridSizeInput", "change", () => this._onGridSizeChange());

    window.addEventListener("beforeunload", () => this.destroy());
  }

  // 面板切换
  _showPanel(id) {
    const panels = ["ui", "gen", "op", "conn"];
    const panelMap = {
      ui: this.dom.uiPanel,
      gen: this.dom.genPanel,
      op: this.dom.opPanel,
      conn: this.dom.connPanel,
    };
    const btnMap = {
      ui: this.dom.btnUi,
      gen: this.dom.btnGen,
      op: this.dom.btnOp,
      conn: this.dom.btnConn,
    };

    // 如果点击的是当前已打开的面板，则关闭它
    if (this._currentPanel === id) {
      // 隐藏所有面板
      for (const key of panels) {
        panelMap[key].classList.add("hidden");
        btnMap[key].classList.remove("active");
      }
      // 移除生成面板的预览（如果存在）
      this._removePreview();
      this._currentPanel = null;
      return;
    }

    // 否则，显示目标面板，隐藏其他
    for (const key of panels) {
      panelMap[key].classList.add("hidden");
      btnMap[key].classList.remove("active");
    }
    panelMap[id].classList.remove("hidden");
    btnMap[id].classList.add("active");
    this._currentPanel = id;

    // 切换到连接面板时刷新连接矩阵
    if (id === "conn" && this.matrixRenderer) {
      this.matrixRenderer.refresh();
    }

    // 如果切换到生成面板，同步预览
    if (id === "gen") {
      this.genRotationQuat.identity();
      this._syncGenQuat();
      this._updatePreview();
    } else {
      this._removePreview();
    }

    // 如果切换到 UI 面板，同步相机信息
    if (id === "ui") {
      this._syncUIFromCamera();
    }

    // 触发自定义事件（可选）
    const event = new CustomEvent("panelchange", {
      detail: { panel: id, previous: this._currentPanel },
    });
    document.dispatchEvent(event);
  }

  // ==================== 主题 ====================
  _toggleTheme() {
    this.dark = !this.dark;
    document.body.classList.toggle("light-theme", !this.dark);
    this.dom.themeToggle.textContent = this.dark
      ? t("ui-theme-dark")
      : t("ui-theme-light");
    this.sceneManager.scene.background.set(this.dark ? 0x1a1a2e : 0xf0f2f5);
    this.topologyRenderer.refresh(this.appState._topoHighlightId);
  }

  // ==================== 聚焦点 ====================
  _applyFocus() {
    const getBounded = (el, fallback) => {
      let val = parseFloat(el.value) || fallback;
      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      if (!isNaN(min) && val < min) val = min;
      if (!isNaN(max) && val > max) val = max;
      el.value = val.toFixed(2);
      return val;
    };

    let x = getBounded(this.dom.focusX, 0.5);
    let y = getBounded(this.dom.focusY, 0.5);
    let z = getBounded(this.dom.focusZ, 0.5);
    this.sceneManager.controls.target.set(x, y, z);
    this.sceneManager.controls.update();
  }

  // ==================== 相机 ====================
  _applyCamera() {
    const dist = Math.max(1, parseFloat(this.dom.camDistance.value) || 8.6);
    const thetaDeg = parseFloat(this.dom.camTheta.value) || -42;
    const phiDeg = Math.min(
      179,
      Math.max(1, parseFloat(this.dom.camPhi.value) || 50)
    );
    const theta = THREE.MathUtils.degToRad(thetaDeg);
    const phi = THREE.MathUtils.degToRad(phiDeg);
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    );
    this.sceneManager.camera.position
      .copy(this.sceneManager.controls.target)
      .addScaledVector(dir, dist);
    this.sceneManager.controls.update();
  }

  _syncUIFromCamera() {
    const t = this.sceneManager.controls.target;
    this.dom.focusX.value = t.x.toFixed(2);
    this.dom.focusY.value = t.y.toFixed(2);
    this.dom.focusZ.value = t.z.toFixed(2);
    const dist = this.sceneManager.camera.position.distanceTo(t);
    const dir = new THREE.Vector3()
      .subVectors(this.sceneManager.camera.position, t)
      .normalize();
    const theta = THREE.MathUtils.radToDeg(Math.atan2(dir.y, dir.x));
    const phi = THREE.MathUtils.radToDeg(Math.acos(dir.z));
    this.dom.camDistance.value = dist.toFixed(2);
    this.dom.camTheta.value = theta.toFixed(2);
    this.dom.camPhi.value = phi.toFixed(2);
  }

  // ==================== 生成 ====================
  _onGenerate() {
    let x = parseFloat(this.dom.genX.value) || 0;
    let y = parseFloat(this.dom.genY.value) || 0;
    let z = parseFloat(this.dom.genZ.value) || 0;
    this.dom.genX.value = x.toFixed(2);
    this.dom.genY.value = y.toFixed(2);
    this.dom.genZ.value = z.toFixed(2);
    const { cubeSize, thickness, armSize, axisDiam, valid } =
      this._updateGenDisplay();
    if (!valid || armSize <= 0) {
      this.notification.showError(t("toast-thick-error"));
      return;
    }
    const euler = new THREE.Euler().setFromQuaternion(
      this.genRotationQuat,
      "XYZ"
    );
    const rot = new THREE.Euler(euler.x, euler.y, euler.z, "XYZ");
    const a1 = normalizeAngleDeg(parseFloat(this.dom.genA1.value) || 0);
    const a2 = normalizeAngleDeg(parseFloat(this.dom.genA2.value) || 0);
    this.dom.genA1.value = a1.toFixed(2);
    this.dom.genA2.value = a2.toFixed(2);
    const pos = new THREE.Vector3(x, y, z);

    const group = createMechanism(
      pos,
      rot,
      a1,
      a2,
      armSize,
      thickness,
      cubeSize,
      axisDiam / 2,
      false
    );
    const id = this.appState.mechanisms.length
      ? Math.max(...this.appState.mechanisms.map((m) => m.id)) + 1
      : 1;
    const mech = new Mechanism({
      id,
      position: pos,
      worldRotation: rot,
      l1Angle: a1,
      l2Angle: a2,
      armSize,
      thickness,
      cubeSize,
      axisRadius: axisDiam / 2,
    });
    mech.group = group;
    mech.normal = new THREE.Vector3(0, 0, 1).applyEuler(rot).normalize();

    this.appState.addMechanism(mech, true);
    this.appState.setActive(this.appState.mechanisms.length - 1);
    this.notification.showSuccess(t("toast-gen-ok", { id }));
    this.genRotationQuat.identity();
    this._syncGenQuat();
    this._removePreview();
    this._refreshUI();
    this.topologyRenderer.refresh(this.appState._topoHighlightId);
    this.appState.applyConstraints();
  }

  _scaleGen(dir) {
    const factor = parseInt(this.dom.genScaleFactor.value);
    if (isNaN(factor) || factor < 2) {
      this.notification.showError(t("scale-invalid"));
      return;
    }
    let cur = parseInt(this.dom.genCubeSize.value) || 1;
    let nv =
      dir > 0
        ? Math.min(cur * factor, 128)
        : Math.max(Math.floor(cur / factor), 1);
    this.dom.genCubeSize.value = nv;
    this._updateGenDisplay();
    this._updatePreview();
  }

  _updateGenDisplay() {
    const cubeSize = Math.max(
      1,
      Math.min(128, parseInt(this.dom.genCubeSize.value) || 1)
    );
    let thickness = Math.max(
      0.02,
      parseFloat(this.dom.genThick.value) || 0.125
    );
    const maxThick = cubeSize / 2;
    if (thickness > maxThick) thickness = maxThick;
    this.dom.genThick.value = thickness;
    const armSize = cubeSize - 2 * thickness;
    const axisDiam = cubeSize / 4;
    this.dom.genArmSize.value = armSize.toFixed(3);
    this.dom.genAxisDiameter.value = axisDiam.toFixed(3);
    const valid = armSize > 0 && thickness > 0 && cubeSize > 0;
    this.dom.genSizeHint.textContent = valid
      ? t("gen-valid")
      : t("gen-invalid");
    this.dom.genSizeHint.style.color = valid
      ? "var(--success)"
      : "var(--danger)";
    this.dom.btnGenerate.disabled = !valid;
    return { cubeSize, thickness, armSize, axisDiam, valid };
  }

  // ==================== 预览 ====================
  _updatePreview() {
    if (this.previewPending) return;
    this.previewPending = true;
    if (this.previewTimeout) clearTimeout(this.previewTimeout);
    this.previewTimeout = setTimeout(() => {
      this.previewPending = false;
      this.previewTimeout = null;
      this._doUpdatePreview();
    }, 80);
  }

  _doUpdatePreview() {
    if (this.dom.genPanel.classList.contains("hidden")) {
      this._removePreview();
      return;
    }
    this._removePreview();
    const x = parseFloat(this.dom.genX.value) || 0;
    const y = parseFloat(this.dom.genY.value) || 0;
    const z = parseFloat(this.dom.genZ.value) || 0;
    const { cubeSize, thickness, armSize, axisDiam, valid } =
      this._updateGenDisplay();
    if (!valid || armSize <= 0) return;
    const euler = new THREE.Euler().setFromQuaternion(
      this.genRotationQuat,
      "XYZ"
    );
    const rot = new THREE.Euler(euler.x, euler.y, euler.z, "XYZ");
    const a1 = normalizeAngleDeg(parseFloat(this.dom.genA1.value) || 0);
    const a2 = normalizeAngleDeg(parseFloat(this.dom.genA2.value) || 0);
    const pos = new THREE.Vector3(x, y, z);
    const group = createMechanism(
      pos,
      rot,
      a1,
      a2,
      armSize,
      thickness,
      cubeSize,
      axisDiam / 2,
      true
    );
    this.previewGroup = group;
    this.sceneManager.addObject(group);
  }

  _removePreview() {
    if (this.previewGroup) {
      this.sceneManager.removeObject(this.previewGroup);
      this.previewGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      this.previewGroup = null;
    }
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.previewPending = false;
  }

  _syncGenQuat() {
    const e = quatToEulerDeg(this.genRotationQuat);
    this.dom.genRx.value = e.x.toFixed(2);
    this.dom.genRy.value = e.y.toFixed(2);
    this.dom.genRz.value = e.z.toFixed(2);
  }

  _applyGenWorldAxis(axis, delta) {
    const rad = THREE.MathUtils.degToRad(delta);
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(axis[0], axis[1], axis[2]),
      rad
    );
    this.genRotationQuat.premultiply(q);
    this._syncGenQuat();
    this._updatePreview();
  }

  /**
   * 判断指定机构是否与基准平面直接相连
   * @param {number} idx - 机构索引
   * @returns {boolean}
   */
  _hasBasePlaneConnection(idx) {
    if (idx < 0 || idx >= this.appState.mechanisms.length) return false;
    for (const c of this.appState.connections) {
      const a = c.planeA.mechanismIndex;
      const b = c.planeB.mechanismIndex;
      if ((a === -1 && b === idx) || (b === -1 && a === idx)) return true;
    }
    return false;
  }

  _applyTransform() {
    if (this.appState.activeIdx === -1) return;
    const mech = this.appState.mechanisms[this.appState.activeIdx];
    if (!mech) return;

    // ===== 辅助：读取并裁剪数值 =====
    const getBounded = (el, fallback) => {
      let val = parseFloat(el.value) || fallback;
      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      if (!isNaN(min) && val < min) val = min;
      if (!isNaN(max) && val > max) val = max;
      el.value = val.toFixed(2);
      return val;
    };

    let newX = getBounded(this.dom.posX, 0);
    let newY = getBounded(this.dom.posY, 0);
    let newZ = getBounded(this.dom.posZ, 0);
    let newL1 = normalizeAngleDeg(parseFloat(this.dom.l1Angle.value) || 0);
    let newL2 = normalizeAngleDeg(parseFloat(this.dom.l2Angle.value) || 0);

    const deltaPos = new THREE.Vector3(newX, newY, newZ).sub(mech.position);
    const deltaL1 = shortestAngleDelta(mech.l1Angle, newL1);
    const deltaL2 = shortestAngleDelta(mech.l2Angle, newL2);

    let hasPos = deltaPos.length() > 0.0001;
    let hasL1 = Math.abs(deltaL1) > 0.01;
    let hasL2 = Math.abs(deltaL2) > 0.01;

    // ===== ① 双环检查（L 旋转最高优先级） =====
    if (
      (hasL1 || hasL2) &&
      this.appState.isInBothLoops(this.appState.activeIdx)
    ) {
      this.notification.showError(t("toast-rotation-blocked"));
      this.dom.l1Angle.value = mech.l1Angle.toFixed(2);
      this.dom.l2Angle.value = mech.l2Angle.toFixed(2);
      return;
    }

    // ===== ② 链条级锁定 =====
    const l1ChainHasBase = this._chainHasBasePlaneConnection(
      this.appState.activeIdx,
      "L1"
    );
    const l2ChainHasBase = this._chainHasBasePlaneConnection(
      this.appState.activeIdx,
      "L2"
    );
    const lockPosRot = l1ChainHasBase || l2ChainHasBase;

    // 2.1 整体平移：任一链有基准平面连接即禁止
    if (hasPos && lockPosRot) {
      this.notification.showError(t("toast-base-plane-locked"));
      this.dom.posX.value = mech.position.x.toFixed(2);
      this.dom.posY.value = mech.position.y.toFixed(2);
      this.dom.posZ.value = mech.position.z.toFixed(2);
      hasPos = false;
    }

    // 2.2 L1 旋转：L1 链有基准平面连接即禁止
    if (hasL1 && l1ChainHasBase) {
      this.notification.showError(t("toast-base-plane-chain-l1"));
      this.dom.l1Angle.value = mech.l1Angle.toFixed(2);
      hasL1 = false;
    }

    // 2.3 L2 旋转：L2 链有基准平面连接即禁止
    if (hasL2 && l2ChainHasBase) {
      this.notification.showError(t("toast-base-plane-chain-l2"));
      this.dom.l2Angle.value = mech.l2Angle.toFixed(2);
      hasL2 = false;
    }

    if (!hasPos && !hasL1 && !hasL2) return;

    // ===== ③ 计算分支 =====
    let l1Branch = [];
    let l2Branch = [];
    if (hasL1) {
      const chainL1 = this.appState.getConnectionChain(
        this.appState.activeIdx,
        "L1"
      );
      l1Branch = Array.from(chainL1.collectedMechIndices).filter(
        (i) => i !== this.appState.activeIdx
      );
    }
    if (hasL2) {
      const chainL2 = this.appState.getConnectionChain(
        this.appState.activeIdx,
        "L2"
      );
      l2Branch = Array.from(chainL2.collectedMechIndices).filter(
        (i) => i !== this.appState.activeIdx
      );
    }

    // ===== ④ 确定影响的机构 =====
    let affectedIndices;
    if (hasPos) {
      affectedIndices = this.appState.getAffectedIndices(
        this.appState.activeIdx
      );
    } else {
      if (hasL1 && !hasL2) {
        affectedIndices = [this.appState.activeIdx, ...l1Branch];
      } else if (hasL2 && !hasL1) {
        affectedIndices = [this.appState.activeIdx, ...l2Branch];
      } else if (hasL1 && hasL2) {
        const set = new Set([
          this.appState.activeIdx,
          ...l1Branch,
          ...l2Branch,
        ]);
        affectedIndices = Array.from(set);
      } else {
        affectedIndices = [this.appState.activeIdx];
      }
    }
    const sorted = [
      this.appState.activeIdx,
      ...affectedIndices.filter((i) => i !== this.appState.activeIdx),
    ];

    // ===== ⑤ 保存初始状态 =====
    const initState = sorted.map((idx) => {
      const m = this.appState.mechanisms[idx];
      return {
        position: m.position.clone(),
        quaternion: m.group.quaternion.clone(),
        l1Angle: idx === this.appState.activeIdx ? m.l1Angle : undefined,
        l2Angle: idx === this.appState.activeIdx ? m.l2Angle : undefined,
      };
    });

    // ===== ⑥ 应用变换（计算目标状态） =====
    if (hasPos) {
      for (const idx of sorted) {
        const m = this.appState.mechanisms[idx];
        if (m) {
          m.position.add(deltaPos);
          m.group.position.copy(m.position);
        }
      }
    }

    if (hasL1) {
      mech.l1Angle = newL1;
      mech.group.userData.l1.rotation.z = THREE.MathUtils.degToRad(newL1);
    }
    if (hasL2) {
      mech.l2Angle = newL2;
      mech.group.userData.l2.rotation.z = THREE.MathUtils.degToRad(newL2);
    }

    if (hasL1) {
      const axis = mech.normal.clone();
      const angleRad = THREE.MathUtils.degToRad(deltaL1);
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
      const center = mech.position.clone();
      for (const idx of l1Branch) {
        const m = this.appState.mechanisms[idx];
        if (!m) continue;
        const offset = m.position.clone().sub(center);
        offset.applyQuaternion(q);
        m.position.copy(center).add(offset);
        m.group.position.copy(m.position);
        const mq = m.group.quaternion.clone();
        mq.premultiply(q);
        m.group.quaternion.copy(mq);
        m.worldRotation.setFromQuaternion(m.group.quaternion);
        m.normal = new THREE.Vector3(0, 0, 1)
          .applyEuler(m.worldRotation)
          .normalize();
      }
    }

    if (hasL2) {
      const axis = mech.normal.clone();
      const angleRad = THREE.MathUtils.degToRad(deltaL2);
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
      const center = mech.position.clone();
      for (const idx of l2Branch) {
        const m = this.appState.mechanisms[idx];
        if (!m) continue;
        const offset = m.position.clone().sub(center);
        offset.applyQuaternion(q);
        m.position.copy(center).add(offset);
        m.group.position.copy(m.position);
        const mq = m.group.quaternion.clone();
        mq.premultiply(q);
        m.group.quaternion.copy(mq);
        m.worldRotation.setFromQuaternion(m.group.quaternion);
        m.normal = new THREE.Vector3(0, 0, 1)
          .applyEuler(m.worldRotation)
          .normalize();
      }
    }

    // ===== ⑦ 保存目标状态 =====
    const targetState = sorted.map((idx) => {
      const m = this.appState.mechanisms[idx];
      return {
        position: m.position.clone(),
        quaternion: m.group.quaternion.clone(),
        l1Angle: idx === this.appState.activeIdx ? m.l1Angle : undefined,
        l2Angle: idx === this.appState.activeIdx ? m.l2Angle : undefined,
      };
    });

    // ===== ⑧ 回滚到初始状态 =====
    for (let i = 0; i < sorted.length; i++) {
      const idx = sorted[i];
      const m = this.appState.mechanisms[idx];
      const init = initState[i];
      m.position.copy(init.position);
      m.group.position.copy(m.position);
      m.group.quaternion.copy(init.quaternion);
      m.worldRotation.setFromQuaternion(m.group.quaternion);
      m.normal = new THREE.Vector3(0, 0, 1)
        .applyEuler(m.worldRotation)
        .normalize();
      if (idx === this.appState.activeIdx) {
        if (init.l1Angle !== undefined) {
          m.l1Angle = init.l1Angle;
          m.group.userData.l1.rotation.z = THREE.MathUtils.degToRad(
            init.l1Angle
          );
        }
        if (init.l2Angle !== undefined) {
          m.l2Angle = init.l2Angle;
          m.group.userData.l2.rotation.z = THREE.MathUtils.degToRad(
            init.l2Angle
          );
        }
      }
    }

    // ===== ⑨ 弧形动画数据（仅单分支旋转） =====
    let arcData = null;
    if (!hasPos && ((hasL1 && !hasL2) || (!hasL1 && hasL2))) {
      const delta = hasL1 ? deltaL1 : deltaL2;
      arcData = {
        center: mech.position.clone(),
        axis: mech.normal.clone(),
        angle: THREE.MathUtils.degToRad(delta),
        uniformAxis: true,
      };
    }

    // ===== ⑩ 启动动画或直接应用 =====
    if (this.animEnabled && this.animDuration > 0) {
      this.appState.startAnimation(
        initState,
        targetState,
        sorted,
        this.animDuration,
        hasL1,
        hasL2,
        () => {
          this.appState.applyConstraints();
          this.appState._commitPostAnimation();
          this._refreshUI();
        },
        true,
        arcData
      );
    } else {
      this.appState.applyTargetState(targetState, sorted, hasL1, hasL2);
      this.appState.applyConstraints();
      this.appState._commitPostAnimation();
      this._refreshUI();
    }
  }

  _applyAbsoluteRotation() {
    if (this.appState.activeIdx === -1) return;
    const mech = this.appState.mechanisms[this.appState.activeIdx];
    if (!mech) return;

    // ===== 整体旋转锁定：两条链任一有基准平面连接 =====
    const l1ChainHasBase = this._chainHasBasePlaneConnection(
      this.appState.activeIdx,
      "L1"
    );
    const l2ChainHasBase = this._chainHasBasePlaneConnection(
      this.appState.activeIdx,
      "L2"
    );
    if (l1ChainHasBase || l2ChainHasBase) {
      this.notification.showError(t("toast-base-plane-locked"));
      const e = new THREE.Euler().setFromQuaternion(
        mech.group.quaternion,
        "XYZ"
      );
      this.dom.rotX.value = normalizeAngleDeg(
        THREE.MathUtils.radToDeg(e.x)
      ).toFixed(2);
      this.dom.rotY.value = normalizeAngleDeg(
        THREE.MathUtils.radToDeg(e.y)
      ).toFixed(2);
      this.dom.rotZ.value = normalizeAngleDeg(
        THREE.MathUtils.radToDeg(e.z)
      ).toFixed(2);
      return;
    }

    let rx = normalizeAngleDeg(parseFloat(this.dom.rotX.value) || 0);
    let ry = normalizeAngleDeg(parseFloat(this.dom.rotY.value) || 0);
    let rz = normalizeAngleDeg(parseFloat(this.dom.rotZ.value) || 0);
    this.dom.rotX.value = rx.toFixed(2);
    this.dom.rotY.value = ry.toFixed(2);
    this.dom.rotZ.value = rz.toFixed(2);

    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rx),
      THREE.MathUtils.degToRad(ry),
      THREE.MathUtils.degToRad(rz),
      "XYZ"
    );
    const targetQuat = new THREE.Quaternion().setFromEuler(euler);
    const oldQuat = mech.group.quaternion.clone();
    const relQuat = targetQuat.clone().multiply(oldQuat.clone().invert());

    const affected = this.appState.getAffectedIndices(this.appState.activeIdx);
    const sorted = [
      this.appState.activeIdx,
      ...affected.filter((i) => i !== this.appState.activeIdx),
    ];

    const initState = sorted.map((idx) => {
      const m = this.appState.mechanisms[idx];
      return {
        position: m.position.clone(),
        quaternion: m.group.quaternion.clone(),
        l1Angle: undefined,
        l2Angle: undefined,
      };
    });

    mech.group.quaternion.copy(targetQuat);
    mech.worldRotation.copy(euler);
    mech.normal = new THREE.Vector3(0, 0, 1)
      .applyEuler(mech.worldRotation)
      .normalize();

    const center = mech.position.clone();
    for (const idx of sorted) {
      if (idx === this.appState.activeIdx) continue;
      const m = this.appState.mechanisms[idx];
      if (!m) continue;
      const offset = m.position.clone().sub(center);
      offset.applyQuaternion(relQuat);
      m.position.copy(center).add(offset);
      m.group.position.copy(m.position);
      const mq = m.group.quaternion.clone();
      mq.premultiply(relQuat);
      m.group.quaternion.copy(mq);
      m.worldRotation.setFromQuaternion(m.group.quaternion);
      m.normal = new THREE.Vector3(0, 0, 1)
        .applyEuler(m.worldRotation)
        .normalize();
    }

    const targetState = sorted.map((idx) => {
      const m = this.appState.mechanisms[idx];
      return {
        position: m.position.clone(),
        quaternion: m.group.quaternion.clone(),
        l1Angle: undefined,
        l2Angle: undefined,
      };
    });

    // 回滚到初始
    for (let i = 0; i < sorted.length; i++) {
      const idx = sorted[i];
      const m = this.appState.mechanisms[idx];
      const init = initState[i];
      m.position.copy(init.position);
      m.group.position.copy(m.position);
      m.group.quaternion.copy(init.quaternion);
      m.worldRotation.setFromQuaternion(m.group.quaternion);
      m.normal = new THREE.Vector3(0, 0, 1)
        .applyEuler(m.worldRotation)
        .normalize();
    }

    this.appState.startAnimation(
      initState,
      targetState,
      sorted,
      this.animEnabled ? this.animDuration : 0,
      false,
      false,
      () => {
        this.appState.applyConstraints();
        this.appState._commitPostAnimation();
        this._refreshUI();
      },
      false
    );
  }

  _applyWorldAxis(axis, delta) {
    if (this.appState.activeIdx === -1) return;
    const mech = this.appState.mechanisms[this.appState.activeIdx];
    if (!mech) return;

    // ===== 整体旋转锁定：两条链任一有基准平面连接 =====
    const l1ChainHasBase = this._chainHasBasePlaneConnection(
      this.appState.activeIdx,
      "L1"
    );
    const l2ChainHasBase = this._chainHasBasePlaneConnection(
      this.appState.activeIdx,
      "L2"
    );
    if (l1ChainHasBase || l2ChainHasBase) {
      this.notification.showError(t("toast-base-plane-locked"));
      return;
    }

    const rad = THREE.MathUtils.degToRad(delta);
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(axis[0], axis[1], axis[2]),
      rad
    );

    const affected = this.appState.getAffectedIndices(this.appState.activeIdx);
    const sorted = [
      this.appState.activeIdx,
      ...affected.filter((i) => i !== this.appState.activeIdx),
    ];

    const initState = sorted.map((idx) => {
      const m = this.appState.mechanisms[idx];
      return {
        position: m.position.clone(),
        quaternion: m.group.quaternion.clone(),
        l1Angle: undefined,
        l2Angle: undefined,
      };
    });

    mech.group.quaternion.premultiply(q);
    mech.worldRotation.setFromQuaternion(mech.group.quaternion);
    mech.normal = new THREE.Vector3(0, 0, 1)
      .applyEuler(mech.worldRotation)
      .normalize();

    const center = mech.position.clone();
    for (const idx of sorted) {
      if (idx === this.appState.activeIdx) continue;
      const m = this.appState.mechanisms[idx];
      if (!m) continue;
      const offset = m.position.clone().sub(center);
      offset.applyQuaternion(q);
      m.position.copy(center).add(offset);
      m.group.position.copy(m.position);
      const mq = m.group.quaternion.clone();
      mq.premultiply(q);
      m.group.quaternion.copy(mq);
      m.worldRotation.setFromQuaternion(m.group.quaternion);
      m.normal = new THREE.Vector3(0, 0, 1)
        .applyEuler(m.worldRotation)
        .normalize();
    }

    const targetState = sorted.map((idx) => {
      const m = this.appState.mechanisms[idx];
      return {
        position: m.position.clone(),
        quaternion: m.group.quaternion.clone(),
        l1Angle: undefined,
        l2Angle: undefined,
      };
    });

    // 回滚到初始
    for (let i = 0; i < sorted.length; i++) {
      const idx = sorted[i];
      const m = this.appState.mechanisms[idx];
      const init = initState[i];
      m.position.copy(init.position);
      m.group.position.copy(m.position);
      m.group.quaternion.copy(init.quaternion);
      m.worldRotation.setFromQuaternion(m.group.quaternion);
      m.normal = new THREE.Vector3(0, 0, 1)
        .applyEuler(m.worldRotation)
        .normalize();
    }

    this.appState.startAnimation(
      initState,
      targetState,
      sorted,
      this.animEnabled ? this.animDuration : 0,
      false,
      false,
      () => {
        this.appState.applyConstraints();
        this.appState._commitPostAnimation();
        this._refreshUI();
      },
      false,
      {
        center: mech.position.clone(),
        axis: new THREE.Vector3(axis[0], axis[1], axis[2]),
        angle: rad,
        uniformAxis: true,
      }
    );
  }

  _getBranchIndices(idx, branch) {
    const chain = this.appState.getConnectionChain(idx, branch);
    return Array.from(chain.collectedMechIndices);
  }

  // ==================== 连接 ====================
  _onConnect() {
    const A = this.appState.selectedConnA;
    const B = this.appState.selectedConnB;
    if (!A || !B) return;
    const planeA = {
      mechanismIndex: A.mechanismIndex,
      planeIndex: A.planeIndex,
    };
    const planeB = {
      mechanismIndex: B.mechanismIndex,
      planeIndex: B.planeIndex,
    };
    const ok = this.appState.addConnection(planeA, planeB, true);
    if (ok) {
      // 获取新连接ID（最新添加的连接）
      const conns = this.appState.connections;
      const newId = conns.length > 0 ? conns[conns.length - 1].id : null;
      this.appState.clearConnectionSelection();
      this.appState.applyConstraints();
      this._safeRefreshTopology();
      this._refreshUI();
      if (newId) {
        this.notification.showSuccess(t("toast-conn-ok", { id: newId }));
      }
    }
  }

  _onConnClear() {
    this.appState.clearConnectionSelection();
    this.appState.clearConnectionChainHighlight();
    if (this.appState.selectedPlaneData) this._updateOpPanel();
    this.topologyRenderer.refresh(this.appState._topoHighlightId);
    this._refreshUI();
  }

  // ==================== 重新排序 ====================
  _onRenumber() {
    if (this.appState.mechanisms.length === 0) {
      this.notification.showWarning(t("conn-renumber-no-mech"), 1200);
      return;
    }
    if (!confirm(t("conn-renumber-confirm"))) return;

    try {
      this.appState.renumber();
      const count = this.appState.mechanisms.length;
      this.notification.showSuccess(t("conn-renumber-success", { count }));
      this._safeRefreshTopology();
      if (this.matrixRenderer) this.matrixRenderer.refresh();
      this._refreshUI();
    } catch (err) {
      this.notification.showError(t("toast-export-fail", { msg: err.message }));
    }
  }

  // ==================== 连接矩阵 ====================
  _onMatrixModeChange(mode) {
    if (!this.matrixRenderer) return;
    this.matrixRenderer.setMode(mode);
    this.dom.matrixModeBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    this.matrixRenderer.refresh();
  }

  _updateConnectionMatrix() {
    if (!this.matrixRenderer) return;
    if (this._currentPanel !== "conn") return;
    this.matrixRenderer.refresh();
  }

  _openMatrixModal() {
    if (!this.matrixRenderer) return;
    this.dom.matrixModal.classList.add("visible");
    const canvas = this.dom.matrixModalCanvas;
    if (!canvas) return;

    // 等一帧让 .modal-body 完成布局（display 从 none 变为 flex）
    requestAnimationFrame(() => {
      const W = canvas.clientWidth || canvas.parentElement.clientWidth;
      const H = canvas.clientHeight || canvas.parentElement.clientHeight;
      // 二次兜底：若首次读到的尺寸异常小，再等一帧
      if (W < 50 || H < 50) {
        requestAnimationFrame(() => {
          const w2 = canvas.clientWidth || canvas.parentElement.clientWidth;
          const h2 = canvas.clientHeight || canvas.parentElement.clientHeight;
          this.matrixRenderer.drawToCanvas(canvas, w2, h2);
        });
      } else {
        this.matrixRenderer.drawToCanvas(canvas, W, H);
      }
    });
  }

  _closeMatrixModal() {
    this.dom.matrixModal.classList.remove("visible");
  }

  /**
   * 通用文件保存（支持选择保存路径）
   * - 浏览器支持 showSaveFilePicker（Chromium/Edge 等）时弹出系统"另存为"对话框，可选择目录
   * - 其他浏览器回退为输入文件名后下载到默认下载目录
   * @param {Blob} blob - 文件内容
   * @param {string} suggestedName - 建议文件名
   * @param {object} [type] - 文件类型描述，如 { description: "PNG 图片", accept: { "image/png": [".png"] } }
   * @returns {Promise<{success: boolean, aborted?: boolean, error?: string}>}
   */
  async _saveBlob(blob, suggestedName, type) {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: type ? [type] : undefined,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true };
      } catch (err) {
        if (err.name === "AbortError") return { success: false, aborted: true };
        return { success: false, error: err.message };
      }
    }
    // 回退：prompt 输入文件名后使用 a[download]
    const name = prompt(t("export-enter-filename"), suggestedName);
    if (!name) return { success: false, aborted: true };
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }

  /** canvas → PNG Blob */
  _canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
  }

  async _saveMatrix() {
    if (!this.matrixRenderer || !this.matrixRenderer.canvas) return;
    try {
      const blob = await this._canvasToPngBlob(this.matrixRenderer.canvas);
      const name = `connection_matrix_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.png`;
      const r = await this._saveBlob(blob, name, {
        description: "PNG 图片",
        accept: { "image/png": [".png"] },
      });
      if (r.success) this.notification.showSuccess(t("conn-matrix-save") + " ✓");
      else if (r.error) this.notification.showError(r.error);
    } catch (err) {
      this.notification.showError(err.message);
    }
  }

  async _saveMatrixModal() {
    const canvas = this.dom.matrixModalCanvas;
    if (!canvas) return;
    try {
      const blob = await this._canvasToPngBlob(canvas);
      const name = `connection_matrix_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.png`;
      const r = await this._saveBlob(blob, name, {
        description: "PNG 图片",
        accept: { "image/png": [".png"] },
      });
      if (r.success) this.notification.showSuccess(t("conn-matrix-save") + " ✓");
      else if (r.error) this.notification.showError(r.error);
    } catch (err) {
      this.notification.showError(err.message);
    }
  }

  // ==================== 导出（重构） ====================
  /**
   * 通用保存（支持自定义目录/文件名，浏览器支持时用 showSaveFilePicker）
   * @param {object} data - 要序列化的对象
   * @param {string} suggestedName - 建议文件名
   * @returns {Promise<{success: boolean, aborted?: boolean, error?: string}>}
   */
  async _saveJsonFile(data, suggestedName) {
    // 生成缩进 JSON（保持数组块每行一个元素的可读格式）
    const comments = Array.isArray(data._) ? data._ : [];
    const arrBlock = (arr, indent = "    ") => {
      if (!Array.isArray(arr) || arr.length === 0) return "[]";
      return (
        "[\n" +
        arr.map((item) => indent + JSON.stringify(item)).join(",\n") +
        "\n  ]"
      );
    };

    const lines = [];
    lines.push("{");
    lines.push('  "_": [');
    if (comments.length > 0) {
      lines.push(comments.map((s) => "    " + JSON.stringify(s)).join(",\n"));
    }
    lines.push("  ],");
    lines.push(`  "v": ${data.v != null ? data.v : 1},`);
    lines.push(`  "t": ${data.t != null ? data.t : 0.125},`);
    lines.push(`  "m": ${arrBlock(data.m)},`);
    lines.push(`  "c": ${arrBlock(data.c)},`);
    lines.push(
      `  "n": ${data.n != null ? data.n : 1}${data.matrix ? "," : ""}`
    );
    if (data.matrix) {
      const mtxLines = data.matrix.map((row) => "    " + JSON.stringify(row));
      lines.push('  "matrix": [');
      lines.push(mtxLines.join(",\n"));
      lines.push("  ]");
    }
    lines.push("}");
    const json = lines.join("\n");

    // 优先使用 showSaveFilePicker（支持自定义目录）
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "JSON 文件",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return { success: true };
      } catch (err) {
        if (err.name === "AbortError") return { success: false, aborted: true };
        return { success: false, error: err.message };
      }
    } else {
      // 回退：prompt 输入文件名后使用 a[download]
      const name = prompt(t("export-enter-filename"), suggestedName);
      if (!name) return { success: false, aborted: true };
      const fullName = name.endsWith(".json") ? name : name + ".json";
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fullName;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }
  }

  /**
   * 普通导出（包含当前连接矩阵）
   */
  async _export() {
    const data = this.appState.serialize();
    // 附加连接矩阵
    try {
      data.matrix = buildConnectionMatrix(
        this.appState.mechanisms,
        this.appState.connections
      );
    } catch (err) {
      console.warn("连接矩阵生成失败:", err);
    }
    const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
    const defaultName = `${t("export-suggested-name")}_${ts}.json`;

    try {
      const result = await this._saveJsonFile(data, defaultName);
      if (result.success) {
        this.notification.showSuccess(t("toast-export-success"));
      } else if (result.error) {
        this.notification.showError(
          t("toast-export-fail", { msg: result.error })
        );
      }
    } catch (err) {
      this.notification.showError(t("toast-export-fail", { msg: err.message }));
    }
  }

  /**
   * 自动排序后导出（先重编号，再生成排序后的连接矩阵）
   */
  async _exportSorted() {
    if (this.appState.mechanisms.length === 0) {
      this.notification.showWarning(t("conn-renumber-no-mech"), 1200);
      return;
    }

    try {
      // 执行重排序（会同时写入 history，可撤销）
      this.appState.renumber();
      this._safeRefreshTopology();
      if (this.matrixRenderer) this.matrixRenderer.refresh();
      this._refreshUI();

      // 生成排序后的矩阵
      const data = this.appState.serialize();
      try {
        data.matrix = buildConnectionMatrix(
          this.appState.mechanisms,
          this.appState.connections
        );
      } catch (err) {
        console.warn("连接矩阵生成失败:", err);
      }

      const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
      const defaultName = `${t("export-suggested-name")}_sorted_${ts}.json`;

      const result = await this._saveJsonFile(data, defaultName);
      if (result.success) {
        this.notification.showSuccess(
          t("toast-export-sorted", { count: this.appState.mechanisms.length })
        );
      } else if (result.error) {
        this.notification.showError(
          t("toast-export-fail", { msg: result.error })
        );
      }
    } catch (err) {
      this.notification.showError(t("toast-export-fail", { msg: err.message }));
    }
  }

  _onMultiToggle() {
    this.multiSelectEnabled = this.dom.multiCheckbox.checked;
    this.appState.clearConnectionSelection();
    this.appState.clearHighlights();
    this.appState.clearConnectionChainHighlight();
    this.appState.selectedPlaneData = null;
    this.appState.setActive(-1);
    this._updateMultiStatus();
    this.topologyRenderer.refresh(null);
    this._refreshUI();
  }

  // ==================== 撤销/重做 ====================

  _undo() {
    if (this.appState.undo()) {
      this._refreshUI();
      this._safeRefreshTopology();
    } else {
      this.notification.showWarning(t("no-undo"), 600);
    }
  }

  _redo() {
    if (this.appState.redo()) {
      this._refreshUI();
      this._safeRefreshTopology();
    } else {
      this.notification.showWarning(t("no-redo"), 600);
    }
  }

  // ==================== 导入导出 ====================

  async _import(e) {
    const file = this.dom.fileInput.files[0];
    if (!file) return;
    try {
      this._showLoading(t("loading-import"));
      const text = await file.text();
      this._updateLoading(40);
      const data = JSON.parse(text);
      this._updateLoading(80);

      // ✅ 支持新旧两种格式
      const isLegacy = Array.isArray(data.mechanisms);
      const isNew = Array.isArray(data.m);
      if (!isLegacy && !isNew) {
        throw new Error("Invalid structure");
      }

      this.appState.restore(data);
      this.appState._saveState();
      this._updateLoading(100);
      this.notification.showSuccess(
        t("toast-import-success", {
          count: this.appState.mechanisms.length,
          conn: this.appState.connections.length,
        })
      );
      if (this.appState.mechanisms.length) {
        this.sceneManager.controls.target.copy(
          this.appState.mechanisms[0].position
        );
        this.sceneManager.controls.update();
        this._syncUIFromCamera();
      }
      this.appState.applyConstraints();
      this.topologyRenderer.refresh(this.appState._topoHighlightId);
      this._refreshUI();
    } catch (err) {
      this.notification.showError(t("toast-import-fail") + ": " + err.message);
    } finally {
      this._hideLoading();
      this._refreshUI(); // 确保拓扑状态更新
      this.dom.fileInput.value = "";
    }
  }

  // ==================== 删除/清除/重命名 ====================

  _onDelete() {
    if (this.appState.activeIdx === -1) {
      this.notification.showWarning(t("no-selected-mech"), 600);
      return;
    }
    const id = this.appState.mechanisms[this.appState.activeIdx].id;
    this.appState.removeMechanism(this.appState.activeIdx, true);
    this.notification.showSuccess(t("toast-del-ok", { id }));
    this.topologyRenderer.refresh(this.appState._topoHighlightId);
    this._refreshUI();
  }

  _onClearAll() {
    if (confirm(t("confirm-clear-message"))) {
      this.appState.clearAll(true);
      this.notification.showSuccess(t("toast-clear-all"));
      this.topologyRenderer.refresh(null);
      this._refreshUI();
    }
  }

  _onRename() {
    if (this.appState.activeIdx === -1) return;
    const nid = parseInt(this.dom.renameId.value);
    if (!nid || nid < 1) {
      this.notification.showError(t("toast-id-pos"));
      return;
    }
    if (
      this.appState.mechanisms.some(
        (m, i) => i !== this.appState.activeIdx && m.id === nid
      )
    ) {
      this.notification.showError(t("toast-id-duplicate"));
      return;
    }
    this.appState.mechanisms[this.appState.activeIdx].id = nid;
    this.appState._markDirty();
    this.appState._saveState();
    this.notification.showSuccess(t("toast-id-updated", { id: nid }));
    this.topologyRenderer.refresh(this.appState._topoHighlightId);
    this._refreshUI();
  }

  // ==================== 机构列表 ====================
  _toggleMechList() {
    this.dom.mechPanel.classList.toggle("visible");
    this.dom.btnMechList.classList.toggle("active");
    if (this.dom.mechPanel.classList.contains("visible")) {
      this._refreshUI();
    }
  }

  // ==================== 隐藏UI ====================
  _toggleHideUI() {
    document.body.classList.toggle("hide-ui");
    this.dom.hideTrigger.textContent = document.body.classList.contains(
      "hide-ui"
    )
      ? "👁️‍🗨️"
      : "👁️";
  }

  // ==================== 截图 ====================
  _takeScreenshot() {
    const res = this.dom.screenshotRes.value;
    let w, h;
    switch (res) {
      case "window":
        w = window.innerWidth * window.devicePixelRatio;
        h = window.innerHeight * window.devicePixelRatio;
        break;
      case "720p":
        w = 1280;
        h = 720;
        break;
      case "1080p":
        w = 1920;
        h = 1080;
        break;
      case "4k":
        w = 3840;
        h = 2160;
        break;
      case "8k":
        w = 7680;
        h = 4320;
        break;
      default:
        w = parseInt(this.dom.screenshotCustomWidth.value) || 1920;
        h = parseInt(this.dom.screenshotCustomHeight.value) || 1080;
    }
    w = Math.min(8192, Math.max(1, w));
    h = Math.min(8192, Math.max(1, h));
    this._showLoading(t("screenshot-generating"));

    import("../renderer/Screenshot.js")
      .then(({ Screenshot }) => {
        this._ScreenshotClass = Screenshot; // 缓存类
        const screenshot = new Screenshot(this.sceneManager);
        screenshot
          .take({ width: w, height: h }, true)
          .then((url) => {
            // 生成文件名
            const ts = new Date()
              .toISOString()
              .slice(0, 19)
              .replace(/[:-]/g, "");
            const target = this.sceneManager.controls.target;
            const pos = this.sceneManager.camera.position;
            const dist = pos.distanceTo(target);
            const dir = new THREE.Vector3().subVectors(pos, target).normalize();
            const theta = Math.atan2(dir.y, dir.x);
            const thetaDeg = THREE.MathUtils.radToDeg(theta);
            const phi = Math.acos(dir.z);
            const phiDeg = THREE.MathUtils.radToDeg(phi);
            const fx = target.x.toFixed(2),
              fy = target.y.toFixed(2),
              fz = target.z.toFixed(2);
            const d = dist.toFixed(2),
              th = thetaDeg.toFixed(2),
              ph = phiDeg.toFixed(2);

            const filename = `screenshot_${ts}_${fx}_${fy}_${fz}_${d}_${th}_${ph}_${w}x${h}.png`;
            // 支持选择保存路径（系统另存为对话框；不支持的浏览器回退为下载）
            fetch(url)
              .then((r) => r.blob())
              .then((blob) =>
                this._saveBlob(blob, filename, {
                  description: "PNG 图片",
                  accept: { "image/png": [".png"] },
                })
              )
              .then((r) => {
                if (r.success) {
                  this.notification.showSuccess(
                    t("toast-screenshot", { width: w, height: h })
                  );
                } else if (r.error) {
                  this.notification.showError(r.error);
                }
              })
              .catch((err) => {
                this.notification.showError("截图保存失败: " + err.message);
              });
          })
          .catch((err) => {
            this.notification.showError("截图失败: " + err.message);
          })
          .finally(() => this._hideLoading());
      })
      .catch((err) => {
        this.notification.showError("截图模块加载失败: " + err.message);
        this._hideLoading();
      });
  }

  _onScreenshotResChange() {
    const show = this.dom.screenshotRes.value === "custom";
    this.dom.screenshotCustom.style.display = show ? "block" : "none";
    this.dom.screenshotCustom.classList.toggle("visible", show);
  }

  // ==================== 帮助 ====================
  _toggleHelp() {
    this.dom.helpPanel.classList.toggle("visible");
    if (this.dom.helpPanel.classList.contains("visible")) {
      this.dom.helpBody.textContent = t("help-body");
    }
  }

  // ==================== 动画 ====================
  _onAnimToggle() {
    this.animEnabled = this.dom.animCheckbox.checked;
    if (!this.animEnabled && this.appState.animState.active) {
      this.appState.animState.active = false;
    }
    this._updateAnimStatus();
  }

  _onAnimDurationChange() {
    let v = parseInt(this.dom.animDurationInput.value);
    if (isNaN(v) || v < 50) v = 50;
    if (v > 2000) v = 2000;
    this.dom.animDurationInput.value = v;
    this.animDuration = v;
  }

  _onAnimDurationReset() {
    this.dom.animDurationInput.value = 400;
    this.animDuration = 400;
    this.notification.showSuccess(t("anim-reset"));
  }

  // ==================== 拓扑图 ====================
  /** Ctrl+Shift+R：用户手动触发，任意模式下强制重绘 */
  _refreshTopology() {
    this.topologyRenderer.setEnabled(true);
    this.topologyRenderer.forceRefresh(this.appState._topoHighlightId);
    this.notification.showSuccess(t("topo-refreshed"), 1500);
  }

  _openTopoModal() {
    this.dom.topoModal.classList.add("visible");
    const modalCanvas = this.dom.topoModalCanvas;
    const srcCanvas = this.dom.topologyCanvas; // 缩略图 canvas
    if (!srcCanvas) return;

    // 获取模态框容器尺寸（用于显示）
    const rect = modalCanvas.parentElement.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;

    // 缩略图原始尺寸（像素）
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    if (srcW === 0 || srcH === 0) {
      // 若缩略图未绘制，显示提示信息
      const ctx = modalCanvas.getContext("2d");
      modalCanvas.width = containerW * 2;
      modalCanvas.height = containerH * 2;
      modalCanvas.style.width = containerW + "px";
      modalCanvas.style.height = containerH + "px";
      ctx.scale(2, 2);
      ctx.clearRect(0, 0, containerW, containerH);
      ctx.fillStyle = "#aaa";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t("topo-draw-disabled"), containerW / 2, containerH / 2);
      return;
    }

    // 计算缩放比例，保持宽高比，居中绘制
    const scaleX = containerW / srcW;
    const scaleY = containerH / srcH;
    const scale = Math.min(scaleX, scaleY);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const offsetX = (containerW - drawW) / 2;
    const offsetY = (containerH - drawH) / 2;

    // 设置模态框 canvas 尺寸（使用 2 倍清晰度，可提高质量）
    const dpr = 2; // 或 window.devicePixelRatio，但固定 2 保证清晰
    modalCanvas.width = containerW * dpr;
    modalCanvas.height = containerH * dpr;
    modalCanvas.style.width = containerW + "px";
    modalCanvas.style.height = containerH + "px";
    const ctx = modalCanvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerW, containerH);

    // 绘制缩略图内容（按比例缩放，居中）
    ctx.drawImage(srcCanvas, 0, 0, srcW, srcH, offsetX, offsetY, drawW, drawH);
  }

  _closeTopoModal() {
    this.dom.topoModal.classList.remove("visible");
  }

  async _saveTopoModal() {
    const canvas = this.dom.topoModalCanvas;
    if (!canvas) return;
    try {
      const blob = await this._canvasToPngBlob(canvas);
      const name = `topology_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.png`;
      const r = await this._saveBlob(blob, name, {
        description: "PNG 图片",
        accept: { "image/png": [".png"] },
      });
      if (r.success) this.notification.showSuccess(t("topo-save") + " ✓");
      else if (r.error) this.notification.showError(r.error);
    } catch (err) {
      this.notification.showError(err.message);
    }
  }

  async _saveTopo() {
    const canvas = this.dom.topologyCanvas;
    if (!canvas) return;
    try {
      const blob = await this._canvasToPngBlob(canvas);
      const name = `topology_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.png`;
      const r = await this._saveBlob(blob, name, {
        description: "PNG 图片",
        accept: { "image/png": [".png"] },
      });
      if (r.success) this.notification.showSuccess(t("topo-save") + " ✓");
      else if (r.error) this.notification.showError(r.error);
    } catch (err) {
      this.notification.showError(err.message);
    }
  }

  /**
   * 拓扑图安全刷新。
   * - 机构数 ≤ 界限（自动模式）：允许自动刷新（内部仍按 版本+高亮+主题 缓存键去重）
   * - 机构数 > 界限（手动模式）：跳过一切自动刷新，仅在 force=true（用户点击"刷新"控件）时重绘
   * @param {boolean} force - 用户手动触发（刷新按钮），手动模式下也强制执行
   */
  _safeRefreshTopology(force = false) {
    if (!force && !this.topoAutoUpdate) {
      // 手动模式：不自动更新，保留现有画面，等待用户点击刷新控件
      return;
    }
    // 缓存键命中时自动跳过（拓扑/高亮/主题变化会自动失效）
    this.topologyRenderer.refresh(this.appState._topoHighlightId);
  }

  // ==================== 网格 ====================
  _onGridSizeChange() {
    const size = Math.max(
      2,
      Math.min(200, parseInt(this.dom.gridSizeInput.value) || 50)
    );
    this.dom.gridSizeInput.value = size;
    this._updateGrid(size);

    // ========== 动态更新所有坐标输入框的 min/max ==========
    const limit = size / 2;
    const inputs = [
      { el: this.dom.posX, fallback: 0 },
      { el: this.dom.posY, fallback: 0 },
      { el: this.dom.posZ, fallback: 0 },
      { el: this.dom.genX, fallback: 0 },
      { el: this.dom.genY, fallback: 0 },
      { el: this.dom.genZ, fallback: 0 },
      { el: this.dom.focusX, fallback: 0.5 },
      { el: this.dom.focusY, fallback: 0.5 },
      { el: this.dom.focusZ, fallback: 0.5 },
    ];

    inputs.forEach(({ el, fallback }) => {
      if (!el) return;
      el.min = -limit;
      el.max = limit;
      // 若当前值超出新边界，自动裁剪
      let val = parseFloat(el.value);
      if (isNaN(val)) val = fallback;
      val = Math.max(-limit, Math.min(limit, val));
      el.value = val.toFixed(2);
    });
  }

  _updateGrid(size) {
    const scene = this.sceneManager.scene;
    if (this.sceneManager.gridHelper) {
      scene.remove(this.sceneManager.gridHelper);
    }
    const grid = new THREE.GridHelper(size, size, "#8899aa", "#3a4a5c");
    grid.rotation.x = -Math.PI / 2;
    grid.position.z = 0;
    scene.add(grid);
    this.sceneManager.gridHelper = grid;
    if (this.sceneManager.refPlane) {
      this.sceneManager.refPlane.scale.set(size / 50, size / 50, 1);
    }
  }

  // ==================== 步进按钮 ====================
  _bindStepButtons() {
    const configs = [
      {
        id: "gx",
        target: this.dom.genX,
        delta: 0.5,
        handler: () => this._updatePreview(),
      },
      {
        id: "gy",
        target: this.dom.genY,
        delta: 0.5,
        handler: () => this._updatePreview(),
      },
      {
        id: "gz",
        target: this.dom.genZ,
        delta: 0.5,
        handler: () => this._updatePreview(),
      },
      {
        id: "tx",
        target: this.dom.posX,
        delta: 0.5,
        handler: () => this._applyTransform(),
      },
      {
        id: "ty",
        target: this.dom.posY,
        delta: 0.5,
        handler: () => this._applyTransform(),
      },
      {
        id: "tz",
        target: this.dom.posZ,
        delta: 0.5,
        handler: () => this._applyTransform(),
      },
      {
        id: "l1",
        target: this.dom.l1Angle,
        delta: 90,
        handler: () => this._applyTransform(),
      },
      {
        id: "l2",
        target: this.dom.l2Angle,
        delta: 90,
        handler: () => this._applyTransform(),
      },
      {
        id: "fx",
        target: this.dom.focusX,
        delta: 0.5,
        handler: () => this._applyFocus(),
      },
      {
        id: "fy",
        target: this.dom.focusY,
        delta: 0.5,
        handler: () => this._applyFocus(),
      },
      {
        id: "fz",
        target: this.dom.focusZ,
        delta: 0.5,
        handler: () => this._applyFocus(),
      },
      {
        id: "cam-dist",
        target: this.dom.camDistance,
        delta: 10,
        handler: () => this._applyCamera(),
      },
      {
        id: "cam-theta",
        target: this.dom.camTheta,
        delta: 15,
        handler: () => this._applyCamera(),
      },
      {
        id: "cam-phi",
        target: this.dom.camPhi,
        delta: 15,
        handler: () => this._applyCamera(),
      },
    ];
    configs.forEach(({ id, target, delta, handler }) => {
      const inc = document.getElementById(`${id}-inc`);
      const dec = document.getElementById(`${id}-dec`);
      if (inc)
        this._bind(inc, "click", () => this._stepInput(target, delta, handler));
      if (dec)
        this._bind(dec, "click", () =>
          this._stepInput(target, -delta, handler)
        );
    });
  }

  _stepInput(el, delta, handler) {
    let val = parseFloat(el.value) + delta;
    const isAngle =
      el.id.includes("angle") ||
      el.id.includes("rot") ||
      el.id.includes("cam-theta") ||
      el.id.includes("cam-phi");
    if (isAngle) {
      val = normalizeAngleDeg(val);
      el.value = val.toFixed(2);
    } else {
      val = Math.round(val * 2) / 2;
      const min = parseFloat(el.min),
        max = parseFloat(el.max);
      if (!isNaN(min) && val < min) val = min;
      if (!isNaN(max) && val > max) val = max;
      el.value = val.toFixed(2);
    }
    if (handler) handler();
  }

  // ==================== 旋转按钮（世界轴 + L初始角度） ====================
  _bindRotationButtons() {
    // 生成面板世界旋转
    const genAxes = [
      { id: "grx", axis: [1, 0, 0] },
      { id: "gry", axis: [0, 1, 0] },
      { id: "grz", axis: [0, 0, 1] },
    ];
    genAxes.forEach(({ id, axis }) => {
      ["inc", "dec"].forEach((dir) => {
        const btn = document.getElementById(`${id}-${dir}`);
        if (btn) {
          const delta = dir === "inc" ? 90 : -90;
          this._bind(btn, "click", () => this._applyGenWorldAxis(axis, delta));
        }
      });
    });

    // L1/L2 初始角度
    ["ga1", "ga2"].forEach((id) => {
      ["inc", "dec"].forEach((dir) => {
        const btn = document.getElementById(`${id}-${dir}`);
        if (btn) {
          const delta = dir === "inc" ? 90 : -90;
          this._bind(btn, "click", () => {
            const input = id === "ga1" ? this.dom.genA1 : this.dom.genA2;
            let v = normalizeAngleDeg(parseFloat(input.value) + delta);
            input.value = v.toFixed(2);
            this._updatePreview();
          });
        }
      });
    });

    // 操作面板世界旋转
    const opAxes = [
      { id: "rx", axis: [1, 0, 0] },
      { id: "ry", axis: [0, 1, 0] },
      { id: "rz", axis: [0, 0, 1] },
    ];
    opAxes.forEach(({ id, axis }) => {
      ["inc", "dec"].forEach((dir) => {
        const btn = document.getElementById(`${id}-${dir}`);
        if (btn) {
          const delta = dir === "inc" ? 90 : -90;
          this._bind(btn, "click", () => this._applyWorldAxis(axis, delta));
        }
      });
    });
  }

  // ==================== 输入框事件 ====================
  _bindInputs() {
    // 生成面板坐标（实时预览）
    [this.dom.genX, this.dom.genY, this.dom.genZ].forEach((el) => {
      el.addEventListener("input", () => this._updatePreview());
      el.addEventListener("change", () => this._updatePreview());
    });
    this.dom.genCubeSize.addEventListener("input", () => {
      let v = parseInt(this.dom.genCubeSize.value);
      if (isNaN(v) || v < 1) v = 1;
      if (v > 128) v = 128;
      this.dom.genCubeSize.value = v;
      this._updateGenDisplay();
      this._updatePreview();
    });
    this.dom.genThick.addEventListener("input", () => {
      this._updateGenDisplay();
      this._updatePreview();
    });
    [this.dom.genRx, this.dom.genRy, this.dom.genRz].forEach((el) => {
      el.addEventListener("change", () => {
        el.value = normalizeAngleDeg(parseFloat(el.value)).toFixed(2);
        this._syncGenQuat();
        this._updatePreview();
      });
    });
    [this.dom.genA1, this.dom.genA2].forEach((el) => {
      el.addEventListener("change", () => {
        el.value = normalizeAngleDeg(parseFloat(el.value)).toFixed(2);
        this._updatePreview();
      });
    });

    // 操作面板变换
    [
      this.dom.posX,
      this.dom.posY,
      this.dom.posZ,
      this.dom.l1Angle,
      this.dom.l2Angle,
    ].forEach((el) => {
      el.addEventListener("change", () => this._applyTransform());
      el.addEventListener("blur", () => this._applyTransform());
    });
    [this.dom.rotX, this.dom.rotY, this.dom.rotZ].forEach((el) => {
      el.addEventListener("change", () => {
        if (this.appState.activeIdx !== -1) {
          el.value = normalizeAngleDeg(parseFloat(el.value)).toFixed(2);
          this._applyAbsoluteRotation();
        }
      });
      el.addEventListener("blur", () => {
        if (this.appState.activeIdx !== -1) {
          el.value = normalizeAngleDeg(parseFloat(el.value)).toFixed(2);
          this._applyAbsoluteRotation();
        }
      });
    });
  }

  // ==================== 场景点击（射线检测） ====================
  _setupRaycaster() {
    const container = this.sceneManager.container;
    let pDownX = 0;
    let pDownY = 0;
    let isDrag = false;

    container.addEventListener("pointerdown", (e) => {
      pDownX = e.clientX;
      pDownY = e.clientY;
      isDrag = false;
    });

    container.addEventListener("pointerup", (e) => {
      const dx = e.clientX - pDownX;
      const dy = e.clientY - pDownY;
      if (Math.sqrt(dx * dx + dy * dy) > 5) isDrag = true;
    });

    container.addEventListener("click", (e) => {
      if (isDrag) {
        isDrag = false;
        return;
      }
      if (this.dom.helpPanel.classList.contains("visible")) {
        this.dom.helpPanel.classList.remove("visible");
        return;
      }
      if (document.body.classList.contains("hide-ui")) {
        document.body.classList.remove("hide-ui");
        this.dom.hideTrigger.textContent = "👁️";
        return;
      }
      if (e.target.closest(".panel") || e.target.closest("button")) return;

      const hit = this._getIntersect(e);

      // ============ 空白点击：清空所有选中 ============
      if (!hit) {
        this.appState.clearHighlights();
        this.appState.clearConnectionSelection();
        this.appState.clearConnectionChainHighlight();
        this.appState.selectedPlaneData = null;
        this.appState.setActive(-1);
        this._refreshUI();
        try {
          this.topologyRenderer.refresh(null);
        } catch (_) {}
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey || this.multiSelectEnabled;

      // ============ 基准平面分支（mechanismIndex === -1） ============
      if (hit.mechanismIndex === -1) {
        this.appState.clearHighlights();
        this.appState.clearConnectionChainHighlight();

        if (ctrl) {
          // 多选模式：作为连接对象 A 或 B 参与高亮
          this.appState.handleConnectionSelect(hit);
        } else {
          // 单选：清空连接选择
          this.appState.clearConnectionSelection();
        }

        // 关键：设置选中平面为基准平面，activeIdx = -1
        this.appState.selectedPlaneData = hit;
        this.appState.activeIdx = -1;
        this.appState._topoHighlightId = null;
        this.appState._topoVersion++;
        this.appState._markDirty();

        // 先刷新 UI，再刷新拓扑（防止拓扑异常阻断 UI）
        this._refreshUI();
        try {
          this.topologyRenderer.refresh(null);
        } catch (_) {}
        return;
      }

      // ============ 机构平面分支 ============
      if (ctrl) {
        // 多选：切换连接 A/B 高亮；同时同步当前激活机构与选中平面
        this.appState.clearHighlights();
        this.appState.clearConnectionChainHighlight();

        this.appState.activeIdx = hit.mechanismIndex;
        this.appState.selectedPlaneData = hit;
        this.appState._topoHighlightId =
          this.appState.mechanisms[hit.mechanismIndex].id;
        this.appState._topoVersion++;
        this.appState._markDirty();

        this.appState.handleConnectionSelect(hit);

        this._refreshUI();
        if (this.matrixRenderer) this.matrixRenderer.refresh();
        try {
          this.topologyRenderer.refresh(this.appState._topoHighlightId);
        } catch (_) {}
      } else {
        // 单选：高亮连接链
        this.appState.clearConnectionSelection();
        this.appState.highlightConnectionChain(hit);

        const idx = hit.mechanismIndex;
        const chainL1 = this.appState.getConnectionChain(idx, "L1");
        const chainL2 = this.appState.getConnectionChain(idx, "L2");
        this.dom.chainInfoL1.innerHTML = `<span class="highlight-text">${this._formatChainInfo(
          chainL1
        )}</span>`;
        this.dom.chainInfoL2.innerHTML = `<span class="highlight-text">${this._formatChainInfo(
          chainL2
        )}</span>`;

        this._refreshUI();
        if (this.matrixRenderer) this.matrixRenderer.refresh();
        try {
          this.topologyRenderer.refresh(this.appState._topoHighlightId);
        } catch (_) {}
      }
    });
  }

  _getIntersect(e) {
    const container = this.sceneManager.container;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.sceneManager.camera);

    // 收集所有机构平面
    const targets = [];
    this.appState.mechanisms.forEach((m, mi) => {
      if (m.group && m.group.userData.allPlanes) {
        m.group.userData.allPlanes.forEach((p) => {
          targets.push({ ...p, mechanismIndex: mi });
        });
      }
    });
    const meshes = targets
      .map((t) => t.mesh)
      .filter((m) => m && !m.userData.isPreview);

    const basePlane = this.sceneManager.refPlane;

    // 分别 raycast，取得命中距离
    const mechHits = raycaster.intersectObjects(meshes);
    const baseHits = basePlane ? raycaster.intersectObject(basePlane) : [];
    const mechDist = mechHits.length > 0 ? mechHits[0].distance : Infinity;
    const baseDist = baseHits.length > 0 ? baseHits[0].distance : Infinity;

    // 机构优先：只要机构平面可用，且不比基准平面远超过 0.05（容差覆盖初始机构底面与 z=0 重合的浮点误差）
    const mechUsable =
      mechHits.length > 0 &&
      !mechHits[0].object.userData.isPreview &&
      (baseHits.length === 0 || mechDist <= baseDist + 0.05);

    if (mechUsable) {
      const obj = mechHits[0].object;
      const found = targets.find((t) => t.mesh === obj);
      if (found) {
        const idx = obj.userData.planeIndex;
        if (idx) found.planeIndex = idx;
        return found;
      }
    }

    // 基准平面命中
    if (baseHits.length > 0) {
      return {
        mesh: basePlane,
        planeIndex: 1,
        mechanismIndex: -1,
        isBasePlane: true,
      };
    }

    return null;
  }

  // ==================== 键盘快捷键 ====================
  _setupKeyboard() {
    document.addEventListener("keydown", (e) => {
      const isInput =
        e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase(); // 统一小写，避免 CapsLock/Shift 导致匹配失败
      if (isInput) {
        if (e.key === "Delete" || e.key === "Backspace") return;
        // 输入框内 Ctrl+Z/Y 交给浏览器原生撤销
        if (mod && (key === "z" || key === "y")) return;
      }
      // 重做：Ctrl+Y 或 Ctrl+Shift+Z
      if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        this._redo();
        return;
      }
      // 撤销：Ctrl+Z
      if (mod && key === "z") {
        e.preventDefault();
        this._undo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
        e.preventDefault();
        this._onDelete();
        return;
      }
      if (mod && key === "s" && !e.shiftKey) {
        e.preventDefault();
        this._export();
        return;
      }
      if (mod && key === "o" && !e.shiftKey) {
        e.preventDefault();
        this.dom.fileInput.click();
        return;
      }
      if (mod && e.shiftKey && key === "e") {
        e.preventDefault();
        this._takeScreenshot();
        return;
      }
      if (mod && !e.shiftKey && e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        const panels = ["ui", "gen", "op", "conn"];
        const idx = parseInt(e.key) - 1;
        if (panels[idx]) this._showPanel(panels[idx]);
        return;
      }
      if (mod && key === "l" && !e.shiftKey) {
        e.preventDefault();
        this._toggleMechList();
        return;
      }
      if (mod && key === "h" && !e.shiftKey) {
        e.preventDefault();
        this._toggleHideUI();
        return;
      }
      if (mod && key === "c" && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        if (this.appState.selectedConnA && this.appState.selectedConnB) {
          this._onConnect();
        } else {
          this.notification.showWarning(t("shortcut-no-planes"), 1000);
        }
        return;
      }
      if (mod && e.shiftKey && key === "r") {
        e.preventDefault();
        this._refreshTopology();
        return;
      }
      // 帮助：? 或 /（"?" 在大多数键盘布局上需要按 Shift，因此不限制 shift）
      if (
        (e.key === "?" || (e.key === "/" && !e.shiftKey)) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        this._toggleHelp();
        return;
      }
    });
  }

  // ==================== UI 刷新（含拓扑自动/手动） ====================

  _refreshUI() {
    const count = this.appState.mechanisms.length;
    if (count !== this._lastMechCount) {
      this._lastMechCount = count;
      this._updateTopoMode();
    }
    this._updateMechList();
    this._updateOpPanel();
    this._updateConnectionList();
    this._updateUndoRedo();
    this._updateStatusDisplays();
    this._updateCameraDisplay();
    this._updateConnectionSelection();
    //this._updateTopoMode();

    this.appState.updateAllFrames();

    // ---- 刷新拓扑图（TopologyRenderer 内部按 版本+高亮+主题 缓存，未变化自动跳过）----
    if (this.topologyRenderer.enabled) {
      this._safeRefreshTopology();
    }
    this.dom.btnMechList.textContent =
      t("list-title") + (count ? ` (${count})` : "");
    // 同步刷新连接矩阵
    this._updateConnectionMatrix();
  }

  /**
   * 拓扑刷新模式：机构数 ≤ 界限自动刷新（随增减/选中更新），超过则仅手动刷新。
   * 切换为手动时保留现有画面；切换回自动时立即恢复自动刷新。同步状态显示。
   */
  _updateTopoMode() {
    const auto = this._topoAutoAllowed();
    if (this.topoAutoUpdate !== auto) {
      this.topoAutoUpdate = auto;
    }
    // 同步渲染器层的自动刷新闸门（拦截所有绕过 _safeRefreshTopology 的 refresh 调用）
    this.topologyRenderer.autoRefresh = auto;
    this._updateTopoStatusDisplay();
    this._safeRefreshTopology();
  }

  _topoAutoAllowed() {
    return this.appState.mechanisms.length <= this.topoAutoMax;
  }

  _updateTopoStatusDisplay() {
    const auto = this._topoAutoAllowed();
    const el = this.dom.topoStatusDisplay;
    if (el) {
      // 状态徽标附当前界限值，便于确认输入框生效
      el.textContent = `${auto ? t("topo-status-auto") : t("topo-status-manual")} · ≤${this.topoAutoMax}`;
      el.style.color = auto ? "var(--success)" : "var(--highlight)";
    }
    // 同步界限输入框
    if (this.dom.topoAutoMaxInput) {
      this.dom.topoAutoMaxInput.value = this.topoAutoMax;
    }
  }

  /** 界限输入框：实时调整自动绘制数量界限 */
  _onTopoAutoMaxChange() {
    const input = this.dom.topoAutoMaxInput;
    if (!input) return;
    let v = parseInt(input.value, 10);
    if (isNaN(v)) v = TOPO_AUTO_MAX;
    v = Math.max(1, Math.min(200, v));
    input.value = v;
    if (v !== this.topoAutoMax) {
      this.topoAutoMax = v;
      this._updateTopoMode(); // 可能跨越自动/手动边界，立即生效
    }
  }

  // ==================== 机构列表 ====================
  /**
   * 双环锁定标记缓存：仅随拓扑版本重算（每次 O(N·E) 的 DFS 不再随刷新频率执行）
   */
  _getLoopLockFlags() {
    const v = this.appState._topoVersion;
    if (this._loopFlags && this._loopFlags.version === v) {
      return this._loopFlags.flags;
    }
    const flags = this.appState.mechanisms.map((_, idx) =>
      this.appState.isInBothLoops(idx)
    );
    this._loopFlags = { version: v, flags };
    return flags;
  }

  _updateMechList() {
    const container = this.dom.mechPanelContent;
    const mechs = this.appState.mechanisms;
    if (mechs.length === 0) {
      container.innerHTML = `<div class="mech-empty">${t("list-empty")}</div>`;
      container.onclick = null;
      this._mechListSig = null;
      this._mechListItems = null;
      return;
    }
    // 计算每个机构的连接数
    const connCounts = new Map();
    for (const c of this.appState.connections) {
      const a = c.planeA.mechanismIndex,
        b = c.planeB.mechanismIndex;
      connCounts.set(a, (connCounts.get(a) || 0) + 1);
      connCounts.set(b, (connCounts.get(b) || 0) + 1);
    }
    const lockFlags = this._getLoopLockFlags();

    // 结构签名：语言 + 激活项 + 每机构 id/连接数/双环锁；变化才重建 DOM
    const sigParts = [getLang(), this.appState.activeIdx];
    mechs.forEach((m, idx) => {
      sigParts.push(m.id, connCounts.get(idx) || 0, lockFlags[idx] ? 1 : 0);
    });
    const sig = sigParts.join("|");

    if (sig !== this._mechListSig || !this._mechListItems) {
      this._mechListSig = sig;
      const frag = document.createDocumentFragment();
      this._mechListItems = new Map();
      mechs.forEach((m, idx) => {
        const div = document.createElement("div");
        div.className = `mech-item ${
          idx === this.appState.activeIdx ? "active" : ""
        }`;
        div.dataset.idx = idx;
        const cc = connCounts.get(idx) || 0;
        const badge =
          cc > 0 ? `<span class="mech-conn-badge">🔗${cc}</span>` : "";
        const lock = lockFlags[idx] ? " 🔒" : "";
        div.innerHTML = `
          <div class="mech-id">#${m.id} ${badge}${lock}</div>
          <div class="mech-detail">
            <span class="label">${t("list-pos")}</span>
            <span class="value mech-v-pos"></span>
            <span class="label">${t("list-rot")}</span>
            <span class="value mech-v-rot"></span>
            <span class="label">${t("list-l-angle")}</span>
            <span class="value mech-v-langle"></span>
            <span class="label">${t("list-normal-dir")}</span>
            <span class="value highlight mech-v-normal"></span>
            <span class="label">${t("list-normal-start")}</span>
            <span class="value mech-v-nstart"></span>
          </div>
        `;
        this._mechListItems.set(idx, {
          pos: div.querySelector(".mech-v-pos"),
          rot: div.querySelector(".mech-v-rot"),
          langle: div.querySelector(".mech-v-langle"),
          normal: div.querySelector(".mech-v-normal"),
          nstart: div.querySelector(".mech-v-nstart"),
        });
        frag.appendChild(div);
      });
      container.innerHTML = "";
      container.appendChild(frag);
      container.onclick = (e) => {
        const item = e.target.closest(".mech-item");
        if (item) {
          const idx = parseInt(item.dataset.idx, 10);
          // 设置激活索引
          this.appState.setActive(idx);
          // 立即刷新 UI（包括连接列表、操作面板等）
          this._refreshUI();
        }
      };
    }

    // 数值就地更新（坐标/旋转/角度/法向随动画逐帧刷新，但不重建 DOM）
    mechs.forEach((m, idx) => {
      const refs = this._mechListItems.get(idx);
      if (!refs) return;
      const euler = new THREE.Euler().setFromQuaternion(
        m.group.quaternion,
        "XYZ"
      );
      const rx = normalizeAngleDeg(THREE.MathUtils.radToDeg(euler.x));
      const ry = normalizeAngleDeg(THREE.MathUtils.radToDeg(euler.y));
      const rz = normalizeAngleDeg(THREE.MathUtils.radToDeg(euler.z));
      refs.pos.textContent = `(${m.position.x.toFixed(2)}, ${m.position.y.toFixed(2)}, ${m.position.z.toFixed(2)})`;
      refs.rot.textContent = `X=${rx.toFixed(2)}° Y=${ry.toFixed(2)}° Z=${rz.toFixed(2)}°`;
      refs.langle.textContent = `${m.l1Angle.toFixed(2)}° / ${m.l2Angle.toFixed(2)}°`;
      refs.normal.textContent = `(${m.normal.x.toFixed(3)}, ${m.normal.y.toFixed(3)}, ${m.normal.z.toFixed(3)})`;
      refs.nstart.textContent = `(${m.position.x.toFixed(2)}, ${m.position.y.toFixed(2)}, ${m.position.z.toFixed(2)})`;
    });
  }

  /**
   * 获取与基准平面连接时被锁定的 L 零件信息
   */
  _getBasePlaneLockInfo(idx) {
    if (idx < 0 || idx >= this.appState.mechanisms.length) return null;
    let lockL1 = false;
    let lockL2 = false;
    let found = false;
    for (const c of this.appState.connections) {
      const a = c.planeA.mechanismIndex;
      const b = c.planeB.mechanismIndex;
      let connPlaneIdx = null;
      if (a === -1 && b === idx) connPlaneIdx = c.planeB.planeIndex;
      else if (b === -1 && a === idx) connPlaneIdx = c.planeA.planeIndex;
      if (connPlaneIdx !== null) {
        found = true;
        if (connPlaneIdx === 1 || connPlaneIdx === 2) lockL1 = true;
        if (connPlaneIdx === 3 || connPlaneIdx === 4) lockL2 = true;
      }
    }
    return found ? { lockL1, lockL2 } : null;
  }

  /**
   * 判断某机构的指定 L 分支链条上是否存在与基准平面直连的模块
   * - 自身：只检查该分支对应的平面（L1 → P1/P2，L2 → P3/P4）
   * - 链上其他机构：检查任意平面上的基准平面连接
   */
  _chainHasBasePlaneConnection(idx, branch) {
    if (idx < 0 || idx >= this.appState.mechanisms.length) return false;

    // ① 自身：按分支过滤
    const branchPlanes = branch === "L1" ? [1, 2] : [3, 4];
    for (const c of this.appState.connections) {
      const a = c.planeA.mechanismIndex;
      const b = c.planeB.mechanismIndex;
      let planeIdx = null;
      if (a === -1 && b === idx) planeIdx = c.planeB.planeIndex;
      else if (b === -1 && a === idx) planeIdx = c.planeA.planeIndex;
      if (planeIdx !== null && branchPlanes.includes(planeIdx)) return true;
    }

    // ② 链上其他机构：任意基准平面连接都算
    const chain = this.appState.getConnectionChain(idx, branch);
    for (const mi of chain.collectedMechIndices) {
      if (mi === idx) continue;
      if (this._getBasePlaneLockInfo(mi)) return true;
    }
    return false;
  }

  // ==================== 操作面板 ====================
  _updateOpPanel() {
    const active = this.appState.activeIdx;
    const valid = active !== -1 && active < this.appState.mechanisms.length;
    const mech = valid ? this.appState.mechanisms[active] : null;
    const selPlane = this.appState.selectedPlaneData;

    // ============ 情况 1：没有有效机构，但选中了基准平面 ============
    if (!valid && selPlane && selPlane.mechanismIndex === -1) {
      [
        this.dom.renameId,
        this.dom.posX,
        this.dom.posY,
        this.dom.posZ,
        this.dom.rotX,
        this.dom.rotY,
        this.dom.rotZ,
        this.dom.l1Angle,
        this.dom.l2Angle,
      ].forEach((el) => (el.disabled = true));
      this.dom.btnRename.disabled = true;
      this.dom.btnDelete.disabled = true;

      ["tx", "ty", "tz", "rx", "ry", "rz", "l1", "l2"].forEach((id) => {
        const inc = document.getElementById(`${id}-inc`);
        const dec = document.getElementById(`${id}-dec`);
        if (inc) inc.disabled = true;
        if (dec) dec.disabled = true;
      });

      this.dom.selMechId.textContent = "0";
      this.dom.selPos.textContent = "(0.00, 0.00, 0.00)";
      this.dom.selNormalDir.textContent = "(0.000, 0.000, 1.000)";
      this.dom.selNormalStart.textContent = "(0, 0, 0)";
      this.dom.selPlane.innerHTML = `<span class="highlight-badge">N0-P${selPlane.planeIndex}</span>`;
      this.dom.selPlaneCenter.textContent = "(0.000, 0.000, 0.000)";
      this.dom.renameId.value = "";

      const labelEl = document.querySelector(
        "#op-panel .section:last-child .section-label"
      );
      if (labelEl) {
        delete labelEl.dataset.locked;
        labelEl.textContent = t("op-l-rot");
      }
      return;
    }

    // ============ 情况 2：没有有效机构，也没选中基准平面 ============
    if (!valid) {
      [
        this.dom.renameId,
        this.dom.posX,
        this.dom.posY,
        this.dom.posZ,
        this.dom.rotX,
        this.dom.rotY,
        this.dom.rotZ,
        this.dom.l1Angle,
        this.dom.l2Angle,
      ].forEach((el) => (el.disabled = true));
      this.dom.btnRename.disabled = true;
      this.dom.btnDelete.disabled = true;

      ["tx", "ty", "tz", "rx", "ry", "rz", "l1", "l2"].forEach((id) => {
        const inc = document.getElementById(`${id}-inc`);
        const dec = document.getElementById(`${id}-dec`);
        if (inc) inc.disabled = true;
        if (dec) dec.disabled = true;
      });

      this.dom.selMechId.textContent = "-";
      this.dom.selPos.textContent = "(0.00, 0.00, 0.00)";
      this.dom.selNormalDir.textContent = "(0.000, 0.000, 0.000)";
      this.dom.selNormalStart.textContent = "-";
      this.dom.selPlane.textContent = t("op-sel-none");
      this.dom.selPlaneCenter.textContent = "-";

      const labelEl = document.querySelector(
        "#op-panel .section:last-child .section-label"
      );
      if (labelEl) {
        delete labelEl.dataset.locked;
        labelEl.textContent = t("op-l-rot");
      }
      return;
    }

    // ============ 情况 3：有有效机构（机构优先） ============
    // ---- 锁定判定 ----
    const inBoth = this.appState.isInBothLoops(active);

    // 链条级：L1/L2 链上是否有机构（含自身）与基准平面直连
    const l1ChainHasBase = this._chainHasBasePlaneConnection(active, "L1");
    const l2ChainHasBase = this._chainHasBasePlaneConnection(active, "L2");

    // 整体平移/旋转：两条链任一有基准平面连接 → 锁定
    const lockPosRot = l1ChainHasBase || l2ChainHasBase;

    // 单 L 旋转：分链判断 + 双环
    const lockL1 = inBoth || l1ChainHasBase;
    const lockL2 = inBoth || l2ChainHasBase;

    // ---- 应用启用/禁用 ----
    this.dom.renameId.disabled = false;
    this.dom.posX.disabled = lockPosRot;
    this.dom.posY.disabled = lockPosRot;
    this.dom.posZ.disabled = lockPosRot;
    this.dom.rotX.disabled = lockPosRot;
    this.dom.rotY.disabled = lockPosRot;
    this.dom.rotZ.disabled = lockPosRot;
    this.dom.l1Angle.disabled = lockL1;
    this.dom.l2Angle.disabled = lockL2;
    this.dom.btnRename.disabled = false;
    this.dom.btnDelete.disabled = false;

    // ---- 步进按钮同步 ----
    [
      ["tx", lockPosRot],
      ["ty", lockPosRot],
      ["tz", lockPosRot],
      ["rx", lockPosRot],
      ["ry", lockPosRot],
      ["rz", lockPosRot],
      ["l1", lockL1],
      ["l2", lockL2],
    ].forEach(([id, locked]) => {
      const inc = document.getElementById(`${id}-inc`);
      const dec = document.getElementById(`${id}-dec`);
      if (inc) inc.disabled = locked;
      if (dec) dec.disabled = locked;
    });

    // ---- 填充机构数据（动画进行中跳过输入框回写，避免每帧打断用户输入）----
    if (!this.appState.animState.active) {
      this.dom.renameId.value = mech.id;
      this.dom.posX.value = mech.position.x.toFixed(2);
      this.dom.posY.value = mech.position.y.toFixed(2);
      this.dom.posZ.value = mech.position.z.toFixed(2);

      const euler = new THREE.Euler().setFromQuaternion(
        mech.group.quaternion,
        "XYZ"
      );
      this.dom.rotX.value = normalizeAngleDeg(
        THREE.MathUtils.radToDeg(euler.x)
      ).toFixed(2);
      this.dom.rotY.value = normalizeAngleDeg(
        THREE.MathUtils.radToDeg(euler.y)
      ).toFixed(2);
      this.dom.rotZ.value = normalizeAngleDeg(
        THREE.MathUtils.radToDeg(euler.z)
      ).toFixed(2);
      this.dom.l1Angle.value = mech.l1Angle.toFixed(2);
      this.dom.l2Angle.value = mech.l2Angle.toFixed(2);
    }

    // ---- 显示信息 ----
    this.dom.selMechId.textContent = mech.id;
    this.dom.selPos.textContent = `(${mech.position.x.toFixed(
      2
    )}, ${mech.position.y.toFixed(2)}, ${mech.position.z.toFixed(2)})`;
    const normal = mech.normal;
    this.dom.selNormalDir.textContent = `(${normal.x.toFixed(
      3
    )}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`;

    // ---- 选中平面（仅当平面属于当前机构时） ----
    const selBelongsToActive =
      selPlane &&
      selPlane.mechanismIndex !== -1 &&
      selPlane.mechanismIndex === active;
    if (selBelongsToActive) {
      const pi = selPlane.planeIndex;
      this.dom.selPlane.innerHTML = `<span class="highlight-badge">P${pi}</span>`;
      const center = getPlaneWorldCenter(mech, pi);
      this.dom.selPlaneCenter.textContent = `(${center.x.toFixed(
        3
      )}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`;
    } else {
      this.dom.selPlane.textContent = t("op-sel-none");
      this.dom.selPlaneCenter.textContent = "-";
    }

    // ---- 连接链显示 ----
    if (selBelongsToActive) {
      const branch = selPlane.planeIndex <= 2 ? "L1" : "L2";
      const chain = this.appState.getConnectionChain(active, branch);
      if (chain.collectedPlanes.length) {
        const info = chain.collectedPlanes
          .map((p) => {
            if (p.mechIdx === -1) return `N0-P${p.planeIdx}`;
            const m = this.appState.mechanisms[p.mechIdx];
            return `N${m ? m.id : "?"}-P${p.planeIdx}`;
          })
          .join(" → ");
        if (branch === "L1") {
          this.dom.chainInfoL1.innerHTML = `<span class="highlight-text">${info}</span>`;
        } else {
          this.dom.chainInfoL2.innerHTML = `<span class="highlight-text">${info}</span>`;
        }
      }
    }

    // ---- 锁定提示 ----
    const msgs = [];
    if (inBoth) msgs.push(t("lock-msg"));
    if (lockPosRot) msgs.push(t("lock-msg-self-base"));
    if (l1ChainHasBase && !inBoth) msgs.push(t("lock-msg-chain-l1"));
    if (l2ChainHasBase && !inBoth) msgs.push(t("lock-msg-chain-l2"));

    const labelEl = document.querySelector(
      "#op-panel .section:last-child .section-label"
    );
    if (labelEl) {
      const base = t("op-l-rot");
      if (msgs.length) {
        labelEl.dataset.locked = "true";
        labelEl.innerHTML =
          base +
          ` <span style="color:var(--danger);font-size:11px;">${msgs.join(
            " "
          )}</span>`;
      } else {
        delete labelEl.dataset.locked;
        labelEl.textContent = base;
      }
    }
  }

  // ==================== 连接列表（含高亮） ====================
  _updateConnectionList() {
    const list = this.dom.connListDiv;
    const conns = this.appState.connections;

    // ========== 计算需要高亮的连接 ID ==========
    const highlightedIds = new Set();
    const selPlane = this.appState.selectedPlaneData; // 若为空，则说明无平面选中

    if (selPlane) {
      // 若选中具体平面，则只高亮包含该平面的连接
      const { mechanismIndex, planeIndex } = selPlane;
      for (const c of conns) {
        if (
          (c.planeA.mechanismIndex === mechanismIndex &&
            c.planeA.planeIndex === planeIndex) ||
          (c.planeB.mechanismIndex === mechanismIndex &&
            c.planeB.planeIndex === planeIndex)
        ) {
          highlightedIds.add(c.id);
        }
      }
    } else {
      // 否则，根据当前激活的机构高亮所有关联连接
      const activeIdx = this.appState.activeIdx;
      if (activeIdx !== -1 && activeIdx < this.appState.mechanisms.length) {
        for (const c of conns) {
          if (
            c.planeA.mechanismIndex === activeIdx ||
            c.planeB.mechanismIndex === activeIdx
          ) {
            highlightedIds.add(c.id);
          }
        }
      }
    }
    // 列表反选（highlightConnectionById）显式标记的连接也保持高亮
    for (const id of this.appState.highlightedConnectionIds) {
      highlightedIds.add(id);
    }

    // ========== 渲染连接列表 ==========
    if (conns.length === 0) {
      list.innerHTML = `<div class="conn-empty" style="grid-column:1/-1;">${t(
        "conn-list-empty"
      )}</div>`;
      // 移除旧的删除事件监听（避免重复）
      if (this._connListHandler) {
        list.removeEventListener("click", this._connListHandler);
        this._connListHandler = null;
      }
      return;
    }

    // 生成 HTML
    const html = conns
      .map((c) => {
        // ✅ 统一使用 formatPlaneFull（内部处理 mechanismIndex < 0）
        const la = formatPlaneFull(
          c.planeA.mechanismIndex,
          c.planeA.planeIndex,
          this.appState.mechanisms
        );
        const lb = formatPlaneFull(
          c.planeB.mechanismIndex,
          c.planeB.planeIndex,
          this.appState.mechanisms
        );
        const highlightClass = highlightedIds.has(c.id) ? " highlight" : "";
        return `<div class="conn-item${highlightClass}" data-conn-id="${c.id}">
              <div class="info"><span>${la}</span> ↔ <span>${lb}</span><span class="badge">#${
          c.id
        }</span></div>
              <button class="del-btn" data-id="${c.id}" title="${t(
          "conn-del-btn"
        )}">✕</button>
            </div>`;
      })
      .join("");
    list.innerHTML = html;

    // ========== 绑定删除事件（代理） ==========
    if (this._connListHandler) {
      list.removeEventListener("click", this._connListHandler);
    }
    this._connListHandler = (e) => {
      const btn = e.target.closest(".del-btn");
      if (btn) {
        const id = parseInt(btn.dataset.id, 10);
        // 删除连接
        this.appState.removeConnection(id, true);
        // 刷新拓扑图（强制）
        this._safeRefreshTopology();
        // 刷新整个 UI（连接列表会重新渲染，高亮更新）
        this._refreshUI();
        // 显示删除通知
        this.notification.showSuccess(t("toast-conn-del", { id }));
        return;
      }
      // 反选：点击列表项 → 在 3D 场景高亮该连接的两个平面（再次点击取消）
      const item = e.target.closest(".conn-item");
      if (item) {
        const id = parseInt(item.dataset.connId, 10);
        if (this.appState.highlightConnectionById(id)) {
          this._safeRefreshTopology();
          this._refreshUI();
        }
      }
    };
    list.addEventListener("click", this._connListHandler);
  }

  _updateConnectionSelection() {
    const A = this.appState.selectedConnA;
    const B = this.appState.selectedConnB;
    if (A) {
      const label = formatPlaneFull(
        A.mechanismIndex,
        A.planeIndex,
        this.appState.mechanisms
      );
      this.dom.connAInfo.innerHTML = `<span class="conn-plane-badge cyan-bg">${label}</span>`;
    } else {
      this.dom.connAInfo.textContent = t("conn-none");
    }
    if (B) {
      const label = formatPlaneFull(
        B.mechanismIndex,
        B.planeIndex,
        this.appState.mechanisms
      );
      this.dom.connBInfo.innerHTML = `<span class="conn-plane-badge purple-bg">${label}</span>`;
    } else {
      this.dom.connBInfo.textContent = t("conn-none");
    }
    this.dom.btnConnect.disabled = !(A && B);
  }

  /**
   * 格式化连接链显示信息
   * @param {object} chainResult - 来自 AppState.getConnectionChain 的结果
   * @returns {string} 格式化后的显示字符串
   */
  _formatChainInfo(chainResult) {
    if (!chainResult || chainResult.collectedPlanes.length === 0) {
      return t("conn-no-conn");
    }
    const groups = new Map();
    for (const p of chainResult.collectedPlanes) {
      if (!groups.has(p.mechIdx)) groups.set(p.mechIdx, []);
      groups.get(p.mechIdx).push(p.planeIdx);
    }
    const parts = [];
    const mechanisms = this.appState.mechanisms;
    for (const [mechIdx, planes] of groups) {
      const mech = mechanisms[mechIdx];
      if (!mech) continue;
      const id = mech.id;
      const allPlanes = [1, 2, 3, 4];
      const hasAll = allPlanes.every((p) => planes.includes(p));
      if (hasAll && planes.length === 4) {
        parts.push(`N${id}`);
      } else {
        const sorted = planes.slice().sort((a, b) => a - b);
        parts.push(`N${id}-P${sorted.join("-P")}`);
      }
    }
    return parts.join(" → ");
  }

  // ==================== 撤销/重做按钮状态 ====================
  _updateUndoRedo() {
    this.dom.btnUndo.disabled = !this.appState.history.canUndo();
    this.dom.btnRedo.disabled = !this.appState.history.canRedo();
  }

  // ==================== 状态显示 ====================
  _updateStatusDisplays() {
    const animOn = this.animEnabled;
    this.dom.animStatusBadge.textContent = animOn
      ? t("ui-anim-on")
      : t("ui-anim-off");
    this.dom.animStatusBadge.className =
      "status-badge " + (animOn ? "on" : "off");
    this.dom.animStatusDisplay.textContent = animOn
      ? t("anim-status-on")
      : t("anim-status-off");

    const multiOn = this.multiSelectEnabled;
    this.dom.multiStatusDisplay.textContent = multiOn
      ? t("multi-status-on")
      : t("multi-status-off");
    this.dom.modeStatusBadgeText.textContent = multiOn
      ? t("conn-multi-on")
      : t("conn-multi-off");
    this.dom.modeStatusBadgeText.className =
      "status-badge " + (multiOn ? "on" : "off");
    this.dom.modeLabel.classList.toggle("active-label", multiOn);

    this._updateTopoStatusDisplay();
  }

  _updateCameraDisplay() {
    const t = this.sceneManager.controls.target;
    const cam = this.sceneManager.camera;
    const pos = cam.position;
    const dist = pos.distanceTo(t);
    const dir = new THREE.Vector3().subVectors(pos, t).normalize();

    // 计算方位角 θ (水平角，从 X 轴起)
    const theta = Math.atan2(dir.y, dir.x);
    const thetaDeg = THREE.MathUtils.radToDeg(theta);
    // 计算极角 φ (与 Z 轴的夹角)
    const phi = Math.acos(dir.z);
    const phiDeg = THREE.MathUtils.radToDeg(phi);

    // 更新聚焦点（保持不变）
    this.dom.curFx.textContent = t.x.toFixed(2);
    this.dom.curFy.textContent = t.y.toFixed(2);
    this.dom.curFz.textContent = t.z.toFixed(2);

    // 更新相机参数（距离、方位角、极角）
    this.dom.camX.textContent = dist.toFixed(2); // 距离
    this.dom.camY.textContent = thetaDeg.toFixed(2); // 方位角 θ
    this.dom.camZ.textContent = phiDeg.toFixed(2); // 极角 φ
  }

  _updateMultiStatus() {
    this._updateStatusDisplays();
  }
  _updateAnimStatus() {
    this._updateStatusDisplays();
  }

  // ==================== 加载状态 ====================
  _showLoading(msg) {
    this.dom.loadingOverlay.style.display = "flex";
    this.dom.loadingMsg.textContent = msg;
    this.dom.progressFill.style.width = "0%";
  }

  _updateLoading(pct) {
    this.dom.progressFill.style.width = Math.min(100, Math.max(0, pct)) + "%";
  }

  _hideLoading() {
    this.dom.loadingOverlay.style.display = "none";
    this.dom.progressFill.style.width = "0%";
  }

  // ==================== 语言更新 ====================
  _updateAllTexts() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (key) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = t(key);
        } else {
          el.textContent = t(key);
        }
      }
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === getLang());
    });
    this.dom.themeToggle.textContent = this.dark
      ? t("ui-theme-dark")
      : t("ui-theme-light");
    this.dom.btnExport.textContent = t("ui-export");
    const fb = document.querySelector(".file-input-wrapper .fake-btn");
    if (fb) fb.textContent = t("ui-import");
    this.dom.genScaleUp.textContent = t("gen-scale-up");
    this.dom.genScaleDown.textContent = t("gen-scale-down");
    this.dom.animDurationReset.textContent = t("ui-anim-reset");
    this.dom.btnScreenshot.textContent = t("ui-screenshot-btn");
    this.dom.btnHelp.textContent = t("help-btn");
    this.dom.helpBody.textContent = t("help-body");
    document.querySelector(
      '#ui-panel .ui-card .card-label span[data-i18n="ui-lang"]'
    ).textContent = t("ui-lang");
    document.querySelector(
      '#ui-panel .ui-card .card-label span[data-i18n="ui-theme"]'
    ).textContent = t("ui-theme");
    document.querySelector(
      '#ui-panel .ui-card .card-label span[data-i18n="ui-anim"]'
    ).textContent = t("ui-anim");
    document.querySelector(
      '#ui-panel .ui-card .card-label span[data-i18n="ui-screenshot-title"]'
    ).textContent = t("ui-screenshot-title");
    document.querySelector(
      '#ui-panel .ui-card .card-label span[data-i18n="ui-focus"]'
    ).textContent = t("ui-focus");
    document.querySelector(
      '#ui-panel .ui-card .card-label span[data-i18n="ui-cam"]'
    ).textContent = t("ui-cam");
    this._refreshUI();
  }

  // ==================== 初始化 ====================
  _initUI() {
    this._updateAllTexts();
    document.body.classList.remove("light-theme");
    this.dark = true;
    this.dom.themeToggle.textContent = t("ui-theme-dark");
    this.dom.multiCheckbox.checked = false;
    this.multiSelectEnabled = false;
    this._updateMultiStatus();
    this.dom.animCheckbox.checked = true;
    this.animEnabled = true;
    this._updateAnimStatus();
    this.topologyRenderer.setEnabled(true);
    this.dom.screenshotRes.value = "1080p";
    this.dom.screenshotCustom.style.display = "none";
    this._updateGenDisplay();
    this._syncGenQuat();
    this._onGridSizeChange();
    this._syncUIFromCamera();
    this.appState.updateAllFrames();
    // 初始化连接矩阵模式
    if (this.matrixRenderer) {
      this.matrixRenderer.setMode("full");
    }
  }

  // ==================== 销毁 ====================
  destroy() {
    this._boundEvents.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this._boundEvents = [];
    this._removePreview();
    this.appState.onUpdate = null;
    if (this._ScreenshotClass) {
      this._ScreenshotClass.dispose();
      this._ScreenshotClass = null;
    }
    if (this.matrixRenderer) {
      this.matrixRenderer.destroy();
      this.matrixRenderer = null;
    }
  }
}
