"use server";

export type TenantState = {
  error?: string;
};

/** Self-serve tenant creation is disabled (DEV-01). */
export async function createTenant(
  _prev: TenantState,
  _formData: FormData,
): Promise<TenantState> {
  return {
    error:
      "Criação de empresa desabilitada. Apenas o super admin da plataforma pode provisionar tenants.",
  };
}
