// ============================================================================
// Chart updates and responsive resizing
// ============================================================================

// Redraw all charts and curve headers from the stored curves (no recalculation).
function renderAllCharts() {
    CHART_DEFS.forEach(def => charts[def.key] = renderChart(def));
    Object.keys(plots).forEach(renderCurveList);
}

// Watch the chart container for layout changes and let Chart.js recalculate
// the canvas dimensions when the container size changes.
function observeChartContainer(canvasId) {
    const container = document.getElementById(canvasId).parentElement;
    new ResizeObserver(() => {
        const chart = Object.values(charts).find(
            c => c?.canvas?.id === canvasId
        );
        if (chart) {
            chart.resize();
        }
    }).observe(container);
}

// Map each chart canvas to the corresponding data field in the source data.
function getDataField(canvasId) {
    switch (canvasId) {
        case "chartMI":        return "MI";
        case "chartPhase":     return "Phase";
        case "chartVPA":       return "VPA";
        case "chartAjw":       return "ajw";
        default:
            throw new Error("Unknown canvasId: " + canvasId);
    }
}

function shouldTakeAbs(canvasId) {
    return canvasId === "chartMI" || canvasId === "chartVPA";
}

// ============================================================================
// Measurement data interpolation
// ============================================================================

// Select and interpolate measured impedance data for the requested push and
// grip forces. Data is processed separately for each subject and then averaged.
// Returns the mean curve and the percentile band lo/hi (prc = [lower, upper], 0…1).
function selectMat(resultsMatrix, initFp, initFg, canvasId, prc = [0.05, 0.95]) {
    if (!resultsMatrix || resultsMatrix.length === 0) {
        return { x: [], y: [] };
    }

    const dataField = getDataField(canvasId);
    const isPhase = canvasId === "chartPhase";
    const x = [];
    const y = [];
    const off = [];     // band offsets [lower, upper] from the mean per frequency

    // All subjects of a direction share one frequency vector (checked when exporting the data)
    const freq = resultsMatrix[0].freq;

    const initFpNum = Number(initFp);
    const initFgNum = Number(initFg);

    // Group the measurement rows by subject so that interpolation is performed
    // independently for each subject.
    const subjectMap = {};
    for (const row of resultsMatrix) {
        const subjectNum = row.SubjectNumber;
        if (!subjectMap[subjectNum]) {
            subjectMap[subjectNum] = [];
        }
        subjectMap[subjectNum].push(row);
    }

    // Process each frequency independently.
    for (let i = 0; i < freq.length; i++) {
        const allValues = [];

        // Interpolate separately for each subject using the available force values.
        for (const subjectNum in subjectMap) {
            const subjectData = subjectMap[subjectNum];
            const subjectRangeFp = getUnionRange(subjectData, "TargetPushForce").filter(Number.isFinite);
            const subjectRangeFg = getUnionRange(subjectData, "TargetGripForce").filter(Number.isFinite);
            const minFp = math.min(subjectRangeFp);
            const maxFp = math.max(subjectRangeFp);
            const minFg = math.min(subjectRangeFg);
            const maxFg = math.max(subjectRangeFg);

            if (subjectRangeFp.length === 0 || subjectRangeFg.length === 0) continue;

            const valMI = [];
            const data_Fg_low_Fp_low = [];
            const data_Fg_low_Fp_high = [];
            const data_Fg_high_Fp_low = [];
            const data_Fg_high_Fp_high = [];
            let Fp_low, Fp_high, Fg_low, Fg_high;
            let distanceFp_low, distanceFg_low;

            for (const row of subjectData) {
                let value = row[dataField]?.[i];
                if (value == null) continue;

                if (shouldTakeAbs(canvasId)) {
                    value = math.abs(value);
                }

                const rowFpNum = Number(row.TargetPushForce);
                const rowFgNum = Number(row.TargetGripForce);

                // Use the measured value directly when the requested force combination exists.
                if (rowFpNum === initFpNum && rowFgNum === initFgNum) {
                    valMI.push(value);
                }
                
                if (!subjectRangeFp.includes(initFpNum) || !subjectRangeFg.includes(initFgNum)) {
                    if (initFpNum <= minFp) {
                        // Lower boundary: interpolate between the two lowest available push-force values.
                        Fp_low = minFp;
                        Fp_high = subjectRangeFp.find(v => v > minFp);
                    } 
                    else if (initFpNum >= maxFp) {
                        // Upper boundary: interpolate between the two highest available push-force values.
                        Fp_low = subjectRangeFp.filter(v => v < maxFp).at(-1);
                        Fp_high = maxFp;
                    } 
                    else {
                        // Interior point: find the two surrounding push-force values.
                        Fp_low = subjectRangeFp.filter(v => v <= initFpNum).at(-1);
                        Fp_high = subjectRangeFp.find(v => v > initFpNum);
                    }
                    if (initFgNum <= minFg) {
                        // Lower boundary: interpolate between the two lowest available grip-force values.
                        Fg_low = minFg;
                        Fg_high = subjectRangeFg.find(v => v > minFg);
                    } 
                    else if (initFgNum >= maxFg) {
                        // Upper boundary: interpolate between the two highest available grip-force values.
                        Fg_low = subjectRangeFg.filter(v => v < maxFg).at(-1);
                        Fg_high = maxFg;
                    } 
                    else {
                        // Interior point: find the two surrounding grip-force values.
                        Fg_low = subjectRangeFg.filter(v => v <= initFgNum).at(-1);
                        Fg_high = subjectRangeFg.find(v => v > initFgNum);
                    }

                    if ([Fp_low, Fp_high, Fg_low, Fg_high].some(v => v == null)) {
                        continue;
                    }
                    distanceFp_low = (initFpNum-Fp_low) / (Fp_high - Fp_low);
                    distanceFg_low = (initFgNum-Fg_low) / (Fg_high - Fg_low);
                    
                    if (Number(row.TargetPushForce) == Fp_low  && Number(row.TargetGripForce) == Fg_low)
                        data_Fg_low_Fp_low.push(value);

                    if (Number(row.TargetPushForce) == Fp_high && Number(row.TargetGripForce) == Fg_low)
                        data_Fg_low_Fp_high.push(value);

                    if (Number(row.TargetPushForce) == Fp_low  && Number(row.TargetGripForce) == Fg_high)
                        data_Fg_high_Fp_low.push(value);

                    if (Number(row.TargetPushForce) == Fp_high && Number(row.TargetGripForce) == Fg_high)
                        data_Fg_high_Fp_high.push(value);
                }
            }

            // Use exact match if available: mean and band over the subject's repetitions
            if (valMI.length > 0) {
                const m = center(valMI, isPhase);
                allValues.push({ m, off: spread(valMI, m, isPhase, prc) });
            } else if (data_Fg_low_Fp_low.length > 0 && data_Fg_low_Fp_high.length > 0 &&
                    data_Fg_high_Fp_low.length > 0 && data_Fg_high_Fp_high.length > 0) {

                // Bilinear interpolation in push-force and grip-force space over the four
                // surrounding force combinations (first grip force, then push force).
                // Values are already absolute where needed (shouldTakeAbs); phase keeps its sign.
                const corners = [data_Fg_low_Fp_low, data_Fg_high_Fp_low, data_Fg_low_Fp_high, data_Fg_high_Fp_high];
                const weights = [
                    (1 - distanceFg_low) * (1 - distanceFp_low),
                    distanceFg_low * (1 - distanceFp_low),
                    (1 - distanceFg_low) * distanceFp_low,
                    distanceFg_low * distanceFp_low
                ];
                const ms = corners.map(v => center(v, isPhase));
                // Phase: interpolate angles relative to the first corner so a ±π wrap is not averaged across
                const lin = isPhase ? ms.map(a => ms[0] + wrapPi(a - ms[0])) : ms;
                const m = math.sum(lin.map((a, k) => a * weights[k]));
                // The band edges are offsets from each corner's mean, interpolated the same way
                const offs = corners.map((v, k) => spread(v, ms[k], isPhase, prc));
                const off = [0, 1].map(j => math.sum(offs.map((o, k) => o[j] * weights[k])));
                allValues.push({ m, off });
            }
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
    const P = plots[def.group];
    // Bands go after the lines, so dataset index = curve index for the legend toggle
    const datasets = [
        ...P.curves.map(c => curveDataset(c, def)),
        ...P.curves.flatMap(c => c.band && c.visible ? bandDatasets(c, def) : [])
    ];
    const options = chartOptions(def, P.opts);
    const chart = charts[def.key];

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

// Options are rebuilt on every render, so theme colors and plot options are always current.
function chartOptions(def, opts) {
    const text = cssVar("--chart-text") || "#555";
    const grid = cssVar("--grid") || "rgba(0, 0, 0, 0.1)";
    const axis = title => ({
        title: { display: true, text: title, color: text },
        grid: { display: opts.grid, color: grid },
        border: { color: grid }
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
                onClick: (e, item) => toggleCurve(def.group, item.datasetIndex),
                labels: {
                    // Skip curves without data in this chart (model VPA needs |v|² in the data)
                    filter: (item, data) => !data.datasets[item.datasetIndex].band &&
                        data.datasets[item.datasetIndex].data.length > 0,
                    usePointStyle: true,
                    boxWidth: 4,
                    boxHeight: 5,
                    padding: 12,
                    font: { size: 12 },
                    color: text
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
                max: 500,
                ticks: { color: text }
            },
            y: {
                ...axis(plots[def.group].active?.shown?.dir.startsWith("rotatorisch")
                    ? ROT_AXIS[def.id] ?? def.axis : def.axis),
                min: def.min,
                ticks: {
                    color: text,
                    callback: value => {
                        const v = Number(value);
                        return Number.isInteger(v) ? v : v.toFixed(2);
                    }
                }
            }
        }
    };
}
