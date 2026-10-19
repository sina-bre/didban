import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";
import { applyLocale } from "./document-locale";
import { createT, type Locale, loadMessages, type Messages, type Translate } from "./i18n";

interface LocaleValue {
  locale: Locale;
  t: Translate;
  setLocale: (next: Locale) => Promise<void>;
}

const LocaleContext = createContext<LocaleValue | null>(null);

interface Props {
  initial: Locale;
  messages: Messages;
  children: ReactNode;
}

export function LocaleProvider({ initial, messages, children }: Props) {
  const [state, setState] = useState({ locale: initial, messages });
  const setLocale = useCallback(async (next: Locale) => {
    const nextMessages = await loadMessages(next);
    applyLocale(next);
    setState({ locale: next, messages: nextMessages });
  }, []);
  const value = useMemo(
    () => ({ locale: state.locale, t: createT(state.messages, state.locale), setLocale }),
    [state, setLocale],
  );
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale(): LocaleValue {
  const value = use(LocaleContext);
  if (!value) throw new Error("useLocale needs <LocaleProvider>");
  return value;
}
