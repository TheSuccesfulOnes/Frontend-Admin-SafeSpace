import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { LanguageContext } from "./languageContext";
import { translations, type Language } from "./translations";

const STORAGE_KEY = "employee-wellbeing-admin-language";

function readInitialLanguage(): Language {
  const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
  return savedLanguage === "es" ? "es" : "en";
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = "Employee Wellbeing — Admin";
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: keyof typeof translations.en) => translations[language][key],
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
