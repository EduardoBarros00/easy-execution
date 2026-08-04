import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Edit, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { waLink } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Contratantes — LabProt" }] }),
  component: Clientes,
});

type Client = {
  id: string;
  dentist_name: string;
  clinic_name: string | null;
  contractor_name: string | null;
  document: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  credit_limit: number | null;
};

function Clientes() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("dentist_name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const filtered = clients.filter((c) =>
    [c.dentist_name, c.clinic_name, c.phone, c.email, c.document].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => (fd.get(k) as string) || null;
    const payload = {
      dentist_name: (fd.get("dentist_name") as string) || "",
      clinic_name: s("clinic_name"),
      contractor_name: s("contractor_name"),
      document: s("document"),
      phone: s("phone"),
      whatsapp: s("whatsapp"),
      email: s("email"),
      address: s("address"),
      notes: s("notes"),
      credit_limit: Number(fd.get("credit_limit") || 0),
    };
    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Cliente atualizado");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("clients").insert({ ...payload, owner_id: user!.id });
      if (error) return toast.error(error.message);
      toast.success("Cliente criado");
    }
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <>
      <PageHeader
        title="Contratantes"
        description="Contratantes dos serviços do laboratório"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Novo contratante</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar contratante" : "Novo contratante"}</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field name="contractor_name" label="Nome do contratante dos serviços *" placeholder="Quem contrata/paga (clínica, dentista ou terceiro)" defaultValue={editing?.contractor_name ?? ""} />
                <Field name="clinic_name" label="Clínica" defaultValue={editing?.clinic_name ?? ""} />
                <Field name="dentist_name" label="Nome do dentista *" required defaultValue={editing?.dentist_name} />

                <Field name="document" label="CPF / CNPJ" defaultValue={editing?.document ?? ""} />
                <Field name="phone" label="Telefone" defaultValue={editing?.phone ?? ""} />
                <Field name="whatsapp" label="WhatsApp" defaultValue={editing?.whatsapp ?? ""} />
                <Field name="email" label="E-mail" type="email" defaultValue={editing?.email ?? ""} />
                <Field name="credit_limit" label="Limite de crédito (R$)" type="number" step="0.01" defaultValue={String(editing?.credit_limit ?? 0)} />
                <div className="sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input name="address" defaultValue={editing?.address ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} />
                </div>
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
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contratante</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Dentista</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.contractor_name || c.dentist_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.clinic_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.dentist_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || c.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.document || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.whatsapp && (
                        <Button size="icon" variant="ghost" asChild>
                          <a href={waLink(c.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Nenhum contratante</TableCell></TableRow>
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
