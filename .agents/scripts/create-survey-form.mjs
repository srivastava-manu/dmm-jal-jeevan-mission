import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const modelSource = await fs.readFile(path.join(root, "dmm-model.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(modelSource, sandbox);
const model = sandbox.window.DMM_MODEL;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const scoreLabels = [
  ["0", "Does not exist"],
  ["1", "Under development"],
  ["2", "Pilot complete"],
  ["3", "Functional at limited scale"],
  ["4", "Fully functional at state scale"],
];
const scoreColors = model.SCORE_COLORS;
const maturityBands = [
  ["0–20%", "Nascent"],
  ["21–40%", "Emerging"],
  ["41–60%", "Developing"],
  ["61–80%", "Mature"],
  ["81–100%", "Leading"],
];

let capabilityNumber = 0;
const layerPages = model.LAYERS.map((layer, layerIndex) => {
  const cards = layer.caps.map((capability) => {
    capabilityNumber += 1;
    const number = capabilityNumber;
    const includes = capability.inc?.length
      ? `<div class="includes"><strong>Includes:</strong> ${capability.inc
          .map(escapeHtml)
          .join(" · ")}</div>`
      : "";
    const scoreBoxes = scoreLabels
      .map(
        ([score, label]) => `
          <div class="score-option">
            <span class="box"></span>
            <span class="score-number">${score}</span>
            <span class="score-label">${escapeHtml(label)}</span>
          </div>`,
      )
      .join("");
    return `
      <section class="capability-card">
        <div class="capability-heading">
          <span class="capability-number">${number}</span>
          <h3>${escapeHtml(capability.n)}</h3>
        </div>
        <p class="measure">${escapeHtml(capability.m)}</p>
        ${includes}
        <div class="score-row">${scoreBoxes}</div>
        <div class="notes-label">Evidence / notes</div>
        <div class="writing-lines"><span></span><span></span></div>
      </section>`;
  });

  const pages = [];
  for (let start = 0; start < cards.length; start += 3) {
    const chunk = cards.slice(start, start + 3).join("");
    const continuation = start > 0 ? " · continued" : "";
    const isLastPage = start + 3 >= cards.length;
    const subtotal = isLastPage
      ? `
        <div class="layer-subtotal">
          <span><strong>Layer ${layerIndex + 1} subtotal — ${escapeHtml(layer.name)}</strong><br><small>Sum of ${layer.caps.length} ratings</small></span>
          <span class="subtotal-entry">Score: ______ / ${layer.caps.length * 4}</span>
        </div>`
      : "";
    pages.push(`
      <div class="layer-section">
        <div class="layer-heading">
          <div class="layer-index">${layerIndex + 1}</div>
          <div>
            <div class="eyebrow">Layer ${layerIndex + 1} · ${layer.caps.length} capabilities${continuation}</div>
            <h2>${escapeHtml(layer.name)}</h2>
            <p>${escapeHtml(layer.covers)}</p>
          </div>
        </div>
        <div class="capability-list">${chunk}</div>
        ${subtotal}
      </div>`);
  }
  return pages.join("");
}).join("");

const scaleRows = model.SCALE.map(
  (item) => `
    <tr style="background:${scoreColors[item.n].bg};color:${scoreColors[item.n].fg}">
      <td class="scale-number">${item.n}</td>
      <td><strong>${escapeHtml(item.t)}</strong><br><span>${escapeHtml(item.d)}</span></td>
    </tr>`,
).join("");

const maturityBandRows = maturityBands
  .map(
    ([range, name], index) => `
      <tr style="background:${scoreColors[index].bg};color:${scoreColors[index].fg}">
        <td>${range}</td><td>${name}</td>
      </tr>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Jal Jeevan Mission Digital Maturity Model v${escapeHtml(model.MODEL_VERSION.replace(/^v/, ""))} Survey Form</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 16mm; }
    :root {
      --ink: #1d2933;
      --muted: #65727d;
      --line: #d8e0e5;
      --soft: #f3f7f8;
      --accent: #147d62;
      --accent-soft: #e6f2ee;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.38;
      background: white;
    }
    .cover, .layer-section, .summary-page { break-after: page; }
    .cover { min-height: 260mm; display: flex; flex-direction: column; }
    .brand-line { height: 7px; background: var(--accent); margin: -16mm -14mm 22mm; }
    .kicker, .eyebrow {
      color: var(--accent);
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    h1 { font-size: 27pt; line-height: 1.05; margin: 7mm 0 3mm; letter-spacing: -.02em; }
    h2 { font-size: 19pt; margin: 1mm 0 1mm; letter-spacing: -.01em; }
    h3 { font-size: 11.5pt; margin: 0; line-height: 1.2; }
    p { margin: 0; }
    .subtitle { font-size: 12pt; color: var(--muted); max-width: 145mm; }
    .version-pill {
      display: inline-block; margin-top: 7mm; padding: 2mm 3.5mm;
      border-radius: 99px; background: var(--accent-soft); color: var(--accent);
      font-size: 9pt; font-weight: 700;
    }
    .form-meta { margin-top: 17mm; border: 1px solid var(--line); border-radius: 4mm; padding: 6mm; }
    .form-meta h2 { font-size: 13pt; margin-bottom: 5mm; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm 9mm; }
    .field { display: flex; align-items: end; gap: 3mm; min-height: 9mm; }
    .field label { font-size: 9pt; font-weight: 700; white-space: nowrap; }
    .field .blank { height: 6mm; flex: 1; border-bottom: 1px solid #8997a0; }
    .instructions { margin-top: 12mm; }
    .instructions h2 { font-size: 14pt; margin-bottom: 3mm; }
    .instructions ol { margin: 0 0 6mm 5mm; padding-left: 5mm; }
    .instructions li { margin: 2mm 0; }
    .scale-table { width: 100%; display: grid; margin-top: 4mm; font-size: 8.2pt; }
    .scale-table tbody { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 5mm; }
    .scale-table tr { display: grid; grid-template-columns: 9mm 1fr; border: 1px solid var(--line); border-radius: 2mm; }
    .scale-table td { border: 0; padding: 2mm 1.5mm; vertical-align: top; }
    .scale-number { width: 10mm; color: var(--accent); font-size: 13pt; font-weight: 700; text-align: center; }
    .scale-table span { color: currentColor; opacity: .86; }
    .scale-number { color: currentColor; }
    .cover-foot { margin-top: auto; padding-top: 10mm; color: var(--muted); font-size: 8.5pt; }
    .layer-section { break-after: page; }
    .layer-heading {
      display: flex; gap: 5mm; align-items: flex-start;
      padding-bottom: 5mm; border-bottom: 2px solid var(--accent); margin-bottom: 5mm;
    }
    .layer-index {
      display: grid; place-items: center; flex: 0 0 12mm; height: 12mm;
      border-radius: 50%; background: var(--accent); color: white;
      font-size: 15pt; font-weight: 700;
    }
    .layer-heading p { color: var(--muted); font-size: 9.5pt; }
    .capability-list { display: grid; gap: 5mm; }
    .capability-card {
      break-inside: avoid; border: 1px solid var(--line); border-radius: 3mm;
      padding: 4mm 4.5mm 3.5mm; background: #fff;
    }
    .capability-heading { display: flex; align-items: center; gap: 3mm; }
    .capability-number {
      display: grid; place-items: center; width: 7mm; height: 7mm; flex: 0 0 7mm;
      border-radius: 50%; background: var(--accent-soft); color: var(--accent);
      font-size: 8.5pt; font-weight: 700;
    }
    .measure { margin: 2.5mm 0 1.5mm 10mm; color: #3e4d57; font-size: 9pt; }
    .includes { margin: 0 0 3mm 10mm; color: var(--muted); font-size: 8pt; }
    .includes strong { color: #52616b; }
    .score-row {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm;
      margin-top: 3mm; padding: 2.5mm; background: var(--soft); border-radius: 2mm;
    }
    .score-option { display: grid; grid-template-columns: 5mm 4mm 1fr; align-items: center; gap: 1.5mm; min-width: 0; }
    .box { width: 4mm; height: 4mm; border: 1px solid #63737d; background: white; }
    .score-number { font-weight: 700; color: var(--accent); }
    .score-label { color: #4e5c65; font-size: 7.2pt; line-height: 1.1; }
    .notes-label { margin-top: 3mm; color: var(--muted); font-size: 8pt; font-weight: 700; }
    .writing-lines { display: grid; gap: 3mm; margin-top: 2mm; }
    .writing-lines span { height: 4mm; border-bottom: 1px solid #c5cfd4; }
    .layer-subtotal {
      display: flex; justify-content: space-between; align-items: center; gap: 8mm;
      margin-top: 4mm; padding: 3mm 4mm; border: 1px solid var(--accent);
      border-radius: 2mm; background: var(--accent-soft); color: var(--ink);
    }
    .layer-subtotal small { color: var(--muted); font-size: 8pt; }
    .subtotal-entry { font-family: "Courier New", monospace; font-size: 10pt; font-weight: 700; white-space: nowrap; }
    .summary-page { min-height: 260mm; }
    .summary-title { padding-bottom: 4mm; border-bottom: 2px solid var(--accent); margin-bottom: 5mm; }
    .summary-title h2 { font-size: 22pt; }
    .summary-title p { color: var(--muted); }
    .summary-table { width: 100%; border-collapse: collapse; margin-top: 5mm; font-size: 9.5pt; }
    .summary-table th, .summary-table td { border-bottom: 1px solid var(--line); padding: 3mm 2mm; text-align: left; }
    .summary-table th { color: var(--muted); font-size: 8pt; letter-spacing: .05em; text-transform: uppercase; }
    .summary-table th:nth-child(n+2), .summary-table td:nth-child(n+2) { text-align: right; }
    .summary-table .summary-total td { border-top: 2px solid var(--accent); border-bottom: 0; font-weight: 700; padding-top: 4mm; }
    .summary-blank { display: inline-block; min-width: 28mm; border-bottom: 1px solid #71808a; height: 5mm; vertical-align: bottom; }
    .summary-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 10mm; }
    .summary-panel { border: 1px solid var(--line); border-radius: 3mm; padding: 4mm; }
    .summary-panel h3 { margin-bottom: 3mm; font-size: 11pt; }
    .band-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    .band-table td { padding: 2mm 1mm; border-top: 1px solid var(--line); }
    .band-table td:first-child { color: currentColor; font-family: "Courier New", monospace; font-weight: 700; width: 35%; }
    .summary-notes { margin-top: 10mm; }
    .summary-notes h3 { margin-bottom: 4mm; }
    .summary-note-line { height: 9mm; border-bottom: 1px solid #c5cfd4; }
  </style>
</head>
<body>
  <main class="cover">
    <div class="brand-line"></div>
    <div class="kicker">Jal Jeevan Mission</div>
    <h1>Digital Maturity<br>Model Survey Form</h1>
    <p class="subtitle">A printable assessment form for reviewing digital capability across rural drinking water services.</p>
    <div class="version-pill">Current model ${escapeHtml(model.MODEL_VERSION)} · ${capabilityNumber} capabilities · 6 layers · 0–4 scale</div>

    <section class="form-meta">
      <h2>Assessment details</h2>
      <div class="meta-grid">
        <div class="field"><label>State / UT</label><span class="blank"></span></div>
        <div class="field"><label>Assessment date</label><span class="blank"></span></div>
        <div class="field"><label>Assessor name</label><span class="blank"></span></div>
        <div class="field"><label>Designation</label><span class="blank"></span></div>
        <div class="field"><label>Department / agency</label><span class="blank"></span></div>
        <div class="field"><label>Review round</label><span class="blank"></span></div>
      </div>
    </section>

    <section class="instructions">
      <h2>How to complete this form</h2>
      <ol>
        <li>Read each capability question and select one maturity score from 0 to 4.</li>
        <li>Base the score on what is in routine use at the State/UT scale, not only on a sanctioned plan or pilot.</li>
        <li>Use the evidence / notes area to record the system name, coverage, source, or actions needed.</li>
        <li>Answer every capability. The complete assessment contains ${capabilityNumber} responses and has a maximum score of 144.</li>
      </ol>
      <table class="scale-table">
        <tbody>${scaleRows}</tbody>
      </table>
    </section>
    <p class="cover-foot">This form mirrors the published v2.3 assessment model. For the digital workflow, use the Jal Jeevan Mission Digital Maturity Model application.</p>
  </main>
  ${layerPages}
  <section class="summary-page">
    <div class="summary-title">
      <div class="eyebrow">Score sheet · ${escapeHtml(model.MODEL_VERSION)}</div>
      <h2>Assessment summary</h2>
      <p>Carry each layer subtotal here, total them, then read the maturity index below.</p>
    </div>
    <table class="summary-table">
      <thead>
        <tr><th>Layer</th><th>Subtotal</th><th>Maximum</th></tr>
      </thead>
      <tbody>
        ${model.LAYERS.map((layer, index) => `
          <tr>
            <td>${index + 1}. ${escapeHtml(layer.name)}</td>
            <td><span class="summary-blank"></span></td>
            <td>${layer.caps.length * 4}</td>
          </tr>`).join("")}
        <tr class="summary-total">
          <td>Total</td>
          <td><span class="summary-blank"></span></td>
          <td>${capabilityNumber * 4}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-panels">
      <div class="summary-panel">
        <h3>Overall maturity index</h3>
        <p>Total ÷ ${capabilityNumber * 4} × 100 = <span class="summary-blank"></span> %</p>
        <table class="band-table">
          <tbody>${maturityBandRows}</tbody>
        </table>
      </div>
      <div class="summary-panel">
        <h3>Layer maturity index</h3>
        <p>Read each layer subtotal out of its maximum above.</p>
        <table class="band-table">
          <tbody>${maturityBandRows}</tbody>
        </table>
      </div>
    </div>

    <div class="summary-notes">
      <h3>Notes · evidence · systems referenced</h3>
      <div class="summary-note-line"></div>
      <div class="summary-note-line"></div>
      <div class="summary-note-line"></div>
      <div class="summary-note-line"></div>
      <div class="summary-note-line"></div>
    </div>
  </section>
</body>
</html>`;

const outputDir = path.join(root, "deliverables");
await fs.mkdir(outputDir, { recursive: true });
const htmlPath = path.join(outputDir, "DMM-v2.3-Survey-Form.html");
await fs.writeFile(htmlPath, html.replace(/[ \t]+$/gm, ""), "utf8");
console.log(`Wrote ${path.relative(root, htmlPath)} — ${capabilityNumber} capabilities`);