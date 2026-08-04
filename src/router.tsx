import { QueryClient } from "@tanstack/react-query";
import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Button } from "@/components/ui/button";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
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

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
