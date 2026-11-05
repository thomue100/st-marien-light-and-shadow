// Materialien.
import { enhance } from './shaders.js'; // Aufbau-Reihenfolge: nach scene/shaders
import { cutPlane } from './renderer.js';
import { brickTex, copperTex, diamondTex, groundTex, slabTex } from './textures.js';

/* ---------------- Materialien ---------------- */

export const lin = h => new THREE.Color(h).convertSRGBToLinear(); // Farbwert als sRGB angeben (wie im Foto gemessen); three r128 nimmt Hex-Farben sonst linear
export const wallMat = enhance(
  new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.93, metalness: 0, side: THREE.DoubleSide }),
  { mask: true },
);
export const arcadeMat = enhance(
  new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.93, metalness: 0, side: THREE.DoubleSide }),
  { mask: true, pillar: true },
);
export const floorMat = enhance(new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.7 }), {});
export const doorMat = new THREE.MeshStandardMaterial({
  color: lin(0x26302b),
  roughness: 0.75,
  side: THREE.DoubleSide,
});
doorMat.clippingPlanes = [cutPlane]; // ohne Innenraum-Shader: sonst hellt das Streulicht das Türblatt auf
export const woodMat = enhance(new THREE.MeshStandardMaterial({ color: 0x8a5c36, roughness: 0.65 }), {});
export const towerMatW = enhance(
  new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.93, side: THREE.DoubleSide }),
  { mask: true },
);
export const revealMat = new THREE.MeshStandardMaterial({
  map: brickTex,
  color: 0x9c948c,
  roughness: 0.95,
  side: THREE.DoubleSide,
});
revealMat.clippingPlanes = [cutPlane]; // Laibung: derselbe Backstein, nur etwas dunkler (Fotos: keine hellen Bögen)
export const stoneLedgeMat = new THREE.MeshStandardMaterial({ color: lin(0xa8a39b), roughness: 0.85 });
stoneLedgeMat.clippingPlanes = [cutPlane]; // helle Gesimse und Sohlbänke
export const mullionMat = enhance(new THREE.MeshStandardMaterial({ map: brickTex, color: 0xd8d0c8, roughness: 0.92 }), {
  mask: true,
}); // Pfosten außen Backstein, innen verputzt (Fotos)
export const graniteMat = enhance(new THREE.MeshStandardMaterial({ color: 0x7a756f, roughness: 0.5 }), {});
export const altarMat = enhance(new THREE.MeshStandardMaterial({ color: 0x6e5a3e, roughness: 0.6 }), {});
export const roofMat = new THREE.MeshStandardMaterial({
  map: copperTex,
  roughness: 0.7,
  metalness: 0.1,
  side: THREE.DoubleSide,
});
roofMat.clippingPlanes = [cutPlane];
export const goldMat = new THREE.MeshStandardMaterial({
  color: 0xd8a948,
  roughness: 0.32,
  metalness: 0.4,
  emissive: 0x2a1a04,
});
goldMat.clippingPlanes = [cutPlane];
export const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1715, roughness: 0.9, side: THREE.DoubleSide });
darkMat.clippingPlanes = [cutPlane];
export const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.75, metalness: 0.1 });
darkRoofMat.clippingPlanes = [cutPlane];
export const groundMat = new THREE.MeshStandardMaterial({
  map: groundTex,
  roughness: 0.95,
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 4,
});
export const outerFront = new THREE.MeshStandardMaterial({
  color: 0x2a3a42,
  map: diamondTex,
  roughness: 0.25,
  metalness: 0.55,
  side: THREE.FrontSide,
});
outerFront.clippingPlanes = [cutPlane];
export const outerBack = outerFront.clone();
outerBack.side = THREE.BackSide;
outerBack.clippingPlanes = [cutPlane];
diamondTex.repeat.set(1, 1);
