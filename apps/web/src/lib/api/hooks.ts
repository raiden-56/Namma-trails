"use client";

import { useQuery } from "@tanstack/react-query";
import { market } from "./marketplace";
import type { ServiceCategoryKey } from "@/lib/catalog";

export interface ServiceSearchParams {
  destination?: string;
  categories?: ServiceCategoryKey[];
  q?: string;
  guests?: number;
  minPricePaise?: number;
  maxPricePaise?: number;
  minRating?: number;
  /** relevance | price_asc | price_desc | rating | newest */
  sort?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Live, published inventory (GET /search/services).
 * Never substituted with placeholder listings: callers render loading, error and empty states.
 */
export function useServices(params: ServiceSearchParams) {
  return useQuery({
    queryKey: ["services", params],
    queryFn: () => market.search({ ...params, categories: params.categories?.join(",") || undefined }),
  });
}
