<script setup>
import { computed, ref, watch } from "vue";
import PointGroupFlowchart from "@/components/flowchart/PointGroupFlowchart.vue";
import SymmetryMoleculeViewer from "@/components/molecule/SymmetryMoleculeViewer.vue";
import LatexInline from "@/components/common/LatexInline.vue";
import { FLOW_EDGES, FLOW_NODES, FLOW_SPECIAL_FAMILIES } from "@/data/flowchart";
import { getMoleculeDataset } from "@/data/moleculeDatasetStore";
import {
  C_INF_V,
  D_INF_H,
  getCharacteristicElementsForGroup,
  getPointGroupOperationsDetail,
  parsePointGroupDescriptor,
  toPointGroupLatex
} from "@/utils/pointGroupDetails";
import { toDisplayFormulaLatex } from "@/utils/chemLatex";
import { createCylinderBetween, createInversionCenter } from "@/utils/symmetryScenePrimitives";

function createAxisCap(THREE, type, color) {
  if (type === "triangle") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.055, 3),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
  }
  if (type === "square") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.055, 4),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
  }
  if (type === "pentagon") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.055, 5),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
  }
  if (type === "circle") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.04, 28),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
  }
  if (type === "ellipse") {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 22, 18),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
    mesh.scale.set(1.35, 0.78, 1.0);
    return mesh;
  }
  if (type === "hex") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.055, 6),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
  }
  return null;
}

function createAxisWithCaps(THREE, start, end, options = {}) {
  const color = options.color ?? "#1d4ed8";
  const radius = options.radius ?? 0.02;
  const opacity = options.opacity ?? 0.92;
  const capType = options.capType ?? "hex";

  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const group = new THREE.Group();
  group.add(createCylinderBetween(THREE, start, end, radius, color, opacity));

  const topCap = createAxisCap(THREE, capType, color);
  const bottomCap = createAxisCap(THREE, capType, color);
  if (topCap && bottomCap) {
    topCap.position.copy(end);
    bottomCap.position.copy(start);
    topCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    bottomCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().multiplyScalar(-1));
    group.add(topCap, bottomCap);
  }
  return group;
}

function createAxisFromDirection(THREE, direction, length, options = {}) {
  const unit = direction.clone().normalize();
  if (unit.lengthSq() < 1e-6) {
    return new THREE.Group();
  }
  const start = unit.clone().multiplyScalar(-length / 2);
  const end = unit.clone().multiplyScalar(length / 2);
  return createAxisWithCaps(THREE, start, end, options);
}

function toAxisCapType(n) {
  if (!Number.isFinite(n)) {
    return "circle";
  }
  if (n === 2) {
    return "ellipse";
  }
  if (n === 3) {
    return "triangle";
  }
  if (n === 4) {
    return "square";
  }
  if (n === 5) {
    return "pentagon";
  }
  return "hex";
}

function getCenterFromAtoms(THREE, normalizedAtoms) {
  if (!Array.isArray(normalizedAtoms) || !normalizedAtoms.length) {
    return new THREE.Vector3(0, 0, 0);
  }

  let bestVector = new THREE.Vector3(0, 0, 0);
  let bestScore = Number.POSITIVE_INFINITY;

  normalizedAtoms.forEach((atom) => {
    const vector = new THREE.Vector3(atom.nx ?? atom.x ?? 0, atom.ny ?? atom.y ?? 0, atom.nz ?? atom.z ?? 0);
    const score = vector.lengthSq();
    if (score < bestScore) {
      bestScore = score;
      bestVector = vector;
    }
  });

  return bestVector;
}

function getGeometryCenterFromAtoms(THREE, normalizedAtoms) {
  if (!Array.isArray(normalizedAtoms) || !normalizedAtoms.length) {
    return new THREE.Vector3(0, 0, 0);
  }

  const center = new THREE.Vector3(0, 0, 0);
  normalizedAtoms.forEach((atom) => {
    center.add(new THREE.Vector3(atom.nx ?? atom.x ?? 0, atom.ny ?? atom.y ?? 0, atom.nz ?? atom.z ?? 0));
  });
  return center.multiplyScalar(1 / normalizedAtoms.length);
}

function getPeripheralDirections(THREE, normalizedAtoms, minRadius = 0.6, centerOverride = null) {
  const center = centerOverride ? centerOverride.clone() : getCenterFromAtoms(THREE, normalizedAtoms);
  return (normalizedAtoms ?? [])
    .map((atom) =>
      new THREE.Vector3(atom.nx ?? atom.x ?? 0, atom.ny ?? atom.y ?? 0, atom.nz ?? atom.z ?? 0).sub(center)
    )
    .filter((vector) => vector.length() > minRadius)
    .map((vector) => vector.normalize());
}

function dedupeAxesByDirection(directions, cosineThreshold = 0.92) {
  const axes = [];
  directions.forEach((candidate) => {
    const unit = candidate.clone().normalize();
    const exists = axes.some((axis) => Math.abs(axis.dot(unit)) >= cosineThreshold);
    if (!exists) {
      axes.push(unit);
    }
  });
  return axes;
}

function buildTdAxisDirections(THREE, normalizedAtoms) {
  const candidate = dedupeAxesByDirection(getPeripheralDirections(THREE, normalizedAtoms, 0.55), 0.9);
  if (candidate.length >= 4) {
    return candidate.slice(0, 4);
  }
  return [
    new THREE.Vector3(1, 1, 1).normalize(),
    new THREE.Vector3(-1, -1, 1).normalize(),
    new THREE.Vector3(-1, 1, -1).normalize(),
    new THREE.Vector3(1, -1, -1).normalize()
  ];
}

function buildOhAxisDirections(THREE, normalizedAtoms) {
  const candidate = dedupeAxesByDirection(getPeripheralDirections(THREE, normalizedAtoms, 0.55), 0.95);
  if (candidate.length >= 3) {
    return candidate.slice(0, 3);
  }
  return [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1)
  ];
}

function canonicalizeCycle(cycle) {
  const n = cycle.length;
  const variants = [];

  for (let shift = 0; shift < n; shift += 1) {
    variants.push(Array.from({ length: n }, (_, index) => cycle[(index + shift) % n]).join("-"));
  }

  const reversed = [...cycle].reverse();
  for (let shift = 0; shift < n; shift += 1) {
    variants.push(Array.from({ length: n }, (_, index) => reversed[(index + shift) % n]).join("-"));
  }

  variants.sort();
  return variants[0];
}

function isChordlessCycle(cycle, adjacency) {
  const n = cycle.length;
  const consecutive = new Set();
  for (let i = 0; i < n; i += 1) {
    const a = cycle[i];
    const b = cycle[(i + 1) % n];
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    consecutive.add(key);
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = cycle[i];
      const b = cycle[j];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (consecutive.has(key)) {
        continue;
      }
      if (adjacency.get(a)?.has(b)) {
        return false;
      }
    }
  }
  return true;
}

function findPentagonCyclesFromBonds(normalizedAtoms, bonds) {
  if (!Array.isArray(normalizedAtoms) || !normalizedAtoms.length || !Array.isArray(bonds) || !bonds.length) {
    return [];
  }

  const available = new Set(normalizedAtoms.map((atom) => atom.centerNumber));
  const adjacency = new Map();
  const ensureNode = (id) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
    return adjacency.get(id);
  };

  bonds.forEach((bond) => {
    const a = bond.atomA?.centerNumber ?? bond.a;
    const b = bond.atomB?.centerNumber ?? bond.b;
    if (!available.has(a) || !available.has(b)) {
      return;
    }
    ensureNode(a).add(b);
    ensureNode(b).add(a);
  });

  const nodes = [...adjacency.keys()].sort((a, b) => a - b);
  const cycleMap = new Map();

  function dfs(start, current, path, visited) {
    if (path.length === 5) {
      if (!adjacency.get(current)?.has(start)) {
        return;
      }
      const cycle = [...path];
      if (!isChordlessCycle(cycle, adjacency)) {
        return;
      }
      const key = canonicalizeCycle(cycle);
      if (!cycleMap.has(key)) {
        cycleMap.set(key, cycle);
      }
      return;
    }

    const neighbors = adjacency.get(current) ?? new Set();
    neighbors.forEach((next) => {
      if (next < start) {
        return;
      }
      if (visited.has(next)) {
        return;
      }
      visited.add(next);
      path.push(next);
      dfs(start, next, path, visited);
      path.pop();
      visited.delete(next);
    });
  }

  nodes.forEach((start) => {
    const visited = new Set([start]);
    dfs(start, start, [start], visited);
  });

  return [...cycleMap.values()];
}

function cycleCenterDirection(THREE, cycle, atomByCenterNumber) {
  const center = new THREE.Vector3(0, 0, 0);
  let count = 0;
  cycle.forEach((centerNumber) => {
    const atom = atomByCenterNumber.get(centerNumber);
    if (!atom) {
      return;
    }
    center.add(new THREE.Vector3(atom.nx ?? atom.x ?? 0, atom.ny ?? atom.y ?? 0, atom.nz ?? atom.z ?? 0));
    count += 1;
  });

  if (!count) {
    return null;
  }
  center.multiplyScalar(1 / count);
  if (center.lengthSq() < 1e-6) {
    return null;
  }
  return center;
}

function collectPentagonCenters(THREE, normalizedAtoms, bonds) {
  const atomByCenterNumber = new Map((normalizedAtoms ?? []).map((atom) => [atom.centerNumber, atom]));
  const cycles = findPentagonCyclesFromBonds(normalizedAtoms, bonds);

  return cycles
    .map((cycle) => cycleCenterDirection(THREE, cycle, atomByCenterNumber))
    .filter((center) => center && center.lengthSq() > 1e-6);
}

function pairOppositePentagonCenters(centers) {
  const remaining = centers.map((center) => center.clone());
  const pairs = [];

  while (remaining.length > 1 && pairs.length < 6) {
    const anchor = remaining.shift();
    const anchorUnit = anchor.clone().normalize();
    let bestIndex = -1;
    let bestDot = 1;

    remaining.forEach((candidate, index) => {
      const dot = anchorUnit.dot(candidate.clone().normalize());
      if (dot < bestDot) {
        bestDot = dot;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) {
      break;
    }

    const opposite = remaining.splice(bestIndex, 1)[0];
    pairs.push([anchor, opposite]);
  }

  return pairs;
}

function buildIhAxisEndpoints(THREE, normalizedAtoms, bonds) {
  const pentagonCenters = collectPentagonCenters(THREE, normalizedAtoms, bonds);
  const uniquePentagonCenters = [];

  pentagonCenters.forEach((center) => {
    const unit = center.clone().normalize();
    const exists = uniquePentagonCenters.some(
      (existing) => existing.clone().normalize().dot(unit) > 0.996
    );
    if (!exists) {
      uniquePentagonCenters.push(center);
    }
  });

  const axisPairs = pairOppositePentagonCenters(uniquePentagonCenters);
  if (axisPairs.length >= 6) {
    return axisPairs.slice(0, 6).map(([a, b]) => {
      const start = b.clone();
      const end = a.clone();
      const direction = end.clone().sub(start).normalize();
      const extension = 0.18;
      start.add(direction.clone().multiplyScalar(-extension));
      end.add(direction.clone().multiplyScalar(extension));
      return { start, end };
    });
  }

  const phi = (1 + Math.sqrt(5)) / 2;
  const fallbackDirections = [
    new THREE.Vector3(0, 1, phi),
    new THREE.Vector3(0, 1, -phi),
    new THREE.Vector3(1, phi, 0),
    new THREE.Vector3(1, -phi, 0),
    new THREE.Vector3(phi, 0, 1),
    new THREE.Vector3(phi, 0, -1)
  ];
  return fallbackDirections.map((direction) => {
    const unit = direction.clone().normalize();
    const halfLength = 2.9;
    return {
      start: unit.clone().multiplyScalar(-halfLength),
      end: unit.clone().multiplyScalar(halfLength)
    };
  });
}

function getAtomVector(THREE, atom) {
  return new THREE.Vector3(atom.nx ?? atom.x ?? 0, atom.ny ?? atom.y ?? 0, atom.nz ?? atom.z ?? 0);
}

function inferLinearAxis(THREE, normalizedAtoms) {
  if (!Array.isArray(normalizedAtoms) || normalizedAtoms.length < 2) {
    return new THREE.Vector3(0, 0, 1);
  }

  let bestA = null;
  let bestB = null;
  let bestDist = -1;
  for (let i = 0; i < normalizedAtoms.length; i += 1) {
    for (let j = i + 1; j < normalizedAtoms.length; j += 1) {
      const a = getAtomVector(THREE, normalizedAtoms[i]);
      const b = getAtomVector(THREE, normalizedAtoms[j]);
      const dist = a.distanceToSquared(b);
      if (dist > bestDist) {
        bestDist = dist;
        bestA = a;
        bestB = b;
      }
    }
  }

  if (!bestA || !bestB) {
    return new THREE.Vector3(0, 0, 1);
  }
  return bestB.sub(bestA).normalize();
}

function getCandidateAxes(THREE, normalizedAtoms, centerOverride = null) {
  const base = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    ...getPeripheralDirections(THREE, normalizedAtoms, 0.2, centerOverride)
  ];

  const crosses = [];
  for (let i = 0; i < base.length; i += 1) {
    for (let j = i + 1; j < base.length; j += 1) {
      const cross = new THREE.Vector3().crossVectors(base[i], base[j]);
      if (cross.lengthSq() > 1e-4) {
        crosses.push(cross.normalize());
      }
    }
  }

  return dedupeAxesByDirection([...base, ...crosses], 0.985).slice(0, 160);
}

function rotationSymmetryScore(THREE, normalizedAtoms, center, axis, angle, options = {}) {
  if (!Array.isArray(normalizedAtoms) || !normalizedAtoms.length) {
    return 1e9;
  }

  const weighted = Boolean(options.weightByAtomicNumber);
  const axisUnit = axis.clone().normalize();
  let sum = 0;
  let totalWeight = 0;

  normalizedAtoms.forEach((atom) => {
    const start = getAtomVector(THREE, atom).sub(center);
    const rotated = start.applyAxisAngle(axisUnit, angle).add(center);
    let best = Number.POSITIVE_INFINITY;

    normalizedAtoms.forEach((candidate) => {
      if (candidate.element !== atom.element) {
        return;
      }
      const target = getAtomVector(THREE, candidate);
      const d2 = rotated.distanceToSquared(target);
      if (d2 < best) {
        best = d2;
      }
    });

    const weight = weighted ? Math.max(1, Number(atom.atomicNumber ?? 1)) : 1;
    sum += Math.sqrt(best) * weight;
    totalWeight += weight;
  });

  return sum / Math.max(totalWeight, 1);
}

function reflectionSymmetryScore(THREE, normalizedAtoms, center, normal) {
  if (!Array.isArray(normalizedAtoms) || !normalizedAtoms.length) {
    return 1e9;
  }

  const n = normal.clone().normalize();
  let sum = 0;

  normalizedAtoms.forEach((atom) => {
    const start = getAtomVector(THREE, atom).sub(center);
    const reflected = start.clone().sub(n.clone().multiplyScalar(2 * start.dot(n))).add(center);
    let best = Number.POSITIVE_INFINITY;

    normalizedAtoms.forEach((candidate) => {
      if (candidate.element !== atom.element) {
        return;
      }
      const target = getAtomVector(THREE, candidate);
      const d2 = reflected.distanceToSquared(target);
      if (d2 < best) {
        best = d2;
      }
    });

    sum += Math.sqrt(best);
  });

  return sum / normalizedAtoms.length;
}

function inferBestMirrorPlaneNormal(THREE, normalizedAtoms) {
  const center = getCenterFromAtoms(THREE, normalizedAtoms);
  const candidates = getCandidateAxes(THREE, normalizedAtoms);
  let bestNormal = new THREE.Vector3(0, 0, 1);
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const normal = candidate.clone().normalize();
    const score = reflectionSymmetryScore(THREE, normalizedAtoms, center, normal);
    if (score < bestScore) {
      bestScore = score;
      bestNormal = normal;
    }
  });

  return bestNormal.normalize();
}

function axisExtent(THREE, normalizedAtoms, center, axis) {
  const unit = axis.clone().normalize();
  let minProj = Number.POSITIVE_INFINITY;
  let maxProj = Number.NEGATIVE_INFINITY;
  normalizedAtoms.forEach((atom) => {
    const projection = getAtomVector(THREE, atom).sub(center).dot(unit);
    minProj = Math.min(minProj, projection);
    maxProj = Math.max(maxProj, projection);
  });
  return maxProj - minProj;
}

function inferPrincipalAxisByOrder(THREE, normalizedAtoms, order, options = {}) {
  if (!Number.isFinite(order) || order < 2) {
    return new THREE.Vector3(0, 0, 1);
  }

  const preferHorizontal = Boolean(options.preferHorizontal);
  const center = options.useGeometryCenter
    ? getGeometryCenterFromAtoms(THREE, normalizedAtoms)
    : getCenterFromAtoms(THREE, normalizedAtoms);
  const angle = (2 * Math.PI) / order;
  let bestAxis = new THREE.Vector3(0, 0, 1);
  let bestScore = Number.POSITIVE_INFINITY;
  let bestExtent = preferHorizontal ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  getCandidateAxes(THREE, normalizedAtoms, center).forEach((candidate) => {
    const axis = candidate.clone().normalize();
    const rotationScore = rotationSymmetryScore(THREE, normalizedAtoms, center, axis, angle, {
      weightByAtomicNumber: options.weightByAtomicNumber
    });
    const reflectionScore = preferHorizontal
      ? reflectionSymmetryScore(THREE, normalizedAtoms, center, axis)
      : 0;
    const score = rotationScore + reflectionScore * 0.75;
    const extent = axisExtent(THREE, normalizedAtoms, center, axis);
    const betterByScore = score < bestScore - 1e-4;
    const tiedScore = Math.abs(score - bestScore) <= 1e-4;
    const betterByExtent = preferHorizontal
      ? extent < bestExtent - 1e-4
      : extent > bestExtent + 1e-4;

    if (betterByScore || (tiedScore && betterByExtent)) {
      bestScore = score;
      bestExtent = extent;
      bestAxis = axis;
    }
  });

  return bestAxis.normalize();
}

function inferReferenceDirection(THREE, normalizedAtoms, axis) {
  const center = getCenterFromAtoms(THREE, normalizedAtoms);
  const axisUnit = axis.clone().normalize();
  let best = null;
  let bestLen = 0;

  (normalizedAtoms ?? []).forEach((atom) => {
    const raw = getAtomVector(THREE, atom).sub(center);
    const projected = raw.sub(axisUnit.clone().multiplyScalar(raw.dot(axisUnit)));
    const len = projected.length();
    if (len > bestLen) {
      bestLen = len;
      best = projected.normalize();
    }
  });

  if (best && best.lengthSq() > 1e-6) {
    return best;
  }

  const alt = Math.abs(axisUnit.dot(new THREE.Vector3(1, 0, 0))) < 0.92
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3().crossVectors(axisUnit, alt).normalize();
}

function buildPerpendicularAxisDirections(THREE, normalizedAtoms, principalAxis, count) {
  const safeCount = Math.max(1, Math.round(count));
  const reference = inferReferenceDirection(THREE, normalizedAtoms, principalAxis);
  const step = Math.PI / safeCount;
  return Array.from({ length: safeCount }, (_, index) =>
    reference.clone().applyAxisAngle(principalAxis, step * index).normalize()
  );
}

function usesFixedYPrincipalAxis(group) {
  return group === "D2h" || group === "D3h" || group === "D4h";
}

function inferPerpendicularC2Directions(THREE, normalizedAtoms, principalAxis, count) {
  const safeCount = Math.max(1, Math.round(count));
  const center = getCenterFromAtoms(THREE, normalizedAtoms);
  const axis = principalAxis.clone().normalize();

  const candidates = getCandidateAxes(THREE, normalizedAtoms)
    .filter((candidate) => Math.abs(candidate.dot(axis)) < 0.2)
    .map((candidate) => ({
      direction: candidate.clone().normalize(),
      score: rotationSymmetryScore(THREE, normalizedAtoms, center, candidate, Math.PI)
    }))
    .sort((a, b) => a.score - b.score);

  const selected = [];
  candidates.forEach((item) => {
    if (selected.length >= safeCount) {
      return;
    }
    const exists = selected.some((existing) => Math.abs(existing.dot(item.direction)) > 0.94);
    if (!exists) {
      selected.push(item.direction);
    }
  });

  if (selected.length >= safeCount) {
    return selected.slice(0, safeCount);
  }

  const fallback = buildPerpendicularAxisDirections(THREE, normalizedAtoms, axis, safeCount);
  fallback.forEach((direction) => {
    if (selected.length >= safeCount) {
      return;
    }
    const exists = selected.some((existing) => Math.abs(existing.dot(direction)) > 0.94);
    if (!exists) {
      selected.push(direction);
    }
  });

  return selected.slice(0, safeCount);
}

function inferBestPerpendicularC2Seed(THREE, normalizedAtoms, principalAxis) {
  const center = getGeometryCenterFromAtoms(THREE, normalizedAtoms);
  const axis = principalAxis.clone().normalize();
  let bestDirection = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestExtent = Number.NEGATIVE_INFINITY;

  getCandidateAxes(THREE, normalizedAtoms, center)
    .filter((candidate) => Math.abs(candidate.dot(axis)) < 0.2)
    .forEach((candidate) => {
      const direction = candidate.clone().normalize();
      const score = rotationSymmetryScore(THREE, normalizedAtoms, center, direction, Math.PI);
      const extent = axisExtent(THREE, normalizedAtoms, center, direction);
      const betterByScore = score < bestScore - 1e-4;
      const tiedScore = Math.abs(score - bestScore) <= 1e-4;
      if (betterByScore || (tiedScore && extent > bestExtent + 1e-4)) {
        bestScore = score;
        bestExtent = extent;
        bestDirection = direction;
      }
    });

  if (bestDirection) {
    return bestDirection;
  }
  return inferReferenceDirection(THREE, normalizedAtoms, axis);
}

function buildDndPerpendicularC2Directions(THREE, normalizedAtoms, principalAxis, n) {
  const safeN = Math.max(2, Math.round(n || 2));
  const axis = principalAxis.clone().normalize();
  const seed = inferBestPerpendicularC2Seed(THREE, normalizedAtoms, axis);
  const step = Math.PI / safeN;
  return Array.from({ length: safeN }, (_, index) =>
    seed.clone().applyAxisAngle(axis, step * index).normalize()
  );
}

function reflectionScoreForPlaneContainingAxis(THREE, normalizedAtoms, principalAxis, inPlaneDirection) {
  const axis = principalAxis.clone().normalize();
  const inPlane = inPlaneDirection
    .clone()
    .sub(axis.clone().multiplyScalar(inPlaneDirection.dot(axis)));
  if (inPlane.lengthSq() < 1e-6) {
    return Number.POSITIVE_INFINITY;
  }
  inPlane.normalize();
  const normal = new THREE.Vector3().crossVectors(inPlane, axis).normalize();
  const center = getCenterFromAtoms(THREE, normalizedAtoms);
  return reflectionSymmetryScore(THREE, normalizedAtoms, center, normal);
}

function inferD2dSigmaDDirections(THREE, normalizedAtoms, principalAxis) {
  const axis = principalAxis.clone().normalize();
  const center = getGeometryCenterFromAtoms(THREE, normalizedAtoms);
  const candidates = dedupeAxesByDirection(
    getCandidateAxes(THREE, normalizedAtoms, center)
      .filter((candidate) => Math.abs(candidate.dot(axis)) < 0.2)
      .map((candidate) =>
        candidate.clone().sub(axis.clone().multiplyScalar(candidate.dot(axis))).normalize()
      ),
    0.965
  );

  if (candidates.length < 2) {
    return buildPerpendicularAxisDirections(THREE, normalizedAtoms, axis, 2);
  }

  let bestPair = null;
  let bestPairScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const dirA = candidates[i];
      const dirB = candidates[j];
      const orthPenalty = Math.abs(Math.abs(dirA.dot(dirB)));
      const scoreA = reflectionScoreForPlaneContainingAxis(THREE, normalizedAtoms, axis, dirA);
      const scoreB = reflectionScoreForPlaneContainingAxis(THREE, normalizedAtoms, axis, dirB);
      const pairScore = scoreA + scoreB + orthPenalty * 1.4;
      if (pairScore < bestPairScore) {
        bestPairScore = pairScore;
        bestPair = [dirA.clone(), dirB.clone()];
      }
    }
  }

  if (bestPair) {
    return bestPair;
  }

  return buildPerpendicularAxisDirections(THREE, normalizedAtoms, axis, 2);
}

function inferD2dPerpendicularC2Directions(THREE, normalizedAtoms, principalAxis) {
  const axis = principalAxis.clone().normalize();
  const sigmaDirections = inferD2dSigmaDDirections(THREE, normalizedAtoms, axis);
  if (!sigmaDirections.length) {
    return buildPerpendicularAxisDirections(THREE, normalizedAtoms, axis, 2);
  }

  const center = getGeometryCenterFromAtoms(THREE, normalizedAtoms);
  const rotateAndScore = (sign) => {
    const dirs = sigmaDirections.map((direction) =>
      direction.clone().applyAxisAngle(axis, sign * Math.PI / 4).normalize()
    );
    const score = dirs.reduce(
      (sum, direction) =>
        sum + rotationSymmetryScore(THREE, normalizedAtoms, center, direction, Math.PI),
      0
    );
    return { dirs, score };
  };

  const positive = rotateAndScore(1);
  const negative = rotateAndScore(-1);
  return positive.score <= negative.score ? positive.dirs : negative.dirs;
}

function resolveSigmaDInPlaneDirections(THREE, normalizedAtoms, principalAxis, descriptor, mirrorCount) {
  const group = descriptor?.normalized ?? "";
  if (group === "D2d") {
    return inferD2dSigmaDDirections(THREE, normalizedAtoms, principalAxis);
  }
  if (/^D\d+d$/i.test(group) && Number.isFinite(descriptor?.n) && descriptor.n >= 2) {
    const baseDirections = buildDndPerpendicularC2Directions(
      THREE,
      normalizedAtoms,
      principalAxis,
      descriptor.n
    );
    const halfStep = Math.PI / (2 * descriptor.n);
    return baseDirections.map((direction) =>
      direction.clone().applyAxisAngle(principalAxis, halfStep).normalize()
    );
  }

  const directions = buildPerpendicularAxisDirections(THREE, normalizedAtoms, principalAxis, mirrorCount);
  return directions.map((direction) =>
    direction.clone().applyAxisAngle(principalAxis, Math.PI / (2 * mirrorCount)).normalize()
  );
}

function inferPlanarNormal(THREE, normalizedAtoms) {
  const center = getCenterFromAtoms(THREE, normalizedAtoms);
  const vectors = (normalizedAtoms ?? [])
    .map((atom) => getAtomVector(THREE, atom).sub(center))
    .filter((vector) => vector.lengthSq() > 1e-6);

  if (vectors.length < 3) {
    return new THREE.Vector3(0, 0, 1);
  }

  let base = vectors[0];
  vectors.forEach((vector) => {
    if (vector.lengthSq() > base.lengthSq()) {
      base = vector;
    }
  });

  let second = null;
  let bestCross = 0;
  vectors.forEach((vector) => {
    const crossLen = new THREE.Vector3().crossVectors(base, vector).lengthSq();
    if (crossLen > bestCross) {
      bestCross = crossLen;
      second = vector;
    }
  });

  if (!second || bestCross < 1e-6) {
    return new THREE.Vector3(0, 0, 1);
  }

  return new THREE.Vector3().crossVectors(base, second).normalize();
}

function resolvePrincipalAxis(THREE, normalizedAtoms, descriptor) {
  const group = descriptor?.normalized ?? "";
  if (group === "C2") {
    return inferPrincipalAxisByOrder(THREE, normalizedAtoms, 2, {
      useGeometryCenter: true
    });
  }
  if (usesFixedYPrincipalAxis(group)) {
    // SymmetryMoleculeViewer applies a global frame rotation (Z -> Y).
    // Use Z here so the rendered principal axis appears along +Y on screen.
    return new THREE.Vector3(0, 0, 1);
  }
  if (group === "D2h" || group === "C2h" || group === "D4h") {
    return inferPlanarNormal(THREE, normalizedAtoms);
  }

  return inferPrincipalAxisByOrder(THREE, normalizedAtoms, descriptor?.n ?? 2, {
    preferHorizontal: descriptor?.suffix === "h"
  });
}

function resolveSigmaHNormal(THREE, normalizedAtoms, descriptor) {
  const group = descriptor?.normalized ?? "";
  if (group === "Cs") {
    return inferBestMirrorPlaneNormal(THREE, normalizedAtoms);
  }
  return resolvePrincipalAxis(THREE, normalizedAtoms, descriptor);
}

function resolvePerpendicularC2Directions(THREE, normalizedAtoms, principalAxis, descriptor, fallbackCount) {
  const group = descriptor?.normalized ?? "";
  const n = descriptor?.n ?? fallbackCount;
  if (group === "D2d") {
    return inferD2dPerpendicularC2Directions(THREE, normalizedAtoms, principalAxis);
  }
  if (group === "D2h" || group === "D3h" || group === "D4h") {
    return buildPerpendicularAxisDirections(THREE, normalizedAtoms, principalAxis, Math.max(2, n));
  }
  if (/^D\d+$/i.test(group) && Number.isFinite(n) && n >= 2) {
    return buildDndPerpendicularC2Directions(THREE, normalizedAtoms, principalAxis, n);
  }
  if (/^D\d+d$/i.test(group) && Number.isFinite(n) && n >= 2) {
    return buildDndPerpendicularC2Directions(THREE, normalizedAtoms, principalAxis, n);
  }
  return inferPerpendicularC2Directions(THREE, normalizedAtoms, principalAxis, fallbackCount);
}

function resolvePerpendicularC2Length(descriptor) {
  if (descriptor?.normalized === "D6h") {
    return 4.2;
  }
  return 4.8;
}

function createPlanePerpendicularToAxis(THREE, axis, color = "#16a34a", opacity = 0.13) {
  const slab = new THREE.Mesh(
    new THREE.CylinderGeometry(2.95, 2.95, 0.09, 72),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide
    })
  );
  slab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  return slab;
}

function createPlaneContainingAxis(THREE, axis, inPlaneDirection, color = "#0891b2", opacity = 0.1) {
  const size = 4.8;
  const thickness = 0.08;
  const axisUnit = axis.clone().normalize();
  const horizontalRaw = inPlaneDirection.clone().sub(axisUnit.clone().multiplyScalar(inPlaneDirection.dot(axisUnit)));
  const horizontal = horizontalRaw.lengthSq() > 1e-6
    ? horizontalRaw.normalize()
    : inferReferenceDirection(THREE, [], axisUnit);
  const normal = new THREE.Vector3().crossVectors(horizontal, axisUnit).normalize();

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, thickness),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide
    })
  );
  const basis = new THREE.Matrix4().makeBasis(horizontal, axisUnit, normal);
  mesh.setRotationFromMatrix(basis);
  return mesh;
}

function parseLeadingCount(symbolText) {
  const match = String(symbolText ?? "").replace(/\s+/g, "").match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function isCInfGroup(groupName) {
  return groupName === C_INF_V;
}

function isDInfGroup(groupName) {
  return groupName === D_INF_H;
}

function inferElementLayerIds(symbolText, descriptor) {
  const text = String(symbolText ?? "").replace(/\s+/g, "");
  const group = descriptor?.normalized ?? "";

  if (isCInfGroup(group)) {
    return text.includes("C_{\\infty}") ? ["principal-axis"] : [];
  }
  if (isDInfGroup(group)) {
    if (text.includes("C_{\\infty}")) {
      return ["principal-axis"];
    }
    if (text.includes("\\sigma_h")) {
      return ["sigma-h"];
    }
    return [];
  }

  if (group === "Td") {
    return text.includes("C_3") || text.includes("C3") ? ["c3-td"] : [];
  }
  if (group === "Oh") {
    return text.includes("C_4") || text.includes("C4") ? ["c4-oh"] : [];
  }
  if (group === "Ih") {
    return text.includes("C_5") || text.includes("C5") ? ["c5-ih"] : [];
  }

  const layers = [];
  const leadingCount = parseLeadingCount(text);

  if (text.includes("\\sigma_h")) {
    layers.push("sigma-h");
  }
  if (text === "\\sigma") {
    layers.push("sigma-h");
  }
  if (text.includes("\\sigma_v")) {
    layers.push("sigma-v");
  }
  if (text.includes("\\sigma_d")) {
    layers.push("sigma-d");
  }
  if (text === "i") {
    layers.push("inversion-center");
  }

  const hasPerpC2 = text.includes("C_{2\\perp}");
  const hasPlainC2 = /C_2(?![0-9])/.test(text);
  const family = descriptor?.family ?? "";
  const isSecondaryC2 = hasPerpC2 || (hasPlainC2 && (leadingCount ?? 0) > 1);

  if (hasPerpC2 || (hasPlainC2 && family === "D" && (leadingCount ?? 0) > 1)) {
    layers.push("c2-perp");
  }

  if (!isSecondaryC2 && (text.includes("C_{\\infty}") || /C_\{?\d+\}?/.test(text))) {
    layers.push("principal-axis");
  }

  return [...new Set(layers)];
}

function createFlowchartLayers(pointGroupName) {
  const descriptor = parsePointGroupDescriptor(pointGroupName);
  const group = descriptor?.normalized ?? "";
  const n = descriptor?.n ?? 6;
  const capType = toAxisCapType(descriptor?.n ?? null);
  const mirrorCount = Math.max(2, Math.min(n, 8));
  const c2Count = Math.max(2, Math.min(n, 8));

  if (isCInfGroup(group)) {
    return [
      {
        id: "principal-axis",
        label: "C-infinity axis",
        group: "core",
        visibleByDefault: true,
        description: "Infinite-fold principal axis.",
        buildObjects: ({ THREE, normalizedAtoms }) => {
          const axis = inferLinearAxis(THREE, normalizedAtoms);
          return [
            createAxisFromDirection(THREE, axis, 5, {
              color: "#1d4ed8",
              radius: 0.022,
              opacity: 0.92,
              capType: "circle"
            })
          ];
        }
      }
    ];
  }

  if (isDInfGroup(group)) {
    return [
      {
        id: "principal-axis",
        label: "C-infinity axis",
        group: "core",
        visibleByDefault: true,
        description: "Infinite-fold principal axis.",
        buildObjects: ({ THREE, normalizedAtoms }) => {
          const axis = inferLinearAxis(THREE, normalizedAtoms);
          return [
            createAxisFromDirection(THREE, axis, 5, {
              color: "#1d4ed8",
              radius: 0.022,
              opacity: 0.92,
              capType: "circle"
            })
          ];
        }
      },
      {
        id: "sigma-h",
        label: "sigma_h",
        group: "core",
        visibleByDefault: false,
        description: "Horizontal mirror plane.",
        buildObjects: ({ THREE, normalizedAtoms }) => {
          const axis = inferLinearAxis(THREE, normalizedAtoms);
          return [createPlanePerpendicularToAxis(THREE, axis)];
        }
      }
    ];
  }


  if (group === "Td") {
    return [
      {
        id: "c3-td",
        label: "4C3",
        group: "core",
        visibleByDefault: true,
        description: "Four C3 axes of Td.",
        buildObjects: ({ THREE, normalizedAtoms }) =>
          buildTdAxisDirections(THREE, normalizedAtoms).map((direction) =>
            createAxisFromDirection(THREE, direction, 4.9, {
              color: "#1d4ed8",
              radius: 0.019,
              opacity: 0.92,
              capType: "triangle"
            })
          )
      }
    ];
  }

  if (group === "Oh") {
    return [
      {
        id: "c4-oh",
        label: "3C4",
        group: "core",
        visibleByDefault: true,
        description: "Three mutually perpendicular C4 axes of Oh.",
        buildObjects: ({ THREE, normalizedAtoms }) =>
          buildOhAxisDirections(THREE, normalizedAtoms).map((direction) =>
            createAxisFromDirection(THREE, direction, 6.2, {
              color: "#1d4ed8",
              radius: 0.028,
              opacity: 0.92,
              capType: "square"
            })
          )
      }
    ];
  }

  if (group === "Ih") {
    return [
      {
        id: "c5-ih",
        label: "6C5",
        group: "core",
        visibleByDefault: true,
        description: "Six C5 axes of Ih.",
        buildObjects: ({ THREE, normalizedAtoms, bonds }) =>
          buildIhAxisEndpoints(THREE, normalizedAtoms, bonds).map(({ start, end }) =>
            createAxisWithCaps(THREE, start, end, {
              color: "#1d4ed8",
              radius: 0.018,
              opacity: 0.92,
              capType: "pentagon"
            })
          )
      }
    ];
  }

  return [
    {
      id: "principal-axis",
      label: "Principal axis",
      group: "core",
      visibleByDefault: true,
      description: "Principal rotational axis.",
      buildObjects: ({ THREE, normalizedAtoms }) => {
        const principalAxis = resolvePrincipalAxis(THREE, normalizedAtoms, descriptor);
        return [
          createAxisFromDirection(THREE, principalAxis, 4.9, {
            color: "#1d4ed8",
            radius: 0.022,
            opacity: 0.92,
            capType
          })
        ];
      }
    },
    {
      id: "sigma-h",
      label: "sigma_h",
      group: "core",
      visibleByDefault: false,
      description: "Horizontal mirror plane.",
      buildObjects: ({ THREE, normalizedAtoms }) => {
        const planeNormal = resolveSigmaHNormal(THREE, normalizedAtoms, descriptor);
        return [createPlanePerpendicularToAxis(THREE, planeNormal)];
      }
    },
    {
      id: "inversion-center",
      label: "i",
      group: "core",
      visibleByDefault: false,
      description: "Inversion center.",
      buildObjects: ({ THREE }) => [createInversionCenter(THREE)]
    },
    {
      id: "sigma-v",
      label: "sigma_v",
      group: "core",
      visibleByDefault: false,
      description: "Vertical mirror planes.",
      buildObjects: ({ THREE, normalizedAtoms }) => {
        const principalAxis = resolvePrincipalAxis(THREE, normalizedAtoms, descriptor);
        const directions = buildPerpendicularAxisDirections(THREE, normalizedAtoms, principalAxis, mirrorCount);
        return directions.map((direction) => createPlaneContainingAxis(THREE, principalAxis, direction, "#0891b2", 0.1));
      }
    },
    {
      id: "sigma-d",
      label: "sigma_d",
      group: "core",
      visibleByDefault: false,
      description: "Diagonal mirror planes.",
      buildObjects: ({ THREE, normalizedAtoms }) => {
        const principalAxis = resolvePrincipalAxis(THREE, normalizedAtoms, descriptor);
        const directions = resolveSigmaDInPlaneDirections(
          THREE,
          normalizedAtoms,
          principalAxis,
          descriptor,
          mirrorCount
        );
        return directions.map((direction) =>
          createPlaneContainingAxis(
            THREE,
            principalAxis,
            direction,
            "#14b8a6",
            0.1
          )
        );
      }
    },
    {
      id: "c2-perp",
      label: "C2 perpendicular",
      group: "core",
      visibleByDefault: false,
      description: "Perpendicular C2 axes.",
      buildObjects: ({ THREE, normalizedAtoms }) => {
        const principalAxis = resolvePrincipalAxis(THREE, normalizedAtoms, descriptor);
        const directions = resolvePerpendicularC2Directions(
          THREE,
          normalizedAtoms,
          principalAxis,
          descriptor,
          c2Count
        );
        const axisLength = resolvePerpendicularC2Length(descriptor);
        return directions.map((direction) =>
          createAxisFromDirection(THREE, direction, axisLength, {
            color: "#7c3aed",
            radius: 0.017,
            opacity: 0.92,
            capType: "ellipse"
          })
        );
      }
    }
  ];
}

const dataset = getMoleculeDataset({ includeLog: true, includeGjf: false });
const groupsByFamily = dataset.groupsByFamily;
const representativeByConcreteGroup = dataset.representativeByConcreteGroup;

const familyOrder = [
  "C\u221ev",
  "D\u221eh",
  "Td",
  "Oh",
  "Ih",
  "C1",
  "Cs",
  "Ci",
  "Cn",
  "Cnv",
  "Cnh",
  "Dn",
  "Dnd",
  "Dnh"
];

const availableFamilies = computed(() => new Set([...groupsByFamily.keys()]));

function getInitialFamily() {
  if (groupsByFamily.has("Dnh")) {
    return "Dnh";
  }
  return familyOrder.find((family) => groupsByFamily.has(family)) ?? "Dnh";
}

const selectedFamily = ref(getInitialFamily());
const selectedConcreteGroup = ref("");

const concreteGroups = computed(() => groupsByFamily.get(selectedFamily.value) ?? []);

watch(
  concreteGroups,
  (groups) => {
    if (!groups.length) {
      selectedConcreteGroup.value = "";
      return;
    }

    if (groups.includes(selectedConcreteGroup.value)) {
      return;
    }

    selectedConcreteGroup.value = groups[0];
  },
  { immediate: true }
);

const representativeRecord = computed(() =>
  selectedConcreteGroup.value
    ? representativeByConcreteGroup.get(selectedConcreteGroup.value) ?? null
    : null
);

const activePointGroupName = computed(
  () => representativeRecord.value?.pointGroup || selectedConcreteGroup.value || selectedFamily.value
);

const characteristicElements = computed(() =>
  getCharacteristicElementsForGroup(activePointGroupName.value, selectedFamily.value)
);
const operationsDetail = computed(() =>
  getPointGroupOperationsDetail(activePointGroupName.value)
);
const activePointGroupDescriptor = computed(() => parsePointGroupDescriptor(activePointGroupName.value));
const flowchartLayers = computed(() => createFlowchartLayers(activePointGroupName.value));

const characteristicElementItems = computed(() =>
  characteristicElements.value.map((symbol, index) => ({
    id: `element-${index}`,
    symbol,
    layerIds: inferElementLayerIds(symbol, activePointGroupDescriptor.value)
  }))
);
const selectedCharacteristicId = ref("");
const selectedCharacteristicItem = computed(
  () => characteristicElementItems.value.find((item) => item.id === selectedCharacteristicId.value) ?? null
);
const activeLayerIds = computed(() => {
  const selected = selectedCharacteristicItem.value?.layerIds ?? [];
  if (selected.length) {
    return selected;
  }

  const group = activePointGroupDescriptor.value?.normalized ?? "";
  if (group === "Oh") {
    return ["c4-oh"];
  }
  if (group === "Td") {
    return ["c3-td"];
  }
  if (group === "Ih") {
    return ["c5-ih"];
  }
  return [];
});

function onSelectFamily(family) {
  selectedFamily.value = family;
}

function onSelectConcreteGroup(groupId) {
  selectedConcreteGroup.value = groupId;
}

function toGroupLatex(groupName) {
  return toPointGroupLatex(groupName);
}

watch(
  characteristicElementItems,
  (items) => {
    if (!items.length) {
      selectedCharacteristicId.value = "";
      return;
    }
    if (!items.some((item) => item.id === selectedCharacteristicId.value)) {
      selectedCharacteristicId.value = items[0].id;
    }
  },
  { immediate: true }
);
</script>

<template>
  <section class="page">
    <div class="page-shell">
      <header class="page-hero">
        <p class="page-eyebrow">Module 2</p>
        <h1 class="page-title">Point Group Decision Flowchart</h1>
        <p class="page-lead">
          Follow the decision tree to inspect point-group families and open one
          representative molecule for each concrete point group.
        </p>
      </header>

      <div class="flow-layout">
        <PointGroupFlowchart
          :nodes="FLOW_NODES"
          :edges="FLOW_EDGES"
          :special-families="FLOW_SPECIAL_FAMILIES"
          :selected-family="selectedFamily"
          :available-families="availableFamilies"
          @select-family="onSelectFamily"
        />

        <aside class="page-panel side-panel">
          <div class="stack">
            <p class="panel-title">Example Point Groups</p>
            <div class="group-list">
              <button
                v-for="groupName in concreteGroups"
                :key="groupName"
                type="button"
                class="group-button"
                :class="{ 'group-button--active': groupName === selectedConcreteGroup }"
                @click="onSelectConcreteGroup(groupName)"
              >
                <LatexInline :expr="toGroupLatex(groupName)" />
              </button>
              <p v-if="!concreteGroups.length" class="soft-text">
                No molecule is currently available in calculations for this family.
              </p>
            </div>
          </div>

          <div class="stack">
            <p class="panel-title">Representative Molecule</p>
            <template v-if="representativeRecord">
              <SymmetryMoleculeViewer
                :atoms="representativeRecord.atoms"
                :bonds="representativeRecord.bonds"
                :layers="flowchartLayers"
                :active-layer-ids="activeLayerIds"
              />
              <p class="panel-title panel-title--compact">Formula</p>
              <p class="molecule-formula">
                <LatexInline :expr="toDisplayFormulaLatex(activePointGroupName, representativeRecord.formula)" />
              </p>

              <div class="theory-block">
                <p class="panel-title">Characteristic Symmetry Elements</p>
                <div class="symbol-list">
                  <button
                    v-for="item in characteristicElementItems"
                    :key="item.id"
                    type="button"
                    class="symbol-chip"
                    :class="{ 'symbol-chip--active': item.id === selectedCharacteristicId }"
                    @click="selectedCharacteristicId = item.id"
                  >
                    <LatexInline :expr="item.symbol" />
                  </button>
                </div>
              </div>

              <div class="theory-block">
                <p class="panel-title">Full Symmetry Operations Set</p>
                <div class="symbol-list operations-list">
                  <span
                    v-for="(operationLatex, index) in operationsDetail.operationsListLatex"
                    :key="`${operationLatex}-${index}`"
                    class="symbol-chip"
                  >
                    <LatexInline :expr="operationLatex" />
                  </span>
                </div>
                <p class="theory-line">
                  <strong>Order of Group:</strong>
                  <span class="order-value"><LatexInline :expr="operationsDetail.orderLatex" /></span>
                </p>
              </div>
            </template>
            <p v-else class="soft-text">
              Choose an available concrete point group to view its representative molecule.
            </p>
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.flow-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.side-panel {
  display: grid;
  gap: 1rem;
  align-content: start;
  position: sticky;
  top: 0.8rem;
}

.group-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.group-button {
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(59, 130, 246, 0.38);
  background: rgba(255, 255, 255, 0.98);
  color: #1d4ed8;
  border-radius: 0.82rem;
  min-height: 2.2rem;
  min-width: 4rem;
  padding: 0.48rem 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.group-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(37, 99, 235, 0.1);
}

.group-button--active {
  border-color: rgba(37, 99, 235, 0.82);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(219, 234, 254, 0.94));
}

.molecule-formula {
  margin: 0;
  color: #334155;
}

.panel-title--compact {
  margin-top: 0.1rem;
}

.theory-block {
  display: grid;
  gap: 0.45rem;
}

.symbol-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.operations-list .symbol-chip {
  background: rgba(239, 246, 255, 0.72);
}

.symbol-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.3rem 0.68rem;
  border-radius: 0.72rem;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: rgba(248, 250, 252, 0.94);
  color: #334155;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
}

.symbol-chip--active {
  border-color: rgba(37, 99, 235, 0.78);
  background: rgba(219, 234, 254, 0.96);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.36);
}

.theory-line {
  margin: 0;
  line-height: 1.6;
  color: #334155;
}

.order-value {
  margin-left: 0.38rem;
}

@media (max-width: 1280px) {
  .flow-layout {
    grid-template-columns: 1fr;
  }

  .side-panel {
    position: static;
  }
}
</style>
