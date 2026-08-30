import { getProvider } from './dataProvider';
import { distanceKm } from '@/lib/geo';
import type { LatLng, ThirdSpace, ThirdSpaceType } from '@/types';

export interface ThirdSpaceFilters {
  search?: string;
  types?: ThirdSpaceType[];
  accessibility?: string[];
  maxDistanceKm?: number | null;
  origin?: LatLng | null;
}

export async function getThirdSpaces(filters: ThirdSpaceFilters = {}): Promise<ThirdSpace[]> {
  const provider = await getProvider();
  const rows = await provider.getThirdSpaces();
  return applyThirdSpaceFilters(rows, filters);
}

export function applyThirdSpaceFilters(
  rows: ThirdSpace[],
  filters: ThirdSpaceFilters,
): ThirdSpace[] {
  const search = filters.search?.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.types?.length && !filters.types.includes(row.type)) return false;
    if (filters.accessibility?.length) {
      if (!filters.accessibility.every((tag) => row.accessibility.includes(tag))) return false;
    }
    if (filters.maxDistanceKm != null && filters.origin) {
      if (distanceKm(filters.origin, row.location) > filters.maxDistanceKm) return false;
    }
    if (search) {
      const haystack = [row.name, row.description, row.type, row.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export async function getThirdSpaceById(id: string): Promise<ThirdSpace | null> {
  const provider = await getProvider();
  return provider.getThirdSpaceById(id);
}

export async function createThirdSpace(
  data: Omit<ThirdSpace, 'id' | 'created_at'>,
): Promise<ThirdSpace> {
  const provider = await getProvider();
  return provider.createThirdSpace(data);
}

export async function updateThirdSpace(
  id: string,
  patch: Partial<ThirdSpace>,
): Promise<ThirdSpace> {
  const provider = await getProvider();
  return provider.updateThirdSpace(id, patch);
}
