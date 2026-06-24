export const CARD_REVEAL_STEP_MS = 48;
export const CARD_REVEAL_MAX_MS = 560;
export const DETAIL_ENTRY_DURATION_MS = 340;
export const DETAIL_NAV_EXIT_MS = 80;
export const DETAIL_NAV_ENTER_DELAY_MS = 40;
export const DETAIL_NAV_ENTER_MS = 180;

const CARD_REVEAL_VARIANT_OFFSET = {
  feature: 0,
  standard: 24,
  compact: 48
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 1000) / 1000).replace(/\.0+$/, "");
}

function rectCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function isUsableRect(rect) {
  return rect
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.top)
    && Number(rect.width) > 0
    && Number(rect.height) > 0;
}

export function getCardRevealDelay(index, variant = "standard", reducedMotion = false) {
  if (reducedMotion) return 0;
  const order = Math.max(0, Number(index) || 0);
  const variantOffset = CARD_REVEAL_VARIANT_OFFSET[variant] ?? CARD_REVEAL_VARIANT_OFFSET.standard;
  return Math.min(CARD_REVEAL_MAX_MS, order * CARD_REVEAL_STEP_MS + variantOffset);
}

export function getDetailEntryKeyframes(originRect, targetRect) {
  if (!isUsableRect(originRect) || !isUsableRect(targetRect)) return null;
  const origin = rectCenter(originRect);
  const target = rectCenter(targetRect);
  const translateX = Math.round(origin.x - target.x);
  const translateY = Math.round(origin.y - target.y);
  const scaleX = clamp(originRect.width / targetRect.width, 0.18, 1.12);
  const scaleY = clamp(originRect.height / targetRect.height, 0.18, 1.12);

  return [
    {
      opacity: 0.86,
      transform: `translate(${translateX}px, ${translateY}px) scale(${formatNumber(scaleX)}, ${formatNumber(scaleY)})`
    },
    {
      opacity: 1,
      transform: "translate(0px, 0px) scale(1, 1)"
    }
  ];
}

export function getDetailNavKeyframes(direction) {
  const sign = direction === "prev" ? 1 : -1;
  const exitX = sign * 8;
  const enterX = sign * -8;

  return {
    exit: [
      { opacity: 1, transform: "translateX(0px)" },
      { opacity: 0.16, transform: `translateX(${exitX}px)` }
    ],
    enter: [
      { opacity: 0, transform: `translateX(${enterX}px)` },
      { opacity: 1, transform: "translateX(0px)" }
    ]
  };
}
