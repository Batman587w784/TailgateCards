export interface CardsFilters {
  statuses: string[];
  distributors: string[];
  batchPrefixes: string[];
  createdFrom: string | null;
  createdTo: string | null;
}
