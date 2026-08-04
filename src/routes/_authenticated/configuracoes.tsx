import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — LabProt" }] }),
  component: Configuracoes,
});

function Configuracoes() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Preferências da conta" />

      <Card>
        <CardHeader><CardTitle>Conta</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <p className="text-muted-foreground">E-mail</p>
            <p className="font-medium">{user?.email ?? "—"}</p>
          </div>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
