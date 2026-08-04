import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ClipboardList,
  Users,
  Wallet,
  UserCog,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Search,
  MapPin,
  Download,
  Printer,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — LabProt" }] }),
  component: Relatorios,
});

type OS = {
  id: string;
  code: string | null;
  status: string | null;
  patient_name: string | null;
  contractor_name: string | null;
  dentist_name: string | null;
  technician_id: string | null;
  client_id: string | null;
  price: number | null;
  cost: number | null;
  created_at: string;
  delivered_at: string | null;
  expected_at: string | null;
  molding_date: string | null;
  wax_plan_date: string | null;
  teeth_setup_date: string | null;
  acrylization_date: string | null;
  sent_at: string | null;
  prosthesis_type_id: string | null;
  notes: string | null;
  city_id: string | null;
  health_unit: string | null;
  service_type: string | null;
};

type CityRow = { id: string; name: string; uf: string };
type ExpenseRow = { id: string; os_id: string; description: string; amount: number };
type PdfPayload = {
  fileName: string;
  cityName: string;
  period: string;
  emittedAt: string;
  beneficiaries: Array<{ patientName: string; superior: string; inferior: string; date: string }>;
  summaries: Array<{ description: string; quantity: number; unitValue: number; totalValue: number }>;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em Produção",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function Relatorios() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [emittedAt, setEmittedAt] = useState("");
  useEffect(() => {
    setEmittedAt(new Date().toLocaleString("pt-BR"));
  }, []);

  const { data } = useQuery({
    queryKey: ["relatorios-full"],
    queryFn: async () => {
      const [os, clients, prot, fin, types, cities, expenses] = await Promise.all([
        supabase.from("service_orders").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, contractor_name, dentist_name"),
        supabase.from("technicians").select("id, full_name, specialty"),
        supabase.from("finance_entries").select("*"),
        supabase.from("prosthesis_types").select("id, name"),
        (supabase as any).from("cities").select("id, name, uf").order("name"),
        (supabase as any).from("os_expenses").select("*"),
      ]);
      return {
        os: (os.data ?? []) as OS[],
        clients: clients.data ?? [],
        prot: prot.data ?? [],
        fin: fin.data ?? [],
        types: types.data ?? [],
        cities: (cities.data ?? []) as CityRow[],
        expenses: (expenses.data ?? []) as ExpenseRow[],
      };
    },
  });

  const os = data?.os ?? [];
  const fin = data?.fin ?? [];
  const cities = data?.cities ?? [];
  const expenses = data?.expenses ?? [];
  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities],
  );
  const expensesByOs = useMemo(() => {
    const m: Record<string, ExpenseRow[]> = {};
    for (const e of expenses) (m[e.os_id] ??= []).push(e);
    return m;
  }, [expenses]);
  const additionalCostByOs = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [osId, list] of Object.entries(expensesByOs)) {
      totals[osId] = list.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    }
    return totals;
  }, [expensesByOs]);
  const totalCostByOs = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const order of os) {
      totals[order.id] = Number(order.cost ?? 0) + Number(additionalCostByOs[order.id] ?? 0);
    }
    return totals;
  }, [os, additionalCostByOs]);
  const techMap = useMemo(
    () => Object.fromEntries((data?.prot ?? []).map((t) => [t.id, t])),
    [data],
  );
  const typeMap = useMemo(
    () => Object.fromEntries((data?.types ?? []).map((t) => [t.id, t.name])),
    [data],
  );

  // City report: filter by date range + city
  const cityReportOs = useMemo(() => {
    return os.filter((o) => {
      const ref = o.delivered_at ?? o.created_at;
      const d = ref ? ref.slice(0, 10) : "";
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (cityFilter !== "all" && o.city_id !== cityFilter) return false;
      return true;
    });
  }, [os, dateFrom, dateTo, cityFilter]);

  const cityTotals = useMemo(() => {
    let services = 0;
    let baseCost = 0;
    let additionalExpenses = 0;
    for (const o of cityReportOs) {
      services += Number(o.price ?? 0);
      baseCost += Number(o.cost ?? 0);
      additionalExpenses += Number(additionalCostByOs[o.id] ?? 0);
    }
    const totalCost = baseCost + additionalExpenses;
    return {
      count: cityReportOs.length,
      services,
      baseCost,
      additionalExpenses,
      totalCost,
      balance: services - totalCost,
    };
  }, [cityReportOs, additionalCostByOs]);

  const exportCSV = () => {
    const rows: string[] = [
      "OS,Data,Cidade,UF,Cliente,Paciente,Descricao,Valor Servico,Custo Base,Gastos Discriminados,Gastos Adicionais,Custo Total,Saldo",
    ];
    for (const o of cityReportOs) {
      const city = o.city_id ? cityMap[o.city_id] : undefined;
      const exps = expensesByOs[o.id] ?? [];
      const expStr = exps.map((e) => `${e.description}: ${Number(e.amount).toFixed(2)}`).join(" | ");
      const baseCost = Number(o.cost ?? 0);
      const expTotal = Number(additionalCostByOs[o.id] ?? 0);
      const totalCost = baseCost + expTotal;
      const balance = Number(o.price ?? 0) - totalCost;
      const d = (o.delivered_at ?? o.created_at).slice(0, 10);
      rows.push([
        o.code ?? "",
        d,
        city?.name ?? "",
        city?.uf ?? "",
        o.contractor_name ?? "",
        o.patient_name ?? "",
        (typeMap[o.prosthesis_type_id ?? ""] ?? "").replace(/,/g, ";"),
        Number(o.price ?? 0).toFixed(2),
        baseCost.toFixed(2),
        expStr.replace(/,/g, ";"),
        expTotal.toFixed(2),
        totalCost.toFixed(2),
        balance.toFixed(2),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    rows.push("");
    rows.push([
      "TOTAL",
      "",
      `${cityTotals.count} OS`,
      "",
      "",
      "",
      "",
      cityTotals.services.toFixed(2),
      cityTotals.baseCost.toFixed(2),
      "",
      cityTotals.additionalExpenses.toFixed(2),
      cityTotals.totalCost.toFixed(2),
      cityTotals.balance.toFixed(2),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-cidades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildPdfPayload = (): PdfPayload => {
    const cityName = cityFilter !== "all" && cityMap[cityFilter]
      ? `${cityMap[cityFilter].name} / ${cityMap[cityFilter].uf}`
      : "Todas as cidades";
    const period = (dateFrom || dateTo)
      ? `Período: ${dateFrom ? fmtDate(dateFrom) : "..."} a ${dateTo ? fmtDate(dateTo) : "..."}`
      : "Período: todos";
    const beneficiaries = cityReportOs.map((o) => {
      const raw = (o.service_type || (o.prosthesis_type_id ? typeMap[o.prosthesis_type_id] : "") || "").toString().toUpperCase();
      const hasSup = /\b(SUP|SUPERIOR)\b/.test(raw);
      const hasInf = /\b(INF|INFERIOR)\b/.test(raw);
      const label = raw.replace(/\b(SUPERIOR|SUP|INFERIOR|INF)\b/g, "").trim().split(/\s+/)[0] || raw || "—";
      let sup = "-", inf = "-";
      if (hasSup && hasInf) { sup = label; inf = label; }
      else if (hasSup) sup = label;
      else if (hasInf) inf = label;
      else sup = label;
      const d = (o.delivered_at ?? o.created_at).slice(0, 10);
      return { patientName: o.patient_name ?? "—", superior: sup, inferior: inf, date: fmtDate(d) };
    });

    const groups = new Map<string, { qtd: number; unit: number; total: number }>();
    for (const o of cityReportOs) {
      const desc = (o.service_type || (o.prosthesis_type_id ? typeMap[o.prosthesis_type_id] : "") || "Serviço").toString();
      const price = Number(o.price ?? 0);
      const g = groups.get(desc) ?? { qtd: 0, unit: price, total: 0 };
      g.qtd += 1; g.total += price; g.unit = g.qtd > 0 ? g.total / g.qtd : price;
      groups.set(desc, g);
    }
    const fileName = `relatorio-${(cityFilter !== "all" && cityMap[cityFilter]?.name ? cityMap[cityFilter].name.toLowerCase().replace(/\s+/g, "-") : "geral")}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return {
      fileName,
      cityName,
      period,
      emittedAt: emittedAt || new Date().toLocaleString("pt-BR"),
      beneficiaries,
      summaries: Array.from(groups.entries()).map(([description, group]) => ({
        description,
        quantity: group.qtd,
        unitValue: group.unit,
        totalValue: group.total,
      })),
    };
  };

  const exportPDF = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Faça login novamente para baixar o PDF.");
        return;
      }

      const payload = buildPdfPayload();
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
      if (isIOS) {
        submitPdfDownloadForm(payload, token);
        return;
      }

      const response = await fetch("/api/public/report-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());

      const blob = new Blob([await response.arrayBuffer()], {
        type: response.headers.get("content-type") ?? "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível baixar o PDF.");
    }
  };

  const totalIn = fin
    .filter((e) => e.kind === "income" && e.status === "paid")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = fin
    .filter((e) => e.kind === "expense" && e.status === "paid")
    .reduce((s, e) => s + Number(e.amount), 0);

  // Agrupamento por Contratante -> Paciente -> OSs
  const byContractor = useMemo(() => {
    const map = new Map<
      string,
      {
        contractor: string;
        dentists: Set<string>;
        patients: Map<string, OS[]>;
        totalRevenue: number;
        totalCost: number;
        count: number;
        byStatus: Record<string, number>;
      }
    >();
    for (const o of os) {
      const key = o.contractor_name?.trim() || "— Sem contratante —";
      if (!map.has(key)) {
        map.set(key, {
          contractor: key,
          dentists: new Set(),
          patients: new Map(),
          totalRevenue: 0,
          totalCost: 0,
          count: 0,
          byStatus: {},
        });
      }
      const g = map.get(key)!;
      if (o.dentist_name) g.dentists.add(o.dentist_name);
      const pname = o.patient_name?.trim() || "— Sem paciente —";
      if (!g.patients.has(pname)) g.patients.set(pname, []);
      g.patients.get(pname)!.push(o);
      g.totalRevenue += Number(o.price ?? 0);
      g.totalCost += Number(totalCostByOs[o.id] ?? 0);
      g.count += 1;
      const st = String(o.status ?? "—");
      g.byStatus[st] = (g.byStatus[st] ?? 0) + 1;
    }
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [os, totalCostByOs]);

  const filteredContractors = byContractor.filter((c) =>
    c.contractor.toLowerCase().includes(search.toLowerCase()),
  );

  // Produção por Protético, agrupada por Contratante
  const productionByTechByContractor = useMemo(() => {
    const map = new Map<
      string,
      {
        techId: string;
        techName: string;
        specialty: string | null;
        contractors: Map<
          string,
          { count: number; revenue: number; cost: number; delivered: number }
        >;
        totals: { count: number; revenue: number; cost: number; delivered: number };
      }
    >();
    for (const o of os) {
      if (!o.technician_id) continue;
      const t = techMap[o.technician_id];
      const name = t?.full_name ?? "—";
      if (!map.has(o.technician_id)) {
        map.set(o.technician_id, {
          techId: o.technician_id,
          techName: name,
          specialty: t?.specialty ?? null,
          contractors: new Map(),
          totals: { count: 0, revenue: 0, cost: 0, delivered: 0 },
        });
      }
      const g = map.get(o.technician_id)!;
      const ck = o.contractor_name?.trim() || "— Sem contratante —";
      if (!g.contractors.has(ck))
        g.contractors.set(ck, { count: 0, revenue: 0, cost: 0, delivered: 0 });
      const c = g.contractors.get(ck)!;
      c.count += 1;
      c.revenue += Number(o.price ?? 0);
      c.cost += Number(totalCostByOs[o.id] ?? 0);
      if (o.status === "delivered") c.delivered += 1;
      g.totals.count += 1;
      g.totals.revenue += Number(o.price ?? 0);
      g.totals.cost += Number(totalCostByOs[o.id] ?? 0);
      if (o.status === "delivered") g.totals.delivered += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.totals.count - a.totals.count);
  }, [os, techMap, totalCostByOs]);

  // Produção por Dentista, agrupada por Contratante
  const productionByDentistByContractor = useMemo(() => {
    const map = new Map<
      string,
      {
        dentist: string;
        contractors: Map<
          string,
          { count: number; revenue: number; cost: number; delivered: number }
        >;
        totals: { count: number; revenue: number; cost: number; delivered: number };
      }
    >();
    for (const o of os) {
      const d = o.dentist_name?.trim() || "— Sem dentista —";
      if (!map.has(d)) {
        map.set(d, {
          dentist: d,
          contractors: new Map(),
          totals: { count: 0, revenue: 0, cost: 0, delivered: 0 },
        });
      }
      const g = map.get(d)!;
      const ck = o.contractor_name?.trim() || "— Sem contratante —";
      if (!g.contractors.has(ck))
        g.contractors.set(ck, { count: 0, revenue: 0, cost: 0, delivered: 0 });
      const c = g.contractors.get(ck)!;
      c.count += 1;
      c.revenue += Number(o.price ?? 0);
      c.cost += Number(totalCostByOs[o.id] ?? 0);
      if (o.status === "delivered") c.delivered += 1;
      g.totals.count += 1;
      g.totals.revenue += Number(o.price ?? 0);
      g.totals.cost += Number(totalCostByOs[o.id] ?? 0);
      if (o.status === "delivered") g.totals.delivered += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.totals.count - a.totals.count);
  }, [os, totalCostByOs]);

  // Consolidado por etapas
  const phaseStats = useMemo(() => {
    const phases = [
      { key: "molding_date", label: "Moldagem" },
      { key: "wax_plan_date", label: "Plano de Cera" },
      { key: "teeth_setup_date", label: "Montagem de Dentes" },
      { key: "acrylization_date", label: "Acrilização" },
      { key: "sent_at", label: "Enviado" },
      { key: "delivered_at", label: "Entregue" },
    ] as const;
    return phases.map((p) => ({
      label: p.label,
      count: os.filter((o) => (o as any)[p.key]).length,
    }));
  }, [os]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Análises detalhadas por contratante, paciente, protético e dentista"
        actions={
          <>
            <Button onClick={exportPDF} variant="default" className="no-print">
              <FileText className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
            <Button onClick={() => window.print()} variant="outline" className="no-print">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </>
        }
      />
      <p className="print-only text-xs text-muted-foreground">
        Emitido em {emittedAt}
        {dateFrom || dateTo ? ` • Período: ${dateFrom || "..."} a ${dateTo || "..."}` : ""}
        {cityFilter !== "all" ? ` • Cidade: ${cityMap[cityFilter]?.name ?? ""}` : ""}
      </p>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Ordens de Serviço" value={os.length} icon={ClipboardList} />
        <StatCard label="Contratantes" value={byContractor.length} icon={Users} />
        <StatCard label="Protéticos" value={data?.prot.length ?? 0} icon={UserCog} />
        <StatCard
          label="Saldo"
          value={brl(totalIn - totalOut)}
          icon={Wallet}
          tone={totalIn - totalOut >= 0 ? "success" : "destructive"}
        />
      </div>

      <Tabs defaultValue="cities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cities">Por Cidade / Período</TabsTrigger>
          <TabsTrigger value="contractors">Por Contratante</TabsTrigger>
          <TabsTrigger value="technicians">Produção – Protéticos</TabsTrigger>
          <TabsTrigger value="dentists">Produção – Dentistas</TabsTrigger>
          <TabsTrigger value="phases">Etapas / Fases</TabsTrigger>
        </TabsList>

        {/* RELATÓRIO POR CIDADE / PERÍODO */}
        <TabsContent value="cities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Data inicial</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Data final</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Cidade</label>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as cidades</SelectItem>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} / {c.uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={exportPDF} variant="default">
                    <FileText className="mr-2 h-4 w-4" /> PDF
                  </Button>
                  <Button onClick={exportCSV} variant="outline">
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total de OS" value={cityTotals.count} icon={ClipboardList} />
            <StatCard label="Total em Serviços" value={brl(cityTotals.services)} icon={TrendingUp} tone="success" />
            <StatCard label="Total de Custos" value={brl(cityTotals.totalCost)} icon={TrendingDown} tone="destructive" />
            <StatCard label="Saldo Final" value={brl(cityTotals.balance)} icon={Wallet} tone={cityTotals.balance >= 0 ? "success" : "destructive"} />
          </div>

          {/* PRINT-ONLY: Relatório de Atividades formatado */}
          <div className="print-only print-report">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold uppercase">Relatório de Atividades</h2>
              <p className="text-xs">
                {cityFilter !== "all" && cityMap[cityFilter] ? `${cityMap[cityFilter].name} / ${cityMap[cityFilter].uf}` : "Todas as cidades"}
                {(dateFrom || dateTo) && ` — Período: ${dateFrom ? fmtDate(dateFrom) : "..."} a ${dateTo ? fmtDate(dateTo) : "..."}`}
              </p>
              <p className="text-[10px] text-muted-foreground">Emitido em {emittedAt || "—"}</p>
            </div>

            <table className="w-full border-collapse text-[11px] mb-4" style={{ border: "1px solid #000" }}>
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1 text-left">— NOME DO BENEFICIÁRIO —</th>
                  <th className="border border-black px-2 py-1">SUPERIOR</th>
                  <th className="border border-black px-2 py-1">INFERIOR</th>
                  <th className="border border-black px-2 py-1">DATA</th>
                </tr>
              </thead>
              <tbody>
                {cityReportOs.map((o) => {
                  const raw = (o.service_type || (o.prosthesis_type_id ? typeMap[o.prosthesis_type_id] : "") || "").toString().toUpperCase();
                  const hasSup = /\b(SUP|SUPERIOR)\b/.test(raw);
                  const hasInf = /\b(INF|INFERIOR)\b/.test(raw);
                  // Label = first token (PPR, BIMLER, B.P, etc.)
                  const label = raw.replace(/\b(SUPERIOR|SUP|INFERIOR|INF)\b/g, "").trim().split(/\s+/)[0] || raw || "—";
                  let sup = "-", inf = "-";
                  if (hasSup && hasInf) { sup = label; inf = label; }
                  else if (hasSup) { sup = label; }
                  else if (hasInf) { inf = label; }
                  else { sup = label; }
                  const d = (o.delivered_at ?? o.created_at).slice(0, 10);
                  return (
                    <tr key={o.id}>
                      <td className="border border-black px-2 py-0.5 uppercase">{o.patient_name ?? "—"}</td>
                      <td className="border border-black px-2 py-0.5 text-center">{sup}</td>
                      <td className="border border-black px-2 py-0.5 text-center">{inf}</td>
                      <td className="border border-black px-2 py-0.5 text-center">{fmtDate(d)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Resumo financeiro por descrição */}
            {(() => {
              const groups = new Map<string, { qtd: number; unit: number; total: number }>();
              for (const o of cityReportOs) {
                const desc = (o.service_type || (o.prosthesis_type_id ? typeMap[o.prosthesis_type_id] : "") || "Serviço").toString();
                const price = Number(o.price ?? 0);
                const g = groups.get(desc) ?? { qtd: 0, unit: price, total: 0 };
                g.qtd += 1;
                g.total += price;
                g.unit = g.qtd > 0 ? g.total / g.qtd : price;
                groups.set(desc, g);
              }
              const rows = Array.from(groups.entries());
              const valorGlobal = rows.reduce((s, [, g]) => s + g.total, 0);
              return (
                <table className="w-full border-collapse text-[11px]" style={{ border: "1px solid #000" }}>
                  <thead>
                    <tr>
                      <th className="border border-black px-2 py-1 text-left">DESCRIÇÃO</th>
                      <th className="border border-black px-2 py-1">QTD</th>
                      <th className="border border-black px-2 py-1 text-right">VLR.UND</th>
                      <th className="border border-black px-2 py-1 text-right">VLR.TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([desc, g]) => (
                      <tr key={desc}>
                        <td className="border border-black px-2 py-0.5">{desc}</td>
                        <td className="border border-black px-2 py-0.5 text-center">{String(g.qtd).padStart(2, "0")}</td>
                        <td className="border border-black px-2 py-0.5 text-right">{brl(g.unit)}</td>
                        <td className="border border-black px-2 py-0.5 text-right">{brl(g.total)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="border border-black px-2 py-1 text-center" colSpan={3}>VALOR GLOBAL</td>
                      <td className="border border-black px-2 py-1 text-right">{brl(valorGlobal)}</td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>

          <Card className="screen-only">
            <CardHeader><CardTitle>Detalhamento</CardTitle></CardHeader>
            <CardContent>
              {cityReportOs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma OS no período/cidade selecionados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OS</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>UBS</TableHead>
                        <TableHead>Contratante</TableHead>
                        <TableHead>Dentista</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Protético</TableHead>
                        <TableHead>Etapas</TableHead>
                        <TableHead>Gastos Adicionais</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Gastos</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cityReportOs.map((o) => {
                        const city = o.city_id ? cityMap[o.city_id] : undefined;
                        const exps = expensesByOs[o.id] ?? [];
                        const expTotal = Number(additionalCostByOs[o.id] ?? 0);
                        const totalCost = Number(totalCostByOs[o.id] ?? 0);
                        const balance = Number(o.price ?? 0) - totalCost;
                        const tech = o.technician_id ? techMap[o.technician_id]?.full_name : "—";
                        const phases = [
                          o.molding_date && `M:${fmtDate(o.molding_date)}`,
                          o.wax_plan_date && `PC:${fmtDate(o.wax_plan_date)}`,
                          o.teeth_setup_date && `MD:${fmtDate(o.teeth_setup_date)}`,
                          o.acrylization_date && `A:${fmtDate(o.acrylization_date)}`,
                          o.sent_at && `Env:${fmtDate(o.sent_at)}`,
                          o.delivered_at && `Ent:${fmtDate(o.delivered_at)}`,
                        ].filter(Boolean).join(" • ") || "—";
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">{o.code}</TableCell>
                            <TableCell className="text-xs">{fmtDate(o.delivered_at ?? o.created_at)}</TableCell>
                            <TableCell className="text-xs">{city ? `${city.name}/${city.uf}` : "—"}</TableCell>
                            <TableCell className="text-xs">{o.health_unit ?? "—"}</TableCell>
                            <TableCell className="text-xs">{o.contractor_name ?? "—"}</TableCell>
                            <TableCell className="text-xs">{o.dentist_name ?? "—"}</TableCell>
                            <TableCell className="text-xs font-medium">{o.patient_name}</TableCell>
                            <TableCell className="text-xs">{o.service_type || (o.prosthesis_type_id ? typeMap[o.prosthesis_type_id] ?? "—" : "—")}</TableCell>
                            <TableCell className="text-xs">{tech ?? "—"}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground max-w-[180px]">{phases}</TableCell>
                            <TableCell className="text-xs">
                              {exps.length === 0 ? "—" : (
                                <div className="space-y-0.5">
                                  {exps.map((e) => (
                                    <div key={e.id} className="flex gap-2">
                                      <span>{e.description}:</span>
                                      <span className="text-destructive">{brl(e.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-success">{brl(o.price)}</TableCell>
                            <TableCell className="text-right text-warning">{brl(o.cost)}</TableCell>
                            <TableCell className="text-right text-destructive">{brl(expTotal)}</TableCell>
                            <TableCell className={`text-right font-semibold ${balance >= 0 ? "text-success" : "text-destructive"}`}>{brl(balance)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell colSpan={11}>TOTAL GERAL</TableCell>
                        <TableCell className="text-right text-success">{brl(cityTotals.services)}</TableCell>
                        <TableCell className="text-right text-warning">{brl(cityTotals.baseCost)}</TableCell>
                        <TableCell className="text-right text-destructive">{brl(cityTotals.additionalExpenses)}</TableCell>
                        <TableCell className={cityTotals.balance >= 0 ? "text-right text-success" : "text-right text-destructive"}>{brl(cityTotals.balance)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* CONTRATANTE -> PACIENTES -> SERVIÇOS */}
        <TabsContent value="contractors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Relatório por contratante</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contratante..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredContractors.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {filteredContractors.map((c) => {
                    const profit = c.totalRevenue - c.totalCost;
                    return (
                      <AccordionItem key={c.contractor} value={c.contractor}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex w-full flex-wrap items-center justify-between gap-3 pr-2">
                            <div className="text-left">
                              <p className="font-semibold">{c.contractor}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.patients.size} paciente(s) • {c.count} OS •{" "}
                                {c.dentists.size} dentista(s)
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-success">
                                {brl(c.totalRevenue)}
                              </span>
                              <span className="text-destructive">
                                -{brl(c.totalCost)}
                              </span>
                              <Badge variant={profit >= 0 ? "default" : "destructive"}>
                                {brl(profit)}
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          {/* Resumo por status */}
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(c.byStatus).map(([s, n]) => (
                              <Badge key={s} variant="secondary">
                                {STATUS_LABEL[s] ?? s}: {n}
                              </Badge>
                            ))}
                          </div>

                          {/* Pacientes */}
                          <Accordion type="multiple" className="w-full">
                            {Array.from(c.patients.entries())
                              .sort((a, b) => b[1].length - a[1].length)
                              .map(([patient, list]) => {
                                const pRev = list.reduce(
                                  (s, o) => s + Number(o.price ?? 0),
                                  0,
                                );
                                const pCost = list.reduce(
                                  (s, o) => s + Number(totalCostByOs[o.id] ?? 0),
                                  0,
                                );
                                return (
                                  <AccordionItem
                                    key={patient}
                                    value={c.contractor + "::" + patient}
                                  >
                                    <AccordionTrigger className="hover:no-underline">
                                      <div className="flex w-full items-center justify-between gap-3 pr-2 text-sm">
                                        <span className="font-medium">{patient}</span>
                                        <span className="flex gap-3 text-xs">
                                          <span>{list.length} serviço(s)</span>
                                          <span className="text-success">
                                            {brl(pRev)}
                                          </span>
                                          <span className="text-destructive">
                                            -{brl(pCost)}
                                          </span>
                                        </span>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>OS</TableHead>
                                            <TableHead>Serviço</TableHead>
                                            <TableHead>Dentista</TableHead>
                                            <TableHead>Protético</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Entrega</TableHead>
                                            <TableHead className="text-right">
                                              Valor
                                            </TableHead>
                                            <TableHead className="text-right">
                                              Custo
                                            </TableHead>
                                            <TableHead className="text-right">
                                              Lucro
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {list.map((o) => {
                                            const tech = o.technician_id
                                              ? techMap[o.technician_id]?.full_name
                                              : "—";
                                            const orderTotalCost = Number(totalCostByOs[o.id] ?? 0);
                                            const lucro = Number(o.price ?? 0) - orderTotalCost;
                                            return (
                                              <TableRow key={o.id}>
                                                <TableCell className="font-mono text-xs">
                                                  {o.code ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                  {o.prosthesis_type_id
                                                    ? typeMap[o.prosthesis_type_id] ?? "—"
                                                    : "—"}
                                                </TableCell>
                                                <TableCell>
                                                  {o.dentist_name ?? "—"}
                                                </TableCell>
                                                <TableCell>{tech ?? "—"}</TableCell>
                                                <TableCell>
                                                  <Badge variant="outline">
                                                    {STATUS_LABEL[
                                                      String(o.status ?? "")
                                                    ] ?? o.status}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  {fmtDate(
                                                    o.delivered_at ?? o.expected_at,
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-right text-success">
                                                  {brl(o.price)}
                                                </TableCell>
                                                <TableCell className="text-right text-destructive">
                                                  {brl(orderTotalCost)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                  {brl(lucro)}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                          </Accordion>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUÇÃO POR PROTÉTICO */}
        <TabsContent value="technicians">
          <Card>
            <CardHeader>
              <CardTitle>Produção por protético (separado por contratante)</CardTitle>
            </CardHeader>
            <CardContent>
              {productionByTechByContractor.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {productionByTechByContractor.map((t) => (
                    <AccordionItem key={t.techId} value={t.techId}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full items-center justify-between gap-3 pr-2">
                          <div className="text-left">
                            <p className="font-semibold flex items-center gap-2">
                              <UserCog className="h-4 w-4" />
                              {t.techName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.specialty ?? "—"} • {t.totals.count} OS •{" "}
                              {t.totals.delivered} entregue(s)
                            </p>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span className="text-success flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {brl(t.totals.revenue)}
                            </span>
                            <span className="text-destructive flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              {brl(t.totals.cost)}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Contratante</TableHead>
                              <TableHead className="text-right">OS</TableHead>
                              <TableHead className="text-right">Entregues</TableHead>
                              <TableHead className="text-right">Receita</TableHead>
                              <TableHead className="text-right">Custo</TableHead>
                              <TableHead className="text-right">Lucro</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from(t.contractors.entries())
                              .sort((a, b) => b[1].count - a[1].count)
                              .map(([ck, v]) => (
                                <TableRow key={ck}>
                                  <TableCell className="font-medium">{ck}</TableCell>
                                  <TableCell className="text-right">{v.count}</TableCell>
                                  <TableCell className="text-right">
                                    {v.delivered}
                                  </TableCell>
                                  <TableCell className="text-right text-success">
                                    {brl(v.revenue)}
                                  </TableCell>
                                  <TableCell className="text-right text-destructive">
                                    {brl(v.cost)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {brl(v.revenue - v.cost)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUÇÃO POR DENTISTA */}
        <TabsContent value="dentists">
          <Card>
            <CardHeader>
              <CardTitle>Produção por dentista (separado por contratante)</CardTitle>
            </CardHeader>
            <CardContent>
              {productionByDentistByContractor.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {productionByDentistByContractor.map((d) => (
                    <AccordionItem key={d.dentist} value={d.dentist}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full items-center justify-between gap-3 pr-2">
                          <div className="text-left">
                            <p className="font-semibold flex items-center gap-2">
                              <Stethoscope className="h-4 w-4" />
                              {d.dentist}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {d.totals.count} OS • {d.totals.delivered} entregue(s)
                            </p>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span className="text-success">{brl(d.totals.revenue)}</span>
                            <span className="text-destructive">
                              -{brl(d.totals.cost)}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Contratante</TableHead>
                              <TableHead className="text-right">OS</TableHead>
                              <TableHead className="text-right">Entregues</TableHead>
                              <TableHead className="text-right">Receita</TableHead>
                              <TableHead className="text-right">Custo</TableHead>
                              <TableHead className="text-right">Lucro</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from(d.contractors.entries())
                              .sort((a, b) => b[1].count - a[1].count)
                              .map(([ck, v]) => (
                                <TableRow key={ck}>
                                  <TableCell className="font-medium">{ck}</TableCell>
                                  <TableCell className="text-right">{v.count}</TableCell>
                                  <TableCell className="text-right">
                                    {v.delivered}
                                  </TableCell>
                                  <TableCell className="text-right text-success">
                                    {brl(v.revenue)}
                                  </TableCell>
                                  <TableCell className="text-right text-destructive">
                                    {brl(v.cost)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {brl(v.revenue - v.cost)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ETAPAS */}
        <TabsContent value="phases">
          <Card>
            <CardHeader>
              <CardTitle>Consolidado por etapas / fases</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">OS com etapa concluída</TableHead>
                    <TableHead className="text-right">% do total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phaseStats.map((p) => (
                    <TableRow key={p.label}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell className="text-right">{p.count}</TableCell>
                      <TableCell className="text-right">
                        {os.length ? Math.round((p.count / os.length) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function submitPdfDownloadForm(payload: PdfPayload, token: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/public/report-pdf";
  form.style.display = "none";

  const payloadInput = document.createElement("input");
  payloadInput.type = "hidden";
  payloadInput.name = "payload";
  payloadInput.value = JSON.stringify(payload);

  const tokenInput = document.createElement("input");
  tokenInput.type = "hidden";
  tokenInput.name = "access_token";
  tokenInput.value = token;

  form.append(payloadInput, tokenInput);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
