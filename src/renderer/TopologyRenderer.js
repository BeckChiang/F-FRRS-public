import {
  roundToCent,
  normalizeAngleDeg,
  getPlaneWorldCenter,
} from "../utils/GeometryUtils.js";
import { t } from "../utils/i18n.js";
/**
 * 拓扑图渲染器
 * - 绘制机构节点和连接边
 * - 支持缓存（通过版本号和图像数据）
 * - 可启用/禁用绘制
 */
export class TopologyRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - 目标 canvas 元素
   * @param {AppState} appState - 应用状态
   */
  constructor(canvas, appState) {
    this.canvas = canvas;
    this.appState = appState;
    this.version = -1; // 记录上次绘制时的拓扑版本
    this._lastCacheKey = null; // 拓扑图缓存键（版本+高亮+主题）
    this.imageData = null; // 缓存的图像数据（dataURL）
    this.enabled = true; // 是否启用绘制
    this.autoRefresh = true; // 自动模式（≤ 阈值）：允许 refresh()；false 时仅 forceRefresh 重绘
    this._drawPending = false;
  }

  /**
   * 刷新拓扑图（缓存键：拓扑版本 + 高亮机构 + 高亮连接 + 主题）
   * 未变化时直接跳过，避免每次 UI 刷新都重跑力导向布局；
   * 手动模式（autoRefresh=false）下自动刷新一律跳过，仅响应 forceRefresh
   * @param {number|string} highlightedId - 高亮机构 ID
   */
  refresh(highlightedId) {
    if (!this.enabled) {
      this._drawDisabled();
      return;
    }
    if (!this.autoRefresh) return; // 手动模式：保留现有画面，等待刷新控件
    const key = this._cacheKey(highlightedId);
    if (key === this._lastCacheKey && this.imageData) {
      return; // 画布内容仍有效，无需重绘
    }
    this._lastCacheKey = key;
    this.version = this.appState._topoVersion;
    this._draw(highlightedId);
  }

  _cacheKey(highlightedId) {
    const theme = document.body?.classList?.contains?.("light-theme") ? "light" : "dark";
    const connSig = Array.from(this.appState.highlightedConnectionIds || []).join(",");
    return `${this.appState._topoVersion}|${highlightedId}|${connSig}|${theme}`;
  }

  /**
   * 绘制拓扑图到指定的 canvas（用于模态框放大等场景）
   * @param {number|string} highlightedId - 需要高亮的机构 ID
   * @param {HTMLCanvasElement} canvas - 目标 canvas 元素
   * @param {number} width - 画布逻辑宽度（像素）
   * @param {number} height - 画布逻辑高度（像素）
   * @returns {HTMLCanvasElement} 绘制完成的 canvas
   */
  drawTopology(highlightedId, canvas, width, height) {
    // 直接调用内部绘制方法，传入 canvas 和尺寸
    return this._drawTopology(highlightedId, canvas, width, height);
  }

  /**
   * 实际绘制（异步，通过 requestAnimationFrame 节流）
   * @param {number|string} highlightedId
   */
  _draw(highlightedId, canvasOverride, widthOverride, heightOverride) {
    const canvas = canvasOverride || this.canvas;
    if (!canvas) return;

    let actualW, actualH;
    if (widthOverride && heightOverride) {
      actualW = widthOverride;
      actualH = heightOverride;
    } else {
      const rect = canvas.parentElement?.getBoundingClientRect?.() || {
        width: 0,
        height: 0,
      };
      actualW = canvas.clientWidth || rect.width || 400;
      actualH = canvas.clientHeight || rect.height || 225;
    }
    if (this._drawPending) return;
    this._drawPending = true;
    requestAnimationFrame(() => {
      this._drawPending = false;
      const canvas = this.canvas;
      const ctx = canvas.getContext("2d");
      this._drawTopology(highlightedId, canvas);
      try {
        this.imageData = canvas.toDataURL("image/png");
      } catch (e) { }
    });
  }

  /**
   * 清空画布（保留兼容；禁用状态由 _drawDisabled 绘制提示）
   */
  clearCanvas() { }
  /**
   * 禁用时显示提示信息
   */
  _drawDisabled() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");
    const rect = canvas.parentElement?.getBoundingClientRect?.() || {
      width: 400,
      height: 225,
    };
    const w = canvas.clientWidth || rect.width || 400;
    const h = canvas.clientHeight || rect.height || (w * 9) / 16;
    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#aaa";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("拓扑图已禁用", w / 2, h / 2);
  }

  /**
   * 启用/禁用绘制
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this._drawDisabled();
    } else {
      this._lastCacheKey = null;
      this.refresh(this.appState._topoHighlightId);
    }
  }

  /**
   * 强制刷新拓扑图（忽略缓存）
   * @param {number|string} highlightedId - 高亮机构ID
   */
  // TopologyRenderer.js
  forceRefresh(highlightedId) {
    // 强制重绘后该键视为已缓存，避免紧跟着的相同 refresh 再画一次
    this._lastCacheKey = this._cacheKey(highlightedId);
    this.version = -1;
    this.imageData = null;
    this._drawPending = false;
    this._draw(highlightedId);
  }

  // ==================== 核心绘图函数 ====================
  _drawTopology(highlightedId, canvasEl, widthOverride, heightOverride) {
    // ---- 画布设置 ----
    const LOGIC_W = 800,
      LOGIC_H = 450;
    const logicMin = Math.min(LOGIC_W, LOGIC_H);
    const margin = 0.06 * logicMin;

    const canvas = canvasEl || this.canvas;
    if (!canvas) return;

    let actualW, actualH;
    if (widthOverride && heightOverride) {
      actualW = widthOverride;
      actualH = heightOverride;
    } else {
      const rect = canvas.parentElement?.getBoundingClientRect?.() || {
        width: 400,
        height: 225,
      };
      actualW = canvas.clientWidth || rect.width || 400;
      actualH = canvas.clientHeight || rect.height || (actualW * 9) / 16;
    }
    actualW = Math.max(200, actualW);
    actualH = Math.max(150, actualH);

    const dpr = 3;
    canvas.width = actualW * dpr;
    canvas.height = actualH * dpr;
    canvas.style.width = actualW + "px";
    canvas.style.height = actualH + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const scaleX = actualW / LOGIC_W;
    const scaleY = actualH / LOGIC_H;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (actualW - LOGIC_W * scale) / 2;
    const offsetY = (actualH - LOGIC_H * scale) / 2;

    // ---- 数据 ----
    const mechs = this.appState.mechanisms || [];
    const conns = this.appState.connections || [];
    const n = mechs.length;
    if (n === 0) {
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#b0b0b0";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("暂无机构", LOGIC_W / 2, LOGIC_H / 2);
      ctx.restore();
      return;
    }

    // ---- 尺寸参数 ----
    const baseScale = logicMin / 400;
    const sizeFactor = Math.max(0.5, Math.min(2, 6 / Math.sqrt(n + 1)));
    const baseNodeSize = Math.max(12, Math.min(40, 28 * sizeFactor));
    const nodeDiameter = 2 * baseNodeSize;
    const fontSize = Math.max(10, Math.min(26, 16 * sizeFactor));
    const lineWidth = Math.max(1.5, Math.min(5.0, 3.0 * sizeFactor * 0.9));
    const highlightLineWidth = lineWidth * 1.8;
    const labelOffset = Math.max(10, 18 * sizeFactor * 0.7);
    const arcOffsetBase = Math.max(14, 28 * sizeFactor * 0.6);
    const cycleNodeSize = baseNodeSize * 1.1;
    const highlightNodeSize = baseNodeSize * 1.3;

    const isLight =
      document.body?.classList?.contains?.("light-theme") || false;
    const colors = {
      node: isLight ? "#2563eb" : "#4a9eff",
      edge: isLight ? "#8899aa" : "#8899aa",
      cycleNode: isLight ? "#e67e22" : "#ff8800",
      cycleEdge: isLight ? "#e67e22" : "#ff8800",
      highlightNode: isLight ? "#00aa44" : "#00cc66",
      highlightEdge: isLight ? "#00aaff" : "#00ccff",
      highlightCycleEdge: isLight ? "#cc2222" : "#ff4444",
      labelBg: isLight ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.80)",
      dashEdge: isLight ? "#cc6633" : "#ff8844",
    };

    // ---- 图数据提取 ----
    const adj = new Map();
    for (let i = 0; i < n; i++) adj.set(i, []);
    const edgeMap = new Map();
    for (const c of conns) {
      const a = c.planeA?.mechanismIndex;
      const b = c.planeB?.mechanismIndex;
      if (a === undefined || b === undefined || a === b) continue;
      if (a < 0 || b < 0) continue;               // ✅ 新增
      if (!adj.has(a) || !adj.has(b)) continue;   // ✅ 新增
      if (!adj.get(a).includes(b)) adj.get(a).push(b);
      if (!adj.get(b).includes(a)) adj.get(b).push(a);
      const key = Math.min(a, b) + "," + Math.max(a, b);
      if (!edgeMap.has(key)) edgeMap.set(key, c);
    }

    // 根节点
    let rootIdx = -1;
    if (highlightedId !== null && highlightedId !== undefined) {
      rootIdx = mechs.findIndex((m) => m.id === highlightedId);
    }
    if (rootIdx === -1 && n > 0) rootIdx = 0;
    const root = rootIdx >= 0 && rootIdx < n ? rootIdx : n > 0 ? 0 : -1;
    if (root === -1) {
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#b0b0b0";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("暂无机构", LOGIC_W / 2, LOGIC_H / 2);
      ctx.restore();
      return;
    }

    // BFS 获取层级和父节点
    const layer = new Map();
    const parent = new Map();
    const visitedBFS = new Set([root]);
    const queue = [{ node: root, dist: 0 }];
    layer.set(root, 0);
    parent.set(root, -1);
    while (queue.length) {
      const { node, dist } = queue.shift();
      for (const nb of adj.get(node) || []) {
        if (!visitedBFS.has(nb)) {
          visitedBFS.add(nb);
          layer.set(nb, dist + 1);
          parent.set(nb, node);
          queue.push({ node: nb, dist: dist + 1 });
        }
      }
    }

    // 回环检测（全局）
    const degree = new Map();
    for (let i = 0; i < n; i++) degree.set(i, adj.get(i).length);
    const qDeg = [];
    for (const [node, deg] of degree) if (deg <= 1) qDeg.push(node);
    while (qDeg.length) {
      const u = qDeg.shift();
      if (degree.get(u) > 0) {
        for (const v of adj.get(u) || []) {
          if (degree.get(v) > 0) {
            degree.set(v, degree.get(v) - 1);
            if (degree.get(v) === 1) qDeg.push(v);
          }
        }
        degree.set(u, 0);
      }
    }
    const cycleNodesGlobal = new Set();
    for (const [node, deg] of degree) if (deg >= 2) cycleNodesGlobal.add(node);

    // ---- 显示节点集合（深度≤1） ----
    const displayNodes = new Set();
    displayNodes.add(root);
    for (const [node, d] of layer) {
      if (d <= 1 && d > 0) displayNodes.add(node);
    }

    // 提取所有环
    function findCycles(start) {
      const cycles = [];
      const visited = new Set();
      const recStack = new Set();
      const path = [];
      function dfs(u, p) {
        visited.add(u);
        recStack.add(u);
        path.push(u);
        for (const v of adj.get(u) || []) {
          if (v === p) continue;
          if (!visited.has(v)) {
            if (dfs(v, u)) return true;
          } else if (recStack.has(v)) {
            const idx = path.indexOf(v);
            if (idx !== -1) {
              const cycle = path.slice(idx);
              if (cycle.length >= 3) {
                let dup = false;
                for (const c of cycles) {
                  if (
                    c.length === cycle.length &&
                    c.every((n, i) => n === cycle[i])
                  ) {
                    dup = true;
                    break;
                  }
                }
                if (!dup) cycles.push([...cycle]);
              }
            }
          }
        }
        recStack.delete(u);
        path.pop();
        return false;
      }
      if (!visited.has(start) && cycleNodesGlobal.has(start)) dfs(start, -1);
      return cycles;
    }
    const allCycles = [];
    const processed = new Set();
    for (const node of cycleNodesGlobal) {
      if (!processed.has(node)) {
        const cyc = findCycles(node);
        for (const c of cyc) {
          for (const n of c) processed.add(n);
          allCycles.push(c);
        }
      }
    }
    function mergeCycles(cycles) {
      if (cycles.length <= 1) return cycles;
      const merged = [];
      const used = new Set();
      for (let i = 0; i < cycles.length; i++) {
        if (used.has(i)) continue;
        let current = new Set(cycles[i]);
        let changed = true;
        while (changed) {
          changed = false;
          for (let j = i + 1; j < cycles.length; j++) {
            if (used.has(j)) continue;
            const other = new Set(cycles[j]);
            let inter = false;
            for (const node of current)
              if (other.has(node)) {
                inter = true;
                break;
              }
            if (inter) {
              for (const node of other) current.add(node);
              used.add(j);
              changed = true;
            }
          }
        }
        merged.push(Array.from(current));
        used.add(i);
      }
      return merged;
    }
    const closedCycles = mergeCycles(allCycles);

    // 处理环：含根环 -> 完整显示（≤8节点）否则只保留根及左右各1；不含根环 -> 仅保留入口节点
    const entryCycleNodes = new Set();
    // 含根环
    const rootCycles = closedCycles.filter((cyc) => cyc.includes(root));
    for (const cyc of rootCycles) {
      const count = cyc.length;
      if (count <= 8) {
        for (const node of cyc) displayNodes.add(node);
      } else {
        const rootIdxInCycle = cyc.indexOf(root);
        const len = cyc.length;
        const left = cyc[(rootIdxInCycle - 1 + len) % len];
        const right = cyc[(rootIdxInCycle + 1) % len];
        if (layer.get(left) <= 1) displayNodes.add(left);
        if (layer.get(right) <= 1) displayNodes.add(right);
      }
    }
    // 不含根环：只加入口节点（距离根最近）
    const cyclesWithoutRoot = closedCycles.filter((cyc) => !cyc.includes(root));
    for (const cyc of cyclesWithoutRoot) {
      let entry = cyc[0];
      let minDepth = Infinity;
      for (const node of cyc) {
        const d = layer.get(node) || 0;
        if (d < minDepth) {
          minDepth = d;
          entry = node;
        }
      }
      if (layer.get(entry) <= 1) {
        displayNodes.add(entry);
        entryCycleNodes.add(entry);
      }
    }

    // 深度=1节点构成的环（直连节点环）
    const depth1Nodes = new Set();
    for (const node of displayNodes) {
      if (layer.get(node) === 1) depth1Nodes.add(node);
    }
    const depth1Adj = new Map();
    for (const node of depth1Nodes) depth1Adj.set(node, []);
    for (const [key, conn] of edgeMap) {
      const a = conn.planeA?.mechanismIndex;
      const b = conn.planeB?.mechanismIndex;
      if (
        a !== undefined &&
        b !== undefined &&
        depth1Nodes.has(a) &&
        depth1Nodes.has(b)
      ) {
        if (!depth1Adj.get(a).includes(b)) depth1Adj.get(a).push(b);
        if (!depth1Adj.get(b).includes(a)) depth1Adj.get(b).push(a);
      }
    }
    const depth1CycleNodes = new Set();
    function findDepth1Cycles() {
      const cycles = [];
      const visited = new Set();
      const recStack = new Set();
      const path = [];
      function dfs(u, p) {
        visited.add(u);
        recStack.add(u);
        path.push(u);
        for (const v of depth1Adj.get(u) || []) {
          if (v === p) continue;
          if (!visited.has(v)) {
            if (dfs(v, u)) return true;
          } else if (recStack.has(v)) {
            const idx = path.indexOf(v);
            if (idx !== -1) {
              const cycle = path.slice(idx);
              if (cycle.length >= 3) {
                let dup = false;
                for (const c of cycles) {
                  if (
                    c.length === cycle.length &&
                    c.every((n, i) => n === cycle[i])
                  ) {
                    dup = true;
                    break;
                  }
                }
                if (!dup) cycles.push([...cycle]);
              }
            }
          }
        }
        recStack.delete(u);
        path.pop();
        return false;
      }
      for (const node of depth1Nodes) {
        if (!visited.has(node) && depth1Adj.get(node).length >= 2)
          dfs(node, -1);
      }
      return cycles;
    }
    const depth1Cycles = findDepth1Cycles();
    for (const cyc of depth1Cycles) {
      for (const node of cyc) depth1CycleNodes.add(node);
    }

    // ---- 构建子图并统一环标记 ----
    const subAdj = new Map();
    for (const node of displayNodes) subAdj.set(node, []);
    const subEdgeMap = new Map();
    for (const [key, conn] of edgeMap) {
      const a = conn.planeA?.mechanismIndex;
      const b = conn.planeB?.mechanismIndex;
      if (a === undefined || b === undefined) continue;
      if (a < 0 || b < 0) continue; // ✅
      if (displayNodes.has(a) && displayNodes.has(b)) {
        if (!subAdj.get(a).includes(b)) subAdj.get(a).push(b);
        if (!subAdj.get(b).includes(a)) subAdj.get(b).push(a);
        subEdgeMap.set(key, conn);
      }
    }

    // 子图环检测
    const subDegree = new Map();
    for (const node of displayNodes)
      subDegree.set(node, subAdj.get(node).length);
    const subQ = [];
    for (const [node, deg] of subDegree) if (deg <= 1) subQ.push(node);
    while (subQ.length) {
      const u = subQ.shift();
      if (subDegree.get(u) > 0) {
        for (const v of subAdj.get(u) || []) {
          if (subDegree.get(v) > 0) {
            subDegree.set(v, subDegree.get(v) - 1);
            if (subDegree.get(v) === 1) subQ.push(v);
          }
        }
        subDegree.set(u, 0);
      }
    }
    const subCycleNodes = new Set();
    for (const [node, deg] of subDegree) if (deg >= 2) subCycleNodes.add(node);

    // 合并所有环标记
    const allCycleNodes = new Set([
      ...subCycleNodes,
      ...entryCycleNodes,
      ...depth1CycleNodes,
    ]);

    // ---- 布局：初始位置 + 力导向 + 环固定 + 碰撞后处理 ----
    const nodeList = Array.from(displayNodes);
    const centerX = LOGIC_W / 2,
      centerY = LOGIC_H / 2;

    function seededRandom(seed) {
      const a = 1664525,
        c = 1013904223,
        m = 4294967296;
      seed = (a * seed + c) % m;
      return seed / m;
    }
    const pos = new Map();
    pos.set(root, { x: centerX, y: centerY });
    for (const node of nodeList) {
      if (node === root) continue;
      const seed = node * 9301 + 49297;
      const angle = seededRandom(seed) * 2 * Math.PI;
      const dist = baseNodeSize * 2.5 * (0.5 + seededRandom(seed + 1) * 0.5);
      pos.set(node, {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
      });
    }

    // 固定小环（含根环，≤8节点）
    const smallRootCycles = closedCycles.filter(
      (cyc) => cyc.includes(root) && cyc.length <= 8
    );
    const fixedRingNodes = new Set();
    const ringInfo = [];
    for (const cyc of smallRootCycles) {
      const count = cyc.length;
      const radius = baseNodeSize * 2.8 * (1 + count / 12);
      const cx = centerX - radius * 0.7;
      const cy = centerY;
      const angleStep = (2 * Math.PI) / count;
      const rootIdxInCycle = cyc.indexOf(root);
      const startAngle = -rootIdxInCycle * angleStep;
      for (let i = 0; i < count; i++) {
        const node = cyc[i];
        const angle = startAngle + i * angleStep;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle) * 0.9;
        pos.set(node, { x, y });
        fixedRingNodes.add(node);
      }
      ringInfo.push({ cx, cy, radius, nodes: cyc });
    }

    // 力导向迭代
    const iterations = 250;
    const repulsion = 3.0;
    const attraction = 0.06;
    const damping = 0.85;
    const maxSpeed = 20;

    const vel = new Map();
    for (const node of nodeList) vel.set(node, { vx: 0, vy: 0 });

    const edges = [];
    for (const [key, conn] of subEdgeMap) {
      const a = conn.planeA?.mechanismIndex;
      const b = conn.planeB?.mechanismIndex;
      if (
        a !== undefined &&
        b !== undefined &&
        displayNodes.has(a) &&
        displayNodes.has(b)
      ) {
        edges.push({ a, b });
      }
    }

    for (let iter = 0; iter < iterations; iter++) {
      // 斥力
      for (let i = 0; i < nodeList.length; i++) {
        const ni = nodeList[i];
        const pi = pos.get(ni);
        if (!pi) continue;
        for (let j = i + 1; j < nodeList.length; j++) {
          const nj = nodeList[j];
          const pj = pos.get(nj);
          if (!pj) continue;
          let sameRing = false;
          for (const info of ringInfo) {
            if (info.nodes.includes(ni) && info.nodes.includes(nj)) {
              sameRing = true;
              break;
            }
          }
          if (sameRing) continue;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = repulsion / (dist * dist + 0.1);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const vi = vel.get(ni);
          const vj = vel.get(nj);
          vi.vx += fx;
          vi.vy += fy;
          vj.vx -= fx;
          vj.vy -= fy;
        }
      }
      // 引力
      for (const e of edges) {
        const pa = pos.get(e.a);
        const pb = pos.get(e.b);
        if (!pa || !pb) continue;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = attraction * dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const va = vel.get(e.a);
        const vb = vel.get(e.b);
        va.vx -= fx;
        va.vy -= fy;
        vb.vx += fx;
        vb.vy += fy;
      }
      // 更新
      for (const node of nodeList) {
        if (fixedRingNodes.has(node)) continue;
        const p = pos.get(node);
        const v = vel.get(node);
        let vx = v.vx * damping;
        let vy = v.vy * damping;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > maxSpeed) {
          vx = (vx / speed) * maxSpeed;
          vy = (vy / speed) * maxSpeed;
        }
        p.x += vx;
        p.y += vy;
        v.vx = vx;
        v.vy = vy;
      }
    }

    // ---- 碰撞后处理 ----
    const nodeRadii = new Map();
    for (const node of displayNodes) {
      let r = baseNodeSize / 2;
      if (node === root) r = highlightNodeSize / 2;
      else if (allCycleNodes.has(node)) r = cycleNodeSize / 2;
      nodeRadii.set(node, r);
    }

    const pushIter = 30;
    const pushForce = 0.5;
    for (let iter = 0; iter < pushIter; iter++) {
      let moved = false;
      // 节点间排斥
      for (let i = 0; i < nodeList.length; i++) {
        const ni = nodeList[i];
        const pi = pos.get(ni);
        const ri = nodeRadii.get(ni) || baseNodeSize / 2;
        for (let j = i + 1; j < nodeList.length; j++) {
          const nj = nodeList[j];
          const pj = pos.get(nj);
          const rj = nodeRadii.get(nj) || baseNodeSize / 2;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const minDist = (ri + rj) * 1.2;
          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const push = overlap * pushForce;
            let sameRing = false;
            for (const info of ringInfo) {
              if (info.nodes.includes(ni) && info.nodes.includes(nj)) {
                sameRing = true;
                break;
              }
            }
            if (sameRing) continue;
            if (ni === root) {
              pj.x -= nx * push * 2;
              pj.y -= ny * push * 2;
            } else if (nj === root) {
              pi.x += nx * push * 2;
              pi.y += ny * push * 2;
            } else if (fixedRingNodes.has(ni) && !fixedRingNodes.has(nj)) {
              pj.x -= nx * push * 1.5;
              pj.y -= ny * push * 1.5;
            } else if (fixedRingNodes.has(nj) && !fixedRingNodes.has(ni)) {
              pi.x += nx * push * 1.5;
              pi.y += ny * push * 1.5;
            } else {
              const ratioI = rj / (ri + rj);
              const ratioJ = ri / (ri + rj);
              pi.x += nx * push * ratioI;
              pi.y += ny * push * ratioI;
              pj.x -= nx * push * ratioJ;
              pj.y -= ny * push * ratioJ;
            }
            moved = true;
          }
        }
      }
      // 环外节点与环的排斥
      for (const info of ringInfo) {
        const { cx, cy, radius } = info;
        for (const node of nodeList) {
          if (info.nodes.includes(node)) continue;
          const p = pos.get(node);
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = radius + nodeRadii.get(node) * 1.2;
          if (dist < minDist && dist > 0.001) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const push = overlap * pushForce * 0.8;
            p.x += nx * push;
            p.y += ny * push;
            moved = true;
          }
        }
      }
      // 边界修剪
      for (const node of nodeList) {
        if (fixedRingNodes.has(node) && node !== root) continue;
        const p = pos.get(node);
        p.x = Math.max(margin, Math.min(LOGIC_W - margin, p.x));
        p.y = Math.max(margin, Math.min(LOGIC_H - margin, p.y));
      }
      if (!moved) break;
    }

    // ---- 父子距离约束 ----
    const minDist = 2.5 * nodeDiameter;
    const maxDist = 3.0 * nodeDiameter;
    for (let iter = 0; iter < 20; iter++) {
      let moved = false;
      for (const node of displayNodes) {
        if (node === root || fixedRingNodes.has(node)) continue;
        const p = parent.get(node);
        if (p === undefined || p === -1) continue;
        if (!pos.has(p) || !pos.has(node)) continue;
        const pp = pos.get(p);
        const np = pos.get(node);
        const dx = np.x - pp.x;
        const dy = np.y - pp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) continue;
        let scale = 1;
        if (dist < minDist) scale = minDist / dist;
        else if (dist > maxDist) scale = maxDist / dist;
        if (scale !== 1) {
          np.x = pp.x + dx * scale;
          np.y = pp.y + dy * scale;
          np.x = Math.max(margin, Math.min(LOGIC_W - margin, np.x));
          np.y = Math.max(margin, Math.min(LOGIC_H - margin, np.y));
          moved = true;
        }
      }
      if (!moved) break;
    }

    // ---- 整体居中 ----
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of pos.values()) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const cxOff = LOGIC_W / 2 - (minX + maxX) / 2;
    const cyOff = LOGIC_H / 2 - (minY + maxY) / 2;
    for (const p of pos.values()) {
      p.x += cxOff;
      p.y += cyOff;
      p.x = Math.max(margin, Math.min(LOGIC_W - margin, p.x));
      p.y = Math.max(margin, Math.min(LOGIC_H - margin, p.y));
    }

    // ---- 绘制 ----
    function drawRoundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // ---- 边 ----
    const subEdges = [];
    for (const [key, conn] of subEdgeMap) {
      const a = conn.planeA?.mechanismIndex;
      const b = conn.planeB?.mechanismIndex;
      if (a === undefined || b === undefined || !pos.has(a) || !pos.has(b))
        continue;
      if (a === b) continue;
      const p1 = pos.get(a),
        p2 = pos.get(b);
      if (!p1 || !p2) continue;
      const isCycleEdge = allCycleNodes.has(a) && allCycleNodes.has(b);
      const isSelectedConn = false; // 简化，不处理选中高亮
      const isDirectRootEdge =
        (a === root || b === root) &&
        (layer.get(a) === 1 || layer.get(b) === 1);
      let edgeType = "normal";
      if (isSelectedConn) {
        edgeType = isCycleEdge ? "highlightCycle" : "highlight";
      } else if (isDirectRootEdge) {
        edgeType = isCycleEdge ? "highlightCycle" : "highlight";
      } else if (isCycleEdge) {
        edgeType = "cycle";
      }
      subEdges.push({ conn, a, b, p1, p2, edgeType });
    }

    // 计算弧形偏移
    for (const ed of subEdges) {
      let arcOffset = 0;
      if (ed.edgeType === "cycle" || ed.edgeType === "highlightCycle") {
        arcOffset = arcOffsetBase * 0.6;
      } else {
        const degA = subAdj.get(ed.a)?.length || 0;
        const degB = subAdj.get(ed.b)?.length || 0;
        if (degA > 2 || degB > 2) arcOffset = arcOffsetBase * 0.3;
      }
      ed.arcOffset = arcOffset;
      ed.arcSign = (ed.a + ed.b) % 2 === 0 ? 1 : -1;
    }

    for (const ed of subEdges) {
      const { conn, a, b, p1, p2, edgeType, arcOffset, arcSign } = ed;
      let color = colors.edge;
      let alpha = 0.7;
      let lw = lineWidth;
      switch (edgeType) {
        case "highlight":
          color = colors.highlightEdge;
          alpha = 1;
          lw = highlightLineWidth;
          break;
        case "highlightCycle":
          color = colors.highlightCycleEdge;
          alpha = 1;
          lw = highlightLineWidth;
          break;
        case "cycle":
          color = colors.cycleEdge;
          alpha = 0.9;
          lw = lineWidth * 1.2;
          break;
        default:
          color = colors.edge;
          alpha = 0.7;
          lw = lineWidth;
      }
      const useArc = arcOffset > 2 * baseScale;
      ctx.beginPath();
      let midX, midY, nx, ny;
      if (useArc) {
        const midX0 = (p1.x + p2.x) / 2;
        const midY0 = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        nx = -dy / len;
        ny = dx / len;
        const sign = arcSign || 1;
        const cpX = midX0 + nx * arcOffset * sign;
        const cpY = midY0 + ny * arcOffset * sign;
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cpX, cpY, p2.x, p2.y);
        midX = (p1.x + 2 * cpX + p2.x) / 4;
        midY = (p1.y + 2 * cpY + p2.y) / 4;
      } else {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        midX = (p1.x + p2.x) / 2;
        midY = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        nx = -dy / len;
        ny = dx / len;
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // ---- 边标签（智能放置，避免重叠） ----
      // 只对重要边显示标签（直接与根相连的边，或环边）
      if (edgeType === "normal" && !(a === root || b === root)) continue;
      const labelText = "#" + conn.id;
      const labelSize = Math.max(6, fontSize * 0.7);
      ctx.font = `bold ${labelSize}px sans-serif`;
      const metrics = ctx.measureText(labelText);
      const tw = metrics.width;
      const th = labelSize * 1.2;
      const pad = 2 * baseScale * sizeFactor;

      // 生成候选位置（沿法线方向偏移）
      const candidates = [];
      const offsets = [0.8, 1.2, 1.6];
      const signs = [1, -1];
      for (const offMul of offsets) {
        for (const s of signs) {
          const off = labelOffset * offMul;
          const x = midX + nx * off * s;
          const y = midY + ny * off * s;
          if (
            x - tw / 2 > 0 &&
            x + tw / 2 < LOGIC_W &&
            y - th / 2 > 0 &&
            y + th / 2 < LOGIC_H
          ) {
            candidates.push({ x, y, score: offMul + (s === 1 ? 0 : 1) });
          }
        }
      }
      candidates.sort((a, b) => a.score - b.score);

      // 简单冲突检测（与已放置标签）
      let best = null;
      for (const cand of candidates) {
        let overlap = false;
        // 这里可以维护一个已放置标签列表，但为简化，我们只检查是否与节点重叠（略）
        // 本实现不进行完整碰撞，仅取第一个可用
        best = cand;
        break;
      }
      if (!best) {
        best = { x: midX + nx * labelOffset, y: midY + ny * labelOffset };
      }

      // 绘制标签背景
      const rx = best.x - tw / 2 - pad;
      const ry = best.y - th / 2 - pad;
      ctx.fillStyle = colors.labelBg;
      ctx.shadowColor = "rgba(0,0,0,0.12)";
      ctx.shadowBlur = 3;
      drawRoundRect(ctx, rx, ry, tw + pad * 2, th + pad * 2, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 0.8 * baseScale;
      drawRoundRect(ctx, rx, ry, tw + pad * 2, th + pad * 2, 2);
      ctx.stroke();

      // 绘制标签文本
      ctx.fillStyle = colors.edge;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, best.x, best.y);
    }

    // ---- 节点 ----
    for (const node of displayNodes) {
      const p = pos.get(node);
      if (!p) continue;
      const isCycle = allCycleNodes.has(node);
      const isRoot = node === root;
      const isHighlight =
        isRoot || (highlightedId !== null && mechs[node]?.id === highlightedId);

      let radius = baseNodeSize / 2;
      let fillColor = colors.node;
      if (isHighlight) {
        radius = highlightNodeSize / 2;
        fillColor = colors.highlightNode;
      } else if (isCycle) {
        radius = cycleNodeSize / 2;
        fillColor = colors.cycleNode;
      }

      if (isHighlight) {
        ctx.shadowColor = fillColor;
        ctx.shadowBlur = 15;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText("#" + mechs[node].id, p.x, p.y);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    return canvas;
  }
}
