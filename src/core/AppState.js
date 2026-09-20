// src/core/AppState.js
import * as THREE from "three";
import { Mechanism } from "./Mechanism.js";
import { Connection } from "./Connection.js";
import { History } from "./History.js";
import {
  getPlaneWorldCenter,
  normalizeAngleDeg,
  easeInOutCubic,
  snapAngle,
  snapValue,
} from "../utils/GeometryUtils.js";
import { renumberBySizeThenGraph } from "../utils/Renumber.js";

const FORMAT_COMMENT = [
  "文件格式说明 (v=1):",
  " v  版本号",
  " t  所有模块共用的 L 零件厚度 thickness",
  " m  模块数组, 每个元素单行:",
  "    i  id",
  "    p  世界坐标 [x, y, z]",
  "    s  cubeSize 立方体边长",
  "    a  平面1法向量 - 世界坐标, 长度 = s",
  "    b  平面2法向量 - 世界坐标, 长度 = s",
  "    c  平面4法向量 - 世界坐标, 长度 = s",
  " c  连接数组, 每个元素单行:",
  "    i  连接 id",
  "    a  [机构 id, 平面索引]  机构 id = 0 表示基准平面",
  "    b  [机构 id, 平面索引]",
  " n  下一个可用的连接 id",
  " 反算规则:",
  "   worldRotation  由平面1, 平面2法向量反算 - XYZ 顺序",
  "   l1Angle        恒为 0",
  "   l2Angle        由平面4法向量相对 -平面2法向量绕 -平面1法向量旋转角 - 右手规则 - 反算",
  "   armSize        = s - 2*t",
  "   axisRadius     = s / 8",
];

// 高亮材质（与原始一致）
const matChainL1 = new THREE.MeshStandardMaterial({
  color: 0xff8800,
  roughness: 0.2,
  metalness: 0.1,
  emissive: 0xff8800,
  emissiveIntensity: 0.7,
});
const matChainL2 = new THREE.MeshStandardMaterial({
  color: 0xaa44ff,
  roughness: 0.2,
  metalness: 0.1,
  emissive: 0xaa44ff,
  emissiveIntensity: 0.7,
});
const matConnCyan = new THREE.MeshStandardMaterial({
  color: 0x00ccff,
  roughness: 0.2,
  metalness: 0.1,
  emissive: 0x00ccff,
  emissiveIntensity: 0.6,
});
const matConnPurple = new THREE.MeshStandardMaterial({
  color: 0xaa44ff,
  roughness: 0.2,
  metalness: 0.1,
  emissive: 0xaa44ff,
  emissiveIntensity: 0.6,
});

export class AppState {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.mechanisms = [];
    this.connections = [];
    this.activeIdx = -1;
    this.selectedPlaneData = null;
    this.highlightedFrameIndices = new Set();
    this.highlightedConnectionIds = new Set();
    this.chainHighlightedPlanesL1 = [];
    this.chainHighlightedPlanesL2 = [];
    this.selectedConnA = null;
    this.selectedConnB = null;
    this.connIdCounter = 1;
    this.highlightMeshes = [];
    this.history = new History(200);
    this._adjList = new Map();
    this._chainCache = new Map();
    this._topoVersion = 0;
    this._dirty = false;
    this._constraintDirty = false;
    this._updateScheduled = false;
    this._disposed = false;
    this._boundListeners = [];
    this.onUpdate = null;
    this._topoHighlightId = null;
    this._animEnabled = true;

    this.animState = {
      active: false,
      startTime: 0,
      duration: 400,
      progress: 0,
      initial: [],
      target: [],
      affectedIndices: [],
      hasL1: false,
      hasL2: false,
      onComplete: null,
      easing: "easeInOut",
      noConstraint: false,
      arcData: null,
    };
  }

  // ----- 机构管理（不变）-----
  addMechanism(mech, recordHistory = true) {
    this.mechanisms.push(mech);
    this.sceneManager.addObject(mech.group);
    if (this.mechanisms.length === 1) this.setActive(0);
    this._markDirty();
    if (recordHistory) this._saveState();
  }

  removeMechanism(idx, recordHistory = true) {
    if (idx < 0 || idx >= this.mechanisms.length) return;
    const mech = this.mechanisms[idx];
    this.sceneManager.removeObject(mech.group);
    mech.dispose();

    const toRemove = [];
    this.connections.forEach((c, i) => {
      if (c.planeA.mechanismIndex === idx || c.planeB.mechanismIndex === idx) {
        toRemove.push(i);
      }
    });
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.connections.splice(toRemove[i], 1);
    }
    for (const c of this.connections) {
      if (c.planeA.mechanismIndex > idx) c.planeA.mechanismIndex--;
      if (c.planeB.mechanismIndex > idx) c.planeB.mechanismIndex--;
    }

    this.mechanisms.splice(idx, 1);
    this._rebuildAdjList();
    this._chainCache.clear();
    this._topoVersion++;

    if (this.mechanisms.length === 0) {
      this.activeIdx = -1;
    } else {
      this.activeIdx = Math.min(this.activeIdx, this.mechanisms.length - 1);
      if (this.activeIdx < 0) this.activeIdx = 0;
    }
    this._markDirty();
    if (recordHistory) this._saveState();
  }

  setActive(idx) {
    if (idx === -1 || idx >= this.mechanisms.length) {
      this.activeIdx = -1;
      this.selectedPlaneData = null;
      this._topoHighlightId = null;
      this._topoVersion++;
      this._markDirty();
      return;
    }
    this.activeIdx = idx;
    this.selectedPlaneData = null;
    this._topoHighlightId = this.mechanisms[idx].id; // 务必设置
    this._topoVersion++;
    this._markDirty();
  }

  // ----- 连接管理（不变）-----
  addConnection(planeA, planeB, recordHistory = true) {
    if (
      planeA.mechanismIndex === planeB.mechanismIndex &&
      planeA.planeIndex === planeB.planeIndex
    ) {
      return false;
    }
    const exists = this.connections.some(
      (c) =>
        (c.planeA.mechanismIndex === planeA.mechanismIndex &&
          c.planeA.planeIndex === planeA.planeIndex &&
          c.planeB.mechanismIndex === planeB.mechanismIndex &&
          c.planeB.planeIndex === planeB.planeIndex) ||
        (c.planeA.mechanismIndex === planeB.mechanismIndex &&
          c.planeA.planeIndex === planeB.planeIndex &&
          c.planeB.mechanismIndex === planeA.mechanismIndex &&
          c.planeB.planeIndex === planeA.planeIndex)
    );
    if (exists) return false;

    const conn = new Connection({
      id: this.connIdCounter++,
      planeA: { ...planeA },
      planeB: { ...planeB },
    });
    this.connections.push(conn);
    this._rebuildAdjList();
    this._chainCache.clear();
    this._topoVersion++;
    this._markDirty();
    if (recordHistory) this._saveState();
    return conn;
  }

  removeConnection(id, recordHistory = true) {
    const idx = this.connections.findIndex((c) => c.id === id);
    if (idx === -1) return;
    this.connections.splice(idx, 1);

    // ✅ 删除后重排编号 1..N，并重置计数器
    this._renumberConnections();

    // ✅ 清理可能指向已删除连接的选择状态
    this.highlightedConnectionIds.clear();
    if (this.selectedConnA) this.selectedConnA = null;
    if (this.selectedConnB) this.selectedConnB = null;

    this._rebuildAdjList();
    this._chainCache.clear();
    this._topoVersion++;
    this._markDirty();
    if (recordHistory) this._saveState();
  }

  // ----- 连接链查询（复制原始逻辑）-----
  getConnectionChain(startMechIdx, branch) {
    const key = `${startMechIdx}_${branch}`;
    if (this._chainCache.has(key)) {
      return this._chainCache.get(key);
    }
    const planeIndices = branch === "L1" ? [1, 2] : [3, 4];
    const startKeys = planeIndices.map((p) => `${startMechIdx},${p}`);
    const result = this._traverseChain(startKeys, startMechIdx);
    this._chainCache.set(key, result);
    return result;
  }

  _traverseChain(startKeys, startMechIdx, maxDepth = 100) {
    const visited = new Set();
    const queue = startKeys.map((k) => ({ key: k, depth: 0 }));
    const collectedPlanes = [];
    const collectedMechIndices = new Set();

    while (queue.length) {
      const { key, depth } = queue.shift();
      if (depth > maxDepth || visited.has(key)) continue;
      visited.add(key);

      const [mIdx, pIdx] = key.split(",").map(Number);
      const mech = this.mechanisms[mIdx];
      if (!mech) continue;

      const plane = mech.group.userData.allPlanes.find(
        (p) => p.planeIndex === pIdx
      );
      if (
        plane &&
        !collectedPlanes.some((c) => c.mechIdx === mIdx && c.planeIdx === pIdx)
      ) {
        collectedPlanes.push({
          mechIdx: mIdx,
          planeIdx: pIdx,
          mesh: plane.mesh,
        });
        collectedMechIndices.add(mIdx);
      }

      // 如果当前机构不是起始机构，则加入该机构的所有平面
      if (startMechIdx !== mIdx) {
        for (const p of mech.group.userData.allPlanes) {
          const pk = `${mIdx},${p.planeIndex}`;
          if (!visited.has(pk) && depth + 1 <= maxDepth) {
            queue.push({ key: pk, depth: depth + 1 });
            if (
              !collectedPlanes.some(
                (c) => c.mechIdx === mIdx && c.planeIdx === p.planeIndex
              )
            ) {
              collectedPlanes.push({
                mechIdx: mIdx,
                planeIdx: p.planeIndex,
                mesh: p.mesh,
              });
              collectedMechIndices.add(mIdx);
            }
          }
        }
      }

      // 配对平面
      let otherIdx;
      if (pIdx === 1) otherIdx = 2;
      else if (pIdx === 2) otherIdx = 1;
      else if (pIdx === 3) otherIdx = 4;
      else if (pIdx === 4) otherIdx = 3;
      const otherKey = `${mIdx},${otherIdx}`;
      if (!visited.has(otherKey) && depth + 1 <= maxDepth) {
        const otherPlane = mech.group.userData.allPlanes.find(
          (p) => p.planeIndex === otherIdx
        );
        if (
          otherPlane &&
          !collectedPlanes.some(
            (c) => c.mechIdx === mIdx && c.planeIdx === otherIdx
          )
        ) {
          collectedPlanes.push({
            mechIdx: mIdx,
            planeIdx: otherIdx,
            mesh: otherPlane.mesh,
          });
          collectedMechIndices.add(mIdx);
        }
        queue.push({ key: otherKey, depth: depth + 1 });
      }

      // 通过连接扩散
      const conns = this._adjList.get(mIdx) || [];
      for (const c of conns) {
        let otherKey = null;
        if (c.planeA.mechanismIndex === mIdx && c.planeA.planeIndex === pIdx) {
          otherKey = `${c.planeB.mechanismIndex},${c.planeB.planeIndex}`;
        } else if (
          c.planeB.mechanismIndex === mIdx &&
          c.planeB.planeIndex === pIdx
        ) {
          otherKey = `${c.planeA.mechanismIndex},${c.planeA.planeIndex}`;
        }
        if (otherKey && !visited.has(otherKey) && depth + 1 <= maxDepth) {
          queue.push({ key: otherKey, depth: depth + 1 });
        }
      }
    }

    return { collectedPlanes, collectedMechIndices };
  }

  // ----- 选择与高亮（完整）-----
  handleConnectionSelect(hit) {
    if (this.selectedConnA && this.selectedConnA.mesh === hit.mesh) {
      this.restoreMaterial(this.selectedConnA);
      this.selectedConnA = null;
      this._markDirty();
      return;
    }
    if (this.selectedConnB && this.selectedConnB.mesh === hit.mesh) {
      this.restoreMaterial(this.selectedConnB);
      this.selectedConnB = null;
      this._markDirty();
      return;
    }
    if (!this.selectedConnA) {
      const orig = hit.mesh.material;
      hit.mesh.material = matConnCyan.clone();
      hit.mesh.material.needsUpdate = true;
      this.selectedConnA = {
        mesh: hit.mesh,
        originalMaterial: orig,
        mechanismIndex: hit.mechanismIndex,
        planeIndex: hit.planeIndex,
      };
      this._markDirty();
      return;
    }
    if (!this.selectedConnB && this.selectedConnA.mesh !== hit.mesh) {
      const orig = hit.mesh.material;
      hit.mesh.material = matConnPurple.clone();
      hit.mesh.material.needsUpdate = true;
      this.selectedConnB = {
        mesh: hit.mesh,
        originalMaterial: orig,
        mechanismIndex: hit.mechanismIndex,
        planeIndex: hit.planeIndex,
      };
      this._markDirty();
      return;
    }
    this.clearConnectionSelection();
    const orig = hit.mesh.material;
    hit.mesh.material = matConnCyan.clone();
    this.selectedConnA = {
      mesh: hit.mesh,
      originalMaterial: orig,
      mechanismIndex: hit.mechanismIndex,
      planeIndex: hit.planeIndex,
    };
    this._markDirty();
  }

  restoreMaterial(sel) {
    if (sel && sel.mesh && sel.originalMaterial) {
      sel.mesh.material = sel.originalMaterial;
      sel.mesh.material.needsUpdate = true;
    }
  }

  clearConnectionSelection() {
    if (this.selectedConnA) {
      this.restoreMaterial(this.selectedConnA);
      this.selectedConnA = null;
    }
    if (this.selectedConnB) {
      this.restoreMaterial(this.selectedConnB);
      this.selectedConnB = null;
    }
    this._markDirty();
  }

  clearHighlights() {
    for (const h of this.highlightMeshes || []) {
      if (h.mesh && h.original) {
        h.mesh.material = h.original;
        h.mesh.material.needsUpdate = true;
      }
    }
    this.highlightMeshes = [];
    this._markDirty();
  }

  clearConnectionChainHighlight() {
    for (const item of this.chainHighlightedPlanesL1) {
      if (item.mesh && item.original) {
        item.mesh.material = item.original;
        item.mesh.material.needsUpdate = true;
      }
    }
    this.chainHighlightedPlanesL1 = [];
    for (const item of this.chainHighlightedPlanesL2) {
      if (item.mesh && item.original) {
        item.mesh.material = item.original;
        item.mesh.material.needsUpdate = true;
      }
    }
    this.chainHighlightedPlanesL2 = [];
    this.highlightedFrameIndices.clear();
    this.highlightedConnectionIds.clear();
    this.updateAllFrames();
    this._markDirty();
  }

  /**
   * 高亮连接链（点击平面触发）
   * @param {object} hit - 包含 mechanismIndex 和 planeIndex 的对象
   */
  highlightConnectionChain(hit) {
    const idx = hit.mechanismIndex;
    const pi = hit.planeIndex;
    const mech = this.mechanisms[idx];
    if (!mech) return;

    // 清空旧高亮和选择状态
    this.clearHighlights();
    this.clearConnectionSelection();
    this.clearConnectionChainHighlight();

    // 设置当前激活状态
    this.activeIdx = idx;
    this.selectedPlaneData = hit;
    this._topoHighlightId = mech.id;
    this._markDirty();

    // 确定分支
    const branch = pi === 1 || pi === 2 ? "L1" : "L2";

    // 获取该分支的链（包含所有平面）
    const chain = this.getConnectionChain(idx, branch);
    const targetPlanes =
      chain.collectedPlanes.length > 0
        ? chain.collectedPlanes
        : mech.group.userData.allPlanes
            .filter((p) =>
              (branch === "L1" ? [1, 2] : [3, 4]).includes(p.planeIndex)
            )
            .map((p) => ({
              mechIdx: idx,
              planeIdx: p.planeIndex,
              mesh: p.mesh,
            }));

    // 应用高亮材质
    const chainMat = branch === "L1" ? matChainL1.clone() : matChainL2.clone();
    const highlightList =
      branch === "L1"
        ? this.chainHighlightedPlanesL1
        : this.chainHighlightedPlanesL2;

    for (const p of targetPlanes) {
      const orig = p.mesh.material;
      p.mesh.material = chainMat.clone();
      p.mesh.material.needsUpdate = true;
      highlightList.push({ mesh: p.mesh, original: orig });
    }

    // 高亮该链中的所有机构帧（颜色按分支）
    const mechIndices =
      chain.collectedMechIndices.size > 0
        ? chain.collectedMechIndices
        : new Set([idx]);
    const frameColor = branch === "L1" ? 0xffaa33 : 0xcc66ff;
    for (const i of mechIndices) {
      this.highlightedFrameIndices.add(i);
      this.updateFrameForMech(i, frameColor, 0.9);
    }

    // 高亮该链中的所有连接边（可选）
    this.highlightedConnectionIds.clear();
    for (const c of this.connections) {
      const a = c.planeA.mechanismIndex;
      const b = c.planeB.mechanismIndex;
      if (mechIndices.has(a) && mechIndices.has(b)) {
        this.highlightedConnectionIds.add(c.id);
      }
    }

    // 更新所有帧的可见性
    this.updateAllFrames();
    this._markDirty();
  }

  updateFrameForMech(idx, color, opacity = 0.9) {
    const m = this.mechanisms[idx];
    if (!m) return;
    const frame = m.group.userData.frame;
    if (!frame) return;
    frame.material.color.setHex(color);
    frame.material.opacity = opacity;
    frame.material.transparent = true;
    frame.visible = true;
    frame.material.needsUpdate = true;
  }

  updateAllFrames() {
    for (let i = 0; i < this.mechanisms.length; i++) {
      if (this.highlightedFrameIndices.has(i)) continue;
      const m = this.mechanisms[i];
      const frame = m.group.userData.frame;
      if (!frame) continue;
      if (i === this.activeIdx) {
        frame.material.color.setHex(0xffffff);
        frame.material.opacity = 0.3;
        frame.visible = true;
      } else {
        frame.material.opacity = 0;
        frame.visible = false;
      }
      frame.material.needsUpdate = true;
    }
  }

  // ----- 约束（不变）-----
  applyConstraints() {
    if (this.connections.length === 0) return;
    let changed = false;
    for (const c of this.connections) {
      const mA = this.mechanisms[c.planeA.mechanismIndex];
      const mB = this.mechanisms[c.planeB.mechanismIndex];
      if (!mA || !mB) continue;
      if (Math.abs(mA.cubeSize - mB.cubeSize) > 0.001) continue;
      const ca = getPlaneWorldCenter(mA, c.planeA.planeIndex);
      const cb = getPlaneWorldCenter(mB, c.planeB.planeIndex);
      const delta = ca.clone().sub(cb);
      if (delta.length() > 0.0001) {
        mB.position.add(delta);
        mB.group.position.copy(mB.position);
        changed = true;
      }
    }
    if (changed) this._markDirty();
  }

  /**
   * 检测机构是否处于"双环锁定"状态：
   * 只有当该机构同时参与同一个回环，且在该环中同时使用了 L1（平面1/2）和 L2（平面3/4）时，才返回 true。
   */
  isInBothLoops(idx) {
    if (idx < 0 || idx >= this.mechanisms.length) return false;
    const n = this.mechanisms.length;
    if (n < 2) return false;

    // ✅ 基准平面的虚拟节点索引（紧随所有机构之后）
    const BASE_NODE = n;

    const adj = new Map();
    for (let i = 0; i <= n; i++) adj.set(i, []); // 节点 0..n（含基准平面）
    for (const c of this.connections) {
      const ra = c.planeA.mechanismIndex;
      const rb = c.planeB.mechanismIndex;
      // ✅ 把 -1 映射到 BASE_NODE，其他不变
      const a = ra === -1 ? BASE_NODE : ra;
      const b = rb === -1 ? BASE_NODE : rb;
      if (a === b) continue;
      if (!adj.has(a) || !adj.has(b)) continue;
      adj.get(a).push({ neighbor: b, plane: c.planeA.planeIndex });
      adj.get(b).push({ neighbor: a, plane: c.planeB.planeIndex });
    }

    const isL1 = (p) => p === 1 || p === 2;
    const isL2 = (p) => p === 3 || p === 4;

    const visited = new Set();
    const path = [];
    let found = false;

    function dfs(node, parent) {
      if (found) return;
      visited.add(node);
      path.push(node);

      for (const edge of adj.get(node) || []) {
        if (edge.neighbor === parent) continue;
        if (!visited.has(edge.neighbor)) {
          dfs(edge.neighbor, node);
          if (found) return;
        } else if (path.includes(edge.neighbor)) {
          const cycleStart = path.indexOf(edge.neighbor);
          const cycle = path.slice(cycleStart);
          if (cycle.includes(idx)) {
            const pos = cycle.indexOf(idx);
            const prevNode = cycle[(pos - 1 + cycle.length) % cycle.length];
            const nextNode = cycle[(pos + 1) % cycle.length];
            let planePrev = null,
              planeNext = null;
            for (const e of adj.get(idx) || []) {
              if (e.neighbor === prevNode) planePrev = e.plane;
              if (e.neighbor === nextNode) planeNext = e.plane;
            }
            if (planePrev !== null && planeNext !== null) {
              if (
                (isL1(planePrev) && isL2(planeNext)) ||
                (isL2(planePrev) && isL1(planeNext))
              ) {
                found = true;
                return;
              }
            }
          }
        }
      }
      visited.delete(node);
      path.pop();
    }

    dfs(idx, -1);
    return found;
  }

  getAffectedIndices(idx) {
    const visited = new Set();
    const queue = [idx];
    visited.add(idx);
    while (queue.length) {
      const cur = queue.shift();
      const conns = this._adjList.get(cur) || [];
      for (const c of conns) {
        let nb = -1;
        if (c.planeA.mechanismIndex === cur) nb = c.planeB.mechanismIndex;
        else if (c.planeB.mechanismIndex === cur) nb = c.planeA.mechanismIndex;
        if (nb !== -1 && !visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    return Array.from(visited);
  }

  // ----- 动画系统（不变）-----
  applyTargetState(target, affected, hasL1, hasL2) {
    for (let i = 0; i < affected.length; i++) {
      const idx = affected[i];
      const mech = this.mechanisms[idx];
      if (!mech) continue;
      const tgt = target[i];
      if (tgt.position) {
        mech.position.copy(tgt.position);
        mech.group.position.copy(mech.position);
      }
      if (tgt.quaternion) {
        mech.group.quaternion.copy(tgt.quaternion);
        mech.worldRotation.setFromQuaternion(mech.group.quaternion);
        mech.normal = new THREE.Vector3(0, 0, 1)
          .applyEuler(mech.worldRotation)
          .normalize();
      }
      if (hasL1 && i === 0 && tgt.l1Angle !== undefined) {
        mech.l1Angle = normalizeAngleDeg(tgt.l1Angle);
        mech.group.userData.l1.rotation.z = THREE.MathUtils.degToRad(
          mech.l1Angle
        );
      }
      if (hasL2 && i === 0 && tgt.l2Angle !== undefined) {
        mech.l2Angle = normalizeAngleDeg(tgt.l2Angle);
        mech.group.userData.l2.rotation.z = THREE.MathUtils.degToRad(
          mech.l2Angle
        );
      }
    }
    this._markDirty();
    this.updateAllFrames();
  }

  startAnimation(
    init,
    target,
    affected,
    dur,
    hasL1,
    hasL2,
    onComplete,
    noConstraint = false,
    arcData = null
  ) {
    if (this.animState.active) {
      this.applyTargetState(
        this.animState.target,
        this.animState.affectedIndices,
        this.animState.hasL1,
        this.animState.hasL2
      );
      this.animState.active = false;
    }

    if (!this._animEnabled || dur <= 0) {
      this.applyTargetState(target, affected, hasL1, hasL2);
      if (onComplete) onComplete();
      return;
    }

    let changed = false;
    for (let i = 0; i < affected.length; i++) {
      const idx = affected[i];
      const initState = init[i];
      const tgt = target[i];
      if (initState.position.distanceTo(tgt.position) > 0.0001) {
        changed = true;
        break;
      }
      if (initState.quaternion.angleTo(tgt.quaternion) > 0.0001) {
        changed = true;
        break;
      }
      if (
        hasL1 &&
        i === 0 &&
        Math.abs(initState.l1Angle - tgt.l1Angle) > 0.01
      ) {
        changed = true;
        break;
      }
      if (
        hasL2 &&
        i === 0 &&
        Math.abs(initState.l2Angle - tgt.l2Angle) > 0.01
      ) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      if (onComplete) onComplete();
      return;
    }

    const initCopy = init.map((s) => ({
      position: s.position.clone(),
      quaternion: s.quaternion.clone(),
      l1Angle: s.l1Angle !== undefined ? s.l1Angle : undefined,
      l2Angle: s.l2Angle !== undefined ? s.l2Angle : undefined,
    }));
    const tgtCopy = target.map((s) => ({
      position: s.position.clone(),
      quaternion: s.quaternion.clone(),
      l1Angle: s.l1Angle !== undefined ? s.l1Angle : undefined,
      l2Angle: s.l2Angle !== undefined ? s.l2Angle : undefined,
    }));

    for (let i = 0; i < initCopy.length; i++) {
      const initState = initCopy[i];
      const tgtState = tgtCopy[i];
      if (initState.l1Angle !== undefined && tgtState.l1Angle !== undefined) {
        let diff = tgtState.l1Angle - initState.l1Angle;
        while (diff > 180) {
          tgtState.l1Angle -= 360;
          diff -= 360;
        }
        while (diff < -180) {
          tgtState.l1Angle += 360;
          diff += 360;
        }
      }
      if (initState.l2Angle !== undefined && tgtState.l2Angle !== undefined) {
        let diff = tgtState.l2Angle - initState.l2Angle;
        while (diff > 180) {
          tgtState.l2Angle -= 360;
          diff -= 360;
        }
        while (diff < -180) {
          tgtState.l2Angle += 360;
          diff += 360;
        }
      }
    }

    this.animState.active = true;
    this.animState.startTime = performance.now();
    this.animState.duration = Math.max(20, dur);
    this.animState.progress = 0;
    this.animState.initial = initCopy;
    this.animState.target = tgtCopy;
    this.animState.affectedIndices = [...affected];
    this.animState.hasL1 = !!hasL1;
    this.animState.hasL2 = !!hasL2;
    this.animState.onComplete = onComplete || null;
    this.animState.easing = "easeInOut";
    this.animState.noConstraint = !!noConstraint;
    this.animState.arcData = arcData;
  }

  cancelAnimation() {
    if (this.animState.active) {
      this.applyTargetState(
        this.animState.target,
        this.animState.affectedIndices,
        this.animState.hasL1,
        this.animState.hasL2
      );
      this.animState.active = false;
      if (this.animState.onComplete) {
        const cb = this.animState.onComplete;
        this.animState.onComplete = null;
        cb();
      }
    }
  }

  updateAnimation(now) {
    if (!this.animState.active) return;
    const elapsed = now - this.animState.startTime;
    let raw = Math.min(elapsed / this.animState.duration, 1);
    const ease = easeInOutCubic(raw);

    for (let i = 0; i < this.animState.affectedIndices.length; i++) {
      const idx = this.animState.affectedIndices[i];
      const mech = this.mechanisms[idx];
      if (!mech) continue;
      const init = this.animState.initial[i];
      const tgt = this.animState.target[i];

      let pos;
      if (this.animState.arcData) {
        const { center, axis, angle } = this.animState.arcData;
        const q = new THREE.Quaternion().setFromAxisAngle(axis, angle * ease);
        const off = init.position.clone().sub(center);
        off.applyQuaternion(q);
        pos = center.clone().add(off);
      } else {
        pos = new THREE.Vector3().lerpVectors(
          init.position,
          tgt.position,
          ease
        );
      }
      mech.position.copy(pos);
      mech.group.position.copy(mech.position);

      if (init.quaternion && tgt.quaternion) {
        const q = new THREE.Quaternion().slerpQuaternions(
          init.quaternion,
          tgt.quaternion,
          ease
        );
        mech.group.quaternion.copy(q);
        mech.worldRotation.setFromQuaternion(mech.group.quaternion);
        mech.normal = new THREE.Vector3(0, 0, 1)
          .applyEuler(mech.worldRotation)
          .normalize();
      }

      if (i === 0) {
        if (
          this.animState.hasL1 &&
          init.l1Angle !== undefined &&
          tgt.l1Angle !== undefined
        ) {
          const a = init.l1Angle + (tgt.l1Angle - init.l1Angle) * ease;
          mech.l1Angle = a;
          mech.group.userData.l1.rotation.z = THREE.MathUtils.degToRad(a);
        }
        if (
          this.animState.hasL2 &&
          init.l2Angle !== undefined &&
          tgt.l2Angle !== undefined
        ) {
          const a = init.l2Angle + (tgt.l2Angle - init.l2Angle) * ease;
          mech.l2Angle = a;
          mech.group.userData.l2.rotation.z = THREE.MathUtils.degToRad(a);
        }
      }
    }

    if (
      !this.animState.noConstraint &&
      this.connections.length > 0 &&
      this.animState.affectedIndices.length > 0
    ) {
      const aff = new Set(this.animState.affectedIndices);
      for (const c of this.connections) {
        const ia = c.planeA.mechanismIndex,
          ib = c.planeB.mechanismIndex;
        if (!aff.has(ia) || !aff.has(ib)) continue;
        const mA = this.mechanisms[ia],
          mB = this.mechanisms[ib];
        if (!mA || !mB) continue;
        if (Math.abs(mA.cubeSize - mB.cubeSize) > 0.001) continue;
        const ca = getPlaneWorldCenter(mA, c.planeA.planeIndex);
        const cb = getPlaneWorldCenter(mB, c.planeB.planeIndex);
        const delta = ca.clone().sub(cb);
        if (delta.length() > 0.0001) {
          mB.position.add(delta);
          mB.group.position.copy(mB.position);
        }
      }
    }

    this._markDirty();

    if (raw >= 1) {
      this.animState.active = false;
      this.applyTargetState(
        this.animState.target,
        this.animState.affectedIndices,
        this.animState.hasL1,
        this.animState.hasL2
      );
      if (!this.animState.noConstraint) this.applyConstraints();
      if (this.animState.onComplete) {
        const cb = this.animState.onComplete;
        this.animState.onComplete = null;
        cb();
      }
      this._saveState();
    }
  }

  // ----- 辅助（不变）-----
  _rebuildAdjList() {
    this._adjList.clear();
    for (const c of this.connections) {
      const a = c.planeA.mechanismIndex;
      const b = c.planeB.mechanismIndex;
      if (!this._adjList.has(a)) this._adjList.set(a, []);
      if (!this._adjList.has(b)) this._adjList.set(b, []);
      this._adjList.get(a).push(c);
      this._adjList.get(b).push(c);
    }
  }

  /**
   * 重排所有连接的 id 为 1..N（按当前数组顺序）
   * 同时把 connIdCounter 重置为 N+1
   */
  _renumberConnections() {
    this.connections.forEach((c, i) => {
      c.id = i + 1;
    });
    this.connIdCounter = this.connections.length + 1;
  }

  /**
   * 校正所有机构和角度的精度，吸附到标准值
   * @private
   */
  _correctPrecision() {
    const epsPos = 0.0005;
    const epsAng = 0.001;
    for (const m of this.mechanisms) {
      // 位置
      m.position.x = snapValue(m.position.x, epsPos);
      m.position.y = snapValue(m.position.y, epsPos);
      m.position.z = snapValue(m.position.z, epsPos);
      m.group.position.copy(m.position);

      // 世界旋转（欧拉角）
      const euler = new THREE.Euler().setFromQuaternion(
        m.group.quaternion,
        "XYZ"
      );
      euler.x = THREE.MathUtils.degToRad(
        snapAngle(THREE.MathUtils.radToDeg(euler.x), epsAng)
      );
      euler.y = THREE.MathUtils.degToRad(
        snapAngle(THREE.MathUtils.radToDeg(euler.y), epsAng)
      );
      euler.z = THREE.MathUtils.degToRad(
        snapAngle(THREE.MathUtils.radToDeg(euler.z), epsAng)
      );
      m.worldRotation.copy(euler);
      m.group.quaternion.setFromEuler(euler);
      m.normal = new THREE.Vector3(0, 0, 1)
        .applyEuler(m.worldRotation)
        .normalize();

      // L1/L2 角度
      m.l1Angle = snapAngle(m.l1Angle, epsAng);
      m.l2Angle = snapAngle(m.l2Angle, epsAng);
      if (m.group.userData.l1) {
        m.group.userData.l1.rotation.z = THREE.MathUtils.degToRad(m.l1Angle);
      }
      if (m.group.userData.l2) {
        m.group.userData.l2.rotation.z = THREE.MathUtils.degToRad(m.l2Angle);
      }
    }
  }

  _markDirty() {
    this._dirty = true;
    this._constraintDirty = true;
    if (!this._updateScheduled) {
      this._updateScheduled = true;
      requestAnimationFrame(() => {
        this._updateScheduled = false;
        if (this._dirty) {
          this._dirty = false;
          if (this.onUpdate) this.onUpdate();
        }
      });
    }
  }

  /**
   * 序列化当前状态（用于保存/撤销）
   * @returns {object} 包含机构和连接数据的纯对象
   */
  serialize() {
    const thickness =
      this.mechanisms.length > 0 ? this.mechanisms[0].thickness : 0.125;

    const r6 = (v) => Math.round(v * 1e6) / 1e6;

    const mechanisms = this.mechanisms.map((m) => {
      const qW = m.group
        ? m.group.quaternion
        : new THREE.Quaternion().setFromEuler(m.worldRotation);

      const worldNormal = (local, lAngle) => {
        const v = local.clone();
        const qL = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          THREE.MathUtils.degToRad(lAngle)
        );
        v.applyQuaternion(qL);
        v.applyQuaternion(qW);
        return v.multiplyScalar(m.cubeSize);
      };

      const n1 = worldNormal(new THREE.Vector3(0, 0, -1), m.l1Angle);
      const n2 = worldNormal(new THREE.Vector3(1, 0, 0), m.l1Angle);
      const n4 = worldNormal(new THREE.Vector3(-1, 0, 0), m.l2Angle);

      return {
        i: m.id,
        p: [r6(m.position.x), r6(m.position.y), r6(m.position.z)],
        s: r6(m.cubeSize),
        a: [r6(n1.x), r6(n1.y), r6(n1.z)],
        b: [r6(n2.x), r6(n2.y), r6(n2.z)],
        c: [r6(n4.x), r6(n4.y), r6(n4.z)],
      };
    });

    const connections = this.connections.map((c) => {
      const mA =
        c.planeA.mechanismIndex === -1
          ? 0
          : this.mechanisms[c.planeA.mechanismIndex].id;
      const mB =
        c.planeB.mechanismIndex === -1
          ? 0
          : this.mechanisms[c.planeB.mechanismIndex].id;
      return {
        i: c.id,
        a: [mA, c.planeA.planeIndex],
        b: [mB, c.planeB.planeIndex],
      };
    });

    return {
      _: FORMAT_COMMENT,
      v: 1,
      t: r6(thickness),
      m: mechanisms,
      c: connections,
      n: this.connIdCounter,
    };
  }

  restore(data) {
    // 清理旧机构
    for (const m of this.mechanisms) {
      this.sceneManager.removeObject(m.group);
      m.dispose();
    }
    this.mechanisms = [];
    this.connections = [];
    this.selectedPlaneData = null;
    this.selectedConnA = null;
    this.selectedConnB = null;
    this.highlightedFrameIndices.clear();
    this.chainHighlightedPlanesL1 = [];
    this.chainHighlightedPlanesL2 = [];
    this._adjList.clear();
    this._chainCache.clear();
    this._topoHighlightId = null;

    // ===== 格式判断：旧格式含 data.mechanisms，新格式用 data.m =====
    const isLegacy = Array.isArray(data.mechanisms);

    if (isLegacy) {
      // ---------- 旧格式（兼容） ----------
      this.connIdCounter = data.nextConnId || 1;

      for (const md of data.mechanisms) {
        const mech = Mechanism.fromJSON(md);
        this.mechanisms.push(mech);
        this.sceneManager.addObject(mech.group);
      }

      for (const cd of data.connections) {
        const resolveIdx = (side) => {
          if (side.mechanismId === 0) return -1;
          const idx = this.mechanisms.findIndex(
            (m) => m.id === side.mechanismId
          );
          return idx === -1 ? null : idx;
        };
        const idxA = resolveIdx(cd.planeA);
        const idxB = resolveIdx(cd.planeB);
        if (idxA === null || idxB === null) {
          console.warn("连接缺少机构，跳过", cd);
          continue;
        }
        this.connections.push({
          id: cd.id,
          planeA: { mechanismIndex: idxA, planeIndex: cd.planeA.planeIndex },
          planeB: { mechanismIndex: idxB, planeIndex: cd.planeB.planeIndex },
        });
      }

      if (this.connections.length > 0) {
        const maxId = Math.max(...this.connections.map((c) => c.id));
        this.connIdCounter = Math.max(maxId + 1, this.connIdCounter);
      }
    } else {
      // ---------- 新格式（简化命名） ----------
      this.connIdCounter = data.n || 1;
      const thickness = data.t;
      const idToIdx = new Map();

      // 1. 重建机构
      for (const md of data.m || []) {
        const mech = Mechanism.fromSimplifiedJSON(md, thickness);
        idToIdx.set(mech.id, this.mechanisms.length);
        this.mechanisms.push(mech);
        this.sceneManager.addObject(mech.group);
      }

      // 2. 重建连接（mechanismId = 0 表示基准平面 → mechanismIndex = -1）
      for (const cd of data.c || []) {
        const [mA, pA] = cd.a;
        const [mB, pB] = cd.b;
        const idxA = mA === 0 ? -1 : idToIdx.get(mA);
        const idxB = mB === 0 ? -1 : idToIdx.get(mB);
        if (idxA === undefined || idxB === undefined) {
          console.warn("连接缺少机构，跳过", cd);
          continue;
        }
        this.connections.push({
          id: cd.i,
          planeA: { mechanismIndex: idxA, planeIndex: pA },
          planeB: { mechanismIndex: idxB, planeIndex: pB },
        });
      }

      if (this.connections.length > 0) {
        const maxId = Math.max(...this.connections.map((c) => c.id));
        this.connIdCounter = Math.max(maxId + 1, this.connIdCounter);
      }
    }

    this._rebuildAdjList();
    this._chainCache.clear();
    this._topoVersion++;

    if (this.mechanisms.length > 0) {
      this.activeIdx = 0;
      this._topoHighlightId = this.mechanisms[0].id;
    } else {
      this.activeIdx = -1;
      this._topoHighlightId = null;
    }

    this._correctPrecision();
    this.applyConstraints();
    this.updateAllFrames();
    this._markDirty();
    this._renumberConnections(); // 可选：导入后立即重排
  }

  _saveState() {
    this._correctPrecision(); // 保存前校正
    this.history.push(this.serialize());
  }

  undo() {
    const state = this.history.undo();
    if (state) {
      this.restore(state);
      return true;
    }
    return false;
  }

  redo() {
    const state = this.history.redo();
    if (state) {
      this.restore(state);
      return true;
    }
    return false;
  }

  // ----- 清理（不变）-----
  destroy() {
    if (this._disposed) return;
    this._disposed = true;

    for (const m of this.mechanisms) {
      this.sceneManager.removeObject(m.group);
      m.dispose();
    }
    this.mechanisms = [];
    this.connections = [];
    this._adjList.clear();
    this._chainCache.clear();
    this.history.clear();

    this._boundListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this._boundListeners = [];

    if (this.animState.active) {
      this.animState.active = false;
      this.animState.onComplete = null;
    }
    this.onUpdate = null;
  }

  renumber() {
    if (this.mechanisms.length === 0) return false;

    // 清空选择/高亮状态
    this.activeIdx = -1;
    this.selectedPlaneData = null;
    this.selectedConnA = null;
    this.selectedConnB = null;
    this.highlightedFrameIndices.clear();
    this.highlightedConnectionIds.clear();
    this.chainHighlightedPlanesL1 = [];
    this.chainHighlightedPlanesL2 = [];
    this._topoHighlightId = null;

    // 执行重排序（原地修改）
    renumberBySizeThenGraph(this.mechanisms, this.connections);

    // 重建数据结构
    this._rebuildAdjList();
    this._chainCache.clear();
    this._topoVersion++;
    this._renumberConnections();

    // 更新场景中所有 group 的引用顺序不影响渲染
    this._markDirty();
    this._saveState();
    return true;
  }

  clearAll(recordHistory = true) {
    for (const m of this.mechanisms) {
      this.sceneManager.removeObject(m.group);
      m.dispose();
    }
    this.mechanisms = [];
    this.connections = [];
    this._adjList.clear();
    this._chainCache.clear();
    this.connIdCounter = 1;
    this._topoVersion++;
    this.activeIdx = -1;
    this.selectedPlaneData = null;
    this.highlightedFrameIndices.clear();
    this.chainHighlightedPlanesL1 = [];
    this.chainHighlightedPlanesL2 = [];
    this.selectedConnA = null;
    this.selectedConnB = null;
    this._markDirty();
    if (recordHistory) this._saveState();
  }
}
