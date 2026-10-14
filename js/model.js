// ============================================================================
// Four-mass oscillator model
// ============================================================================

// Calculate the mechanical impedance of the four-mass oscillator model
// for the selected push force, grip force, and excitation direction.
// `freq` are the measured frequencies of the direction; `v2` is the squared excitation
// velocity |v|² per frequency, needed for the VPA.
function callModelData(Fp, Fg, canvasId, freq, betas, v2){
    const dataField = getDataField(canvasId);
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
    const {Zmod} = impedance_mkd(
        m_model,
        d_model,
        k_model,
        w
    );

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
    const M = zeros(n, n);
    for (let i = 0; i < n; i++) M[i][i] = m[i];

    const C = zeros(n, n);
    const K = zeros(n, n);

    for (let i = 0; i < n; i++) {
        if (i > 0) {
            C[i][i - 1] = -d[i - 1];
            K[i][i - 1] = -k[i - 1];
        }
        if (i < n - 1) {
            C[i][i + 1] = -d[i];
            K[i][i + 1] = -k[i];
        }
        if (i === 0) {
            C[i][i] = d[0];
            K[i][i] = k[0];
        } else if (i === n - 1) {
            C[i][i] = d[n - 2] + d[n - 1];
            K[i][i] = k[n - 2] + k[n - 1];
        } else {
            C[i][i] = d[i - 1] + d[i];
            K[i][i] = k[i - 1] + k[i];
        }
    }

    // Apply unit excitation force to the first mass.
    const F = Array(n).fill(null).map(() => ({ re: 1, im: 0 }));
    F[0] = { re: 1, im: 0 };
    for (let i = 1; i < n; i++) F[i] = { re: 0, im: 0 };

    // Estimate matrix magnitudes for the numerical regularization used near singular frequencies.
    const nK = spectralNormApprox(K);
    const nC = spectralNormApprox(C);
    const nM = spectralNormApprox(M);

    const tolRcond = 1e-12;
    const tau = 1e-8;

    const Zmod = [];
    const Ymod = [];

    // Solve the model independently at each excitation frequency.
    for (let i = 0; i < w.length; i++) {
        const wi = w[i];

        // Construct the complex dynamic stiffness matrix:
        // D = K - ω²M + iωC.
        let D = zeros(n, n).map((row, r) =>
            row.map((_, c) => ({
                re: K[r][c] - wi * wi * M[r][c],
                im: wi * C[r][c]
            }))
        );

        const rc = rcondComplex(D);
        // Add a small diagonal regularization when the matrix is close to singular.
        if (rc < tolRcond) {
            const eps = tau * (nK + wi * nC + wi * wi * nM);
            for (let j = 0; j < n; j++) {
                D[j][j].re += eps;
            }
        }

        const q = solveComplex(D, F);

        // Add a small diagonal regularization when the matrix is close to singular.
        const v1 = {
            re: -wi * q[0].im,
            im: wi * q[0].re
        };

        Ymod.push({ ...v1 });
        // Mechanical impedance is defined as force divided by velocity.
        Zmod.push(complexDiv({ re: 1, im: 0 }, v1));
    }

    return { Zmod, Ymod };
}

function zeros(rows, cols) {
    return Array(rows).fill(null).map(() => Array(cols).fill(0));
}

// Gershgorin upper bound: max row sum of |entries|.
// Tight for diagonally dominant matrices like K and C.
// Approximate the matrix norm using the maximum absolute row sum.
// This provides an upper bound that is suitable for the regularization scale
// used for the diagonally dominant stiffness and damping matrices.
function spectralNormApprox(A) {
    let maxRowSum = 0;
    for (let r = 0; r < A.length; r++) {
        let rowSum = 0;
        for (let c = 0; c < A[r].length; c++) {
            rowSum += Math.abs(A[r][c]);
        }
        maxRowSum = Math.max(maxRowSum, rowSum);
    }
    return maxRowSum;
}

// Estimate the conditioning of a complex matrix from the ratio of the
// smallest to largest diagonal magnitudes.
function rcondComplex(A) {
    const n = A.length;
    let maxDiag = 0;
    let minDiag = Infinity;
    for (let i = 0; i < n; i++) {
        const mag = Math.sqrt(A[i][i].re ** 2 + A[i][i].im ** 2);
        if (mag > maxDiag) maxDiag = mag;
        if (mag < minDiag) minDiag = mag;
    }
    return maxDiag === 0 ? 0 : minDiag / maxDiag;
}

// Solve a complex linear system using Gaussian elimination with partial pivoting.
function solveComplex(A, b) {
    const n = A.length;

    const M = A.map(row => row.map(c => ({ re: c.re, im: c.im })));
    const rhs = b.map(c => ({ re: c.re, im: c.im }));

    // Select the row with the largest pivot magnitude to improve numerical stability.
    for (let col = 0; col < n; col++) {
        let maxMag = 0;
        let pivotRow = col;
        for (let row = col; row < n; row++) {
            const mag = M[row][col].re ** 2 + M[row][col].im ** 2;
            if (mag > maxMag) {
                maxMag = mag;
                pivotRow = row;
            }
        }

        [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
        [rhs[col], rhs[pivotRow]] = [rhs[pivotRow], rhs[col]];

        const pivot = M[col][col];

        // Solve the resulting upper-triangular system by back substitution.
        for (let row = col + 1; row < n; row++) {
            const factor = complexDiv(M[row][col], pivot);
            for (let j = col; j < n; j++) {
                M[row][j] = complexSub(M[row][j], complexMul(factor, M[col][j]));
            }
            rhs[row] = complexSub(rhs[row], complexMul(factor, rhs[col]));
        }
    }

    const x = Array(n).fill(null).map(() => ({ re: 0, im: 0 }));
    for (let i = n - 1; i >= 0; i--) {
        let sum = { re: rhs[i].re, im: rhs[i].im };
        for (let j = i + 1; j < n; j++) {
            sum = complexSub(sum, complexMul(M[i][j], x[j]));
        }
        x[i] = complexDiv(sum, M[i][i]);
    }

    return x;
}

// Complex-number helper functions used by the model solver.
function complexMul(a, b) {
    return {
        re: a.re * b.re - a.im * b.im,
        im: a.re * b.im + a.im * b.re
    };
}

// Complex-number helper functions used by the model solver.
function complexDiv(a, b) {
    const denom = b.re * b.re + b.im * b.im;
    return {
        re: (a.re * b.re + a.im * b.im) / denom,
        im: (a.im * b.re - a.re * b.im) / denom
    };
}

// Complex-number helper functions used by the model solver.
function complexSub(a, b) {
    return { re: a.re - b.re, im: a.im - b.im };
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

    const X = buildX(Fg, Fp);
    const result = math.multiply(X, math.transpose(modelMat));
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
