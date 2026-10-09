import type { Locale } from "@/i18n/config";
import type en from "./messages/en.json";

// Makes message keys and the locale type-checked everywhere use-intl is used.
declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
