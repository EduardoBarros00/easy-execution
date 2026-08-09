import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { recordLogin } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — LabProt" }] }),
  component: LoginPage,
});

type City = { id: string; name: string; uf: string };

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tab, setTab] = useState<"login" | "signup">("login");

  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [showNewCity, setShowNewCity] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [newCityUf, setNewCityUf] = useState("CE");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    loadCities();
    const saved = typeof window !== "undefined" ? localStorage.getItem("selected_city_id") : null;
    if (saved) setCityId(saved);
  }, [navigate]);

  const loadCities = async () => {
    const { data } = await supabase.from("cities").select("id,name,uf").order("name");
    setCities((data ?? []) as City[]);
  };

  const persistCity = (id: string) => {
    setCityId(id);
    if (typeof window !== "undefined") localStorage.setItem("selected_city_id", id);
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityId) return toast.error("Selecione uma cidade");
    setLoading(true);
    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // Vincula a cidade selecionada ao perfil do usuário — garante isolamento por cidade via RLS
    if (signIn.user) {
      // Bloqueia usuário desativado
      const { data: prof } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", signIn.user.id)
        .maybeSingle();
      if (prof && prof.active === false) {
        await supabase.auth.signOut();
        setLoading(false);
        return toast.error("Usuário desativado. Contate o administrador.");
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ city_id: cityId })
        .eq("id", signIn.user.id);
      if (upErr) {
        setLoading(false);
        return toast.error("Falha ao definir cidade: " + upErr.message);
      }
      // registra IP/dispositivo do login (best-effort)
      try {
        await recordLogin();
      } catch (_) {}
    }
    localStorage.setItem("selected_city_id", cityId);
    setLoading(false);
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalCityId = cityId;
    if (showNewCity) {
      if (!newCityName.trim() || !newCityUf.trim()) return toast.error("Informe nome e UF da nova cidade");
    } else if (!finalCityId) {
      return toast.error("Selecione uma cidade ou cadastre uma nova");
    }
    setLoading(true);
    const { data: signData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    // Create new city for this user if requested (via controlled server-side routine)
    if (showNewCity && signData.user) {
      const { data: created, error: cErr } = await (supabase as any).rpc("bootstrap_city", {
        _name: newCityName.trim(),
        _uf: newCityUf.trim().toUpperCase(),
      });
      if (cErr) {
        toast.error("Conta criada, mas falha ao salvar cidade: " + cErr.message);
      } else if (created) {
        finalCityId = created as string;
      }
    }


    // Save city to profile
    if (signData.user && finalCityId) {
      await supabase.from("profiles").update({ city_id: finalCityId }).eq("id", signData.user.id);
      localStorage.setItem("selected_city_id", finalCityId);
    }

    setLoading(false);
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    setTab("login");
    loadCities();
  };

  const citySelect = (idPrefix: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-city`}>Cidade</Label>
      <Select value={cityId} onValueChange={persistCity}>
        <SelectTrigger id={`${idPrefix}-city`}>
          <SelectValue placeholder={cities.length ? "Selecione a cidade" : "Nenhuma cidade cadastrada"} />
        </SelectTrigger>
        <SelectContent>
          {cities.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} - {c.uf}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-gradient-to-br from-primary via-primary to-[oklch(0.42_0.18_265)] p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Stethoscope className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold">LabProt</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-tight">Gestão completa do seu laboratório de prótese.</h2>
          <p className="text-base text-white/80">
            Controle ordens de serviço, financeiro, clientes e produção em um único lugar — rápido, organizado e profissional.
          </p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} LabProt</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md border-border/60 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Stethoscope className="h-5 w-5" />
              </div>
              <span className="font-semibold">LabProt</span>
            </div>
            <CardTitle>Acessar o sistema</CardTitle>
            <CardDescription>Selecione sua cidade e entre, ou crie uma nova conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <form onSubmit={onLogin} className="space-y-3">
                  {citySelect("login")}
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-pass">Senha</Label>
                    <Input id="login-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <form onSubmit={onSignup} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Nome completo</Label>
                    <Input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Senha (mínimo 6 caracteres)</Label>
                    <Input id="su-pass" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                  </div>

                  {!showNewCity ? (
                    <>
                      {citySelect("su")}
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowNewCity(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Cadastrar nova cidade
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-2 rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Nova cidade</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewCity(false)}>
                          Cancelar
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input className="col-span-2" placeholder="Nome da cidade" value={newCityName} onChange={(e) => setNewCityName(e.target.value)} />
                        <Input placeholder="UF" maxLength={2} value={newCityUf} onChange={(e) => setNewCityUf(e.target.value.toUpperCase())} />
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
