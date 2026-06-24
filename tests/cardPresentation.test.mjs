import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getCardLabelIcon, getCardLabelTone } from "../src/cardPresentation.js";

test("getCardLabelTone maps painting classifications to painting tone", () => {
  assert.equal(getCardLabelTone({ classification: "Paintings" }), "painting");
  assert.equal(getCardLabelTone({ type: "Painting" }), "painting");
});

test("getCardLabelTone maps paper based works to paper tone", () => {
  assert.equal(getCardLabelTone({ classification: "Drawings" }), "paper");
  assert.equal(getCardLabelTone({ type: "Photograph" }), "paper");
  assert.equal(getCardLabelTone({ medium: "Ink on paper" }), "paper");
});

test("getCardLabelTone maps textile classifications to textile tone", () => {
  assert.equal(getCardLabelTone({ classification: "Textiles-Painted and Dyed" }), "textile");
  assert.equal(getCardLabelTone({ type: "Tapestry" }), "textile");
});

test("getCardLabelTone maps ceramic and glass objects to ceramic tone", () => {
  assert.equal(getCardLabelTone({ classification: "Glass" }), "ceramic");
  assert.equal(getCardLabelTone({ type: "Bowl" }), "ceramic");
});

test("getCardLabelTone maps armor and metal objects to metal tone", () => {
  assert.equal(getCardLabelTone({ department: "Arms and Armor" }), "metal");
  assert.equal(getCardLabelTone({ medium: "Gilt metal" }), "metal");
});

test("getCardLabelTone maps sculpture and object works to object tone", () => {
  assert.equal(getCardLabelTone({ classification: "Stone Sculpture" }), "object");
  assert.equal(getCardLabelTone({ type: "Furniture" }), "object");
});

test("getCardLabelTone falls back to default for unknown works", () => {
  assert.equal(getCardLabelTone({ classification: "Unmapped Future Label" }), "default");
  assert.equal(getCardLabelTone(null), "default");
});

test("getCardLabelTone maps broad generated labels", () => {
  assert.equal(getCardLabelTone({ classification: "Ephemera" }), "paper");
  assert.equal(getCardLabelTone({ classification: "Photographs" }), "paper");
  assert.equal(getCardLabelTone({ classification: "Costume" }), "textile");
  assert.equal(getCardLabelTone({ classification: "Furniture" }), "object");
  assert.equal(getCardLabelTone({ classification: "Coins" }), "metal");
});

test("getCardLabelIcon maps exact and singular painting labels", () => {
  assert.equal(getCardLabelIcon({ classification: "Paintings" }).slug, "paintings");
  assert.equal(getCardLabelIcon({ type: "Painting" }).slug, "painting");
});

test("getCardLabelIcon maps sculpture, armor, and metal labels", () => {
  assert.equal(getCardLabelIcon({ classification: "Sculpture", medium: "Marble" }).slug, "stone-sculpture");
  assert.equal(getCardLabelIcon({ department: "Arms and Armor" }).slug, "armor-for-man");
  assert.equal(getCardLabelIcon({ classification: "Scientific Instruments", medium: "Brass" }).slug, "metal");
});

test("getCardLabelIcon maps generated asset labels and source paths", () => {
  assert.deepEqual(getCardLabelIcon({ classification: "Textiles-Painted and Dyed" }), {
    slug: "textiles-painted-dyed",
    label: "Textiles-Painted and Dyed",
    src: "./assets/label-icons/png-256/textiles-painted-dyed.png"
  });
  assert.equal(getCardLabelIcon({ classification: "Textiles" }).slug, "textiles-tapestries");
  assert.equal(getCardLabelIcon({ classification: "Manuscripts" }).slug, "manuscripts-illuminations");
  assert.equal(getCardLabelIcon({ classification: "Glass" }).slug, "glass");
  assert.equal(getCardLabelIcon({ classification: "Ceramics" }).slug, "ceramics");
  assert.equal(getCardLabelIcon({ classification: "Prints", department: "Drawings and Prints" }).slug, "prints");
  assert.equal(getCardLabelIcon({ classification: "Drawings", department: "Drawings and Prints" }).slug, "drawings");
});

test("getCardLabelIcon maps observed Discover fallback labels", () => {
  assert.equal(getCardLabelIcon({ classification: "Papyrus, funerary, Book of the Dead", medium: "Papyrus, ink" }).slug, "papyrus");
  assert.equal(getCardLabelIcon({ classification: "Statuette of Taweret", medium: "Glassy faience" }).slug, "statuette");
  assert.equal(getCardLabelIcon({ classification: "Enamels-Cloisonne" }).slug, "enamels-cloisonne");
  assert.equal(getCardLabelIcon({ classification: "Enamels-CloisonnÃ©" }).slug, "enamels-cloisonne");
  assert.equal(getCardLabelIcon({ classification: "Head, Amenhotep I", medium: "Sandstone, paint" }).slug, "stone-head");
  assert.equal(getCardLabelIcon({ classification: "Frames" }).slug, "frames");
  assert.equal(getCardLabelIcon({ classification: "Container, Bes-image" }).slug, "containers");
  assert.equal(getCardLabelIcon({ classification: "Amulet, Baboon, basket, pillar" }).slug, "amulets");
  assert.equal(getCardLabelIcon({ classification: "Relief" }).slug, "relief");
  assert.equal(getCardLabelIcon({ classification: "Bronzes" }).slug, "bronzes");
  assert.equal(getCardLabelIcon({ classification: "Vase", medium: "Porcelain" }).slug, "vases");
  assert.equal(getCardLabelIcon({ classification: "Codices" }).slug, "codices");
});

test("getCardLabelIcon maps search filter and broad API labels", () => {
  assert.equal(getCardLabelIcon({ classification: "Photographs" }).slug, "photographs");
  assert.equal(getCardLabelIcon({ classification: "Furniture" }).slug, "furniture");
  assert.equal(getCardLabelIcon({ classification: "Woodwork-Furniture" }).slug, "woodwork");
  assert.equal(getCardLabelIcon({ classification: "Jewelry" }).slug, "jewelry");
  assert.equal(getCardLabelIcon({ classification: "Costume" }).slug, "costume");
  assert.equal(getCardLabelIcon({ classification: "Books" }).slug, "books");
  assert.equal(getCardLabelIcon({ classification: "Musical Instruments" }).slug, "musical-instruments");
  assert.equal(getCardLabelIcon({ classification: "Ephemera" }).slug, "ephemera");
  assert.equal(getCardLabelIcon({ classification: "Coins" }).slug, "coins");
  assert.equal(getCardLabelIcon({ classification: "Weapons" }).slug, "weapons");
  assert.equal(getCardLabelIcon({ classification: "Architectural Elements" }).slug, "architectural-elements");
});

test("getCardLabelIcon uses generic object icon instead of visible text fallback", () => {
  assert.equal(getCardLabelIcon({ classification: "Unmapped Future Label" }).slug, "generic-object");
  assert.equal(getCardLabelIcon(null), null);
});

test("label icon manifest references square generated PNG assets", async () => {
  const manifest = JSON.parse(await readFile(new URL("../assets/label-icons/manifest.json", import.meta.url), "utf8"));
  const requiredSlugs = [
    "papyrus",
    "statuette",
    "enamels-cloisonne",
    "stone-head",
    "frames",
    "containers",
    "amulets",
    "relief",
    "bronzes",
    "vases",
    "codices",
    "photographs",
    "furniture",
    "jewelry",
    "costume",
    "books",
    "musical-instruments",
    "woodwork",
    "ephemera",
    "generic-object"
  ];
  const slugs = new Set(manifest.items.map((item) => item.slug));

  assert.equal(manifest.items.length, 36);
  requiredSlugs.forEach((slug) => assert.ok(slugs.has(slug), slug));

  for (const item of manifest.items) {
    const ui = await readFile(new URL(`../${item.ui}`, import.meta.url));
    const master = await readFile(new URL(`../${item.master}`, import.meta.url));
    assert.equal(`${ui.readUInt32BE(16)}x${ui.readUInt32BE(20)}`, "256x256", item.slug);
    assert.equal(`${master.readUInt32BE(16)}x${master.readUInt32BE(20)}`, "1024x1024", item.slug);
  }
});
