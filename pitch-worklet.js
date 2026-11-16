// Band-Trainer – Tonhöhe des Playbacks verschieben (v1.6.0), läuft als AudioWorklet im Audio-Thread.
// Verfahren: zwei Lesepositionen in einem Ringpuffer, deren Verzögerung sägezahnförmig wandert (Granular-/Delay-Line-Pitch-Shifter),
// mit Hann-Überblendung um eine halbe Fensterlänge versetzt. Einfach und latenzarm; Klang für Übezwecke gut, nicht Studioqualität.
// Tempo bleibt unverändert (das regelt das Audio-Element mit preservesPitch). ratio = 2^(Halbtöne/12); bei ratio 1 wird durchgereicht.
class PitchShifter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const r0 = Number(options && options.processorOptions && options.processorOptions.ratio);
    this.ratio = r0 > 0.25 && r0 < 4 ? r0 : 1;
    this.win = Math.round(sampleRate * 0.07);          // Fensterlänge ~70 ms
    this.size = 1 << 15;                               // Ringpuffer (≈0.7 s bei 44.1 kHz) – grösser als ein Fenster
    this.buf = [new Float32Array(this.size), new Float32Array(this.size)];
    this.w = 0; this.phase = 0;
    this.port.onmessage = e => { const r = Number(e.data && e.data.ratio); if (r > 0.25 && r < 4) this.ratio = r; };
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0]; if (!out || !out.length) return true;
    const n = out[0].length, chs = out.length;
    if (!inp || !inp.length) { for (const o of out) o.fill(0); return true; }
    if (this.ratio === 1) { for (let c = 0; c < chs; c++) out[c].set(inp[Math.min(c, inp.length - 1)]); return true; }
    const W = this.win, S = this.size, mask = S - 1, step = (1 - this.ratio) / W;   // Verzögerung ändert sich pro Sample um (1 - ratio)
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < Math.min(chs, 2); c++) this.buf[c][this.w] = inp[Math.min(c, inp.length - 1)][i];
      // Phase 0..1 → Verzögerung d1 = phase·W, d2 um eine halbe Phase versetzt; Hann-Gewichte summieren sich zu 1
      let p1 = this.phase, p2 = p1 + 0.5; if (p2 >= 1) p2 -= 1;
      const g1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * p1), g2 = 1 - g1;
      const r1 = this.w - p1 * W - 2, r2 = this.w - p2 * W - 2;
      for (let c = 0; c < chs; c++) {
        const b = this.buf[Math.min(c, 1)];
        const i1 = Math.floor(r1), f1 = r1 - i1, i2 = Math.floor(r2), f2 = r2 - i2;
        const s1 = b[i1 & mask] * (1 - f1) + b[(i1 + 1) & mask] * f1, s2 = b[i2 & mask] * (1 - f2) + b[(i2 + 1) & mask] * f2;
        out[c][i] = s1 * g1 + s2 * g2;
      }
      this.w = (this.w + 1) & mask;
      this.phase += step; if (this.phase >= 1) this.phase -= 1; else if (this.phase < 0) this.phase += 1;
    }
    return true;
  }
}
registerProcessor('pitch-shifter', PitchShifter);
