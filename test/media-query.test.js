import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchParams, filenameFromPath } from "../src/media-query.js";

test("extracts a movie title and year from a local URL", () => {
  assert.deepEqual(buildSearchParams({
    url: "file:///Videos/Cidade.de.Deus.2002.1080p.mkv",
  }), {
    languages: "pt-br",
    query: "Cidade de Deus",
    year: "2002",
  });
});

test("extracts season and episode metadata", () => {
  assert.deepEqual(buildSearchParams({
    url: "/Videos/The.Bear.S02E03.720p.mkv",
  }), {
    languages: "pt-br",
    query: "The Bear",
    season_number: "2",
    episode_number: "3",
  });
});

test("uses a network title and always requests PT-BR", () => {
  assert.deepEqual(buildSearchParams({
    url: "https://example.test/stream?id=1",
    title: "Central do Brasil (1998)",
    isNetworkResource: true,
  }), {
    languages: "pt-br",
    query: "Central do Brasil",
    year: "1998",
  });
});

test("decodes local filenames and tolerates malformed encoding", () => {
  assert.equal(filenameFromPath("file:///Filmes/O%20Auto%20da%20Compadecida.mp4"), "O Auto da Compadecida.mp4");
  assert.equal(filenameFromPath("file:///Filmes/100%video.mkv"), "100%video.mkv");
});

test("returns null without usable media information", () => {
  assert.equal(buildSearchParams({}), null);
});
