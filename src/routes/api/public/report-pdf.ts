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
  city_id: string | null;
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
  const serviceRaw = String(serviceType ?? "").trim().toUpperCase();
  let modality: "PT" | "PPR" | null = null;
  if (/\bPPR\b/.test(raw) || raw.includes("PRÓTESE PARCIAL REMOVÍVEL") || raw.includes("PROTESE PARCIAL REMOVIVEL")) {
    modality = "PPR";
  } else if (/\bPT\b/.test(raw) || raw.includes("PRÓTESE TOTAL") || raw.includes("PROTESE TOTAL")) {
    modality = "PT";
  }

  const isPtTotal = modality === "PT" && (serviceRaw === "PT TOTAL" || serviceRaw.startsWith("PT TOTAL ") || serviceRaw.startsWith("PT TOTAL("));
  const hasSuperior = /\b(SUP|SUPERIOR)\b/.test(raw);
  const hasInferior = /\b(INF|INFERIOR|INFERIOS)\b/.test(raw) || raw.includes("INFERI");
  const bothArches = isPtTotal || (hasSuperior && hasInferior);
  const units = bothArches ? 2 : 1;
  const label = modality ?? raw.replace(/\b(SUPERIOR|SUP|INFERIOR|INFERIOS|INF)\b/g, "").trim().split(/\s+/)[0] ?? "—";

  return {
    modality,
    units,
    superior: bothArches || hasSuperior || (!hasSuperior && !hasInferior) ? label || "—" : "-",
    inferior: bothArches || hasInferior ? label || "—" : "-",
  };
}

function canonicalServiceDescription(order: ClassifiedOrder) {
  if (!order.modality) return order.description;
  const hasSuperior = order.superior !== "-";
  const hasInferior = order.inferior !== "-";
  if (hasSuperior && hasInferior) {
    return order.modality === "PT"
      ? "PT total (superior e inferior)"
      : "PPR superior e inferior";
  }
  if (hasSuperior) return `${order.modality} superior`;
  if (hasInferior) return `${order.modality} inferior`;
  return order.modality;
}

async function loadLiveReportData(supabase: any, payload: ReportPdfPayload): Promise<LiveReportData[] | null> {
  const allCities = payload.cityName.toLowerCase().includes("todas as cidades");
  const { from, to } = parsePeriod(payload.period);

  let reportCities: Array<{ id: string; name: string; uf: string }> = [];

  if (allCities) {
    const { data: cities } = await supabase
      .from("cities")
      .select("id,name,uf")
      .order("name");
    reportCities = (cities ?? []) as Array<{ id: string; name: string; uf: string }>;
  } else {
    const requestedCityName = payload.cityName.split(" / ")[0].trim();
    const { data: city } = await supabase
      .from("cities")
      .select("id,name,uf")
      .eq("name", requestedCityName)
      .maybeSingle();

    if (!city?.id) return null;
    reportCities = [city as { id: string; name: string; uf: string }];
  }

  if (reportCities.length === 0) return null;

  const cityIds = reportCities.map((city) => city.id);

  let orderQuery = supabase
    .from("service_orders")
    .select("city_id,code,patient_name,service_type,prosthesis_type_id,price,status,delivered_at,created_at")
    .order("created_at", { ascending: true });

  orderQuery = cityIds.length === 1
    ? orderQuery.eq("city_id", cityIds[0])
    : orderQuery.in("city_id", cityIds);

  let priceQuery = supabase
    .from("city_service_prices")
    .select("city_id,service_code,unit_price,active")
    .eq("active", true);

  priceQuery = cityIds.length === 1
    ? priceQuery.eq("city_id", cityIds[0])
    : priceQuery.in("city_id", cityIds);

  const [{ data: typeRows }, { data: orderRows }, { data: priceRows }] = await Promise.all([
    supabase.from("prosthesis_types").select("id,name"),
    orderQuery,
    priceQuery,
  ]);

  const typeMap = new Map<string, string>((typeRows ?? []).map((row: any) => [row.id, row.name]));

  const classifiedOrders: ClassifiedOrder[] = ((orderRows ?? []) as LiveOrder[])
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

  const getUnitPrice = (cityId: string, serviceCode: "PT" | "PPR") => {
    const row = (priceRows ?? []).find(
      (price: any) =>
        price.city_id === cityId &&
        String(price.service_code ?? "").toUpperCase() === serviceCode,
    );
    if (!row) return null;
    const value = Number(row.unit_price ?? 0);
    return Number.isFinite(value) ? value : null;
  };

  const reports = reportCities
    .map((city) => ({
      cityLabel: `${city.name} / ${city.uf}`,
      ptUnit: getUnitPrice(city.id, "PT"),
      pprUnit: getUnitPrice(city.id, "PPR"),
      orders: classifiedOrders.filter((order) => order.city_id === city.id),
    }))
    .filter((report) => !allCities || report.orders.length > 0);

  return reports.length ? reports : null;
}

function formatIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "—";
}

function buildReportPdf(payload: ReportPdfPayload, liveReports: LiveReportData[] | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageMargin = 10;

  const COLORS = {
    navy: [31, 75, 110] as [number, number, number],
    teal: [46, 125, 138] as [number, number, number],
    sky: [234, 243, 248] as [number, number, number],
    skySoft: [246, 250, 252] as [number, number, number],
    border: [193, 208, 219] as [number, number, number],
    text: [31, 41, 55] as [number, number, number],
    muted: [98, 112, 125] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    green: [46, 125, 92] as [number, number, number],
    amber: [166, 112, 32] as [number, number, number],
    red: [166, 63, 63] as [number, number, number],
  };

  const lastY = () =>
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 27);

  const setText = (color: [number, number, number]) => doc.setTextColor(...color);
  const setFill = (color: [number, number, number]) => doc.setFillColor(...color);
  const setDraw = (color: [number, number, number]) => doc.setDrawColor(...color);

  const sectionTitle = (text: string, y: number) => {
    setFill(COLORS.sky);
    doc.roundedRect(pageMargin, y - 4.2, pageWidth - pageMargin * 2, 6.4, 1.2, 1.2, "F");
    setFill(COLORS.teal);
    doc.roundedRect(pageMargin, y - 4.2, 2.2, 6.4, 1.1, 1.1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    setText(COLORS.navy);
    doc.text(text, pageMargin + 4.4, y);
    doc.setFont("helvetica", "normal");
    setText(COLORS.text);
  };

  const nextSectionY = (minimumSpace = 24) => {
    let y = lastY() + 6;
    if (y + minimumSpace > pageHeight - 13) {
      doc.addPage();
      y = 13;
    }
    return y;
  };

  const renderHeader = (cityLabel: string) => {
    setFill(COLORS.skySoft);
    doc.rect(0, 0, pageWidth, 24, "F");
    setFill(COLORS.teal);
    doc.rect(0, 0, 3.6, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setText(COLORS.navy);
    doc.text("RELATÓRIO DE ATIVIDADES", 12, 8.8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    setText(COLORS.text);
    doc.text(cityLabel, 12, 14.2);

    doc.setFontSize(6.7);
    setText(COLORS.muted);
    doc.text(`${payload.period}   •   Emitido em ${payload.emittedAt}`, 12, 19.2);

    setFill(COLORS.sky);
    doc.roundedRect(166, 6.2, 34, 8.2, 2.2, 2.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.7);
    setText(COLORS.teal);
    doc.text("ODONTOLOGIA", 183, 11.2, { align: "center" });

    setDraw(COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(pageMargin, 24.8, pageWidth - pageMargin, 24.8);
    setText(COLORS.text);
  };

  const baseTableStyles = {
    fontSize: 6.2,
    cellPadding: 0.9,
    lineColor: COLORS.border,
    lineWidth: 0.12,
    textColor: COLORS.text,
    valign: "middle" as const,
  };

  const baseHeadStyles = {
    fillColor: COLORS.navy,
    textColor: COLORS.white,
    fontStyle: "bold" as const,
    fontSize: 6.25,
  };

  const renderLiveReport = (liveData: LiveReportData) => {
    renderHeader(liveData.cityLabel);

    sectionTitle("VALORES CONTRATADOS", 31);
    autoTable(doc, {
      startY: 34.1,
      margin: { left: pageMargin, right: pageMargin, bottom: 11 },
      tableWidth: 190,
      head: [["MODALIDADE", "VALOR UNITÁRIO"]],
      body: [
        ["PT - Prótese Total", liveData.ptUnit === null ? "—" : brl(liveData.ptUnit)],
        ["PPR - Prótese Parcial Removível", liveData.pprUnit === null ? "—" : brl(liveData.pprUnit)],
      ],
      styles: {
        ...baseTableStyles,
        fontSize: 7,
        cellPadding: 1.2,
      },
      headStyles: {
        ...baseHeadStyles,
        fontSize: 6.8,
      },
      alternateRowStyles: { fillColor: COLORS.skySoft },
      columnStyles: {
        0: { cellWidth: 132 },
        1: { cellWidth: 58, halign: "right", fontStyle: "bold", textColor: COLORS.navy },
      },
      theme: "grid",
      pageBreak: "avoid",
      rowPageBreak: "avoid",
    });

    let y = nextSectionY(34);
    sectionTitle("BENEFICIÁRIOS / OS", y);
    autoTable(doc, {
      startY: y + 3.1,
      margin: { left: pageMargin, right: pageMargin, top: 12, bottom: 11 },
      tableWidth: 190,
      head: [["BENEFICIÁRIO", "OS", "SERVIÇO", "DATA", "STATUS", "VALOR"]],
      body: liveData.orders.map((order) => [
        (order.patient_name ?? "—").toUpperCase(),
        order.code ?? "—",
        canonicalServiceDescription(order),
        order.date,
        STATUS_LABEL[String(order.status ?? "")] ?? String(order.status ?? "—"),
        brl(Number(order.price ?? 0)),
      ]),
      styles: {
        ...baseTableStyles,
        fontSize: 5.85,
        cellPadding: 0.78,
        overflow: "linebreak",
      },
      headStyles: {
        ...baseHeadStyles,
        fontSize: 5.9,
      },
      alternateRowStyles: { fillColor: COLORS.skySoft },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 21, halign: "center" },
        2: { cellWidth: 39 },
        3: { cellWidth: 23, halign: "center" },
        4: { cellWidth: 21, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 21, halign: "right", fontStyle: "bold", textColor: COLORS.navy },
      },
      theme: "grid",
      showHead: "everyPage",
      pageBreak: "auto",
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const status = String(data.cell.raw ?? "").toLowerCase();
          if (status.includes("entregue")) data.cell.styles.textColor = COLORS.green;
          else if (status.includes("pronto")) data.cell.styles.textColor = COLORS.teal;
          else if (status.includes("pendente")) data.cell.styles.textColor = COLORS.amber;
          else if (status.includes("produção")) data.cell.styles.textColor = COLORS.navy;
          else if (status.includes("cancelado")) data.cell.styles.textColor = COLORS.red;
        }
      },
    });

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

    y = nextSectionY(38);
    sectionTitle("RESUMO ATUAL", y);
    autoTable(doc, {
      startY: y + 3.1,
      margin: { left: pageMargin, right: pageMargin, bottom: 11 },
      tableWidth: 190,
      head: [["MODALIDADE", "OS", "PRÓTESES", "VALOR TOTAL"]],
      body: [
        ["PT", String(ptOrders.length), String(ptUnits), brl(ptTotal)],
        ["PPR", String(pprOrders.length), String(pprUnits), brl(pprTotal)],
        ["TOTAL", String(liveData.orders.length), String(ptUnits + pprUnits), brl(allTotal)],
      ],
      styles: {
        ...baseTableStyles,
        fontSize: 6.7,
        cellPadding: 1.05,
      },
      headStyles: {
        ...baseHeadStyles,
        fontSize: 6.55,
      },
      alternateRowStyles: { fillColor: COLORS.skySoft },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 38, halign: "center" },
        2: { cellWidth: 38, halign: "center" },
        3: { cellWidth: 52, halign: "right", fontStyle: "bold", textColor: COLORS.navy },
      },
      theme: "grid",
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        if (data.row.index === 2) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = COLORS.sky;
          data.cell.styles.textColor = COLORS.navy;
        }
      },
    });

    autoTable(doc, {
      startY: lastY() + 2.5,
      margin: { left: pageMargin, right: pageMargin, bottom: 11 },
      tableWidth: 190,
      body: [[
        "TOTAL A RECEBER",
        brl(allTotal),
        "ENTREGUE",
        brl(deliveredTotal),
        "EM ABERTO",
        brl(openTotal),
      ]],
      styles: {
        fontSize: 6.7,
        cellPadding: 1.3,
        lineColor: COLORS.border,
        lineWidth: 0.14,
        textColor: COLORS.text,
        fontStyle: "bold",
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 31, halign: "right", textColor: COLORS.navy },
        2: { cellWidth: 26 },
        3: { cellWidth: 31, halign: "right", textColor: COLORS.green },
        4: { cellWidth: 26 },
        5: { cellWidth: 41, halign: "right", textColor: COLORS.amber },
      },
      theme: "grid",
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        if ([0, 2, 4].includes(data.column.index)) {
          data.cell.styles.fillColor = COLORS.sky;
          data.cell.styles.textColor = COLORS.navy;
        } else {
          data.cell.styles.fillColor = COLORS.white;
        }
      },
    });
  };

  const renderFallbackReport = () => {
    renderHeader(payload.cityName);

    sectionTitle("BENEFICIÁRIOS", 31);
    autoTable(doc, {
      startY: 34.1,
      margin: { left: pageMargin, right: pageMargin, top: 12, bottom: 11 },
      tableWidth: 190,
      head: [["NOME DO BENEFICIÁRIO", "SUPERIOR", "INFERIOR", "DATA"]],
      body: payload.beneficiaries.map((row) => [
        row.patientName.toUpperCase(),
        row.superior,
        row.inferior,
        row.date,
      ]),
      styles: {
        ...baseTableStyles,
        fontSize: 6.15,
        cellPadding: 0.9,
      },
      headStyles: baseHeadStyles,
      alternateRowStyles: { fillColor: COLORS.skySoft },
      columnStyles: {
        0: { cellWidth: 115 },
        1: { cellWidth: 23, halign: "center" },
        2: { cellWidth: 23, halign: "center" },
        3: { cellWidth: 29, halign: "center" },
      },
      theme: "grid",
      showHead: "everyPage",
      pageBreak: "auto",
      rowPageBreak: "avoid",
    });

    const summaryRows = payload.summaries.map((row) => [
      row.description,
      String(row.quantity).padStart(2, "0"),
      brl(row.unitValue),
      brl(row.totalValue),
    ]);
    const valorGlobal = payload.summaries.reduce((sum, row) => sum + row.totalValue, 0);
    summaryRows.push(["VALOR GLOBAL", "", "", brl(valorGlobal)]);

    const y = nextSectionY(34);
    sectionTitle("RESUMO FINANCEIRO", y);
    autoTable(doc, {
      startY: y + 3.1,
      margin: { left: pageMargin, right: pageMargin, bottom: 11 },
      tableWidth: 190,
      head: [["DESCRIÇÃO", "QTD", "VLR.UND", "VLR.TOTAL"]],
      body: summaryRows,
      styles: {
        ...baseTableStyles,
        fontSize: 6.6,
        cellPadding: 1,
      },
      headStyles: baseHeadStyles,
      alternateRowStyles: { fillColor: COLORS.skySoft },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 38, halign: "right" },
        3: { cellWidth: 42, halign: "right", fontStyle: "bold", textColor: COLORS.navy },
      },
      theme: "grid",
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        if (data.row.index === summaryRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = COLORS.sky;
          data.cell.styles.textColor = COLORS.navy;
        }
      },
    });
  };

  if (liveReports?.length) {
    liveReports.forEach((report, index) => {
      if (index > 0) doc.addPage();
      renderLiveReport(report);
    });
  } else {
    renderFallbackReport();
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);

    setDraw(COLORS.border);
    doc.setLineWidth(0.15);
    doc.line(pageMargin, 287.5, pageWidth - pageMargin, 287.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    setText(COLORS.muted);
    doc.text("Relatório odontológico", pageMargin, 291.5);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - pageMargin, 291.5, { align: "right" });
  }

  setText(COLORS.text);
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
