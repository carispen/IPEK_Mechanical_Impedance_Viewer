// ============================================================================
// Page shell: views, theme, status and chart export
// ============================================================================

const VIEWS = {
    intro: "Introduction",
    measured: "Impedance data"
};

const cssVar = name =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function setStatus(text, isError = false) {
    const el = document.getElementById("status");
    el.textContent = text;
    el.classList.toggle("err", isError);
}

// Show one view; the sidebar, its toggle and the main panels share the data-tab attribute
function showView(name) {
    if (!VIEWS[name]) name = "measured";

    document.querySelectorAll("[data-tab]")
        .forEach(el => el.hidden = el.dataset.tab !== name);

    document.querySelectorAll("#nav [data-go]")
        .forEach(b => b.setAttribute("aria-current", b.dataset.go === name ? "page" : "false"));

    document.getElementById("pageTitle").textContent = VIEWS[name];
    document.title = `${VIEWS[name]} · IPEK Impedance Viewer`;
    history.replaceState(null, "", "#" + name);
}

// Chart colors come from the CSS tokens so both themes stay in sync
function applyChartTheme() {
    const text = cssVar("--chart-text") || "#555";
    const grid = cssVar("--grid") || "rgba(0, 0, 0, 0.1)";

    Chart.defaults.color = text;
    Chart.defaults.borderColor = grid;
    Chart.defaults.font.family = cssVar("--sans");

    // Chart options are rebuilt on render, so a redraw picks up the new theme colors
    if (charts.chartMI) renderAllCharts();
}

function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.getElementById("themeBtn").setAttribute("aria-pressed", theme === "dark");
    try { localStorage.setItem("ipek.theme", theme); } catch {}
    applyChartTheme();
}

// Export a chart as PNG on the current card background (canvas itself is transparent)
function downloadChart(canvasId) {
    const src = canvasId === "top"
        ? document.querySelector(".top-chart.active")
        : document.getElementById(canvasId);

    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const g = out.getContext("2d");
    g.fillStyle = cssVar("--chart-bg");
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(src, 0, 0);

    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `${src.id}.png`;
    a.click();
}

function initShell() {
    // Collapsible side panel (data view only); the header stays visible
    const root = document.documentElement;
    const sideBtn = document.getElementById("sideBtn");
    const setSidebar = open => {
        root.dataset.side = open ? "open" : "closed";
        sideBtn.setAttribute("aria-expanded", open);
        sideBtn.title = open ? "Hide plot setup" : "Show plot setup";
        try { localStorage.setItem("ipek.side", root.dataset.side); } catch {}
    };
    setSidebar(root.dataset.side !== "closed");
    sideBtn.onclick = () => setSidebar(root.dataset.side === "closed");

    document.querySelectorAll("#nav [data-go]").forEach(b => b.onclick = () => showView(b.dataset.go));
    showView(location.hash.slice(1));
    window.onhashchange = () => showView(location.hash.slice(1));

    const themeBtn = document.getElementById("themeBtn");
    themeBtn.setAttribute("aria-pressed", document.documentElement.dataset.theme === "dark");
    themeBtn.onclick = () =>
        setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

    document.querySelectorAll(".dl-btn")
        .forEach(b => b.onclick = () => downloadChart(b.dataset.chart));

    initSplitter();
}

// Draggable divider between charts and parameter cards; width is remembered
function initSplitter() {
    const split = document.getElementById("splitter");
    const grid = split.parentElement;
    const setW = w => {
        w = Math.round(Math.min(Math.max(w, 260), grid.clientWidth - 360));
        grid.style.setProperty("--cards-w", w + "px");
        try { localStorage.setItem("ipek.cardsW", w); } catch {}
    };
    let saved = null;
    try { saved = localStorage.getItem("ipek.cardsW"); } catch {}
    if (saved) grid.style.setProperty("--cards-w", saved + "px");

    split.onpointerdown = e => {
        split.setPointerCapture(e.pointerId);
        split.classList.add("dragging");
    };
    split.onpointermove = e => {
        if (split.hasPointerCapture(e.pointerId))
            setW(grid.getBoundingClientRect().right - e.clientX - split.offsetWidth / 2);
    };
    split.onpointerup = () => split.classList.remove("dragging");
    split.ondblclick = () => {
        grid.style.removeProperty("--cards-w");
        try { localStorage.removeItem("ipek.cardsW"); } catch {}
    };
    split.onkeydown = e => {
        const step = { ArrowLeft: 20, ArrowRight: -20 }[e.key];
        if (step) setW(grid.lastElementChild.offsetWidth + step);
    };
}
