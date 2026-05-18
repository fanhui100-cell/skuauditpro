import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const cache = new Map();

export function getDictionary(lang = "zh") {
  const safeLang = lang === "en" ? "en" : "zh";
  if (cache.has(safeLang)) return cache.get(safeLang);

  const filePath = join(__dirname, "i18n", `${safeLang}.json`);
  if (!existsSync(filePath)) {
    cache.set(safeLang, {});
    return {};
  }

  const dict = JSON.parse(readFileSync(filePath, "utf-8"));
  cache.set(safeLang, dict);
  return dict;
}

export function t(lang, keyPath, fallback = "") {
  const dict = getDictionary(lang);
  const keys = keyPath.split(".");
  let value = dict;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return fallback || keyPath;
    }
  }
  return typeof value === "string" ? value : fallback || keyPath;
}
