import assert from "node:assert/strict";
import test from "node:test";
import { downloadSubtitle, isAllowedDownloadUrl, safeFilename } from "../src/download.js";

test("sanitizes traversal and unsafe filename characters", () => {
  assert.equal(safeFilename("../../minha:legenda?.srt"), "minha_legenda_.srt");
  assert.equal(safeFilename(".."), "legenda.srt");
});

test("accepts only HTTPS OpenSubtitles download hosts", () => {
  assert.equal(isAllowedDownloadUrl("https://dl.opensubtitles.com/file.srt"), true);
  assert.equal(isAllowedDownloadUrl("http://dl.opensubtitles.com/file.srt"), false);
  assert.equal(isAllowedDownloadUrl("https://opensubtitles.com.evil.test/file"), false);
});

test("downloads to @tmp and returns a resolved path", async () => {
  let download;
  const paths = await downloadSubtitle({
    item: { data: { attributes: { files: [{ file_id: 42, file_name: "release.srt" }] } } },
    client: {
      async requestDownload() {
        return { link: "https://dl.opensubtitles.com/sub.srt", file_name: "../../subtitle.srt" };
      },
    },
    http: {
      async download(url, destination) {
        download = { url, destination };
      },
    },
    utils: { resolvePath: (path) => `/resolved/${path}` },
  });

  assert.equal(download.url, "https://dl.opensubtitles.com/sub.srt");
  assert.match(download.destination, /^@tmp\/42-\d+-subtitle\.srt$/);
  assert.deepEqual(paths, [`/resolved/${download.destination}`]);
});

test("rejects items without downloadable files", async () => {
  await assert.rejects(
    () => downloadSubtitle({ item: {}, client: {}, http: {}, utils: {} }),
    /não possui um arquivo/,
  );
});
