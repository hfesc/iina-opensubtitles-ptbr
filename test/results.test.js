import assert from "node:assert/strict";
import test from "node:test";
import { describeResult, prepareResults } from "../src/results.js";

function result(fileId, downloads, trusted = false) {
  return {
    attributes: {
      release: `Release ${fileId}`,
      download_count: downloads,
      from_trusted: trusted,
      language: "pt-br",
      files: [{ file_id: fileId, file_name: `${fileId}.srt` }],
    },
  };
}

test("filters missing files, deduplicates and ranks trusted results", () => {
  const prepared = prepareResults([
    result(1, 500),
    result(2, 10, true),
    result(1, 900, true),
    { attributes: { files: [] } },
  ]);
  assert.deepEqual(prepared.map((item) => item.attributes.files[0].file_id), [2, 1]);
});

test("limits the result count", () => {
  assert.equal(prepareResults([result(1, 1), result(2, 2)], 1).length, 1);
});

test("describes a result with safe fallbacks", () => {
  assert.deepEqual(describeResult({
    data: {
      attributes: {
        download_count: 1200,
        hearing_impaired: true,
        files: [{ file_name: "Minha legenda.srt" }],
      },
    },
  }), {
    name: "Minha legenda.srt",
    left: "PT-BR",
    right: "1.200 downloads · SDH",
  });
});
