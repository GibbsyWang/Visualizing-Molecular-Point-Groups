<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const PRINCIPAL_AXIS_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 1, 0)
);
const ATOM_RADIUS_SCALE = 1.3;

const props = defineProps({
  atoms: {
    type: Array,
    default: () => []
  },
  bonds: {
    type: Array,
    default: () => []
  },
  layers: {
    type: Array,
    default: () => []
  },
  activeLayerIds: {
    type: Array,
    default: () => []
  },
  operation: {
    type: Object,
    default: null
  },
  operationFocus: {
    type: Object,
    default: null
  },
  operationAnimationKey: {
    type: [Number, String],
    default: 0
  },
  rushOperationKey: {
    type: [Number, String],
    default: 0
  },
  resetPoseKey: {
    type: [Number, String],
    default: 0
  },
  showAtomIndices: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["operation-progress"]);

const host = ref(null);

let renderer;
let scene;
let camera;
let controls;
let resizeObserver;
let animationFrame = 0;
let frameGroup;
let moleculeAnimatedGroup;
let moleculeContentGroup;
let layerGroup;
let normalizedAtoms = [];
let operationAnimation = null;
let atomIndexSprites = [];
let cachedOperationMatrix = new THREE.Matrix4().identity();

let rotationGuideGroup = null;
let rotationGuideSectorMesh = null;
let rotationGuideRay = null;
let rotationGuideText = null;

function clearObjectResources(object3d) {
  object3d.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
    } else if (object.material) {
      object.material.dispose();
    }
  });
}

function emitOperationProgress(payload = {}) {
  emit("operation-progress", {
    active: false,
    completed: false,
    type: "",
    progress: 0,
    angleDeg: null,
    ...payload
  });
}

function resetOperationTransform() {
  if (!moleculeAnimatedGroup) {
    return;
  }

  cachedOperationMatrix.identity();
  moleculeAnimatedGroup.matrixAutoUpdate = true;
  moleculeAnimatedGroup.position.set(0, 0, 0);
  moleculeAnimatedGroup.quaternion.identity();
  moleculeAnimatedGroup.scale.set(1, 1, 1);
  moleculeAnimatedGroup.updateMatrix();
}

function setAtomIndexVisible(visible) {
  atomIndexSprites.forEach((sprite) => {
    sprite.visible = visible;
  });
}

function syncAtomIndexVisibility() {
  const duringInversion = operationAnimation?.operation?.type === "inversion";
  setAtomIndexVisible(Boolean(props.showAtomIndices || duringInversion));
}

function clearMoleculeGroup() {
  if (!moleculeContentGroup || !moleculeAnimatedGroup) {
    return;
  }

  clearObjectResources(moleculeContentGroup);
  moleculeAnimatedGroup.remove(moleculeContentGroup);
  moleculeContentGroup = null;
  normalizedAtoms = [];
  atomIndexSprites = [];
  operationAnimation = null;
  resetOperationTransform();
  emitOperationProgress();
}

function clearLayerGroup() {
  if (!layerGroup || !frameGroup) {
    return;
  }

  clearObjectResources(layerGroup);
  frameGroup.remove(layerGroup);
  layerGroup = null;
}

function markMoleculeObject(object3d) {
  object3d.renderOrder = 20;
}

function markLayerObject(object3d) {
  object3d.traverse((child) => {
    child.renderOrder = 2;
    if (!child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if ("transparent" in material) {
        material.transparent = true;
      }
      if ("depthWrite" in material) {
        material.depthWrite = false;
      }
    });
  });
}

function getElementRadius(atom) {
  let radius;
  if (atom.element === "H") {
    radius = atom.active ? 0.22 : 0.17;
    return radius * ATOM_RADIUS_SCALE;
  }

  if (atom.element === "C") {
    radius = atom.active ? 0.32 : atom.isSelectedElement ? 0.28 : 0.25;
    return radius * ATOM_RADIUS_SCALE;
  }

  radius = atom.active ? 0.3 : 0.23;
  return radius * ATOM_RADIUS_SCALE;
}

function getNormalizationTransform() {
  if (!props.atoms.length) {
    return {
      center: { x: 0, y: 0, z: 0 },
      scale: 1
    };
  }

  const center = props.atoms.reduce(
    (sum, atom) => ({
      x: sum.x + atom.x,
      y: sum.y + atom.y,
      z: sum.z + atom.z
    }),
    { x: 0, y: 0, z: 0 }
  );

  center.x /= props.atoms.length;
  center.y /= props.atoms.length;
  center.z /= props.atoms.length;

  const centeredAtoms = props.atoms.map((atom) => ({
    x: atom.x - center.x,
    y: atom.y - center.y,
    z: atom.z - center.z
  }));

  const maxDistance = Math.max(
    ...centeredAtoms.map((atom) => Math.sqrt(atom.x * atom.x + atom.y * atom.y + atom.z * atom.z)),
    1
  );

  return {
    center,
    scale: 2.6 / maxDistance
  };
}

function normalizePoint(point, transform) {
  return new THREE.Vector3(
    (point.x - transform.center.x) * transform.scale,
    (point.y - transform.center.y) * transform.scale,
    (point.z - transform.center.z) * transform.scale
  );
}

function getNormalizedAtoms() {
  if (!props.atoms.length) {
    return [];
  }

  const transform = getNormalizationTransform();

  const centeredAtoms = props.atoms.map((atom) => ({
    ...atom,
    nx: atom.x - transform.center.x,
    ny: atom.y - transform.center.y,
    nz: atom.z - transform.center.z
  }));

  return centeredAtoms.map((atom) => ({
    ...atom,
    nx: atom.nx * transform.scale,
    ny: atom.ny * transform.scale,
    nz: atom.nz * transform.scale
  }));
}

function getBondOffsetVector(start, end) {
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  let normal = new THREE.Vector3(0, 0, 1).cross(direction);

  if (normal.lengthSq() < 1e-6) {
    normal = new THREE.Vector3(0, 1, 0).cross(direction);
  }

  return normal.normalize().multiplyScalar(0.095);
}

function createCylinder(start, end, radius, color, opacity = 1) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18);
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    shininess: 60
  });
  const cylinder = new THREE.Mesh(geometry, material);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  cylinder.position.copy(midpoint);
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  markMoleculeObject(cylinder);
  return cylinder;
}

function createAtomIndexSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 84;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "bold 54px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 9;
  context.strokeStyle = "rgba(15, 23, 42, 0.78)";
  context.strokeText(String(text), canvas.width / 2, canvas.height / 2 + 1);
  context.fillStyle = "#f8fafc";
  context.fillText(String(text), canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.42, 0.29, 1);
  sprite.visible = false;
  sprite.renderOrder = 40;
  sprite.userData = { canvas, context, texture };
  return sprite;
}

function createAngleTextSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 90;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.95, 0.38, 1);
  sprite.renderOrder = 45;
  sprite.userData = { canvas, context, texture };
  updateAngleTextSprite(sprite, 0);
  return sprite;
}

function updateAngleTextSprite(sprite, angleDeg) {
  const { canvas, context, texture } = sprite.userData;
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(15, 23, 42, 0.8)";
  context.beginPath();
  const radius = 14;
  const x = 8;
  const y = 8;
  const width = canvas.width - 16;
  const height = canvas.height - 16;
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "bold 36px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`${angleDeg.toFixed(1)}\u00B0`, canvas.width / 2, canvas.height / 2 + 1);

  texture.needsUpdate = true;
}

function addDashedBond(group, start, end, radius, color, opacity, offset) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const unit = direction.clone().normalize();
  const dashLength = 0.11;
  const gapLength = 0.085;

  for (let traveled = 0; traveled < length; traveled += dashLength + gapLength) {
    const segmentStart = start
      .clone()
      .add(unit.clone().multiplyScalar(traveled))
      .add(offset);
    const segmentEnd = start
      .clone()
      .add(unit.clone().multiplyScalar(Math.min(traveled + dashLength, length)))
      .add(offset);

    if (segmentEnd.distanceTo(segmentStart) > 0.02) {
      group.add(createCylinder(segmentStart, segmentEnd, radius, color, opacity));
    }
  }
}

function clearRotationGuide() {
  if (!rotationGuideGroup || !frameGroup) {
    return;
  }

  clearObjectResources(rotationGuideGroup);
  frameGroup.remove(rotationGuideGroup);
  rotationGuideGroup = null;
  rotationGuideSectorMesh = null;
  rotationGuideRay = null;
  rotationGuideText = null;
}

function createSectorGeometry(sweep, radius) {
  const sweepAbs = Math.max(Math.min(Math.abs(sweep), Math.PI * 2), 1e-4);
  const signedSweep = sweep >= 0 ? sweepAbs : -sweepAbs;
  const segments = Math.max(10, Math.ceil((sweepAbs / (Math.PI * 2)) * 80));
  const vertices = [];

  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * signedSweep;
    const a1 = ((index + 1) / segments) * signedSweep;
    vertices.push(
      0, 0, 0,
      radius * Math.cos(a0), radius * Math.sin(a0), 0,
      radius * Math.cos(a1), radius * Math.sin(a1), 0
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createCircleLine(radius) {
  const points = Array.from({ length: 80 }, (_, index) => {
    const angle = (index / 80) * Math.PI * 2;
    return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: "#64748b", transparent: true, opacity: 0.42 });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = 41;
  return line;
}

function isHalfTurnRotation(operation) {
  if (!operation || operation.type !== "rotation") {
    return false;
  }
  return Math.abs(Math.abs(Number(operation.angle ?? 0)) - Math.PI) < 1e-3;
}

function getRotationDeltaAngle(operation, t = 1) {
  const amount = Number(operation?.angle ?? 0) * t;
  if (isHalfTurnRotation(operation)) {
    return Math.abs(amount);
  }
  return -amount;
}

function setupRotationGuide(operation) {
  clearRotationGuide();
  if (!frameGroup || !["rotation", "improperRotation"].includes(operation?.type)) {
    return;
  }

  const axis = new THREE.Vector3(...(operation.axis ?? [0, 0, 1])).normalize();
  let u;
  let v;

  // For C2: ray starts/ends on the horizontal plane (perpendicular to principal axis),
  // and sweep stays on the upper half-space.
  if (isHalfTurnRotation(operation)) {
    const principalAxis = new THREE.Vector3(0, 0, 1);
    u = new THREE.Vector3().crossVectors(principalAxis, axis);
    if (u.lengthSq() < 1e-6) {
      u = new THREE.Vector3(1, 0, 0);
      u.sub(axis.clone().multiplyScalar(axis.dot(u)));
    }
    u.normalize();
    v = new THREE.Vector3().crossVectors(axis, u).normalize();

    if (v.z < 0) {
      u.multiplyScalar(-1);
      v = new THREE.Vector3().crossVectors(axis, u).normalize();
    }
  } else {
    const candidate = Math.abs(axis.dot(new THREE.Vector3(0, 0, 1))) < 0.92
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(1, 0, 0);
    u = new THREE.Vector3().crossVectors(candidate, axis).normalize();
    if (u.lengthSq() < 1e-6) {
      u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), axis).normalize();
    }
    v = new THREE.Vector3().crossVectors(axis, u).normalize();
  }

  const radius = 1.16;
  rotationGuideGroup = new THREE.Group();
  const basis = new THREE.Matrix4().makeBasis(u, v, axis);
  rotationGuideGroup.setRotationFromMatrix(basis);
  rotationGuideGroup.renderOrder = 41;

  const sectorMaterial = new THREE.MeshBasicMaterial({
    color: "#3b82f6",
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  rotationGuideSectorMesh = new THREE.Mesh(createSectorGeometry(0.0001, radius), sectorMaterial);
  rotationGuideSectorMesh.renderOrder = 41;

  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(radius, 0, 0)
  ]);
  const rayMaterial = new THREE.LineBasicMaterial({ color: "#1d4ed8", transparent: true, opacity: 0.95 });
  rotationGuideRay = new THREE.Line(rayGeometry, rayMaterial);
  rotationGuideRay.renderOrder = 42;

  rotationGuideText = createAngleTextSprite();
  if (rotationGuideText) {
    rotationGuideText.position.set(radius * 0.62, 0, 0);
  }

  rotationGuideGroup.add(createCircleLine(radius), rotationGuideSectorMesh, rotationGuideRay);
  if (rotationGuideText) {
    rotationGuideGroup.add(rotationGuideText);
  }
  frameGroup.add(rotationGuideGroup);
}

function updateRotationGuide(currentAngleRad, currentAngleDeg) {
  if (!rotationGuideGroup || !rotationGuideSectorMesh || !rotationGuideRay) {
    return;
  }

  const radius = 1.16;
  const sweep = currentAngleRad;
  rotationGuideSectorMesh.geometry.dispose();
  rotationGuideSectorMesh.geometry = createSectorGeometry(sweep, radius);

  const endpoint = new THREE.Vector3(
    radius * Math.cos(sweep),
    radius * Math.sin(sweep),
    0
  );
  rotationGuideRay.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), endpoint]);

  if (rotationGuideText) {
    const half = sweep * 0.5;
    rotationGuideText.position.set(radius * 0.62 * Math.cos(half), radius * 0.62 * Math.sin(half), 0);
    updateAngleTextSprite(rotationGuideText, currentAngleDeg);
  }
}

function rebuildLayers() {
  if (!frameGroup || !props.layers.length) {
    clearLayerGroup();
    return;
  }

  clearLayerGroup();
  layerGroup = new THREE.Group();

  const layerMap = new Map(props.layers.map((layer) => [layer.id, layer]));
  props.activeLayerIds.forEach((layerId) => {
    const layer = layerMap.get(layerId);
    if (!layer || typeof layer.buildObjects !== "function") {
      return;
    }

    const objects = layer.buildObjects({
      THREE,
      normalizedAtoms,
      bonds: props.bonds,
      atoms: props.atoms,
      createCylinder,
      operationFocus: props.operationFocus
    });

    if (!Array.isArray(objects)) {
      return;
    }

    objects.forEach((object) => {
      if (object) {
        markLayerObject(object);
        layerGroup.add(object);
      }
    });
  });

  frameGroup.add(layerGroup);
}

function rebuildMolecule() {
  if (!scene || !moleculeAnimatedGroup) {
    return;
  }

  clearMoleculeGroup();

  if (!props.atoms.length) {
    rebuildLayers();
    return;
  }

  normalizedAtoms = getNormalizedAtoms();
  const normalization = getNormalizationTransform();
  const atomMap = new Map(normalizedAtoms.map((atom) => [atom.id, atom]));
  moleculeContentGroup = new THREE.Group();

  props.bonds.forEach((bond) => {
    const atomA = bond.atomA ? atomMap.get(bond.atomA.id) : null;
    const atomB = bond.atomB ? atomMap.get(bond.atomB.id) : null;

    if (!atomA || !atomB) {
      return;
    }

    const start = new THREE.Vector3(atomA.nx, atomA.ny, atomA.nz);
    const end = new THREE.Vector3(atomB.nx, atomB.ny, atomB.nz);
    const radius = bond.order === 3 ? 0.034 : bond.order === 2 ? 0.038 : 0.05;
    const color = new THREE.Color("#94a3b8");
    const opacity = 1;

    if (bond.aromatic) {
      const midpoint = start.clone().add(end).multiplyScalar(0.5);
      const aromaticCenter = bond.aromaticCenter
        ? normalizePoint(bond.aromaticCenter, normalization)
        : null;
      let offset = aromaticCenter ? aromaticCenter.clone().sub(midpoint) : getBondOffsetVector(start, end);
      const bondDirection = end.clone().sub(start).normalize();
      offset.sub(bondDirection.clone().multiplyScalar(offset.dot(bondDirection)));

      if (offset.lengthSq() < 1e-6) {
        offset = getBondOffsetVector(start, end);
      } else {
        offset.normalize().multiplyScalar(0.085);
      }

      moleculeContentGroup.add(createCylinder(start, end, 0.042, color, 1));
      addDashedBond(moleculeContentGroup, start, end, 0.022, color, 1, offset);
    } else if (bond.order === 2) {
      const offset = getBondOffsetVector(start, end);
      moleculeContentGroup.add(createCylinder(start.clone().add(offset), end.clone().add(offset), radius, color, opacity));
      moleculeContentGroup.add(createCylinder(start.clone().sub(offset), end.clone().sub(offset), radius, color, opacity));
    } else if (bond.order === 3) {
      const offset = getBondOffsetVector(start, end);
      const sideRadius = 0.026;
      moleculeContentGroup.add(createCylinder(start, end, radius, color, opacity));
      moleculeContentGroup.add(
        createCylinder(start.clone().add(offset), end.clone().add(offset), sideRadius, color, opacity)
      );
      moleculeContentGroup.add(
        createCylinder(start.clone().sub(offset), end.clone().sub(offset), sideRadius, color, opacity)
      );
    } else {
      moleculeContentGroup.add(createCylinder(start, end, radius, color, opacity));
    }
  });

  normalizedAtoms.forEach((atom) => {
    const radius = getElementRadius(atom);
    const geometry = new THREE.SphereGeometry(radius, 30, 30);
    const defaultOpacity = atom.isPrimaryElement ? 0.96 : 0.98;
    const opacity = Number.isFinite(atom.opacity) ? Math.min(Math.max(atom.opacity, 0), 1) : defaultOpacity;
    const material = new THREE.MeshPhongMaterial({
      color: atom.displayColor,
      emissive: atom.active ? new THREE.Color(atom.displayColor).multiplyScalar(0.12) : new THREE.Color("#000000"),
      transparent: opacity < 1,
      opacity,
      shininess: 72
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(atom.nx, atom.ny, atom.nz);
    sphere.userData = { atomId: atom.id };
    markMoleculeObject(sphere);

    const indexSprite = createAtomIndexSprite(atom.centerNumber ?? atom.id ?? "");
    if (indexSprite) {
      indexSprite.position.copy(sphere.position);
      atomIndexSprites.push(indexSprite);
      moleculeContentGroup.add(indexSprite);
    }

    moleculeContentGroup.add(sphere);
  });

  moleculeAnimatedGroup.add(moleculeContentGroup);
  resetOperationTransform();
  rebuildLayers();
  syncAtomIndexVisibility();
}

function updateSize() {
  if (!host.value || !renderer || !camera) {
    return;
  }

  const width = Math.max(host.value.clientWidth, 200);
  const height = Math.max(host.value.clientHeight, 220);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function easeInOutSine(value) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(value, 0), 1));
}

function createReflectionMatrix(normal, t) {
  const n = new THREE.Vector3(...normal).normalize();
  const xx = n.x * n.x;
  const yy = n.y * n.y;
  const zz = n.z * n.z;
  const xy = n.x * n.y;
  const xz = n.x * n.z;
  const yz = n.y * n.z;
  const factor = 2 * t;

  return new THREE.Matrix4().set(
    1 - factor * xx, -factor * xy, -factor * xz, 0,
    -factor * xy, 1 - factor * yy, -factor * yz, 0,
    -factor * xz, -factor * yz, 1 - factor * zz, 0,
    0, 0, 0, 1
  );
}

function composeOperationMatrix(operation, t) {
  if (!operation?.type) {
    return new THREE.Matrix4().identity();
  }

  if (operation.type === "rotation") {
    const axis = new THREE.Vector3(...(operation.axis ?? [0, 0, 1])).normalize();
    const angle = getRotationDeltaAngle(operation, t);
    return new THREE.Matrix4().makeRotationAxis(axis, angle);
  }

  if (operation.type === "reflection") {
    return createReflectionMatrix(operation.normal ?? [0, 0, 1], t);
  }

  if (operation.type === "inversion") {
    const scale = 1 - 2 * t;
    return new THREE.Matrix4().makeScale(scale, scale, scale);
  }

  if (operation.type === "improperRotation") {
    const axis = new THREE.Vector3(...(operation.axis ?? [0, 0, 1])).normalize();
    const angle = -Number(operation.angle ?? 0) * t;
    const rotation = new THREE.Matrix4().makeRotationAxis(axis, angle);
    const reflection = createReflectionMatrix(operation.normal ?? [0, 0, 1], t);
    return rotation.multiply(reflection);
  }

  return new THREE.Matrix4().identity();
}

function startOperationAnimation() {
  if (!moleculeAnimatedGroup || !props.operation?.type) {
    return;
  }

  const baseMatrix = moleculeAnimatedGroup.matrix.clone();
  operationAnimation = {
    operation: props.operation,
    startedAt: performance.now(),
    durationMs: 1500,
    baseMatrix
  };

  moleculeAnimatedGroup.matrixAutoUpdate = false;
  moleculeAnimatedGroup.matrix.copy(baseMatrix);
  moleculeAnimatedGroup.matrixWorldNeedsUpdate = true;
  if (["rotation", "improperRotation"].includes(props.operation.type)) {
    setupRotationGuide(props.operation);
    updateRotationGuide(0, 0);
  } else {
    clearRotationGuide();
  }
  syncAtomIndexVisibility();

  emitOperationProgress({
    active: true,
    completed: false,
    type: props.operation.type,
    progress: 0,
    angleDeg: ["rotation", "improperRotation"].includes(props.operation.type) ? 0 : null
  });
}

function finalizeCurrentOperation() {
  if (!operationAnimation || !moleculeAnimatedGroup) {
    return false;
  }

  const { operation, baseMatrix } = operationAnimation;
  const isRotation = ["rotation", "improperRotation"].includes(operation.type);
  const finalMatrix = composeOperationMatrix(operation, 1).multiply(baseMatrix);
  moleculeAnimatedGroup.matrix.copy(finalMatrix);
  moleculeAnimatedGroup.matrixWorldNeedsUpdate = true;
  cachedOperationMatrix.copy(finalMatrix);
  operationAnimation = null;
  syncAtomIndexVisibility();

  if (isRotation) {
    updateRotationGuide(getRotationDeltaAngle(operation, 1), (Math.abs(Number(operation.angle ?? 0)) * 180) / Math.PI);
  }

  emitOperationProgress({
    active: false,
    completed: true,
    type: operation.type ?? "",
    progress: 1,
    angleDeg: isRotation ? (Math.abs(Number(operation.angle ?? 0)) * 180) / Math.PI : null
  });
  return true;
}

function hardResetPose() {
  if (!moleculeAnimatedGroup) {
    return;
  }

  operationAnimation = null;
  clearRotationGuide();
  resetOperationTransform();
  syncAtomIndexVisibility();
  emitOperationProgress();
}

function accelerateCurrentOperation() {
  if (!operationAnimation || !moleculeAnimatedGroup) {
    return;
  }

  const now = performance.now();
  const elapsed = Math.max(0, now - operationAnimation.startedAt);
  const progress = Math.min(elapsed / operationAnimation.durationMs, 1);

  if (progress >= 1) {
    finalizeCurrentOperation();
    return;
  }

  const currentRemaining = (1 - progress) * operationAnimation.durationMs;
  const acceleratedRemaining = Math.max(120, Math.min(320, currentRemaining * 0.32));

  if (acceleratedRemaining >= currentRemaining - 1) {
    return;
  }

  const safeRemainingRatio = Math.max(1 - progress, 1e-4);
  const newDuration = acceleratedRemaining / safeRemainingRatio;
  operationAnimation.durationMs = newDuration;
  operationAnimation.startedAt = now - progress * newDuration;
}

function updateOperationAnimation(now) {
  if (!operationAnimation || !moleculeAnimatedGroup) {
    return;
  }

  const elapsed = now - operationAnimation.startedAt;
  const progress = Math.min(elapsed / operationAnimation.durationMs, 1);
  const t = easeInOutSine(progress);
  const deltaMatrix = composeOperationMatrix(operationAnimation.operation, t);
  const matrix = deltaMatrix.multiply(operationAnimation.baseMatrix);

  moleculeAnimatedGroup.matrix.copy(matrix);
  moleculeAnimatedGroup.matrixWorldNeedsUpdate = true;

  const isRotation = ["rotation", "improperRotation"].includes(operationAnimation.operation.type);
  const currentAngleDeg = isRotation
    ? (Math.abs(Number(operationAnimation.operation.angle ?? 0)) * t * 180) / Math.PI
    : null;

  if (isRotation) {
    updateRotationGuide(getRotationDeltaAngle(operationAnimation.operation, t), currentAngleDeg ?? 0);
  }

  emitOperationProgress({
    active: true,
    completed: false,
    type: operationAnimation.operation.type,
    progress,
    angleDeg: currentAngleDeg
  });

  if (progress >= 1) {
    finalizeCurrentOperation();
  }
}

function animate() {
  animationFrame = window.requestAnimationFrame(animate);
  updateOperationAnimation(performance.now());
  controls?.update();
  renderer?.render(scene, camera);
}

function initScene() {
  if (!host.value) {
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffffff");

  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.65, 11.8);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 18;
  controls.target.set(0, 0, 0);

  const ambientLight = new THREE.AmbientLight("#ffffff", 1.18);
  const keyLight = new THREE.DirectionalLight("#ffffff", 0.96);
  const fillLight = new THREE.DirectionalLight("#dbeafe", 0.62);
  const rimLight = new THREE.DirectionalLight("#f8fafc", 0.42);

  keyLight.position.set(3.5, 4.2, 6);
  fillLight.position.set(-4, -2.2, 5);
  rimLight.position.set(0, 2, -6);

  scene.add(ambientLight, keyLight, fillLight, rimLight);

  frameGroup = new THREE.Group();
  frameGroup.quaternion.copy(PRINCIPAL_AXIS_ROTATION);
  scene.add(frameGroup);

  moleculeAnimatedGroup = new THREE.Group();
  frameGroup.add(moleculeAnimatedGroup);

  updateSize();
  rebuildMolecule();
  animate();

  resizeObserver = new ResizeObserver(() => {
    updateSize();
  });
  resizeObserver.observe(host.value);
}

onMounted(() => {
  initScene();
});

watch(
  () => [props.atoms, props.bonds],
  () => {
    rebuildMolecule();
    updateSize();
  },
  { deep: true }
);

watch(
  () => [props.layers, props.activeLayerIds, props.operationFocus],
  () => {
    rebuildLayers();
  },
  { deep: true }
);

watch(
  () => props.showAtomIndices,
  () => {
    syncAtomIndexVisibility();
  }
);

watch(
  () => props.operation,
  (nextOperation) => {
    if (nextOperation?.type) {
      return;
    }

    operationAnimation = null;
    clearRotationGuide();
    syncAtomIndexVisibility();
    emitOperationProgress();
  },
  { deep: true }
);

watch(
  () => props.operationAnimationKey,
  () => {
    startOperationAnimation();
  }
);

watch(
  () => props.rushOperationKey,
  () => {
    accelerateCurrentOperation();
  }
);

watch(
  () => props.resetPoseKey,
  () => {
    hardResetPose();
  }
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  clearRotationGuide();
  clearLayerGroup();
  clearMoleculeGroup();
  controls?.dispose();
  renderer?.dispose();

  if (host.value && renderer?.domElement?.parentNode === host.value) {
    host.value.removeChild(renderer.domElement);
  }

  window.cancelAnimationFrame(animationFrame);
});
</script>

<template>
  <div ref="host" class="symmetry-molecule-viewer"></div>
</template>

<style scoped>
.symmetry-molecule-viewer {
  width: 100%;
  min-height: 320px;
  height: 420px;
  border-radius: 1rem;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(148, 163, 184, 0.08), transparent 40%),
    linear-gradient(180deg, #ffffff, #f8fafc);
}

.symmetry-molecule-viewer :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
