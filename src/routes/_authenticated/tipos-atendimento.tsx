import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tipos-atendimento")({
  head: () => ({ meta: [{ title: "Tipos de Atendimento — LabProt" }] }),
  component: TiposAtendimento,
});

type ProsthesisType = {
  id: string;
  name: string;
  default_price: number | null;
  default_cost: number | null;
  default_commission_pct: number | null;
  avg_days: number | null;

};

function TiposAtendimento() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProsthesisType | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [commission, setCommission] = useState("");
  const [days, setDays] = useState("");

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["prosthesis_types_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prosthesis_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ProsthesisType[];
    },
  });

  const openNew = () => {
    setEditing(null);
    setName("");
    setPrice("");
    setCost("");
    setCommission("");
    setDays("");
    setOpen(true);
  };

  const openEdit = (t: ProsthesisType) => {
    setEditing(t);
    setName(t.name);
    setPrice(t.default_price?.toString() ?? "");
    setCost(t.default_cost?.toString() ?? "");
    setCommission(t.default_commission_pct?.toString() ?? "");
    setDays(t.avg_days?.toString() ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Nome é obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessão expirada");

    const payload = {
      name: name.trim(),
      default_price: Number(price) || 0,
      default_cost: Number(cost) || 0,
      default_commission_pct: Number(commission) || 0,
      avg_days: Number(days) || 0,
    };

    if (editing) {
      const { error } = await supabase
        .from("prosthesis_types")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Tipo atualizado");
    } else {
      const { error } = await supabase
        .from("prosthesis_types")
        .insert({ ...payload, owner_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("Tipo cadastrado");
    }
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["prosthesis_types_full"] });
    qc.invalidateQueries({ queryKey: ["types-mini"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este tipo de atendimento?")) return;
    const { error } = await supabase.from("prosthesis_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["prosthesis_types_full"] });
    qc.invalidateQueries({ queryKey: ["types-mini"] });
  };

  const fmt = (n: number | null) =>
    n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <PageHeader
        title="Tipos de Atendimento"
        description="Cadastre os tipos de atendimento usados nas Ordens de Serviço"
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Novo tipo
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              {editing ? "Editar tipo" : "Novo tipo de atendimento"}
            </DialogTitle>
            <DialogDescription>
              Os tipos cadastrados aqui aparecem no seletor da Ordem de Serviço.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: PPR Superior, Acrilização, Reembasamento…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço padrão (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Custo padrão (R$)</Label>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Comissão padrão (%)</Label>
              <Input type="number" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo médio (dias)</Label>
              <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Prazo (d)</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right">{fmt(t.default_price)}</TableCell>
                    <TableCell className="text-right">{fmt(t.default_cost)}</TableCell>
                    <TableCell className="text-right">{t.default_commission_pct ?? 0}%</TableCell>
                    <TableCell className="text-right">{t.avg_days ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && types.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum tipo cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
