import type { ListedSecurity } from "@/lib/agent/types";

export const demoSecurities: ListedSecurity[] = [
  {
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    name: "Microsoft Corporation",
    ticker: "MSFT",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    name: "Micron Technology, Inc.",
    ticker: "MU",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  },
  {
    name: "Tesla, Inc.",
    ticker: "TSLA",
    exchange: "NASDAQ",
    country: "US",
    assetType: "Equity"
  }
];

export function searchListedSecurities(query: string): ListedSecurity[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return [];
  }

  return demoSecurities
    .filter((security) => {
      const name = security.name.toLowerCase();
      const ticker = security.ticker.toLowerCase();
      return ticker.startsWith(normalized) || name.includes(normalized);
    })
    .slice(0, 8);
}
