function cleanTitle(value: string | null | undefined) {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim();
  } catch {
    return value.replace(/\+/g, " ").trim();
  }
}

export function naverSearchTitle(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim());
    if (!/(^|\.)naver\.com$/i.test(url.hostname)) return "";

    const parameterTitle = cleanTitle(
      url.searchParams.get("query") ?? url.searchParams.get("searchQuery") ?? url.searchParams.get("search_query"),
    );
    if (parameterTitle) return parameterTitle;

    const pathMatch = url.pathname.match(/\/(?:p\/)?search\/([^/?#]+)/i);
    if (pathMatch) return cleanTitle(pathMatch[1]);

    const hash = url.hash.replace(/^#/, "");
    const hashQuery = hash.startsWith("?") ? new URLSearchParams(hash.slice(1)).get("query") : null;
    if (hashQuery) return cleanTitle(hashQuery);
    const hashMatch = hash.match(/\/(?:p\/)?search\/([^/?#]+)/i);
    return hashMatch ? cleanTitle(hashMatch[1]) : "";
  } catch {
    return "";
  }
}
