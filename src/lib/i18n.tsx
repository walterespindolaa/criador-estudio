import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { pt } from "./locales/pt";
import { en } from "./locales/en";

export type Lang = "pt" | "en";

type Dict = Record<string, unknown>;
const DICTS: Record<Lang, Dict> = { pt, en };

function resolve(dict: Dict, key: string): string | undefined {
  const val = key.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Dict)[k]), dict);
  return typeof val === "string" ? val : undefined;
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx>({ lang: "pt", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("cria-lang") as Lang) || "pt");

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = (l: Lang) => {
    localStorage.setItem("cria-lang", l);
    setLangState(l);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = resolve(DICTS[lang], key) ?? resolve(DICTS.pt, key) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
