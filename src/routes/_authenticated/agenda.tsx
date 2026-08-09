import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/agenda")({ component: Agenda });

type Appointment = { id: string; patient_id: string; dentist_id: string | null; scheduled_at: string; duration_minutes: number; status: string; reason: string | null; notes: string | null };
type Person = { id: string; full_name: string };
const statusLabel: Record<string, string> = { scheduled: "Agendada", confirmed: "Confirmada", completed: "Concluída", cancelled: "Cancelada", no_show: "Não compareceu" };

function Agenda() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [patientId, setPatientId] = useState("");
  const [dentistId, setDentistId] = useState("");
  const [time, setTime] = useState("08:00");
  const [duration, setDuration] = useState("30");
  const [status, setStatus] = useState("scheduled");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const { data: appointments = [] } = useQuery({ queryKey: ["appointments"], queryFn: async () => {
    const { data, error } = await (supabase as any).from("appointments").select("*").order("scheduled_at");
    if (error) throw error; return data as Appointment[];
  }});
  const { data: patients = [] } = useQuery({ queryKey: ["patients-mini"], queryFn: async () => {
    const { data, error } = await (supabase as any).from("patients").select("id, full_name").order("full_name");
    if (error) throw error; return data as Person[];
  }});
  const { data: dentists = [] } = useQuery({ queryKey: ["dentists-mini"], queryFn: async () => {
    const { data, error } = await supabase.from("dentists").select("id, full_name").order("full_name");
    if (error) throw error; return data as Person[];
  }});

  const visible = useMemo(() => appointments.filter((a) => a.scheduled_at.slice(0, 10) === date), [appointments, date]);
  const reset = () => { setPatientId(""); setDentistId(""); setTime("08:00"); setDuration("30"); setStatus("scheduled"); setReason(""); setNotes(""); };
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patientId) return toast.error("Selecione o paciente");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("appointments").insert({ owner_id: user!.id, patient_id: patientId, dentist_id: dentistId || null, scheduled_at: `${date}T${time}:00`, duration_minutes: Number(duration), status, reason: reason.trim() || null, notes: notes.trim() || null });
    if (error) return toast.error(error.message);
    toast.success("Consulta agendada"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["appointments"] });
  };
  const updateStatus = async (id: string, next: string) => {
    const { error } = await (supabase as any).from("appointments").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message); qc.invalidateQueries({ queryKey: ["appointments"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir esta consulta?")) return;
    const { error } = await (supabase as any).from("appointments").delete().eq("id", id);
    if (error) return toast.error(error.message); qc.invalidateQueries({ queryKey: ["appointments"] });
  };
  const name = (list: Person[], id: string | null) => list.find((item) => item.id === id)?.full_name ?? "—";

  return <>
    <PageHeader title="Agenda" description="Organize consultas, retornos e atendimentos clínicos" actions={<Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nova consulta</Button>} />
    <Card className="mb-5"><CardContent className="flex flex-wrap items-end gap-3 p-4"><div className="space-y-1.5"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><p className="pb-2 text-sm text-muted-foreground">{visible.length} consulta(s) neste dia</p></CardContent></Card>
    <Card><CardContent className="divide-y p-0">{visible.map((appointment) => <div key={appointment.id} className="flex flex-wrap items-center gap-3 p-4"><div className="flex w-20 items-center gap-1 font-mono text-sm font-semibold"><Clock3 className="h-4 w-4 text-primary" />{appointment.scheduled_at.slice(11, 16)}</div><div className="min-w-[190px] flex-1"><p className="font-semibold">{name(patients, appointment.patient_id)}</p><p className="text-xs text-muted-foreground">{name(dentists, appointment.dentist_id)} · {appointment.reason || "Consulta"}</p></div><Select value={appointment.status} onValueChange={(value) => updateStatus(appointment.id, value)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" onClick={() => remove(appointment.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}{visible.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground"><CalendarDays className="mx-auto mb-3 h-7 w-7" />Nenhuma consulta agendada para esta data.</div>}</CardContent></Card>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}><DialogContent><DialogHeader><DialogTitle>Nova consulta</DialogTitle></DialogHeader><form onSubmit={add} className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Paciente *</Label><Select value={patientId} onValueChange={setPatientId}><SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger><SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Dentista</Label><Select value={dentistId} onValueChange={setDentistId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{dentists.map((dentist) => <SelectItem key={dentist.id} value={dentist.id}>{dentist.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Horário</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div><div className="space-y-1.5"><Label>Duração (minutos)</Label><Input type="number" min="10" max="480" value={duration} onChange={(e) => setDuration(e.target.value)} /></div><div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5 sm:col-span-2"><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Avaliação, retorno, limpeza" /></div><div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div><DialogFooter className="sm:col-span-2"><Button type="submit"><Check className="mr-1 h-4 w-4" /> Agendar consulta</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}
