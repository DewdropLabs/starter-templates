// Golden Glide's look, the file to read first (README.md says why it works):
// the style prompt, the sky, and the light of a low sun and a cool sky. Each
// mesh's everyday colour and words are beside it in game/; the sun that
// lights them sinks with the flight (`Sun` in game/course.js).
import * as THREE from 'three';

export const PROMPT = 'style: Gouache animation background art with warm golden-hour lighting. A rolling countryside at sunset, long shadows, backlit by the low sun, aerial view from above and behind.';
export const SKY = '#dbc79e';
export const SKY_WORDS = 'soft blue sky fading to glowing gold at horizon with low golden sun';

// The sun: low and warm, ahead of the flight (toward -z), its height in
// degrees above the horizon at the start and as the glider touches down.
// `angle` softens its shadows' edges, as a hazy evening sun's.
export const SUN_LIGHT = { color: '#ffb470', intensity: 3, high: 15, low: 12, angle: 0.03 };
// The sky: a cool blue-green fill, about a fifth of the sun, that the shade takes.
export const SKY_LIGHT = { sky: '#9cc8d4', ground: '#8aa486', intensity: 0.6 };

export const LEAF_COLORS = ['#e0a84a', '#d68a3a', '#e6b450', '#cf9440'];   // the autumn leaves in the wind

// The sky light, added once; the sun is a DirectionalLight that `Sun` aims.
export function skyLight() {
  return new THREE.HemisphereLight(SKY_LIGHT.sky, SKY_LIGHT.ground, SKY_LIGHT.intensity);
}
