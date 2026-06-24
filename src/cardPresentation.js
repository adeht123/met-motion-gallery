const LABEL_TONE_PATTERNS = [
  ["painting", /\bpaintings?\b/],
  ["paper", /\b(prints?|drawings?|manuscripts?|codices|books?|papyrus|photographs?|paper|album|negative|ephemera)\b/],
  ["textile", /\b(textiles?|tapestr(?:y|ies)|costumes?)\b/],
  ["ceramic", /\b(ceramics?|glass|vessels?|bowls?)\b/],
  ["metal", /\b(armor|armour|weapons?|metal|metalwork|bronzes?|coins?|jewelry)\b/],
  ["object", /\b(sculptures?|statues?|statuettes?|heads?|objects?|wood|woodwork|furniture|frames?|containers?|amulets?|reliefs?|musical instruments?|architectural elements?)\b/]
];

const LABEL_ICON_BASE_PATH = "./assets/label-icons/png-256";

const LABEL_ICON_DEFINITIONS = [
  {
    slug: "textiles-painted-dyed",
    label: "Textiles-Painted and Dyed",
    pattern: /\b(textiles painted and dyed|textile fragment)\b/
  },
  {
    slug: "papyrus",
    label: "Papyrus",
    pattern: /\b(papyrus|book of the dead)\b/
  },
  {
    slug: "codices",
    label: "Codices",
    pattern: /\b(codices?|folios?)\b/
  },
  {
    slug: "textiles-tapestries",
    label: "Textiles-Tapestries",
    pattern: /\b(textiles?|tapestr(?:y|ies))\b/
  },
  {
    slug: "manuscripts-illuminations",
    label: "Manuscripts and Illuminations",
    pattern: /\b(manuscripts?|illuminations?)\b/
  },
  {
    slug: "photographs",
    label: "Photographs",
    pattern: /\b(photographs?|photo(?:graphic)?|negative|album)\b/
  },
  {
    slug: "books",
    label: "Books",
    pattern: /\bbooks?\b/
  },
  {
    slug: "ephemera",
    label: "Ephemera",
    pattern: /\bephemera\b/
  },
  {
    slug: "woodwork",
    label: "Woodwork",
    pattern: /\b(woodwork|woodwork furniture|woodwork-furniture)\b/
  },
  {
    slug: "furniture",
    label: "Furniture",
    pattern: /\bfurniture\b/
  },
  {
    slug: "jewelry",
    label: "Jewelry",
    pattern: /\b(jewelry|jewellery)\b/
  },
  {
    slug: "costume",
    label: "Costume",
    pattern: /\bcostumes?\b/
  },
  {
    slug: "armor-for-man",
    label: "Armor for Man",
    pattern: /\b(armor for man|arms and armor|armor|armour)\b/
  },
  {
    slug: "weapons",
    label: "Weapons",
    pattern: /\bweapons?|daggers?|swords?\b/
  },
  {
    slug: "musical-instruments",
    label: "Musical Instruments",
    pattern: /\bmusical instruments?\b/
  },
  {
    slug: "stone-head",
    label: "Stone Head",
    pattern: /\b(heads?|sandstone)\b/
  },
  {
    slug: "statuette",
    label: "Statuette",
    pattern: /\b(statuettes?|figurines?|figures?)\b/
  },
  {
    slug: "stone-sculpture",
    label: "Stone Sculpture",
    pattern: /\b(stone sculpture|sculptures?|statues?|marble)\b/
  },
  {
    slug: "relief",
    label: "Relief",
    pattern: /\breliefs?\b/
  },
  {
    slug: "architectural-elements",
    label: "Architectural Elements",
    pattern: /\b(architectural elements?|capitals?|columns?)\b/
  },
  {
    slug: "frames",
    label: "Frames",
    pattern: /\bframes?\b/
  },
  {
    slug: "containers",
    label: "Containers",
    pattern: /\b(containers?|lidded container)\b/
  },
  {
    slug: "amulets",
    label: "Amulets",
    pattern: /\bamulets?\b/
  },
  {
    slug: "glass",
    label: "Glass",
    pattern: /\bglass\b/
  },
  {
    slug: "vases",
    label: "Vases",
    pattern: /\bvases?\b/
  },
  {
    slug: "ceramics",
    label: "Ceramics",
    pattern: /\b(ceramics?|bowls?|vessels?)\b/
  },
  {
    slug: "enamels-cloisonne",
    label: "Enamels-Cloisonne",
    pattern: /\b(enamels?|cloisonn)\b/
  },
  {
    slug: "bronzes",
    label: "Bronzes",
    pattern: /\bbronzes?\b/
  },
  {
    slug: "coins",
    label: "Coins",
    pattern: /\b(coins?|numismatics?)\b/
  },
  {
    slug: "prints",
    label: "Prints",
    pattern: /\b(prints?|woodblock)\b/
  },
  {
    slug: "drawings",
    label: "Drawings",
    pattern: /\b(drawings?|chalk)\b/
  },
  {
    slug: "metal",
    label: "Metal",
    pattern: /\b(metal|metalwork|scientific instruments?|brass|gilt metal)\b/
  },
  {
    slug: "paintings",
    label: "Paintings",
    pattern: /\bpaintings\b/
  },
  {
    slug: "painting",
    label: "Painting",
    pattern: /\bpainting\b/
  },
  {
    slug: "object-fragment",
    label: "Object Fragment",
    pattern: /\b(object fragments?|fragments?|reliquar(?:y|ies))\b/
  },
  {
    slug: "generic-object",
    label: "Object",
    pattern: /\b(objects?|object)\b/
  }
];

function normalizeLabelToneText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ");
}

export function getCardLabelTone(work) {
  const text = [
    work?.classification,
    work?.type,
    work?.department,
    work?.medium
  ].map(normalizeLabelToneText).join(" ");

  const match = LABEL_TONE_PATTERNS.find(([, pattern]) => pattern.test(text));
  return match?.[0] || "default";
}

export function getCardLabelIcon(work) {
  if (!work) return null;

  const primaryText = [
    work.classification,
    work.type,
    work.objectName
  ].map(normalizeLabelToneText).join(" ");
  const secondaryText = [
    work.department,
    work.medium
  ].map(normalizeLabelToneText).join(" ");

  for (const text of [primaryText, secondaryText]) {
    const match = LABEL_ICON_DEFINITIONS.find((definition) => definition.pattern.test(text));
    if (match) {
      return {
        slug: match.slug,
        label: match.label,
        src: `${LABEL_ICON_BASE_PATH}/${match.slug}.png`
      };
    }
  }

  if ([primaryText, secondaryText].some((text) => text.trim())) {
    return {
      slug: "generic-object",
      label: "Object",
      src: `${LABEL_ICON_BASE_PATH}/generic-object.png`
    };
  }

  return null;
}
