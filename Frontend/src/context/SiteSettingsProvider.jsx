import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteSettingsContext } from "./siteSettingsContext";
import { emptySiteSettings, getSiteSettings } from "../services/siteSettingsService";
import { resolveImageUrl } from "../utils/imageUrl";

/**
 * Loads site branding once and shares it with every component that renders it
 * (navbar, footer, contact page, about page, document title).
 *
 * On failure the app keeps working with blank values rather than blocking the
 * page: branding is decoration, and losing it must not take the site down.
 */
function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(emptySiteSettings());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getSiteSettings();
      if (data) setSettings({ ...emptySiteSettings(), ...data });
    } catch {
      // Leave the blank defaults in place.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the browser tab in step with the configured company name and favicon.
  useEffect(() => {
    if (settings.companyName) {
      document.title = settings.tagline
        ? `${settings.companyName} — ${settings.tagline}`
        : settings.companyName;
    }

    const href = resolveImageUrl(settings.favicon);
    if (!href) return;

    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [settings.companyName, settings.tagline, settings.favicon]);

  const value = useMemo(
    () => ({ settings, loading, refresh: load }),
    [settings, loading, load]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export default SiteSettingsProvider;
