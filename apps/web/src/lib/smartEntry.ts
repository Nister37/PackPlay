export interface ParsedSmartItem {
  name: string;
  quantity: number;
  category?: string;
  target: 'SHARED' | 'PERSONAL';
  isMandatory: boolean;
  reason?: string;
}

const CATEGORY_KEYWORDS: Record<string, string> = {
  ball: 'BALLS',
  soccer: 'EQUIPMENT',
  bib: 'APPAREL',
  jersey: 'APPAREL',
  shirt: 'APPAREL',
  short: 'APPAREL',
  sock: 'APPAREL',
  glove: 'PROTECTION',
  guard: 'PROTECTION',
  helmet: 'PROTECTION',
  pad: 'PROTECTION',
  whistle: 'OFFICIATING',
  card: 'OFFICIATING',
  cone: 'TRAINING',
  ladder: 'TRAINING',
  hurdle: 'TRAINING',
  tape: 'MEDICAL',
  bandage: 'MEDICAL',
  kit: 'MEDICAL',
  water: 'HYDRATION',
  bottle: 'HYDRATION',
  cooler: 'HYDRATION',
};

export function parseNaturalLanguageGearList(input: string): ParsedSmartItem[] {
  if (!input || !input.trim()) return [];

  // Split by newlines, commas, semicolons, or "and"
  const rawSegments = input
    .split(/\n|,|;|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const items: ParsedSmartItem[] = [];

  for (const segment of rawSegments) {
    // Match optional quantity at start (e.g. "2x", "3", "4 pairs of", "a pair of")
    const qtyMatch = segment.match(
      /^(?:(?:(\d+)\s*(?:x|×|pcs|pairs?)?\s*(?:of\s+)?)|(?:a\s+pair\s+of\s+))/i,
    );
    let quantity = 1;
    let name = segment;

    if (qtyMatch) {
      if (qtyMatch[1]) {
        quantity = Math.max(1, parseInt(qtyMatch[1], 10));
      } else if (segment.toLowerCase().startsWith('a pair of')) {
        quantity = 1;
      }
      name = segment.slice(qtyMatch[0].length).trim();
    }

    // Clean name
    name = name.replace(/^(the|a|an|of)\s+/i, '').trim();
    if (!name) continue;

    // Detect category
    const lowerName = name.toLowerCase();
    let category = 'EQUIPMENT';
    for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
      if (lowerName.includes(kw)) {
        category = cat;
        break;
      }
    }

    // Capitalize first letter of name
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    items.push({
      name: formattedName,
      quantity,
      category,
      target: 'SHARED',
      isMandatory: true,
      reason: 'Smart Entry auto-parsed',
    });
  }

  return items;
}
