/**
 * @typedef {"C1"|"Ci"|"Cs"|"Cn"|"Cnv"|"Cnh"|"Dn"|"Dnd"|"Dnh"|"C∞v"|"D∞h"|"Td"|"Oh"|"Ih"} PointGroupFamily
 */

/**
 * @typedef {object} MoleculeRecord
 * @property {string} id
 * @property {string} fileName
 * @property {string} formula
 * @property {string} pointGroup
 * @property {PointGroupFamily|null} family
 * @property {Array<object>} atoms
 * @property {Array<object>} bonds
 * @property {Array<string>} pointGroups
 */

/**
 * @typedef {object} FlowNode
 * @property {string} id
 * @property {"start"|"decision"|"terminal"|"special"} kind
 * @property {string} label
 * @property {string=} yesTo
 * @property {string=} noTo
 * @property {PointGroupFamily=} family
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} SymmetryLayer
 * @property {string} id
 * @property {string} label
 * @property {"core"|"extended"} group
 * @property {boolean} visibleByDefault
 * @property {string} description
 * @property {(sceneCtx: object) => import("three").Object3D[]} buildObjects
 */

export {};
