// ==========================================================
// HOUSEHOLD FINANCIAL RESILIENCE INDEX (HFRI)
// Vivaan Agarwal — formulas, constants, weights and bands are taken
// directly from the revised paper and the official HFRI calculator.
//
//   HFRI = 0.05 S + 0.30 D + 0.55 E + 0.10 X
//   D    = 0.40 D_DTI + 0.60 D_DSTI
//
// The weights and bands were chosen and tested on real U.S. families
// (Survey of Consumer Finances 2025 and the 2007-09 SCF Panel).
// ==========================================================

import { HFRI_SITE } from "./site.js";

export const HFRI_LINKS = {
    calculator: HFRI_SITE.calculator,
    paper: HFRI_SITE.research,
    source: HFRI_SITE.source
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Savings Strength: SR = (Y - C) / Y
export const scoreSavings = sr =>
    sr <= -0.10 ? 0 : 100 * (1 - Math.exp(-5.89681 * (sr + 0.10)));

// Debt Sustainability, stock: DTI = outstanding debt / annual income
export const scoreDTI = dti =>
    100 * Math.exp(-0.0573534 * Math.pow(Math.max(dti, 0), 2.13509));

// Debt Sustainability, flow: DSTI = annual debt service / annual income
export const scoreDSTI = dsti =>
    clamp(-521.45598 * dsti * dsti + 9.08245 * dsti + 100.00523, 0, 100);

// Emergency Coverage: EC = liquid savings / monthly essential spending
export const scoreEC = ec =>
    ec === Infinity ? 100 : 100 * (1 - Math.exp(-0.37028 * Math.pow(Math.max(ec, 0), 0.901391)));

// Expense Stability: CV = std dev / mean of monthly spending
export const scoreCV = cv =>
    100 * Math.exp(-3.13957 * Math.pow(Math.max(cv, 0), 1.30837));

export const HFRI_WEIGHTS = { S: 0.05, D: 0.30, E: 0.55, X: 0.10 };

// Bands from the revised paper. Cut-offs sit where the chance of being two months
// or more behind on a loan payment falls to twice the U.S. average (8.2%), the
// average, and half the average. late2025 is that rate in each band (SCF 2025).
export const HFRI_BANDS = [
    { from: 0, max: 35, key: "high-risk", label: "High risk", late2025: 20.8,
      text: "More than twice as likely as the average family to be badly behind on loan payments." },
    { from: 35, max: 55, key: "elevated-risk", label: "Elevated risk", late2025: 12.6,
      text: "An above-average chance of being badly behind on loan payments." },
    { from: 55, max: 70, key: "moderate-risk", label: "Moderate risk", late2025: 7.2,
      text: "Close to the average chance of being badly behind on loan payments." },
    { from: 70, max: Infinity, key: "low-risk", label: "Low risk", late2025: 1.3,
      text: "Well under half the average chance of being badly behind on loan payments." }
];

export const hfriBand = score => HFRI_BANDS.find(b => score < b.max);

// All inputs annual except essentialMonthly; cv is a ratio.
// { income Y, spending C, debt Db, debtService DS, liquid L, essentialMonthly, cv }
export function computeHFRI(inp) {
    const Y = inp.income;
    const sr = (Y - inp.spending) / Y;
    const dti = inp.debt / Y;
    const dsti = inp.debtService / Y;
    const ec = inp.essentialMonthly > 0
        ? inp.liquid / inp.essentialMonthly
        : (inp.liquid > 0 ? Infinity : 0);
    const cv = inp.cv;

    const S = scoreSavings(sr);
    const dtiScore = scoreDTI(dti);
    const dstiScore = scoreDSTI(dsti);
    const D = 0.40 * dtiScore + 0.60 * dstiScore;
    const E = scoreEC(ec);
    const X = scoreCV(cv);

    const w = HFRI_WEIGHTS;
    const total = w.S * S + w.D * D + w.E * E + w.X * X;

    return {
        total,
        band: hfriBand(total),
        indicators: { sr, dti, dsti, ec, cv },
        scores: { S, D, E, X, dtiScore, dstiScore }
    };
}
