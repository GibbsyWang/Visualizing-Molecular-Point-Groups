/**
 * @type {import("@/types/contracts").FlowNode[]}
 */
export const FLOW_NODES = [
  {
    id: "start-molecule",
    kind: "start",
    label: "Molecule",
    tex: "\\text{Molecule}",
    x: 360,
    y: -10
  },
  {
    id: "special-geometry",
    kind: "decision",
    label: "Special geometry",
    tex: "\\substack{\\text{Special}\\\\\\text{Geometry}}",
    x: 360,
    y: 90,
    yesTo: "special-groups",
    noTo: "has-cn"
  },
  { id: "special-groups", kind: "special", label: "Linear / Td / Oh / Ih", x: 680, y: 90 },

  { id: "has-cn", kind: "decision", label: "Cn", tex: "C_n", x: 360, y: 250, yesTo: "has-nc2", noTo: "has-sigma-no-cn" },
  { id: "has-sigma-no-cn", kind: "decision", label: "sigma", tex: "\\sigma", x: 530, y: 250, yesTo: "terminal-cs", noTo: "has-i" },
  { id: "has-i", kind: "decision", label: "i", tex: "i", x: 680, y: 250, yesTo: "terminal-ci", noTo: "terminal-c1" },
  { id: "terminal-cs", kind: "terminal", label: "Cs", family: "Cs", x: 530, y: 360, tex: "C_s" },
  { id: "terminal-ci", kind: "terminal", label: "Ci", family: "Ci", x: 680, y: 360, tex: "C_i" },
  { id: "terminal-c1", kind: "terminal", label: "C1", family: "C1", x: 820, y: 250, tex: "C_1" },

  { id: "has-nc2", kind: "decision", label: "nC2", tex: "\\perp nC_2", x: 360, y: 430, yesTo: "has-sigmah-dn", noTo: "has-sigmah-cn" },
  { id: "has-sigmah-cn", kind: "decision", label: "sigma_h", tex: "\\sigma_h", x: 530, y: 430, yesTo: "terminal-cnh", noTo: "has-sigmav" },
  { id: "has-sigmav", kind: "decision", label: "sigma_v", tex: "\\sigma_v", x: 680, y: 430, yesTo: "terminal-cnv", noTo: "terminal-cn" },
  { id: "terminal-cnh", kind: "terminal", label: "Cnh", family: "Cnh", x: 530, y: 540, tex: "C_{nh}" },
  { id: "terminal-cnv", kind: "terminal", label: "Cnv", family: "Cnv", x: 680, y: 540, tex: "C_{nv}" },
  { id: "terminal-cn", kind: "terminal", label: "Cn", family: "Cn", x: 820, y: 430, tex: "C_n" },

  { id: "has-sigmah-dn", kind: "decision", label: "sigma_h", tex: "\\sigma_h", x: 360, y: 620, yesTo: "terminal-dnh", noTo: "has-sigmad" },
  { id: "has-sigmad", kind: "decision", label: "sigma_d", tex: "\\sigma_d", x: 530, y: 620, yesTo: "terminal-dnd", noTo: "terminal-dn" },
  { id: "terminal-dnh", kind: "terminal", label: "Dnh", family: "Dnh", x: 360, y: 730, tex: "D_{nh}" },
  { id: "terminal-dnd", kind: "terminal", label: "Dnd", family: "Dnd", x: 530, y: 730, tex: "D_{nd}" },
  { id: "terminal-dn", kind: "terminal", label: "Dn", family: "Dn", x: 680, y: 620, tex: "D_n" }
];

export const FLOW_SPECIAL_FAMILIES = ["C\u221ev", "D\u221eh", "Td", "Oh", "Ih"];

export const FLOW_EDGES = [
  { from: "start-molecule", to: "special-geometry" },
  { from: "special-geometry", to: "special-groups", label: "Yes" },
  { from: "special-geometry", to: "has-cn", label: "No" },

  { from: "has-cn", to: "has-nc2", label: "Yes" },
  { from: "has-cn", to: "has-sigma-no-cn", label: "No" },
  { from: "has-sigma-no-cn", to: "terminal-cs", label: "Yes" },
  { from: "has-sigma-no-cn", to: "has-i", label: "No" },
  { from: "has-i", to: "terminal-ci", label: "Yes" },
  { from: "has-i", to: "terminal-c1", label: "No" },

  { from: "has-nc2", to: "has-sigmah-dn", label: "Yes" },
  { from: "has-nc2", to: "has-sigmah-cn", label: "No" },
  { from: "has-sigmah-cn", to: "terminal-cnh", label: "Yes" },
  { from: "has-sigmah-cn", to: "has-sigmav", label: "No" },
  { from: "has-sigmav", to: "terminal-cnv", label: "Yes" },
  { from: "has-sigmav", to: "terminal-cn", label: "No" },

  { from: "has-sigmah-dn", to: "terminal-dnh", label: "Yes" },
  { from: "has-sigmah-dn", to: "has-sigmad", label: "No" },
  { from: "has-sigmad", to: "terminal-dnd", label: "Yes" },
  { from: "has-sigmad", to: "terminal-dn", label: "No" }
];
