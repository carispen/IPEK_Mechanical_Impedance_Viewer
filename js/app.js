// ============================================================================
// Chart handling and visualization
// ============================================================================

// Show the selected chart and hide the other charts in the same chart group
function switchChart(group, canvasId, btn = null) {

    if (btn) {
        btn.parentElement
            .querySelectorAll("button")
            .forEach(b => {
                b.classList.remove("active");
                b.setAttribute("aria-selected", "false");
            });

        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
    }

    const selector = ".top-chart";

    document.querySelectorAll(selector)
        .forEach(c => c.classList.remove("active"));

    document.getElementById(canvasId)
        .classList.add("active");

    // VPA has no phase
    document.querySelectorAll(".phase-block")
        .forEach(el => el.hidden = canvasId === "chartVPA");
    // ...but shows the excitation acceleration it is computed from
    document.querySelectorAll(".ajw-block")
        .forEach(el => el.hidden = canvasId !== "chartVPA");
}

// Model file per excitation direction (one MATLAB globalModel each): the force-dependent
// mass, damping and stiffness coefficient matrices m, d and k
const MODEL_FILES = {
    translatorischX: "data/model_TX.json",
    translatorischY: "data/model_TY.json",
    translatorischZ: "data/model_TZ.json",
    rotatorischX: "data/model_RX.json",
    rotatorischY: "data/model_RY.json",
    rotatorischZ: "data/model_RZ.json"
};

// Build the regression vector used by the force-dependent model:
// [1, Fg, Fp, Fg * Fp]
function buildX( Fg, Fp){

    return[
        1,
        Fg,
        Fp,
        Fg * Fp
    ];
}

// Load the model coefficient matrices { m, d, k } for an excitation direction
function loadBetas(dir) {
    return loadJson(MODEL_FILES[dir]);
}

function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// Anthropometric fields shown in the side card (ids in index.html, keys in data/subjects.json)
const ANTHRO_FIELDS = ["age", "handWeight", "bodyWeight", "bodyHeight", "FrontReach", "ElbowToWristLength",
    "thumbLength", "handLength", "palmLength", "palmWidth", "forearmCircumference", "armCircumference"];

// Extract anthropometric information (from data/subjects.json) and the available force limits
// (from the measurement rows) for the selected subject, or for all subjects of the rows.
// "All Subjects" is the mean over the subjects measured in this direction, each weighted equally.
function extractSubjectMeta(resultsMatrix, selectedSubject) {
    if (!resultsMatrix || resultsMatrix.length === 0) return null;

    const people = subjectsOf(resultsMatrix).map(s => subjectData[s]).filter(Boolean);
    const genderText = selectedSubject === "ALL" ? "mixed"
        : { 1: "male", 2: "female" }[people[0]?.gender] ?? "unknown";

    const meta = {
        gender: genderText,
        maxFg: Math.max(...resultsMatrix.map(x => num(x.MaxGripForce)).filter(Number.isFinite)),
        maxFp: Math.max(...resultsMatrix.map(x => num(x.MaxPushForce)).filter(Number.isFinite))
    };
    // A subject missing from subjects.json shows "–" instead of a made-up value
    ANTHRO_FIELDS.forEach(f => meta[f] = people.length ? math.mean(people.map(p => num(p[f]))) : "–");
    return meta;
}

function subjectsOf(rows) {
    return [...new Set(rows.map(r => r.SubjectNumber).filter(Number.isFinite))].sort((a, b) => a - b);
}

const subjectLabel = s => s === "ALL" ? "All Subjects" : `Subject Number ${s}`;

function getScalar(v) {
    return Array.isArray(v) ? v[0] : v;
}

// Return all unique numeric force values available in the selected data
function getUnionRange(matrix, field) {
    return [...new Set(
        matrix
            .filter(r => r?.[field] != null)
            .map(r => getScalar(r[field]))
    )].sort((a, b) => a - b);
}

// Determine the available push-force and grip-force values for a data set
function computeForceRangesForProband(resultsMatrix, isModChart = false) { //
    if (!resultsMatrix || resultsMatrix.length === 0) {
        return { rangeFp: [], rangeFg: [] };
    }

    const rangeFp = getUnionRange(resultsMatrix, "TargetPushForce").filter(Number.isFinite);
    const rangeFg = getUnionRange(resultsMatrix, "TargetGripForce").filter(Number.isFinite);

    return { rangeFp, rangeFg };
}

// Six equally spaced tick labels for a force slider
function sliderTicks(min, max, n = 6) {
    return Array.from({ length: n }, (_, i) => Math.round(min + i * (max - min) / (n - 1)));
}

// Update the model illustrations to match the selected excitation type
function updateModelImage(excitation) {
    const img = document.getElementById("modelImage");
    const imgSym = document.getElementById("modelImageSym");

    if (excitation.startsWith("translatorisch")) {
        // Use the translational model illustrations
        img.src = "Viermassenschwinger.png";
        imgSym.src = "symbole_transl.png";
    } else if (excitation.startsWith("rotatorisch")) {
        // Use the rotational model illustrations
        img.src = "Viermassenschwinger_rotat.png";
        imgSym.src = "symbole_rotat.png";
    }

}

// Initialize the application: one curve per view, computed from the default
// conditions, then attach the resize observers.
async function initializeApp() {
    Object.keys(plots).forEach(group => {
        initPlotOptions(group);
        const c = newCurve(group);
        c.open = true;
        plots[group].curves.push(c);
        plots[group].active = c;
        renderCurveList(group);
    });
    await Promise.all(Object.keys(plots).map(g => computeCurve(g, plots[g].curves[0], true)));
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            renderAllCharts();
            ["chartMI","chartPhase","chartVPA","chartAjw"].forEach(observeChartContainer);
        });
    });
}
