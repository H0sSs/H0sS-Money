import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1, gcTime: 300000 } } });
export function refreshFinance() { return queryClient.invalidateQueries(); }
