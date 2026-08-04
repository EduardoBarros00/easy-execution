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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/boletins")({
  head: () => ({ meta: [{ title: "Boletim UBS — LabProt" }] }),
  component: Boletins,
});

type Bulletin = {
  id: string;
  health_unit: string;
  professional_name: string;
  specialty: string | null;
  bulletin_date: string;
  notes: string | null;
};

type Patient = {
  id?: string;
  position: number;
  patient_name: string;
  birth_date: string | null;
  age: number | null;
  sex: string | null;
  address: string | null;
  cns: string | null;
};

const calcAge = (birth: string | null) => {
  if (!birth) return null;
  const b = new Date(birth + "T00:00:00");
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
};

function Boletins() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bulletin | null>(null);

  const [healthUnit, setHealthUnit] = useState("");
  const [professional, setProfessional] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bulletinDate, setBulletinDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);

  const { data: bulletins = [], isLoading } = useQuery({
    queryKey: ["ubs_bulletins"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ubs_bulletins")
        .select("*")
        .order("bulletin_date", { ascending: false });
      if (error) throw error;
      return data as Bulletin[];
    },
  });

  const { data: allPatients = [] } = useQuery({
    queryKey: ["ubs_bulletin_patients_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ubs_bulletin_patients")
        .select("*");
      if (error) throw error;
      return data as (Patient & { bulletin_id: string; id: string })[];
    },
  });
  const countByBulletin = allPatients.reduce<Record<string, number>>((m, p) => {
    m[p.bulletin_id] = (m[p.bulletin_id] ?? 0) + 1;
    return m;
  }, {});

  const blankPatient = (pos: number): Patient => ({
    position: pos,
    patient_name: "",
    birth_date: null,
    age: null,
    sex: null,
    address: null,
    cns: null,
  });

  const openNew = () => {
    setEditing(null);
    setHealthUnit("");
    setProfessional("");
    setSpecialty("");
    setBulletinDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setPatients(Array.from({ length: 5 }, (_, i) => blankPatient(i + 1)));
    setOpen(true);
  };

  const openEdit = async (b: Bulletin) => {
    setEditing(b);
    setHealthUnit(b.health_unit);
    setProfessional(b.professional_name);
    setSpecialty(b.specialty ?? "");
    setBulletinDate(b.bulletin_date);
    setNotes(b.notes ?? "");
    const { data } = await (supabase as any)
      .from("ubs_bulletin_patients")
      .select("*")
      .eq("bulletin_id", b.id)
      .order("position");
    setPatients((data as Patient[]) ?? []);
    setOpen(true);
  };

  const updatePatient = (idx: number, patch: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const next = { ...p, ...patch };
        if ("birth_date" in patch)
          next.age = calcAge(patch.birth_date ?? null) ?? next.age;
        return next;
      }),
    );
  };

  const addRow = () =>
    setPatients((p) => [...p, blankPatient(p.length + 1)]);
  const removeRow = (i: number) =>
    setPatients((p) =>
      p
        .filter((_, idx) => idx !== i)
        .map((row, idx) => ({ ...row, position: idx + 1 })),
    );

  const save = async () => {
    if (!healthUnit.trim() || !professional.trim())
      return toast.error("Unidade e profissional são obrigatórios");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessão expirada");

    const payload = {
      health_unit: healthUnit.trim(),
      professional_name: professional.trim(),
      specialty: specialty.trim() || null,
      bulletin_date: bulletinDate,
      notes: notes.trim() || null,
    };

    let bid = editing?.id;
    if (editing) {
      const { error } = await (supabase as any)
        .from("ubs_bulletins")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: ins, error } = await (supabase as any)
        .from("ubs_bulletins")
        .insert({ ...payload, owner_id: user.id })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      bid = ins.id;
    }

    if (bid) {
      await (supabase as any).from("ubs_bulletin_patients").delete().eq("bulletin_id", bid);
      const rows = patients
        .filter((p) => p.patient_name.trim())
        .map((p, idx) => ({
          bulletin_id: bid,
          owner_id: user.id,
          position: idx + 1,
          patient_name: p.patient_name.trim(),
          birth_date: p.birth_date || null,
          age: p.age ?? calcAge(p.birth_date) ?? null,
          sex: p.sex || null,
          address: p.address || null,
          cns: p.cns || null,
        }));
      if (rows.length) {
        const { error } = await (supabase as any).from("ubs_bulletin_patients").insert(rows);
        if (error) return toast.error(error.message);
      }
    }

    toast.success(editing ? "Boletim atualizado" : "Boletim cadastrado");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["ubs_bulletins"] });
    qc.invalidateQueries({ queryKey: ["ubs_bulletin_patients_all"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este boletim?")) return;
    const { error } = await (supabase as any).from("ubs_bulletins").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["ubs_bulletins"] });
    qc.invalidateQueries({ queryKey: ["ubs_bulletin_patients_all"] });
  };

  return (
    <>
      <PageHeader
        title="Boletim de Produção UBS"
        description="Cadastro de produção ambulatorial por unidade de saúde"
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Novo Boletim
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-5xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {editing ? "Editar Boletim" : "Novo Boletim de Produção"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da unidade e adicione os pacientes atendidos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Unidade Básica de Saúde *</Label>
              <Input
                value={healthUnit}
                onChange={(e) => setHealthUnit(e.target.value)}
                placeholder="Ex: UBS Maria de Lourdes Sousa Matos"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do profissional *</Label>
              <Input
                value={professional}
                onChange={(e) => setProfessional(e.target.value)}
                placeholder="Ex: Dra. Letícia"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Especialidade</Label>
              <Input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ex: Saúde Bucal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={bulletinDate}
                onChange={(e) => setBulletinDate(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">
                Pacientes ({patients.filter((p) => p.patient_name.trim()).length})
              </span>
              <Button type="button" size="sm" variant="outline" onClick={addRow}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar linha
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-10 px-2 py-2 text-left">Nº</th>
                    <th className="px-2 py-2 text-left">Nome do paciente</th>
                    <th className="px-2 py-2 text-left">Data nasc.</th>
                    <th className="w-16 px-2 py-2 text-left">Idade</th>
                    <th className="w-20 px-2 py-2 text-left">Sexo</th>
                    <th className="px-2 py-2 text-left">Endereço</th>
                    <th className="px-2 py-2 text-left">Nº CNS</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8"
                          value={p.patient_name}
                          onChange={(e) => updatePatient(i, { patient_name: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          type="date"
                          className="h-8 w-[140px]"
                          value={p.birth_date ?? ""}
                          onChange={(e) =>
                            updatePatient(i, { birth_date: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          className="h-8 w-14"
                          value={p.age ?? ""}
                          onChange={(e) =>
                            updatePatient(i, {
                              age: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Select
                          value={p.sex ?? ""}
                          onValueChange={(v) => updatePatient(i, { sex: v })}
                        >
                          <SelectTrigger className="h-8 w-16">
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="F">F</SelectItem>
                            <SelectItem value="M">M</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8"
                          value={p.address ?? ""}
                          onChange={(e) =>
                            updatePatient(i, { address: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 w-[160px]"
                          value={p.cns ?? ""}
                          onChange={(e) =>
                            updatePatient(i, { cns: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="px-1 py-1 text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRow(i)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
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
                  <TableHead>Data</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead className="text-right">Pacientes</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulletins.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(b.bulletin_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{b.health_unit}</TableCell>
                    <TableCell>{b.professional_name}</TableCell>
                    <TableCell className="text-sm">{b.specialty ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {countByBulletin[b.id] ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && bulletins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum boletim cadastrado
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
