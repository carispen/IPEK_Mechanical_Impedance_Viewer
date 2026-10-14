// ============================================================================
// Chart handling and visualization
// ============================================================================

// Show the selected upper chart and mark its tab button
function switchChart(canvasId, btn) {
    btn.parentElement
        .querySelectorAll("button")
        .forEach(b => {
            b.classList.toggle("active", b === btn);
            b.setAttribute("aria-selected", b === btn);
        });

    document.querySelectorAll(".top-chart")
        .forEach(c => c.classList.toggle("active", c.id === canvasId));

    // VPA has no phase
    document.querySelectorAll(".phase-block")
        .forEach(el => el.hidden = canvasId === "chartVPA");
    // ...but shows the excitation acceleration it is computed from
    document.querySelectorAll(".ajw-block")
        .forEach(el => el.hidden = canvasId !== "chartVPA");
}

function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// Anthropometric fields shown in the side card (keys in data/subjects.json) with their labels
const ANTHRO_FIELDS = {
    age: "Age [years]",
    handWeight: "Hand weight [g]",
    bodyWeight: "Body weight [kg]",
    bodyHeight: "Body height [mm]",
    FrontReach: "Front reach [mm]",
    ElbowToWristLength: "Elbow to wrist length [mm]",
    thumbLength: "Thumb length [mm]",
    handLength: "Hand length [mm]",
    palmLength: "Palm length [mm]",
    palmWidth: "Palm width [mm]",
    forearmCircumference: "Forearm circumference [mm]",
    armCircumference: "Arm circumference [mm]"
};

// Rows of the anthropometric list and of the model parameter table, filled by writeMeta and writeVector
function buildParamCards() {
    document.getElementById("anthroList").innerHTML = Object.entries({ gender: "Sex", ...ANTHRO_FIELDS })
        .map(([id, label]) => `<div class="param-row"><dt>${label}</dt><dd id="${id}" class="param-value"></dd></div>`)
        .join("");
    document.getElementById("modelParams").innerHTML = [1, 2, 3, 4]
        .map(i => `<tr><th scope="row">${i}</th>` +
            ["m", "c", "k"].map(p => `<td id="${p}${i}" class="param-value"></td>`).join("") + "</tr>")
        .join("");
}

// Extract anthropometric information (from data/subjects.json) for the selected subject,
// or for all subjects of the rows.
// "All Subjects" is the mean over the subjects measured in this direction, each weighted equally.
function extractSubjectMeta(resultsMatrix, selectedSubject) {
    if (!resultsMatrix || resultsMatrix.length === 0) return null;

    const people = subjectsOf(resultsMatrix).map(s => subjectData[s]).filter(Boolean);
    const meta = {
        gender: selectedSubject === "ALL" ? "mixed"
            : { 1: "male", 2: "female" }[people[0]?.gender] ?? "unknown"
    };
    // A subject missing from subjects.json shows "–" instead of a made-up value
    Object.keys(ANTHRO_FIELDS).forEach(f => meta[f] = people.length ? math.mean(people.map(p => num(p[f]))) : "–");
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
    )].filter(Number.isFinite).sort((a, b) => a - b);
}

// Six equally spaced tick labels for a force slider
function sliderTicks(min, max, n = 6) {
    return Array.from({ length: n }, (_, i) => Math.round(min + i * (max - min) / (n - 1)));
}

// Update the model illustrations to match the selected excitation type
function updateModelImage(excitation) {
    const kind = excitation.startsWith("rotatorisch") ? "rotational" : "translational";
    document.getElementById("modelImage").src = `four_mass_model_${kind}.png`;
    document.getElementById("modelImageSym").src = `symbols_${kind}.png`;
}

// Initialize the application: one curve, computed from the default conditions.
async function initializeApp() {
    initPlotOptions();
    const c = newCurve();
    c.open = true;
    plot.curves.push(c);
    plot.active = c;
    renderCurveList();
    await computeCurve(c, true);
}
