import type { LocaleId } from "./types";

const en: Record<string, string> = {
  "nav.earth": "Earth View",
  "nav.dashboard": "Dashboard",
  "nav.news": "News Intelligence",
  "nav.conflict": "Conflict & Crisis",
  "nav.live": "Live Channels",
  "nav.macro": "Macro Economics",
  "nav.cyber": "Cyber Intelligence",
  "nav.aviation": "Aviation",
  "nav.maritime": "Maritime",
  "nav.space": "Space",
  "nav.markets": "Markets",
  "nav.startup": "Startup Intelligence",
  "nav.government": "Government & Legal",
  "nav.infrastructure": "Infrastructure",
  "nav.city": "City Digital Twin",
  "nav.graph": "Knowledge Graph",
  "nav.investigations": "Investigations",
  "nav.analyst": "AI Analyst",
  "nav.saved": "Saved",
  "nav.methodology": "Methodology",
  "nav.sources": "Sources",
  "nav.settings": "Settings",
  "freshness.title": "Source freshness",
  "country.brief": "Country Brief",
  "export.markdown": "Export MD",
  "settings.title": "Settings",
  "settings.personalization": "Personalization",
  "settings.notifications": "Notifications",
  "layers.title": "Layers",
};

const hi: Record<string, string> = {
  "nav.earth": "पृथ्वी दृश्य",
  "nav.dashboard": "डैशबोर्ड",
  "nav.news": "समाचार खुफिया",
  "nav.conflict": "संघर्ष और संकट",
  "nav.live": "लाइव चैनल",
  "nav.macro": "मैक्रो अर्थशास्त्र",
  "nav.cyber": "साइबर खुफिया",
  "nav.aviation": "विमानन",
  "nav.maritime": "समुद्री",
  "nav.space": "अंतरिक्ष",
  "nav.markets": "बाज़ार",
  "nav.startup": "स्टार्टअप",
  "nav.government": "सरकार",
  "nav.infrastructure": "अवसंरचना",
  "nav.city": "सिटी ट्विन",
  "nav.graph": "ज्ञान ग्राफ",
  "nav.investigations": "जांच",
  "nav.analyst": "AI विश्लेषक",
  "nav.saved": "सहेजा गया",
  "nav.methodology": "कार्यप्रणाली",
  "nav.sources": "स्रोत",
  "nav.settings": "सेटिंग्स",
  "freshness.title": "स्रोत ताजगी",
  "country.brief": "देश ब्रीफ",
  "export.markdown": "MD निर्यात",
  "settings.title": "सेटिंग्स",
  "settings.personalization": "वैयक्तिकरण",
  "settings.notifications": "सूचनाएं",
  "layers.title": "परतें",
};

const ar: Record<string, string> = {
  "nav.earth": "عرض الأرض",
  "nav.dashboard": "لوحة التحكم",
  "nav.news": "استخبارات الأخبار",
  "nav.conflict": "النزاع والأزمات",
  "nav.live": "قنوات مباشرة",
  "nav.macro": "الاقتصاد الكلي",
  "nav.cyber": "الاستخبارات السيبرانية",
  "nav.aviation": "الطيران",
  "nav.maritime": "البحرية",
  "nav.space": "الفضاء",
  "nav.markets": "الأسواق",
  "nav.startup": "الشركات الناشئة",
  "nav.government": "الحكومة",
  "nav.infrastructure": "البنية التحتية",
  "nav.city": "التوأم الرقمي",
  "nav.graph": "رسم المعرفة",
  "nav.investigations": "تحقيقات",
  "nav.analyst": "محلل الذكاء الاصطناعي",
  "nav.saved": "المحفوظات",
  "nav.methodology": "المنهجية",
  "nav.sources": "المصادر",
  "nav.settings": "الإعدادات",
  "freshness.title": "حداثة المصادر",
  "country.brief": "ملخص البلد",
  "export.markdown": "تصدير MD",
  "settings.title": "الإعدادات",
  "settings.personalization": "التخصيص",
  "settings.notifications": "الإشعارات",
  "layers.title": "الطبقات",
};

const catalogs: Record<LocaleId, Record<string, string>> = { en, hi, ar };

export function t(locale: LocaleId, key: string): string {
  return catalogs[locale]?.[key] ?? catalogs.en[key] ?? key;
}

export function navLabel(locale: LocaleId, moduleId: string, fallback: string): string {
  return t(locale, `nav.${moduleId}`) || fallback;
}

export function isRtl(locale: LocaleId): boolean {
  return locale === "ar";
}

export { type LocaleId } from "./types";
