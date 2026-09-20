// src/utils/Renumber.js

/**
 * 按尺寸降序分组 + 组内连通分量图遍历重新编号（含回环处理）
 * 原地修改 mechs 和 conns。
 * @returns {{mechs, conns}}
 */
export function renumberBySizeThenGraph(mechs, conns) {
  const N = mechs.length;
  if (N === 0) return { mechs, conns };

  const allS = mechs.map((m) => m.cubeSize);
  const nNode = N + 1; // 节点 1 = 基准平面，节点 2..N+1 = 机构

  const idxToNode = (idx) => (idx === -1 ? 1 : idx + 2);

  // 邻接表
  const adj = Array.from({ length: nNode + 1 }, () => []);
  for (const c of conns) {
    const aNode = idxToNode(c.planeA.mechanismIndex);
    const bNode = idxToNode(c.planeB.mechanismIndex);
    if (aNode && bNode && aNode !== bNode) {
      adj[aNode].push(bNode);
      adj[bNode].push(aNode);
    }
  }

  // 状态
  const numbered = new Array(nNode + 1).fill(false);
  numbered[1] = true; // 基准平面视为已编号
  const newIdOf = new Array(nNode + 1).fill(0);
  newIdOf[1] = 0;
  let nextId = 1;

  // 按尺寸降序处理
  const uniqueS = [...new Set(allS)].sort((a, b) => b - a);

  for (const sz of uniqueS) {
    const idxSz = [];
    for (let k = 0; k < N; k++) {
      if (allS[k] === sz) idxSz.push(k + 2);
    }

    const remaining = new Set(idxSz.filter((n) => !numbered[n]));

    while (remaining.size > 0) {
      // ---- 选种子 ----
      let bestSeed = -1,
        bestConn = -1,
        bestDeg = -1,
        bestNode = Infinity;
      for (const node of remaining) {
        let connToNumbered = 0;
        let degInRemaining = 0;
        for (const nb of adj[node]) {
          if (numbered[nb]) connToNumbered++;
          if (remaining.has(nb)) degInRemaining++;
        }
        let better = false;
        if (connToNumbered > bestConn) better = true;
        else if (connToNumbered === bestConn && degInRemaining > bestDeg)
          better = true;
        else if (
          connToNumbered === bestConn &&
          degInRemaining === bestDeg &&
          node < bestNode
        )
          better = true;
        if (better) {
          bestSeed = node;
          bestConn = connToNumbered;
          bestDeg = degInRemaining;
          bestNode = node;
        }
      }

      // ---- BFS ----
      const visited = new Set([bestSeed]);
      const orderComp = [];
      const queue = [bestSeed];
      let qHead = 0;

      while (qHead < queue.length) {
        const node = queue[qHead++];
        orderComp.push(node);

        const nbList = adj[node].filter(
          (nb) => remaining.has(nb) && !visited.has(nb)
        );

        if (nbList.length > 1) {
          nbList.sort((a, b) => {
            const ca = adj[a].filter((nb) => numbered[nb]).length;
            const cb = adj[b].filter((nb) => numbered[nb]).length;
            return cb - ca;
          });
        }

        for (const nb of nbList) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }

      // ---- 分配新 id ----
      for (const node of orderComp) {
        newIdOf[node] = nextId++;
        numbered[node] = true;
        remaining.delete(node);
      }
    }
  }

  // 旧索引 → 新 id
  const oldIdxToNewId = new Array(N);
  for (let k = 0; k < N; k++) {
    oldIdxToNewId[k] = newIdOf[k + 2];
  }

  // 更新机构 id
  for (let k = 0; k < N; k++) {
    mechs[k].id = oldIdxToNewId[k];
  }

  // 按新 id 排序
  mechs.sort((a, b) => a.id - b.id);

  // 新 id → 新索引
  const newIdToNewIdx = new Map();
  mechs.forEach((m, idx) => newIdToNewIdx.set(m.id, idx));

  // 更新连接
  for (const c of conns) {
    const oldAIdx = c.planeA.mechanismIndex;
    const oldBIdx = c.planeB.mechanismIndex;

    c.planeA.mechanismIndex =
      oldAIdx === -1 ? -1 : newIdToNewIdx.get(oldIdxToNewId[oldAIdx]);
    c.planeB.mechanismIndex =
      oldBIdx === -1 ? -1 : newIdToNewIdx.get(oldIdxToNewId[oldBIdx]);
  }

  return { mechs, conns };
}
