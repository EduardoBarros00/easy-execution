import { Moon, Sun, LogOut } from "lucide-react";
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-6">
      <SidebarTrigger />
      <div className="flex-1">
        {title && <h1 className="text-sm font-semibold md:text-base">{title}</h1>}
      </div>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
