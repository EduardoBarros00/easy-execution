import { Moon, Sun, LogOut, Activity } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AppHeader({ title }: { title?: string }) {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/login" });
  };
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/65 bg-background/82 px-3 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="rounded-xl" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {title && <h1 className="truncate text-sm font-semibold md:text-base">{title}</h1>}
        <div className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/7 px-2.5 py-1 text-[11px] font-medium text-primary md:flex">
          <Activity className="h-3.5 w-3.5" />
          Gestão odontológica
        </div>
      </div>
      <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggle} aria-label="Alternar tema">
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={signOut} aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
