export const CITIES = [
  { value: "douala", label: "Douala" },
  { value: "yaounde", label: "Yaoundé" },
  { value: "autre", label: "Autre" },
] as const;

export type CityValue = (typeof CITIES)[number]["value"];

export function cityLabel(v: string): string {
  return CITIES.find((c) => c.value === v)?.label ?? v;
}

export const SHIPPING_TABLE: Record<CityValue, number> = {
  douala: 2000,
  yaounde: 2500,
  autre: 3500,
};
