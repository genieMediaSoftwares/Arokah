import { createContext, useContext } from "react";

/**
 * Admin session context. Kept in its own module (separate from the provider
 * component) so the provider file exports only components — React Fast Refresh
 * cannot hot-reload a file that mixes component and non-component exports.
 */
export const AdminAuthContext = createContext(null);

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  }
  return context;
}
