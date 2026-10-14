// ============================================================================
// Application state and data sources
// ============================================================================

const charts = {
    chart1: null,
    chart2: null,
    chart3: null
};
const dirFiles = {
    translatorischY: "data/resultsMatrix_TY.json",
    translatorischZ: "data/resultsMatrix_TZ.json",
    translatorischX: "data/resultsMatrix_TX.json",
    rotatorischX: "data/resultsMatrix_RX.json",
    rotatorischY: "data/resultsMatrix_RY.json",
    rotatorischZ: "data/resultsMatrix_RZ.json"
};
const DIR_LABELS = {
    translatorischZ: "translational zₕ",
    translatorischY: "translational yₕ",
    translatorischX: "translational xₕ",
    rotatorischZ: "rotational zₕ",
    rotatorischY: "rotational yₕ",
    rotatorischX: "rotational xₕ"
};

// Curves per view. Every curve carries its own conditions (incl. type: measured or model),
// style and computed data; "active" is the curve last worked on, which the side cards describe.
const plots = {
    measured: { curves: [], active: null, next: 0, opts: { legend: "top", xScale: "logarithmic", grid: true } }
};

// Chart definitions: canvas, owning view and axis labels
const CHART_DEFS = [
    { key: "chart1", id: "chartMI",        group: "measured", min: 0,  axis: "|Zₕ| in Ns/m",  prefix: "Zₕ" },
    { key: "chart2", id: "chartPhase",     group: "measured", min: -1, axis: "∠Zₕ in rad", prefix: "∠Zₕ" },
    { key: "chart3", id: "chartVPA",       group: "measured", min: 0,  axis: "VPA in W",          prefix: "VPA" }
];

const MARKERS = ["circle", "triangle", "rect", "rectRot", "crossRot", "star"];
const DASHES = { solid: [], dashed: [6, 4], dotted: [2, 3] };

// ============================================================================
// Data loading and preprocessing
// ============================================================================

// Cache frequency arrays to avoid rebuilding identical frequency vectors
const frequencyCache = {};

// Keep loaded files in memory; switching between curves of different directions reuses them
const jsonCache = {};
function loadJson(url) {
    return jsonCache[url] ??= fetchJson(url).catch(err => {
        delete jsonCache[url];
        throw err;
    });
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
