import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DentalMark } from "@/components/dental-mark";
import { brl, fmtDate } from "@/lib/format";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Activity,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LabProt" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = new Date();
      const start30 = new Date(today); start30.setDate(today.getDate() - 30);
      const [{ data: fin }, { data: os }] = await Promise.all([
        supabase.from("finance_entries").select("*").gte("created_at", start30.toISOString()),
        supabase.from("service_orders").select("*").order("created_at", { ascending: false }),
      ]);
      return { fin: fin ?? [], os: os ?? [] };
    },
  });

  const fin = data?.fin ?? [];
  const os = data?.os ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);

  const paidIncome = fin.filter((e) => e.kind === "income" && e.status === "paid");
  const paidExpense = fin.filter((e) => e.kind === "expense" && e.status === "paid");
  const totalIn = paidIncome.reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = paidExpense.reduce((s, e) => s + Number(e.amount), 0);
  const profit = totalIn - totalOut;

  const inProgress = os.filter((o) => o.status === "in_progress" || o.status === "pending");
  const pending = os.filter((o) => o.status === "pending");
  const producing = os.filter((o) => o.status === "in_progress");
  const delivered = os.filter((o) => o.status === "delivered");
  const late = os.filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.expected_at && o.expected_at < todayStr);
  const pendingPayments = fin.filter((e) => e.kind === "income" && e.status === "pending");

  const days: Record<string, { date: string; in: number; out: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    days[k] = { date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), in: 0, out: 0 };
  }
  for (const e of fin) {
    const k = (e.paid_at ?? e.created_at).slice(0, 10);
    if (days[k]) {
      if (e.kind === "income" && e.status === "paid") days[k].in += Number(e.amount);
      if (e.kind === "expense" && e.status === "paid") days[k].out += Number(e.amount);
    }
  }
  const chartData = Object.values(days);

  const productionFlow = [
    { label: "Aguardando início", value: pending.length, icon: Clock, tone: "bg-warning/10 text-warning" },
    { label: "Em produção", value: producing.length, icon: Activity, tone: "bg-primary/10 text-primary" },
    { label: "Entregues", value: delivered.length, icon: CheckCircle2, tone: "bg-success/10 text-success" },
    { label: "Precisam atenção", value: late.length, icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
  ];

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-[oklch(0.28_0.07_205)] via-[oklch(0.34_0.09_195)] to-[oklch(0.52_0.12_185)] p-6 text-white shadow-[0_24px_60px_-34px_oklch(0.3_0.12_195/0.8)] md:p-7">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/[0.05]" />
        <div className="absolute -bottom-28 right-24 h-56 w-56 rounded-full border border-white/10 bg-white/[0.04]" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <DentalMark className="h-12 w-12 bg-white/14 text-white shadow-none ring-1 ring-white/20 backdrop-blur" />
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-white/65">
                <Sparkles className="h-3.5 w-3.5" /> Gestão odontológica
              </div>
              <h1 className="text-2xl font-bold tracking-[-0.035em] md:text-3xl">Visão geral do laboratório</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/72">Acompanhe produção, entregas e desempenho financeiro em uma única visão.</p>
            </div>
          </div>
          <Button asChild className="border border-white/20 bg-white text-[oklch(0.32_0.08_200)] shadow-lg hover:bg-white/92">
            <Link to="/os"><Plus className="mr-1 h-4 w-4" /> Nova Ordem de Serviço</Link>
          </Button>
        </div>
      </section>

      <PageHeader title="Indicadores" description="Resumo dos últimos 30 dias e situação atual da produção" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entradas pagas" value={brl(totalIn)} icon={TrendingUp} tone="success" hint="Últimos 30 dias" />
        <StatCard label="Saídas pagas" value={brl(totalOut)} icon={TrendingDown} tone="destructive" hint="Últimos 30 dias" />
        <StatCard label="Lucro líquido" value={brl(profit)} icon={Wallet} tone="primary" hint="Entradas − saídas" />
        <StatCard label="OS em andamento" value={inProgress.length} icon={ClipboardList} tone="primary" hint="Pendentes + produção" />
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader className="border-b border-border/55 bg-muted/20 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Fluxo de produção</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Situação atual das ordens de serviço</p>
            </div>
            <Button variant="outline" size="sm" asChild><Link to="/os">Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {productionFlow.map((step) => (
            <div key={step.label} className="flex items-center gap-3 rounded-2xl border border-border/55 bg-background/70 p-3.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${step.tone}`}><step.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-xl font-bold tracking-tight">{step.value}</p>
                <p className="text-xs text-muted-foreground">{step.label}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fluxo de caixa</CardTitle>
            <p className="text-xs text-muted-foreground">Entradas e saídas pagas nos últimos 14 dias</p>
          </CardHeader>
          <CardContent className="h-72 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid vertical={false} strokeDasharray="4 6" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 14px 30px rgba(0,0,0,.08)" }} formatter={(v: number) => brl(v)} />
                <Bar dataKey="in" name="Entradas" fill="var(--chart-3)" radius={[6, 6, 2, 2]} />
                <Bar dataKey="out" name="Saídas" fill="var(--chart-5)" radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/55 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">OS recentes</CardTitle>
              <span className="rounded-full bg-primary/8 px-2 py-1 text-[10px] font-semibold text-primary">Atualizado</span>
            </div>
          </CardHeader>
          <CardContent className="p-2.5">
            <ul className="space-y-1">
              {os.slice(0, 6).map((o) => {
                const overdue = o.status !== "delivered" && o.status !== "cancelled" && o.expected_at && o.expected_at < todayStr;
                return (
                  <li key={o.id}>
                    <Link to="/os/$id" params={{ id: o.id }} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-primary/[0.04]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{o.code}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.patient_name} · {fmtDate(o.expected_at)}</p>
                      </div>
                      <StatusBadge status={o.status} overdue={!!overdue} />
                    </Link>
                  </li>
                );
              })}
              {os.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS ainda</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="OS entregues" value={delivered.length} icon={CheckCircle2} tone="success" />
        <StatCard label="OS atrasadas" value={late.length} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Pagamentos pendentes" value={pendingPayments.length} icon={Clock} tone="warning" hint={brl(pendingPayments.reduce((s, e) => s + Number(e.amount), 0))} />
      </div>
    </>
  );
}
