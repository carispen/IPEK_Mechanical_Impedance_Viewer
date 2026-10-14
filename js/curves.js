// ============================================================================
// Curves: one expandable card per curve with its own conditions and style
// ============================================================================

// Theme palette from the CSS tokens --series-1 … --series-8
const paletteColor = slot => cssVar(`--series-${slot % 8 + 1}`);
const curveColor = c => c.color || paletteColor(c.slot);
const curveName = c => c.name || `Curve ${c.id}`;

// New curve: copies the base curve (conditions and data) with the next color and marker.
function newCurve(group, base) {
    const P = plots[group];
    const slot = P.next++;
    return {
        id: slot + 1,
        slot,
        name: "",
        color: null,                    // null = theme palette color for this slot
        dash: base?.dash ?? "none",
        marker: MARKERS[slot % MARKERS.length],
        width: base?.width ?? 1.5,
        band: base?.band ?? false,      // percentile band of the measurements
        prc: [...(base?.prc ?? [0.05, 0.95])],
        visible: true,
        open: false,
        cond: base ? { ...base.cond } : { type: "measured", dir: "translatorischZ", subject: null, Fp: null, Fg: null },
        auto: base?.auto ?? "",
        short: base?.short ?? "",
        data: { ...base?.data },
        shown: base?.shown,
        rows: base?.rows,               // measurement rows behind the curve (side cards)
        betas: base?.betas,             // model coefficients behind the curve (side cards)
        rev: 0,
        el: null
    };
}

// Load the data a curve depends on, refresh its controls and recompute its chart data.
// `structural` = direction or subject changed, so the subject list and force ranges are rebuilt.
async function computeCurve(group, c, structural = false) {
    const isMod = c.cond.type === "model";
    const rev = ++c.rev;
    if (structural) setStatus("Loading data…");

    const [all, subjectFile] = await Promise.all([loadJson(dirFiles[c.cond.dir]), loadJson(SUBJECTS_URL)]);
    subjectData = subjectFile.subjects;
    const betas = isMod ? await loadBetas(c.cond.dir) : null;
    const v2 = isMod ? meanV2(all) : null;
    if (rev !== c.rev || !c.el) return;     // a newer change superseded this one

    const subjects = subjectsOf(all);
    if (!isMod && c.cond.subject !== "ALL" && !subjects.includes(Number(c.cond.subject))) {
        c.cond.subject = String(subjects[0]);
    }
    const rows = isMod ? all : subjectRows(all, c.cond.subject);
    if (structural) {
        syncConditionControls(c, subjects, rows);
        setStatus("");
    }

    const { dir, subject, Fp, Fg } = c.cond;
    CHART_DEFS.filter(d => d.group === group).forEach(d => {
        c.data[d.id] = !isMod ? selectMat(rows, Fp, Fg, d.id, dir, c.prc)
            : callModelData(Number(Fp), Number(Fg), d.id, dir, betas, v2);
    });

    const proband = isMod ? "Model" : subjectLabel(subject);
    c.auto = `${DIR_LABELS[dir]} | ${proband} | Fp: ${Fp} Fg: ${Fg}`;
    // Compact version for the narrow curve list
    c.short = [
        DIR_LABELS[dir].replace("translational", "transl.").replace("rotational", "rot."),
        isMod ? "Model" : subject === "ALL" ? "All" : `S${subject}`,
        `Fp ${Fp} N`, `Fg ${Fg} N`
    ].join(" · ");
    c.rows = rows;
    c.betas = betas;
    c.shown = { ...c.cond };            // conditions of the data currently drawn

    renderAllCharts();
    if (plots[group].active === c) updateSideCards(group);
}

// Rebuild the subject options and slider ranges of a curve card; clamps the forces.
function syncConditionControls(c, subjects, rows) {
    const q = sel => c.el.querySelector(sel);
    q('[data-c="dir"]').value = c.cond.dir;
    q('[data-c="type"]').value = c.cond.type;
    c.el.querySelectorAll('[data-only="measured"]').forEach(el => el.hidden = c.cond.type === "model");

    const subjectSel = q('select[data-c="subject"]');
    if (subjectSel) {
        subjectSel.innerHTML = `<option value="ALL">All Subjects</option>` +
            subjects.map(n => `<option value="${n}">Subject Number ${n}</option>`).join("");
        subjectSel.value = c.cond.subject;
    }

    const ranges = computeForceRangesForProband(rows);
    [["Fp", ranges.rangeFp], ["Fg", ranges.rangeFg]].forEach(([k, range]) => {
        const min = Math.min(...range);
        const max = Math.max(...range);
        const slider = q(`input[type="range"][data-c="${k}"]`);
        const list = q(`datalist[data-c="${k}"]`);

        list.id = `ticks-${c.el.dataset.uid}-${k}`;
        list.innerHTML = sliderTicks(min, max).map(v => `<option value="${v}" label="${v}"></option>`).join("");
        slider.setAttribute("list", list.id);
        slider.min = min;
        slider.max = max;
        slider.value = c.cond[k] ?? min;    // the browser clamps to [min, max]
        c.cond[k] = slider.value;
        q(`input[type="number"][data-c="${k}"]`).value = slider.value;
    });
}

// The highlighted curve is the one the side cards describe
function setActive(group, c) {
    const P = plots[group];
    if (P.active === c) return;
    P.active = c;
    renderAllCharts();              // MI axis unit follows the active curve
    updateSideCards(group);
}

function toggleCurve(group, index) {
    const c = plots[group].curves[index];
    c.visible = !c.visible;
    renderAllCharts();
}

function addCurve(group) {
    const P = plots[group];
    const c = newCurve(group, P.active ?? P.curves.at(-1));
    c.open = true;
    P.curves.push(c);
    P.active = c;
    renderCurveList(group);
    computeCurve(group, c, true).catch(showLoadError);
    c.el.querySelector(".curve-select").focus();
}

function removeCurve(group, c) {
    const P = plots[group];
    if (P.curves.length < 2) return;
    P.curves.splice(P.curves.indexOf(c), 1);
    c.el.remove();
    c.el = null;
    if (P.active === c) {
        P.active = P.curves[0];
        updateSideCards(group);
    }
    renderAllCharts();
}

function showLoadError(err) {
    console.error(err);
    // Browsers block fetch() for pages opened from disk; the data needs a web server
    setStatus(location.protocol === "file:"
        ? "Could not load the data: the page was opened as a file. Serve the folder (e.g. python -m http.server) and open it via http://localhost."
        : "Could not load the data. Check the connection and reload the page.", true);
}

let cardUid = 0;

// Build the card of one curve from the template and wire up its controls.
function buildCard(group, c) {
    const li = document.getElementById("curveTpl").content.firstElementChild.cloneNode(true);
    const q = sel => li.querySelector(sel);
    li.dataset.uid = ++cardUid;
    c.el = li;

    // The header selects the curve for the side cards; only the arrow expands it
    q(".curve-select").onclick = () => setActive(group, c);
    q(".curve-expand").onclick = () => {
        c.open = !c.open;
        renderCurveList(group);
    };
    q('[data-act="toggle"]').onclick = () => { c.visible = !c.visible; renderAllCharts(); };
    q('[data-act="remove"]').onclick = () => removeCurve(group, c);
    li.addEventListener("focusin", () => setActive(group, c));

    // Conditions: direction and subject change the data set, forces only the curve
    li.querySelectorAll("select[data-c]").forEach(sel => sel.onchange = () => {
        const k = sel.dataset.c;
        const prev = c.cond[k];
        c.cond[k] = sel.value;
        computeCurve(group, c, true).catch(err => {
            // Keep the curve consistent with the data it still shows
            c.cond[k] = sel.value = prev;
            showLoadError(err);
        });
    });

    ["Fp", "Fg"].forEach(k => {
        const slider = q(`input[type="range"][data-c="${k}"]`);
        const field = q(`input[type="number"][data-c="${k}"]`);
        const apply = () => {
            c.cond[k] = slider.value;
            clearTimeout(c.timer);
            c.timer = setTimeout(() => computeCurve(group, c).catch(showLoadError), 80);
        };
        slider.oninput = () => {
            field.value = slider.value;
            apply();
        };
        field.onchange = () => {
            // Clamp manually entered values to the valid force range
            if (field.value !== "" && Number.isFinite(Number(field.value))) slider.value = field.value;
            field.value = slider.value;
            apply();
        };
    });

    // Style
    li.querySelectorAll("[data-k]").forEach(el => {
        const k = el.dataset.k;
        if (el.type === "checkbox") el.checked = c[k];
        else el.value = k === "color" ? curveColor(c) : c[k];
        el.oninput = () => {
            c[k] = el.type === "checkbox" ? el.checked : k === "width" ? Number(el.value) : el.value;
            renderAllCharts();
        };
    });

    // Band percentiles (0…1) change the band data, so the curve is recomputed
    li.querySelectorAll("[data-prc]").forEach(el => {
        const i = Number(el.dataset.prc);
        el.value = c.prc[i];
        el.onchange = () => {
            const v = Number(el.value);
            if (el.value !== "" && Number.isFinite(v)) c.prc[i] = Math.min(1, Math.max(0, v));
            el.value = c.prc[i];
            computeCurve(group, c).catch(showLoadError);
        };
    });
    return li;
}

// Small preview of the line style and marker, used in the curve list
const MARKER_SVG = {
    circle:   '<circle cx="14" cy="7" r="3.5"/>',
    triangle: '<path d="M14 3l4 7h-8z"/>',
    rect:     '<rect x="10.5" y="3.5" width="7" height="7"/>',
    rectRot:  '<path d="M14 2.5l4.5 4.5-4.5 4.5-4.5-4.5z"/>',
    crossRot: '<path d="M10.5 3.5l7 7m0-7l-7 7"/>',
    star:     '<path d="M14 2.5v9m-4.5-4.5h9m-7.5-3l6 6m0-6l-6 6"/>',
    none:     ""
};

function curveSwatch(c) {
    const color = curveColor(c);
    const dash = (DASHES[c.dash] ?? []).join(" ");
    const line = c.dash === "none" ? "" :
        `<line x1="1" y1="7" x2="27" y2="7" stroke-width="${c.width}" stroke-dasharray="${dash}"/>`;
    return `<svg class="pc-swatch" width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="${color}" stroke-width="1.5" aria-hidden="true">${line}${MARKER_SVG[c.marker]}</svg>`;
}

const EYE_SVG = hidden => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' +
    (hidden ? '<path d="M3 3l18 18"/>' : "") + "</svg>";

// Create missing cards and refresh the card headers. The controls inside a card are
// never re-rendered, so dragging a slider or typing a name is not interrupted.
function renderCurveList(group) {
    const P = plots[group];
    const list = document.querySelector(`[data-pc="${group}"] .pc-list`);
    if (!list) return;

    P.curves.forEach(c => {
        if (!c.el) list.append(buildCard(group, c));
        const q = sel => c.el.querySelector(sel);
        const name = curveName(c);

        c.el.classList.toggle("sel", c === P.active);
        c.el.classList.toggle("off", !c.visible);
        c.el.classList.toggle("open", c.open);
        q(".curve-expand").setAttribute("aria-expanded", c.open);
        q(".curve-expand").setAttribute("aria-label", `${c.open ? "Collapse" : "Expand"} ${name}`);
        q(".curve-select").setAttribute("aria-pressed", c === P.active);
        q(".curve-select").title = c.auto;
        q(".curve-body").hidden = !c.open;
        q(".curve-swatch").innerHTML = curveSwatch(c);
        q(".curve-name").textContent = name;
        q(".curve-short").textContent = c.short;

        const eye = q('[data-act="toggle"]');
        eye.innerHTML = EYE_SVG(!c.visible);
        eye.setAttribute("aria-pressed", !c.visible);
        eye.setAttribute("aria-label", `${c.visible ? "Hide" : "Show"} ${name}`);
        eye.title = c.visible ? "Hide" : "Show";

        const remove = q('[data-act="remove"]');
        remove.disabled = P.curves.length < 2;
        remove.setAttribute("aria-label", `Remove ${name}`);
        remove.title = "Remove";

        if (!c.color) q('[data-k="color"]').value = curveColor(c);
    });
}

// Plot options panel and the add button of a view
function initPlotOptions(group) {
    const root = document.querySelector(`[data-pc="${group}"]`);
    const P = plots[group];
    root.querySelector(".pc-add").onclick = () => addCurve(group);

    const opts = document.getElementById("optsTpl").content.firstElementChild.cloneNode(true);
    root.querySelector(".pc-list").after(opts);
    opts.querySelectorAll("[data-o]").forEach(el => {
        if (el.type === "checkbox") el.checked = P.opts[el.dataset.o];
        else el.value = P.opts[el.dataset.o];
        el.oninput = () => {
            P.opts[el.dataset.o] = el.type === "checkbox" ? el.checked : el.value;
            renderAllCharts();
        };
    });
}

// Side cards describe the active curve: anthropometric data for a measured curve,
// model parameters and image for a model curve
function updateSideCards(group) {
    const c = plots[group].active;
    if (!c?.shown) return;
    const { type, dir, subject, Fp, Fg } = c.shown;
    document.querySelectorAll("[data-for]").forEach(el => el.hidden = el.dataset.for !== type);

    if (type === "measured") {
        document.getElementById("selectedSubject").textContent =
            `${subjectLabel(subject)} · ${curveName(c)}`;
        writeMeta(extractSubjectMeta(c.rows, subject));
    } else {
        // Rotational models: moments of inertia J in kg·m², torsional c and k;
        // their values are small, so they are shown with significant digits
        const rot = dir.startsWith("rotatorisch");
        const fmt = rot ? v => v.toPrecision(3) : undefined;
        document.getElementById("hdrM").innerHTML = rot ? "J <small>[kgm²]</small>" : "m <small>[g]</small>";
        document.getElementById("hdrC").innerHTML = rot ? "c <small>[Nms/rad]</small>" : "c <small>[Ns/m]</small>";
        document.getElementById("hdrK").innerHTML = rot ? "k <small>[Nm/rad]</small>" : "k <small>[N/m]</small>";
        writeVector("m", matlabModel(Number(Fg), Number(Fp), c.betas.m), rot ? 1 : 1000, fmt);
        writeVector("k", matlabModel(Number(Fg), Number(Fp), c.betas.k), 1, fmt);
        writeVector("c", matlabModel(Number(Fg), Number(Fp), c.betas.d), 1, fmt);
        updateModelImage(dir);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    Chart.defaults.devicePixelRatio = window.devicePixelRatio || 1;
    initShell();
    applyChartTheme();
    window.addEventListener("load", applyChartTheme);
    setStatus("Loading data…");
    try {
        await initializeApp();
    } catch (err) {
        showLoadError(err);
        return;
    }
    setStatus("");
    document.getElementById("chartMI").classList.add("active");
    document.getElementById("btnMI").classList.add("active");

    function watchDPR() {
        const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        mql.addEventListener('change', () => {
            Chart.defaults.devicePixelRatio = window.devicePixelRatio;
            Object.values(charts).forEach(c => c?.resize());
            watchDPR(); // re-register for the next change
        }, { once: true });
    }
    watchDPR();
});
