/** Contract and demo account ids, derived from env (all `<name>.<master>` sub-accounts). */
export interface DemoIds {
  vault: string;
  token: string;
  master: string;
  ceo: string;
  cfo: string;
  finance: string;
  vendor: string;
  supplier: string;
}

export function deploymentIds(): DemoIds | null {
  const vault = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID?.trim();
  const token = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID?.trim();
  if (!vault || !token || !vault.startsWith("vault.")) return null;
  const master = vault.slice("vault.".length);
  return {
    vault,
    token,
    master,
    ceo: process.env.DEMO_CEO_ACCOUNT_ID?.trim() || `ceo.${master}`,
    cfo: `cfo.${master}`,
    finance: process.env.DEMO_FINANCE_ACCOUNT_ID?.trim() || `finance.${master}`,
    vendor: `vendor.${master}`,
    supplier: `supplier.${master}`,
  };
}
