// Prompt Rocket — your AI session launches a rocket that climbs the whole turn (each
// tool = thrust). Altitude is shown in REAL km. The ending depends on the real
// altitude reached when the turn ends (alt(c) ≈ 7c + 0.175c² km for c combos):
//   < GEO: retro-burn landing · >=35,786 km (GEO): deploy satellites + land
//   >=384,400 km: Moon landing · >=225,000,000 km: Mars landing — legendary.
//   (≈ combos: GEO ~430 · Moon ~1,460 · Mars ~35,800)
// Demo flights are excluded from the leaderboard. No bloom — direct render.
'use strict';
const T = window.THREE;
const SFX = window.SFX || { launch() {}, combo() {}, land() {} };
const FOV = 60;
const MOON_KM = 384400, MARS_KM = 225000000;       // real distances from Earth
const el = (id) => document.getElementById(id);
const fmt = (km) => Math.round(km).toLocaleString('en-US') + ' km';

// real-altitude milestones (km)
const ZONES = [
  { alt: 0,     name: '🌍 Launch pad',            sky: 0xaedcff },
  { alt: 12,    name: '☁️ Troposphere',           sky: 0x86c1ee },
  { alt: 50,    name: '🌤 Stratosphere',          sky: 0x3f6fa8 },
  { alt: 100,   name: '🚀 Kármán line — space!',  sky: 0x05060d },
  { alt: 408,   name: '🛰 Low Earth orbit (ISS)', sky: 0x03040a },
  { alt: 550,   name: '📡 Starlink orbit',        sky: 0x03040a },
  { alt: 35786, name: '📡 Geostationary (GEO)',   sky: 0x02030a },
];
function zoneFor(a) { let z = ZONES[0]; for (const x of ZONES) if (a >= x.alt) z = x; return z; }
// compress real km → on-screen world height so the rocket stays visible
function worldY(km) { return 2.4 + Math.min(km, 500) * 0.5 + Math.max(0, Math.min(km, 6000) - 500) * 0.03 + Math.max(0, km - 6000) * 0.001; }
const MOON_WY = 1300, MARS_WY = 2300;

const scene = new T.Scene();
scene.background = new T.Color(ZONES[0].sky);
const camera = new T.PerspectiveCamera(FOV, innerWidth / innerHeight, 1, 9000); // near=1: tight depth range → no z-fight shimmer on distant blocks
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.NoToneMapping;  // keep flat voxel colors vivid (ACES washed them pastel)
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
el('scene').appendChild(renderer.domElement);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

scene.add(new T.HemisphereLight(0xeaf4ff, 0x405060, 1.0));
const sun = new T.DirectionalLight(0xfff3d6, 0.9);
sun.position.set(-40, 60, 30); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
const ssc = sun.shadow.camera; ssc.near = 1; ssc.far = 200; ssc.left = ssc.bottom = -45; ssc.right = ssc.top = 45;
sun.shadow.normalBias = 0.5;            // block faces self-shadow (acne) without a bias
scene.add(sun);

// Minecraft-style space: pixel stars behind a thinning atmosphere; the sky
// color itself follows the current zone (lerped in step()).
scene.add(window.VOX.stars(T));
const zoneSky = new T.Color(ZONES[0].sky);
// atmosphere dome: blue near the ground, fades out with altitude to reveal the stars
const atmoMat = new T.ShaderMaterial({ side: T.BackSide, transparent: true, depthWrite: false,
  uniforms: { topC: { value: new T.Color(0x1a4f96) }, botC: { value: new T.Color(0xbfe3ff) }, op: { value: 1 } },
  vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vP; uniform vec3 topC; uniform vec3 botC; uniform float op; void main(){ float h=clamp(normalize(vP).y*0.5+0.5,0.0,1.0); gl_FragColor=vec4(mix(botC,topC,h), op); }' });
const atmo = new T.Mesh(new T.SphereGeometry(2400, 32, 24), atmoMat);
atmo.renderOrder = -1;                  // always paint the sky dome before smoke/glow — sort order between transparents flips per frame otherwise
scene.add(atmo);

// ground plane reaches the horizon WEST of the coastline only — the far-sea
// plane owns the east side (overlapping coplanar planes z-fight = sparkle)
const ground = new T.Mesh(new T.PlaneGeometry(4700, 9000), new T.MeshStandardMaterial({ color: 0x55a046, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(-2150, -0.05, 0); ground.receiveShadow = true; scene.add(ground);
window.VOX.world(scene, T);

// cube-shell planets (Minecraft globes) + Earth's atmosphere rim glow.
// Earth lives in a group so it can shrink with distance (scale balance).
const earthGrp = new T.Group(); earthGrp.position.set(0, -448, -120); scene.add(earthGrp);
const earth = window.VOX.planet(T, 440, 24, 'earth'); earthGrp.add(earth);
const earthGlow = new T.Mesh(new T.SphereGeometry(472, 48, 32), new T.ShaderMaterial({ side: T.BackSide, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
  vertexShader: 'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vN; void main(){ float i=pow(1.0-abs(vN.z),2.5); gl_FragColor=vec4(0.35,0.62,1.0,i*0.85); }' }));
earthGrp.add(earthGlow);
const moon = window.VOX.planet(T, 55, 7, 'moon');
moon.position.set(-55, MOON_WY + 70, -190); scene.add(moon);
const mars = window.VOX.planet(T, 85, 9, 'mars');
mars.position.set(75, MARS_WY + 100, -270); scene.add(mars);

// moon/mars landing surfaces — parked far below the Earth scene, never in view
const SITES = { moon: { x: -200, y: -800 }, mars: { x: 200, y: -800 } };
for (const k of ['moon', 'mars']) {
  const g = window.VOX.planetGround(T, k);
  g.position.set(SITES[k].x, SITES[k].y, 0); scene.add(g);
}

// droneship — floats on the actual voxel sea east of the beach (water top ≈1.5)
const SHIP_X = 104;
const droneship = new T.Mesh(new T.BoxGeometry(13, 0.8, 9), new T.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 }));
droneship.position.set(SHIP_X, 1.9, 0); droneship.visible = false; droneship.receiveShadow = true; scene.add(droneship);
const dpad = new T.Mesh(new T.BoxGeometry(5, 0.12, 5), new T.MeshStandardMaterial({ color: 0xe2e234, emissive: 0x3a3a08, emissiveIntensity: 0.4 }));
dpad.position.set(SHIP_X, 2.36, 0); dpad.visible = false; scene.add(dpad);

const rocket = new T.Group(); rocket.position.set(0, 2.4, 0); scene.add(rocket);
rocket.add(window.VOX.falcon(T));                  // voxel Falcon Heavy (no GLB)
const flame = window.VOX.flame(T);
flame.position.y = -0.1; flame.visible = false; rocket.add(flame); rocket.userData.flame = flame;
const legs = new T.Group(); legs.visible = false; rocket.add(legs);
for (let i = 0; i < 4; i++) { const leg = new T.Mesh(new T.BoxGeometry(0.13, 2.0, 0.13), new T.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.4, roughness: 0.6 })); const a = i * Math.PI / 2; leg.position.set(Math.cos(a) * 1.0, 0.0, Math.sin(a) * 1.0); leg.rotation.z = -Math.cos(a) * 0.55; leg.rotation.x = Math.sin(a) * 0.55; legs.add(leg); }

const puffs = [], sats = [];
function spawnPuff(big) {
  const N = big ? 14 : 5, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { pos[i*3]=rocket.position.x+(Math.random()-0.5)*0.6; pos[i*3+1]=rocket.position.y-3.6; pos[i*3+2]=rocket.position.z+(Math.random()-0.5)*0.6; vel.push([(Math.random()-0.5)*3, -3-Math.random()*4, (Math.random()-0.5)*3]); }
  const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const m = new T.PointsMaterial({ color: big ? 0xffd27f : 0xdddddd, size: big ? 1.4 : 1.0, transparent: true, opacity: 0.9, depthWrite: false });
  const p = new T.Points(gg, m); p.userData = { vel, life: big ? 0.9 : 0.7, max: big ? 0.9 : 0.7 }; scene.add(p); puffs.push(p);
}
function updatePuffs(dt) {
  for (let k = puffs.length - 1; k >= 0; k--) { const p = puffs[k]; p.userData.life -= dt;
    if (p.userData.life <= 0) { scene.remove(p); p.geometry.dispose(); p.material.dispose(); puffs.splice(k, 1); continue; }
    const a = p.geometry.attributes.position, v = p.userData.vel;
    for (let i = 0; i < v.length; i++) { a.array[i*3]+=v[i][0]*dt; a.array[i*3+1]+=v[i][1]*dt; a.array[i*3+2]+=v[i][2]*dt; }
    a.needsUpdate = true; p.material.opacity = 0.9 * (p.userData.life / p.userData.max); }
}
function deploySatellites(n, label) {
  for (let i = 0; i < n; i++) { const s = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 1.0), new T.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x224488, emissiveIntensity: 0.4 }));
    s.position.copy(rocket.position);
    s.userData = { vel: [(Math.random()-0.5)*8 + i * 1.2, (Math.random()-0.5)*4, -3-Math.random()*4] }; // spread → train
    scene.add(s); sats.push(s); }
  toast(label || '🛰 Satellites deployed!');
}
function touchdownDust() { for (let i = 0; i < 4; i++) spawnPuff(true); }

// ---------- state ----------
let fovKick = 0, shake = 0, lastZone = ZONES[0].name;
const st = { phase: 'pre', alt: 0, vy: 0, combo: 0, t: 0, maxAlt: 0, ending: 'retro', tr: null };

function setBadge(s) { el('badge').textContent = s; }
function launch() {
  Object.assign(st, { phase: 'climb', alt: 0, altTarget: 0, vy: 0, combo: 0, t: 0, maxAlt: 0, ending: 'retro', tr: null, demoEnding: null, isDemo: false, comboRamp: null, planet: null, landY: 2.4 });
  rocket.position.set(0, 2.4, 0); rocket.rotation.set(0, 0, 0); lastZone = ZONES[0].name;
  sats.forEach((s) => scene.remove(s)); sats.length = 0;
  droneship.visible = dpad.visible = false; legs.visible = false; flame.visible = false; rocket.scale.setScalar(1);
  setBadge('🔥 IGNITION'); el('combo').textContent = '×0'; el('overlay').classList.add('hidden'); SFX.launch();
}
function combo() {
  if (st.phase !== 'climb') return;
  st.combo += 1; st.altTarget += 7 * (1 + st.combo * 0.05);   // each tool ≈ +7 km (mild accel) — combo-driven, not time
  el('combo').textContent = '×' + st.combo.toLocaleString('en-US'); pop(el('combo'));
  spawnPuff(true); fovKick = Math.min(10, fovKick + 4); shake = 0.7; SFX.combo(st.combo);
}
// invert alt(c) ≈ 7c + 0.175c² → combos a real flight would need for this altitude
function combosFor(altKm) { return Math.round((-7 + Math.sqrt(49 + 0.7 * altKm)) / 0.35); }
function startTransit(kind) {                    // moon/mars: counter ramps to real distance
  st.maxAlt = st.alt; st.ending = kind; st.phase = 'transit';
  st.tr = { from: st.alt, to: kind === 'mars' ? MARS_KM : MOON_KM, t: 0, wy: kind === 'mars' ? MARS_WY : MOON_WY };
  if (st.isDemo) st.comboRamp = { from: st.combo, to: combosFor(st.tr.to) }; // demo: combo counter fills to the real requirement
  toast(kind === 'mars' ? '🔴 Trans-Mars injection...' : '🌙 Trans-lunar injection...');
}
function endTurn() {
  if (st.phase !== 'climb') return;
  st.maxAlt = st.alt;
  // endings keyed to the REAL altitude flown — the counter is in actual km,
  // so reaching the Moon means literally flying the lunar distance
  if (st.maxAlt >= MARS_KM) startTransit('mars');
  else if (st.maxAlt >= MOON_KM) startTransit('moon');
  else {
    st.ending = st.maxAlt >= 35786 ? 'satellite' : 'retro';   // GEO → deploy
    if (st.demoEnding) st.ending = st.demoEnding;             // themed demo override
    if (st.ending === 'satellite') deploySatellites(3);
    else if (st.ending === 'starlink') deploySatellites(6, '📡 Starlink train: 6 satellites away!'); // satellite train
    const seaLanding = st.maxAlt >= 100;        // reached space → droneship downrange; else RTLS
    st.landX = seaLanding ? SHIP_X : 0; st.landY = 2.4;
    if (seaLanding) { droneship.visible = dpad.visible = true; }
    legs.visible = true;
    st.dsc = { t: 0, dur: 7, fromWY: rocket.position.y, fromX: rocket.position.x, site: seaLanding ? 'DRONESHIP' : 'RTLS PAD' };
    st.phase = 'descent'; setBadge('🛬 BOOSTBACK — ' + st.dsc.site);
  }
}
const ENDING = { retro: '🚀 Boostback landing', satellite: '🛰 Satellites deployed + landed', moon: '🌙 Moon landing', mars: '🔴 Mars landing',
  iss: '🛰 Reached ISS altitude + returned', starlink: '📡 Starlink train deployed + returned' };
function beginPlanetLanding(kind) {              // hard cut to the surface scene, then a real powered landing
  const s = SITES[kind];
  rocket.position.set(s.x, s.y + 92, 0);
  camera.position.set(s.x + 6, s.y + 80, 26);
  legs.visible = true; droneship.visible = dpad.visible = false;
  st.planet = kind; st.landX = s.x; st.landY = s.y + 2.4;
  st.dsc = { t: 0, dur: 8, fromWY: s.y + 92, fromX: s.x, site: kind === 'mars' ? 'MARS SURFACE' : 'LUNAR SURFACE' };
  st.phase = 'descent'; setBadge('🛬 LANDING BURN — ' + st.dsc.site);
  toast(kind === 'mars' ? '🔴 Mars orbit insertion' : '🌙 Lunar orbit insertion');
}
function finish() {
  st.phase = 'done'; setBadge('🏁 ' + ENDING[st.ending]); SFX.land();
  if (!st.isDemo)   // demo flights are not recorded
    fetch('/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'landed', glider: 'rocket', distance: Math.round(st.maxAlt) }) });
  showOverlay(Math.round(st.maxAlt), ENDING[st.ending]);
}

function step(dt) {
  if (st.phase === 'pre' || st.phase === 'done') return;
  st.t += dt;
  const fl = rocket.userData.flame;
  if (st.phase === 'climb') {
    st.altTarget += 1.5 * dt;                              // slow baseline drift; combos dominate
    st.alt += (st.altTarget - st.alt) * Math.min(1, dt * 1.8);   // smooth visual climb
    if (Math.random() < 0.6) spawnPuff(false); fl.visible = true;
    rocket.position.y = worldY(st.alt);
  } else if (st.phase === 'transit') {                   // moon/mars: counter ramps to real distance
    const tr = st.tr; tr.t = Math.min(1, tr.t + dt / 4.0); const k = 1 - Math.pow(1 - tr.t, 3);
    st.alt = tr.from + (tr.to - tr.from) * k; st.maxAlt = st.alt; fl.visible = true;
    if (st.comboRamp) { st.combo = Math.round(st.comboRamp.from + (st.comboRamp.to - st.comboRamp.from) * k);
      el('combo').textContent = '×' + st.combo.toLocaleString('en-US'); }
    rocket.position.y += (tr.wy - rocket.position.y) * Math.min(1, dt * 1.5);
    if (Math.random() < 0.8) spawnPuff(false);
    if (tr.t >= 1) beginPlanetLanding(st.ending);      // arrive → powered descent to the surface
  } else if (st.phase === 'descent') {                   // cinematic Falcon boostback + slow touchdown
    const d = st.dsc; d.t = Math.min(1, d.t + dt / d.dur);
    const k = 1 - Math.pow(1 - d.t, 3);                  // ease-out → slows dramatically near the pad
    rocket.position.y = d.fromWY + (st.landY - d.fromWY) * k;
    rocket.position.x = d.fromX + (st.landX - d.fromX) * k;
    st.alt = st.maxAlt * (1 - k);                        // re-entry: altitude counts down
    fl.visible = d.t > 0.5;                              // retro-burn relights for the landing
    if (d.t > 0.6 && Math.random() < 0.85) spawnPuff(false);
    if (d.t >= 1) { touchdownDust(); finish(); }
  }
  if (st.phase !== 'transit' && st.phase !== 'descent') st.maxAlt = Math.max(st.maxAlt, st.alt);
  if (st.phase === 'climb' || st.phase === 'space') rocket.position.x = Math.sin(st.t * 0.6) * 0.4;
  fl.scale.set(1, 0.85 + Math.sin(st.t * 14) * 0.12 + (shake > 0.1 ? 0.5 : 0), 1); // smooth pulse, not per-frame random strobe
  for (const s of sats) { s.position.x += s.userData.vel[0]*dt; s.position.y += s.userData.vel[1]*dt; s.position.z += s.userData.vel[2]*dt; s.rotation.x += dt; s.rotation.y += dt*1.3; }
  // scale balance: the rocket shrinks as it leaves the atmosphere, and Earth
  // shrinks on a log curve of real distance — a marble when seen from the Moon
  rocket.scale.setScalar(Math.max(0.35, 1 / (1 + Math.max(0, st.alt - 150) / 600)));
  const eAlt = st.planet ? st.maxAlt : st.alt;   // on the moon/mars, keep Earth distant
  earthGrp.scale.setScalar(Math.min(1, Math.max(0.1, 1.2 - 0.2 * Math.log10(eAlt + 1))));
  const z = zoneFor(st.alt);
  if (!st.planet) { zoneSky.setHex(z.sky); scene.background.lerp(zoneSky, Math.min(1, dt * 1.5)); } // sky follows zone (space stays dark on moon/mars)
  atmoMat.uniforms.op.value = st.planet ? 0 : Math.max(0, 1 - st.alt / 110);    // no blue atmosphere on the moon/mars
  if (z.name !== lastZone && st.phase !== 'descent') { lastZone = z.name; toast(z.name); }
  el('dist').textContent = fmt(st.alt); el('alt').textContent = st.planet ? st.dsc.site : z.name;
}

function updateCam() {
  fovKick *= 0.9; camera.fov = FOV + fovKick; camera.updateProjectionMatrix();
  const s = shake; shake *= 0.86;
  const back = 15 + Math.min(50, Math.max(0, rocket.position.y * 0.06));
  const lowBlend = Math.min(1, Math.max(0, 1 - (rocket.position.y - (st.landY || 2.4)) / 40)); // near the ground, float the camera up so the terrain reads
  camera.position.lerp(new T.Vector3(rocket.position.x + 5 + (Math.random()-0.5)*s, rocket.position.y - 1 + 8 * lowBlend + (Math.random()-0.5)*s, back + 6 * lowBlend), 0.09);
  camera.lookAt(rocket.position.x, rocket.position.y + 1, 0);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt); updateCam(); updatePuffs(dt);
  earth.rotation.y += dt * 0.02; mars.rotation.y += dt * 0.05; moon.rotation.y += dt * 0.03;
  atmo.position.copy(camera.position);                    // dome always surrounds the camera
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------- UI ----------
function pop(node) { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); }
let toastTimer = null;
function toast(txt) { const t = el('toast'); if (!t) return; t.textContent = txt; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }
async function refreshBoard(highlight) {
  const lb = await (await fetch('/leaderboard')).json();
  el('board').innerHTML = '<b>🚀 TOP 5 ALTITUDE</b>' + (lb.slice(0, 5).map((r, i) =>
    `<div class="row${highlight && r.distance === highlight && i === lb.findIndex(x => x.distance === highlight) ? ' hot' : ''}">${i + 1}. 🚀 ${Number(r.distance).toLocaleString('en-US')} km</div>`).join('') || '<div class="row">No flights yet</div>');
}
function showOverlay(alt, endTxt) {
  el('ovDist').textContent = fmt(alt); el('ovZone').textContent = endTxt;
  if (st.isDemo) { el('ovNew').textContent = '🧪 Demo flight — not recorded'; refreshBoard(); }
  else refreshBoard(alt).then(() => fetch('/leaderboard').then(r => r.json()).then(lb => { const best = Math.max(0, ...lb.map(x => x.distance)); el('ovNew').textContent = alt >= best ? '🎉 New altitude record!' : ''; }));
  el('overlay').classList.remove('hidden');
}
function demo() {
  const post = (b) => fetch('/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  post({ type: 'start', demo: true });
  let n = 0; const iv = setInterval(() => { post({ type: 'combo' }); if (++n >= 10) { clearInterval(iv); setTimeout(() => post({ type: 'end' }), 800); } }, 300);
}
// themed demos — pump combos to the target altitude, then end with that scenario:
// iss/starlink hold their real LEO altitude before re-entry; moon/mars transit out
function runDemo(target) {
  if (!['iss', 'starlink', 'moon', 'mars'].includes(target)) return;  // SSE can carry arbitrary strings
  if (st.phase === 'climb' || st.phase === 'transit' || st.phase === 'descent') return;
  launch();
  st.isDemo = true;
  st.demoEnding = (target === 'iss' || target === 'starlink') ? target : null;
  const stopAlt = target === 'iss' ? 408 : target === 'starlink' ? 550 : 220; // moon/mars: transit from 220 km
  const iv = setInterval(() => {
    if (st.phase !== 'climb') { clearInterval(iv); return; }
    combo();
    if (st.demoEnding && st.altTarget > stopAlt) st.altTarget = stopAlt;  // park exactly at ISS/Starlink altitude
    if (st.alt >= stopAlt - 1) {
      clearInterval(iv);
      if (target === 'moon' || target === 'mars') startTransit(target);
      else endTurn();
    }
  }, 130);
}
document.querySelectorAll('[data-demo]').forEach((b) => { b.onclick = () => runDemo(b.dataset.demo); });

const es = new EventSource('/events');
es.onmessage = (e) => { let ev; try { ev = JSON.parse(e.data); } catch { return; }
  if (ev.type === 'start') { launch(); st.isDemo = !!ev.demo; } else if (ev.type === 'combo') combo(); else if (ev.type === 'end') endTurn();
  else if (ev.type === 'demo' && ev.target) runDemo(ev.target);
  else if (ev.type === 'landed' && ev.leaderboard) refreshBoard(ev.distance); };

el('demoBtn').onclick = demo;
el('againBtn').onclick = () => {
  st.phase = 'pre'; st.planet = null;
  rocket.position.set(0, 2.4, 0); rocket.scale.setScalar(1);
  scene.background.setHex(ZONES[0].sky); atmoMat.uniforms.op.value = 1; earthGrp.scale.setScalar(1); // back home: daylight sky
  setBadge('READY'); el('overlay').classList.add('hidden');
};
refreshBoard(); setBadge('READY');
requestAnimationFrame(loop);
