import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cidades")({
  head: () => ({ meta: [{ title: "Cidades — LabProt" }] }),
  component: Cidades,
});

type City = { id: string; name: string; uf: string; created_at: string };

function Cidades() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [uf, setUf] = useState("");

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cities").select("*").order("name");
      if (error) throw error;
      return data as City[];
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !uf.trim()) return toast.error("Preencha cidade e UF");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("cities").insert({
      name: name.trim(), uf: uf.trim().toUpperCase().slice(0, 2), owner_id: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Cidade adicionada");
    setName(""); setUf("");
    qc.invalidateQueries({ queryKey: ["cities"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir cidade?")) return;
    const { error } = await (supabase as any).from("cities").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["cities"] });
  };

  return (
    <>
      <PageHeader title="Cidades" description="Cadastre as cidades disponíveis para seleção nas OS" />
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} maxLength={2} placeholder="SP" />
            </div>
            <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Adicionar Cidade</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cidade</TableHead>
                <TableHead className="w-24">UF</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium"><MapPin className="mr-2 inline h-4 w-4 text-muted-foreground" />{c.name}</TableCell>
                  <TableCell>{c.uf}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && cities.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">Nenhuma cidade cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
