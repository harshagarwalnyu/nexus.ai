import PDFDocument from "pdfkit";
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, Header, Footer, PageNumber,
} from "docx";

const BRAND_DARK  = "#0A1628";
const BRAND_BLUE  = "#1E3A5F";
const BRAND_GOLD  = "#C8A74E";
const BRAND_LIGHT = "#F5F7FA";
const TEXT_DARK   = "#1A2B3C";
const TEXT_MED    = "#4A5568";
const RED         = "#C53030";
const GREEN       = "#276749";

const SECTION_LABELS = {
  executive_summary:   "Executive Summary",
  company_overview:    "Company Overview & Health Assessment",
  key_findings:        "Key Findings",
  competitor_analysis: "Competitive Landscape",
  financial_snapshot:  "Financial Snapshot",
  data_sources:        "Data Sources & Methodology",
};

function filterFindings(brief, impactFilter) {
  const findings = brief.key_findings ?? [];
  if (impactFilter === "high") return findings.filter((f) => f.impact === "High");
  return findings;
}

export function generatePDF(payload) {
  return new Promise((resolve, reject) => {
    const { account, brief, sections = Object.keys(SECTION_LABELS), impactFilter = "all" } = payload;
    const findings = filterFindings(brief, impactFilter);
    const chunks = [];

    const doc = new PDFDocument({ margin: 60, size: "LETTER" });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, 280).fill(BRAND_DARK);
    doc
      .fillColor("#FFFFFF")
      .fontSize(11)
      .font("Helvetica")
      .text("OMNISIGHT INTELLIGENCE PLATFORM", 60, 60, { align: "left" });

    doc
      .fillColor(BRAND_GOLD)
      .fontSize(26)
      .font("Helvetica-Bold")
      .text(account.account_name, 60, 100, { align: "left" });

    doc
      .fillColor("#FFFFFF")
      .fontSize(13)
      .font("Helvetica")
      .text(`Investment Intelligence Report`, 60, 140);

    const archetypeColor = brief.updated_archetype?.includes("risk") ? RED : GREEN;
    doc
      .fillColor(archetypeColor)
      .fontSize(11)
      .text(`Health Archetype: ${(brief.updated_archetype ?? "unknown").toUpperCase()}`, 60, 165);

    doc
      .fillColor("#AABBCC")
      .fontSize(9)
      .text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 60, 185);

    doc.fillColor(TEXT_DARK);
    doc.y = 310;

    function heading(text) {
      doc
        .moveDown(0.8)
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor(BRAND_BLUE)
        .text(text.toUpperCase(), { underline: false });
      doc
        .moveTo(60, doc.y + 2)
        .lineTo(doc.page.width - 60, doc.y + 2)
        .strokeColor(BRAND_GOLD)
        .lineWidth(1.5)
        .stroke();
      doc.moveDown(0.4);
      doc.fillColor(TEXT_DARK).fontSize(10).font("Helvetica");
    }

    function body(text) {
      doc.fontSize(10).font("Helvetica").fillColor(TEXT_DARK).text(text, { align: "justify" });
      doc.moveDown(0.3);
    }

    function labelValue(label, value) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT_MED).text(`${label}: `, { continued: true });
      doc.font("Helvetica").fillColor(TEXT_DARK).text(value);
    }

    const selectedSections = sections.length ? sections : Object.keys(SECTION_LABELS);

    if (selectedSections.includes("executive_summary")) {
      heading(SECTION_LABELS.executive_summary);
      body(brief.executive_summary ?? "Not available.");
      if (brief.narrative) body(brief.narrative);
    }

    if (selectedSections.includes("company_overview")) {
      heading(SECTION_LABELS.company_overview);
      labelValue("Industry",    account.industry ?? "N/A");
      labelValue("Region",      account.region ?? "N/A");
      labelValue("ACV",         `$${Number(account.annual_contract_value || 0).toLocaleString()}`);
      labelValue("CRM Archetype",   account.health_archetype ?? "N/A");
      labelValue("Updated Archetype", (brief.updated_archetype ?? "N/A").toUpperCase());
      labelValue("Confidence",  `${((brief.confidence_score ?? 0) * 100).toFixed(0)}%`);
      doc.moveDown(0.4);

      if (brief.risks?.length) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(RED).text("Risks:");
        brief.risks.forEach((r) => body(`• ${r}`));
      }
      if (brief.opportunities?.length) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(GREEN).text("Opportunities:");
        brief.opportunities.forEach((o) => body(`• ${o}`));
      }
    }

    if (selectedSections.includes("key_findings") && findings.length > 0) {
      heading(SECTION_LABELS.key_findings);
      findings.forEach((f, i) => {
        const impactColor = f.impact === "High" ? RED : f.impact === "Medium" ? "#C05621" : TEXT_MED;
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor(impactColor)
          .text(`[${f.impact}]`, { continued: true })
          .fillColor(TEXT_DARK)
          .text(`  ${f.title}`);
        if (f.source) {
          doc.fontSize(8).fillColor(TEXT_MED).text(`Source: ${f.source}`);
        }
        if (f.insight) {
          body(f.insight);
        }
        if (i < findings.length - 1) doc.moveDown(0.3);
      });
    }

    if (selectedSections.includes("financial_snapshot")) {
      heading(SECTION_LABELS.financial_snapshot);
      labelValue("Annual Contract Value", `$${Number(account.annual_contract_value || 0).toLocaleString()}`);
      labelValue("Contract Renewal",      account.contract_renewal_date ?? "N/A");
      labelValue("Days Since Contact",    `${account.days_since_last_contact ?? "N/A"} days`);
    }

    if (selectedSections.includes("data_sources")) {
      heading(SECTION_LABELS.data_sources);
      const sources = brief.data_sources ?? ["Internal CRM (Databricks)", "Gemini AI synthesis"];
      sources.forEach((s) => body(`• ${s}`));
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7)
        .fillColor(TEXT_MED)
        .text(
          `CONFIDENTIAL — Nexus Investment Intelligence — Page ${i + 1}`,
          60,
          doc.page.height - 40,
          { align: "center", width: doc.page.width - 120 }
        );
    }

    doc.end();
  });
}

export async function generateDOCX(payload) {
  const { account, brief, sections = Object.keys(SECTION_LABELS), impactFilter = "all" } = payload;
  const findings = filterFindings(brief, impactFilter);
  const selectedSections = sections.length ? sections : Object.keys(SECTION_LABELS);

  function h1(text) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 120 },
    });
  }

  function p(text, opts = {}) {
    return new Paragraph({
      children: [new TextRun({ text: text ?? "", size: 22, color: "1A2B3C", ...opts })],
      spacing: { after: 100 },
    });
  }

  function bold(label, value) {
    return new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 22 }),
        new TextRun({ text: value ?? "N/A", size: 22 }),
      ],
      spacing: { after: 80 },
    });
  }

  function bullet(text) {
    return new Paragraph({
      children: [new TextRun({ text, size: 22 })],
      bullet: { level: 0 },
      spacing: { after: 60 },
    });
  }

  const bodyParagraphs = [];

  bodyParagraphs.push(
    new Paragraph({
      children: [new TextRun({ text: "Nexus Intelligence Platform", bold: true, size: 20, color: "4A5568" })],
    }),
    new Paragraph({
      children: [new TextRun({ text: account.account_name, bold: true, size: 40, color: "1E3A5F" })],
      spacing: { after: 100 },
    }),
    p(`Investment Intelligence Report — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`),
    p(`Health Assessment: ${(brief.updated_archetype ?? "unknown").toUpperCase()} (${((brief.confidence_score ?? 0) * 100).toFixed(0)}% confidence)`, { bold: true }),
    new Paragraph({ text: "", spacing: { after: 200 } })
  );

  if (selectedSections.includes("executive_summary")) {
    bodyParagraphs.push(h1("Executive Summary"));
    if (brief.executive_summary) bodyParagraphs.push(p(brief.executive_summary));
    if (brief.narrative) bodyParagraphs.push(p(brief.narrative));
  }

  if (selectedSections.includes("company_overview")) {
    bodyParagraphs.push(h1("Company Overview & Health Assessment"));
    bodyParagraphs.push(
      bold("Industry",     account.industry),
      bold("Region",       account.region),
      bold("ACV",          `$${Number(account.annual_contract_value || 0).toLocaleString()}`),
      bold("CRM Archetype",    account.health_archetype),
      bold("Updated Archetype", (brief.updated_archetype ?? "N/A").toUpperCase()),
    );
    if (brief.risks?.length) {
      bodyParagraphs.push(p("Risks:", { bold: true }));
      brief.risks.forEach((r) => bodyParagraphs.push(bullet(r)));
    }
    if (brief.opportunities?.length) {
      bodyParagraphs.push(p("Opportunities:", { bold: true }));
      brief.opportunities.forEach((o) => bodyParagraphs.push(bullet(o)));
    }
  }

  if (selectedSections.includes("key_findings") && findings.length > 0) {
    bodyParagraphs.push(h1("Key Findings"));

    const tableRows = [
      new TableRow({
        children: ["Impact", "Finding", "Insight", "Source"].map(
          (text) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
              shading: { fill: "1E3A5F" },
            })
        ),
        tableHeader: true,
      }),
      ...findings.map(
        (f) =>
          new TableRow({
            children: [
              new TableCell({ children: [p(f.impact)] }),
              new TableCell({ children: [p(f.title)] }),
              new TableCell({ children: [p(f.insight ?? "")] }),
              new TableCell({ children: [p(f.source ?? "")] }),
            ],
          })
      ),
    ];

    bodyParagraphs.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  if (selectedSections.includes("financial_snapshot")) {
    bodyParagraphs.push(h1("Financial Snapshot"));
    bodyParagraphs.push(
      bold("Annual Contract Value", `$${Number(account.annual_contract_value || 0).toLocaleString()}`),
      bold("Contract Renewal",      account.contract_renewal_date),
      bold("Days Since Contact",    `${account.days_since_last_contact ?? "N/A"} days`),
    );
  }

  if (selectedSections.includes("data_sources")) {
    bodyParagraphs.push(h1("Data Sources & Methodology"));
    const sources = brief.data_sources ?? ["Internal CRM (Databricks)", "Gemini AI synthesis"];
    sources.forEach((s) => bodyParagraphs.push(bullet(s)));
  }

  const docx = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Nexus Intelligence Platform  |  CONFIDENTIAL", size: 16, color: "4A5568" }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Page ", size: 16, color: "4A5568" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "4A5568" }),
                  new TextRun({ text: " of ", size: 16, color: "4A5568" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "4A5568" }),
                  new TextRun({ text: "  |  CONFIDENTIAL", size: 16, color: "4A5568" }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: bodyParagraphs,
      },
    ],
  });

  return Packer.toBuffer(docx);
}