import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, LogOut, Shield, ShieldOff, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  listUsers,
  setUserActive,
  forceSignOut,
  setUserRole,
  listLoginEvents,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários & Sessões — LabProt" }] }),
  component: UsuariosPage,
});

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

function UsuariosPage() {
  const qc = useQueryClient();
  const fnList = useServerFn(listUsers);
  const fnToggle = useServerFn(setUserActive);
  const fnLogout = useServerFn(forceSignOut);
  const fnRole = useServerFn(setUserRole);
  const fnEvents = useServerFn(listLoginEvents);

  const [historyUser, setHistoryUser] = useState<{ id: string; name: string } | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fnList(),
    retry: false,
  });

  const { data: events } = useQuery({
    queryKey: ["login-events", historyUser?.id],
    queryFn: () => fnEvents({ data: { targetUserId: historyUser!.id, limit: 100 } }),
    enabled: !!historyUser,
  });

  const toggleActive = useMutation({
    mutationFn: (v: { targetUserId: string; active: boolean }) =>
      fnToggle({ data: v }),
    onSuccess: () => {
      toast.success("Usuário atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forceLogout = useMutation({
    mutationFn: (targetUserId: string) => fnLogout({ data: { targetUserId } }),
    onSuccess: () => toast.success("Sessões revogadas"),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = useMutation({
    mutationFn: (v: { targetUserId: string; makeAdmin: boolean }) =>
      fnRole({ data: v }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Usuários & Sessões" description="Acesso restrito a administradores." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Você não tem permissão para ver esta página.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Usuários & Sessões"
        description="Ative/desative usuários, veja IP e dispositivo do último login e force logout remoto."
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Último login</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{u.city_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{fmtDate(u.last_sign_in_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{u.last_ip ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-xs text-muted-foreground"
                        title={u.last_user_agent ?? ""}
                      >
                        {u.last_user_agent ?? "—"}
                      </TableCell>
                      <TableCell>
                        {u.roles.includes("admin") ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">Usuário</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={u.active}
                          onCheckedChange={(v) =>
                            toggleActive.mutate({ targetUserId: u.id, active: v })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Ver histórico de logins"
                            onClick={() => setHistoryUser({ id: u.id, name: u.full_name ?? u.email })}
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Forçar logout"
                            onClick={() => forceLogout.mutate(u.id)}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title={u.roles.includes("admin") ? "Remover admin" : "Tornar admin"}
                            onClick={() =>
                              toggleRole.mutate({
                                targetUserId: u.id,
                                makeAdmin: !u.roles.includes("admin"),
                              })
                            }
                          >
                            {u.roles.includes("admin") ? (
                              <ShieldOff className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historyUser} onOpenChange={(o) => !o && setHistoryUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de logins — {historyUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(events ?? []).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{fmtDate(e.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{e.ip ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.user_agent ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {events && events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Sem registros
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
