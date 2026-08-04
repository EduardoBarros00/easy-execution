import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl, fmtDate } from "@/lib/format";
import { Wallet, TrendingUp, TrendingDown, ClipboardList, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
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
  const delivered = os.filter((o) => o.status === "delivered");
  const late = os.filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.expected_at && o.expected_at < todayStr);
  const pendingPayments = fin.filter((e) => e.kind === "income" && e.status === "pending");

  // chart: last 14 days
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

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral dos últimos 30 dias"
        actions={
          <Button asChild>
            <Link to="/os"><Plus className="mr-1 h-4 w-4" /> Nova OS</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entradas (pagas)" value={brl(totalIn)} icon={TrendingUp} tone="success" hint="Últimos 30 dias" />
        <StatCard label="Saídas (pagas)" value={brl(totalOut)} icon={TrendingDown} tone="destructive" hint="Últimos 30 dias" />
        <StatCard label="Lucro líquido" value={brl(profit)} icon={Wallet} tone="primary" hint="Entradas − saídas" />
        <StatCard label="OS em andamento" value={inProgress.length} icon={ClipboardList} tone="primary" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="OS entregues" value={delivered.length} icon={CheckCircle2} tone="success" />
        <StatCard label="OS atrasadas" value={late.length} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Pagamentos pendentes" value={pendingPayments.length} icon={Clock} tone="warning" hint={brl(pendingPayments.reduce((s, e) => s + Number(e.amount), 0))} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Fluxo de caixa — últimos 14 dias</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                <Bar dataKey="in" name="Entradas" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Saídas" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">OS recentes</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {os.slice(0, 6).map((o) => {
                const overdue = o.status !== "delivered" && o.status !== "cancelled" && o.expected_at && o.expected_at < todayStr;
                return (
                  <li key={o.id}>
                    <Link to="/os/$id" params={{ id: o.id }} className="flex items-center justify-between gap-2 py-3 hover:opacity-80">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{o.code}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.patient_name} · {fmtDate(o.expected_at)}</p>
                      </div>
                      <StatusBadge status={o.status} overdue={!!overdue} />
                    </Link>
                  </li>
                );
              })}
              {os.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhuma OS ainda</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
