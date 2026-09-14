// Product cheat-sheet — the Priority 10 compounds the PUO training guide says
// every rep must master (analysis 01, section a, file 4). Mechanisms are
// deliberately phrased in research language — see the compliance guardrails
// below, which are included VERBATIM from the training guide.
//
// PLACEHOLDER POLICY (Feasibility verdict, item 10 — same as item 8): the
// CJC-1295 DAC question is a real unknown and renders as an "[ASK OWNER]"
// chip ({{GAP:…}} tokens; rendered by <RichText> in app/library-modal.tsx).

export interface Compound {
  id: string;
  name: string;
  sizes: string;
  category: string;
  mechanism: string; // one line, RUO-phrased
  strengths: string; // catalog positioning — why it moves
  flags?: string[]; // hard handling rules shown as badges
}

export const COMPLIANCE_GUARDRAILS: string[] = [
  "RUO language only — \u201chas been studied for,\u201d \u201cin animal/cell research.\u201d",
  "Never present preclinical findings as proven human outcomes.",
  "An FDA-approved drug existing (e.g. bremelanotide) doesn't make an RUO vial approved.",
];

export const COMPOUNDS: Compound[] = [
  {
    id: "retatrutide",
    name: "Retatrutide",
    sizes: "5–60 mg list",
    category: "Weight & Metabolic",
    mechanism:
      "Triple agonist (GLP-1 / GIP / glucagon) studied in research models for weight and metabolic outcomes.",
    strengths:
      "The metabolic anchor of the catalog — the most-asked-for research compound in the metabolic category, and the lead SKU of the partner brief's Weight & Metabolic section.",
  },
  {
    id: "tirzepatide",
    name: "Tirzepatide",
    sizes: "5 mg–120 mg vials",
    category: "Weight & Metabolic",
    mechanism:
      "Dual agonist (GLP-1 / GIP) studied in research models for weight and glycemic outcomes.",
    strengths:
      "The demand driver clinics already know by name; ships with the same deposit/allocation mechanics as the rest of the catalog.",
    flags: [
      "Handled via the 503A pathway — NOT an RUO SKU. Confirm the pathway before quoting.",
    ],
  },
  {
    id: "tesamorelin-ipamorelin",
    name: "Tesamorelin / Ipamorelin",
    sizes: "10/2 mg, 10/5 mg",
    category: "GH / Body Composition",
    mechanism:
      "GHRH analog plus a ghrelin-mimetic GHRP — studied in research models for growth-hormone pulse and visceral-fat outcomes.",
    strengths:
      "Answers the \u201cwhich secretagogue?\u201d question with a paired GHRH+GHRP blend; two stock ratios cover most asks.",
  },
  {
    id: "cjc-ipamorelin",
    name: "CJC-1295 / Ipamorelin",
    sizes: "10/10 mg",
    category: "GH / Body Composition",
    mechanism:
      "GHRH analog paired with a ghrelin-mimetic GHRP — the classic growth-hormone-pulse research combination.",
    strengths:
      "The most-recognized secretagogue pairing on the list; a reliable MOQ-filler across categories.",
    flags: ["{{GAP:CJC-1295 DAC or no DAC? Confirm before speaking to versions.}}"],
  },
  {
    id: "selank",
    name: "Selank",
    sizes: "10 mg",
    category: "Neuro / Longevity",
    mechanism:
      "Synthetic heptapeptide related to tuftsin — studied in animal research for anxiety and focus pathways.",
    strengths:
      "Steady wellness-clinic demand in the neuro category; a natural companion SKU to Semax.",
  },
  {
    id: "semax",
    name: "Semax",
    sizes: "30 mg",
    category: "Neuro / Longevity",
    mechanism:
      "Synthetic heptapeptide related to ACTH(4–10) — studied in animal/cell research for cognitive and neuro-support pathways.",
    strengths:
      "Pairs with Selank in nearly every neuro conversation; 30 mg stock supports heavier research protocols.",
  },
  {
    id: "bpc-tb",
    name: "BPC-TB (BPC-157 + TB-500)",
    sizes: "5+5 mg, 10+10 mg",
    category: "Tissue & Cellular Repair",
    mechanism:
      "Stable gastric pentadecapeptide plus thymosin β4 fragment — the two most-studied repair peptides in one blend.",
    strengths:
      "The repair anchor: one SKU covers most \u201ctissue/repair\u201d asks, and the partner brief leads its Tissue & Cellular Repair section with BPC-157 & TB-500 blends.",
  },
  {
    id: "ghk-cu",
    name: "GHK-Cu",
    sizes: "50 mg, 100 mg",
    category: "Tissue & Cellular Repair",
    mechanism:
      "Copper-binding tripeptide studied in skin, tissue-remodeling and regeneration research.",
    strengths:
      "Aesthetic-clinic favorite and a high-margin add-on to metabolic conversations; two sizes make mixing easy.",
  },
  {
    id: "glow",
    name: "GLOW (GHK-Cu + BPC-157 + TB-500)",
    sizes: "70 mg blend",
    category: "Tissue & Cellular Repair",
    mechanism:
      "Three-research-peptide blend — copper peptide plus BPC-157 plus TB-500 — covering skin, tissue and recovery research in one vial.",
    strengths:
      "The \u201cone vial, whole protocol\u201d blend: the easiest single add to a mixed MOQ order and a strong first-blend recommendation.",
  },
  {
    id: "kpv",
    name: "KPV",
    sizes: "5 mg, 10 mg",
    category: "Tissue & Cellular Repair",
    mechanism:
      "C-terminal fragment of α-MSH studied in anti-inflammatory and gut/skin research models.",
    strengths:
      "Low-cost add-on that rounds out repair and gut conversations; small sizes make the 100-vial MOQ painless to reach.",
  },
];
