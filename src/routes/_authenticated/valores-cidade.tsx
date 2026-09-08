import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/valores-cidade")({
  head: () => ({ meta: [{ title: "Valores por Cidade — LabProt" }] }),
  component: ValoresCidade,
});

type SummaryRow = {
  city_id: string;
  city_name: string;
  pt_unit_price: number | string;
  ppr_unit_price: number | string;
  pt_count: number | string;
  ppr_count: number | string;
  total_os_value: number | string;
  delivered_value: number | string;
  open_value: number | string;
};

const brl = (value: number | string) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PriceRow({ row, isAdmin, onSaved }: { row: SummaryRow; isAdmin: boolean; onSaved: () => void }) {
  const [pt, setPt] = useState(String(Number(row.pt_unit_price || 0).toFixed(2)));
  const [ppr, setPpr] = useState(String(Number(row.ppr_unit_price || 0).toFixed(2)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPt(String(Number(row.pt_unit_price || 0).toFixed(2)));
    setPpr(String(Number(row.ppr_unit_price || 0).toFixed(2)));
  }, [row.pt_unit_price, row.ppr_unit_price]);

  const ptValue = Number(pt || 0);
  const pprValue = Number(ppr || 0);

  const save = async () => {
    if (!Number.isFinite(ptValue) || !Number.isFinite(pprValue) || ptValue < 0 || pprValue < 0) {
      return toast.error("Informe valores válidos para PT e PPR");
    }

    setSaving(true);
    const { error } = await (supabase as any).from("city_service_prices").upsert(
      [
        { city_id: row.city_id, service_code: "PT", unit_price: ptValue, active: true },
        { city_id: row.city_id, service_code: "PPR", unit_price: pprValue, active: true },
      ],
      { onConflict: "city_id,service_code" },
    );
    setSaving(false);

    if (error) return toast.error(error.message);
    toast.success(`Valores de ${row.city_name} atualizados`);
    onSaved();
  };

  return (
    <TableRow>
      <TableCell className="min-w-[220px] font-medium">{row.city_name}</TableCell>
      <TableCell className="min-w-[128px]">
        {isAdmin ? (
          <Input type="number" min="0" step="0.01" value={pt} onChange={(e) => setPt(e.target.value)} />
        ) : (
          <span className="whitespace-nowrap">{brl(row.pt_unit_price)}</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap font-semibold">{brl(ptValue * 2)}</TableCell>
      <TableCell className="min-w-[128px]">
        {isAdmin ? (
          <Input type="number" min="0" step="0.01" value={ppr} onChange={(e) => setPpr(e.target.value)} />
        ) : (
          <span className="whitespace-nowrap">{brl(row.ppr_unit_price)}</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap font-semibold">{brl(pprValue * 2)}</TableCell>
      <TableCell className="text-center font-medium">{Number(row.pt_count)}</TableCell>
      <TableCell className="text-center font-medium">{Number(row.ppr_count)}</TableCell>
      <TableCell className="whitespace-nowrap font-semibold">{brl(row.total_os_value)}</TableCell>
      <TableCell className="whitespace-nowrap">{brl(row.delivered_value)}</TableCell>
      <TableCell className="whitespace-nowrap">{brl(row.open_value)}</TableCell>
      {isAdmin && (
        <TableCell className="text-right">
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando" : "Salvar"}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

function ValoresCidade() {
  const qc = useQueryClient();

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return !!data;
    },
    staleTime: 5 * 60_000,
  });

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["city-values-summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_city_values_summary");
      if (error) throw error;
      return (data ?? []) as SummaryRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["city-values-summary"] });
    qc.invalidateQueries({ queryKey: ["city-service-prices"] });
  };

  const totals = rows.reduce(
    (acc, row) => {
      acc.total += Number(row.total_os_value || 0);
      acc.delivered += Number(row.delivered_value || 0);
      acc.open += Number(row.open_value || 0);
      return acc;
    },
    { total: 0, delivered: 0, open: 0 },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Valores por Cidade"
        description="Valores unitários de PT/PPR e total a receber por município"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total a receber</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{brl(totals.total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Entregue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{brl(totals.delivered)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em aberto</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{brl(totals.open)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabela resumida</CardTitle>
          <p className="text-sm text-muted-foreground">
            Os valores de PT e PPR são por prótese. Superior + inferior são 2 unidades e custam 2x o valor unitário. As quantidades abaixo contam próteses, não pacientes/OS. Uruburetama permanece apenas como teste e não aparece neste resumo.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {error && <div className="p-4 text-sm text-destructive">Não foi possível carregar o resumo.</div>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade / Contratante</TableHead>
                  <TableHead>PT unit.</TableHead>
                  <TableHead>PT sup.+inf.</TableHead>
                  <TableHead>PPR unit.</TableHead>
                  <TableHead>PPR sup.+inf.</TableHead>
                  <TableHead className="text-center">Qtd. PT</TableHead>
                  <TableHead className="text-center">Qtd. PPR</TableHead>
                  <TableHead>Total a receber</TableHead>
                  <TableHead>Entregue</TableHead>
                  <TableHead>Em aberto</TableHead>
                  {isAdmin && <TableHead className="text-right">Ação</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <PriceRow key={row.city_id} row={row} isAdmin={isAdmin} onSaved={refresh} />
                ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 11 : 10} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma cidade com tabela de preços disponível.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
