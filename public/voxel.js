// Minecraft-style voxel builders: Falcon rocket, launch site, cube-shell planets,
// pixel stars. Scenery is baked into merged BufferGeometry meshes (vertex colors,
// one draw call each) — InstancedMesh is avoided on purpose: Safari/ANGLE renders
// nothing for instanced draws with this three build.
'use strict';
(function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260610);
  const OVER = 1.03;                       // bury interior faces of stacked cubes

  function mat(T, color, jitter) {
    const c = new T.Color(color);
    if (jitter) c.offsetHSL(0, 0, (rng() - 0.5) * jitter);
    return new T.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });
  }
  function cube(T, g, x, y, z, w, h, d, color, jitter) {
    const m = new T.Mesh(new T.BoxGeometry(w * OVER, h * OVER, d * OVER), mat(T, color, jitter));
    m.position.set(x, y, z); m.castShadow = true; g.add(m);
    return m;
  }

  // merged-geometry builder: quad()/cube() accumulate, build() bakes one Mesh
  function merged(T) {
    const pos = [], nrm = [], col = [], idx = [];
    let v = 0;
    const C = new T.Color();
    function quad(p1, p2, p3, p4, n, hex, jit) {
      C.setHex(hex); if (jit) C.offsetHSL(0, 0, (rng() - 0.5) * jit);
      for (const p of [p1, p2, p3, p4]) { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); col.push(C.r, C.g, C.b); }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
    function cube(x, y, z, w, h, d, hex, jit, withBottom) {
      const a = w * OVER / 2, b = h * OVER / 2, c = d * OVER / 2;
      quad([x + a, y - b, z + c], [x + a, y - b, z - c], [x + a, y + b, z - c], [x + a, y + b, z + c], [1, 0, 0], hex, jit);
      quad([x - a, y - b, z - c], [x - a, y - b, z + c], [x - a, y + b, z + c], [x - a, y + b, z - c], [-1, 0, 0], hex, jit);
      quad([x - a, y + b, z + c], [x + a, y + b, z + c], [x + a, y + b, z - c], [x - a, y + b, z - c], [0, 1, 0], hex, jit);
      quad([x - a, y - b, z + c], [x + a, y - b, z + c], [x + a, y + b, z + c], [x - a, y + b, z + c], [0, 0, 1], hex, jit);
      quad([x + a, y - b, z - c], [x - a, y - b, z - c], [x - a, y + b, z - c], [x + a, y + b, z - c], [0, 0, -1], hex, jit);
      if (withBottom)
        quad([x - a, y - b, z - c], [x + a, y - b, z - c], [x + a, y - b, z + c], [x - a, y - b, z + c], [0, -1, 0], hex, jit);
    }
    function build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute('normal', new T.BufferAttribute(new Float32Array(nrm), 3));
      g.setAttribute('color', new T.BufferAttribute(new Float32Array(col), 3));
      g.setIndex(idx);
      return new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    }
    return { quad, cube, build };
  }

  window.VOX = {
    // Falcon Heavy: white core + 2 side boosters, black interstage, grid fins
    falcon(T) {
      const g = new T.Group();
      const CORE = 0.7, SB = 0.58;
      for (let i = 0; i < 9; i++)                                  // center core
        cube(T, g, 0, CORE / 2 + i * CORE, 0, CORE, CORE, CORE,
          i >= 7 ? 0x26292e : 0xf3f5f8, 0.05);                     // top 2 = interstage (black)
      cube(T, g, 0, 9 * CORE + 0.35, 0, 0.62, 0.7, 0.62, 0xf3f5f8, 0.04);  // fairing
      cube(T, g, 0, 9 * CORE + 0.95, 0, 0.42, 0.5, 0.42, 0xf3f5f8, 0.04);
      cube(T, g, 0, 9 * CORE + 1.35, 0, 0.24, 0.3, 0.24, 0xd83b2e, 0);     // tip
      for (let s = -1; s <= 1; s += 2) {                           // side boosters
        for (let i = 0; i < 7; i++)
          cube(T, g, s * (CORE / 2 + SB / 2 + 0.02), SB / 2 + i * SB, 0,
            SB, SB, SB, i >= 6 ? 0x26292e : 0xf3f5f8, 0.05);
        cube(T, g, s * (CORE / 2 + SB / 2 + 0.02), 7 * SB + 0.22, 0, 0.4, 0.44, 0.4, 0xf3f5f8, 0.04);
        cube(T, g, s * (CORE / 2 + SB / 2 + 0.02), 7 * SB + 0.56, 0, 0.22, 0.26, 0.22, 0x26292e, 0);
      }
      for (let i = 0; i < 4; i++) {                                // grid fins on the core
        const a = i * Math.PI / 2;
        cube(T, g, Math.cos(a) * 0.45, 8.4 * CORE, Math.sin(a) * 0.45,
          0.3, 0.26, 0.08, 0x8a8f98, 0).rotation.y = -a;
      }
      cube(T, g, 0, 0.06, 0, 0.78, 0.16, 0.78, 0x33363c, 0);       // engine block
      return g;
    },

    // blocky engine flame (replaces the cone)
    flame(T) {
      const g = new T.Group();
      const fm = (c) => new T.MeshBasicMaterial({ color: c });
      const a = new T.Mesh(new T.BoxGeometry(0.5, 0.9, 0.5), fm(0xff7a1a)); a.position.y = -0.45;
      const b = new T.Mesh(new T.BoxGeometry(0.3, 0.7, 0.3), fm(0xffd24a)); b.position.y = -1.1;
      g.add(a, b);
      return g;
    },

    // launch site: terrain (grass/sea/beach/roads/pad/mounds), mountains, forest,
    // town, hangar, tower, tanks, low clouds
    world(scene, T) {
      const B = 2, EXT = 200;                    // voxel terrain spans ±EXT
      // column descriptor: top height + top/side colors (sides face lower ground)
      function colInfo(x, z) {
        if (x >= EXT || x < -EXT || z >= EXT || z < -EXT) return { top: 0 };
        if (x >= 70) return { top: 1.4, hex: 0x2a64c8, side: 0x1f4fa8, jit: 0.1 };       // sea
        if (x >= 62) return { top: 2, hex: 0xe2d49a, side: 0xd2c28a, jit: 0.06 };        // beach
        if (Math.abs(x) < 10 && Math.abs(z) < 10) return { top: 2, hex: 0x9aa0a8, side: 0x83898f, jit: 0.04 }; // pad
        if (Math.abs(z + 1) <= 1 && x < -10)                                             // road west (dashed line)
          return { top: 2, hex: ((x + 200) % 12) < 4 && z === 0 ? 0xd8c84a : 0x3f4146, side: 0x33363a, jit: 0.03 };
        if (Math.abs(x + 60) <= 2 && Math.abs(z) <= 100)                                 // cross road
          return { top: 2, hex: 0x3f4146, side: 0x33363a, jit: 0.03 };
        if (Math.hypot(x, z) > 20 && Math.sin(x * 0.05) + Math.cos(z * 0.07) > 0.9)
          return { top: 4, hex: 0x5fae3c, side: 0x7a5230, jit: 0.14 };                   // grass mound
        return { top: 2, hex: 0x6abe45, side: 0x7a5230, jit: 0.16 };                     // grass
      }
      const land = merged(T);
      for (let x = -EXT; x < EXT; x += B)
        for (let z = -EXT; z < EXT; z += B) {
          const c = colInfo(x, z);
          land.quad([x, c.top, z + B], [x + B, c.top, z + B], [x + B, c.top, z], [x, c.top, z], [0, 1, 0], c.hex, c.jit);
          const px = colInfo(x + B, z), nx = colInfo(x - B, z), pz = colInfo(x, z + B), nz = colInfo(x, z - B);
          if (px.top < c.top) land.quad([x + B, px.top, z + B], [x + B, px.top, z], [x + B, c.top, z], [x + B, c.top, z + B], [1, 0, 0], c.side, c.jit);
          if (nx.top < c.top) land.quad([x, nx.top, z], [x, nx.top, z + B], [x, c.top, z + B], [x, c.top, z], [-1, 0, 0], c.side, c.jit);
          if (pz.top < c.top) land.quad([x, pz.top, z + B], [x + B, pz.top, z + B], [x + B, c.top, z + B], [x, c.top, z + B], [0, 0, 1], c.side, c.jit);
          if (nz.top < c.top) land.quad([x + B, nz.top, z], [x, nz.top, z], [x, c.top, z], [x + B, c.top, z], [0, 0, -1], c.side, c.jit);
        }
      const landMesh = land.build(); landMesh.receiveShadow = true; scene.add(landMesh);
      const farSea = new T.Mesh(new T.PlaneGeometry(4300, 9000),   // ocean to the horizon, east of the coast (no overlap with the ground plane)
        new T.MeshStandardMaterial({ color: 0x2a64c8, roughness: 0.9 }));
      farSea.rotation.x = -Math.PI / 2; farSea.position.set(2350, -0.04, 0); scene.add(farSea);

      const deco = merged(T);
      const put = (x, y, z, hex, jit) => deco.cube(x, y, z, B, B, B, hex, jit, false);
      // mountain range: big stepped pyramids close enough to read on camera
      const MTNS = [[-120, -120, 11], [-70, -150, 7], [30, -130, 9], [-150, 90, 10], [-40, 150, 7], [40, 130, 6]];
      for (const [mx, mz, h] of MTNS)
        for (let lv = 0; lv < h; lv++) {
          const r = h - 1 - lv, snow = h >= 7 && lv >= h - 2;
          for (let bx = -r; bx <= r; bx++) for (let bz = -r; bz <= r; bz++)
            put(mx + bx * B, B + lv * B + B / 2, mz + bz * B, snow ? 0xf4f8fb : 0x8a8f98, 0.07);
        }
      // forest: 60 trees, kept off roads / pad / town / beach / mountains
      for (let i = 0; i < 60; i++) {
        const tx = -190 + rng() * 246, tz = -190 + rng() * 380;
        if (Math.abs(tz) < 6 || (Math.abs(tx) < 16 && Math.abs(tz) < 16)) continue;
        if (tx > 56 || (tx > -90 && tx < -30 && Math.abs(tz) < 28)) continue;
        if (Math.abs(tx + 60) < 6 && Math.abs(tz) < 104) continue;
        if (MTNS.some(([mx, mz, h]) => Math.hypot(tx - mx, tz - mz) < h * B + 4)) continue;
        const h = 2 + Math.floor(rng() * 2);
        for (let t = 0; t < h; t++) put(tx, B + 1 + t * B, tz, 0x6e4a1f, 0.06);
        for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++)
          put(tx + lx * B, B + 1 + h * B, tz + lz * B, 0x2f8f2f, 0.12);
        put(tx, B + 3 + h * B, tz, 0x2f8f2f, 0.12);
      }
      // town by the road junction: solid block houses, light-block windows
      const WALLS = [0xd9c9a8, 0xc46a4a, 0xb0b6bd, 0x8fa3c8];
      for (const [hx, hz, w, d, h] of [[-76, -14, 3, 3, 4], [-48, -18, 4, 3, 3], [-74, 14, 3, 4, 5], [-52, 16, 3, 3, 3], [-36, -12, 4, 4, 4], [-40, 22, 3, 3, 6], [-86, 4, 3, 3, 3]]) {
        const wall = WALLS[Math.floor(rng() * WALLS.length)];
        for (let bx = 0; bx < w; bx++) for (let bz = 0; bz < d; bz++) for (let by = 0; by < h; by++)
          put(hx + bx * B, B + by * B + B / 2, hz + bz * B,
            by > 0 && rng() < 0.18 ? 0x9fd8e8 : wall, 0.05);       // windows glint
        for (let bx = -1; bx <= w; bx++) for (let bz = -1; bz <= d; bz++)
          put(hx + bx * B, B + h * B + B / 2, hz + bz * B, 0x5a4632, 0.06); // roof slab ring
      }
      // assembly hangar near the pad (big white box, blue stripe)
      for (let bx = 0; bx < 8; bx++) for (let bz = 0; bz < 4; bz++) for (let by = 0; by < 6; by++)
        put(-44 + bx * B, B + by * B + B / 2, 28 + bz * B, by === 3 ? 0x3a6ec8 : 0xeef1f4, 0.04);
      const decoMesh = deco.build(); decoMesh.castShadow = decoMesh.receiveShadow = true; scene.add(decoMesh);

      const fix = new T.Group(); scene.add(fix);                   // odd-sized blocks
      for (let i = 0; i < 8; i++)                                  // tower: iron blocks
        cube(T, fix, 6.5, B + 1 + i * 2, 0, 1.4, 2, 1.4, 0x9aa0a8, 0.06);
      cube(T, fix, 4.6, B + 12.4, 0, 2.4, 0.8, 0.8, 0x9aa0a8, 0);  // crane arm
      for (const [tx, tz] of [[-24, -10], [-28, 8], [24, -16]]) {  // fuel tanks: white, blue band, domed cap
        for (let i = 0; i < 3; i++)
          cube(T, fix, tx, B + 1.1 + i * 2.2, tz, 2.6, 2.2, 2.6, i === 1 ? 0x3a6ec8 : 0xe2e6ea, 0.05);
        cube(T, fix, tx, B + 1.1 + 3 * 2.2 - 0.6, tz, 1.8, 1.4, 1.8, 0xaab2ba, 0.05);
      }

      const clouds = merged(T);                                    // blocky cloud slabs
      for (let i = 0; i < 50; i++) {
        const cx = -400 + rng() * 800, cz = -400 + rng() * 800, cy = 30 + rng() * 26;
        if (Math.hypot(cx, cz) < 80) continue;   // keep the launch-pad view clear
        const w = 1 + Math.floor(rng() * 3);
        for (let bx = 0; bx < w; bx++) clouds.cube(cx + bx * 8, cy, cz, 8, 1, 8, 0xffffff, 0, true);
      }
      scene.add(clouds.build());
    },

    // landing surface for moon/mars: flat voxel terrain with craters / dunes + rocks
    planetGround(T, kind) {
      const B = 2, R = 100, m = merged(T);
      const CRATERS = kind === 'moon'
        ? [[-40, -30, 14], [30, 40, 10], [55, -50, 8], [-70, 50, 11], [10, -75, 7]]
        : [[-50, 35, 9], [45, -45, 12]];
      for (let x = -R; x < R; x += B)
        for (let z = -R; z < R; z += B) {
          let hex = kind === 'moon' ? 0xb9bcc2 : 0xb5512e, jit = 0.12;
          if (kind === 'mars' && Math.sin((x + z) * 0.08) > 0.5) hex = 0xc46a3a;  // dune bands
          for (const [cx, cz, r] of CRATERS) {
            const d = Math.hypot(x - cx, z - cz);
            if (d < r - 2) hex = kind === 'moon' ? 0x8e9298 : 0x8e3f23;           // crater floor
            else if (d < r) hex = kind === 'moon' ? 0xcfd3d8 : 0xd07f4a;          // bright rim
          }
          m.quad([x, 2, z + B], [x + B, 2, z + B], [x + B, 2, z], [x, 2, z], [0, 1, 0], hex, jit);
        }
      for (let i = 0; i < 14; i++) {                                              // scattered rocks
        const rx = -90 + rng() * 180, rz = -90 + rng() * 180, s = 0.8 + rng() * 1.6;
        m.cube(rx, 2 + s / 2, rz, s, s, s, kind === 'moon' ? 0x9a9ea6 : 0x93431f, 0.15, false);
      }
      return m.build();
    },

    // cube-shell planet (axis-aligned blocks → Minecraft globe), one merged mesh
    planet(T, R, B, kind) {
      const m = merged(T);
      for (let phi = B / R / 2; phi < Math.PI; phi += B / R) {
        const ringR = R * Math.sin(phi), y = R * Math.cos(phi);
        const n = Math.max(1, Math.round((2 * Math.PI * ringR) / B));
        for (let k = 0; k < n; k++) {
          const th = (k / n) * Math.PI * 2;
          const x = Math.cos(th) * ringR, z = Math.sin(th) * ringR;
          let hex, jit = 0.08;
          if (kind === 'earth') {
            if (Math.abs(y) > R * 0.92) hex = 0xf4f8fb;
            else {
              const nn = Math.sin(x * 3 / R + 1.3) + Math.sin(y * 2.2 / R) + Math.sin(z * 2.7 / R + 0.5);
              hex = nn > 0.55 ? 0x3f9e3f : 0x2a64c8;
            }
          } else if (kind === 'moon') { hex = 0xb9bcc2; jit = 0.15; }
          else { hex = 0xb5512e; jit = 0.12; }                     // mars
          m.cube(x, y, z, B, B, B, hex, jit, true);
        }
      }
      return m.build();
    },

    // pixel stars: square Points on a far shell, revealed as the atmosphere thins
    stars(T) {
      const N = 900, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const u = rng() * 2 - 1, th = rng() * Math.PI * 2, r = 2600 + rng() * 1200;
        const s = Math.sqrt(1 - u * u);
        pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      return new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: false }));
    },
  };
})();
