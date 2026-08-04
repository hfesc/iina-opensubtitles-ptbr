export function prepareResults(items, limit = 30) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items
    .filter((item) => {
      const fileId = firstFile(item)?.file_id;
      if (!fileId || seen.has(fileId)) return false;
      seen.add(fileId);
      return true;
    })
    .sort(compareResults)
    .slice(0, limit);
}

export function describeResult(item) {
  const attributes = item?.data?.attributes ?? item?.attributes ?? {};
  const feature = attributes.feature_details ?? {};
  const name = attributes.release || feature.movie_name || firstFile(attributes)?.file_name || "Legenda sem título";
  const details = [feature.year, attributes.from_trusted ? "confiável" : ""]
    .filter(Boolean)
    .join(" · ");
  const downloads = Number(attributes.download_count || 0).toLocaleString("pt-BR");
  const hearingImpaired = attributes.hearing_impaired ? " · SDH" : "";

  return {
    name,
    left: details || "PT-BR",
    right: `${downloads} downloads${hearingImpaired}`,
  };
}

export function firstFile(item) {
  const attributes = item?.attributes ?? item;
  return Array.isArray(attributes?.files) ? attributes.files[0] : null;
}

function compareResults(left, right) {
  const leftAttributes = left.attributes ?? {};
  const rightAttributes = right.attributes ?? {};
  const trustDifference = Number(rightAttributes.from_trusted) - Number(leftAttributes.from_trusted);
  if (trustDifference) return trustDifference;
  return Number(rightAttributes.download_count || 0) - Number(leftAttributes.download_count || 0);
}
