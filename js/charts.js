// ============================================================================
// Chart updates
// ============================================================================

// Redraw all charts and curve headers from the stored curves (no recalculation).
// Chart.js resizes the charts with their containers (responsive option).
function renderAllCharts() {
    CHART_DEFS.forEach(def => charts[def.id] = renderChart(def));
    renderCurveList();
}

// ============================================================================
// Measurement data interpolation
// ============================================================================

// The two force levels of a sorted range that enclose v; at the range ends the two outermost.
// An entry is undefined when the range has fewer than two levels.
function bracket(range, v) {
    if (v <= range[0]) return [range[0], range[1]];
    if (v >= range.at(-1)) return [range.at(-2), range.at(-1)];
    return [range.filter(r => r <= v).at(-1), range.find(r => r > v)];
}

// Rows of one subject that the requested forces are taken from: the rows at exactly these forces
// when the subject was measured at both, else the rows of the four surrounding force combinations
// with their bilinear weights (first grip force, then push force). null when not possible.
function subjectSource(rows, Fp, Fg) {
    const rangeFp = getUnionRange(rows, "TargetPushForce");
    const rangeFg = getUnionRange(rows, "TargetGripForce");
    if (rangeFp.length === 0 || rangeFg.length === 0) return null;

    const at = (p, g) => rows.filter(r => Number(r.TargetPushForce) === p && Number(r.TargetGripForce) === g);
    if (rangeFp.includes(Fp) && rangeFg.includes(Fg)) return { exact: at(Fp, Fg) };

    const [Fp_low, Fp_high] = bracket(rangeFp, Fp);
    const [Fg_low, Fg_high] = bracket(rangeFg, Fg);
    if ([Fp_low, Fp_high, Fg_low, Fg_high].some(v => v == null)) return null;
    const tFp = (Fp - Fp_low) / (Fp_high - Fp_low);
    const tFg = (Fg - Fg_low) / (Fg_high - Fg_low);
    return {
        corners: [at(Fp_low, Fg_low), at(Fp_low, Fg_high), at(Fp_high, Fg_low), at(Fp_high, Fg_high)],
        weights: [(1 - tFg) * (1 - tFp), tFg * (1 - tFp), (1 - tFg) * tFp, tFg * tFp]
    };
}

// Select and interpolate measured impedance data for the requested push and
// grip forces. Data is processed separately for each subject and then averaged.
// Returns the mean curve and the percentile band lo/hi (prc = [lower, upper], 0…1).
function selectMat(resultsMatrix, initFp, initFg, def, prc = [0.05, 0.95]) {
    if (!resultsMatrix || resultsMatrix.length === 0) {
        return { x: [], y: [] };
    }

    const isPhase = def.field === "Phase";
    const x = [];
    const y = [];
    const off = [];     // band offsets [lower, upper] from the mean per frequency

    // All subjects of a direction share one frequency vector (checked when exporting the data)
    const freq = resultsMatrix[0].freq;

    // Interpolation is performed independently for each subject.
    const sources = Object.values(Object.groupBy(resultsMatrix, r => r.SubjectNumber))
        .map(rows => subjectSource(rows, Number(initFp), Number(initFg)))
        .filter(Boolean);

    // Process each frequency independently.
    for (let i = 0; i < freq.length; i++) {
        const allValues = [];
        const valuesOf = rows => rows
            .map(r => r[def.field]?.[i])
            .filter(v => v != null)
            .map(v => def.abs ? Math.abs(v) : v);

        for (const src of sources) {
            if (src.exact) {
                // Exact match: mean and band over the subject's repetitions
                const vals = valuesOf(src.exact);
                if (vals.length === 0) continue;
                const m = center(vals, isPhase);
                allValues.push({ m, off: spread(vals, m, isPhase, prc) });
                continue;
            }
            // Bilinear interpolation over the four surrounding force combinations.
            // Values are already absolute where needed (def.abs); phase keeps its sign.
            const corners = src.corners.map(valuesOf);
            if (corners.some(v => v.length === 0)) continue;
            const ms = corners.map(v => center(v, isPhase));
            // Phase: interpolate angles relative to the first corner so a ±π wrap is not averaged across
            const lin = isPhase ? ms.map(a => ms[0] + wrapPi(a - ms[0])) : ms;
            const m = math.sum(lin.map((a, k) => a * src.weights[k]));
            // The band edges are offsets from each corner's mean, interpolated the same way
            const offs = corners.map((v, k) => spread(v, ms[k], isPhase, prc));
            allValues.push({ m, off: [0, 1].map(j => math.sum(offs.map((o, k) => o[j] * src.weights[k]))) });
        }

        // Only add to chart if at least one subject has data
        if (allValues.length === 0) continue;
        x.push(freq[i]);
        if (allValues.length === 1) {
            // Single subject: band over the repetitions
            y.push(allValues[0].m);
            off.push(allValues[0].off);
        } else {
            // Several subjects: each subject counts once, band over the subject means
            const means = allValues.map(s => s.m);
            const m = center(means, isPhase);
            y.push(m);
            off.push(spread(means, m, isPhase, prc));
        }
    }

    // Unwrap the phase over frequency for a continuous line (like MATLAB unwrap)
    if (isPhase) {
        for (let i = 1; i < y.length; i++) y[i] = y[i - 1] + wrapPi(y[i] - y[i - 1]);
    }
    const lo = y.map((m, i) => m + off[i][0]);
    const hi = y.map((m, i) => m + off[i][1]);
    return { x, y, lo, hi };
}

const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

// Arithmetic mean, or circular mean for phase angles
function center(vals, isPhase) {
    return isPhase
        ? Math.atan2(math.mean(vals.map(Math.sin)), math.mean(vals.map(Math.cos)))
        : math.mean(vals);
}

// Percentiles prc = [lower, upper] (0…1) as offsets from the mean m; 0 and 1 give min and max.
// Phase deviations are wrapped to [-π, π] first, so the band follows the circular mean.
function spread(vals, m, isPhase, prc) {
    const dev = vals.map(v => isPhase ? wrapPi(v - m) : v - m);
    return prc.map(p => math.quantileSeq(dev, p));
}

// ============================================================================
// Measurement data and general chart construction
// ============================================================================

// Create a Chart.js line chart or update an existing one with all curves of its view.
// The same function is used for measured and model-based results.
function renderChart(def) {
    // Bands go after the lines, so dataset index = curve index for the legend toggle
    const datasets = [
        ...plot.curves.map(c => curveDataset(c, def)),
        ...plot.curves.flatMap(c => c.band && c.visible ? bandDatasets(c, def) : [])
    ];
    const options = chartOptions(def, plot.opts);
    const chart = charts[def.id];

    if (chart) {
        chart.data.datasets = datasets;
        chart.options = options;
        chart.update("none");
        return chart;
    }
    const canvas = document.getElementById(def.id);
    const created = new Chart(canvas, { type: "line", data: { datasets }, options });
    canvas.addEventListener("dblclick", () => created.resetZoom());
    return created;
}

function curveDataset(c, def) {
    const pts = c.data[def.id] ?? { x: [], y: [] };
    const color = curveColor(c);
    const hasMarker = c.marker !== "none";
    return {
        label: `${def.prefix} | ${c.name || c.auto}`,
        data: pts.x.map((x, i) => ({ x, y: pts.y[i] })),
        hidden: !c.visible,
        showLine: c.dash !== "none",
        borderDash: DASHES[c.dash] ?? [],
        borderWidth: c.width,
        borderColor: color,
        backgroundColor: "rgba(0,0,0,0)",
        pointStyle: hasMarker ? c.marker : "line",
        pointRadius: ctx => hasMarker ? Math.max(2, Math.min(5, ctx.chart.width / 250)) : 0,
        pointHoverRadius: ctx => Math.max(4, Math.min(8, ctx.chart.width / 150)),
        pointBorderColor: color,
        pointBackgroundColor: "rgba(0,0,0,0)",
        pointBorderWidth: 1.5
    };
}

// Percentile band of a measured curve: lower edge plus upper edge filled down to it,
// in the curve color (hex, so 26 = ~15 % alpha) and drawn below the lines (higher order).
function bandDatasets(c, def) {
    const pts = c.data[def.id];
    if (!pts?.lo) return [];        // model curves have no band
    const base = { band: true, order: 1, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0 };
    return [
        { ...base, data: pts.x.map((x, i) => ({ x, y: pts.lo[i] })), fill: false },
        { ...base, data: pts.x.map((x, i) => ({ x, y: pts.hi[i] })), fill: "-1", backgroundColor: curveColor(c) + "26" }
    ];
}

// Y axis titles that differ for rotational excitation
const ROT_AXIS = { chartMI: "|Zₕ| in Nms/rad", chartAjw: "|a| in rad/s²" };

// Options are rebuilt on every render, so plot options are always current;
// text and grid colors come from Chart.defaults (applyChartTheme).
function chartOptions(def, opts) {
    const axis = title => ({
        title: { display: true, text: title },
        grid: { display: opts.grid }
    });

    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: opts.legend !== "none",
                position: opts.legend === "none" ? "top" : opts.legend,
                align: "end",
                // Legend clicks toggle the curve in every chart of the view
                onClick: (e, item) => toggleCurve(plot.curves[item.datasetIndex]),
                labels: {
                    // Skip curves without data in this chart (model VPA needs |v|² in the data)
                    filter: (item, data) => !data.datasets[item.datasetIndex].band &&
                        data.datasets[item.datasetIndex].data.length > 0,
                    usePointStyle: true,
                    boxWidth: 4,
                    boxHeight: 5,
                    padding: 12,
                    font: { size: 12 }
                }
            },
            tooltip: { filter: item => !item.dataset.band },
            // Wheel/pinch zooms, drag pans, Shift+drag box-zooms, double-click resets (see renderChart)
            zoom: {
                pan: { enabled: true, mode: "xy" },
                zoom: {
                    wheel: { enabled: true },
                    pinch: { enabled: true },
                    drag: { enabled: true, modifierKey: "shift" },
                    mode: "xy"
                }
            }
        },
        scales: {
            x: {
                ...axis("Frequency in Hz"),
                type: opts.xScale,
                min: 10,
                max: 500
            },
            y: {
                ...axis(plot.active?.shown?.dir.startsWith("rotatorisch")
                    ? ROT_AXIS[def.id] ?? def.axis : def.axis),
                min: def.min,
                ticks: {
                    callback: value => {
                        const v = Number(value);
                        return Number.isInteger(v) ? v : v.toFixed(2);
                    }
                }
            }
        }
    };
}
