import { buildMoleculeDataset } from "@/data/moleculeDataset";

const datasetCache = new Map();

function normalizeDatasetOptions(options = {}) {
  return {
    includeLog: options.includeLog !== false,
    includeGjf: Boolean(options.includeGjf)
  };
}

function toCacheKey(options) {
  const normalized = normalizeDatasetOptions(options);
  return `log:${normalized.includeLog ? 1 : 0}|gjf:${normalized.includeGjf ? 1 : 0}`;
}

export function getMoleculeDataset(options = {}) {
  const normalized = normalizeDatasetOptions(options);
  const cacheKey = toCacheKey(normalized);
  if (!datasetCache.has(cacheKey)) {
    datasetCache.set(cacheKey, buildMoleculeDataset(normalized));
  }
  return datasetCache.get(cacheKey);
}

export function clearMoleculeDatasetCache() {
  datasetCache.clear();
}
