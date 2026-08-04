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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — LabProt" }] }),
  component: Page,
});

type Supplier = {
  id: string;
  name: string;
  document: string | null;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
  products: string | null;
  notes: string | null;
  active: boolean;
};

type ProductItem = { name: string; qty: number; unit_price: number };

const parseProducts = (raw: string | null): ProductItem[] => {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p))
      return p.map((i) => ({
        name: String(i.name ?? ""),
        qty: Number(i.qty) || 0,
        unit_price: Number(i.unit_price) || 0,
      }));
  } catch {
    return raw
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ name, qty: 1, unit_price: 0 }));
  }
  return [];
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [items, setItems] = useState<ProductItem[]>([]);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const totalItems = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const updateItem = (idx: number, patch: Partial<ProductItem>) =>
    setItems((a) => a.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () =>
    setItems((a) => [...a, { name: "", qty: 1, unit_price: 0 }]);
  const removeItem = (idx: number) =>
    setItems((a) => a.filter((_, i) => i !== idx));

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => ((fd.get(k) as string) || "").trim() || null;
    const payload = {
      name: (fd.get("name") as string)?.trim() || "",
      document: s("document"),
      contact_name: s("contact_name"),
      phone: s("phone"),
      whatsapp: s("whatsapp"),
      email: s("email"),
      address: s("address"),
      category: s("category"),
      products: items.length
        ? JSON.stringify(items.filter((i) => i.name.trim()))
        : null,
      notes: s("notes"),
    };
    if (!payload.name) return toast.error("Informe o nome do fornecedor");

    if (editing) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Fornecedor atualizado");
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return toast.error("Sessão expirada");
      const { error } = await supabase
        .from("suppliers")
        .insert({ ...payload, owner_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("Fornecedor cadastrado");
    }
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este fornecedor?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor excluído");
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  const waLink = (num: string | null) => {
    if (!num) return null;
    const digits = num.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : null;
  };

  return (
    <>
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores de materiais e equipamentos"
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setEditing(null);
                setItems([]);
              } else if (!editing) {
                setItems([]);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Novo fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar" : "Novo"} fornecedor
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={onSubmit}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <F
                  label="Nome / Razão social *"
                  name="name"
                  required
                  defaultValue={editing?.name}
                />
                <F
                  label="Categoria"
                  name="category"
                  placeholder="Ex: Materiais, Equipamentos"
                  defaultValue={editing?.category ?? ""}
                />
                <F
                  label="CNPJ / CPF"
                  name="document"
                  defaultValue={editing?.document ?? ""}
                />
                <F
                  label="Contato"
                  name="contact_name"
                  defaultValue={editing?.contact_name ?? ""}
                />
                <F
                  label="Telefone"
                  name="phone"
                  defaultValue={editing?.phone ?? ""}
                />
                <F
                  label="WhatsApp"
                  name="whatsapp"
                  placeholder="DDD + número"
                  defaultValue={editing?.whatsapp ?? ""}
                />
                <F
                  label="E-mail"
                  name="email"
                  type="email"
                  defaultValue={editing?.email ?? ""}
                />
                <F
                  label="Endereço"
                  name="address"
                  defaultValue={editing?.address ?? ""}
                />
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Produtos fornecidos</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addItem}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Adicionar produto
                    </Button>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum produto adicionado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="hidden grid-cols-12 gap-2 text-xs text-muted-foreground sm:grid">
                        <div className="col-span-6">Material</div>
                        <div className="col-span-2 text-right">Qtd</div>
                        <div className="col-span-2 text-right">Vlr unit.</div>
                        <div className="col-span-2 text-right">Subtotal</div>
                      </div>
                      {items.map((it, idx) => {
                        const sub = it.qty * it.unit_price;
                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-12 items-center gap-2"
                          >
                            <Input
                              className="col-span-12 sm:col-span-6"
                              placeholder="Nome do material"
                              value={it.name}
                              onChange={(e) =>
                                updateItem(idx, { name: e.target.value })
                              }
                            />
                            <Input
                              className="col-span-4 sm:col-span-2 text-right"
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.qty}
                              onChange={(e) =>
                                updateItem(idx, {
                                  qty: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <Input
                              className="col-span-4 sm:col-span-2 text-right"
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.unit_price}
                              onChange={(e) =>
                                updateItem(idx, {
                                  unit_price: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <div className="col-span-3 sm:col-span-2 text-right text-sm tabular-nums">
                              {fmtBRL(sub)}
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="col-span-1"
                              onClick={() => removeItem(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                      <div className="flex justify-end border-t pt-2 text-sm font-medium">
                        Total: {fmtBRL(totalItems)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    name="notes"
                    rows={3}
                    defaultValue={editing?.notes ?? ""}
                  />
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
                <TableHead>Categoria</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => {
                const wa = waLink(s.whatsapp || s.phone);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.category || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.contact_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.phone || s.whatsapp || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {wa && (
                        <Button size="icon" variant="ghost" asChild>
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4 text-emerald-600" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setItems(parseProducts(s.products));
                          setOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && suppliers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhum fornecedor cadastrado
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
