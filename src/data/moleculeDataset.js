import { buildMoleculeViewerDataFromGaussian, parseFormulaFromGaussian } from "@/utils/moleculeStructure";
import { extractAllPointGroups, normalizePointGroup, toPointGroupFamily } from "@/utils/pointGroup";
import { C_INF_V, D_INF_H } from "@/utils/pointGroupDetails";

const REPRESENTATIVE_GROUP_TO_FILE = {
  [C_INF_V]: "CO.LOG",
  [D_INF_H]: "N2.LOG",
  C1: "CHFCLBR-C1.LOG",
  Ci: "CHFCLCHFCL.LOG",
  Cs: "COHF.LOG",
  C2: "H2O2.LOG",
  C2h: "CHF=CHF-C2H.LOG",
  C2v: "H2O.LOG",
  C3: "CH3CCL3-C3.LOG",
  C3h: "C6H3OH3.LOG",
  C3v: "NH3.LOG",
  D2d: "C3H4.LOG",
  D2h: "C2H4-D2H.LOG",
  D3: "TWISTEDCH3CH3.LOG",
  D3d: "CH3CH3-D3D.LOG",
  D3h: "OVERLAPPED-CH3CH3.LOG",
  D4h: "C4H8.LOG",
  D6h: "C6H6.LOG",
  Ih: "C60.LOG",
  Oh: "SF6.LOG",
  Td: "CH4.LOG"
};

const POINT_GROUP_OVERRIDE_BY_LOG_FILE = {
  "C60.LOG": "Ih",
  "C4H8.LOG": "D4h"
};

const logModulesUpper = import.meta.glob("../../calculations/LOG/*.LOG", {
  query: "?raw",
  import: "default",
  eager: true
});
const logModulesLower = import.meta.glob("../../calculations/LOG/*.log", {
  query: "?raw",
  import: "default",
  eager: true
});
const gjfModulesUpper = import.meta.glob("../../calculations/GJF/*.GJF", {
  query: "?raw",
  import: "default",
  eager: true
});
const gjfModulesLower = import.meta.glob("../../calculations/GJF/*.gjf", {
  query: "?raw",
  import: "default",
  eager: true
});

const allModules = {
  ...logModulesUpper,
  ...logModulesLower,
  ...gjfModulesUpper,
  ...gjfModulesLower
};

function toFileName(modulePath) {
  const normalized = String(modulePath).replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function inferPointGroupFromFileName(fileName) {
  const baseName = String(fileName ?? "").replace(/\.[^.]+$/, "");
  const compact = baseName.replace(/[^A-Za-z0-9*]/g, "").toUpperCase();
  if (!compact) {
    return "";
  }

  const prefixMatch = compact.match(
    /^(CINFV|DINFH|C1|CI|CS|TD|OH|IH|C\d+(?:V|H)?|D\d+(?:D|H)?)/
  );
  const prefix = prefixMatch?.[1] ?? "";
  if (prefix) {
    return normalizePointGroup(prefix);
  }

  return "";
}

function parseMoleculeRecord(modulePath, text) {
  const fileName = toFileName(modulePath);
  const isGjf = /\.gjf$/i.test(fileName);
  const isLog = /\.log$/i.test(fileName);
  const { atoms, bonds } = buildMoleculeViewerDataFromGaussian(text);
  const parsedPointGroups = extractAllPointGroups(text);
  const forcedPointGroup = isLog ? POINT_GROUP_OVERRIDE_BY_LOG_FILE[fileName.toUpperCase()] ?? null : null;
  const inferredPointGroup = inferPointGroupFromFileName(fileName);
  const pointGroups = isGjf
    ? inferredPointGroup
      ? [inferredPointGroup]
      : []
    : forcedPointGroup
      ? [forcedPointGroup]
      : parsedPointGroups.length
      ? parsedPointGroups
      : inferredPointGroup
        ? [inferredPointGroup]
        : [];
  const pointGroup = pointGroups.at(-1) ?? "";
  const family = toPointGroupFamily(pointGroup);

  return {
    id: fileName.replace(/\.[^.]+$/, ""),
    fileName,
    formula: parseFormulaFromGaussian(text, fileName),
    pointGroup,
    family,
    atoms,
    bonds,
    pointGroups,
    sourceText: text
  };
}

function sortConcreteGroupName(a, b) {
  const specialOrder = [C_INF_V, D_INF_H, "Td", "Oh", "Ih", "C1", "Ci", "Cs"];
  const specialA = specialOrder.indexOf(a);
  const specialB = specialOrder.indexOf(b);
  if (specialA >= 0 || specialB >= 0) {
    return (specialA === -1 ? Number.MAX_SAFE_INTEGER : specialA) - (specialB === -1 ? Number.MAX_SAFE_INTEGER : specialB);
  }

  const parse = (value) => {
    const match = value.match(/^([CD])(\d+)([a-z]?)$/i);
    if (!match) {
      return { prefix: value, number: Number.MAX_SAFE_INTEGER, suffix: "" };
    }
    return {
      prefix: match[1].toUpperCase(),
      number: Number(match[2]),
      suffix: match[3].toLowerCase()
    };
  };

  const pa = parse(a);
  const pb = parse(b);
  if (pa.prefix !== pb.prefix) {
    return pa.prefix.localeCompare(pb.prefix);
  }
  if (pa.number !== pb.number) {
    return pa.number - pb.number;
  }
  return pa.suffix.localeCompare(pb.suffix);
}

function buildGroupIndexes(records) {
  const candidatesByGroup = new Map();

  records.forEach((record) => {
    record.pointGroups.forEach((groupName) => {
      const concrete = normalizePointGroup(groupName);
      if (!concrete) {
        return;
      }

      const next = candidatesByGroup.get(concrete) ?? [];
      next.push(record);
      candidatesByGroup.set(concrete, next);
    });
  });

  const representativeByConcreteGroup = new Map();
  const groupsByFamilyBuckets = new Map();

  [...candidatesByGroup.keys()]
    .sort(sortConcreteGroupName)
    .forEach((concreteGroup) => {
      const candidates = candidatesByGroup.get(concreteGroup) ?? [];
      const preferredFile = REPRESENTATIVE_GROUP_TO_FILE[concreteGroup];
      const representative =
        candidates.find((item) => item.fileName.toUpperCase() === String(preferredFile ?? "").toUpperCase()) ??
        [...candidates].sort((a, b) => a.fileName.localeCompare(b.fileName))[0] ??
        null;

      if (!representative) {
        return;
      }

      representativeByConcreteGroup.set(concreteGroup, representative);

      const family = toPointGroupFamily(concreteGroup);
      if (!family) {
        return;
      }

      const bucket = groupsByFamilyBuckets.get(family) ?? new Set();
      bucket.add(concreteGroup);
      groupsByFamilyBuckets.set(family, bucket);
    });

  const groupsByFamily = new Map(
    [...groupsByFamilyBuckets.entries()].map(([family, bucket]) => [
      family,
      [...bucket].sort(sortConcreteGroupName)
    ])
  );

  return {
    representativeByConcreteGroup,
    groupsByFamily
  };
}

function getSelectedModules(options = {}) {
  const includeLog = options.includeLog !== false;
  const includeGjf = Boolean(options.includeGjf);

  return Object.entries(allModules).filter(([modulePath]) => {
    const ext = String(modulePath ?? "").toLowerCase();
    if (ext.endsWith(".log")) {
      return includeLog;
    }
    if (ext.endsWith(".gjf")) {
      return includeGjf;
    }
    return false;
  });
}

export function buildMoleculeDataset(options = {}) {
  const records = getSelectedModules(options)
    .map(([modulePath, text]) => parseMoleculeRecord(modulePath, text))
    .filter((record) => record.atoms.length > 0 && record.pointGroups.length > 0)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));

  const { representativeByConcreteGroup, groupsByFamily } = buildGroupIndexes(records);

  return {
    records,
    representativeByConcreteGroup,
    groupsByFamily
  };
}
