import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { brl, fmtDate } from "@/lib/format";
import { Wallet, Plus, Trash2, TrendingDown, Receipt, Tags } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despesas")({
  head: () => ({ meta: [{ title: "Despesas — LabProt" }] }),
  component: Despesas,
});

function monthKey(d: string) {
  return d.slice(0, 7); // YYYY-MM
}

function Despesas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState<string>(today.slice(0, 7));
  const [form, setForm] = useState({
    date: today,
    category_id: "",
    description: "",
    amount: "",
    person: "",
    status: "paid" as "paid" | "pending",
  });
  const [newCatName, setNewCatName] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_categories")
        .select("id, name, kind")
        .eq("kind", "expense")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["expense_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("id, description, amount, category_id, status, paid_at, due_date, created_at, os_id")
        .eq("kind", "expense")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const amount = Number(form.amount.replace(",", "."));
      if (!amount || amount <= 0) throw new Error("Valor inválido");
      if (!form.category_id) throw new Error("Selecione uma categoria");
      const descBase = form.description.trim() || categories.find((c) => c.id === form.category_id)?.name || "Despesa";
      const desc = form.person.trim() ? `${descBase} — ${form.person.trim()}` : descBase;
      const { error } = await supabase.from("finance_entries").insert({
        owner_id: u.user.id,
        kind: "expense",
        category_id: form.category_id,
        description: desc,
        amount,
        status: form.status,
        paid_at: form.status === "paid" ? form.date : null,
        due_date: form.date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa registrada");
      qc.invalidateQueries({ queryKey: ["expense_entries"] });
      qc.invalidateQueries({ queryKey: ["finance_entries"] });
      setOpen(false);
      setForm({ date: today, category_id: "", description: "", amount: "", person: "", status: "paid" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCatMut = useMutation({
    mutationFn: async () => {
      const name = newCatName.trim();
      if (!name) throw new Error("Informe um nome");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("finance_categories")
        .insert({ owner_id: u.user.id, name, kind: "expense" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria criada");
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
      setNewCatName("");
      setNewCatOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa removida");
      qc.invalidateQueries({ queryKey: ["expense_entries"] });
      qc.invalidateQueries({ queryKey: ["finance_entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Filter by selected month using paid_at OR due_date OR created_at
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const d = (e.paid_at as string) || (e.due_date as string) || (e.created_at as string);
      return d && monthKey(d) === month;
    });
  }, [entries, month]);

  const totalMonth = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = entries.reduce((s, e) => s + Number(e.amount), 0);

  // Group filtered by category
  const byCategory = useMemo(() => {
    const m = new Map<string, { name: string; count: number; total: number }>();
    filtered.forEach((e) => {
      const key = (e.category_id as string) || "none";
      const name = (e.category_id && catMap.get(e.category_id as string)) || "Sem categoria";
      const cur = m.get(key) ?? { name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(e.amount);
      m.set(key, cur);
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [filtered, catMap]);

  // Months list for selector (last 12 + current)
  const months = useMemo(() => {
    const set = new Set<string>();
    set.add(today.slice(0, 7));
    entries.forEach((e) => {
      const d = (e.paid_at as string) || (e.due_date as string) || (e.created_at as string);
      if (d) set.add(monthKey(d));
    });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [entries, today]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas"
        description="Registre e categorize todos os gastos da empresa"
        actions={
          <div className="flex gap-2">
            <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Tags className="h-4 w-4 mr-1" /> Categoria</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova categoria de despesa</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Ex: Estacionamento" />
                </div>
                <DialogFooter>
                  <Button onClick={() => createCatMut.mutate()} disabled={createCatMut.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova despesa</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar despesa</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data</Label>
                      <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Valor (R$)</Label>
                      <Input inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Pessoa / Local (opcional)</Label>
                    <Input value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} placeholder="Ex: Dr. João, Posto Shell..." />
                  </div>
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Comissão semanal, Almoço..." />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: "paid" | "pending") => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Label className="text-sm">Mês:</Label>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={`Total do mês (${month})`} value={brl(totalMonth)} icon={TrendingDown} tone="destructive" />
        <StatCard label="Lançamentos no mês" value={String(filtered.length)} icon={Receipt} tone="warning" />
        <StatCard label="Total acumulado" value={brl(totalAll)} icon={Wallet} tone="primary" />
      </div>

      <Card>
        <CardHeader><CardTitle>Gastos por categoria — {month}</CardTitle></CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% do mês</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCategory.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.count}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(c.total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totalMonth > 0 ? ((c.total / totalMonth) * 100).toFixed(1) : "0"}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{filtered.length}</TableCell>
                  <TableCell className="text-right">{brl(totalMonth)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>

              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Despesas detalhadas — {month}</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const d = (e.paid_at as string) || (e.due_date as string) || (e.created_at as string);
                  const catName = (e.category_id && catMap.get(e.category_id as string)) || "Sem categoria";
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{fmtDate(d)}</TableCell>
                      <TableCell><Badge variant="outline">{catName}</Badge></TableCell>
                      <TableCell className="max-w-[320px] truncate">{e.description}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "paid" ? "default" : "secondary"}>
                          {e.status === "paid" ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{brl(Number(e.amount))}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Excluir esta despesa?")) deleteMut.mutate(e.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={4}>Total do mês ({filtered.length} lançamento{filtered.length !== 1 ? "s" : ""})</TableCell>
                  <TableCell className="text-right">{brl(totalMonth)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

