export function createCylinderBetween(THREE, start, end, radius, color, opacity = 1) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18);
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    shininess: 40
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function createInversionCenter(THREE) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 24),
    new THREE.MeshPhongMaterial({
      color: "#dc2626",
      emissive: "#7f1d1d",
      transparent: true,
      opacity: 0.95
    })
  );
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 24, 24),
    new THREE.MeshBasicMaterial({
      color: "#ef4444",
      transparent: true,
      opacity: 0.16
    })
  );
  group.add(core, shell);
  return group;
}
