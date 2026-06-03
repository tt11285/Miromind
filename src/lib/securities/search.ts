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

/**
 * Pluggable security lookup. Swap in a live symbol provider by implementing
 * this interface and returning it from {@link getSecuritySearchProvider}.
 */
export interface SecuritySearchProvider {
  search(query: string): Promise<ListedSecurity[]>;
}

export const localDemoSecurityProvider: SecuritySearchProvider = {
  async search(query: string): Promise<ListedSecurity[]> {
    return searchListedSecurities(query);
  }
};

/**
 * Resolves the active provider. Today this is always the curated demo list,
 * but a live market-symbol provider can be selected here (e.g. from env)
 * without changing the search route or the UI.
 */
export function getSecuritySearchProvider(): SecuritySearchProvider {
  return localDemoSecurityProvider;
}
