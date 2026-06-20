// Static language metadata — intentionally tiny and always bundled so the
// language picker (settings + landing nav) and validation work without pulling
// in the full translation dictionaries. The dictionaries themselves live in
// `en` (inline in TranslationContext, the default + fallback) and `extra.ts`
// (the other languages, lazy-loaded on demand).

export interface LanguageMeta {
  code: string;
  /** Native name shown in the picker (matches each dict's former `lang_name`). */
  name: string;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'he', name: 'עברית' },
  { code: 'zh', name: '中文' },
  { code: 'it', name: 'Italiano' },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

/** Languages written right-to-left, used to set the document `dir`. */
export const RTL_LANGUAGES = ['ar', 'he'];

export function isSupportedLanguage(code: string | null | undefined): boolean {
  return !!code && LANGUAGE_CODES.includes(code);
}
