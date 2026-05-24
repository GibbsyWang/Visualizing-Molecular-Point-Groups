import { C_INF_V, D_INF_H, canonicalizePointGroup } from "@/utils/pointGroupDetails";

export function normalizePointGroup(rawPointGroup) {
  return canonicalizePointGroup(rawPointGroup);
}

/**
 * @param {string} pointGroup
 * @returns {import("@/types/contracts").PointGroupFamily | null}
 */
export function toPointGroupFamily(pointGroup) {
  const group = normalizePointGroup(pointGroup);

  if (group === "C1") {
    return "C1";
  }
  if (group === "Ci") {
    return "Ci";
  }
  if (group === "Cs") {
    return "Cs";
  }
  if (group === C_INF_V) {
    return C_INF_V;
  }
  if (group === D_INF_H) {
    return D_INF_H;
  }
  if (group === "Td") {
    return "Td";
  }
  if (group === "Oh") {
    return "Oh";
  }
  if (group === "Ih") {
    return "Ih";
  }
  if (/^C\d+v$/i.test(group)) {
    return "Cnv";
  }
  if (/^C\d+h$/i.test(group)) {
    return "Cnh";
  }
  if (/^C\d+$/i.test(group)) {
    return "Cn";
  }
  if (/^D\d+d$/i.test(group)) {
    return "Dnd";
  }
  if (/^D\d+h$/i.test(group)) {
    return "Dnh";
  }
  if (/^D\d+$/i.test(group)) {
    return "Dn";
  }

  return null;
}

export function extractAllPointGroups(text) {
  const matches = [...String(text ?? "").matchAll(/Full point group\s+([A-Za-z0-9*]+)/gi)];
  const normalized = matches
    .map((match) => normalizePointGroup(match[1]))
    .filter(Boolean);

  return [...new Set(normalized)];
}
