// src/utils/ConnectionMatrix.js
import * as THREE from "three";

/**
 * 从机构计算平面法向量矩阵
 * 返回 [a, b, c]：
 *   a = 平面1法向量（世界坐标，长度=cubeSize）
 *   b = 平面2法向量（世界坐标，长度=cubeSize）
 *   c = 平面4法向量（世界坐标，长度=cubeSize）
 */
export function computeNormals(mech) {
  const qW = mech.group
    ? mech.group.quaternion
    : new THREE.Quaternion().setFromEuler(mech.worldRotation);

  const worldNormal = (local, lAngle) => {
    const v = local.clone();
    const qL = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(lAngle)
    );
    v.applyQuaternion(qL);
    v.applyQuaternion(qW);
    return v.multiplyScalar(mech.cubeSize);
  };

  const a = worldNormal(new THREE.Vector3(0, 0, -1), mech.l1Angle);
  const b = worldNormal(new THREE.Vector3(1, 0, 0), mech.l1Angle);
  const c = worldNormal(new THREE.Vector3(-1, 0, 0), mech.l2Angle);

  return [a, b, c];
}

/** 返回 { axis, dir1 }（与 MATLAB planeAxisDir1 一致） */
function planeAxisDir1(mech, planeIdx) {
  const [a, b, c] = computeNormals(mech);
  let axis, ref;
  switch (planeIdx) {
    case 1:
      axis = a.clone();
      ref = b.clone();
      break;
    case 2:
      axis = b.clone();
      ref = a.clone();
      break;
    case 3:
      axis = a.clone().negate();
      ref = c.clone();
      break;
    case 4:
      axis = c.clone();
      ref = a.clone().negate();
      break;
    default:
      throw new Error("planeIdx must be 1..4");
  }
  axis.normalize();
  ref.sub(axis.clone().multiplyScalar(ref.dot(axis)));
  ref.normalize();
  return { axis, dir1: ref };
}

function planeDirection(mech, planeIdx, k) {
  const { axis, dir1 } = planeAxisDir1(mech, planeIdx);
  const d2 = new THREE.Vector3().crossVectors(axis, dir1);
  let d;
  switch (k) {
    case 1:
      d = dir1;
      break;
    case 2:
      d = d2;
      break;
    case 3:
      d = dir1.clone().negate();
      break;
    case 4:
      d = d2.clone().negate();
      break;
    default:
      throw new Error("k must be 1..4");
  }
  return d.normalize();
}

function findParallelCode(mech, planeIdx, refDir) {
  refDir = refDir.clone().normalize();
  let bestK = 1;
  let bestDot = -Infinity;
  for (let k = 1; k <= 4; k++) {
    const d = planeDirection(mech, planeIdx, k).dot(refDir);
    if (d > bestDot) {
      bestDot = d;
      bestK = k;
    }
  }
  return bestK;
}

/**
 * 构建连接矩阵（移植自 MATLAB buildConnectionMatrix）
 * @returns {Array<Array<number>>} (N+1)×(N+3) 二维数组
 *   行 0..N-1 → 机构；行 N → 基准平面
 *   列 0..N-1 → 机构；列 N..N+2 → x,y,z
 *   对角线 T[i][i] = (s_i - 1) * 4 + 内部边编码 (1..4)
 */
export function buildConnectionMatrix(mechs, conns) {
  const N = mechs.length;
  if (N === 0) return [];

  // 使用 1 起始索引（索引 0 占位）
  const M = Array.from({ length: N + 2 }, () => new Array(N + 4).fill(0));
  const idxToPos = (k) => k + 1;

  // 1. 坐标
  for (let k = 0; k < N; k++) {
    const row = idxToPos(k);
    const p = mechs[k].position;
    M[row][N + 1] = p.x;
    M[row][N + 2] = p.y;
    M[row][N + 3] = p.z;
  }

  // 2. 连接（非对角）
  for (const c of conns) {
    const aIdx = c.planeA.mechanismIndex;
    const bIdx = c.planeB.mechanismIndex;
    const pA = c.planeA.planeIndex;
    const pB = c.planeB.planeIndex;

    if (aIdx === -1) {
      M[N + 1][idxToPos(bIdx)] = 1;
    } else if (bIdx === -1) {
      M[N + 1][idxToPos(aIdx)] = 1;
    } else {
      M[idxToPos(aIdx)][idxToPos(bIdx)] = pA;
      M[idxToPos(bIdx)][idxToPos(aIdx)] = pB;
    }
  }

  // 3. 对角线
  for (let k = 0; k < N; k++) {
    const row = idxToPos(k);
    const mechA = mechs[k];
    const sI = mechA.cubeSize;

    // 找行中第一个非零项（跳过对角线本身，尚未写入）
    let jPos = -1;
    for (let col = 1; col <= N; col++) {
      if (M[row][col] !== 0) {
        jPos = col;
        break;
      }
    }

    let code;
    if (jPos !== -1) {
      const pA = M[row][jPos];
      const pB = M[jPos][row];
      const mechB = mechs[jPos - 1];
      const eB1 = planeDirection(mechB, pB, 1);
      code = findParallelCode(mechA, pA, eB1);
    } else {
      const eBase1 = new THREE.Vector3(1, 0, 0);
      code = findParallelCode(mechA, 1, eBase1);
    }

    M[row][row] = (sI - 1) * 4 + code;
  }

  // 去掉索引 0，返回 (N+1)×(N+3)
  const result = [];
  for (let i = 1; i <= N + 1; i++) {
    result.push(M[i].slice(1, N + 4));
  }
  return result;
}
