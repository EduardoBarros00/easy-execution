import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/api/public/report-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: { token: string; payload: ReportPdfPayload };
        try {
          parsed = await parseReportRequest(request);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid request";
          return new Response(message, { status: message === "Unauthorized" ? 401 : 400 });
        }

        const { token, payload } = parsed;

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Backend configuration missing", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        const pdfBytes = buildReportPdf(payload);
        const fileName = sanitizePdfFileName(payload.fileName);
        const fallbackFileName = toAsciiFileName(fileName);
        const encodedFileName = encodeURIComponent(fileName);

        return new Response(pdfBytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`,
            "Content-Length": String(pdfBytes.byteLength),
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});

const beneficiarySchema = z.object({
  patientName: z.string(),
  superior: z.string(),
  inferior: z.string(),
  date: z.string(),
});

const summarySchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitValue: z.number(),
  totalValue: z.number(),
});

const reportPdfSchema = z.object({
  fileName: z.string().min(1).max(180),
  cityName: z.string().min(1).max(180),
  period: z.string().min(1).max(180),
  emittedAt: z.string().min(1).max(80),
  beneficiaries: z.array(beneficiarySchema).max(2000),
  summaries: z.array(summarySchema).max(500),
});

type ReportPdfPayload = z.infer<typeof reportPdfSchema>;

async function parseReportRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const authHeader = request.headers.get("authorization");

  if (contentType.includes("application/json")) {
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    return {
      token: authHeader.replace("Bearer ", "").trim(),
      payload: reportPdfSchema.parse(await request.json()),
    };
  }

  const form = await request.formData();
  const token = String(form.get("access_token") ?? "").trim();
  const payloadText = String(form.get("payload") ?? "");
  if (!token || !payloadText) throw new Error("Unauthorized");

  return {
    token,
    payload: reportPdfSchema.parse(JSON.parse(payloadText)),
  };
}

function buildReportPdf(payload: ReportPdfPayload) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text("RELATÓRIO DE ATIVIDADES", 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(payload.cityName, 105, 21, { align: "center" });
  doc.text(payload.period, 105, 26, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Emitido em ${payload.emittedAt}`, 105, 31, { align: "center" });

  autoTable(doc, {
    startY: 36,
    head: [["NOME DO BENEFICIÁRIO", "SUPERIOR", "INFERIOR", "DATA"]],
    body: payload.beneficiaries.map((row) => [
      row.patientName.toUpperCase(),
      row.superior,
      row.inferior,
      row.date,
    ]),
    styles: { fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
    theme: "grid",
  });

  const summaryRows = payload.summaries.map((row) => [
    row.description,
    String(row.quantity).padStart(2, "0"),
    brl(row.unitValue),
    brl(row.totalValue),
  ]);
  const valorGlobal = payload.summaries.reduce((sum, row) => sum + row.totalValue, 0);
  summaryRows.push(["VALOR GLOBAL", "", "", brl(valorGlobal)]);

  autoTable(doc, {
    startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 36) + 6,
    head: [["DESCRIÇÃO", "QTD", "VLR.UND", "VLR.TOTAL"]],
    body: summaryRows,
    styles: { fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    theme: "grid",
    didParseCell: (data) => {
      if (data.row.index === summaryRows.length - 1) data.cell.styles.fontStyle = "bold";
    },
  });

  return doc.output("arraybuffer");
}

function sanitizePdfFileName(fileName: string) {
  const normalized = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  return normalized.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 180);
}

function toAsciiFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "-");
}