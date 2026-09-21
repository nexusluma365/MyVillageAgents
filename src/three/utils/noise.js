// Tiny deterministic value-noise (no external dependency) used to give the
// terrain gentle, organic height variation instead of a dead-flat plane.
// Not cryptographic, not Perlin — just a smooth hash lattice, which is all
// a few subtle hills and color-mottling need.
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = smooth(xf), v = smooth(zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}

export function fbm2D(x, z, octaves = 4, lacunarity = 2, gain = 0.5) {
  let total = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * freq, z * freq) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return total / max;
}

// Distance from point (x,z) to the segment a->b, in the XZ plane.
export function distToSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((x - ax) * dx + (z - az) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx, pz = az + t * dz;
  return Math.hypot(x - px, z - pz);
}
