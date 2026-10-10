"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import {
  type BufferGeometry,
  type Group,
  type Material,
  Matrix4,
  Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Put `userData={{ noBatch: true }}` on anything under a <Batched> that moves or changes. */
type Flags = { noBatch?: boolean };

/**
 * Static scenery, merged. Once its children have mounted, every opaque mesh that looks the
 * same (same kind of material, colour, finish and texture) is merged into one mesh, so a
 * street of lamp posts, kerbs and railings costs a few dozen draw calls instead of
 * hundreds. The originals stay in the tree, switched out of rendering; anything marked
 * `noBatch`, transparent or animated is left alone. Children must not move or change
 * after mount.
 */
export function Batched({ children }: { children: ReactNode }) {
  const root = useRef<Group>(null);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateMatrixWorld(true);
    const toLocal = new Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map<string, { material: Material; geometries: BufferGeometry[]; meshes: Mesh[] }>();

    const visit = (object: Object3D) => {
      if ((object.userData as Flags).noBatch) return;
      const mesh = object as Mesh;
      if (mesh.isMesh && canMerge(mesh)) {
        const material = mesh.material as Material;
        const key = `${signature(material)}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${layout(mesh.geometry)}`;
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(new Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.geometries.push(geometry);
          bucket.meshes.push(mesh);
        } else buckets.set(key, { material, geometries: [geometry], meshes: [mesh] });
      }
      for (const child of object.children) visit(child);
    };
    for (const child of group.children) visit(child);

    const merged: Mesh[] = [];
    const replaced: Mesh[] = [];
    for (const { material, geometries, meshes } of buckets.values()) {
      // A lone mesh gains nothing from merging; leave it as it is.
      if (meshes.length < 2) {
        geometries[0]?.dispose();
        continue;
      }
      const geometry = mergeGeometries(geometries, false);
      for (const g of geometries) g.dispose();
      // Should a set not merge, its meshes simply keep drawing on their own.
      if (!geometry) continue;
      const first = meshes[0]!;
      const out = new Mesh(geometry, material);
      out.castShadow = first.castShadow;
      out.receiveShadow = first.receiveShadow;
      out.renderOrder = first.renderOrder;
      merged.push(out);
      replaced.push(...meshes);
    }
    // Take the originals out of every render (main, shadows, reflections) without hiding
    // their children: layers are not inherited, visibility is.
    for (const mesh of replaced) mesh.layers.disableAll();
    for (const mesh of merged) group.add(mesh);

    return () => {
      for (const mesh of merged) {
        group.remove(mesh);
        mesh.geometry.dispose();
      }
      for (const mesh of replaced) mesh.layers.enable(0);
    };
  }, []);

  return <group ref={root}>{children}</group>;
}

function canMerge(mesh: Mesh) {
  const material = mesh.material;
  if (Array.isArray(material) || !material) return false;
  if ((mesh as Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean }).isInstancedMesh) return false;
  if ((mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) return false;
  if (material.transparent || !mesh.visible) return false;
  const geometry = mesh.geometry;
  return Boolean(geometry.attributes.position) && !geometry.morphAttributes.position;
}

/** Which attributes a geometry carries and whether it is indexed: only like merges with like. */
function layout(geometry: BufferGeometry) {
  return `${Object.keys(geometry.attributes).sort().join(",")}:${geometry.index ? "i" : "n"}`;
}

/** What makes two materials draw identically. JSX gives every mesh its own instance, so compare by value. */
function signature(m: Material) {
  const s = m as MeshStandardMaterial & MeshBasicMaterial & { clearcoat?: number };
  const hex = (c?: { getHexString(): string }) => (c ? c.getHexString() : "-");
  return [
    m.type,
    hex(s.color),
    hex(s.emissive),
    s.emissiveIntensity ?? "",
    s.roughness ?? "",
    s.metalness ?? "",
    s.map?.uuid ?? "",
    s.emissiveMap?.uuid ?? "",
    s.normalMap?.uuid ?? "",
    s.roughnessMap?.uuid ?? "",
    s.alphaMap?.uuid ?? "",
    s.envMapIntensity ?? "",
    s.clearcoat ?? "",
    m.side,
    m.toneMapped ? 1 : 0,
    s.fog === false ? 0 : 1,
    s.flatShading ? 1 : 0,
    s.vertexColors ? 1 : 0,
    m.depthWrite ? 1 : 0,
    m.depthTest ? 1 : 0,
    m.polygonOffset ? `${m.polygonOffsetFactor}:${m.polygonOffsetUnits}` : 0,
    m.customProgramCacheKey?.() ?? "",
  ].join("|");
}
