import { firstFile } from "./results.js";

export async function downloadSubtitle({ item, client, http, utils }) {
  const file = firstFile(item?.data ?? item);
  if (!file?.file_id) throw new Error("Esta legenda não possui um arquivo disponível.");

  const response = await client.requestDownload(file.file_id);
  if (!isAllowedDownloadUrl(response?.link)) {
    throw new Error("O OpenSubtitles retornou um link de download inválido.");
  }

  const filename = safeFilename(response.file_name || file.file_name || `${file.file_id}.srt`);
  const destination = `@tmp/${file.file_id}-${Date.now()}-${filename}`;
  await http.download(response.link, destination);
  return [utils.resolvePath(destination)];
}

export function safeFilename(value) {
  const basename = String(value).replace(/\\/g, "/").split("/").pop() || "legenda.srt";
  const cleaned = basename.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/^\.+/, "");
  return cleaned || "legenda.srt";
}

export function isAllowedDownloadUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "opensubtitles.com" || parsed.hostname.endsWith(".opensubtitles.com"));
  } catch {
    return false;
  }
}
