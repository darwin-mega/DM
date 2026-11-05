const tokenPattern = /^[a-f0-9]{64}$/;
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
const digest = async token => hex(new Uint8Array(await crypto.subtle.digest(
  "SHA-256", new TextEncoder().encode(token),
)));

export function createCloud({ url, key, client } = {}) {
  const configured = Boolean(client || (url && key));
  let connection;
  function connect() {
    if (!configured) throw new Error("El guardado en línea todavía no está configurado.");
    connection ??= client ? Promise.resolve(client) : import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm"
    ).then(({ createClient }) => createClient(url, key, {
      auth: { flowType: "pkce", storageKey: "dm-piloto-auth" },
    })).catch(error => { connection = undefined; throw error; });
    return connection;
  }

  function result({ data, error }) {
    if (error) throw new Error(error.message, { cause: error });
    return data;
  }

  return {
    configured,
    async requestSignIn(email, redirectTo) {
      const supabase = await connect();
      result(await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      }));
    },
    async session() {
      if (!configured) return null;
      const supabase = await connect();
      return result(await supabase.auth.getSession()).session;
    },
    async canEdit() {
      const supabase = await connect();
      return result(await supabase.rpc("dm_pilot_is_editor")) === true;
    },
    async signOut() {
      const supabase = await connect();
      result(await supabase.auth.signOut({ scope: "local" }));
    },
    async saveProject({ id, name, data, revision }) {
      const supabase = await connect();
      const fields = { name, data };
      if (!id) {
        return result(await supabase.from("dm_pilot_projects").insert(fields).select().single());
      }
      if (!Number.isInteger(revision)) throw new Error("Volvé a abrir el proyecto antes de guardar.");
      const saved = result(await supabase.from("dm_pilot_projects").update(fields)
        .eq("id", id).eq("revision", revision).select().maybeSingle());
      if (!saved) throw new Error("El proyecto cambió en otra sesión. Volvé a abrirlo antes de guardar.");
      return saved;
    },
    async listProjects() {
      const supabase = await connect();
      return result(await supabase.from("dm_pilot_projects").select("*").order("updated_at", { ascending: false }));
    },
    async publishShare({ projectId, data }) {
      const supabase = await connect();
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      result(await supabase.from("dm_pilot_shares").insert({
        project_id: projectId,
        token_digest: await digest(token),
        data,
      }));
      return token;
    },
    async loadShare(token) {
      if (!tokenPattern.test(token ?? "")) return null;
      const supabase = await connect();
      return result(await supabase.rpc("dm_pilot_read_share", { capability: token }));
    },
    async listShares(projectId) {
      const supabase = await connect();
      return result(await supabase.from("dm_pilot_shares").select("token_digest,created_at")
        .eq("project_id", projectId).order("created_at", { ascending: false }));
    },
    async revokeShare(token) {
      if (!tokenPattern.test(token ?? "")) throw new Error("Enlace inválido.");
      const supabase = await connect();
      result(await supabase.from("dm_pilot_shares").delete().eq("token_digest", await digest(token)));
    },
    async revokeShareDigest(tokenDigest) {
      if (!tokenPattern.test(tokenDigest ?? "")) throw new Error("Identificador inválido.");
      const supabase = await connect();
      result(await supabase.from("dm_pilot_shares").delete().eq("token_digest", tokenDigest));
    },
  };
}
