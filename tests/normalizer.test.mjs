import test from "node:test";
import assert from "node:assert/strict";

import { normalizeMetObject } from "../src/normalizer.js";

test("normalizeMetObject keeps complete detail metadata for the drawer", () => {
  const object = normalizeMetObject({
    objectID: 823123,
    accessionNumber: "2019.229.1a-c",
    title: "Apothecary Cabinet",
    artistDisplayName: "Nicolaus I Kolb",
    objectDate: "1617-18",
    medium: "Ebonized pearwood, silk, glass",
    department: "European Sculpture and Decorative Arts",
    classification: "Woodwork-Furniture",
    GalleryNumber: "545",
    primaryImageSmall: "https://images.metmuseum.org/small.jpg",
    primaryImage: "https://images.metmuseum.org/full.jpg",
    objectURL: "https://www.metmuseum.org/art/collection/search/823123"
  });

  assert.equal(object.id, 823123);
  assert.equal(object.accessionNumber, "2019.229.1a-c");
  assert.equal(object.artist, "Nicolaus I Kolb");
  assert.equal(object.date, "1617-18");
  assert.equal(object.medium, "Ebonized pearwood, silk, glass");
  assert.equal(object.department, "European Sculpture and Decorative Arts");
  assert.equal(object.classification, "Woodwork-Furniture");
  assert.equal(object.gallery, "Gallery 545");
  assert.equal(object.image, "https://images.metmuseum.org/small.jpg");
  assert.equal(object.fullImage, "https://images.metmuseum.org/full.jpg");
  assert.equal(object.hasImage, true);
});

test("normalizeMetObject returns a usable no-image object", () => {
  const object = normalizeMetObject({
    objectID: 2,
    title: "",
    objectName: "Fragment",
    department: "Greek and Roman Art"
  });

  assert.equal(object.title, "Untitled object");
  assert.equal(object.artist, "Unknown maker");
  assert.equal(object.medium, "Fragment");
  assert.equal(object.hasImage, false);
  assert.equal(object.image, "");
});

test("normalizeMetObject strips MET title markup before display", () => {
  const object = normalizeMetObject({
    objectID: 35721,
    title: "Armor (<i>Gusoku</i>) &amp; lamellae",
    artistDisplayName: "Saotome Ietada"
  });

  assert.equal(object.title, "Armor (Gusoku) & lamellae");
  assert.equal(object.cardTitle, "Armor (Gusoku) & lamellae");
});
