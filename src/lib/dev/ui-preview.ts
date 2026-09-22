/**
 * Local UI-only mode: browse tenant screens with empty data.
 * Enable with UI_PREVIEW=1 in .env.local (never in production).
 */

export const PREVIEW_USER_ID = "00000000-0000-4000-8000-000000000001";
export const PREVIEW_TENANT_ID = "00000000-0000-4000-8000-000000000010";
export const PREVIEW_TENANT_NAME = "Empresa Preview";
export const PREVIEW_USER_EMAIL = "preview@local.dev";
export const PREVIEW_USER_NAME = "Você (preview)";

export function isUiPreview(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.UI_PREVIEW === "1" ||
    process.env.NEXT_PUBLIC_UI_PREVIEW === "1"
  );
}

export function previewUser() {
  return {
    id: PREVIEW_USER_ID,
    email: PREVIEW_USER_EMAIL,
    user_metadata: {
      full_name: PREVIEW_USER_NAME,
      must_change_password: false,
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

export function previewMembershipRow() {
  return {
    user_id: PREVIEW_USER_ID,
    tenant_id: PREVIEW_TENANT_ID,
    role: "admin" as const,
    tenants: {
      id: PREVIEW_TENANT_ID,
      name: PREVIEW_TENANT_NAME,
      max_members: 10,
      monthly_ai_token_limit: 2_000_000,
      ai_history_turns: 24,
    },
  };
}

type TerminalOpts = {
  maybe?: boolean;
  single?: boolean;
  head?: boolean;
  count?: boolean;
};

function resolveTable(table: string, opts: TerminalOpts) {
  if (table === "user_tenant_roles") {
    const row = previewMembershipRow();
    if (opts.maybe || opts.single) {
      return { data: row, error: null, count: null };
    }
    return { data: [row], error: null, count: 1 };
  }

  if (opts.head || opts.count) {
    return { data: null, error: null, count: 0 };
  }
  if (opts.maybe || opts.single) {
    return { data: null, error: null, count: null };
  }
  return { data: [], error: null, count: null };
}

function chain(table: string) {
  const mode: TerminalOpts = {};

  const builder: Record<string, unknown> = {};
  const self = () => builder;

  builder.select = (_cols?: unknown, opts?: { head?: boolean; count?: string }) => {
    if (opts?.head) mode.head = true;
    if (opts?.count) mode.count = true;
    return builder;
  };
  builder.insert = () => builder;
  builder.update = () => builder;
  builder.upsert = () => builder;
  builder.delete = () => builder;
  builder.eq = self;
  builder.neq = self;
  builder.in = self;
  builder.is = self;
  builder.gte = self;
  builder.lte = self;
  builder.gt = self;
  builder.lt = self;
  builder.ilike = self;
  builder.like = self;
  builder.or = self;
  builder.not = self;
  builder.match = self;
  builder.filter = self;
  builder.contains = self;
  builder.order = self;
  builder.limit = self;
  builder.range = self;

  builder.maybeSingle = () =>
    Promise.resolve(resolveTable(table, { ...mode, maybe: true }));
  builder.single = () =>
    Promise.resolve(resolveTable(table, { ...mode, single: true }));

  builder.then = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolveTable(table, mode)).then(onFulfilled, onRejected);

  return builder;
}

/** Drop-in stand-in for createServerClient / service client in UI preview. */
export function createPreviewSupabase() {
  const user = previewUser();

  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({
        data: {
          session: {
            user,
            access_token: "preview",
            refresh_token: "preview",
            expires_in: 3600,
            token_type: "bearer",
          },
        },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { user, session: null },
        error: null,
      }),
    },
    from: (table: string) => chain(table),
    rpc: async () => ({ data: null, error: null }),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        download: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };
}
