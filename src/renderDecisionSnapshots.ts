
import type { jsPDF } from "jspdf";

type Snapshot = Record<string, any>;

const asArray = (value: unknown): any[] =>
  Array.isArray(value) ? value : [];

const display = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length ? value.map(display).join("; ") : "None";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${humanize(key)}: ${display(val)}`)
      .join("; ");
  }
  return String(value);
};

const humanize = (value: string): string =>
  value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const confidence = (value: unknown): string => {
  if (typeof value !== "number") return "Not recorded";
  return `${Math.round(value <= 1 && value >= 0 ? value * 100 : value)}%`;
};

const formatDate = (value: unknown): string => {
  if (typeof value !== "string") return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

export function renderDecisionSnapshots(
  doc: jsPDF,
  snapshots: Snapshot[]
): void {
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };

  const ensureSpace = (height = 10) => {
    if (y + height > pageHeight - 20) newPage();
  };

  const write = (
    value: unknown,
    options: { bold?: boolean; size?: number; indent?: number } = {}
  ) => {
    const size = options.size ?? 9;
    const indent = options.indent ?? 0;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(35, 45, 60);

    const lines = doc.splitTextToSize(
      display(value),
      contentWidth - indent
    ) as string[];

    for (const line of lines) {
      ensureSpace(5.5);
      doc.text(line, margin + indent, y);
      y += 5.5;
    }
    y += 2;
  };

  const heading = (title: string) => {
    ensureSpace(16);
    y += 3;
    write(title, { bold: true, size: 12 });
    doc.setDrawColor(225, 230, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  const field = (name: string, value: unknown) => {
    ensureSpace(12);
    write(name, { bold: true, size: 8 });
    write(value);
  };

  const section = (name: string, values: unknown) => {
    heading(name);
    const entries = asArray(values);

    if (!entries.length) {
      write("None recorded");
      return;
    }

    entries.forEach((entry, index) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        write(
          `${index + 1}. ${display(
            entry.statement ?? entry.description ?? entry.text ?? "Record"
          )}`,
          { bold: true }
        );

        Object.entries(entry).forEach(([key, value]) => {
          if (["statement", "description", "text"].includes(key)) return;
          if (value === null || value === undefined) return;
          write(`${humanize(key)}: ${display(value)}`, {
            size: 8,
            indent: 4,
          });
        });
      } else {
        write(`${index + 1}. ${display(entry)}`);
      }
      y += 3;
    });
  };

  newPage();
  heading("Decision Snapshots");

  if (!snapshots.length) {
    write("No decision snapshots recorded.");
    return;
  }

  snapshots.forEach((snapshot, index) => {
    if (index > 0) newPage();

    heading(
      `Snapshot ${index + 1}: ${
        snapshot.title ?? snapshot.name ?? "Decision Snapshot"
      }`
    );

    field("Snapshot Reference", snapshot.snapshot_id ?? snapshot.id);
    field("Decision Status", humanize(display(snapshot.status)));
    field(
      "Captured At",
      formatDate(snapshot.captured_at ?? snapshot.created_at)
    );
    field(
      "Captured By",
      snapshot.captured_by ?? snapshot.created_by
    );

    heading("AI Recommendation at Capture");
    write(snapshot.ai_recommendation ?? snapshot.recommendation);

    heading("Evidence at Capture");

    const evidence = asArray(snapshot.evidence_at_capture);

    if (!evidence.length) {
      write("No evidence recorded.");
    }

    evidence.forEach((item, evidenceIndex) => {
      if (!item || typeof item !== "object") return;

      ensureSpace(20);

      write(
        `${display(item.claim_code ?? `Evidence ${evidenceIndex + 1}`)} — ${display(item.statement)}`,
        { bold: true }
      );

      write(
        `Agent: ${display(item.agent_name)} | Type: ${display(item.claim_type)} | Confidence: ${confidence(item.confidence)}`,
        { size: 8 }
      );

      write(
        `Verification: ${humanize(display(item.verification_status))}`,
        { size: 8 }
      );

      if (item.evidence_classification) {
        field("Evidence Classification", item.evidence_classification);
      }

      if (asArray(item.assumptions).length) {
        field("Underlying Assumptions", item.assumptions);
      }

      if (asArray(item.evidence_refs).length) {
        field("Supporting References", item.evidence_refs);
      }

      if (item.source_reference) {
        field("Source Reference", item.source_reference);
      }

      if (item.verified_by) {
        field("Verified By", item.verified_by);
      }

      if (item.verified_at) {
        field("Verified At", formatDate(item.verified_at));
      }

      ensureSpace(5);
      doc.setDrawColor(225, 230, 235);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    });

    section("Verified Facts", snapshot.verified_facts);
    section("Reported Facts", snapshot.reported_facts);
    section("Assumptions", snapshot.assumptions);
    section("AI Inferences", snapshot.ai_inferences);
    section("Outstanding Uncertainties", snapshot.outstanding_uncertainties);
  });
}
