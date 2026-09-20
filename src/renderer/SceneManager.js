import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * 场景管理器
 * - 管理 Three.js 场景、相机、渲染器、控制器
 * - 提供灯光、网格、世界坐标系辅助
 * - 几何体和材质缓存（共享资源）
 * - 阴影优化（贴图大小1024，裁剪范围缩紧）
 */
export class SceneManager {
  /**
   * @param {HTMLElement} container - 用于挂载 canvas 的容器元素
   */
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e); // 深色背景，可通过主题切换

    // 相机
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.05,
      1000
    );
    this.camera.position.set(5, -4.5, 5);
    this.camera.up.set(0, 0, 1); // Z轴向上

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 轨道控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.5, 0.5, 0.5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 1000;
    this.controls.update();

    // 初始化场景元素
    this._setupLights();
    this._setupGrid();
    this._setupAxes();

    // 窗口大小自适应
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);

    // 资源缓存
    this.geometryCache = new Map();
    this.materialCache = new Map();

    this._disposed = false;
  }

  // ---------- 私有初始化方法 ----------

  /**
   * 灯光设置（含阴影优化）
   */
  _setupLights() {
    // 环境光
    const ambient = new THREE.AmbientLight('#bcc8e8', 2.8);
    this.scene.add(ambient);

    // 主光源（方向光）
    const sun = new THREE.DirectionalLight('#ffffff', 5);
    sun.position.set(20, -15, 30);
    sun.castShadow = true;

    // 阴影优化：贴图尺寸 1024x1024（原2048）
    sun.shadow.mapSize.set(1024, 1024);
    // 缩紧阴影相机范围，提高精度
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;

    this.scene.add(sun);
    this.sun = sun;
  }

  /**
   * 网格和参考平面
   */
  _setupGrid() {
    const size = 50;
    this.gridHelper = new THREE.GridHelper(size, size, '#8899aa', '#3a4a5c');
    this.gridHelper.rotation.x = -Math.PI / 2;
    this.gridHelper.position.z = 0;
    this.scene.add(this.gridHelper);

    // 半透明参考平面（接收阴影，增加立体感）
    // ✅ 现在可作为基准平面被射线拾取、选中、连接
    const refPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({
        color: '#8899bb',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
      })
    );
    refPlane.position.z = 0;
    // 🔽 标记为基准平面（机构0-平面1）
    refPlane.userData.isBasePlane = true;
    refPlane.userData.planeIndex = 1;
    refPlane.userData.mechanismIndex = -1; // 哨兵值：表示基准平面
    refPlane.userData.isPreview = false;
    this.scene.add(refPlane);
    this.refPlane = refPlane;
  }

  /**
   * 世界坐标系辅助（固定轴，以及选中机构指示器）
   */
  _setupAxes() {
    // 世界坐标系固定轴（位于原点）
    const axes = new THREE.Group();
    const len = 1;
    const colors = { x: 0xff4444, y: 0x44cc44, z: 0x4488ff };
    [
      { dir: new THREE.Vector3(1, 0, 0), color: colors.x },
      { dir: new THREE.Vector3(0, 1, 0), color: colors.y },
      { dir: new THREE.Vector3(0, 0, 1), color: colors.z },
    ].forEach((d) => {
      // 轴杆
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, len, 8),
        new THREE.MeshStandardMaterial({
          color: d.color,
          emissive: d.color,
          emissiveIntensity: 0.7,
        })
      );
      shaft.position.copy(d.dir.clone().multiplyScalar(len / 2));
      if (d.dir.x === 1) shaft.rotation.z = -Math.PI / 2;
      if (d.dir.z === 1) shaft.rotation.x = Math.PI / 2;
      axes.add(shaft);
      // 箭头锥体
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.18, 8),
        new THREE.MeshStandardMaterial({
          color: d.color,
          emissive: d.color,
          emissiveIntensity: 0.7,
        })
      );
      tip.position.copy(d.dir.clone().multiplyScalar(len));
      if (d.dir.x === 1) tip.rotation.z = -Math.PI / 2;
      if (d.dir.z === 1) tip.rotation.x = Math.PI / 2;
      axes.add(tip);
    });
    this.scene.add(axes);

    // 选中机构指示器（小坐标轴，会跟随机构移动）
    this.worldAxesIndicator = new THREE.Group();
    const axLen = 0.4;
    const arrowColors = [0xff4444, 0x44cc44, 0x4488ff];
    const dirs = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    dirs.forEach((dir, i) => {
      const arrow = new THREE.ArrowHelper(
        dir,
        new THREE.Vector3(0, 0, 0),
        axLen,
        arrowColors[i],
        0.12,
        0.06
      );
      this.worldAxesIndicator.add(arrow);
    });
    // 中心小球
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
      })
    );
    this.worldAxesIndicator.add(sphere);
    this.worldAxesIndicator.visible = false;
    this.scene.add(this.worldAxesIndicator);
  }

  // ---------- 公共方法 ----------

  /**
   * 添加对象到场景
   * @param {THREE.Object3D} obj
   */
  addObject(obj) {
    this.scene.add(obj);
  }

  /**
   * 从场景移除对象
   * @param {THREE.Object3D} obj
   */
  removeObject(obj) {
    this.scene.remove(obj);
  }

  /**
   * 窗口尺寸改变时自适应
   */
  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * 渲染一帧（由动画循环调用）
   */
  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 获取或创建共享几何体
   * @param {string} key - 缓存键
   * @param {Function} createFn - 创建几何体的函数，返回 BufferGeometry
   * @returns {THREE.BufferGeometry}
   */
  getGeometry(key, createFn) {
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, createFn());
    }
    return this.geometryCache.get(key);
  }

  /**
   * 获取或创建共享材质
   * @param {string} key - 缓存键
   * @param {Function} createFn - 创建材质的函数，返回 Material
   * @returns {THREE.Material}
   */
  getMaterial(key, createFn) {
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, createFn());
    }
    return this.materialCache.get(key);
  }

  /**
   * 释放所有资源（几何缓存、材质缓存、渲染器、场景遍历）
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    window.removeEventListener('resize', this._resizeHandler);

    // 释放渲染器
    this.renderer.dispose();

    // 释放几何缓存
    for (const geo of this.geometryCache.values()) {
      geo.dispose();
    }
    this.geometryCache.clear();

    // 释放材质缓存
    for (const mat of this.materialCache.values()) {
      mat.dispose();
    }
    this.materialCache.clear();

    // 遍历场景释放所有 Mesh 的几何和材质（避免遗漏）
    this.scene.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });

    // 清空场景（可选）
    // this.scene.clear();
  }
}