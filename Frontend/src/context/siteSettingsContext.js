import { createContext, useContext } from "react";
import { emptySiteSettings } from "../services/siteSettingsService";

/**
 * Site settings context, kept separate from its provider component so the
 * provider file exports only components — React Fast Refresh cannot hot-reload
 * a file that mixes component and non-component exports.
 */
export const SiteSettingsContext = createContext({
  settings: emptySiteSettings(),
  loading: true,
  refresh: () => {},
});

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
