// Web Audio SFX — zero deps. Lazily creates context, resumes on user gesture.
window.SFX = (function () {
  let ctx;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  addEventListener('pointerdown', ac);
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, t, a, d, peak, type) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    o.connect(g); g.connect(c.destination); env(g, t, a, d, peak);
    o.start(t); o.stop(t + a + d + 0.05);
  }
  return {
    launch() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const n = c.createBufferSource();
      const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.3;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.4);
      const g = c.createGain(); env(g, t, 0.05, 0.35, 0.22);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.5);
    },
    combo(nn) { const c = ac(); if (!c) return; tone(520 + Math.min(20, nn || 0) * 42, c.currentTime, 0.005, 0.12, 0.16, 'triangle'); },
    land() { const c = ac(); if (!c) return; const t = c.currentTime; tone(660, t, 0.01, 0.26, 0.15, 'sine'); tone(990, t + 0.09, 0.01, 0.3, 0.11, 'sine'); },
  };
})();
