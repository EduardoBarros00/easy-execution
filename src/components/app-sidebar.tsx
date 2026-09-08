import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  UserCog,
  ClipboardList,
  Wallet,
  Receipt,
  FileBarChart2,
  Settings,
  Smile,
  Truck,
  MapPin,
  UserRound,
  ShieldCheck,
  ListChecks,
  Activity,
  CalendarDays,
  FileText,
  BadgeDollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DentalMark } from "@/components/dental-mark";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda", url: "/agenda", icon: CalendarDays },
      { title: "Ordens de Serviço", url: "/os" as const, icon: ClipboardList },
      { title: "Pacientes", url: "/pacientes", icon: UserRound },
      { title: "Prontuários", url: "/prontuarios", icon: FileText },
    ],
  },
  {
    label: "Profissionais",
    items: [
      { title: "Dentistas", url: "/dentistas", icon: Smile },
      { title: "Protéticos", url: "/proteticos", icon: UserCog },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Tipos de Atendimento", url: "/tipos-atendimento", icon: ListChecks },
      { title: "Cidades", url: "/cidades", icon: MapPin },
      { title: "Contratantes", url: "/clientes", icon: Users },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Valores por Cidade", url: "/valores-cidade", icon: BadgeDollarSign },
      { title: "Financeiro", url: "/financeiro", icon: Wallet },
      { title: "Despesas", url: "/despesas", icon: Receipt },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Relatórios", url: "/relatorios", icon: FileBarChart2 },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

const adminItem = { title: "Usuários & Sessões", url: "/usuarios", icon: ShieldCheck };

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", {
        _user_id: u.user.id,
        _role: "admin",
      });
      return !!data;
    },
    staleTime: 5 * 60_000,
  });

  const menuGroups = groups.map((group) =>
    group.label === "Gestão" && isAdmin
      ? { ...group, items: [...group.items, adminItem] }
      : group,
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/70 px-2 py-2.5 pr-12 md:pr-2">
        <div className="flex items-center gap-2.5 rounded-2xl px-1.5 py-1.5">
          <DentalMark className="h-10 w-10 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-bold tracking-[-0.02em]">LabProt</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">Pro</span>
              </div>
              <span className="block truncate text-[10.5px] text-muted-foreground">Laboratório Odontológico</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/45">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const active = pathname === item.url || pathname.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="h-10 rounded-xl px-2.5 font-medium transition-all data-[active=true]:bg-sidebar-primary/12 data-[active=true]:text-sidebar-primary data-[active=true]:shadow-[inset_3px_0_0_var(--color-sidebar-primary)] hover:bg-sidebar-accent/75"
                      >
                        <Link
                          to={item.url}
                          className="flex items-center gap-2.5"
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          <item.icon className="h-[17px] w-[17px] shrink-0" />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2.5">
        <div className="flex items-center gap-2 rounded-xl bg-sidebar-accent/45 p-2 text-sidebar-foreground">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Sistema operacional</p>
              <p className="text-[10px] text-muted-foreground">Gestão clínica e laboratorial</p>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
