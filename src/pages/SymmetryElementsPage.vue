<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import SymmetryMoleculeViewer from "@/components/molecule/SymmetryMoleculeViewer.vue";
import LatexInline from "@/components/common/LatexInline.vue";
import { getMoleculeDataset } from "@/data/moleculeDatasetStore";
import { toPointGroupLatex } from "@/utils/pointGroupDetails";
import {
  createEthaneSymmetryLayers,
  createBenzeneSymmetryLayers,
  deriveBenzeneAxisAnglesFromAtoms
} from "@/data/symmetryLayers";

const DEG = "\u00B0";
const TAU = Math.PI * 2;
const MATRIX_EPS = 1e-5;
const TOOLTIP_DELAY_MS = 450;

function axisFromAngle(angle) {
  return [Math.cos(angle), Math.sin(angle), 0];
}

function normalFromPlaneAngle(angle) {
  return [-Math.sin(angle), Math.cos(angle), 0];
}

function identityMatrix3() {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
}

function multiplyMatrix3(a, b) {
  const out = identityMatrix3();
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row][col] =
        a[row][0] * b[0][col] +
        a[row][1] * b[1][col] +
        a[row][2] * b[2][col];
    }
  }
  return out;
}

function normalizeVector3(vector) {
  const [x, y, z] = vector;
  const length = Math.hypot(x, y, z);
  if (length < 1e-8) {
    return [0, 0, 1];
  }
  return [x / length, y / length, z / length];
}

function rotationMatrix3(axis, angle) {
  const [x, y, z] = normalizeVector3(axis);
  // In this module we use chemistry UI convention: positive power rotates clockwise.
  const signedAngle = -angle;
  const c = Math.cos(signedAngle);
  const s = Math.sin(signedAngle);
  const t = 1 - c;

  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c]
  ];
}

function reflectionMatrix3(normal) {
  const [x, y, z] = normalizeVector3(normal);
  return [
    [1 - 2 * x * x, -2 * x * y, -2 * x * z],
    [-2 * x * y, 1 - 2 * y * y, -2 * y * z],
    [-2 * x * z, -2 * y * z, 1 - 2 * z * z]
  ];
}

function operationToMatrix3(operation) {
  if (!operation?.type) {
    return identityMatrix3();
  }

  if (operation.type === "rotation") {
    return rotationMatrix3(operation.axis ?? [0, 0, 1], Number(operation.angle ?? 0));
  }

  if (operation.type === "reflection") {
    return reflectionMatrix3(operation.normal ?? [0, 0, 1]);
  }

  if (operation.type === "inversion") {
    return [
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, -1]
    ];
  }

  if (operation.type === "improperRotation") {
    const rotation = rotationMatrix3(operation.axis ?? [0, 0, 1], Number(operation.angle ?? 0));
    const reflection = reflectionMatrix3(operation.normal ?? [0, 0, 1]);
    return multiplyMatrix3(rotation, reflection);
  }

  return identityMatrix3();
}

function normalizeAngle(angle) {
  let normalized = angle % TAU;
  if (normalized < 0) {
    normalized += TAU;
  }
  return normalized;
}

function nearlyEqual(a, b, eps = MATRIX_EPS) {
  return Math.abs(a - b) <= eps;
}

function maxMatrixDifference(a, b) {
  let maxDiff = 0;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      maxDiff = Math.max(maxDiff, Math.abs(a[row][col] - b[row][col]));
    }
  }
  return maxDiff;
}

function matricesEquivalent(a, b, tolerance = 2e-3) {
  return maxMatrixDifference(a, b) <= tolerance;
}

function buildD6hOperationCatalog(baseAngle) {
  const sigmaH = reflectionMatrix3([0, 0, 1]);
  const catalog = [
    {
      id: "e",
      symbolLatex: "E",
      type: "identity",
      matrix: identityMatrix3()
    },
    {
      id: "c6-1",
      symbolLatex: "\\hat{C}_{6}",
      type: "rotation",
      matrix: rotationMatrix3([0, 0, 1], Math.PI / 3)
    },
    {
      id: "c6-5",
      symbolLatex: "\\hat{C}_{6}^{5}",
      type: "rotation",
      matrix: rotationMatrix3([0, 0, 1], (5 * Math.PI) / 3)
    },
    {
      id: "c3-1",
      symbolLatex: "\\hat{C}_{3}",
      type: "rotation",
      matrix: rotationMatrix3([0, 0, 1], (2 * Math.PI) / 3)
    },
    {
      id: "c3-2",
      symbolLatex: "\\hat{C}_{3}^{2}",
      type: "rotation",
      matrix: rotationMatrix3([0, 0, 1], (4 * Math.PI) / 3)
    },
    {
      id: "c2-main",
      symbolLatex: "\\hat{C}_{2}",
      type: "rotation",
      matrix: rotationMatrix3([0, 0, 1], Math.PI)
    },
    {
      id: "i",
      symbolLatex: "\\hat{i}",
      type: "inversion",
      matrix: [
        [-1, 0, 0],
        [0, -1, 0],
        [0, 0, -1]
      ]
    },
    {
      id: "sigma-h",
      symbolLatex: "\\hat{\\sigma}_{h}",
      type: "reflection",
      matrix: sigmaH
    },
    {
      id: "s6-1",
      symbolLatex: "\\hat{S}_{6}",
      type: "improperRotation",
      matrix: multiplyMatrix3(rotationMatrix3([0, 0, 1], Math.PI / 3), sigmaH)
    },
    {
      id: "s3-1",
      symbolLatex: "\\hat{S}_{3}",
      type: "improperRotation",
      matrix: multiplyMatrix3(rotationMatrix3([0, 0, 1], (2 * Math.PI) / 3), sigmaH)
    },
    {
      id: "s3-2",
      symbolLatex: "\\hat{S}_{3}^{2}",
      type: "improperRotation",
      matrix: multiplyMatrix3(rotationMatrix3([0, 0, 1], (4 * Math.PI) / 3), sigmaH)
    },
    {
      id: "s6-5",
      symbolLatex: "\\hat{S}_{6}^{5}",
      type: "improperRotation",
      matrix: multiplyMatrix3(rotationMatrix3([0, 0, 1], (5 * Math.PI) / 3), sigmaH)
    }
  ];

  for (let index = 0; index < 6; index += 1) {
    const angle = baseAngle + (index * Math.PI) / 6;
    catalog.push({
      id: `c2-perp-${index + 1}`,
      symbolLatex: `\\hat{C}_{2}(${index + 1})`,
      type: "rotation",
      matrix: rotationMatrix3(axisFromAngle(angle), Math.PI)
    });
  }

  for (let index = 0; index < 6; index += 1) {
    const angle = baseAngle + (index * Math.PI) / 6;
    catalog.push({
      id: `sigma-v-${index + 1}`,
      symbolLatex: `\\hat{\\sigma}_{v}(${index + 1})`,
      type: "reflection",
      matrix: reflectionMatrix3(normalFromPlaneAngle(angle))
    });
  }

  return catalog;
}

function buildD3dOperationCatalog() {
  const sigmaPerp = reflectionMatrix3([0, 0, 1]);
  const catalog = [
    {
      id: "e",
      symbolLatex: "E",
      type: "identity",
      matrix: identityMatrix3()
    },
    {
      id: "ethane-c3-1",
      symbolLatex: "\\hat{C}_{3}",
      type: "rotation",
      matrix: rotationMatrix3([0, 0, 1], (2 * Math.PI) / 3)
    },
    {
      id: "ethane-c3-2",
      symbolLatex: "\\hat{C}_{3}^{2}",
      type: "rotation",
      matrix: rotationMatrix3([0, 0, 1], (4 * Math.PI) / 3)
    },
    {
      id: "ethane-i",
      symbolLatex: "\\hat{i}",
      type: "inversion",
      matrix: [
        [-1, 0, 0],
        [0, -1, 0],
        [0, 0, -1]
      ]
    },
    {
      id: "ethane-s6-1",
      symbolLatex: "\\hat{S}_{6}",
      type: "improperRotation",
      matrix: multiplyMatrix3(rotationMatrix3([0, 0, 1], Math.PI / 3), sigmaPerp)
    },
    {
      id: "ethane-s6-5",
      symbolLatex: "\\hat{S}_{6}^{5}",
      type: "improperRotation",
      matrix: multiplyMatrix3(rotationMatrix3([0, 0, 1], (5 * Math.PI) / 3), sigmaPerp)
    }
  ];

  const c2Angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
  c2Angles.forEach((angle, index) => {
    catalog.push({
      id: `ethane-c2-${index + 1}`,
      symbolLatex: `\\hat{C}_{2}(${index + 1})`,
      type: "rotation",
      matrix: rotationMatrix3(axisFromAngle(angle), Math.PI)
    });
  });

  const sigmaDAngles = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];
  sigmaDAngles.forEach((angle, index) => {
    catalog.push({
      id: `ethane-sigma-d-${index + 1}`,
      symbolLatex: `\\hat{\\sigma}_{d}(${index + 1})`,
      type: "reflection",
      matrix: reflectionMatrix3(normalFromPlaneAngle(angle))
    });
  });

  return catalog;
}

function buildBenzeneSymmetryElements(baseAngle) {
  const sigmaVAngles = Array.from({ length: 6 }, (_, index) => baseAngle + (index * Math.PI) / 6);
  const c2Angles = Array.from({ length: 6 }, (_, index) => baseAngle + (index * Math.PI) / 6);

  return [
    {
      id: "c6",
      label: "C6",
      symbolLatex: "C_{6}",
      note: "Principal six-fold rotation axis.",
      layerIds: ["c6-axis"],
      operations: Array.from({ length: 5 }, (_, index) => {
        const power = index + 1;
        const angle = (Math.PI / 3) * power;
        return {
          id: `c6-${power}`,
          label: `C6^${power}`,
          symbolLatex: `\\hat{C}_{6}^{${power}}`,
          detail: `Rotation by ${power * 60}${DEG} around the principal axis.`,
          type: "rotation",
          axis: [0, 0, 1],
          angle,
          focus: { layerId: "c6-axis" }
        };
      })
    },
    {
      id: "six-sigma-v",
      label: "6sigma_v",
      symbolLatex: "6\\sigma_{v}",
      note: "Six vertical mirror planes containing the principal axis.",
      layerIds: ["sigma-v"],
      operations: sigmaVAngles.map((angle, index) => ({
        id: `sigma-v-${index + 1}`,
        label: `sigma_v(${index + 1})`,
        symbolLatex: `\\hat{\\sigma}_{v}(${index + 1})`,
        detail: "Reflection through one vertical mirror plane.",
        type: "reflection",
        normal: normalFromPlaneAngle(angle),
        focus: {
          layerId: "sigma-v",
          index
        }
      }))
    },
    {
      id: "s6",
      label: "S6",
      symbolLatex: "S_{6}",
      note: "Improper axis: rotate about C6, then reflect in sigma_h.",
      layerIds: ["c6-axis", "sigma-h"],
      operations: Array.from({ length: 5 }, (_, index) => {
        const power = index + 1;
        const angle = (Math.PI / 3) * power;
        return {
          id: `s6-${power}`,
          label: `S6^${power}`,
          symbolLatex: `\\hat{S}_{6}^{${power}}`,
          detail: `Improper rotation by ${power * 60}${DEG}: C6^${power} then reflection in sigma_h.`,
          type: "improperRotation",
          axis: [0, 0, 1],
          normal: [0, 0, 1],
          angle
        };
      })
    },
    {
      id: "six-c2",
      label: "6C2",
      symbolLatex: "6C_{2}",
      note: "Six two-fold axes perpendicular to the principal axis.",
      layerIds: ["c2-axes"],
      operations: c2Angles.map((angle, index) => ({
        id: `c2-${index + 1}`,
        label: `C2(${index + 1})`,
        symbolLatex: `\\hat{C}_{2}(${index + 1})`,
        detail: `180${DEG} rotation around one in-plane C2 axis.`,
        type: "rotation",
        axis: axisFromAngle(angle),
        angle: Math.PI,
        allowInverse: false,
        focus: {
          layerId: "c2-axes",
          index
        }
      }))
    },
    {
      id: "sigma-h",
      label: "sigma_h",
      symbolLatex: "\\sigma_{h}",
      note: "Mirror plane perpendicular to the principal axis.",
      layerIds: ["sigma-h"],
      operations: [
        {
          id: "sigma-h-1",
          label: "sigma_h",
          symbolLatex: "\\hat{\\sigma}_{h}",
          detail: "Reflection through the horizontal mirror plane.",
          type: "reflection",
          normal: [0, 0, 1],
          focus: { layerId: "sigma-h" }
        }
      ]
    },
    {
      id: "inversion",
      label: "i",
      symbolLatex: "i",
      note: "Inversion through the center:\n(x, y, z) -> (-x, -y, -z).",
      layerIds: ["inversion-center"],
      operations: [
        {
          id: "i-1",
          label: "i",
          symbolLatex: "\\hat{i}",
          detail: "Inversion through the center (x,y,z) -> (-x,-y,-z).",
          type: "inversion",
          focus: { layerId: "inversion-center" }
        }
      ]
    }
  ];
}

function buildEthaneSymmetryElements() {
  const c2Angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
  const sigmaDAngles = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];

  return [
    {
      id: "ethane-c3-main",
      label: "C3",
      symbolLatex: "C_{3}",
      note: "Principal three-fold rotation axis.",
      layerIds: ["ethane-c3-axis"],
      operations: [
        ...[1, 2].map((power) => ({
          id: `ethane-c3-main-${power}`,
          label: `C3^${power}`,
          symbolLatex: `\\hat{C}_{3}^{${power}}`,
          detail: `Rotation by ${power * 120}${DEG} around the molecular axis.`,
          type: "rotation",
          axis: [0, 0, 1],
          angle: (power * 2 * Math.PI) / 3,
          focus: { layerId: "ethane-c3-axis" }
        }))
      ]
    },
    {
      id: "ethane-three-c2",
      label: "3C2",
      symbolLatex: "3C_{2}",
      note: "Three two-fold axes perpendicular to the principal axis.",
      layerIds: ["ethane-c2-perp"],
      operations: c2Angles.map((angle, index) => ({
        id: `ethane-c2-perp-${index + 1}`,
        label: `C2(${index + 1})`,
        symbolLatex: `\\hat{C}_{2}(${index + 1})`,
        detail: `Rotation by 180${DEG} around one perpendicular C2 axis.`,
        type: "rotation",
        axis: axisFromAngle(angle),
        angle: Math.PI,
        allowInverse: false,
        focus: {
          layerId: "ethane-c2-perp",
          index
        }
      }))
    },
    {
      id: "ethane-three-sigma-d",
      label: "3sigma_d",
      symbolLatex: "3\\sigma_{d}",
      note: "Three diagonal mirror planes bisecting the C2 axes.",
      layerIds: ["ethane-sigma-d"],
      operations: sigmaDAngles.map((angle, index) => ({
        id: `ethane-sigma-d-${index + 1}`,
        label: `sigma_d(${index + 1})`,
        symbolLatex: `\\hat{\\sigma}_{d}(${index + 1})`,
        detail: "Reflection through one diagonal mirror plane.",
        type: "reflection",
        normal: normalFromPlaneAngle(angle),
        focus: {
          layerId: "ethane-sigma-d",
          index
        }
      }))
    },
    {
      id: "ethane-s6",
      label: "S6",
      symbolLatex: "S_{6}",
      note: "Improper axis: rotate about C6, then reflect in sigma_h.",
      layerIds: ["ethane-c3-axis", "ethane-s6-mirror"],
      operations: [1, 5].map((power) => ({
        id: `ethane-s6-${power}`,
        label: `S6^${power}`,
        symbolLatex: `\\hat{S}_{6}^{${power}}`,
        detail: `Improper rotation by ${power * 60}${DEG}: C6^${power} then reflection in a plane normal to the axis.`,
        type: "improperRotation",
        axis: [0, 0, 1],
        normal: [0, 0, 1],
        angle: (power * Math.PI) / 3
      }))
    },
    {
      id: "ethane-inversion",
      label: "i",
      symbolLatex: "i",
      note: "Inversion through the center:\n(x, y, z) -> (-x, -y, -z).",
      layerIds: ["ethane-inversion-center"],
      operations: [
        {
          id: "ethane-i-1",
          label: "i",
          symbolLatex: "\\hat{i}",
          detail: "Inversion through the center (x,y,z) -> (-x,-y,-z).",
          type: "inversion",
          focus: { layerId: "ethane-inversion-center" }
        }
      ]
    }
  ];
}

function buildReducedEquivalentData(matrix, groupCatalog) {
  if (!Array.isArray(groupCatalog) || !groupCatalog.length) {
    return { mode: "text", textLatex: "\\equiv \\text{N/A}" };
  }

  const matches = groupCatalog
    .filter((entry) => matricesEquivalent(matrix, entry.matrix))
    .map((entry) => ({
      symbolLatex: entry.symbolLatex,
      type: entry.type ?? "identity",
      isInverse: Boolean(entry.isInverse)
    }))
    .filter((entry) => Boolean(entry.symbolLatex));

  const deduped = [];
  const seen = new Set();
  matches.forEach((entry) => {
    const key = `${entry.symbolLatex}|${entry.type}|${entry.isInverse ? 1 : 0}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(entry);
  });

  if (!deduped.length) {
    return { mode: "text", textLatex: "\\equiv \\text{No group match}" };
  }

  return { mode: "ops", operations: deduped };
}

function shouldShowInverseButton(operation) {
  if (!operation || !["rotation", "improperRotation"].includes(operation.type)) {
    return false;
  }

  if (operation.allowInverse === false) {
    return false;
  }

  if (String(operation.id ?? "").startsWith("c2-")) {
    return false;
  }

  const normalized = normalizeAngle(Number(operation.angle ?? 0));
  return !nearlyEqual(normalized, 0, 4e-3);
}

function toInverseLatex(symbolLatex, fallbackLabel = "g") {
  const symbol = symbolLatex || fallbackLabel;
  return `\\left(${symbol}\\right)^{-1}`;
}

function createInverseOperation(operation) {
  if (!shouldShowInverseButton(operation)) {
    return null;
  }

  const inverseAngle =
    operation.type === "rotation" || operation.type === "improperRotation"
      ? -Number(operation.angle ?? 0)
      : operation.angle;
  return {
    ...operation,
    id: `${operation.id}__inv`,
    label: `${operation.label}^-1`,
    symbolLatex: toInverseLatex(operation.symbolLatex, operation.label),
    detail: `Inverse operation. ${operation.detail}`,
    angle: inverseAngle,
    isInverse: true,
    inverseOf: operation.id
  };
}

function tokenizeLatexSegments(text) {
  if (!text) {
    return [];
  }

  const tokenRegex = /(sigma_h|sigma_v|sigma_d|C6\^\d+|C3\^\d+|S6\^\d+|C6|C3|C2|S6)/g;
  const latexMap = {
    sigma_h: "\\sigma_{h}",
    sigma_v: "\\sigma_{v}",
    sigma_d: "\\sigma_{d}",
    C6: "C_{6}",
    C3: "C_{3}",
    C2: "C_{2}",
    S6: "S_{6}"
  };

  const rawSegments = [];
  let lastIndex = 0;

  String(text).replace(tokenRegex, (match, _token, index) => {
    if (index > lastIndex) {
      rawSegments.push({ type: "text", value: String(text).slice(lastIndex, index) });
    }
    const c6PowerMatch = match.match(/^C6\^(\d+)$/);
    if (c6PowerMatch) {
      rawSegments.push({ type: "latex", value: `C_{6}^{${c6PowerMatch[1]}}` });
      lastIndex = index + match.length;
      return match;
    }

    const c3PowerMatch = match.match(/^C3\^(\d+)$/);
    if (c3PowerMatch) {
      rawSegments.push({ type: "latex", value: `C_{3}^{${c3PowerMatch[1]}}` });
      lastIndex = index + match.length;
      return match;
    }

    const s6PowerMatch = match.match(/^S6\^(\d+)$/);
    if (s6PowerMatch) {
      rawSegments.push({ type: "latex", value: `S_{6}^{${s6PowerMatch[1]}}` });
      lastIndex = index + match.length;
      return match;
    }

    rawSegments.push({ type: "latex", value: latexMap[match] ?? match });
    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < String(text).length) {
    rawSegments.push({ type: "text", value: String(text).slice(lastIndex) });
  }

  const segments = [];
  rawSegments.forEach((segment) => {
    if (segment.type !== "text") {
      segments.push(segment);
      return;
    }

    const parts = segment.value.split("\n");
    parts.forEach((part, index) => {
      if (part) {
        segments.push({ type: "text", value: part });
      }
      if (index < parts.length - 1) {
        segments.push({ type: "break" });
      }
    });
  });

  return segments;
}

function tokenizeElementNote(note) {
  return tokenizeLatexSegments(note);
}

const dataset = getMoleculeDataset({ includeLog: true, includeGjf: false });
const benzeneLayers = createBenzeneSymmetryLayers();
const ethaneLayers = createEthaneSymmetryLayers();

const MOLECULE_TABS = [
  {
    id: "benzene",
    label: "Benzene",
    title: "Benzene",
    pointGroup: "D6h",
    defaultElementId: "c6"
  },
  {
    id: "ethane",
    label: "Ethane",
    title: "Ethane",
    pointGroup: "D3d",
    defaultElementId: "ethane-c3-main"
  }
];

const selectedMoleculeId = ref("benzene");

const selectedElementId = ref("c6");
const selectedOperationId = ref("");
const focusedOperationId = ref("");
const hoveredOperationId = ref("");
const operationAnimationKey = ref(0);
const rushOperationKey = ref(0);
const resetPoseKey = ref(0);
const operationProductTerms = ref([]);
const cumulativeOperationMatrix = ref(identityMatrix3());
const pendingOperationQueue = ref([]);
const isOperationExecuting = ref(false);
const currentPlaybackOperation = ref(null);
const tooltipRef = ref(null);
const tooltipTimer = ref(null);
const tooltipState = ref({
  visible: false,
  operationId: "",
  detail: "",
  top: 0,
  left: 0,
  pinnedRight: false
});
const tooltipAnchor = ref(null);
const operationStatus = ref({
  active: false,
  completed: false,
  type: "",
  progress: 0,
  angleDeg: null
});

const benzeneRecord = computed(
  () =>
    dataset.representativeByConcreteGroup.get("D6h") ??
    dataset.records.find((record) => record.fileName.toUpperCase() === "C6H6.LOG") ??
    null
);

const ethaneRecord = computed(
  () =>
    dataset.representativeByConcreteGroup.get("D3d") ??
    dataset.records.find((record) => record.fileName.toUpperCase() === "CH3CH3-D3D.LOG") ??
    null
);

const currentMoleculeRecord = computed(() => {
  if (selectedMoleculeId.value === "ethane") {
    return ethaneRecord.value ?? benzeneRecord.value ?? dataset.records[0] ?? null;
  }

  return benzeneRecord.value ?? ethaneRecord.value ?? dataset.records[0] ?? null;
});

const symmetryLayers = computed(() => (selectedMoleculeId.value === "ethane" ? ethaneLayers : benzeneLayers));

const benzeneBaseAngle = computed(() => {
  if (!benzeneRecord.value?.atoms?.length) {
    return 0;
  }
  const axisAngles = deriveBenzeneAxisAnglesFromAtoms(benzeneRecord.value.atoms);
  return axisAngles[0] ?? 0;
});

const symmetryElements = computed(() => {
  if (selectedMoleculeId.value === "ethane") {
    return buildEthaneSymmetryElements();
  }

  return buildBenzeneSymmetryElements(benzeneBaseAngle.value);
});
const symmetryElementsView = computed(() =>
  symmetryElements.value.map((item) => ({
    ...item,
    _noteSegments: tokenizeElementNote(item.note)
  }))
);

const selectedElement = computed(
  () => symmetryElementsView.value.find((item) => item.id === selectedElementId.value) ?? symmetryElementsView.value[0] ?? null
);

const operationsForSelectedElement = computed(() => selectedElement.value?.operations ?? []);
const operationRows = computed(() =>
  operationsForSelectedElement.value.map((operation) => ({
    forward: operation,
    inverse: createInverseOperation(operation)
  }))
);
const operationEntries = computed(() =>
  operationRows.value.flatMap((row) => (row.inverse ? [row.forward, row.inverse] : [row.forward]))
);

watch(
  operationsForSelectedElement,
  (operations) => {
    if (!operations.length) {
      selectedOperationId.value = "";
      focusedOperationId.value = "";
      return;
    }

    // Keep default state unselected; only preserve selection if it is still valid.
    if (selectedOperationId.value && !operations.some((operation) => operation.id === selectedOperationId.value)) {
      selectedOperationId.value = "";
    }

    if (!operations.some((operation) => operation.id === focusedOperationId.value)) {
      focusedOperationId.value = "";
    }

    if (!operations.some((operation) => operation.id === hoveredOperationId.value)) {
      hoveredOperationId.value = "";
    }

    if (!operations.some((operation) => operation.id === tooltipState.value.operationId)) {
      hideTooltip();
    }
  },
  { immediate: true }
);

watch(isOperationExecuting, (executing) => {
  if (executing) {
    hideTooltip();
  }
});

onBeforeUnmount(() => {
  hideTooltip();
});

const playbackOperation = computed(() => currentPlaybackOperation.value);
const hoveredOperation = computed(() => operationEntries.value.find((operation) => operation.id === hoveredOperationId.value) ?? null);
const displayFocusedOperation = computed(() => {
  if (isOperationExecuting.value) {
    return currentPlaybackOperation.value?.focus?.layerId ? currentPlaybackOperation.value : null;
  }

  if (hoveredOperation.value?.focus?.layerId) {
    return hoveredOperation.value;
  }

  return null;
});

const activeLayerIds = computed(() => {
  if (displayFocusedOperation.value?.focus?.layerId) {
    return [displayFocusedOperation.value.focus.layerId];
  }

  return selectedElement.value?.layerIds ?? [];
});

const operationFocus = computed(() => displayFocusedOperation.value?.focus ?? null);

const operationProductDisplayTerms = computed(() => {
  if (!operationProductTerms.value.length) {
    return [{ symbolLatex: "E", type: "identity", isInverse: false }];
  }

  return [...operationProductTerms.value, { symbolLatex: "E", type: "identity", isInverse: false }];
});

const operationCatalog = computed(() =>
  selectedMoleculeId.value === "ethane" ? buildD3dOperationCatalog() : buildD6hOperationCatalog(benzeneBaseAngle.value)
);
const reducedEquivalentData = computed(() => buildReducedEquivalentData(cumulativeOperationMatrix.value, operationCatalog.value));
const currentPointGroupLatex = computed(() => {
  const pointGroup = currentMoleculeRecord.value?.pointGroup ?? "";
  return toPointGroupLatex(pointGroup) || pointGroup;
});
const activeTooltipSegments = computed(() => tokenizeLatexSegments(tooltipState.value.detail));

const operationLayoutMode = computed(() => {
  if (selectedElementId.value === "c6" || selectedElementId.value === "s6") {
    return "two-by-five";
  }

  if (selectedElementId.value === "six-sigma-v" || selectedElementId.value === "six-c2") {
    return "two-by-three";
  }

  if (operationRows.value.some((row) => Boolean(row.inverse))) {
    return "two-column";
  }

  return "single";
});

const operationButtons = computed(() => {
  if (operationRows.value.some((row) => Boolean(row.inverse))) {
    return operationRows.value.flatMap((row) => [row.forward, row.inverse].filter(Boolean));
  }

  return operationsForSelectedElement.value;
});

function clearTooltipTimer() {
  if (!tooltipTimer.value) {
    return;
  }

  clearTimeout(tooltipTimer.value);
  tooltipTimer.value = null;
}

function hideTooltip() {
  clearTooltipTimer();
  tooltipState.value.visible = false;
  tooltipState.value.operationId = "";
  tooltipAnchor.value = null;
}

function computeTooltipPosition(anchorEl, isInverse = false) {
  const rect = anchorEl.getBoundingClientRect();
  const tooltipWidth = tooltipRef.value?.offsetWidth ?? 288;
  const tooltipHeight = tooltipRef.value?.offsetHeight ?? 72;
  const margin = 10;

  let left = isInverse ? rect.right - tooltipWidth : rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));

  let top = rect.top - tooltipHeight - 8;
  if (top < margin) {
    top = Math.min(window.innerHeight - tooltipHeight - margin, rect.bottom + 8);
  }

  return { top, left };
}

function updateTooltipPosition() {
  if (!tooltipState.value.visible || !tooltipAnchor.value) {
    return;
  }

  const { top, left } = computeTooltipPosition(tooltipAnchor.value, tooltipState.value.pinnedRight);
  tooltipState.value.top = top;
  tooltipState.value.left = left;
}

function showTooltipForOperation(operation, anchorEl) {
  tooltipAnchor.value = anchorEl;
  tooltipState.value.operationId = operation.id;
  tooltipState.value.detail = operation.detail ?? "";
  tooltipState.value.pinnedRight = Boolean(operation.isInverse);
  tooltipState.value.visible = true;

  nextTick(() => {
    updateTooltipPosition();
  });
}

function handleOperationMouseEnter(operation, event) {
  if (isOperationExecuting.value) {
    return;
  }

  if (hoveredOperationId.value === operation.id && tooltipState.value.visible) {
    return;
  }

  hoveredOperationId.value = operation.id;
  clearTooltipTimer();
  const anchorEl = event.currentTarget;
  if (!anchorEl) {
    return;
  }

  tooltipTimer.value = setTimeout(() => {
    showTooltipForOperation(operation, anchorEl);
  }, TOOLTIP_DELAY_MS);
}

function handleOperationMouseLeave() {
  hoveredOperationId.value = "";
  hideTooltip();
}

watch(
  symmetryElementsView,
  (elements) => {
    if (!elements.some((item) => item.id === selectedElementId.value)) {
      selectedElementId.value = elements[0]?.id ?? "";
    }
  },
  { immediate: true }
);

function selectMolecule(moleculeId) {
  if (moleculeId === selectedMoleculeId.value) {
    return;
  }

  selectedMoleculeId.value = moleculeId;
  const nextTab = MOLECULE_TABS.find((item) => item.id === moleculeId);
  selectedElementId.value = nextTab?.defaultElementId ?? "";
  resetPose();
}

function applyElementSelection(elementId) {
  selectedElementId.value = elementId;
  pendingOperationQueue.value = [];
  focusedOperationId.value = "";
  hoveredOperationId.value = "";
  operationStatus.value = {
    active: false,
    completed: false,
    type: "",
    progress: 0,
    angleDeg: null
  };
  hideTooltip();
}

function selectElement(elementId) {
  if (elementId === selectedElementId.value) {
    return;
  }

  // Allow element switching during animation without interrupting the in-flight operation.
  selectedElementId.value = elementId;
  hoveredOperationId.value = "";
  hideTooltip();

  if (isOperationExecuting.value) {
    return;
  }

  applyElementSelection(elementId);
}

function executeOperation(operation) {
  isOperationExecuting.value = true;
  currentPlaybackOperation.value = operation;
  selectedOperationId.value = operation.id;
  focusedOperationId.value = operation.id;
  operationProductTerms.value.unshift({
    symbolLatex: operation.symbolLatex ?? operation.label,
    type: operation.type ?? "identity",
    isInverse: Boolean(operation.isInverse)
  });
  cumulativeOperationMatrix.value = multiplyMatrix3(operationToMatrix3(operation), cumulativeOperationMatrix.value);
  operationAnimationKey.value += 1;
}

function flushOperationQueue() {
  if (isOperationExecuting.value) {
    return false;
  }

  const next = pendingOperationQueue.value.shift();
  if (!next) {
    return false;
  }

  executeOperation(next);
  return true;
}

function rushCurrentOperationIfQueued() {
  if (!isOperationExecuting.value) {
    return;
  }

  if (!pendingOperationQueue.value.length) {
    return;
  }

  rushOperationKey.value += 1;
}

function enqueueOperation(operation) {
  hoveredOperationId.value = "";
  pendingOperationQueue.value.push(operation);
  rushCurrentOperationIfQueued();
  flushOperationQueue();
}

function handleOperationProgress(payload) {
  operationStatus.value = payload;

  if (payload.active) {
    isOperationExecuting.value = true;
    return;
  }

  if (payload.completed) {
    isOperationExecuting.value = false;
    const startedNext = flushOperationQueue();
    if (!startedNext) {
      focusedOperationId.value = "";
      currentPlaybackOperation.value = null;
    }
  }
}

function resetPose() {
  pendingOperationQueue.value = [];
  isOperationExecuting.value = false;
  currentPlaybackOperation.value = null;
  selectedOperationId.value = "";
  focusedOperationId.value = "";
  hoveredOperationId.value = "";
  operationProductTerms.value = [];
  cumulativeOperationMatrix.value = identityMatrix3();
  operationStatus.value = {
    active: false,
    completed: false,
    type: "",
    progress: 0,
    angleDeg: null
  };
  resetPoseKey.value += 1;
  hideTooltip();
}
</script>

<template>
  <section class="page">
    <div class="page-shell">
      <header class="page-hero">
        <p class="page-eyebrow">Module 1</p>
        <h1 class="page-title">Symmetry Elements and Symmetry Operations</h1>
        <p class="page-lead">Select a symmetry element, then play each related operation to view its geometric action directly in 3D.</p>
      </header>

      <div class="module-grid">
        <section class="page-panel stack elements-panel">
          <p class="panel-title">Symmetry Elements</p>

          <div class="element-list">
            <button
              v-for="item in symmetryElementsView"
              :key="item.id"
              type="button"
              class="element-button"
              :class="{ 'element-button--active': item.id === selectedElementId }"
              @click="selectElement(item.id)"
            >
              <span class="element-name"><LatexInline :expr="item.symbolLatex ?? item.label" /></span>
              <span class="element-note">
                <template v-for="(segment, segmentIndex) in item._noteSegments" :key="`${item.id}-note-${segmentIndex}`">
                  <LatexInline v-if="segment.type === 'latex'" :expr="segment.value" />
                  <br v-else-if="segment.type === 'break'" />
                  <span v-else>{{ segment.value }}</span>
                </template>
              </span>
            </button>
          </div>
        </section>

        <section class="page-panel viewer-panel">
          <div class="molecule-tabs">
            <button
              v-for="tab in MOLECULE_TABS"
              :key="tab.id"
              type="button"
              class="molecule-tab"
              :class="{ 'molecule-tab--active': tab.id === selectedMoleculeId }"
              @click="selectMolecule(tab.id)"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="molecule-meta" v-if="currentMoleculeRecord">
            <span class="chip"><LatexInline :expr="currentPointGroupLatex" /></span>
          </div>

          <SymmetryMoleculeViewer
            v-if="currentMoleculeRecord"
            :atoms="currentMoleculeRecord.atoms"
            :bonds="currentMoleculeRecord.bonds"
            :layers="symmetryLayers"
            :active-layer-ids="activeLayerIds"
            :operation="playbackOperation"
            :operation-focus="operationFocus"
            :operation-animation-key="operationAnimationKey"
            :rush-operation-key="rushOperationKey"
            :reset-pose-key="resetPoseKey"
            :show-atom-indices="true"
            @operation-progress="handleOperationProgress"
          />
          <p v-else class="soft-text">No molecule geometry was loaded from calculations.</p>

          <div class="pose-track" v-if="currentMoleculeRecord">
            <p class="panel-title">Operation Product</p>
            <p class="pose-expression">
              <template v-for="(term, index) in operationProductDisplayTerms" :key="`product-term-${index}-${term.symbolLatex}`">
                <span
                  v-if="index > 0"
                  class="pose-operator"
                >
                  <LatexInline :expr="'\\cdot'" />
                </span>
                <span class="pose-symbol">
                  <LatexInline :expr="term.symbolLatex" />
                </span>
              </template>
            </p>
            <p class="panel-title">Reduced Equivalent</p>
            <p class="pose-expression pose-expression--secondary">
              <template v-if="reducedEquivalentData.mode === 'text'">
                <LatexInline :expr="reducedEquivalentData.textLatex" />
              </template>
              <template v-else>
                <span class="pose-operator"><LatexInline :expr="'\\equiv'" /></span>
                <template v-for="(term, index) in reducedEquivalentData.operations" :key="`reduced-term-${index}-${term.symbolLatex}`">
                  <span
                    v-if="index > 0"
                    class="pose-operator"
                  >
                    <LatexInline :expr="'='" />
                  </span>
                  <span class="pose-symbol">
                    <LatexInline :expr="term.symbolLatex" />
                  </span>
                </template>
              </template>
            </p>
            <button type="button" class="reset-pose-button" @click="resetPose">Reset Pose</button>
          </div>
        </section>

        <section class="page-panel stack operations-panel">
          <p class="panel-title">Symmetry Operations</p>

          <div class="operation-list">
            <div class="operation-cluster" :class="`operation-cluster--${operationLayoutMode}`">
              <button
                v-for="operation in operationButtons"
                :key="operation.id"
                type="button"
                class="operation-button"
                :class="{
                  'operation-button--active': operation.id === selectedOperationId
                }"
                @click="enqueueOperation(operation)"
                @mouseenter="handleOperationMouseEnter(operation, $event)"
                @mouseleave="handleOperationMouseLeave"
              >
                <span class="operation-name"><LatexInline :expr="operation.symbolLatex ?? operation.label" /></span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="tooltipState.visible"
        ref="tooltipRef"
        class="operation-tooltip operation-tooltip--floating"
        :style="{ top: `${tooltipState.top}px`, left: `${tooltipState.left}px` }"
      >
        <template v-for="(segment, segmentIndex) in activeTooltipSegments" :key="`tooltip-${tooltipState.operationId}-${segmentIndex}`">
          <LatexInline v-if="segment.type === 'latex'" :expr="segment.value" />
          <br v-else-if="segment.type === 'break'" />
          <span v-else>{{ segment.value }}</span>
        </template>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.element-list {
  display: grid;
  gap: 0.56rem;
}

.module-grid {
  grid-template-columns: minmax(220px, 280px) minmax(220px, 300px) minmax(0, 1fr);
}

.elements-panel,
.operations-panel {
  align-content: start;
  grid-auto-rows: max-content;
}

.element-button {
  display: grid;
  gap: 0.2rem;
  text-align: left;
  border: 1px solid rgba(59, 130, 246, 0.36);
  background: rgba(255, 255, 255, 0.98);
  color: #1d4ed8;
  border-radius: 0.82rem;
  min-height: 2.66rem;
  padding: 0.58rem 0.76rem;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.element-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(37, 99, 235, 0.1);
}

.element-button--active {
  border-color: rgba(37, 99, 235, 0.82);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(219, 234, 254, 0.94));
}

.element-name {
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.2;
}

.element-name :deep(.katex) {
  font-size: 1.05em;
}

.element-note {
  font-size: 0.84rem;
  color: #475569;
  line-height: 1.45;
}

.chip :deep(.katex) {
  font-size: 1em;
  line-height: 1;
}

.molecule-meta .chip {
  font-size: 0.96rem;
  padding: 0.38rem 0.88rem;
}

.molecule-meta .chip :deep(.katex) {
  font-size: 1.12em;
}

.viewer-panel {
  display: grid;
  align-content: start;
  gap: 0.74rem;
  order: 3;
}

.operations-panel {
  order: 2;
}

.molecule-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
  padding: 0.3rem;
  border: 1px solid rgba(191, 219, 254, 0.95);
  border-radius: 0.86rem;
  background: rgba(239, 246, 255, 0.76);
}

.molecule-tab {
  border: 1px solid rgba(148, 163, 184, 0.46);
  background: rgba(255, 255, 255, 0.96);
  color: #1e40af;
  border-radius: 0.65rem;
  min-height: 2.2rem;
  font-size: 0.89rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.molecule-tab:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.12);
}

.molecule-tab--active {
  border-color: rgba(29, 78, 216, 0.82);
  background: linear-gradient(180deg, rgba(219, 234, 254, 0.96), rgba(191, 219, 254, 0.93));
}

.pose-track {
  display: grid;
  gap: 0.48rem;
  padding: 0.66rem 0.78rem;
  border: 1px solid rgba(203, 213, 225, 0.95);
  border-radius: 0.82rem;
  background: rgba(248, 250, 252, 0.92);
}

.pose-expression {
  margin: 0;
  min-height: 1.45rem;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #0f172a;
  word-break: break-word;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.18rem;
}

.pose-expression :deep(.katex) {
  font-size: 1.05em;
}

.pose-expression--secondary :deep(.katex) {
  font-size: 0.98em;
}

.pose-expression--secondary .pose-operator {
  color: #334155;
}

.pose-expression--secondary .pose-operator :deep(.katex) {
  color: #334155;
}

.pose-operator {
  color: #64748b;
  display: inline-flex;
  align-items: center;
}

.pose-symbol {
  display: inline-flex;
  align-items: center;
  font-weight: 700;
}

.reset-pose-button {
  border: 1px solid rgba(29, 78, 216, 0.42);
  background: rgba(255, 255, 255, 0.98);
  color: #1d4ed8;
  border-radius: 0.74rem;
  min-height: 2.3rem;
  padding: 0.42rem 0.78rem;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.reset-pose-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.12);
  border-color: rgba(29, 78, 216, 0.7);
}

.operation-list {
  display: grid;
  gap: 0;
}

.operation-cluster {
  display: grid;
  gap: 1px;
  border: 1px solid rgba(109, 40, 217, 0.28);
  border-radius: 0.82rem;
  overflow: hidden;
  background: rgba(109, 40, 217, 0.18);
}

.operation-cluster--two-by-five,
.operation-cluster--two-by-three,
.operation-cluster--two-column {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.operation-cluster--single {
  grid-template-columns: minmax(0, 1fr);
}

.operation-button {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.06rem;
  position: relative;
  text-align: center;
  border: none;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 0;
  min-height: 2.5rem;
  padding: 0.52rem 0.72rem;
  cursor: pointer;
  overflow: visible;
  color: #6d28d9;
  transition: background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.operation-cluster--two-by-five .operation-button:nth-child(1),
.operation-cluster--two-by-three .operation-button:nth-child(1),
.operation-cluster--two-column .operation-button:nth-child(1) {
  border-top-left-radius: 0.82rem;
}

.operation-cluster--two-by-five .operation-button:nth-child(2),
.operation-cluster--two-by-three .operation-button:nth-child(2),
.operation-cluster--two-column .operation-button:nth-child(2) {
  border-top-right-radius: 0.82rem;
}

.operation-cluster--two-by-five .operation-button:nth-last-child(2),
.operation-cluster--two-by-three .operation-button:nth-last-child(2),
.operation-cluster--two-column .operation-button:nth-last-child(2) {
  border-bottom-left-radius: 0.82rem;
}

.operation-cluster--two-by-five .operation-button:last-child,
.operation-cluster--two-by-three .operation-button:last-child,
.operation-cluster--two-column .operation-button:last-child {
  border-bottom-right-radius: 0.82rem;
}

.operation-cluster--single .operation-button:first-child {
  border-top-left-radius: 0.82rem;
  border-top-right-radius: 0.82rem;
}

.operation-cluster--single .operation-button:last-child {
  border-bottom-left-radius: 0.82rem;
  border-bottom-right-radius: 0.82rem;
}

.operation-button:hover {
  background: rgba(245, 241, 255, 0.96);
  box-shadow: inset 0 0 0 1px rgba(109, 40, 217, 0.35);
}

.operation-button--active {
  background: rgba(139, 92, 246, 0.1);
  box-shadow: inset 0 0 0 1px rgba(109, 40, 217, 0.72);
}

.operation-button--active:hover,
.operation-button--active:focus-visible {
  background: rgba(139, 92, 246, 0.1);
  box-shadow: inset 0 0 0 1px rgba(109, 40, 217, 0.72);
}

.operation-name {
  font-size: 0.95rem;
  font-weight: 800;
  width: 100%;
  text-align: center;
  color: #6d28d9;
}

.operation-name :deep(.katex) {
  font-size: 1.02em;
}

.operation-tooltip {
  z-index: 999999;
  width: max-content;
  max-width: 18rem;
  padding: 0.45rem 0.56rem;
  border-radius: 0.58rem;
  border: 1px solid rgba(148, 163, 184, 0.72);
  background: rgba(15, 23, 42, 0.95);
  color: #f8fafc;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: normal;
  transform: translateY(0);
  pointer-events: none;
}

.operation-tooltip--floating {
  position: fixed;
  opacity: 1;
  visibility: visible;
}

.operation-tooltip :deep(.katex) {
  font-size: 1em;
  color: #f8fafc;
}

.pose-symbol {
  color: #6d28d9;
}

.molecule-meta {
  display: grid;
  gap: 0.35rem;
}

@media (max-width: 1320px) {
  .module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .module-grid > :last-child {
    grid-column: auto;
  }

  .viewer-panel {
    grid-column: 1 / -1;
    order: 3;
  }

  .operations-panel {
    order: 2;
  }
}
</style>
