import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Storage } from "@/utils/storage";
import { type Locale, translations } from "./translations";

type Messages = typeof translations.zh;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  messages: Messages;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "zh",
  setLocale: async () => {},
  t: (key) => key,
  messages: translations.zh,
});

const getNestedValue = (obj: Record<string, any>, path: string) => {
  return path
    .split(".")
    .reduce(
      (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
      obj,
    );
};

const formatMessage = (
  value: string,
  vars?: Record<string, string | number>,
) => {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key) =>
    String(vars[key] ?? `{${key}}`),
  );
};

const detectSystemLocale = (): Locale => {
  const uiLanguage = chrome.i18n?.getUILanguage?.() ?? navigator.language ?? "";
  if (!uiLanguage) return "zh";
  return uiLanguage.toLowerCase().startsWith("zh") ? "zh" : "en";
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const result = await chrome.storage.local.get("preferences");
      const stored = result.preferences as { language?: Locale } | undefined;
      let nextLocale: Locale | undefined = stored?.language;
      if (nextLocale !== "zh" && nextLocale !== "en") {
        nextLocale = detectSystemLocale();
        const prefs = await Storage.getPreferences();
        await Storage.setPreferences({ ...prefs, language: nextLocale });
      }
      if (!mounted || !nextLocale) return;
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
    };
    init().catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      const prefs = changes.preferences?.newValue as
        | { language?: Locale }
        | undefined;
      if (prefs?.language && prefs.language !== locale) {
        setLocaleState(prefs.language);
        document.documentElement.lang =
          prefs.language === "zh" ? "zh-CN" : "en";
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [locale]);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    const prefs = await Storage.getPreferences();
    await Storage.setPreferences({ ...prefs, language: next });
  }, []);

  const messages = useMemo<Messages>(
    () => (translations[locale] ?? translations.zh) as Messages,
    [locale],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value =
        getNestedValue(messages as unknown as Record<string, any>, key) ??
        getNestedValue(
          translations.zh as unknown as Record<string, any>,
          key,
        ) ??
        key;
      if (typeof value !== "string") return key;
      return formatMessage(value, vars);
    },
    [messages],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      messages,
    }),
    [locale, setLocale, t, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
export type { Locale, Messages };
