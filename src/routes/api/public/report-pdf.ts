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

        const liveData = await loadLiveReportData(supabase as any, payload);
        const pdfBytes = buildReportPdf(payload, liveData);
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

type LiveOrder = {
  code: string | null;
  patient_name: string | null;
  service_type: string | null;
  prosthesis_type_id: string | null;
  price: number | string | null;
  status: string | null;
  delivered_at: string | null;
  created_at: string;
};

type ClassifiedOrder = LiveOrder & {
  modality: "PT" | "PPR" | null;
  units: number;
  description: string;
  superior: string;
  inferior: string;
  date: string;
};

type LiveReportData = {
  cityLabel: string;
  ptUnit: number | null;
  pprUnit: number | null;
  orders: ClassifiedOrder[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em Produção",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

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

function parseBrazilianDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function parsePeriod(period: string) {
  const match = period.match(/Período:\s*(\d{2}\/\d{2}\/\d{4}|\.\.\.)\s*a\s*(\d{2}\/\d{2}\/\d{4}|\.\.\.)/i);
  if (!match) return { from: null as string | null, to: null as string | null };
  return {
    from: match[1] === "..." ? null : parseBrazilianDate(match[1]),
    to: match[2] === "..." ? null : parseBrazilianDate(match[2]),
  };
}

function serviceClassification(serviceType: string | null, typeName: string | null) {
  const raw = `${serviceType ?? ""} ${typeName ?? ""}`.trim().toUpperCase();
  let modality: "PT" | "PPR" | null = null;
  if (/\bPPR\b/.test(raw) || raw.includes("PRÓTESE PARCIAL REMOVÍVEL") || raw.includes("PROTESE PARCIAL REMOVIVEL")) {
    modality = "PPR";
  } else if (/\bPT\b/.test(raw) || raw.includes("PRÓTESE TOTAL") || raw.includes("PROTESE TOTAL")) {
    modality = "PT";
  }

  const hasSuperior = /\b(SUP|SUPERIOR)\b/.test(raw);
  const hasInferior = /\b(INF|INFERIOR|INFERIOS)\b/.test(raw) || raw.includes("INFERI");
  const units = hasSuperior && hasInferior ? 2 : 1;
  const label = modality ?? raw.replace(/\b(SUPERIOR|SUP|INFERIOR|INFERIOS|INF)\b/g, "").trim().split(/\s+/)[0] ?? "—";

  return {
    modality,
    units,
    superior: hasSuperior || (!hasSuperior && !hasInferior) ? label || "—" : "-",
    inferior: hasInferior ? label || "—" : "-",
  };
}

function canonicalServiceDescription(order: ClassifiedOrder) {
  if (!order.modality) return order.description;
  const hasSuperior = order.superior !== "-";
  const hasInferior = order.inferior !== "-";
  if (hasSuperior && hasInferior) return `${order.modality} superior e inferior`;
  if (hasSuperior) return `${order.modality} superior`;
  if (hasInferior) return `${order.modality} inferior`;
  return order.modality;
}

async function loadLiveReportData(supabase: any, payload: ReportPdfPayload): Promise<LiveReportData | null> {
  if (payload.cityName.toLowerCase().includes("todas as cidades")) return null;

  const requestedCityName = payload.cityName.split(" / ")[0].trim();
  const { data: city } = await supabase
    .from("cities")
    .select("id,name,uf")
    .eq("name", requestedCityName)
    .maybeSingle();

  if (!city?.id) return null;

  const [{ data: prices }, { data: typeRows }, { data: orderRows }] = await Promise.all([
    supabase
      .from("city_service_prices")
      .select("service_code,unit_price,active")
      .eq("city_id", city.id)
      .eq("active", true),
    supabase.from("prosthesis_types").select("id,name"),
    supabase
      .from("service_orders")
      .select("code,patient_name,service_type,prosthesis_type_id,price,status,delivered_at,created_at")
      .eq("city_id", city.id)
      .order("created_at", { ascending: true }),
  ]);

  const typeMap = new Map<string, string>((typeRows ?? []).map((row: any) => [row.id, row.name]));
  const { from, to } = parsePeriod(payload.period);

  const orders: ClassifiedOrder[] = ((orderRows ?? []) as LiveOrder[])
    .filter((order) => order.status !== "cancelled")
    .filter((order) => {
      const ref = (order.delivered_at ?? order.created_at ?? "").slice(0, 10);
      if (from && ref < from) return false;
      if (to && ref > to) return false;
      return true;
    })
    .map((order) => {
      const typeName = order.prosthesis_type_id ? typeMap.get(order.prosthesis_type_id) ?? null : null;
      const classified = serviceClassification(order.service_type, typeName);
      const description = order.service_type || typeName || classified.modality || "Serviço";
      const refDate = (order.delivered_at ?? order.created_at ?? "").slice(0, 10);
      return {
        ...order,
        ...classified,
        description,
        date: formatIsoDate(refDate),
      };
    });

  const priceMap = new Map<string, number>();
  for (const row of prices ?? []) priceMap.set(String(row.service_code), Number(row.unit_price ?? 0));

  return {
    cityLabel: `${city.name} / ${city.uf}`,
    ptUnit: priceMap.has("PT") ? priceMap.get("PT")! : null,
    pprUnit: priceMap.has("PPR") ? priceMap.get("PPR")! : null,
    orders,
  };
}

function formatIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "—";
}

function buildReportPdf(payload: ReportPdfPayload, liveData: LiveReportData | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const lastY = () => ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 36);
  const sectionTitle = (text: string, y: number) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(text, 14, y);
    doc.setFont("helvetica", "normal");
  };

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE ATIVIDADES", 105, 15, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(liveData?.cityLabel ?? payload.cityName, 105, 21, { align: "center" });
  doc.text(payload.period, 105, 26, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Emitido em ${payload.emittedAt}`, 105, 31, { align: "center" });

  if (liveData && (liveData.ptUnit !== null || liveData.pprUnit !== null)) {
    sectionTitle("VALORES CONTRATADOS", 38);
    const pt = liveData.ptUnit;
    const ppr = liveData.pprUnit;
    autoTable(doc, {
      startY: 41,
      head: [["MODALIDADE", "VALOR UNITÁRIO", "SUPERIOR + INFERIOR"]],
      body: [
        ["PT - Prótese Total", pt === null ? "—" : brl(pt), pt === null ? "—" : brl(pt * 2)],
        ["PPR - Prótese Parcial Removível", ppr === null ? "—" : brl(ppr), ppr === null ? "—" : brl(ppr * 2)],
      ],
      styles: { fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      theme: "grid",
    });
  }

  const beneficiaries = liveData
    ? liveData.orders.map((order) => ({
        patientName: order.patient_name ?? "—",
        superior: order.superior,
        inferior: order.inferior,
        date: order.date,
      }))
    : payload.beneficiaries;

  let y = liveData ? lastY() + 8 : 38;
  sectionTitle("BENEFICIÁRIOS", y);
  autoTable(doc, {
    startY: y + 3,
    head: [["NOME DO BENEFICIÁRIO", "SUPERIOR", "INFERIOR", "DATA"]],
    body: beneficiaries.map((row) => [row.patientName.toUpperCase(), row.superior, row.inferior, row.date]),
    styles: { fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
    theme: "grid",
  });

  if (liveData) {
    const ptOrders = liveData.orders.filter((order) => order.modality === "PT");
    const pprOrders = liveData.orders.filter((order) => order.modality === "PPR");
    const ptUnits = ptOrders.reduce((sum, order) => sum + order.units, 0);
    const pprUnits = pprOrders.reduce((sum, order) => sum + order.units, 0);
    const ptTotal = ptOrders.reduce((sum, order) => sum + Number(order.price ?? 0), 0);
    const pprTotal = pprOrders.reduce((sum, order) => sum + Number(order.price ?? 0), 0);
    const allTotal = liveData.orders.reduce((sum, order) => sum + Number(order.price ?? 0), 0);
    const deliveredTotal = liveData.orders
      .filter((order) => order.status === "delivered")
      .reduce((sum, order) => sum + Number(order.price ?? 0), 0);
    const openTotal = liveData.orders
      .filter((order) => ["pending", "in_progress", "ready"].includes(String(order.status ?? "")))
      .reduce((sum, order) => sum + Number(order.price ?? 0), 0);

    y = lastY() + 8;
    sectionTitle("RESUMO ATUAL", y);
    autoTable(doc, {
      startY: y + 3,
      head: [["MODALIDADE", "PACIENTES / OS", "PRÓTESES", "VALOR TOTAL"]],
      body: [
        ["PT", String(ptOrders.length), String(ptUnits), brl(ptTotal)],
        ["PPR", String(pprOrders.length), String(pprUnits), brl(pprTotal)],
        ["TOTAL", String(liveData.orders.length), String(ptUnits + pprUnits), brl(allTotal)],
      ],
      styles: { fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "right" } },
      theme: "grid",
      didParseCell: (data) => {
        if (data.row.index === 2) data.cell.styles.fontStyle = "bold";
      },
    });

    autoTable(doc, {
      startY: lastY() + 4,
      body: [["TOTAL A RECEBER", brl(allTotal), "ENTREGUE", brl(deliveredTotal), "EM ABERTO", brl(openTotal)]],
      styles: { fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" }, 5: { halign: "right" } },
      theme: "grid",
    });

    y = lastY() + 8;
    sectionTitle("RELAÇÃO DAS OS", y);
    autoTable(doc, {
      startY: y + 3,
      head: [["OS", "PACIENTE", "SERVIÇO", "VALOR", "STATUS"]],
      body: liveData.orders.map((order) => [
        order.code ?? "—",
        order.patient_name ?? "—",
        canonicalServiceDescription(order),
        brl(Number(order.price ?? 0)),
        STATUS_LABEL[String(order.status ?? "")] ?? String(order.status ?? "—"),
      ]),
      styles: { fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 24 }, 3: { halign: "right", cellWidth: 25 }, 4: { cellWidth: 25 } },
      theme: "grid",
    });

    const groups = new Map<string, { units: number; total: number; unitValue: number | null }>();
    for (const order of liveData.orders.filter((item) => item.modality === "PT" || item.modality === "PPR")) {
      const key = canonicalServiceDescription(order);
      const cityUnit = order.modality === "PT" ? liveData.ptUnit : liveData.pprUnit;
      const current = groups.get(key) ?? { units: 0, total: 0, unitValue: cityUnit };
      current.units += order.units;
      current.total += Number(order.price ?? 0);
      if (current.unitValue === null && cityUnit !== null) current.unitValue = cityUnit;
      groups.set(key, current);
    }

    const summaryRows = Array.from(groups.entries()).map(([description, group]) => [
      description,
      String(group.units).padStart(2, "0"),
      brl(group.unitValue ?? (group.units ? group.total / group.units : 0)),
      brl(group.total),
    ]);
    summaryRows.push(["VALOR GLOBAL", "", "", brl(allTotal)]);

    y = lastY() + 8;
    sectionTitle("RESUMO FINANCEIRO", y);
    autoTable(doc, {
      startY: y + 3,
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
  } else {
    const summaryRows = payload.summaries.map((row) => [
      row.description,
      String(row.quantity).padStart(2, "0"),
      brl(row.unitValue),
      brl(row.totalValue),
    ]);
    const valorGlobal = payload.summaries.reduce((sum, row) => sum + row.totalValue, 0);
    summaryRows.push(["VALOR GLOBAL", "", "", brl(valorGlobal)]);

    y = lastY() + 8;
    sectionTitle("RESUMO FINANCEIRO", y);
    autoTable(doc, {
      startY: y + 3,
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
  }

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