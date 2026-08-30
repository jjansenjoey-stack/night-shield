import { getProvider } from './dataProvider';
import { distanceKm } from '@/lib/geo';
import type { Installation, LatLng } from '@/types';

export interface InstallationFilters {
  search?: string;
  category?: string | null;
  accessibility?: string[];
  maxDistanceKm?: number | null;
  origin?: LatLng | null;
  includeTemporary?: boolean;
}

export async function getInstallations(
  filters: InstallationFilters = {},
): Promise<Installation[]> {
  const provider = await getProvider();
  const rows = await provider.getInstallations();
  return applyInstallationFilters(rows, filters);
}

export function applyInstallationFilters(
  rows: Installation[],
  filters: InstallationFilters,
): Installation[] {
  const search = filters.search?.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.includeTemporary === false && row.is_temporary) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.accessibility?.length) {
      if (!filters.accessibility.every((tag) => row.accessibility.includes(tag))) return false;
    }
    if (filters.maxDistanceKm != null && filters.origin) {
      if (distanceKm(filters.origin, row.location) > filters.maxDistanceKm) return false;
    }
    if (search) {
      const haystack = [row.title, row.artist, row.description, row.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export async function getInstallationById(id: string): Promise<Installation | null> {
  const provider = await getProvider();
  return provider.getInstallationById(id);
}

export async function createInstallation(
  data: Omit<Installation, 'id' | 'created_at'>,
): Promise<Installation> {
  const provider = await getProvider();
  return provider.createInstallation(data);
}

export async function updateInstallation(
  id: string,
  patch: Partial<Installation>,
): Promise<Installation> {
  const provider = await getProvider();
  return provider.updateInstallation(id, patch);
}

export async function deleteInstallation(id: string): Promise<void> {
  const provider = await getProvider();
  return provider.deleteInstallation(id);
}
