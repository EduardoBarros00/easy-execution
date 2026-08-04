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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { SERVICE_CATALOG } from "@/lib/service-catalog";

export const Route = createFileRoute("/_authenticated/proteticos")({
  head: () => ({ meta: [{ title: "Protéticos — LabProt" }] }),
  component: Page,
});

type Tech = {
  id: string;
  full_name: string;
  specialty: string | null;
  document: string | null;
  phone: string | null;
  bank: string | null;
  pix_key: string | null;
  commission_pct: number | null;
  services: string | null;
  active: boolean;
};

type ServiceItem = { category: string; name: string; cost: number };

const parseServices = (raw: string | null): ServiceItem[] => {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p))
      return p.map((i) => ({
        category: String(i.category ?? ""),
        name: String(i.name ?? ""),
        cost: Number(i.cost) || 0,
      }));
  } catch {
    /* noop */
  }
  return [];
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tech | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [presetValue, setPresetValue] = useState<string>("");

  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Tech[];
    },
  });

  const { data: production = [] } = useQuery({
    queryKey: ["tech-production"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("technician_id,status,price,cost");
      return data ?? [];
    },
  });

  const stats = (id: string) => {
    const rows = production.filter((r) => r.technician_id === id);
    const total = rows.length;
    const delivered = rows.filter((r) => r.status === "delivered").length;
    const revenue = rows.reduce((s, r) => s + Number(r.price ?? 0), 0);
    return { total, delivered, revenue };
  };

  const totalCost = services.reduce((s, i) => s + i.cost, 0);

  const addPreset = (val: string) => {
    if (!val) return;
    const [catId, ...rest] = val.split("::");
    const name = rest.join("::");
    const cat = SERVICE_CATALOG.find((c) => c.id === catId);
    if (!cat) return;
    if (services.some((s) => s.name === name && s.category === cat.label))
      return toast.info("Serviço já adicionado");
    setServices((a) => [...a, { category: cat.label, name, cost: 0 }]);
    setPresetValue("");
  };

  const addCustom = () =>
    setServices((a) => [...a, { category: "Personalizado", name: "", cost: 0 }]);

  const updateService = (idx: number, patch: Partial<ServiceItem>) =>
    setServices((a) => a.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const removeService = (idx: number) =>
    setServices((a) => a.filter((_, i) => i !== idx));

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => (fd.get(k) as string) || null;
    const cleanServices = services.filter((it) => it.name.trim());
    const payload = {
      full_name: (fd.get("full_name") as string) || "",
      specialty: s("specialty"),
      document: s("document"),
      phone: s("phone"),
      bank: s("bank"),
      pix_key: s("pix_key"),
      commission_pct: Number(fd.get("commission_pct") || 0),
      services: cleanServices.length ? JSON.stringify(cleanServices) : null,
    };
    if (editing) {
      const { error } = await supabase
        .from("technicians")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Atualizado");
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("technicians")
        .insert({ ...payload, owner_id: user!.id });
      if (error) return toast.error(error.message);
      toast.success("Criado");
    }
    setOpen(false);
    setEditing(null);
    setServices([]);
    qc.invalidateQueries({ queryKey: ["technicians"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from("technicians").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["technicians"] });
  };

  // group services by category for display
  const grouped = services.reduce<Record<string, { idx: number; item: ServiceItem }[]>>(
    (acc, item, idx) => {
      (acc[item.category] ||= []).push({ idx, item });
      return acc;
    },
    {},
  );

  return (
    <>
      <PageHeader
        title="Protéticos"
        description="Profissionais técnicos do laboratório"
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setEditing(null);
                setServices([]);
                setPresetValue("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar" : "Novo"} protético
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={onSubmit}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <F
                  label="Nome completo *"
                  name="full_name"
                  required
                  defaultValue={editing?.full_name}
                />
                <F
                  label="Especialidade"
                  name="specialty"
                  defaultValue={editing?.specialty ?? ""}
                />
                <F
                  label="CPF"
                  name="document"
                  defaultValue={editing?.document ?? ""}
                />
                <F
                  label="Telefone"
                  name="phone"
                  defaultValue={editing?.phone ?? ""}
                />
                <F
                  label="Banco"
                  name="bank"
                  defaultValue={editing?.bank ?? ""}
                />
                <F
                  label="Chave PIX"
                  name="pix_key"
                  defaultValue={editing?.pix_key ?? ""}
                />
                <F
                  label="Comissão (%)"
                  name="commission_pct"
                  type="number"
                  step="0.01"
                  defaultValue={String(editing?.commission_pct ?? 0)}
                />

                <div className="space-y-3 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Tipos de serviço e custos</Label>
                    <div className="flex items-center gap-2">
                      <Select value={presetValue} onValueChange={addPreset}>
                        <SelectTrigger className="h-9 w-[260px]">
                          <SelectValue placeholder="Adicionar do catálogo" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {SERVICE_CATALOG.map((cat) => (
                            <SelectGroup key={cat.id}>
                              <SelectLabel>{cat.label}</SelectLabel>
                              {cat.items.map((name) => (
                                <SelectItem
                                  key={`${cat.id}::${name}`}
                                  value={`${cat.id}::${name}`}
                                >
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addCustom}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Personalizado
                      </Button>
                    </div>
                  </div>

                  {services.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum serviço adicionado.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(grouped).map(([cat, rows]) => (
                        <div key={cat} className="rounded-md border p-2">
                          <div className="mb-2 text-xs font-medium text-muted-foreground">
                            {cat}
                          </div>
                          <div className="space-y-1.5">
                            {rows.map(({ idx, item }) => (
                              <div
                                key={idx}
                                className="grid grid-cols-12 items-center gap-2"
                              >
                                <Input
                                  className="col-span-8"
                                  placeholder="Nome do serviço"
                                  value={item.name}
                                  onChange={(e) =>
                                    updateService(idx, { name: e.target.value })
                                  }
                                />
                                <Input
                                  className="col-span-3 text-right"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="Custo"
                                  value={item.cost}
                                  onChange={(e) =>
                                    updateService(idx, {
                                      cost: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="col-span-1"
                                  onClick={() => removeService(idx)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end border-t pt-2 text-sm font-medium">
                        Total de custos: {fmtBRL(totalCost)}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="sm:col-span-2">
                  <Button type="submit">
                    {editing ? "Salvar" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Serviços</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>OS totais</TableHead>
                <TableHead>Entregues</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techs.map((t) => {
                const s = stats(t.id);
                const svcCount = parseServices(t.services).length;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.specialty || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {svcCount || "—"}
                    </TableCell>
                    <TableCell>
                      {Number(t.commission_pct || 0).toFixed(2)}%
                    </TableCell>
                    <TableCell>{s.total}</TableCell>
                    <TableCell>{s.delivered}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(t);
                          setServices(parseServices(t.services));
                          setOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(t.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {techs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhum protético
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function F({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}
