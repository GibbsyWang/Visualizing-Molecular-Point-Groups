import { createCylinderBetween, createInversionCenter } from "@/utils/symmetryScenePrimitives";

function createAxisCap(THREE, type, color) {
  if (type === "hex") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.055, 6),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
  }

  if (type === "bar") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.05, 0.065),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.95 })
    );
  }

  if (type === "triangle") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.055, 3),
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

  return null;
}

function createAxisWithCaps(THREE, start, end, options = {}) {
  const color = options.color ?? "#2563eb";
  const radius = options.radius ?? 0.02;
  const opacity = options.opacity ?? 0.9;
  const capType = options.capType ?? "none";

  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const group = new THREE.Group();
  group.add(createCylinderBetween(THREE, start, end, radius, color, opacity));

  if (capType !== "none") {
    const topCap = createAxisCap(THREE, capType, color);
    const bottomCap = createAxisCap(THREE, capType, color);
    if (topCap && bottomCap) {
      topCap.position.copy(end);
      bottomCap.position.copy(start);
      topCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      bottomCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().multiplyScalar(-1));
      group.add(topCap, bottomCap);
    }
  }

  return group;
}

function createInPlaneC2Axis(THREE, angle, color = "#7c3aed") {
  const length = 3.15;
  const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
  const start = direction.clone().multiplyScalar(-length);
  const end = direction.clone().multiplyScalar(length);
  return createAxisWithCaps(THREE, start, end, {
    color,
    radius: 0.017,
    opacity: 0.92,
    capType: "ellipse"
  });
}

function createPrincipalAxis(THREE) {
  const start = new THREE.Vector3(0, 0, -2.45);
  const end = new THREE.Vector3(0, 0, 2.45);
  return createAxisWithCaps(THREE, start, end, {
    color: "#1d4ed8",
    radius: 0.022,
    opacity: 0.92,
    capType: "hex"
  });
}

function createHorizontalMirrorPlane(THREE) {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.CylinderGeometry(2.95, 2.95, 0.09, 72),
    new THREE.MeshBasicMaterial({
      color: "#16a34a",
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide
    })
  );
  slab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));

  group.add(slab);
  return group;
}

export function deriveBenzeneAxisAnglesFromAtoms(atoms) {
  const carbonAtoms = atoms.filter((atom) => atom.element === "C");
  if (carbonAtoms.length < 6) {
    return [0, Math.PI / 3, (2 * Math.PI) / 3];
  }

  const center = carbonAtoms.reduce(
    (sum, atom) => ({
      x: sum.x + (Number.isFinite(atom.nx) ? atom.nx : atom.x),
      y: sum.y + (Number.isFinite(atom.ny) ? atom.ny : atom.y)
    }),
    { x: 0, y: 0 }
  );
  center.x /= carbonAtoms.length;
  center.y /= carbonAtoms.length;

  const carbonAngles = carbonAtoms
    .map((atom) =>
      Math.atan2(
        (Number.isFinite(atom.ny) ? atom.ny : atom.y) - center.y,
        (Number.isFinite(atom.nx) ? atom.nx : atom.x) - center.x
      )
    )
    .sort((a, b) => a - b);

  const uniqueLines = [];
  carbonAngles.forEach((angle) => {
    let normalized = angle % Math.PI;
    if (normalized < 0) {
      normalized += Math.PI;
    }
    const exists = uniqueLines.some((item) => Math.abs(item - normalized) < 0.08);
    if (!exists) {
      uniqueLines.push(normalized);
    }
  });

  if (uniqueLines.length >= 3) {
    return uniqueLines.sort((a, b) => a - b).slice(0, 3);
  }

  return [0, Math.PI / 3, (2 * Math.PI) / 3];
}

function createVerticalMirrorSquare(THREE, axisAngle, color, opacity) {
  const size = 4.8;
  const thickness = 0.08;
  const geometry = new THREE.BoxGeometry(size, size, thickness);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide
    })
  );

  const horizontal = new THREE.Vector3(Math.cos(axisAngle), Math.sin(axisAngle), 0).normalize();
  const vertical = new THREE.Vector3(0, 0, 1);
  const normal = new THREE.Vector3().crossVectors(horizontal, vertical).normalize();
  const basis = new THREE.Matrix4().makeBasis(horizontal, vertical, normal);
  mesh.setRotationFromMatrix(basis);
  return mesh;
}

function pickObjectsByFocus(layerId, objects, operationFocus) {
  if (!operationFocus || operationFocus.layerId !== layerId) {
    return objects;
  }

  if (!Number.isInteger(operationFocus.index)) {
    return objects;
  }

  const target = objects[operationFocus.index];
  return target ? [target] : [];
}

function getBaseAngleFromAtoms(atoms) {
  const axes = deriveBenzeneAxisAnglesFromAtoms(atoms);
  return axes[0] ?? 0;
}

/**
 * @returns {import("@/types/contracts").SymmetryLayer[]}
 */
export function createBenzeneSymmetryLayers() {
  return [
    {
      id: "c6-axis",
      label: "C6 principal axis",
      group: "core",
      visibleByDefault: true,
      description: "Principal C6 axis perpendicular to the benzene ring.",
      buildObjects: ({ THREE }) => [createPrincipalAxis(THREE)]
    },
    {
      id: "sigma-h",
      label: "sigma_h mirror plane",
      group: "core",
      visibleByDefault: true,
      description: "Horizontal mirror plane coincident with the benzene molecular plane.",
      buildObjects: ({ THREE }) => [createHorizontalMirrorPlane(THREE)]
    },
    {
      id: "inversion-center",
      label: "Inversion center i",
      group: "core",
      visibleByDefault: true,
      description: "Inversion center at the ring centroid.",
      buildObjects: ({ THREE }) => [createInversionCenter(THREE)]
    },
    {
      id: "c2-axes",
      label: "6C2 axes",
      group: "core",
      visibleByDefault: false,
      description: "Six in-plane C2 axes.",
      buildObjects: ({ THREE, normalizedAtoms, operationFocus }) => {
        const baseAngle = getBaseAngleFromAtoms(normalizedAtoms);
        const angles = Array.from({ length: 6 }, (_, index) => baseAngle + (index * Math.PI) / 6);
        const objects = angles.map((angle) => createInPlaneC2Axis(THREE, angle, "#7c3aed"));
        return pickObjectsByFocus("c2-axes", objects, operationFocus);
      }
    },
    {
      id: "sigma-v",
      label: "6 sigma_v planes",
      group: "core",
      visibleByDefault: false,
      description: "Six vertical square mirrors generated by rotating one mirror by 30 degrees.",
      buildObjects: ({ THREE, normalizedAtoms, operationFocus }) => {
        const baseAngle = getBaseAngleFromAtoms(normalizedAtoms);
        const angles = Array.from({ length: 6 }, (_, index) => baseAngle + (index * Math.PI) / 6);
        const objects = angles.map((angle) => createVerticalMirrorSquare(THREE, angle, "#0891b2", 0.1));
        return pickObjectsByFocus("sigma-v", objects, operationFocus);
      }
    }
  ];
}

function createEthanePrincipalAxis(THREE) {
  const start = new THREE.Vector3(0, 0, -2.3);
  const end = new THREE.Vector3(0, 0, 2.3);
  return createAxisWithCaps(THREE, start, end, {
    color: "#1d4ed8",
    radius: 0.021,
    opacity: 0.92,
    capType: "triangle"
  });
}

function createEthanePerpendicularC2Axis(THREE, angle, color = "#7c3aed") {
  const length = 2.7;
  const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
  const start = direction.clone().multiplyScalar(-length);
  const end = direction.clone().multiplyScalar(length);
  return createAxisWithCaps(THREE, start, end, {
    color,
    radius: 0.017,
    opacity: 0.9,
    capType: "ellipse"
  });
}

function createEthaneSigmaDPlane(THREE, angle, color = "#0891b2", opacity = 0.1) {
  return createVerticalMirrorSquare(THREE, angle, color, opacity);
}

/**
 * @returns {import("@/types/contracts").SymmetryLayer[]}
 */
export function createEthaneSymmetryLayers() {
  return [
    {
      id: "ethane-c3-axis",
      label: "C3 principal axis",
      group: "core",
      visibleByDefault: true,
      description: "Principal C3 axis along the ethane molecular axis.",
      buildObjects: ({ THREE }) => [createEthanePrincipalAxis(THREE)]
    },
    {
      id: "ethane-c2-perp",
      label: "3C2 perpendicular axes",
      group: "core",
      visibleByDefault: false,
      description: "Three C2 axes perpendicular to the principal axis.",
      buildObjects: ({ THREE, operationFocus }) => {
        const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
        const objects = angles.map((angle) => createEthanePerpendicularC2Axis(THREE, angle));
        return pickObjectsByFocus("ethane-c2-perp", objects, operationFocus);
      }
    },
    {
      id: "ethane-sigma-d",
      label: "3sigma_d planes",
      group: "core",
      visibleByDefault: false,
      description: "Three diagonal mirror planes containing the principal axis.",
      buildObjects: ({ THREE, operationFocus }) => {
        const angles = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];
        const objects = angles.map((angle) => createEthaneSigmaDPlane(THREE, angle));
        return pickObjectsByFocus("ethane-sigma-d", objects, operationFocus);
      }
    },
    {
      id: "ethane-s6-mirror",
      label: "S6 perpendicular mirror",
      group: "core",
      visibleByDefault: false,
      description: "Mirror plane perpendicular to the principal axis used by S6 operations.",
      buildObjects: ({ THREE }) => [createHorizontalMirrorPlane(THREE)]
    },
    {
      id: "ethane-inversion-center",
      label: "Inversion center i",
      group: "core",
      visibleByDefault: true,
      description: "Inversion center located at the midpoint of the C-C bond.",
      buildObjects: ({ THREE }) => [createInversionCenter(THREE)]
    }
  ];
}
