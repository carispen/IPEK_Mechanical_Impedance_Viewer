// ============================================================================
// Application state and data sources
// ============================================================================

// Chart.js instances keyed by canvas id
const charts = {};
// Data folder per excitation direction: data/<code>/index.json lists the subjects,
// data/<code>/S<nn>.json holds the measurements of one subject (tools/exportResultsJson.m)
const DIR_CODES = {
    translatorischX: "TX",
    translatorischY: "TY",
    translatorischZ: "TZ",
    rotatorischX: "RX",
    rotatorischY: "RY",
    rotatorischZ: "RZ"
};
// Anthropometric data of all subjects keyed by SubjectNumber (generated from the subject
// overview workbook by tools/subjects_to_json.py); filled on first load in computeCurve
const SUBJECTS_URL = "data/subjects.json";
let subjectData = {};

const DIR_LABELS = {
    translatorischZ: "translational zₕ",
    translatorischY: "translational yₕ",
    translatorischX: "translational xₕ",
    rotatorischZ: "rotational zₕ",
    rotatorischY: "rotational yₕ",
    rotatorischX: "rotational xₕ"
};

// Curves of the data view. Every curve carries its own conditions (incl. type: measured or model),
// style and computed data; "active" is the curve last worked on, which the side cards describe.
const plot = { curves: [], active: null, next: 0, opts: { legend: "top", xScale: "logarithmic", grid: true } };

// Chart definitions: canvas, data field of the rows (abs = magnitude of the measured values) and axis labels
const CHART_DEFS = [
    { id: "chartMI",    field: "MI",    abs: true,  min: 0,  axis: "|Zₕ| in Ns/m", prefix: "Zₕ" },
    { id: "chartPhase", field: "Phase", abs: false, min: -1, axis: "∠Zₕ in rad",   prefix: "∠Zₕ" },
    { id: "chartVPA",   field: "VPA",   abs: true,  min: 0,  axis: "VPA in W",     prefix: "VPA" },
    { id: "chartAjw",   field: "ajw",   abs: false, min: 0,  axis: "|a| in m/s²",  prefix: "|a|" }
];

const MARKERS = ["circle", "triangle", "rect", "rectRot", "crossRot", "star"];
const DASHES = { solid: [], dashed: [6, 4], dotted: [2, 3] };

// ============================================================================
// Data loading and preprocessing
// ============================================================================

// Keep loaded files in memory; switching between curves of different directions reuses them.
// `prepare` converts the file once, so the cache holds the converted data.
const jsonCache = {};
function loadJson(url, prepare = data => data) {
    return jsonCache[url] ??= fetchJson(url).then(prepare).catch(err => {
        delete jsonCache[url];
        throw err;
    });
}

// Subject numbers measured in a direction
async function loadSubjectList(dir) {
    return (await loadJson(`data/${DIR_CODES[dir]}/index.json`)).subjects;
}

// Measurement rows of the given subjects of a direction (files load in parallel)
async function loadRows(dir, subjects) {
    const files = subjects.map(s =>
        loadJson(`data/${DIR_CODES[dir]}/S${String(s).padStart(2, "0")}.json`, subjectRowsOf));
    return (await Promise.all(files)).flat();
}

// Rows of one subject file with the values the charts use, computed from the raw complex data:
// MI = |MI|, Phase = angle(MI) (atan2 as MATLAB angle), and the squared excitation velocity
// v2 = |ajw / (jω)|² = |ajw|² / ω² for the model VPA (as in plotMIVPAResultsMatrix_Fp_glModel.m).
// The raw arrays are not kept, so a large direction does not sit in memory twice.
function subjectRowsOf(file) {
    const w = file.freq.map(f => 2 * Math.PI * f);
    return file.rows.map(({ MIre, MIim, ajwRe, ajwIm, ...r }) => ({
        ...r,
        SubjectNumber: file.SubjectNumber,
        freq: file.freq,
        MI: MIre.map((re, i) => Math.hypot(re, MIim[i])),
        Phase: MIre.map((re, i) => Math.atan2(MIim[i], re)),
        ajw: ajwRe.map((re, i) => Math.hypot(re, ajwIm[i])),
        v2: ajwRe.map((re, i) => (re * re + ajwIm[i] * ajwIm[i]) / (w[i] * w[i]))
    }));
}

// Load a JSON data file. "no-cache" revalidates with the server, so changed data shows up
// right away; GitHub Pages compresses the transfer itself.
async function fetchJson(url) {
    const response = await fetch(url, {
        cache: "no-cache"
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
}
