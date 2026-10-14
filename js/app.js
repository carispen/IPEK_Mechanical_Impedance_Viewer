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
}

// Model coefficient files grouped by excitation direction.
// Each direction provides the force-dependent mass, damping, and stiffness matrices.
const MODEL_DEFS = {
    translatorischX: {
        betaFiles: {
            m: "data/m_beta_Matrix_TX.json",
            d: "data/d_beta_Matrix_TX.json",
            k: "data/k_beta_Matrix_TX.json"
        },
    },
    translatorischY: {
        betaFiles: {
            m: "data/m_beta_Matrix_TY.json",
            d: "data/d_beta_Matrix_TY.json",
            k: "data/k_beta_Matrix_TY.json"
        },
    },
    translatorischZ: {
        betaFiles: {
            m: "data/m_beta_Matrix_TZ.json",
            d: "data/d_beta_Matrix_TZ.json",
            k: "data/k_beta_Matrix_TZ.json"
        },
    },
    rotatorischX: {
        betaFiles: {
            m: "data/m_beta_Matrix_RX.json",
            d: "data/d_beta_Matrix_RX.json",
            k: "data/k_beta_Matrix_RX.json"
        },
    },
    rotatorischY: {
        betaFiles: {
            m: "data/m_beta_Matrix_RY.json",
            d: "data/d_beta_Matrix_RY.json",
            k: "data/k_beta_Matrix_RY.json"
        },
    },
    rotatorischZ: {
        betaFiles: {
            m: "data/m_beta_Matrix_RZ.json",
            d: "data/d_beta_Matrix_RZ.json",
            k: "data/k_beta_Matrix_RZ.json"
        },
    }
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

// Load the model coefficient matrices for an excitation direction
// The three files are loaded in parallel because they are independent
async function loadBetas(dir) {
    const files = MODEL_DEFS[dir].betaFiles;
    const [m, d, k] = await Promise.all([loadJson(files.m), loadJson(files.d), loadJson(files.k)]);
    return { m, d, k };
}

function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// Extract anthropometric information and the available force limits
// for the currently selected subject or for all subjects
function extractSubjectMeta(resultsMatrix, selectedSubject) {
    if (!resultsMatrix || resultsMatrix.length === 0) return null;

    //const gender = num(resultsMatrix[0].gender, 1);

    // Check whether "All Subjects" is selected
    // Display "mixed" when all subjects are selected; otherwise use the
    // gender information stored for the selected subject
    let genderText = "unknown";

    if (selectedSubject === "ALL") {
        genderText = "mixed";
    } else {
        const gender = num(resultsMatrix[0].gender, 1);

        if (gender === 1) {
            genderText = "male";
        } else if (gender === 2) {
            genderText = "female";
        }
    }

    // Anthropometrics are the same in every row of a subject: take one row per subject,
    // so "All Subjects" weights each subject equally, not by its number of repetitions
    const perSubject = [...new Map(resultsMatrix.map(r => [r.SubjectNumber, r])).values()];

    return {
        gender: genderText,
        maxFg: Math.max(...resultsMatrix.map(x => num(x.MaxGripForce)).filter(Number.isFinite)),
        maxFp: Math.max(...resultsMatrix.map(x => num(x.MaxPushForce)).filter(Number.isFinite)),

        handWeight: math.mean(perSubject.map(x => num(x.handWeight))),
        bodyWeight: math.mean(perSubject.map(x => num(x.bodyWeight))),
        bodyHeight: math.mean(perSubject.map(x => num(x.bodyHeight))),
        FrontReach: math.mean(perSubject.map(x => num(x.FrontReach))),
        ElbowToWristLength: math.mean(perSubject.map(x => num(x.ElbowToWristLength))),
        thumbLength: math.mean(perSubject.map(x => num(x.thumbLength))),
        handLength: math.mean(perSubject.map(x => num(x.handLength))),
        palmLength: math.mean(perSubject.map(x => num(x.palmLength))),
        palmWidth: math.mean(perSubject.map(x => num(x.palmWidth))),
        forearmCircumference: math.mean(perSubject.map(x => num(x.forearmCircumference))),
        armCircumference: math.mean(perSubject.map(x => num(x.armCircumference)))
    };
}

// Rows of one subject, or all rows for "ALL"
function subjectRows(rows, subject) {
    return subject === "ALL" ? rows : rows.filter(r => r.SubjectNumber === Number(subject));
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
            ["chartMI","chartPhase","chartVPA"].forEach(observeChartContainer);
        });
    });
}
