export const CARD_GRID = {
  desktop: {
    mode: "desktop",
    minWidth: 1080,
    columns: 12,
    gap: 16,
    offsetScale: 0.34,
    searchOffset: 12
  },
  tablet: {
    mode: "tablet",
    minWidth: 560,
    maxWidth: 1079,
    columns: 6,
    gap: 14,
    offsetScale: 0,
    searchOffset: 0
  },
  mobile: {
    mode: "mobile",
    maxWidth: 559,
    columns: 1,
    gap: 12,
    offsetScale: 0,
    searchOffset: 0
  }
};

export const EDITORIAL_PATTERN = [
  { variant: "feature", span: 4, start: 0, offset: 0 },
  { variant: "standard", span: 3, start: 4, offset: 0 },
  { variant: "compact", span: 2, start: 7, offset: 0 },
  { variant: "standard", span: 3, start: 9, offset: 0 },
  { variant: "compact", span: 2, start: 4, offset: 4 },
  { variant: "standard", span: 3, start: 6, offset: 14 },
  { variant: "compact", span: 2, start: 9, offset: 6 },
  { variant: "compact", span: 2, start: 0, offset: 20 },
  { variant: "standard", span: 3, start: 2, offset: 8 },
  { variant: "compact", span: 2, start: 10, offset: 16 }
];

export function getCardGridConfig(galleryWidth) {
  const width = Number(galleryWidth) || 0;
  const config = width < CARD_GRID.tablet.minWidth
    ? CARD_GRID.mobile
    : width < CARD_GRID.desktop.minWidth
      ? CARD_GRID.tablet
      : CARD_GRID.desktop;
  return {
    mode: config.mode,
    columns: config.columns,
    gap: config.gap,
    offsetScale: config.offsetScale,
    searchOffset: config.searchOffset
  };
}

export function getScaledCardSpan(rawSpan, config, index, variant) {
  if (config.mode === "mobile") return 1;
  if (config.mode === "tablet") return 3;
  return Math.min(5, Math.max(2, Number(rawSpan) || 2));
}

export function getScaledCardStart(rawStart, rawSpan, computedSpan, config) {
  const start = Number(rawStart);
  if (!Number.isFinite(start) || config.mode !== "desktop") return null;
  const currentMax = Math.max(0, config.columns - computedSpan);

  const desktopMax = Math.max(0, CARD_GRID.desktop.columns - (Number(rawSpan) || 2));
  if (!desktopMax) return 0;
  return Math.min(currentMax, Math.max(0, Math.round((start / desktopMax) * currentMax)));
}
