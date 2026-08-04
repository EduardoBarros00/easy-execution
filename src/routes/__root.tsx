import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LabProt — Gestão de Laboratório de Prótese" },
      { name: "description", content: "Sistema completo para gestão de laboratórios de prótese dentária: OS, financeiro, clientes e protéticos." },
      { property: "og:title", content: "LabProt — Gestão de Laboratório de Prótese" },
      { name: "twitter:title", content: "LabProt — Gestão de Laboratório de Prótese" },
      { property: "og:description", content: "Sistema completo para gestão de laboratórios de prótese dentária: OS, financeiro, clientes e protéticos." },
      { name: "twitter:description", content: "Sistema completo para gestão de laboratórios de prótese dentária: OS, financeiro, clientes e protéticos." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ecf4abb5-9047-4497-8c36-34f05788b474/id-preview-e90f9fe3--9eb62b5b-9e70-43c6-8219-2b683f306a72.lovable.app-1779994694146.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ecf4abb5-9047-4497-8c36-34f05788b474/id-preview-e90f9fe3--9eb62b5b-9e70-43c6-8219-2b683f306a72.lovable.app-1779994694146.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Não foi possível carregar a página</h1>
        <p className="text-sm text-muted-foreground">Tente novamente ou volte para o início do sistema.</p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            Tentar novamente
          </Button>
          <Button variant="outline" onClick={() => router.navigate({ to: "/", replace: true })}>
            Ir para o início
          </Button>
        </div>
      </div>
    </main>
  );
}

function RootNotFoundComponent() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">O endereço acessado não existe neste sistema.</p>
        <Button onClick={() => router.navigate({ to: "/", replace: true })}>Ir para o início</Button>
      </div>
    </main>
  );
}
