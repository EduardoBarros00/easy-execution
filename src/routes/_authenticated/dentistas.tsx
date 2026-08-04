import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Edit, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { brl, waLink } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dentistas")({
  head: () => ({ meta: [{ title: "Dentistas — LabProt" }] }),
  component: Dentistas,
});

type Dentist = {
  id: string;
  full_name: string;
  cro: string | null;
  specialty: string | null;
  clinic_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  document: string | null;
  address: string | null;
  payment_per_service: number;
  commission_pct: number;
  pix_key: string | null;
  bank: string | null;
  notes: string | null;
  active: boolean;
};

function Dentistas() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dentist | null>(null);

  const { data: dentists = [] } = useQuery({
    queryKey: ["dentists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dentists").select("*").order("full_name");
      if (error) throw error;
      return data as Dentist[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["service_orders_dent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id,status,price,dentist_name,delivered_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; delivered: number; pending: number; revenue: number; paid: number }>();
    orders.forEach((o) => {
      const name = (o.dentist_name ?? "").trim().toLowerCase();
      if (!name) return;
      const cur = map.get(name) ?? { count: 0, delivered: 0, pending: 0, revenue: 0, paid: 0 };
      cur.count += 1;
      cur.revenue += Number(o.price ?? 0);
      if (o.status === "delivered") {
        cur.delivered += 1;
        cur.paid += Number(o.price ?? 0);
      } else {
        cur.pending += 1;
      }
      map.set(name, cur);
    });
    return map;
  }, [orders]);

  const filtered = dentists.filter((d) =>
    [d.full_name, d.cro, d.specialty, d.clinic_name, d.phone, d.email]
      .some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => (fd.get(k) as string) || null;
    const payload = {
      full_name: (fd.get("full_name") as string) || "",
      cro: s("cro"),
      specialty: s("specialty"),
      clinic_name: s("clinic_name"),
      phone: s("phone"),
      whatsapp: s("whatsapp"),
      email: s("email"),
      document: s("document"),
      address: s("address"),
      payment_per_service: Number(fd.get("payment_per_service") || 0),
      commission_pct: Number(fd.get("commission_pct") || 0),
      pix_key: s("pix_key"),
      bank: s("bank"),
      notes: s("notes"),
      active: fd.get("active") === "on",
    };
    if (editing) {
      const { error } = await supabase.from("dentists").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Dentista atualizado");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("dentists").insert({ ...payload, owner_id: user!.id });
      if (error) return toast.error(error.message);
      toast.success("Dentista cadastrado");
    }
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["dentists"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este dentista?")) return;
    const { error } = await supabase.from("dentists").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["dentists"] });
  };

  return (
    <>
      <PageHeader
        title="Dentistas"
        description="Cadastro profissional e identificação de pagamentos por atendimento"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Novo dentista</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar dentista" : "Novo dentista"}</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field name="full_name" label="Nome completo *" required defaultValue={editing?.full_name} />
                <Field name="cro" label="CRO" defaultValue={editing?.cro ?? ""} />
                <Field name="specialty" label="Especialidade" defaultValue={editing?.specialty ?? ""} />
                <Field name="clinic_name" label="Clínica" defaultValue={editing?.clinic_name ?? ""} />
                <Field name="document" label="CPF / CNPJ" defaultValue={editing?.document ?? ""} />
                <Field name="phone" label="Telefone" defaultValue={editing?.phone ?? ""} />
                <Field name="whatsapp" label="WhatsApp" defaultValue={editing?.whatsapp ?? ""} />
                <Field name="email" label="E-mail" type="email" defaultValue={editing?.email ?? ""} />
                <Field name="payment_per_service" label="Pagamento por atendimento (R$)" type="number" step="0.01" defaultValue={String(editing?.payment_per_service ?? 0)} />
                <Field name="commission_pct" label="Comissão (%)" type="number" step="0.01" defaultValue={String(editing?.commission_pct ?? 0)} />
                <Field name="pix_key" label="Chave PIX" defaultValue={editing?.pix_key ?? ""} />
                <Field name="bank" label="Banco / Conta" defaultValue={editing?.bank ?? ""} />
                <div className="sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input name="address" defaultValue={editing?.address ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Ativo
                </label>
                <DialogFooter className="sm:col-span-2">
                  <Button type="submit">{editing ? "Salvar" : "Cadastrar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar dentista…" className="pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dentista</TableHead>
                <TableHead>CRO</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Valor / atend.</TableHead>
                <TableHead className="text-right">Atendimentos</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const st = stats.get(d.full_name.trim().toLowerCase()) ?? { count: 0, delivered: 0, pending: 0, revenue: 0, paid: 0 };
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.full_name}
                      {!d.active && <Badge variant="secondary" className="ml-2">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.cro || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.specialty || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.phone || d.email || "—"}</TableCell>
                    <TableCell className="text-right">{brl(Number(d.payment_per_service))}</TableCell>
                    <TableCell className="text-right">{st.count}</TableCell>
                    <TableCell className="text-right text-success">{brl(st.paid)}</TableCell>
                    <TableCell className="text-right text-warning">{brl(st.revenue - st.paid)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {d.whatsapp && (
                          <Button size="icon" variant="ghost" asChild>
                            <a href={waLink(d.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Nenhum dentista cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}
