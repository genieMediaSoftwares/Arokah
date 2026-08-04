import { useCallback, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService";
import { onSessionExpired } from "../services/api";
import { AdminAuthContext } from "./authContext";

/**
 * Replaces Firebase's onAuthStateChanged. On mount we ask the backend who the
 * current user is; the axios interceptor silently refreshes an expired access
 * token first, so a signed-in admin survives a page reload.
 */
function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    authService.restoreSession().then((user) => {
      if (cancelled) return;
      setAdmin(user);
      setLoading(false);
    });

    // Fires when a refresh attempt fails — drop the user out of the admin UI.
    const unsubscribe = onSessionExpired(() => {
      if (!cancelled) setAdmin(null);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const user = await authService.login(credentials);
    setAdmin(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setAdmin(null);
  }, []);

  const value = useMemo(() => ({ admin, loading, login, logout }), [admin, loading, login, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export default AdminAuthProvider;
