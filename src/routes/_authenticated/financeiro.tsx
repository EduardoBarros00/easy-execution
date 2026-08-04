import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl, fmtDate } from "@/lib/format";
import { Wallet, TrendingUp, TrendingDown, UserCog, Truck, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — LabProt" }] }),
  component: Financeiro,
});

type OS = {
  id: string;
  price: number | null;
  cost: number | null;
  status: string;
  client_id: string | null;
  technician_id: string | null;
  dentist_name: string | null;
  contractor_name: string | null;
  created_at: string;
  patient_name: string | null;
  code: string;
};

function Financeiro() {
  const { data: entries = [] } = useQuery({
    queryKey: ["finance_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["service_orders_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_orders").select("*");
      if (error) throw error;
      return (data ?? []) as OS[];
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technicians").select("id, full_name, commission_pct");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, contractor_name, dentist_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Totais globais
  const totalRevenue = orders.reduce((s, o) => s + Number(o.price ?? 0), 0);
  const totalCost = orders.reduce((s, o) => s + Number(o.cost ?? 0), 0);
  const supplierExpense = entries
    .filter((e) => e.kind === "expense")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalProfit = totalRevenue - totalCost - supplierExpense;

  // Por protético — custo é a comissão do protético (cost da OS)
  const techMap = new Map(technicians.map((t) => [t.id, t]));
  const byTech = new Map<string, { name: string; count: number; cost: number; revenue: number }>();
  orders.forEach((o) => {
    const key = o.technician_id ?? "sem";
    const t = o.technician_id ? techMap.get(o.technician_id) : null;
    const name = t?.full_name ?? "Sem protético";
    const cur = byTech.get(key) ?? { name, count: 0, cost: 0, revenue: 0 };
    cur.count += 1;
    cur.cost += Number(o.cost ?? 0);
    cur.revenue += Number(o.price ?? 0);
    byTech.set(key, cur);
  });

  // Por contratante/dentista
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const byContractor = new Map<string, { contractor: string; dentist: string; count: number; revenue: number; cost: number }>();
  orders.forEach((o) => {
    const c = o.client_id ? clientMap.get(o.client_id) : null;
    const contractor = o.contractor_name || c?.contractor_name || c?.dentist_name || "Sem contratante";
    const dentist = o.dentist_name || c?.dentist_name || "—";
    const key = (o.client_id ?? "sem") + "|" + contractor;
    const cur = byContractor.get(key) ?? { contractor, dentist, count: 0, revenue: 0, cost: 0 };
    cur.count += 1;
    cur.revenue += Number(o.price ?? 0);
    cur.cost += Number(o.cost ?? 0);
    byContractor.set(key, cur);
  });

  // Por fornecedor (expense entries) — descrição livre, agrupamos por descrição
  const bySupplier = new Map<string, { name: string; count: number; total: number; avg: number }>();
  entries
    .filter((e) => e.kind === "expense")
    .forEach((e) => {
      const name = e.description || "Despesa";
      const cur = bySupplier.get(name) ?? { name, count: 0, total: 0, avg: 0 };
      cur.count += 1;
      cur.total += Number(e.amount);
      cur.avg = cur.total / cur.count;
      bySupplier.set(name, cur);
    });

  // Por status — média da despesa (cost) por OS em cada status
  const byStatus = new Map<string, { status: string; count: number; cost: number; revenue: number }>();
  orders.forEach((o) => {
    const cur = byStatus.get(o.status) ?? { status: o.status, count: 0, cost: 0, revenue: 0 };
    cur.count += 1;
    cur.cost += Number(o.cost ?? 0);
    cur.revenue += Number(o.price ?? 0);
    byStatus.set(o.status, cur);
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" description="Visão completa de receitas, custos e lucro" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Receita Contratantes" value={brl(totalRevenue)} icon={TrendingUp} tone="success" />
        <StatCard label="Custo Protéticos" value={brl(totalCost)} icon={UserCog} tone="warning" />
        <StatCard label="Despesa Fornecedores" value={brl(supplierExpense)} icon={Truck} tone="destructive" />
        <StatCard label="Lucro Líquido" value={brl(totalProfit)} icon={Wallet} tone={totalProfit >= 0 ? "primary" : "destructive"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Gastos por Protético</CardTitle></CardHeader>
          <CardContent>
            {byTech.size === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Protético</TableHead><TableHead className="text-right">OS</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Média</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...byTech.values()].sort((a,b)=>b.cost-a.cost).map((t) => (
                    <TableRow key={t.name}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className="text-right">{t.count}</TableCell>
                      <TableCell className="text-right font-medium">{brl(t.cost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{brl(t.cost / t.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" /> Gastos por Fornecedor</CardTitle></CardHeader>
          <CardContent>
            {bySupplier.size === 0 ? <p className="text-sm text-muted-foreground">Sem despesas registradas.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Média</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...bySupplier.values()].sort((a,b)=>b.total-a.total).map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="max-w-[220px] truncate">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right font-medium">{brl(s.total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{brl(s.avg)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Receita por Contratante / Dentista</CardTitle></CardHeader>
          <CardContent>
            {byContractor.size === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Contratante</TableHead><TableHead>Dentista</TableHead><TableHead className="text-right">OS</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Lucro</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...byContractor.values()].sort((a,b)=>b.revenue-a.revenue).map((c) => (
                    <TableRow key={c.contractor + c.dentist}>
                      <TableCell className="font-medium">{c.contractor}</TableCell>
                      <TableCell className="text-muted-foreground">{c.dentist}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right text-success">{brl(c.revenue)}</TableCell>
                      <TableCell className="text-right text-warning">{brl(c.cost)}</TableCell>
                      <TableCell className="text-right font-semibold">{brl(c.revenue - c.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Média de Despesa por Status</CardTitle></CardHeader>
          <CardContent>
            {byStatus.size === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">OS</TableHead><TableHead className="text-right">Receita Total</TableHead><TableHead className="text-right">Custo Total</TableHead><TableHead className="text-right">Custo Médio</TableHead><TableHead className="text-right">Lucro</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...byStatus.values()].map((s) => (
                    <TableRow key={s.status}>
                      <TableCell><Badge variant="outline" className="capitalize">{s.status}</Badge></TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right">{brl(s.revenue)}</TableCell>
                      <TableCell className="text-right">{brl(s.cost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{brl(s.cost / s.count)}</TableCell>
                      <TableCell className="text-right font-semibold">{brl(s.revenue - s.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lançamentos Recentes</CardTitle></CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.slice(0, 20).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.created_at)}</TableCell>
                    <TableCell>{e.description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.kind === "income" ? "default" : "secondary"}>
                        {e.kind === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell className="text-right font-medium">{brl(Number(e.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
