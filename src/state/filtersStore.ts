import { create } from 'zustand';
import { emptyFilters, Filters } from '../lib/filters';

type FiltersState = {
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  /** Replaces all filters, so a tag on the home screen starts a fresh search. */
  replace: (filters: Partial<Filters>) => void;
  clear: () => void;
};

export const useFilters = create<FiltersState>(set => ({
  filters: emptyFilters,
  set: patch => set(s => ({ filters: { ...s.filters, ...patch } })),
  replace: filters => set({ filters: { ...emptyFilters, ...filters } }),
  clear: () => set(s => ({ filters: { ...emptyFilters, sort: s.filters.sort } })),
}));
