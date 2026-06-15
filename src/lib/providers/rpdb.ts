
function fillTemplate(template: string, metaId: string): string | undefined {
  const tmdb = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  const imdb = metaId.startsWith("tt") ? metaId : undefined;
  const mediaType = tmdb ? tmdb[1] : "movie";
  const tmdbId = tmdb ? tmdb[2] : undefined;
  const idToken = imdb ?? (tmdb ? `${tmdb[1]}-${tmdb[2]}` : undefined);
  if (!idToken) return undefined;
  let out = template;
  const sub = (token: string, value: string | undefined): boolean => {
    if (!out.includes(token)) return true;
    if (!value) return false;
    out = out.split(token).join(value);
    return true;
  };
  if (!sub("{imdbId}", imdb)) return undefined;
  if (!sub("{imdb_id}", imdb)) return undefined;
  if (!sub("{tmdbId}", tmdbId)) return undefined;
  if (!sub("{tmdb_id}", tmdbId)) return undefined;
  sub("{type}", mediaType);
  sub("{mediaType}", mediaType);
  if (!sub("{id}", idToken)) return undefined;
  return out;
}

export function rpdbPoster(key: string, posterBaseUrl: string, metaId: string, fallback?: string): string | undefined {
  const effectiveBase = posterBaseUrl.trim().replace(/\/+$/, "");
  if (effectiveBase && effectiveBase.includes("{")) {
    return fillTemplate(effectiveBase, metaId) ?? fallback;
  }
  const base = effectiveBase || "https://api.ratingposterdb.com";
  if (!key && !effectiveBase) return fallback;
  const keySeg = key || "default";
  if (metaId.startsWith("tt")) {
    return `${base}/${keySeg}/imdb/poster-default/${metaId}.jpg?fallback=true`;
  }
  const m = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (m) {
    return `${base}/${keySeg}/tmdb/poster-default/${m[1]}-${m[2]}.jpg?fallback=true`;
  }
  return fallback;
}
