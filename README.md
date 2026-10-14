# IPEK Impedance Viewer

Static web page showing the mechanical impedance of the human hand–arm system (based on ISO 10068), measured in a subject study and computed with a four-mass oscillator model, under varying grip force (Fg) and push force (Fp). Published via GitHub Pages; there is no build step and no server code.

## Views

The page has two views, switched by the URL hash (`#intro`, `#measured`):

- **Introduction**: terminology and background.
- **Impedance data**: impedance magnitude |Zₕ|, phase ∠Zₕ and vibration power absorption (VPA). Each curve has a type: **Measurement** (subject study, per subject or averaged over all subjects) or **Model** (four-mass oscillator), so measured and model curves can share one plot. The side cards follow the highlighted curve: anthropometric data for a measured curve, model parameters (m, d, k) and model illustration for a model curve. The model gives no VPA.

Every curve has its own type, excitation direction (translational or rotational x/y/z), subject (measured only), forces and line style. Charts can be downloaded as PNG files.

## Files

```
index.html        Markup only: layout, views, curve-card <template>, script tags
style.css         All styling, including light/dark theme tokens
js/               Application code (see below)
data/             Measurement results, model coefficient matrices and subject data (JSON)
tools/            Data conversion scripts (not published)
*.png             Model illustrations, symbols and logos
```

### JavaScript

The code is split into plain scripts (no modules, no bundler). They share one global scope and load with `defer` in this order:

| File | Purpose |
|---|---|
| `js/state.js` | Global state (`charts`, `plots`), data file URLs (`dirFiles`), chart definitions (`CHART_DEFS`), JSON loading with caching |
| `js/app.js` | Chart tab switching, model coefficient files (`MODEL_FILES`), regression vector `buildX`, subject/force-range helpers, model images, `initializeApp` |
| `js/curves.js` | Curve cards: create, remove, toggle, recompute and render the curve list, plot options, side cards, and the `DOMContentLoaded` entry point |
| `js/charts.js` | Chart redraws and resizing, frequency arrays, interpolation of measured data for arbitrary Fg/Fp (`selectMat`), Chart.js datasets and options |
| `js/model.js` | Four-mass oscillator: force-dependent m/d/k parameters, complex linear solve, impedance over frequency |
| `js/shell.js` | Page shell: views, theme toggle, status line, chart PNG export, `initShell` |

The order only matters for top-level code. Startup runs from `DOMContentLoaded` in `curves.js`, which fires after all scripts have loaded, so functions can call into any file. The inline `onclick` handlers in `index.html` rely on functions being global, so don't switch to `type="module"` without also replacing them.

A small inline script in `<head>` applies the stored theme and sidebar state before the first paint. It stays inline on purpose: as an external file it would cause a visible flash.

### External libraries (CDN)

- [Chart.js](https://www.chartjs.org/) 4.5.0 for charts
- [math.js](https://mathjs.org/) 11 for matrix maths and means

## Data source

All data is loaded from the relative path `data/...` (`dirFiles` in `js/state.js`, `MODEL_FILES` in `js/app.js`). GitHub Pages serves it together with the page, so the data always matches the deployed code, and changes to `data/` take effect locally as soon as the page is reloaded. GitHub Pages compresses `.json` in transit, so the files are stored uncompressed. The `resultsMatrix_TX.json.gz` and `resultsMatrix_RX.json.gz` files contain the same data as the `.json` files and are no longer used.

### Model data

Each excitation direction has one model file, `data/model_TX.json` … `data/model_RZ.json`, matching one MATLAB `globalModel` of the four-mass oscillator. It holds the coefficient matrices for mass `m`, damping `d` and stiffness `k`, each 4×4: one row per mass, one column per term of the regression vector `[1, Fg, Fp, Fg·Fp]` (`buildX` in `js/app.js`). For rotational directions `m` is the moment of inertia J.

```json
{ "m": [[...], [...], [...], [...]], "d": [...], "k": [...] }
```

### Subject data

The anthropometric data of all subjects (sex, age, body and hand measures) lives in `data/subjects.json`, keyed by `SubjectNumber`, which links each subject to its rows in the `resultsMatrix_*.json` files. It is generated from the subject overview workbook (`260417_Probandenübersicht.xlsx`), the authoritative source for this data:

```
python tools/subjects_to_json.py [workbook.xlsx]
```

The script copies the values unchanged and stops if the workbook's columns were moved or renamed. Regenerate the file after every change to the workbook. The `resultsMatrix_*.json` files still contain older anthropometric columns, which the page ignores; where they differ from the workbook, the workbook is correct. Max push and grip forces are per measurement and still come from the `resultsMatrix_*.json` rows.

### Data integrity

**The files in `data/` are real measurement results. They must never be modified, cleaned, rounded, snapped or "corrected"**, not even where values look inconsistent (for example, the target forces in TZ are 30/32, 54/55, 75/76 and 98/100 N). Any averaging, interpolation or other processing happens in the viewer code at display time; the stored data stays exactly as measured.

## Running locally

`fetch()` does not work from `file://`, so serve the folder:

```
python -m http.server
```

Then open http://localhost:8000.

## Deploying

Push to `main`. The workflow `.github/workflows/deploy.yml` copies `index.html`, `style.css`, `*.png`, `js/` and `data/*.json` into the published site; files not listed there (PDFs, MATLAB scripts, `.gz` files, the workbook, `tools/`) are not published. When adding a new file type the page needs, add it to that workflow.
