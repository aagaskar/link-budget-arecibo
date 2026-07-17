# Interstellar link budget — Arecibo vs. *Project Hail Mary*

Could a ship parked at Tau Ceti have radioed its science home to Earth, instead of
sending it back on physical storage? This repo explores that question two ways:

| Path | What it is |
|---|---|
| [`notebook/`](notebook/) | The original Python notebook: a link budget for an Arecibo-to-Arecibo link over 10 light years, including a Planck's-law analysis showing the host star's radio noise is negligible. Verdict: ~1.1 kbps — and it scales with dish diameter squared, so a ship-sized antenna gets almost nothing. |
| [`simulator/`](simulator/) | An interactive TypeScript simulator built on the same physics. An Arecibo-sized dish on Earth listens to a transmitter at a nearby star; you control the transmitter's dish size, power, pointing error and more, and watch the geometry, the dB ledger, and the achievable data rate respond. |

![Simulator screenshot](simulator/docs/screenshot-light.png)

## Running the simulator

```bash
cd simulator
npm install
npm run dev      # local dev server
npm test         # physics unit tests (validated against the notebook)
npm run build    # static build in dist/
```

The simulator's "Notebook baseline" preset reproduces the notebook's numbers
exactly (74 dBi gains, −379.5 dB path loss, ~1.1 kbps at 10 ly); the Tau Ceti /
40 Eridani presets re-ask the question for the stars in *Project Hail Mary*.
See [`simulator/README.md`](simulator/README.md) for the physics and model notes.
