import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

type OsStatus = "pending" | "in_progress" | "delivered" | "cancelled";
type Arcade = "" | "superior" | "inferior" | "both";

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
  status: OsStatus;
  notes: string | null;
  price: number;
  cost: number;
  city_id: string | null;
  health_unit?: string | null;
  service_type?: string | null;
};

type OsExpense = { id?: string; description: string; amount: number };
type CityServicePrice = { city_id: string; service_code: "PT" | "PPR"; unit_price: number | string; active: boolean };
type ClientMini = { id: string; dentist_name: string; clinic_name: string | null; contractor_name: string | null; city_id: string | null };
type PatientMini = { id: string; full_name: string; city_id: string | null };
type DentistMini = { id: string; full_name: string; city_id: string | null; active: boolean };
type TechnicianMini = { id: string; full_name: string; city_id: string | null; active: boolean };
type ProsthesisTypeMini = { id: string; name: string; city_id: string | null };
type CityMini = { id: string; name: string; uf: string };

const STATUS_OPTIONS: { value: OsStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em produção" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
];

function normalizeOptionLabel(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizePersonName(value: string) {
  return normalizeOptionLabel(value)
    .replace(/^(DRA|DR|DOUTORA|DOUTOR)\.?\s+/, "")
    .trim();
}

function dedupeOptions<T>(items: T[], labelFor: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeOptionLabel(labelFor(item));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serviceCodeFromType(typeName: string): "PT" | "PPR" | null {
  const raw = normalizeOptionLabel(typeName);
  if (/\bPPR\b/.test(raw) || raw.includes("PROTESE PARCIAL REMOVIVEL")) return "PPR";
  if (/\bPT\b/.test(raw) || raw.includes("PROTESE TOTAL")) return "PT";
  return null;
}

function inferArcade(serviceText: string): Arcade {
  const raw = normalizeOptionLabel(serviceText);
  const superior = /\b(SUP|SUPERIOR)\b/.test(raw);
  const inferior = /\b(INF|INFERIOR|INFERIOS)\b/.test(raw) || raw.includes("INFERI");
  if (superior && inferior) return "both";
  if (superior) return "superior";
  if (inferior) return "inferior";
  return "";
}

function formatLocalDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayLocal() {
  return formatLocalDate(new Date());
}

function addDaysLocal(date: string, days: number) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(y, m - 1, d, 12, 0, 0);
  value.setDate(value.getDate() + days);
  return formatLocalDate(value);
}

function standardizedServiceType(code: "PT" | "PPR", arcade: Arcade) {
  if (arcade === "superior") return `${code} superior`;
  if (arcade === "inferior") return `${code} inferior`;
  return `${code} superior e inferior`;
}

function OS() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<OsStatus>("pending");
  const [clientId, setClientId] = useState("");
  const [techId, setTechId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [arcade, setArcade] = useState<Arcade>("");
  const [sentAt, setSentAt] = useState("");
  const [molding, setMolding] = useState("");
  const [waxPlan, setWaxPlan] = useState("");
  const [teethSetup, setTeethSetup] = useState("");
  const [acryl, setAcryl] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [deliveredAuto, setDeliveredAuto] = useState(false);
  const [contractorName, setContractorName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [cityId, setCityId] = useState("");
  const [expenses, setExpenses] = useState<OsExpense[]>([]);
  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpAmount, setNewExpAmount] = useState("");
  const [healthUnit, setHealthUnit] = useState("");
  const [serviceTypeText, setServiceTypeText] = useState("");
  const [priceValue, setPriceValue] = useState("0");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);

  const applyStageDefaults = (base: string) => {
    setSentAt(base);
    setMolding(addDaysLocal(base, 1));
    setWaxPlan(addDaysLocal(base, 3));
    setTeethSetup(addDaysLocal(base, 5));
    setAcryl(addDaysLocal(base, 7));
    setExpectedAt(addDaysLocal(base, 10));
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
      const { data, error } = await supabase.from("clients").select("id, dentist_name, clinic_name, contractor_name, city_id").order("contractor_name");
      if (error) throw error;
      return data as ClientMini[];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-mini"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("patients").select("id, full_name, city_id").order("full_name");
      if (error) throw error;
      return data as PatientMini[];
    },
  });

  const { data: dentists = [] } = useQuery({
    queryKey: ["dentists-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dentists").select("id, full_name, city_id, active").order("full_name");
      if (error) throw error;
      return data as DentistMini[];
    },
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["techs-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technicians").select("id, full_name, city_id, active").order("full_name");
      if (error) throw error;
      return data as TechnicianMini[];
    },
  });

  const { data: types = [] } = useQuery({
    queryKey: ["types-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prosthesis_types").select("id, name, city_id").order("name");
      if (error) throw error;
      return data as ProsthesisTypeMini[];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-mini"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cities").select("id, name, uf").order("name");
      if (error) throw error;
      return data as CityMini[];
    },
  });

  const { data: cityServicePrices = [] } = useQuery({
    queryKey: ["city-service-prices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("city_service_prices")
        .select("city_id, service_code, unit_price, active")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as CityServicePrice[];
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

  const filteredPatients = useMemo(() => {
    if (!cityId) return [] as PatientMini[];
    let result = dedupeOptions(patients.filter((p) => p.city_id === cityId), (p) => p.full_name);
    if (editing?.patient_name && !result.some((p) => normalizeOptionLabel(p.full_name) === normalizeOptionLabel(editing.patient_name))) {
      result = [{ id: `legacy-${editing.id}`, full_name: editing.patient_name, city_id: editing.city_id }, ...result];
    }
    return result;
  }, [patients, cityId, editing]);

  const filteredDentists = useMemo(() => {
    if (!cityId) return [] as DentistMini[];
    return dedupeOptions(dentists.filter((d) => d.city_id === cityId && d.active), (d) => d.full_name);
  }, [dentists, cityId]);

  const filteredTechs = useMemo(() => {
    if (!cityId) return [] as TechnicianMini[];
    let result = dedupeOptions(techs.filter((t) => t.city_id === cityId && t.active), (t) => t.full_name);
    const currentId = editing?.technician_id;
    if (currentId && !result.some((t) => t.id === currentId)) {
      const current = techs.find((t) => t.id === currentId);
      if (current) result = [current, ...result];
    }
    return result;
  }, [techs, cityId, editing?.technician_id]);

  const filteredTypes = useMemo(() => {
    if (!cityId) return [] as ProsthesisTypeMini[];
    const citySpecific = types.filter((t) => t.city_id === cityId);
    const source = citySpecific.length > 0 ? citySpecific : types.filter((t) => t.city_id === null);
    let result = dedupeOptions(source, (t) => t.name);
    const currentId = editing?.prosthesis_type_id;
    if (currentId && !result.some((t) => t.id === currentId)) {
      const current = types.find((t) => t.id === currentId);
      if (current) result = [current, ...result];
    }
    return result;
  }, [types, cityId, editing?.prosthesis_type_id]);

  const selectedType = types.find((t) => t.id === typeId);
  const pricedServiceCode = serviceCodeFromType(selectedType?.name ?? "");
  const selectedCity = cities.find((c) => c.id === cityId);
  const selectedClient = clients.find((c) => c.id === clientId);

  const ubsHistory = useMemo(
    () => Array.from(new Set(orders.filter((o) => o.city_id === cityId).map((o) => (o.health_unit ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [orders, cityId],
  );

  const expensesByOs = allExpenses.reduce<Record<string, number>>((m, e) => {
    m[e.os_id] = (m[e.os_id] ?? 0) + Number(e.amount);
    return m;
  }, {});

  useEffect(() => {
    if (editing || priceManuallyEdited) return;
    if (!cityId || !pricedServiceCode || !arcade) {
      setPriceValue("0");
      return;
    }
    const row = cityServicePrices.find((p) => p.city_id === cityId && p.service_code === pricedServiceCode && p.active);
    if (!row) {
      setPriceValue("0");
      return;
    }
    const units = arcade === "both" ? 2 : 1;
    const automaticPrice = Number(row.unit_price) * units;
    setPriceValue(Number.isFinite(automaticPrice) ? automaticPrice.toFixed(2) : "0");
  }, [editing, priceManuallyEdited, cityId, pricedServiceCode, arcade, cityServicePrices]);

  const matchDentistForClient = (client: ClientMini | undefined, targetCityId: string) => {
    const legacyName = client?.dentist_name?.trim() ?? "";
    if (!legacyName) return "";
    const key = normalizePersonName(legacyName);
    const match = dentists.find((d) => d.city_id === targetCityId && d.active && normalizePersonName(d.full_name) === key);
    return match?.full_name ?? legacyName;
  };

  const handleClientChange = (id: string) => {
    const client = clients.find((item) => item.id === id);
    const nextCityId = client?.city_id ?? "";
    const cityChanged = nextCityId !== cityId;
    setClientId(id);
    setContractorName(client?.contractor_name || client?.dentist_name || "");
    setDentistName(matchDentistForClient(client, nextCityId));
    setCityId(nextCityId);
    if (cityChanged) {
      setPatientName("");
      setTechId("");
      setTypeId("");
      setArcade("");
      setHealthUnit("");
      setPriceValue("0");
      setPriceManuallyEdited(false);
    }
  };

  const handleTypeChange = (id: string) => {
    setTypeId(id);
    setArcade("");
    if (!editing) {
      setPriceValue("0");
      setPriceManuallyEdited(false);
    }
  };

  const handleArcadeChange = (value: Arcade) => {
    setArcade(value);
    if (!editing) setPriceManuallyEdited(false);
  };

  const handleStatusChange = (next: OsStatus) => {
    setStatus(next);
    if (next === "delivered" && !deliveredAt) {
      setDeliveredAt(todayLocal());
      setDeliveredAuto(true);
    } else if (next !== "delivered" && deliveredAuto) {
      setDeliveredAt("");
      setDeliveredAuto(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setSaving(false);
    setStatus("pending");
    setClientId("");
    setContractorName("");
    setDentistName("");
    setPatientName("");
    setTechId("");
    setTypeId("");
    setArcade("");
    setCityId("");
    setExpenses([]);
    setNewExpDesc("");
    setNewExpAmount("");
    setHealthUnit("");
    setServiceTypeText("");
    setPriceValue("0");
    setPriceManuallyEdited(false);
    setDeliveredAt("");
    setDeliveredAuto(false);
    applyStageDefaults(todayLocal());
    setOpen(true);
  };

  const openEdit = async (o: ServiceOrder) => {
    setEditing(o);
    setSaving(false);
    setStatus(o.status);
    setClientId(o.client_id ?? "");
    setContractorName(o.contractor_name || "");
    setDentistName(o.dentist_name || "");
    setPatientName(o.patient_name);
    setTechId(o.technician_id ?? "");
    setTypeId(o.prosthesis_type_id ?? "");
    setArcade(inferArcade(o.service_type ?? ""));
    setCityId(o.city_id ?? "");
    setSentAt(o.sent_at ?? "");
    setMolding(o.molding_date ?? "");
    setWaxPlan(o.wax_plan_date ?? "");
    setTeethSetup(o.teeth_setup_date ?? "");
    setAcryl(o.acrylization_date ?? "");
    setExpectedAt(o.expected_at ?? "");
    setDeliveredAt(o.delivered_at ?? "");
    setDeliveredAuto(false);
    setHealthUnit(o.health_unit ?? "");
    setServiceTypeText(o.service_type ?? "");
    setPriceValue(String(Number(o.price ?? 0)));
    setPriceManuallyEdited(true);
    setNewExpDesc("");
    setNewExpAmount("");
    const { data, error } = await (supabase as any).from("os_expenses").select("*").eq("os_id", o.id);
    if (error) toast.error(`Não foi possível carregar os gastos: ${error.message}`);
    setExpenses(((data as any[]) ?? []).map((e) => ({ id: e.id, description: e.description, amount: Number(e.amount) })));
    setOpen(true);
  };

  const addExpense = () => {
    const description = newExpDesc.trim();
    const amount = Number(newExpAmount);
    if (!description) return toast.error("Descrição do gasto é obrigatória");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("O valor do gasto deve ser maior que zero");
    setExpenses((prev) => [...prev, { description, amount }]);
    setNewExpDesc("");
    setNewExpAmount("");
  };

  const removeExpense = (idx: number) => setExpenses((prev) => prev.filter((_, i) => i !== idx));
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;

    const fd = new FormData(e.currentTarget);
    const client = clients.find((c) => c.id === clientId);
    if (!clientId || !client) return toast.error("Selecione um contratante cadastrado");
    if (!cityId) return toast.error("O contratante precisa estar vinculado a uma cidade");
    if (client.city_id && client.city_id !== cityId) return toast.error("A cidade da OS deve ser a mesma cidade do contratante");
    if (!patientName) return toast.error("Selecione um paciente cadastrado");
    const patientInCity = patients.some((p) => p.city_id === cityId && normalizeOptionLabel(p.full_name) === normalizeOptionLabel(patientName));
    if (!patientInCity && !(editing && normalizeOptionLabel(patientName) === normalizeOptionLabel(editing.patient_name))) {
      return toast.error("O paciente selecionado não pertence à cidade desta OS");
    }
    if (!healthUnit.trim()) return toast.error("Unidade Básica de Saúde (UBS) é obrigatória");
    if (techId) {
      const tech = techs.find((t) => t.id === techId);
      if (!tech || tech.city_id !== cityId) return toast.error("O protético selecionado não pertence à cidade desta OS");
    }
    if (typeId) {
      const type = types.find((t) => t.id === typeId);
      if (!type || (type.city_id !== null && type.city_id !== cityId)) return toast.error("O tipo de atendimento não pertence à cidade desta OS");
    }
    if (pricedServiceCode && !arcade) return toast.error("Selecione a arcada: Superior, Inferior ou Superior + Inferior");
    if (status === "delivered" && !deliveredAt) return toast.error("Informe a data de entrega para uma OS entregue");
    if (status !== "delivered" && deliveredAt) return toast.error("Há uma data de entrega preenchida. Ajuste o status para Entregue ou limpe a data");
    if (expenses.some((x) => !x.description.trim() || !Number.isFinite(Number(x.amount)) || Number(x.amount) <= 0)) {
      return toast.error("Revise os gastos adicionais: descrição e valor maior que zero são obrigatórios");
    }

    const cost = Number(fd.get("cost") || 0);
    const price = Number(priceValue || 0);
    if (!Number.isFinite(cost) || cost < 0) return toast.error("Custo inválido");
    if (!Number.isFinite(price) || price < 0) return toast.error("Valor do serviço inválido");

    const serviceType = pricedServiceCode && arcade
      ? standardizedServiceType(pricedServiceCode, arcade)
      : serviceTypeText.trim() || null;

    const payload = {
      patient_name: patientName,
      contractor_name: contractorName || null,
      dentist_name: dentistName || null,
      client_id: clientId,
      city_id: cityId,
      technician_id: techId || null,
      prosthesis_type_id: typeId || null,
      sent_at: sentAt || null,
      expected_at: expectedAt || null,
      delivered_at: deliveredAt || null,
      molding_date: molding || null,
      wax_plan_date: waxPlan || null,
      teeth_setup_date: teethSetup || null,
      acrylization_date: acryl || null,
      status,
      notes: (fd.get("notes") as string) || null,
      price,
      cost,
      health_unit: healthUnit.trim(),
      service_type: serviceType,
    };

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return toast.error("Sua sessão expirou. Entre novamente");
    }

    let osId = editing?.id;
    let createdNow = false;

    if (editing) {
      const { error } = await (supabase as any).from("service_orders").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    } else {
      const { data: inserted, error } = await (supabase as any)
        .from("service_orders")
        .insert({ ...payload, owner_id: user.id, code: "" })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      osId = inserted.id;
      createdNow = true;
    }

    if (osId) {
      const { error: expensesError } = await (supabase as any).rpc("replace_os_expenses", {
        p_os_id: osId,
        p_city_id: cityId,
        p_expenses: expenses.map((x) => ({ description: x.description.trim(), amount: Number(x.amount) })),
      });
      if (expensesError) {
        if (createdNow) await (supabase as any).from("service_orders").delete().eq("id", osId);
        setSaving(false);
        return toast.error(
          createdNow
            ? `A OS não foi criada porque os gastos falharam: ${expensesError.message}`
            : `Os dados principais foram salvos, mas os gastos não foram alterados: ${expensesError.message}`,
        );
      }
    }

    toast.success(editing ? "OS atualizada" : "OS criada");
    setSaving(false);
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
    const { error: expenseError } = await (supabase as any).from("os_expenses").delete().eq("os_id", id);
    if (expenseError) return toast.error(`Não foi possível excluir os gastos: ${expenseError.message}`);
    const { error } = await supabase.from("service_orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["service_orders"] });
    qc.invalidateQueries({ queryKey: ["os_expenses_all"] });
    qc.invalidateQueries({ queryKey: ["finance_entries"] });
    qc.invalidateQueries({ queryKey: ["relatorios-full"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const filtered = orders.filter((o) => [o.code, o.patient_name].some((f) => f?.toLowerCase().includes(q.toLowerCase())));
  const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const contractorLabel = (order: ServiceOrder) => order.contractor_name || clients.find((x) => x.id === order.client_id)?.contractor_name || "—";

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        description="Acompanhe as OS desde a entrada até a entrega"
        actions={<Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nova OS</Button>}
      />

      <Dialog open={open} onOpenChange={(value) => { if (!saving) { setOpen(value); if (!value) setEditing(null); } }}>
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
                  <option value="">{clientsLoading ? "Carregando contratantes…" : clientsError ? "Não foi possível carregar" : clients.length === 0 ? "Nenhum contratante cadastrado" : "Selecione o contratante"}</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.contractor_name || client.dentist_name}</option>)}
                </select>
              ) : (
                <Select value={clientId} onValueChange={handleClientChange} disabled={clientsLoading || clientsError || clients.length === 0}>
                  <SelectTrigger aria-label="Contratante"><SelectValue placeholder={clientsLoading ? "Carregando contratantes…" : clientsError ? "Não foi possível carregar" : "Selecione…"} /></SelectTrigger>
                  <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.contractor_name || client.dentist_name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {clientsError && <p className="text-xs font-medium text-destructive">Não foi possível carregar os contratantes.</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input disabled value={selectedCity ? `${selectedCity.name} / ${selectedCity.uf}` : "Selecione o contratante"} />
              <p className="text-[11px] text-muted-foreground">A cidade vem automaticamente do contratante e não pode ser trocada aqui.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Nome da dentista</Label>
              <Select value={dentistName} onValueChange={setDentistName} disabled={!cityId}>
                <SelectTrigger><SelectValue placeholder={!cityId ? "Selecione o contratante primeiro" : filteredDentists.length ? "Selecione a dentista cadastrada…" : "Nenhuma dentista nesta cidade"} /></SelectTrigger>
                <SelectContent>
                  {dentistName && !filteredDentists.some((d) => d.full_name === dentistName) && <SelectItem value={dentistName}>{dentistName} (cadastro legado)</SelectItem>}
                  {filteredDentists.map((dentist) => <SelectItem key={dentist.id} value={dentist.full_name}>{dentist.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Paciente *</Label>
              <Select value={patientName} onValueChange={setPatientName} disabled={!cityId || filteredPatients.length === 0}>
                <SelectTrigger><SelectValue placeholder={!cityId ? "Selecione o contratante primeiro" : filteredPatients.length ? "Selecione o paciente cadastrado…" : "Nenhum paciente cadastrado nesta cidade"} /></SelectTrigger>
                <SelectContent>{filteredPatients.map((patient) => <SelectItem key={patient.id} value={patient.full_name}>{patient.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">02</span>
              <div><p className="text-sm font-semibold">Serviço odontológico</p><p className="text-[11px] text-muted-foreground">Profissional, atendimento e unidade de saúde</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>

            <div className="space-y-1.5">
              <Label>Protético</Label>
              <Select value={techId} onValueChange={setTechId} disabled={!cityId || filteredTechs.length === 0}>
                <SelectTrigger><SelectValue placeholder={!cityId ? "Selecione o contratante primeiro" : filteredTechs.length ? "Selecione…" : "Nenhum protético cadastrado nesta cidade"} /></SelectTrigger>
                <SelectContent>{filteredTechs.map((tech) => <SelectItem key={tech.id} value={tech.id}>{tech.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de atendimento (catálogo)</Label>
              <Select value={typeId} onValueChange={handleTypeChange} disabled={!cityId || filteredTypes.length === 0}>
                <SelectTrigger><SelectValue placeholder={!cityId ? "Selecione o contratante primeiro" : filteredTypes.length ? "Selecione…" : "Nenhum tipo disponível nesta cidade"} /></SelectTrigger>
                <SelectContent>{filteredTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {pricedServiceCode ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Arcada *</Label>
                <Select value={arcade} onValueChange={(value) => handleArcadeChange(value as Arcade)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a arcada…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superior">Superior</SelectItem>
                    <SelectItem value="inferior">Inferior</SelectItem>
                    <SelectItem value="both">Superior + Inferior (2 próteses)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Superior ou inferior = 1 prótese. Superior + inferior = 2 próteses.</p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição do atendimento</Label>
                <Input value={serviceTypeText} onChange={(e) => setServiceTypeText(e.target.value)} placeholder="Ex: Reembasamento, Limpeza, etc." />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Unidade Básica de Saúde (UBS) *</Label>
              <Input required list="ubs-history" value={healthUnit} onChange={(e) => setHealthUnit(e.target.value)} placeholder="Ex: UBS Maria de Lourdes Sousa Matos" />
              <datalist id="ubs-history">{ubsHistory.map((u) => <option key={u} value={u} />)}</datalist>
              {ubsHistory.length > 0 && <p className="text-[11px] text-muted-foreground">Sugestões desta cidade: {ubsHistory.slice(0, 3).join(" • ")}{ubsHistory.length > 3 ? ` • +${ubsHistory.length - 3}` : ""}</p>}
            </div>

            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">03</span>
              <div><p className="text-sm font-semibold">Produção e prazos</p><p className="text-[11px] text-muted-foreground">Status, datas e etapas do laboratório</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => handleStatusChange(value as OsStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Recebido em</Label><Input type="date" value={sentAt} onChange={(e) => applyStageDefaults(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Previsão de entrega</Label><Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Entregue em</Label><Input type="date" value={deliveredAt} onChange={(e) => { setDeliveredAt(e.target.value); setDeliveredAuto(false); }} /></div>

            <div className="sm:col-span-2 mt-2 rounded-2xl border border-primary/12 bg-primary/[0.025] p-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Etapas do atendimento</p><p className="text-[11px] text-muted-foreground">Linha do tempo prevista da produção</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Produção</span></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>1. Moldagem</Label><Input type="date" value={molding} onChange={(e) => setMolding(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>2. Plano de cera</Label><Input type="date" value={waxPlan} onChange={(e) => setWaxPlan(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>3. Montagem de dente</Label><Input type="date" value={teethSetup} onChange={(e) => setTeethSetup(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>4. Acrilização</Label><Input type="date" value={acryl} onChange={(e) => setAcryl(e.target.value)} /></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Datas sugeridas a partir de “Recebido em” (+1, +3, +5 e +7 dias). Podem ser ajustadas.</p>
            </div>

            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">04</span>
              <div><p className="text-sm font-semibold">Valores e gastos</p><p className="text-[11px] text-muted-foreground">Controle financeiro desta ordem de serviço</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>

            <div className="space-y-1.5">
              <Label>Valor do serviço (R$)</Label>
              <Input type="number" min="0" step="0.01" name="price" value={priceValue} onChange={(e) => { const next = e.target.value; setPriceValue(next); setPriceManuallyEdited(next.trim() !== "" && Number(next) !== 0); }} />
              {!editing && !priceManuallyEdited && Number(priceValue) > 0 && <p className="text-[11px] text-muted-foreground">Valor calculado automaticamente pela cidade, prótese e arcada.</p>}
              {!editing && priceManuallyEdited && <p className="text-[11px] text-muted-foreground">Valor manual preservado. Digite 0 para voltar ao cálculo automático.</p>}
            </div>
            <div className="space-y-1.5"><Label>Custo (R$)</Label><Input type="number" min="0" step="0.01" name="cost" defaultValue={String(editing?.cost ?? 0)} /></div>

            <div className="sm:col-span-2 mt-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-2 flex items-center justify-between text-sm font-medium"><span>Gastos adicionais</span><span className="text-xs text-muted-foreground">Total: {brl(totalExpenses)}</span></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
                <Input placeholder="Nome do gasto" value={newExpDesc} onChange={(e) => setNewExpDesc(e.target.value)} />
                <Input type="number" min="0.01" step="0.01" placeholder="Valor (R$)" value={newExpAmount} onChange={(e) => setNewExpAmount(e.target.value)} />
                <Button type="button" onClick={addExpense}><Plus className="mr-1 h-4 w-4" /> Adicionar Gasto</Button>
              </div>
              {expenses.length > 0 && <div className="mt-3 space-y-1">{expenses.map((expense, index) => <div key={`${expense.description}-${index}`} className="flex items-center justify-between rounded border bg-muted/40 px-3 py-1.5 text-sm"><span className="font-medium">{expense.description}</span><div className="flex items-center gap-2"><span>{brl(Number(expense.amount))}</span><Button type="button" size="icon" variant="ghost" onClick={() => removeExpense(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}
            </div>

            <div className="sm:col-span-2 mt-3 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">05</span>
              <div><p className="text-sm font-semibold">Observações</p><p className="text-[11px] text-muted-foreground">Informações complementares da OS</p></div>
              <div className="h-px flex-1 bg-border/65" />
            </div>
            <div className="sm:col-span-2 space-y-1.5"><Label>Observações</Label><Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} /></div>

            <DialogFooter className="sticky bottom-0 z-10 -mx-4 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:col-span-2 sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              <Button type="submit" disabled={saving} className="h-11 w-full sm:h-10 sm:w-auto">{saving ? "Salvando…" : editing ? "Salvar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Ordens cadastradas</p><p className="text-xs text-muted-foreground">Consulte e acompanhe a produção do laboratório</p></div>
            <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou paciente…" className="bg-background pl-9" /></div>
          </div>

          <div className="divide-y divide-border/70 md:hidden">
            {filtered.map((order) => {
              const city = cities.find((item) => item.id === order.city_id);
              const additionalExpenses = expensesByOs[order.id] ?? 0;
              const totalCost = Number(order.cost ?? 0) + additionalExpenses;
              const profit = Number(order.price) - totalCost;
              return <article key={order.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{order.code}</p><p className="mt-1 truncate text-base font-semibold">{order.patient_name}</p></div><StatusBadge status={order.status} /></div>
                <dl className="grid grid-cols-1 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Contratante</dt><dd className="font-medium">{contractorLabel(order)}</dd></div><div><dt className="text-xs text-muted-foreground">Cidade</dt><dd>{city ? `${city.name}/${city.uf}` : "—"}</dd></div></dl>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center"><div><p className="text-[11px] text-muted-foreground">Valor</p><p className="text-xs font-semibold">{brl(Number(order.price))}</p></div><div><p className="text-[11px] text-muted-foreground">Gastos</p><p className="text-xs font-semibold text-destructive">{brl(totalCost)}</p></div><div><p className="text-[11px] text-muted-foreground">Lucro</p><p className={`text-xs font-semibold ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{brl(profit)}</p></div></div>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-11" onClick={() => openEdit(order)}><Edit className="mr-2 h-4 w-4" /> Editar</Button><Button variant="outline" className="h-11 text-destructive" onClick={() => remove(order.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button></div>
              </article>;
            })}
            {!isLoading && filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma OS cadastrada</p>}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader><TableRow><TableHead>OS</TableHead><TableHead>Contratante</TableHead><TableHead>Paciente</TableHead><TableHead>Cidade</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Gastos</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="w-24 text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((order) => {
                  const city = cities.find((c) => c.id === order.city_id);
                  const totalCost = Number(order.cost ?? 0) + (expensesByOs[order.id] ?? 0);
                  const profit = Number(order.price) - totalCost;
                  return <TableRow key={order.id}><TableCell className="font-mono text-xs">{order.code}</TableCell><TableCell><div className="min-w-[190px] font-medium text-foreground">{contractorLabel(order)}</div></TableCell><TableCell className="max-w-[120px] truncate font-medium">{order.patient_name}</TableCell><TableCell className="text-sm">{city ? `${city.name}/${city.uf}` : "—"}</TableCell><TableCell><StatusBadge status={order.status} /></TableCell><TableCell className="text-right">{brl(Number(order.price))}</TableCell><TableCell className="text-right text-destructive">{brl(totalCost)}</TableCell><TableCell className={`text-right font-medium ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{brl(profit)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button aria-label={`Editar ${order.code}`} size="icon" variant="ghost" onClick={() => openEdit(order)}><Edit className="h-4 w-4" /></Button><Button aria-label={`Excluir ${order.code}`} size="icon" variant="ghost" onClick={() => remove(order.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell></TableRow>;
                })}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS cadastrada</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
