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
import { fmtShortDate, waLink } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pacientes")({
  head: () => ({ meta: [{ title: "Pacientes — LabProt" }] }),
  component: Pacientes,
});

type Patient = {
  id: string;
  full_name: string;
  document: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

function Pacientes() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("patients").select("*").order("full_name");
      if (error) throw error;
      return data as Patient[];
    },
  });

  const filtered = patients.filter((p) =>
    [p.full_name, p.phone, p.email, p.document].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => (fd.get(k) as string) || null;
    const payload = {
      full_name: (fd.get("full_name") as string) || "",
      document: s("document"),
      birth_date: s("birth_date"),
      phone: s("phone"),
      whatsapp: s("whatsapp"),
      email: s("email"),
      address: s("address"),
      notes: s("notes"),
    };
    if (editing) {
      const { error } = await (supabase as any).from("patients").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Paciente atualizado");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("patients").insert({ ...payload, owner_id: user!.id });
      if (error) return toast.error(error.message);
      toast.success("Paciente cadastrado");
    }
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["patients"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este paciente?")) return;
    const { error } = await (supabase as any).from("patients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["patients"] });
  };

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Cadastro de pacientes — vincule vários a uma mesma OS"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Novo paciente</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar paciente" : "Novo paciente"}</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Nome completo *</Label>
                  <Input name="full_name" required defaultValue={editing?.full_name ?? ""} />
                </div>
                <Field name="document" label="CPF / RG" defaultValue={editing?.document ?? ""} />
                <Field name="birth_date" label="Nascimento" type="date" defaultValue={editing?.birth_date ?? ""} />
                <Field name="phone" label="Telefone" defaultValue={editing?.phone ?? ""} />
                <Field name="whatsapp" label="WhatsApp" defaultValue={editing?.whatsapp ?? ""} />
                <Field name="email" label="E-mail" type="email" defaultValue={editing?.email ?? ""} />
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
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente…" className="pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Nascimento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.document && p.document !== p.birth_date ? p.document : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtShortDate(p.birth_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.phone || p.email || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.whatsapp && (
                        <Button size="icon" variant="ghost" asChild>
                          <a href={waLink(p.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhum paciente</TableCell></TableRow>
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
