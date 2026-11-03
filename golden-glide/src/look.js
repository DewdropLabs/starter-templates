// Golden Glide's look, the file to read first (README.md says why it works):
// the style prompt and the sky, and golden-hour colour baked into base
// colours. Each mesh's words are beside it in game/.
//
//   gold('#7aa84a')                 an object's daylight colour in the low warm sun
//   sunBands(geometry)              split a shape into lit / middle / shaded faces
//   haze(color, d)                  fade toward the warm evening haze with distance
import * as THREE from 'three';

export const PROMPT = 'style: gouache animation background art. A golden countryside at sunset seen from the air: a low deep orange sun, long shadows, glowing gold highlights and cool blue-green shade, soft painterly brushwork.';
export const SKY = '#e2c08e';
export const SKY_WORDS = 'soft blue overhead fading through peach to deep orange and glowing gold at the horizon, a huge glowing orange-gold sun low on the horizon, long shadows across the golden land';

// Toward the sun: low (about 12°) and ahead, a little to the left.
const SUN_DIR = new THREE.Vector3(-0.12, 0.21, -1).normalize();
export const HAZE = new THREE.Color('#edc79a');
export const LEAF_COLORS = ['#e0a84a', '#d68a3a', '#e6b450', '#cf9440'];   // the autumn leaves in the wind

const GOLD = [1.0, 0.86, 0.66];        // the golden-hour recipe: daylight × this
const BANDS = [
  { min: 0.18, tint: [1.1, 0.9, 0.6] },     // facing the sun: warm, glowing
  { min: -0.4, tint: GOLD },                // side-lit
  { min: -2, tint: [0.7, 0.76, 0.84] },     // facing away: cool blue-green shade
];

const tinted = (hex, [r, g, b]) => { const c = new THREE.Color(hex); c.r *= r; c.g *= g; c.b *= b; return c; };

export const gold = (hex) => tinted(hex, GOLD);
export const bandColor = (hex, band) => tinted(hex, BANDS[band].tint);

// Split a geometry's triangles by how squarely they face the sun, into one
// geometry per band (index 0 lit … 2 shaded; a band can be null).
export function sunBands(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const lists = BANDS.map(() => []);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const tri = new THREE.Triangle();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    tri.set(a, b, c).getNormal(n);
    const d = n.dot(SUN_DIR);
    const band = BANDS.findIndex((x) => d >= x.min);
    lists[band].push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  return lists.map((l) => {
    if (!l.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(l, 3));
    geo.computeVertexNormals();
    return geo;
  });
}

// Fade a colour toward the evening haze, by distance (m) from the flight line.
export function haze(color, d) {
  const k = (1 - Math.exp(-((d / 420) ** 1.6))) * 0.85;
  return color.lerp(HAZE, k);
}
