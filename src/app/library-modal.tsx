import { useMemo, useState } from "react";
import {
  SCRIPT_LIBRARY,
  type LibrarySection,
} from "~/lib/library";
import {
  COMPLIANCE_GUARDRAILS,
  COMPOUNDS,
  type Compound,
} from "~/lib/cheatsheet";

export type LibraryTab = "scripts" | "products";

// Renders text containing placeholder tokens:
//   {{GAP:detail}} → standard red "[ASK OWNER — do not state a number]" chip
//   {{ASK:label}}  → red "[ASK OWNER — <label>]" chip
// PLACEHOLDER POLICY (Feasibility items 8/10): these chips must be impossible
// to miss — a rep should never accidentally state a value the owner hasn't
// confirmed.
export function AskOwnerChip({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  return (
    <span
      title="Real gap in the owner's materials — escalate to the owner; do not state a value."
      className="mx-0.5 inline-block max-w-full align-baseline"
    >
      <span className="inline-flex flex-wrap items-center gap-1 rounded border border-[#fca5a5] bg-[#fee2e2] px-1.5 py-0.5 text-xs font-bold text-[#991b1b]">
        <span aria-hidden>⚠</span>
        <span>{label}</span>
        {detail && (
          <span className="font-semibold text-[#b91c1c]">{detail}</span>
        )}
      </span>
    </span>
  );
}

const TOKEN_RE = /\{\{(GAP|ASK):([^}]*)\}\}/g;

export function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const content = m[2].trim();
    if (m[1] === "ASK") {
      parts.push(<AskOwnerChip key={key++} label={`[ASK OWNER — ${content}]`} />);
    } else {
      parts.push(
        <AskOwnerChip key={key++} label="[ASK OWNER — do not state a number]" detail={content} />,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function itemText(item: { title: string; say?: string; lines?: string[] }): string {
  return [item.title, item.say ?? "", ...(item.lines ?? [])].join(" ").toLowerCase();
}

function SayThis({ text }: { text: string }) {
  return (
    <p className="mb-1.5 rounded-md border border-[#bfdbfe] bg-[#eff6ff] p-2.5 font-medium text-[#1e3a8a]">
      <span className="mr-1 text-xs font-bold uppercase tracking-wide text-[#1e40af]">
        Say:
      </span>
      “{text}”
    </p>
  );
}

function SectionBlock({ section }: { section: LibrarySection }) {
  return (
    <section className="mb-5">
      <h3 className="m-0 mb-0.5 text-base font-bold text-[#111827]">{section.title}</h3>
      {section.blurb && (
        <p className="mb-2 mt-0 text-xs text-gray-500">{section.blurb}</p>
      )}
      <div className="space-y-2.5">
        {section.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <h4 className="m-0 mb-1 text-sm font-bold text-[#1f2937]">{item.title}</h4>
            {item.say && <SayThis text={item.say} />}
            {item.lines && (
              <ul className="m-0 list-none space-y-1 p-0 text-sm text-[#374151]">
                {item.lines.map((line, i) => (
                  <li key={i}>
                    <RichText text={line} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CompoundCard({ c }: { c: Compound }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <h4 className="m-0 text-sm font-bold text-[#1f2937]">{c.name}</h4>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
          {c.sizes}
        </span>
        <span className="rounded bg-[#eff6ff] px-1.5 py-0.5 text-xs font-semibold text-[#1e40af]">
          {c.category}
        </span>
      </div>
      <p className="m-0 mb-1 text-sm text-[#374151]">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Mechanism (research):{" "}
        </span>
        <RichText text={c.mechanism} />
      </p>
      <p className="m-0 text-sm text-[#374151]">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Why it moves:{" "}
        </span>
        <RichText text={c.strengths} />
      </p>
      {c.flags && (
        <ul className="mb-0 mt-1.5 list-none space-y-1 p-0">
          {c.flags.map((f, i) => (
            <li key={i} className="text-sm font-semibold">
              <RichText text={f} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LibraryModal({
  tab,
  onTab,
  onClose,
}: {
  tab: LibraryTab;
  onTab: (t: LibraryTab) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sections = useMemo(
    () =>
      SCRIPT_LIBRARY.map((s) => ({
        ...s,
        items: q ? s.items.filter((i) => itemText(i).includes(q)) : s.items,
      })).filter((s) => s.items.length > 0),
    [q],
  );

  const compounds = useMemo(() => {
    if (!q) return COMPOUNDS;
    return COMPOUNDS.filter((c) =>
      [c.name, c.sizes, c.category, c.mechanism, c.strengths]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [q]);

  const noResults =
    q.length > 0 &&
    ((tab === "scripts" && sections.length === 0) ||
      (tab === "products" && compounds.length === 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[88vh] w-full max-w-[860px] flex-col rounded-xl bg-[#f9fafb] shadow-2xl">
        {/* Header: tabs + search + close */}
        <div className="rounded-t-xl border-b border-gray-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onTab("scripts")}
              className={`rounded-md px-3.5 py-2 text-sm font-bold ${
                tab === "scripts"
                  ? "bg-[#111827] text-white"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
            >
              Scripts & Objections
            </button>
            <button
              onClick={() => onTab("products")}
              className={`rounded-md px-3.5 py-2 text-sm font-bold ${
                tab === "products"
                  ? "bg-[#111827] text-white"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
            >
              Product Cheat-Sheet
            </button>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the library… (e.g. deposit, MOQ, reta, COA)"
              autoFocus
              className="min-w-[180px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={onClose}
              title="Close"
              className="rounded-md bg-gray-200 px-3 py-2 text-sm font-bold text-[#374151] hover:bg-gray-300"
            >
              ✕
            </button>
          </div>
          <p className="m-0 text-xs text-gray-500">
            Red ⚠ chips are real gaps in the owner's materials — never state a
            value for them on a call; escalate to the owner instead.
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "scripts" && (
            <>
              {sections.map((s) => (
                <SectionBlock key={s.id} section={s} />
              ))}
            </>
          )}
          {tab === "products" && (
            <>
              <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3">
                <h3 className="m-0 mb-1 text-sm font-bold text-[#991b1b]">
                  Compliance guardrails — say it exactly this way (from the
                  training guide, verbatim)
                </h3>
                <ul className="m-0 list-disc space-y-0.5 pl-5 text-sm text-[#7f1d1d]">
                  {COMPLIANCE_GUARDRAILS.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2.5">
                {compounds.map((c) => (
                  <CompoundCard key={c.id} c={c} />
                ))}
              </div>
            </>
          )}
          {noResults && (
            <p className="p-6 text-center text-sm text-gray-400">
              Nothing matches “{query}” in this tab.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
