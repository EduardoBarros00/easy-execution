import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

/** Lista usuários com último login, IP, ativo, papel — admin only */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, active, city_id, cities(name, uf)")
      .order("full_name");
    if (pErr) throw new Error(pErr.message);

    const ids = (profiles ?? []).map((p: any) => p.id);
    const { data: authList, error: aErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (aErr) throw new Error(aErr.message);

    const authMap = new Map<string, any>();
    for (const u of authList.users) authMap.set(u.id, u);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }

    const { data: lastEvents } = await supabaseAdmin
      .from("login_events")
      .select("user_id, ip, user_agent, created_at")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });

    const lastMap = new Map<string, any>();
    for (const e of lastEvents ?? []) {
      if (!lastMap.has(e.user_id)) lastMap.set(e.user_id, e);
    }

    return (profiles ?? []).map((p: any) => {
      const a = authMap.get(p.id);
      const last = lastMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: a?.email ?? null,
        active: p.active,
        city_id: p.city_id,
        city_name: p.cities ? `${p.cities.name}-${p.cities.uf}` : null,
        roles: roleMap.get(p.id) ?? [],
        last_sign_in_at: a?.last_sign_in_at ?? null,
        created_at: a?.created_at ?? null,
        last_ip: last?.ip ?? null,
        last_user_agent: last?.user_agent ?? null,
        last_event_at: last?.created_at ?? null,
      };
    });
  });

/** Ativar/desativar usuário (banir login) — admin only */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.targetUserId === userId)
      throw new Error("Você não pode desativar a si mesmo");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("profiles").update({ active: data.active }).eq("id", data.targetUserId);

    // bane no auth para impedir login enquanto desativado; reativa zerando ban
    await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      ban_duration: data.active ? "none" : "876000h", // ~100 anos
    });
    if (!data.active) {
      await supabaseAdmin.auth.admin.signOut(data.targetUserId, "global");
    }
    return { ok: true };
  });

/** Forçar logout (revoga todas as sessões) — admin only */
export const forceSignOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(data.targetUserId, "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Listar histórico de logins (admin: todos; user: só os seus) */
export const listLoginEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    const target = data.targetUserId ?? userId;
    if (target !== userId && !isAdmin) throw new Error("Forbidden");

    const { data: rows, error } = await supabase
      .from("login_events")
      .select("id, user_id, ip, user_agent, event_type, created_at")
      .eq("user_id", target)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Registra um evento de login (chamado pelo cliente após signIn) */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const req = getRequest();
    const headers = req?.headers;
    const ip =
      headers?.get("cf-connecting-ip") ??
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headers?.get("x-real-ip") ??
      null;
    const ua = headers?.get("user-agent") ?? null;

    const { error } = await supabase.from("login_events").insert({
      user_id: userId,
      ip,
      user_agent: ua,
      event_type: "sign_in",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Promover/remover admin — admin only */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string; makeAdmin: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.targetUserId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      if (data.targetUserId === userId)
        throw new Error("Você não pode remover seu próprio admin");
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("role", "admin");
    }
    return { ok: true };
  });
