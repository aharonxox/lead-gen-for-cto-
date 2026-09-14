// Script & objection library — the owner's ACTUAL materials, transcribed from
// the File Analyst's extraction (analysis 01, section a) of:
//   - "Peptide Sales Playbook - Cold Call Script.pdf" (brand: Reset)
//   - "Why Partner With Us - Executive Solutions.pdf" (brand: Provider Solutions)
//   - "rep-qa-bank.md.docx" (Rep Q&A Bank + PUO Peptide Training Guide)
//
// PLACEHOLDER POLICY (Feasibility verdict, item 8 — binding): every bracketed
// gap from the QA bank is rendered in-app as a clearly-marked "[ASK OWNER —
// do not state a number]" chip so a rep can never accidentally wing a value.
// Tokens: {{GAP:detail}} → standard ask-owner chip with this detail;
//         {{ASK:label}}  → ask-owner chip with a custom label.
// The UI renders these tokens via <RichText> in app/library-modal.tsx.

export interface LibraryItem {
  id: string;
  title: string;
  // The exact words to say, when the source defines them.
  say?: string;
  lines?: string[];
}

export interface LibrarySection {
  id: string;
  title: string;
  blurb?: string;
  items: LibraryItem[];
}

export const SCRIPT_LIBRARY: LibrarySection[] = [
  {
    id: "playbook",
    title: "The 4-Phase Cold Call Playbook",
    blurb: 'From the owner\'s playbook PDF (brand: "Reset"). Say the words, then listen.',
    items: [
      {
        id: "phase-1",
        title: "Phase 1 — Pattern-Interrupt Opener",
        say: "Hi [Name], I know I'm catching you right in the middle of your day. Do you have 30 seconds to hear why I'm calling, and then you can tell me if you want to hang up?",
        lines: [
          "Permission-based: giving them the right to hang up lowers their defenses.",
        ],
      },
      {
        id: "phase-2",
        title: "Phase 2 — The Wedge",
        say: "We supply 503B wholesale and drop-ship peptides to functional medicine clinics. Almost every clinic we speak to is dealing with two headaches: unpredictable backorders and suppliers handing over generic, stale COAs. Are you running into either?",
      },
      {
        id: "phase-3",
        title: "Phase 3 — Value Proposition",
        lines: [
          "The 50% deposit physically locks inventory in the warehouse — no queue, no backorder.",
          "Every batch is independently tested by AccuMark Labs (California) for purity and endotoxins.",
          "The exact lot-matched COA ships with the order.",
        ],
      },
      {
        id: "phase-4",
        title: "Phase 4 — The Ask & Follow-Up",
        lines: [
          "{{ASK:The Ask & Follow-Up}} This phase exists in the playbook PDF but its text is blank in the source document. Ask the owner exactly what to say here before running this phase on a live call.",
        ],
      },
    ],
  },
  {
    id: "objections",
    title: "Objection Cards",
    blurb: "The four objections the playbook pre-answers. Lead with the mechanism, not a discount.",
    items: [
      {
        id: "deposit",
        title: "\u201cWhy the 50% deposit?\u201d",
        say: "Our 50% deposit physically locks your inventory at our facility. You will never deal with backorders.",
        lines: [
          "It's the mechanism that physically sets inventory aside — that is the whole point.",
          "Balance is due before shipment; payment terms: 50% deposit, balance before shipment.",
        ],
      },
      {
        id: "moq",
        title: "\u201cYour 100-vial minimum is too high for us.\u201d",
        say: "You don't need 100 vials of one SKU. You can mix and match across Tirzepatide, Semaglutide, and BPC-157 to hit your minimums.",
        lines: [
          "You can't go below the 100-vial MOQ, but you CAN mix and match across the catalog to reach it.",
          "{{GAP:Confirm with owner — is mixing actually allowed? (The QA bank itself flags this as unconfirmed.)}}",
        ],
      },
      {
        id: "late-shipment",
        title: "\u201cWhat if the shipment is delayed?\u201d",
        lines: [
          "Orders ship in cold-chain packaging. If a shipment is more than 1 week past its commitment, that invoice gets a 15% discount — an actual discount, not a future credit.",
          "{{GAP:CLARIFY — does the 15% clock start at the promised ship date or the delivery date?}}",
        ],
      },
      {
        id: "online-pharmacy",
        title: "\u201cWe just send patients to an online pharmacy.\u201d",
        lines: [
          "That's exactly why we exist: direct-to-patient drop-ship is your zero-overhead backend safety net — no stock held, cold-chain dispatch per order.",
        ],
      },
    ],
  },
  {
    id: "trust",
    title: "Trust Rules",
    blurb: "The trust architecture from the playbook. These four rules are non-negotiable.",
    items: [
      {
        id: "idk",
        title: "The \u201cI don't know\u201d rule",
        lines: [
          "A same-day precise callback beats a confident guess — every time. If you don't know, say so and book the callback.",
        ],
      },
      {
        id: "lane",
        title: "Stay in your lane",
        say: "I handle supply, quality, and logistics.",
        lines: [
          "No clinical advice — ever. Anything clinical goes to their providers.",
        ],
      },
      {
        id: "proof",
        title: "Sell the proof",
        lines: [
          "Name the lab: every batch is tested by AccuMark Labs (independent, California) for purity and endotoxins, and the exact lot-matched COA ships with the order.",
        ],
      },
      {
        id: "de-risk",
        title: "De-risk the trial",
        lines: [
          "Make the first order easy to say yes to: mix-and-match MOQ plus the 15% late-shipment discount takes the risk off their side.",
        ],
      },
    ],
  },
  {
    id: "escalation",
    title: "Escalation Rules",
    blurb: "Verbatim from the QA bank. There are exactly three routes — use them.",
    items: [
      {
        id: "technical",
        title: "Technical unknowns",
        lines: ["\u2192 Same-day callback. Log it as a callback and book it before you hang up."],
      },
      {
        id: "clinical",
        title: "Anything clinical",
        say: "I handle supply, quality, and logistics. Your providers make the clinical calls.",
        lines: ["\u2192 The boundary line, word for word. Then move back to supply."],
      },
      {
        id: "regulatory",
        title: "Anything regulatory",
        lines: [
          "\u2192 Route to the owner. No exceptions. Do not improvise, do not speculate.",
        ],
      },
    ],
  },
  {
    id: "partner-brief",
    title: "Partner Brief — \u201cWhy Partner With Us\u201d",
    blurb: 'From the executive partner PDF (brand: "Provider Solutions") — the back-half of a warm call.',
    items: [
      {
        id: "pillars",
        title: "The four pillars",
        lines: [
          "Lot-specific AccuMark Labs (Anaheim, CA) COAs — HPLC purity %, mass-spec identity, endotoxins.",
          "Zero-backorder 50% deposit allocation.",
          "Cold-chain shipping + 15% late-ship discount when more than 7 days past commitment.",
          "SKU mixing / flexible MOQs across metabolic, repair, and longevity categories.",
        ],
      },
      {
        id: "fulfillment",
        title: "Two fulfillment models",
        lines: [
          "Wholesale & 503B bulk supply — tiered volume pricing, mix tiers, lot traceability for compliance.",
          "Direct-to-patient drop-ship — no stock held, cold-chain dispatch per order.",
        ],
      },
      {
        id: "portfolio",
        title: "Portfolio highlights",
        lines: [
          "Weight & Metabolic — Tirzepatide & Retatrutide (5 mg–120 mg vials).",
          "Tissue & Cellular Repair — BPC-157 & TB-500 blends.",
          "Longevity & Energy — MOTS-c & NAD+ (lyophilized vials).",
        ],
      },
      {
        id: "onboarding",
        title: "Onboarding in 3 steps",
        lines: [
          "1. Select program & SKUs.  2. 50% deposit allocation.  3. Dispatch & COA release.",
          "Account Executive line: +1 310-492-3261.",
        ],
      },
    ],
  },
  {
    id: "qa-bank",
    title: "Rep QA Bank — What Clinics Ask",
    blurb:
      "Answers from the owner's QA bank. Red chips are real gaps — never state a number or detail for them; escalate instead.",
    items: [
      {
        id: "moq-qa",
        title: "Minimum order",
        lines: [
          "MOQ is 100 vials. Can't go below it, but you can mix SKUs to reach it. {{GAP:Confirm with owner — is mixing actually allowed?}}",
        ],
      },
      {
        id: "pricing-qa",
        title: "Pricing",
        lines: [
          "Per-vial, volume-scaled. Never quote tier breaks from memory — \u201csend me your monthly volume and I'll get exact numbers same day.\u201d",
        ],
      },
      {
        id: "payment-qa",
        title: "Payment terms",
        lines: ["50% deposit, balance before shipment."],
      },
      {
        id: "leadtime-qa",
        title: "Lead time",
        lines: ["{{GAP:NEEDS A NUMBER — lead time.}}"],
      },
      {
        id: "coldchain-qa",
        title: "Cold-chain shipping",
        lines: [
          "Cold-chain packaging on every order. {{GAP:NEEDS DETAIL — packaging, temp range, temperature indicator.}}",
        ],
      },
      {
        id: "storage-qa",
        title: "Storage",
        lines: [
          "Refrigerated storage. {{GAP:NEEDS DETAIL — temp range; lyophilized vs liquid differ.}}",
        ],
      },
      {
        id: "late-ship-qa",
        title: "Late shipment",
        lines: [
          "More than 1 week past commitment = 15% off that invoice (not a future credit). {{GAP:CLARIFY — clock starts at promised ship date or delivery date?}}",
        ],
      },
      {
        id: "damaged-qa",
        title: "Damaged / temperature-compromised product",
        lines: [
          "Full refund on the affected product. Photo BEFORE unpacking, same-day notice required.",
        ],
      },
      {
        id: "shelflife-qa",
        title: "Shelf life",
        lines: [
          "{{GAP:NEEDS SPLIT — lyophilized unopened vs liquid SKUs (B12, BAC water, L-carnitine, Lemon Bottle, Lipo-C); dating from manufacture or delivery.}}",
        ],
      },
      {
        id: "lot-qa",
        title: "Lot traceability",
        lines: ["{{GAP:NEEDS ANSWER — lot traceability.}}"],
      },
      {
        id: "coa-qa",
        title: "COAs & testing",
        lines: [
          "A COA comes with every lot — the exact lot you're receiving. Tested by AccuMark Labs (independent, Anaheim CA): purity & endotoxins. {{GAP:CONFIRM panel — identity by mass spec? heavy metals? sterility?}}",
        ],
      },
      {
        id: "accreditation-qa",
        title: "Lab accreditation",
        lines: [
          "{{GAP:ANSWER HONESTLY — don't imply ISO 17025 if not.}}",
        ],
      },
      {
        id: "golden-sample-qa",
        title: "Golden sample vs every-lot testing",
        lines: ["{{GAP:Say which applies, honestly — golden sample or every-lot.}}"],
      },
      {
        id: "failed-lot-qa",
        title: "Failed-lot disposition",
        lines: ["{{GAP:NEEDS AN ANSWER — failed-lot disposition.}}"],
      },
    ],
  },
];
