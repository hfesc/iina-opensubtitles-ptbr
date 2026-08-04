const VIDEO_EXTENSIONS = /\.(?:3g2|3gp|avi|flv|m2ts|m4v|mkv|mov|mp4|mpeg|mpg|mts|ogm|ogv|ts|webm|wmv)$/i;

export function buildSearchParams({ url = "", title = "", isNetworkResource = false }) {
  const rawName = isNetworkResource ? title || url : filenameFromPath(url) || title;
  const withoutExtension = rawName.replace(VIDEO_EXTENSIONS, "");
  const normalized = withoutExtension
    .replace(/[._]+/g, " ")
    .replace(/[\[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const episode = normalized.match(/\bS(\d{1,2})[ ._-]*E(\d{1,3})\b/i);
  const year = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  const firstMetadataIndex = [episode?.index, year?.index]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b)[0];
  const query = (firstMetadataIndex ? normalized.slice(0, firstMetadataIndex) : normalized)
    .replace(/\s+/g, " ")
    .trim();

  const params = {
    languages: "pt-br",
    query: query || normalized,
  };
  if (year) params.year = year[1];
  if (episode) {
    params.season_number = String(Number(episode[1]));
    params.episode_number = String(Number(episode[2]));
  }
  return params;
}

export function filenameFromPath(value) {
  if (!value) return "";

  const withoutQuery = value.split(/[?#]/, 1)[0];
  const lastPart = withoutQuery.replace(/\\/g, "/").split("/").pop() || "";
  try {
    return decodeURIComponent(lastPart);
  } catch {
    return lastPart;
  }
}
