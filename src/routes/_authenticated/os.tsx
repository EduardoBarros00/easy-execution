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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/os")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — LabProt" }] }),
  component: OS,
});

type ServiceOrder = {
  id: string;
  code: string;
  patient_name: string;
  contractor_name: string | null;
  dentist_name: string | null;
  client_id: string | null;
  technician_id: string | null;
  prosthesis_type_id: string | null;
  sent_at: string | null;
  expected_at: string | null;
  delivered_at: string | null;
  molding_date: string | null;
  wax_plan_date: string | null;
  teeth_setup_date: string | null;
  acrylization_date: string | null;
  status: "pending" | "in_progress" | "delivered" | "cancelled";
  notes: string | null;
  price: number;
  cost: number;
  city_id: string | null;
  health_unit?: string | null;
  service_type?: string | null;
};

type OsExpense = { id?: string; description: string; amount: number };

type OsStatus = "pending" | "in_progress" | "delivered" | "cancelled";
type ClientMini = { id: string; dentist_name: string; clinic_name: string | null; contractor_name: string | null };
type PatientMini = { id: string; full_name: string };

const STATUS_OPTIONS: { value: OsStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em produção" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
];

function OS() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceOrder | null>(null);
  const [status, setStatus] = useState<OsStatus>("pending");
  const [clientId, setClientId] = useState<string>("");
  const [techId, setTechId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [sentAt, setSentAt] = useState<string>("");
  const [molding, setMolding] = useState<string>("");
  const [waxPlan, setWaxPlan] = useState<string>("");
  const [teethSetup, setTeethSetup] = useState<string>("");
  const [acryl, setAcryl] = useState<string>("");
  const [expectedAt, setExpectedAt] = useState<string>("");
  const [contractorName, setContractorName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [cityId, setCityId] = useState<string>("");
  const [expenses, setExpenses] = useState<OsExpense[]>([]);
  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpAmount, setNewExpAmount] = useState("");
  const [healthUnit, setHealthUnit] = useState("");
  const [serviceTypeText, setServiceTypeText] = useState("");

  const addDays = (date: string, days: number) => {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const applyStageDefaults = (base: string) => {
    setSentAt(base);
    setMolding(addDays(base, 1));
    setWaxPlan(addDays(base, 3));
    setTeethSetup(addDays(base, 5));
    setAcryl(addDays(base, 7));
    setExpectedAt(addDays(base, 10));
  };

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["service_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceOrder[];
    },
  });

  const { data: clients = [], isLoading: clientsLoading, isError: clientsError } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, dentist_name, clinic_name, contractor_name").order("contractor_name");
      if (error) throw error;
      return data as ClientMini[];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-mini"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("patients").select("id, full_name").order("full_name");
      if (error) throw error;
      return data as PatientMini[];
    },
  });

  const { data: dentists = [] } = useQuery({
    queryKey: ["dentists-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dentists").select("id, full_name").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  const fillClientNames = (client: ClientMini | undefined) => {
    setContractorName(client?.contractor_name || client?.dentist_name || "");
    setDentistName(client?.dentist_name || "");
  };

  const handleClientChange = (id: string) => {
    setClientId(id);
    fillClientNames(clients.find((client) => client.id === id));
  };

  const { data: techs = [] } = useQuery({
    queryKey: ["techs-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technicians").select("id, full_name").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  const { data: types = [] } = useQuery({
    queryKey: ["types-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prosthesis_types").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-mini"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cities").select("id, name, uf").order("name");
      if (error) throw error;
      return data as { id: string; name: string; uf: string }[];
    },
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ["os_expenses_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("os_expenses").select("*");
      if (error) throw error;
      return data as { id: string; os_id: string; description: string; amount: number }[];
    },
  });
  const expensesByOs = allExpenses.reduce<Record<string, number>>((m, e) => {
    m[e.os_id] = (m[e.os_id] ?? 0) + Number(e.amount);
    return m;
  }, {});

  const openNew = () => {
    setEditing(null);
    setStatus("pending");
    setClientId("");
    setContractorName("");
    setDentistName("");
    setPatientName("");
    setTechId("");
    setTypeId("");
    setCityId("");
    setExpenses([]);
    setNewExpDesc(""); setNewExpAmount("");
    setHealthUnit("");
    setServiceTypeText("");
    const today = new Date().toISOString().slice(0, 10);
    applyStageDefaults(today);
    setOpen(true);
  };

  const openEdit = async (o: ServiceOrder) => {
    setEditing(o);
    setStatus(o.status);
    setClientId(o.client_id ?? "");
    setContractorName(o.contractor_name || "");
    setDentistName(o.dentist_name || "");
    setPatientName(o.patient_name);
    if (!o.contractor_name || !o.dentist_name) fillClientNames(clients.find((client) => client.id === o.client_id));
    setTechId(o.technician_id ?? "");
    setTypeId(o.prosthesis_type_id ?? "");
    setCityId(o.city_id ?? "");
    setSentAt(o.sent_at ?? "");
    setMolding(o.molding_date ?? "");
    setWaxPlan(o.wax_plan_date ?? "");
    setTeethSetup(o.teeth_setup_date ?? "");
    setAcryl(o.acrylization_date ?? "");
    setExpectedAt(o.expected_at ?? "");
    setHealthUnit((o as any).health_unit ?? "");
    setServiceTypeText((o as any).service_type ?? "");
    setNewExpDesc(""); setNewExpAmount("");
    const { data } = await (supabase as any).from("os_expenses").select("*").eq("os_id", o.id);
    setExpenses(((data as any[]) ?? []).map((e) => ({ id: e.id, description: e.description, amount: Number(e.amount) })));
    setOpen(true);
  };

  const filtered = orders.filter((o) =>
    [o.code, o.patient_name].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => (fd.get(k) as string) || null;
    if (!clientId) {
      return toast.error("Selecione um contratante cadastrado");
    }
    if (!healthUnit.trim()) {
      return toast.error("Unidade Básica de Saúde (UBS) é obrigatória");
    }
    if (!patientName) {
      return toast.error("Selecione um paciente cadastrado");
    }
    const payload = {
      patient_name: patientName,
      contractor_name: contractorName || null,
      dentist_name: dentistName || null,
      client_id: clientId || null,
      city_id: cityId || null,
      technician_id: techId || null,
      prosthesis_type_id: typeId || null,
      sent_at: sentAt || null,
      expected_at: expectedAt || null,
      delivered_at: s("delivered_at"),
      molding_date: molding || null,
      wax_plan_date: waxPlan || null,
      teeth_setup_date: teethSetup || null,
      acrylization_date: acryl || null,
      status,
      notes: s("notes"),
      price: Number(fd.get("price") || 0),
      cost: Number(fd.get("cost") || 0),
      health_unit: healthUnit.trim(),
      service_type: serviceTypeText.trim() || null,
    };
    let osId = editing?.id;
    const { data: { user } } = await supabase.auth.getUser();
    if (editing) {
      const { error } = await (supabase as any).from("service_orders").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("OS atualizada");
    } else {
      const { data: ins, error } = await (supabase as any)
        .from("service_orders").insert({ ...payload, owner_id: user!.id, code: "" }).select("id").single();
      if (error) return toast.error(error.message);
      osId = ins.id;
      toast.success("OS criada");
    }
    // Sync expenses: delete all and reinsert current list
    if (osId) {
      await (supabase as any).from("os_expenses").delete().eq("os_id", osId);
      if (expenses.length > 0) {
        await (supabase as any).from("os_expenses").insert(
          expenses.map((e) => ({
            os_id: osId, owner_id: user!.id,
            description: e.description, amount: Number(e.amount) || 0,
          })),
        );
      }
    }
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["service_orders"] });
    qc.invalidateQueries({ queryKey: ["os_expenses_all"] });
    qc.invalidateQueries({ queryKey: ["finance_entries"] });
    qc.invalidateQueries({ queryKey: ["relatorios-full"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta OS?")) return;
    await (supabase as any).from("os_expenses").delete().eq("os_id", id);
    const { error } = await supabase.from("service_orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["service_orders"] });
    qc.invalidateQueries({ queryKey: ["os_expenses_all"] });
    qc.invalidateQueries({ queryKey: ["finance_entries"] });
    qc.invalidateQueries({ queryKey: ["relatorios-full"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const addExpense = () => {
    if (!newExpDesc.trim()) return toast.error("Descrição do gasto obrigatória");
    const amt = Number(newExpAmount) || 0;
    setExpenses((p) => [...p, { description: newExpDesc.trim(), amount: amt }]);
    setNewExpDesc(""); setNewExpAmount("");
  };
  const removeExpense = (idx: number) => setExpenses((p) => p.filter((_, i) => i !== idx));
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const contractorLabel = (order: ServiceOrder) => {
    if (order.contractor_name) return order.contractor_name;
    const c = clients.find((x) => x.id === order.client_id);
    return c?.contractor_name || c?.dentist_name || "—";
  };

  const dentistLabel = (order: ServiceOrder) => {
    if (order.dentist_name) return order.dentist_name;
    const c = clients.find((x) => x.id === order.client_id);
    return c?.dentist_name || "—";
  };

  const contractorBlock = (order: ServiceOrder) => (
    <div className="min-w-[190px] font-medium text-foreground">{contractorLabel(order)}</div>
  );

  const brl = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const ubsHistory = Array.from(
    new Set(
      orders
        .map((o) => (o.health_unit ?? "").trim())
        .filter((v) => v.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        description="Acompanhe as OS desde a entrada até a entrega"
        actions={
          <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nova OS</Button>
        }
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-y-auto p-4 sm:h-auto sm:max-h-[92vh] sm:w-[96vw] sm:max-w-4xl sm:p-6">
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" /> Fluxo laboratorial
            </div>
            <DialogTitle className="text-xl tracking-[-0.03em]">{editing ? `Editar ${editing.code}` : "Nova Ordem de Serviço"}</DialogTitle>
            <DialogDescription>Organize paciente, atendimento, produção e custos da OS.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2 mt-1 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">01</span>
              <div><p className="text-sm font-semibold">Paciente e contratante</p><p className="text-[11px] text-muted-foreground">Identificação principal da ordem</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Contratante *</Label>
              {isMobile ? (
                <select
                  aria-label="Contratante"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 text-base shadow-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                  value={clientId}
                  onChange={(event) => handleClientChange(event.target.value)}
                  disabled={clientsLoading || clientsError || clients.length === 0}
                >
                  <option value="">
                    {clientsLoading
                      ? "Carregando contratantes…"
                      : clientsError
                        ? "Não foi possível carregar"
                        : clients.length === 0
                          ? "Nenhum contratante cadastrado"
                          : "Selecione o contratante"}
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.contractor_name || client.dentist_name}
                    </option>
                  ))}
                </select>
              ) : (
                <Select
                  value={clientId}
                  onValueChange={handleClientChange}
                  disabled={clientsLoading || clientsError || clients.length === 0}
                >
                  <SelectTrigger aria-label="Contratante">
                    <SelectValue
                      placeholder={
                        clientsLoading
                          ? "Carregando contratantes…"
                          : clientsError
                            ? "Não foi possível carregar"
                            : clients.length === 0
                              ? "Nenhum contratante cadastrado"
                              : "Selecione…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.contractor_name || client.dentist_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {clientsError && (
                <p className="text-xs font-medium text-destructive">
                  Não foi possível carregar os contratantes. Verifique a internet e tente novamente.
                </p>
              )}
              {!clientsLoading && !clientsError && clients.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre um contratante antes de criar a Ordem de Serviço.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Nome da dentista</Label>
              <Select value={dentistName} onValueChange={setDentistName}>
                <SelectTrigger><SelectValue placeholder="Selecione a dentista cadastrada…" /></SelectTrigger>
                <SelectContent>
                  {editing && dentistName && !dentists.some((dentist) => dentist.full_name === dentistName) && (
                    <SelectItem value={dentistName}>{dentistName} (não cadastrada)</SelectItem>
                  )}
                  {dentists.map((dentist) => (
                    <SelectItem key={dentist.id} value={dentist.full_name}>{dentist.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Paciente *</Label>
              <Select value={patientName} onValueChange={setPatientName}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente cadastrado…" /></SelectTrigger>
                <SelectContent>
                  {editing && patientName && !patients.some((patient) => patient.full_name === patientName) && (
                    <SelectItem value={patientName}>{patientName} (não cadastrado)</SelectItem>
                  )}
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.full_name}>{patient.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">02</span>
              <div><p className="text-sm font-semibold">Serviço odontológico</p><p className="text-[11px] text-muted-foreground">Profissional, atendimento e unidade de saúde</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>

            <div className="space-y-1.5">
              <Label>Protético</Label>
              <Select value={techId} onValueChange={setTechId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {techs.map((t) => (<SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de atendimento (catálogo)</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue placeholder={types.length ? "Selecione…" : "Cadastre tipos em Configurações"} /></SelectTrigger>
                <SelectContent>
                  {types.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum tipo cadastrado</div>
                  )}
                  {types.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição do atendimento</Label>
              <Input
                value={serviceTypeText}
                onChange={(e) => setServiceTypeText(e.target.value)}
                placeholder="Ex: PPR Superior, Reembasamento, Limpeza, etc."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Unidade Básica de Saúde (UBS) *</Label>
              <Input
                required
                list="ubs-history"
                value={healthUnit}
                onChange={(e) => setHealthUnit(e.target.value)}
                placeholder="Ex: UBS Maria de Lourdes Sousa Matos"
              />
              <datalist id="ubs-history">
                {ubsHistory.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              {ubsHistory.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Sugestões do histórico: {ubsHistory.slice(0, 3).join(" • ")}
                  {ubsHistory.length > 3 ? ` • +${ubsHistory.length - 3}` : ""}
                </p>
              )}
            </div>

            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">03</span>
              <div><p className="text-sm font-semibold">Produção e prazos</p><p className="text-[11px] text-muted-foreground">Status, datas e etapas do laboratório</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OsStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Recebido em</Label>
              <Input type="date" value={sentAt} onChange={(e) => applyStageDefaults(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Previsão de entrega</Label>
              <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Entregue em</Label>
              <Input type="date" name="delivered_at" defaultValue={editing?.delivered_at ?? ""} />
            </div>

            <div className="sm:col-span-2 mt-2 rounded-2xl border border-primary/12 bg-primary/[0.025] p-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Etapas do atendimento</p><p className="text-[11px] text-muted-foreground">Linha do tempo prevista da produção</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Produção</span></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>1. Moldagem</Label>
                  <Input type="date" value={molding} onChange={(e) => setMolding(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>2. Plano de cera</Label>
                  <Input type="date" value={waxPlan} onChange={(e) => setWaxPlan(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>3. Montagem de dente</Label>
                  <Input type="date" value={teethSetup} onChange={(e) => setTeethSetup(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>4. Acrilização</Label>
                  <Input type="date" value={acryl} onChange={(e) => setAcryl(e.target.value)} />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">As datas são pré-fixadas a partir de "Recebido em" (+1, +3, +5, +7 dias). Edite se necessário.</p>
            </div>


            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">04</span>
              <div><p className="text-sm font-semibold">Valores e gastos</p><p className="text-[11px] text-muted-foreground">Controle financeiro desta ordem de serviço</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>

            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Select value={cityId} onValueChange={setCityId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} / {c.uf}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor do serviço (R$)</Label>
              <Input type="number" step="0.01" name="price" defaultValue={String(editing?.price ?? 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Custo (R$)</Label>
              <Input type="number" step="0.01" name="cost" defaultValue={String(editing?.cost ?? 0)} />
            </div>

            <div className="sm:col-span-2 mt-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <span>Gastos adicionais</span>
                <span className="text-xs text-muted-foreground">
                  Total: {totalExpenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
                <Input placeholder="Nome do gasto" value={newExpDesc} onChange={(e) => setNewExpDesc(e.target.value)} />
                <Input type="number" step="0.01" placeholder="Valor (R$)" value={newExpAmount} onChange={(e) => setNewExpAmount(e.target.value)} />
                <Button type="button" onClick={addExpense}><Plus className="mr-1 h-4 w-4" /> Adicionar Gasto</Button>
              </div>
              {expenses.length > 0 && (
                <div className="mt-3 space-y-1">
                  {expenses.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded border bg-muted/40 px-3 py-1.5 text-sm">
                      <span className="font-medium">{e.description}</span>
                      <div className="flex items-center gap-2">
                        <span>{Number(e.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeExpense(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">05</span>
              <div><p className="text-sm font-semibold">Observações</p><p className="text-[11px] text-muted-foreground">Informações complementares da OS</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} />
            </div>
            <DialogFooter className="sticky bottom-0 z-10 -mx-4 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:col-span-2 sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              <Button type="submit" className="h-11 w-full sm:h-10 sm:w-auto">{editing ? "Salvar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Ordens cadastradas</p>
              <p className="text-xs text-muted-foreground">Consulte e acompanhe a produção do laboratório</p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou paciente…" className="bg-background pl-9" />
            </div>
          </div>
          <div className="divide-y divide-border/70 md:hidden">
            {filtered.map((order) => {
              const city = cities.find((item) => item.id === order.city_id);
              const additionalExpenses = expensesByOs[order.id] ?? 0;
              const totalCost = Number(order.cost ?? 0) + additionalExpenses;
              const profit = Number(order.price) - totalCost;

              return (
                <article key={order.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{order.code}</p>
                      <p className="mt-1 truncate text-base font-semibold">{order.patient_name}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <dl className="grid grid-cols-1 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Contratante</dt>
                      <dd className="font-medium">{contractorLabel(order)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Cidade</dt>
                      <dd>{city ? `${city.name}/${city.uf}` : "—"}</dd>
                    </div>
                  </dl>

                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Valor</p>
                      <p className="text-xs font-semibold">{brl(Number(order.price))}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Gastos</p>
                      <p className="text-xs font-semibold text-destructive">{brl(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Lucro</p>
                      <p className={`text-xs font-semibold ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {brl(profit)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11" onClick={() => openEdit(order)}>
                      <Edit className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    <Button variant="outline" className="h-11 text-destructive" onClick={() => remove(order.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </article>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma OS cadastrada</p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Contratante</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const city = cities.find((c) => c.id === o.city_id);
                const additionalExpenses = expensesByOs[o.id] ?? 0;
                const totalCost = Number(o.cost ?? 0) + additionalExpenses;
                const profit = Number(o.price) - totalCost;
                return (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.code}</TableCell>
                  <TableCell>{contractorBlock(o)}</TableCell>
                  <TableCell className="max-w-[120px] truncate font-medium">{o.patient_name}</TableCell>
                  <TableCell className="text-sm">{city ? `${city.name}/${city.uf}` : "—"}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right">{brl(Number(o.price))}</TableCell>
                  <TableCell className="text-right text-destructive">{brl(totalCost)}</TableCell>
                  <TableCell className={`text-right font-medium ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{brl(profit)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button aria-label={`Editar ${o.code}`} size="icon" variant="ghost" onClick={() => openEdit(o)}><Edit className="h-4 w-4" /></Button>
                      <Button aria-label={`Excluir ${o.code}`} size="icon" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );})}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
