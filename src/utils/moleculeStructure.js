const ATOMIC_SYMBOLS = {
  1: "H",
  6: "C",
  7: "N",
  8: "O",
  9: "F",
  14: "Si",
  15: "P",
  16: "S",
  17: "Cl",
  35: "Br",
  53: "I"
};

const ATOMIC_NUMBERS_BY_SYMBOL = Object.fromEntries(
  Object.entries(ATOMIC_SYMBOLS).map(([atomicNumber, symbol]) => [symbol, Number(atomicNumber)])
);

const COVALENT_RADII = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  Si: 1.11,
  P: 1.07,
  S: 1.05,
  Cl: 1.02,
  Br: 1.2,
  I: 1.39
};

const DEFAULT_ATOM_COLORS = {
  H: "#ffffff",
  C: "#909090",
  N: "#3050f8",
  O: "#ff0d0d",
  F: "#90e050",
  Si: "#f0c8a0",
  P: "#ff8000",
  S: "#ffff30",
  Cl: "#1ff01f",
  Br: "#a62929",
  I: "#940094"
};

const ELECTRONEGATIVITY = {
  H: 2.2,
  B: 2.04,
  C: 2.55,
  N: 3.04,
  O: 3.44,
  F: 3.98,
  P: 2.19,
  S: 2.58,
  Cl: 3.16,
  Br: 2.96,
  I: 2.66,
  Si: 1.9
};

const HYDROGEN_PREFIX_ELEMENTS = new Set(["O", "S", "Se", "Te", "F", "Cl", "Br", "I"]);

function parseFormulaCounts(formulaText) {
  const counts = new Map();
  const regex = /([A-Z][a-z]?)(\d*)/g;
  let match = regex.exec(String(formulaText ?? ""));
  while (match) {
    const symbol = match[1];
    const count = Number(match[2] || "1");
    counts.set(symbol, (counts.get(symbol) ?? 0) + count);
    match = regex.exec(String(formulaText ?? ""));
  }
  return counts;
}

function formatCountsToFormula(counts, order) {
  return order
    .filter((symbol) => (counts.get(symbol) ?? 0) > 0)
    .map((symbol) => {
      const count = counts.get(symbol) ?? 0;
      return count > 1 ? `${symbol}${count}` : symbol;
    })
    .join("");
}

function sortNonCarbonElements(symbols) {
  return [...symbols].sort((a, b) => {
    const ea = ELECTRONEGATIVITY[a];
    const eb = ELECTRONEGATIVITY[b];
    if (Number.isFinite(ea) && Number.isFinite(eb) && Math.abs(ea - eb) > 1e-6) {
      return ea - eb;
    }
    return a.localeCompare(b);
  });
}

function normalizeFormulaOrder(formulaText) {
  const counts = parseFormulaCounts(formulaText);
  if (!counts.size) {
    return "";
  }

  const symbols = [...counts.keys()];

  if (counts.has("C")) {
    const tail = symbols.filter((symbol) => symbol !== "C" && symbol !== "H").sort((a, b) => a.localeCompare(b));
    const order = ["C", ...(counts.has("H") ? ["H"] : []), ...tail];
    return formatCountsToFormula(counts, order);
  }

  if (counts.size === 2 && counts.has("H")) {
    const other = symbols.find((symbol) => symbol !== "H");
    if (other) {
      const order = HYDROGEN_PREFIX_ELEMENTS.has(other) ? ["H", other] : [other, "H"];
      return formatCountsToFormula(counts, order);
    }
  }

  const order = sortNonCarbonElements(symbols);
  return formatCountsToFormula(counts, order);
}

export function parseFormulaFromGaussian(text, fallbackName = "") {
  const stoichiometryMatch = String(text ?? "").match(/Stoichiometry\s+([A-Za-z0-9()]+)/i);
  if (stoichiometryMatch?.[1]) {
    const normalized = normalizeFormulaOrder(stoichiometryMatch[1]);
    if (normalized) {
      return normalized;
    }
  }

  const { atoms } = parseGeometryFromText(text);
  if (atoms.length) {
    const counts = new Map();
    atoms.forEach((atom) => {
      counts.set(atom.element, (counts.get(atom.element) ?? 0) + 1);
    });
    const roughFormula = [...counts.entries()]
      .map(([symbol, count]) => (count > 1 ? `${symbol}${count}` : symbol))
      .join("");
    const normalizedFromGeometry = normalizeFormulaOrder(roughFormula);
    if (normalizedFromGeometry) {
      return normalizedFromGeometry;
    }
  }

  const filePrefixMatch = String(fallbackName ?? "").match(/^([A-Za-z][A-Za-z0-9]*)/);
  const fallback = filePrefixMatch?.[1] ?? "--";
  const normalizedFallback = normalizeFormulaOrder(fallback);
  return normalizedFallback || fallback;
}

function parseLastOrientation(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/Standard orientation:|Input orientation:/i.test(lines[index])) {
      continue;
    }

    let dashCount = 0;
    let dataStart = -1;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^\s*-{5,}\s*$/.test(lines[cursor])) {
        dashCount += 1;

        if (dashCount === 2) {
          dataStart = cursor + 1;
          break;
        }
      }
    }

    if (dataStart === -1) {
      continue;
    }

    const block = [];

    for (let cursor = dataStart; cursor < lines.length; cursor += 1) {
      if (/^\s*-{5,}\s*$/.test(lines[cursor])) {
        break;
      }

      const match = lines[cursor].match(
        /^\s*(\d+)\s+(\d+)\s+\d+\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/
      );

      if (!match) {
        continue;
      }

      const atomicNumber = Number(match[2]);
      const element = ATOMIC_SYMBOLS[atomicNumber] ?? `E${atomicNumber}`;

      block.push({
        centerNumber: Number(match[1]),
        atomicNumber,
        element,
        x: Number(match[3]),
        y: Number(match[4]),
        z: Number(match[5])
      });
    }

    if (block.length) {
      blocks.push(block);
    }
  }

  return blocks.at(-1) ?? [];
}

function toNumericValue(text) {
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function normalizeInputElement(rawElement) {
  const token = String(rawElement ?? "").trim();
  if (!token) {
    return { element: "", atomicNumber: 0 };
  }

  if (/^\d+$/.test(token)) {
    const atomicNumber = Number(token);
    return {
      element: ATOMIC_SYMBOLS[atomicNumber] ?? `E${atomicNumber}`,
      atomicNumber
    };
  }

  const symbol = token[0].toUpperCase() + token.slice(1).toLowerCase();
  return {
    element: symbol,
    atomicNumber: ATOMIC_NUMBERS_BY_SYMBOL[symbol] ?? 0
  };
}

function parseGaussianInputGeometryAndConnectivity(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  let chargeMultiplicityIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*-?\d+\s+-?\d+\s*$/.test(lines[index])) {
      chargeMultiplicityIndex = index;
      break;
    }
  }

  if (chargeMultiplicityIndex === -1) {
    return { atoms: [], connectivityBonds: [] };
  }

  const atoms = [];
  let cursor = chargeMultiplicityIndex + 1;
  while (cursor < lines.length && !String(lines[cursor] ?? "").trim()) {
    cursor += 1;
  }

  const coordinateLinePattern =
    /^\s*([A-Za-z]{1,2}|\d+)\s+(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)(?:\s+.*)?$/;

  while (cursor < lines.length) {
    const rawLine = String(lines[cursor] ?? "");
    const trimmed = rawLine.trim();
    if (!trimmed) {
      cursor += 1;
      break;
    }

    const match = rawLine.match(coordinateLinePattern);
    if (!match) {
      break;
    }

    const x = toNumericValue(match[2]);
    const y = toNumericValue(match[3]);
    const z = toNumericValue(match[4]);
    if (x === null || y === null || z === null) {
      break;
    }

    const normalized = normalizeInputElement(match[1]);
    if (!normalized.element) {
      break;
    }

    atoms.push({
      centerNumber: atoms.length + 1,
      atomicNumber: normalized.atomicNumber,
      element: normalized.element,
      x,
      y,
      z
    });

    cursor += 1;
  }

  const connectivityMap = new Map();
  while (cursor < lines.length) {
    const line = String(lines[cursor] ?? "").trim();
    cursor += 1;
    if (!line) {
      break;
    }
    if (!/^\d+\b/.test(line)) {
      continue;
    }

    const tokens = line.split(/\s+/);
    const atomA = Number(tokens[0]);
    if (!Number.isInteger(atomA) || atomA <= 0) {
      continue;
    }

    for (let index = 1; index + 1 < tokens.length; index += 2) {
      const atomB = Number(tokens[index]);
      const orderValue = Number(tokens[index + 1]);
      if (!Number.isInteger(atomB) || atomB <= 0 || !Number.isFinite(orderValue)) {
        continue;
      }

      const first = Math.min(atomA, atomB);
      const second = Math.max(atomA, atomB);
      const key = `${first}-${second}`;
      const prior = connectivityMap.get(key);
      if (!prior || orderValue > prior.orderValue) {
        connectivityMap.set(key, { a: first, b: second, orderValue });
      }
    }
  }

  return {
    atoms,
    connectivityBonds: [...connectivityMap.values()]
  };
}

function parseGeometryFromText(text) {
  const orientationAtoms = parseLastOrientation(text);
  if (orientationAtoms.length) {
    return {
      atoms: orientationAtoms,
      connectivityBonds: []
    };
  }

  return parseGaussianInputGeometryAndConnectivity(text);
}

function distanceBetween(atomA, atomB) {
  const dx = atomA.x - atomB.x;
  const dy = atomA.y - atomB.y;
  const dz = atomA.z - atomB.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function inferBondOrder(atomA, atomB, distance) {
  const pair = [atomA.element, atomB.element].sort().join("-");

  if (pair === "N-N" && distance < 1.18) {
    return 3;
  }

  if (pair === "C-N" && distance < 1.22) {
    return 3;
  }

  if (pair === "C-O" && distance < 1.18) {
    return 3;
  }

  if (pair === "C-C" && distance < 1.42) {
    return 2;
  }

  if (pair === "C-N" && distance < 1.34) {
    return 2;
  }

  if (pair === "C-O" && distance < 1.3) {
    return 2;
  }

  return 1;
}

function normalizeCycle(cycle) {
  const rotations = [];
  const reversed = [...cycle].reverse();

  for (let index = 0; index < cycle.length; index += 1) {
    rotations.push(cycle.slice(index).concat(cycle.slice(0, index)));
    rotations.push(reversed.slice(index).concat(reversed.slice(0, index)));
  }

  return rotations
    .map((item) => item.join("-"))
    .sort()[0];
}

function findAromaticCycles(atoms, bonds) {
  const atomMap = new Map(atoms.map((atom) => [atom.centerNumber, atom]));
  const carbonBonds = bonds.filter((bond) => {
    const atomA = atomMap.get(bond.a);
    const atomB = atomMap.get(bond.b);
    return atomA?.element === "C" && atomB?.element === "C" && bond.distance >= 1.34 && bond.distance <= 1.47;
  });

  const adjacency = new Map();
  carbonBonds.forEach((bond) => {
    adjacency.set(bond.a, [...(adjacency.get(bond.a) ?? []), bond.b]);
    adjacency.set(bond.b, [...(adjacency.get(bond.b) ?? []), bond.a]);
  });

  const cycles = new Set();

  function dfs(start, current, path) {
    const neighbors = adjacency.get(current) ?? [];

    for (const neighbor of neighbors) {
      if (neighbor === start && path.length === 6) {
        cycles.add(normalizeCycle(path));
        continue;
      }

      if (path.length >= 6 || path.includes(neighbor) || neighbor < start) {
        continue;
      }

      dfs(start, neighbor, [...path, neighbor]);
    }
  }

  [...adjacency.keys()].forEach((start) => {
    dfs(start, start, [start]);
  });

  return [...cycles].map((cycle) => cycle.split("-").map(Number));
}

function markAromaticBonds(atoms, bonds) {
  const aromaticCycles = findAromaticCycles(atoms, bonds);
  const atomMap = new Map(atoms.map((atom) => [atom.centerNumber, atom]));
  const aromaticEdges = new Map();

  aromaticCycles.forEach((cycle) => {
    const cycleAtoms = cycle.map((atomId) => atomMap.get(atomId)).filter(Boolean);
    const aromaticCenter = cycleAtoms.length
      ? {
          x: cycleAtoms.reduce((sum, atom) => sum + atom.x, 0) / cycleAtoms.length,
          y: cycleAtoms.reduce((sum, atom) => sum + atom.y, 0) / cycleAtoms.length,
          z: cycleAtoms.reduce((sum, atom) => sum + atom.z, 0) / cycleAtoms.length
        }
      : null;

    for (let index = 0; index < cycle.length; index += 1) {
      const a = cycle[index];
      const b = cycle[(index + 1) % cycle.length];
      aromaticEdges.set([Math.min(a, b), Math.max(a, b)].join("-"), aromaticCenter);
    }
  });

  return bonds.map((bond) => {
    const edgeKey = [Math.min(bond.a, bond.b), Math.max(bond.a, bond.b)].join("-");
    return {
      ...bond,
      aromatic: aromaticEdges.has(edgeKey),
      aromaticCenter: aromaticEdges.get(edgeKey) ?? null
    };
  });
}

function inferBonds(atoms) {
  const bonds = [];

  for (let first = 0; first < atoms.length; first += 1) {
    for (let second = first + 1; second < atoms.length; second += 1) {
      const atomA = atoms[first];
      const atomB = atoms[second];

      if (atomA.element === "H" && atomB.element === "H") {
        continue;
      }

      const radiusA = COVALENT_RADII[atomA.element] ?? 0.77;
      const radiusB = COVALENT_RADII[atomB.element] ?? 0.77;
      const threshold = (radiusA + radiusB) * 1.25;
      const distance = distanceBetween(atomA, atomB);

      if (distance > 0.4 && distance <= threshold) {
        bonds.push({
          a: atomA.centerNumber,
          b: atomB.centerNumber,
          distance,
          order: inferBondOrder(atomA, atomB, distance)
        });
      }
    }
  }

  return markAromaticBonds(atoms, bonds);
}

export function buildMoleculeViewerDataFromGaussian(text, options = {}) {
  const elementColors = options.elementColors ?? DEFAULT_ATOM_COLORS;
  const { atoms: geometryAtoms, connectivityBonds } = parseGeometryFromText(text);

  if (!geometryAtoms.length) {
    return {
      atoms: [],
      bonds: []
    };
  }

  const atoms = geometryAtoms.map((atom) => ({
    ...atom,
    id: `${atom.element}${atom.centerNumber}`,
    active: false,
    isSelectedElement: false,
    isPrimaryElement: atom.element === "C" || atom.element === "H",
    opacity: 1,
    displayColor: elementColors[atom.element] ?? "#94a3b8"
  }));

  const geometryAtomByCenter = new Map(geometryAtoms.map((atom) => [atom.centerNumber, atom]));
  const atomByCenterNumber = new Map(atoms.map((atom) => [atom.centerNumber, atom]));
  const parsedConnectivityBonds = connectivityBonds
    .map((bond) => {
      const atomA = geometryAtomByCenter.get(bond.a);
      const atomB = geometryAtomByCenter.get(bond.b);
      if (!atomA || !atomB) {
        return null;
      }

      let order = 1;
      if (bond.orderValue >= 2.6) {
        order = 3;
      } else if (bond.orderValue >= 1.6) {
        order = 2;
      }

      return {
        a: bond.a,
        b: bond.b,
        distance: distanceBetween(atomA, atomB),
        order
      };
    })
    .filter(Boolean);

  const rawBonds = parsedConnectivityBonds.length
    ? markAromaticBonds(geometryAtoms, parsedConnectivityBonds)
    : inferBonds(geometryAtoms);

  const bonds = rawBonds
    .map((bond) => ({
      ...bond,
      atomA: atomByCenterNumber.get(bond.a),
      atomB: atomByCenterNumber.get(bond.b)
    }))
    .filter((bond) => bond.atomA && bond.atomB);

  return {
    atoms,
    bonds
  };
}
