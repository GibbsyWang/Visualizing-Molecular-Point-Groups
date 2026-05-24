export const C_INF_V = `C\u221ev`;
export const D_INF_H = `D\u221eh`;

const SPECIAL_ALIAS = {
  "C*V": C_INF_V,
  CINFV: C_INF_V,
  "C\u221eV": C_INF_V,
  "C\u221EV": C_INF_V,
  "D*H": D_INF_H,
  DINFH: D_INF_H,
  "D\u221eH": D_INF_H,
  "D\u221EH": D_INF_H,
  CI: "Ci",
  CS: "Cs",
  TD: "Td",
  OH: "Oh",
  IH: "Ih"
};

function indexed(base, count) {
  return Array.from({ length: count }, (_, index) => `${base}(${index + 1})`);
}

function powers(base, order) {
  return Array.from({ length: order - 1 }, (_, index) => `${base}^{${index + 1}}`);
}

const CHARACTERISTIC_BY_GROUP = {
  C1: ["E"],
  Ci: ["i"],
  Cs: ["\\sigma"],
  C2: ["C_2"],
  C2h: ["C_2", "\\sigma_h"],
  C2v: ["C_2", "2\\sigma_v"],
  C3: ["C_3"],
  C3h: ["C_3", "\\sigma_h"],
  C3v: ["C_3", "3\\sigma_v"],
  D2d: ["C_2", "2C_2", "2\\sigma_d"],
  D2h: ["C_2", "2C_2", "\\sigma_h"],
  D3: ["C_3", "3C_2"],
  D3d: ["C_3", "3C_2", "3\\sigma_d"],
  D3h: ["C_3", "3C_2", "\\sigma_h"],
  D4h: ["C_4", "4C_2", "\\sigma_h"],
  D6h: ["C_6", "6\\sigma_v", "6C_2", "\\sigma_h", "i"],
  Td: ["4C_3"],
  Oh: ["3C_4"],
  Ih: ["6C_5"],
  [C_INF_V]: ["C_{\\infty}"],
  [D_INF_H]: ["C_{\\infty}", "\\sigma_h"]
};

const OPERATIONS_BY_GROUP = {
  C1: {
    operationsListLatex: ["\\hat{E}"],
    orderLatex: "1"
  },
  Ci: {
    operationsListLatex: ["\\hat{E}", "\\hat{i}"],
    orderLatex: "2"
  },
  Cs: {
    operationsListLatex: ["\\hat{E}", "\\hat{\\sigma}_h"],
    orderLatex: "2"
  },
  C2: {
    operationsListLatex: ["\\hat{E}", "\\hat{C}_2"],
    orderLatex: "2"
  },
  C2h: {
    operationsListLatex: ["\\hat{E}", "\\hat{C}_2", "\\hat{i}", "\\hat{\\sigma}_h"],
    orderLatex: "4"
  },
  C2v: {
    operationsListLatex: ["\\hat{E}", "\\hat{C}_2", "\\hat{\\sigma}_v(1)", "\\hat{\\sigma}_v(2)"],
    orderLatex: "4"
  },
  C3: {
    operationsListLatex: ["\\hat{E}", "\\hat{C}_3", "\\hat{C}_3^2"],
    orderLatex: "3"
  },
  C3h: {
    operationsListLatex: ["\\hat{E}", "\\hat{C}_3", "\\hat{C}_3^2", "\\hat{\\sigma}_h", "\\hat{S}_3", "\\hat{S}_3^5"],
    orderLatex: "6"
  },
  C3v: {
    operationsListLatex: ["\\hat{E}", "\\hat{C}_3", "\\hat{C}_3^2", ...indexed("\\hat{\\sigma}_v", 3)],
    orderLatex: "6"
  },
  D2d: {
    operationsListLatex: [
      "\\hat{E}",
      "\\hat{C}_2",
      "\\hat{S}_4",
      "\\hat{S}_4^3",
      ...indexed("\\hat{C}_2", 2),
      ...indexed("\\hat{\\sigma}_d", 2)
    ],
    orderLatex: "8"
  },
  D2h: {
    operationsListLatex: [
      "\\hat{E}",
      ...indexed("\\hat{C}_2", 3),
      "\\hat{i}",
      ...indexed("\\hat{\\sigma}", 3)
    ],
    orderLatex: "8"
  },
  D3: {
    operationsListLatex: ["\\hat{E}", "\\hat{C}_3", "\\hat{C}_3^2", ...indexed("\\hat{C}_2", 3)],
    orderLatex: "6"
  },
  D3d: {
    operationsListLatex: [
      "\\hat{E}",
      "\\hat{C}_3",
      "\\hat{C}_3^2",
      ...indexed("\\hat{C}_2", 3),
      "\\hat{i}",
      "\\hat{S}_6",
      "\\hat{S}_6^5",
      ...indexed("\\hat{\\sigma}_d", 3)
    ],
    orderLatex: "12"
  },
  D3h: {
    operationsListLatex: [
      "\\hat{E}",
      "\\hat{C}_3",
      "\\hat{C}_3^2",
      ...indexed("\\hat{C}_2", 3),
      "\\hat{\\sigma}_h",
      "\\hat{S}_3",
      "\\hat{S}_3^5",
      ...indexed("\\hat{\\sigma}_v", 3)
    ],
    orderLatex: "12"
  },
  D4h: {
    operationsListLatex: [
      "\\hat{E}",
      "\\hat{C}_4",
      "\\hat{C}_4^2",
      "\\hat{C}_4^3",
      ...indexed("\\hat{C}_2", 4),
      "\\hat{i}",
      "\\hat{S}_4",
      "\\hat{S}_4^3",
      "\\hat{\\sigma}_h",
      ...indexed("\\hat{\\sigma}_v", 2),
      ...indexed("\\hat{\\sigma}_d", 2)
    ],
    orderLatex: "16"
  },
  D6h: {
    operationsListLatex: [
      "\\hat{E}",
      ...powers("\\hat{C}_6", 6),
      ...indexed("\\hat{C}_2", 6),
      "\\hat{i}",
      "\\hat{S}_3",
      "\\hat{S}_3^5",
      "\\hat{S}_6",
      "\\hat{S}_6^5",
      "\\hat{\\sigma}_h",
      ...indexed("\\hat{\\sigma}_v", 3),
      ...indexed("\\hat{\\sigma}_d", 3)
    ],
    orderLatex: "24"
  },
  Td: {
    operationsListLatex: [
      "\\hat{E}",
      ...indexed("\\hat{C}_3", 8),
      ...indexed("\\hat{C}_2", 3),
      ...indexed("\\hat{S}_4", 6),
      ...indexed("\\hat{\\sigma}_d", 6)
    ],
    orderLatex: "24"
  },
  Oh: {
    operationsListLatex: [
      "\\hat{E}",
      ...indexed("\\hat{C}_3", 8),
      ...indexed("\\hat{C}_4", 6),
      ...indexed("\\hat{C}_2", 9),
      "\\hat{i}",
      ...indexed("\\hat{S}_4", 6),
      ...indexed("\\hat{S}_6", 8),
      ...indexed("\\hat{\\sigma}_h", 3),
      ...indexed("\\hat{\\sigma}_d", 6)
    ],
    orderLatex: "48"
  },
  Ih: {
    operationsListLatex: [
      "\\hat{E}",
      ...indexed("\\hat{C}_5", 12),
      ...indexed("\\hat{C}_5^2", 12),
      ...indexed("\\hat{C}_3", 20),
      ...indexed("\\hat{C}_2", 15),
      "\\hat{i}",
      ...indexed("\\hat{S}_{10}", 12),
      ...indexed("\\hat{S}_6", 20),
      ...indexed("\\hat{\\sigma}", 15)
    ],
    orderLatex: "120"
  },
  [C_INF_V]: {
    operationsListLatex: [
      "\\hat{E}",
      "\\hat{C}_{\\infty}^{\\phi}",
      "\\hat{\\sigma}_v(\\phi),\\;\\phi\\in[0,2\\pi)"
    ],
    orderLatex: "\\infty"
  },
  [D_INF_H]: {
    operationsListLatex: [
      "\\hat{E}",
      "\\hat{C}_{\\infty}^{\\phi}",
      "\\hat{C}_{2\\perp}(\\phi)",
      "\\hat{\\sigma}_v(\\phi)",
      "\\hat{\\sigma}_h",
      "\\hat{i}",
      "\\hat{S}_{\\infty}^{\\phi}"
    ],
    orderLatex: "\\infty"
  }
};

export function canonicalizePointGroup(groupName) {
  const source = String(groupName ?? "").trim();
  if (!source) {
    return "";
  }

  const compact = source.replace(/\s+/g, "");
  const upper = compact.toUpperCase();

  if (SPECIAL_ALIAS[upper]) {
    return SPECIAL_ALIAS[upper];
  }

  let match = upper.match(/^C(\d+)V$/);
  if (match) {
    return `C${match[1]}v`;
  }
  match = upper.match(/^C(\d+)H$/);
  if (match) {
    return `C${match[1]}h`;
  }
  match = upper.match(/^D(\d+)D$/);
  if (match) {
    return `D${match[1]}d`;
  }
  match = upper.match(/^D(\d+)H$/);
  if (match) {
    return `D${match[1]}h`;
  }
  match = upper.match(/^([CD])(\d+)$/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }

  if (compact.length === 1) {
    return compact.toUpperCase();
  }
  return compact[0].toUpperCase() + compact.slice(1).toLowerCase();
}

export function parsePointGroupDescriptor(groupName) {
  const normalized = canonicalizePointGroup(groupName);
  if (!normalized) {
    return null;
  }

  if ([C_INF_V, D_INF_H, "C1", "Ci", "Cs", "Td", "Oh", "Ih"].includes(normalized)) {
    return { normalized, family: normalized, n: null, suffix: "" };
  }

  const match = normalized.match(/^([CD])(\d+)([a-z]?)$/i);
  if (!match) {
    return { normalized, family: normalized, n: null, suffix: "" };
  }

  return {
    normalized,
    family: match[1].toUpperCase(),
    n: Number(match[2]),
    suffix: match[3].toLowerCase()
  };
}

function familyFromParsed(parsed) {
  if (!parsed) {
    return "";
  }

  if (parsed.family === "C" && !parsed.suffix) {
    return "Cn";
  }
  if (parsed.family === "C" && parsed.suffix === "v") {
    return "Cnv";
  }
  if (parsed.family === "C" && parsed.suffix === "h") {
    return "Cnh";
  }
  if (parsed.family === "D" && !parsed.suffix) {
    return "Dn";
  }
  if (parsed.family === "D" && parsed.suffix === "d") {
    return "Dnd";
  }
  if (parsed.family === "D" && parsed.suffix === "h") {
    return "Dnh";
  }
  return parsed.family;
}

function fallbackCharacteristics(parsed, familyFallback = "") {
  const family = parsed ? familyFromParsed(parsed) : canonicalizePointGroup(familyFallback);
  const n = parsed?.n ?? null;

  if (family === "Cn" && n) {
    return [`C_{${n}}`];
  }
  if (family === "Cnv" && n) {
    return [`C_{${n}}`, `${n}\\sigma_v`];
  }
  if (family === "Cnh" && n) {
    return [`C_{${n}}`, "\\sigma_h"];
  }
  if (family === "Dn" && n) {
    return [`C_{${n}}`, `${n}C_{2\\perp}`];
  }
  if (family === "Dnd" && n) {
    return [`C_{${n}}`, `${n}C_{2\\perp}`, `${n}\\sigma_d`];
  }
  if (family === "Dnh" && n) {
    return [`C_{${n}}`, `${n}C_{2\\perp}`, "\\sigma_h"];
  }
  if (family === C_INF_V) {
    return ["C_{\\infty}"];
  }
  if (family === D_INF_H) {
    return ["C_{\\infty}", "\\sigma_h"];
  }
  return [];
}

function fallbackOperations(parsed) {
  if (!parsed?.n) {
    return { operationsListLatex: ["\\hat{E}"], orderLatex: "1" };
  }

  const family = familyFromParsed(parsed);
  const n = parsed.n;
  if (family === "Cn") {
    return { operationsListLatex: ["\\hat{E}", ...powers(`\\hat{C}_{${n}}`, n)], orderLatex: String(n) };
  }
  if (family === "Cnv") {
    return {
      operationsListLatex: ["\\hat{E}", ...powers(`\\hat{C}_{${n}}`, n), ...indexed("\\hat{\\sigma}_v", n)],
      orderLatex: String(2 * n)
    };
  }
  if (family === "Cnh") {
    return {
      operationsListLatex: [
        "\\hat{E}",
        ...powers(`\\hat{C}_{${n}}`, n),
        "\\hat{\\sigma}_h",
        ...indexed(`\\hat{S}_${n}`, n - 1)
      ],
      orderLatex: String(2 * n)
    };
  }
  if (family === "Dn") {
    return {
      operationsListLatex: ["\\hat{E}", ...powers(`\\hat{C}_{${n}}`, n), ...indexed("\\hat{C}_{2\\perp}", n)],
      orderLatex: String(2 * n)
    };
  }
  if (family === "Dnd") {
    return {
      operationsListLatex: [
        "\\hat{E}",
        ...powers(`\\hat{C}_{${n}}`, n),
        ...indexed("\\hat{C}_{2\\perp}", n),
        ...indexed(`\\hat{S}_{${2 * n}}`, n),
        ...indexed("\\hat{\\sigma}_d", n)
      ],
      orderLatex: String(4 * n)
    };
  }
  if (family === "Dnh") {
    return {
      operationsListLatex: [
        "\\hat{E}",
        ...powers(`\\hat{C}_{${n}}`, n),
        ...indexed("\\hat{C}_{2\\perp}", n),
        "\\hat{i}",
        "\\hat{\\sigma}_h",
        ...indexed("\\hat{\\sigma}_v", n)
      ],
      orderLatex: String(4 * n)
    };
  }

  return { operationsListLatex: ["\\hat{E}"], orderLatex: "1" };
}

export function toPointGroupLatex(groupName) {
  const normalized = canonicalizePointGroup(groupName);
  if (!normalized) {
    return "";
  }
  if (normalized === C_INF_V) {
    return "C_{\\infty v}";
  }
  if (normalized === D_INF_H) {
    return "D_{\\infty h}";
  }

  const literal = {
    C1: "C_1",
    Ci: "C_i",
    Cs: "C_s",
    Td: "T_d",
    Oh: "O_h",
    Ih: "I_h"
  };
  if (literal[normalized]) {
    return literal[normalized];
  }

  const match = normalized.match(/^([CD])(\d+)([a-z]?)$/i);
  if (!match) {
    return normalized;
  }

  const letter = match[1].toUpperCase();
  const n = match[2];
  const suffix = match[3] || "";
  if (!suffix) {
    return `${letter}_${n}`;
  }
  return `${letter}_{${n}${suffix}}`;
}

export function getCharacteristicElementsForGroup(groupName, familyFallback = "") {
  const parsed = parsePointGroupDescriptor(groupName);
  const normalized = parsed?.normalized ?? canonicalizePointGroup(groupName);
  if (normalized && CHARACTERISTIC_BY_GROUP[normalized]) {
    return CHARACTERISTIC_BY_GROUP[normalized];
  }
  return fallbackCharacteristics(parsed, familyFallback);
}

export function getPointGroupOperationsDetail(groupName) {
  const parsed = parsePointGroupDescriptor(groupName);
  const normalized = parsed?.normalized ?? canonicalizePointGroup(groupName);
  if (normalized && OPERATIONS_BY_GROUP[normalized]) {
    return OPERATIONS_BY_GROUP[normalized];
  }
  return fallbackOperations(parsed);
}
