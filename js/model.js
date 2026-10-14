// ============================================================================
// Four-mass oscillator model
// ============================================================================

// Calculate the mechanical impedance of the four-mass oscillator model
// for the selected push force, grip force, and excitation direction; `dataField` is the chart's field.
// `freq` are the measured frequencies of the direction; `v2` is the squared excitation
// velocity |v|² per frequency, needed for the VPA.
function callModelData(Fp, Fg, dataField, freq, betas, v2){
    // Without |v|² in the data the model VPA cannot be computed; the curve is left out.
    if ((dataField === "VPA" || dataField === "ajw") && !v2) return { x: [], y: [] };
    const x = [];
    const y = [];

    const w = freq.map(f => 2*Math.PI*f);

    // Evaluate the force-dependent mass, damping, and stiffness parameters.
    const m_model = matlabModel(Fg, Fp, betas.m); // add resultsMatrix if needed for Matlab modell
    const d_model = matlabModel(Fg, Fp, betas.d); // add resultsMatrix if needed for Matlab modell
    const k_model = matlabModel(Fg, Fp, betas.k); // add resultsMatrix if needed for Matlab modell

    if (!m_model.length || !d_model.length || !k_model.length) {
        console.warn("Model returned empty vectors");
        return { x: [], y: [] };
    }

    // Calculate the complex mechanical impedance of the four-mass model.
    const Zmod = impedance_mkd(m_model, d_model, k_model, w);

    const phase_mod = Zmod.map(z => Math.atan2(z.im, z.re));

    // The impedance chart shows the magnitude |Z|, as in plotMIVPAResultsMatrix_Fp_glModel.m.
    for (let f = 0; f < freq.length; f++) {
        if(dataField === "MI"){
            y.push(Math.hypot(Zmod[f].re, Zmod[f].im));
        }
        if(dataField === "Phase"){
            y.push(phase_mod[f]);
        }
        // VPA = Re(Z) * |v|², as in plotMIVPAResultsMatrix_Fp_glModel.m (abs as in its plot)
        if(dataField === "VPA"){
            y.push(Math.abs(Zmod[f].re * v2[f]));
        }
        // The excitation acceleration behind that |v|²: RMS of |ajw| over the direction's rows
        if(dataField === "ajw"){
            y.push(Math.sqrt(v2[f]) * w[f]);
        }
        x.push(freq[f]);
    }
    return { x, y };
}

// Calculate the complex mechanical impedance of the four-mass oscillator.
// The mass, damping, and stiffness matrices are assembled first, followed by
// the frequency-dependent dynamic stiffness matrix and its complex solution.
function impedance_mkd(m, d, k, w) {
    const n = m.length;

    // Assemble the mass, damping, and stiffness matrices of the lumped-parameter model.
    // Element i couples mass i and i + 1; the last element couples the last mass to ground.
    const M = math.diag(m);
    const chain = c => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) =>
        i === j ? (c[i - 1] ?? 0) + c[i] : Math.abs(i - j) === 1 ? -c[Math.min(i, j)] : 0));
    const C = chain(d);
    const K = chain(k);

    // Apply unit excitation force to the first mass.
    const F = m.map((_, i) => i === 0 ? 1 : 0);

    // Max absolute row sum (Gershgorin upper bound) as the matrix magnitude for the
    // numerical regularization used near singular frequencies.
    const nK = math.norm(K, Infinity);
    const nC = math.norm(C, Infinity);
    const nM = math.norm(M, Infinity);

    const tolRcond = 1e-12;
    const tau = 1e-8;

    // Solve the model independently at each excitation frequency.
    return w.map(wi => {
        // Construct the complex dynamic stiffness matrix:
        // D = K - ω²M + iωC.
        const D = math.add(math.subtract(K, math.multiply(wi * wi, M)), math.multiply(math.complex(0, wi), C));

        // Estimate the conditioning from the ratio of the smallest to largest diagonal magnitudes
        // and add a small diagonal regularization when the matrix is close to singular.
        const diag = D.map((row, j) => math.abs(row[j]));
        const rc = Math.max(...diag) === 0 ? 0 : Math.min(...diag) / Math.max(...diag);
        if (rc < tolRcond) {
            const eps = tau * (nK + wi * nC + wi * wi * nM);
            for (let j = 0; j < n; j++) D[j][j] = math.add(D[j][j], eps);
        }

        // Velocity of the first mass v = iω·q; mechanical impedance is force divided by velocity.
        const q = math.lusolve(D, F)[0][0];
        return math.divide(1, math.multiply(math.complex(0, wi), q));
    });
}

function writeMeta(meta) {
    if (!meta) return;

    Object.entries(meta).forEach(([key, value]) => {
        const el = document.getElementById(key);
        if (!el) return;

        el.textContent =
            typeof value === "number"
                ? value.toFixed(1)
                : value;
    });
}

// Mean squared excitation velocity |v|² per frequency over the measurement rows
// that carry it (optional field "v2"); null when the data has none.
function meanV2(rows) {
    const v = rows.map(r => r.v2).filter(Array.isArray);
    if (!v.length) return null;
    return v[0].map((_, i) => math.mean(v.map(a => a[i])));
}

function clampPositive(vec, eps = 1e-9) {
    return vec.map(v => Math.max(v, eps));
}

// Evaluate the force-dependent model coefficients using the regression vector
// [1, Fg, Fp, Fg * Fp].
// TODO: Include measurement-dependent terms if the model is later extended
// to use subject-specific input data, see next two comments.
function matlabModel(Fg, Fp, modelMat) { // add resultsMatrix as argument when Matlab model will be dependent on resMat
    if (!modelMat) return []; //if (!modelMat || !resultsMatrix) return [];

    const result = math.multiply([1, Fg, Fp, Fg * Fp], math.transpose(modelMat));
    // Clamp to a small positive value like the MATLAB model (max(x, 1e-9))
    return clampPositive(Array.isArray(result) ? result.flat() : [result]);
}

// `scale` converts units for display (e.g. 1000 for kg -> g)
function writeVector(prefix, vec, scale = 1, fmt = v => v.toFixed(1)) {
    vec.forEach((v, i) => {
        document.getElementById(`${prefix}${i + 1}`).textContent =
            fmt(Number(v) * scale);
    });
}
