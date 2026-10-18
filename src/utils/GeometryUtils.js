// src/utils/GeometryUtils.js
import * as THREE from "three";

// ==================== 材质定义 ====================
// 这些材质可在机构创建时复用，但为了简化，每个机构独立创建，因为不同机构可能独立修改材质。
// 这里定义默认材质供创建函数使用，如果不需要共享，可在函数内部创建。

// ==================== 工具函数 ====================

/**
 * 四舍五入到百分位，接近0时返回0
 */
export function roundToCent(v) {
  if (Math.abs(v) < 0.005) return 0;
  const r = Math.round(v * 100) / 100;
  return Math.abs(r) < 0.005 ? 0 : r;
}

/**
 * 归一化角度到 -180 ~ 180 度
 */
export function normalizeAngleDeg(d) {
  let a = ((d % 360) + 360) % 360;
  if (a > 180) a -= 360;
  if (a > 360) a = 360;
  if (a < -360) a = -360;
  return roundToCent(a);
}

/**
 * 从四元数提取欧拉角（度），XYZ顺序
 */
export function quatToEulerDeg(q) {
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  return {
    x: normalizeAngleDeg(THREE.MathUtils.radToDeg(e.x)),
    y: normalizeAngleDeg(THREE.MathUtils.radToDeg(e.y)),
    z: normalizeAngleDeg(THREE.MathUtils.radToDeg(e.z)),
  };
}

/**
 * 计算从from到to的最短角度差（度）
 */
export function shortestAngleDelta(from, to) {
  let d = to - from;
  d = ((d % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/**
 * 缓动函数：三次缓入缓出
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 格式化平面全称：N{机构ID}-P{平面索引}
 * ✅ 基准平面（mechIndex < 0）视为机构 0，输出 "N0-P{idx}"
 */
export function formatPlaneFull(mechIndex, planeIndex, mechanisms) {
  if (mechIndex < 0) {
    return `N0-P${planeIndex}`;
  }
  const id =
    mechanisms && mechanisms[mechIndex] ? mechanisms[mechIndex].id : "?";
  return `N${id}-P${planeIndex}`;
}

/**
 * 计算平面在世界空间中的中心点
 * @param {Mechanism} mech - 机构实例
 * @param {number} planeIndex - 平面索引 (1-4)
 * @returns {THREE.Vector3}
 */
export function getPlaneWorldCenter(mech, planeIndex) {
  // ✅ 基准平面：位置为原点
  if (!mech || !mech.group) {
    return new THREE.Vector3(0, 0, 0);
  }
  const half = mech.cubeSize / 2;
  const off = new THREE.Vector3();
  if (planeIndex === 1) off.set(0, 0, -half);
  else if (planeIndex === 2) off.set(half, 0, 0);
  else if (planeIndex === 3) off.set(0, 0, half);
  else if (planeIndex === 4) off.set(-half, 0, 0);

  const lAngle = planeIndex <= 2 ? mech.l1Angle : mech.l2Angle;
  const qL = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(lAngle)
  );
  off.applyQuaternion(qL);
  const qW = new THREE.Quaternion().setFromEuler(mech.worldRotation);
  off.applyQuaternion(qW);
  off.add(mech.position);
  return off;
}

/**
 * 计算L零件的圆角半径（基于立方体边长和厚度）
 */
export function computeCornerRadius(side, thick) {
  const sqrt2 = Math.SQRT2;
  let r = side / 2 - thick * (2 + sqrt2);
  if (r < 0) r = 0;
  return Math.round(r * 1000) / 1000;
}

/**
 * 获取L1和L2固定的圆角启用配置
 * L1: 左上、左下圆角 (索引0,3)，右上、右下直角
 * L2: 右上、右下圆角 (索引1,2)，左上、左下直角
 */
export function getFixedCorners() {
  return {
    l1: [true, false, false, true],
    l2: [false, true, true, false],
  };
}

// ==================== 几何创建函数 ====================

/**
 * 创建圆角矩形形状 (Shape)
 * @param {number} w - 宽度
 * @param {number} h - 高度
 * @param {number} r - 圆角半径
 * @param {boolean[]} cornerEnabled - 四个角是否启用圆角 [左上, 右上, 右下, 左下]
 * @returns {THREE.Shape}
 */
export function createRoundedRectShape(
  w,
  h,
  r,
  cornerEnabled = [true, true, true, true]
) {
  const shape = new THREE.Shape();
  const w2 = w / 2,
    h2 = h / 2,
    rad = r;
  const [tl, tr, br, bl] = cornerEnabled.map((v) => v === true);

  if (rad <= 0.0001 || (!tl && !tr && !br && !bl)) {
    shape.moveTo(-w2, -h2);
    shape.lineTo(w2, -h2);
    shape.lineTo(w2, h2);
    shape.lineTo(-w2, h2);
    shape.closePath();
    return shape;
  }

  // 从左上角开始（左下角起点）
  const sx = tl ? -w2 + rad : -w2;
  const sy = h2;
  shape.moveTo(sx, sy);

  if (tr && rad > 0.0001) {
    shape.lineTo(w2 - rad, h2);
    shape.absarc(w2 - rad, h2 - rad, rad, Math.PI / 2, 0, true);
  } else {
    shape.lineTo(w2, h2);
  }

  if (br && rad > 0.0001) {
    shape.lineTo(w2, -h2 + rad);
    shape.absarc(w2 - rad, -h2 + rad, rad, 0, -Math.PI / 2, true);
  } else {
    shape.lineTo(w2, -h2);
  }

  if (bl && rad > 0.0001) {
    shape.lineTo(-w2 + rad, -h2);
    shape.absarc(-w2 + rad, -h2 + rad, rad, -Math.PI / 2, Math.PI, true);
  } else {
    shape.lineTo(-w2, -h2);
  }

  if (tl && rad > 0.0001) {
    shape.lineTo(-w2, h2 - rad);
    shape.absarc(-w2 + rad, h2 - rad, rad, Math.PI, Math.PI / 2, true);
  } else {
    shape.lineTo(-w2, h2);
  }

  shape.closePath();
  return shape;
}

/**
 * 创建立方体线框（透明，用于指示）
 */
export function createCubeFrame(s) {
  const m = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
  });
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s)),
    m
  );
}

/**
 * 创建L零件（一个L形由两个平板组成）
 * @param {boolean} isL1 - true为L1(蓝色)，false为L2(红色)
 * @param {number} arm - 边长
 * @param {number} thick - 厚度
 * @param {number} cube - 立方体边长
 * @param {boolean} preview - 是否为预览模式（透明材质）
 * @param {number} cornerR - 圆角半径
 * @param {boolean[]} cornerE - 四个角圆角启用 [左上, 右上, 右下, 左下]
 * @returns {THREE.Group}
 */
export function createLPart(
  isL1,
  arm,
  thick,
  cube,
  preview = false,
  cornerR = 0,
  cornerE = [true, true, true, true]
) {
  const g = new THREE.Group();
  const half = cube / 2,
    halfT = thick / 2;

  // 材质
  const mat = preview
    ? isL1
      ? new THREE.MeshStandardMaterial({
        color: "#3377dd",
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
        opacity: 0.4,
      })
      : new THREE.MeshStandardMaterial({
        color: "#dd3b3b",
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
        opacity: 0.4,
      })
    : isL1
      ? new THREE.MeshStandardMaterial({
        color: "#3377dd",
        roughness: 0.25,
        metalness: 0.3,
      })
      : new THREE.MeshStandardMaterial({
        color: "#dd3b3b",
        roughness: 0.25,
        metalness: 0.3,
      });

  // 基础板（水平面）
  const baseZ = isL1 ? -half : half,
    baseDir = isL1 ? 1 : -1;
  const shape = createRoundedRectShape(arm, arm, cornerR, cornerE);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -thick / 2);
  const base = new THREE.Mesh(geo, mat);
  base.position.set(0, 0, baseZ + baseDir * halfT);
  base.castShadow = !preview;
  base.receiveShadow = !preview;
  base.userData.planeIndex = isL1 ? 1 : 3;

  // 侧板（垂直面）
  const sideGeo = geo.clone();
  sideGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const sideX = isL1 ? half : -half,
    sideDir = isL1 ? -1 : 1;
  const side = new THREE.Mesh(sideGeo, mat);
  side.position.set(sideX + sideDir * halfT, 0, 0);
  side.castShadow = !preview;
  side.receiveShadow = !preview;
  side.userData.planeIndex = isL1 ? 2 : 4;

  g.userData = {
    basePlate: base,
    sidePlate: side,
    planeMeshes: [base, side],
    planeNames: isL1
      ? ["平面1(底面)", "平面2(右面)"]
      : ["平面3(顶面)", "平面4(左面)"],
    planeIndices: isL1 ? [1, 2] : [3, 4],
  };
  g.add(base);
  g.add(side);
  return g;
}

/**
 * 创建轴（圆柱体）
 */
export function createAxis(radius, len, preview = false) {
  const g = new THREE.Group();
  const mat = preview
    ? new THREE.MeshStandardMaterial({
      color: "#999999",
      roughness: 0.3,
      metalness: 0.6,
      transparent: true,
      opacity: 0.4,
    })
    : new THREE.MeshStandardMaterial({
      color: "#999999",
      roughness: 0.3,
      metalness: 0.6,
    });
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 32),
    mat
  );
  cyl.rotation.x = Math.PI / 2;
  cyl.castShadow = !preview;
  cyl.receiveShadow = !preview;
  g.add(cyl);
  return g;
}

// src/utils/GeometryUtils.js

/**
 * 创建完整机构（固定圆角：L1左上左下，L2右上右下）
 * @param {THREE.Vector3} pos - 位置
 * @param {THREE.Euler} rot - 世界旋转
 * @param {number} l1 - L1角度（度）
 * @param {number} l2 - L2角度（度）
 * @param {number} arm - L边长
 * @param {number} thick - L厚度
 * @param {number} cube - 立方体边长
 * @param {number} axisR - 轴半径
 * @param {boolean} preview - 是否预览模式
 * @returns {THREE.Group}
 */
export function createMechanism(
  pos,
  rot,
  l1,
  l2,
  arm,
  thick,
  cube,
  axisR,
  preview = false
) {
  const g = new THREE.Group();
  g.position.copy(pos);
  g.rotation.copy(rot);

  // 固定圆角配置
  const radius = computeCornerRadius(cube, thick);
  const corners = getFixedCorners(); // { l1: [true,false,false,true], l2: [false,true,true,false] }

  // 立方体线框
  const frame = createCubeFrame(cube);
  g.add(frame);
  g.userData.frame = frame;

  // 轴
  g.add(createAxis(axisR, arm, preview));

  // L1
  const L1 = createLPart(true, arm, thick, cube, preview, radius, corners.l1);
  L1.rotation.z = THREE.MathUtils.degToRad(l1);
  g.add(L1);

  // L2
  const L2 = createLPart(false, arm, thick, cube, preview, radius, corners.l2);
  L2.rotation.z = THREE.MathUtils.degToRad(l2);
  g.add(L2);

  if (!preview) {
    const planes = [];
    [L1, L2].forEach((part) => {
      const ms = part.userData.planeMeshes,
        ns = part.userData.planeNames,
        is = part.userData.planeIndices;
      ms.forEach((m, idx) => {
        planes.push({
          mesh: m,
          planeName: ns[idx],
          planeIndex: is[idx],
          mechanismGroup: g,
          lPartGroup: part,
        });
      });
    });
    g.userData.allPlanes = planes;
    g.userData.l1 = L1;
    g.userData.l2 = L2;
    g.userData.armSize = arm;
    g.userData.thickness = thick;
    g.userData.cubeSize = cube;
    g.userData.axisRadius = axisR;
    // 不再存储圆角参数，因为固定
  }
  g.userData.isPreview = preview;
  return g;
}

/**
 * 将角度吸附到标准值（0, ±90, ±180），否则保留两位小数
 * @param {number} deg - 角度（度）
 * @param {number} eps - 判定误差阈值，默认 0.01
 * @returns {number} 吸附后的角度
 */
export function snapAngle(deg, eps = 0.01) {
  const targets = [0, 90, -90, 180, -180];
  for (const t of targets) {
    if (Math.abs(deg - t) < eps) {
      return t;
    }
  }
  return Math.round(deg * 100) / 100;
}

/**
 * 将数值吸附到整数或0.5倍数，否则保留三位小数
 * @param {number} v - 待校正值
 * @param {number} eps - 判定误差阈值，默认 0.01
 * @returns {number} 校正后的值
 */
export function snapValue(v, eps = 0.01) {
  const rInt = Math.round(v);
  if (Math.abs(v - rInt) < eps) return rInt;
  const half = Math.round(v * 2) / 2;
  if (Math.abs(v - half) < eps) return half;
  return Math.round(v * 100) / 100;
}

// ==================== 简化格式导入/导出辅助 ====================

/**
 * 计算机构指定平面在世界坐标系中的单位法向量
 * 方向：从机构中心指向平面中心（即平面外法线方向）
 */
export function getWorldPlaneNormal(mech, planeIndex) {
  let local;
  if (planeIndex === 1) local = new THREE.Vector3(0, 0, -1); // 底面
  else if (planeIndex === 2) local = new THREE.Vector3(1, 0, 0); // 右面
  else if (planeIndex === 3) local = new THREE.Vector3(0, 0, 1); // 顶面
  else if (planeIndex === 4) local = new THREE.Vector3(-1, 0, 0); // 左面
  else return new THREE.Vector3(0, 0, 1);

  const lAngle = planeIndex <= 2 ? mech.l1Angle : mech.l2Angle;
  const qL = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(lAngle)
  );
  local.applyQuaternion(qL);

  const qW = mech.group
    ? mech.group.quaternion
    : new THREE.Quaternion().setFromEuler(mech.worldRotation);
  local.applyQuaternion(qW);

  return local.normalize();
}

/**
 * 由平面1、平面2单位法向量（世界坐标）反算 worldRotation（XYZ 顺序欧拉角）
 * 约定初始模块：平面1法向量 = (0,0,-1)，平面2法向量 = (1,0,0)
 */
export function computeWorldRotationFromNormals(aVec, bVec) {
  // 初始参考模块（worldRotation=0, l1=0）的平面1、2本地法向量
  const u0 = new THREE.Vector3(0, 0, -1);    // ✅ 平面1
  const v0 = new THREE.Vector3(1, 0, 0);    //    平面2
  const w0 = new THREE.Vector3().crossVectors(u0, v0).normalize();

  const u = aVec.clone().normalize();
  const v = bVec.clone().normalize();
  const w = new THREE.Vector3().crossVectors(u, v).normalize();

  const M0 = new THREE.Matrix4().makeBasis(u0, v0, w0);
  const M1 = new THREE.Matrix4().makeBasis(u, v, w);
  const R = M1.clone().multiply(M0.clone().transpose());

  const q = new THREE.Quaternion().setFromRotationMatrix(R);
  return new THREE.Euler().setFromQuaternion(q, "XYZ");
}

/**
 * 由平面1、2、4单位法向量（世界坐标）反算 l2Angle（度）
 * 步骤：
 *   ① 由 a、b 反算 R_world（同 computeWorldRotationFromNormals）
 *   ② 把 c 转到本地：c_local = R_worldᵀ · c
 *   ③ 在本地中 R_z(θ) · [-1,0,0] = c_local，反解 θ
 */
export function computeL2AngleFromNormals(aVec, bVec, cVec) {
  const u0 = new THREE.Vector3(0, 0, -1);
  const v0 = new THREE.Vector3(1, 0, 0);
  const w0 = new THREE.Vector3().crossVectors(u0, v0).normalize();

  const u = aVec.clone().normalize();
  const v = bVec.clone().normalize();
  const w = new THREE.Vector3().crossVectors(u, v).normalize();

  const M0 = new THREE.Matrix4().makeBasis(u0, v0, w0);
  const M1 = new THREE.Matrix4().makeBasis(u, v, w);
  const R = M1.clone().multiply(M0.clone().transpose());

  // 把 c 转到本地：c_local = R⁻¹ · c
  const cLocal = cVec.clone().normalize().applyMatrix4(R.clone().invert());

  // R_z(θ) · [-1,0,0] = [-cosθ, -sinθ, 0]
  const theta = Math.atan2(-cLocal.y, -cLocal.x);
  return normalizeAngleDeg(THREE.MathUtils.radToDeg(theta));
}