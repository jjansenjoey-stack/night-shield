import { getProvider } from './dataProvider';
import type { ItemType, SavedItem } from '@/types';

export async function getUserSavedItems(userId: string): Promise<SavedItem[]> {
  const provider = await getProvider();
  return provider.getUserSavedItems(userId);
}

export async function saveItem(
  userId: string,
  itemType: ItemType,
  itemId: string,
): Promise<SavedItem> {
  const provider = await getProvider();
  return provider.saveItem(userId, itemType, itemId);
}

export async function unsaveItem(
  userId: string,
  itemType: ItemType,
  itemId: string,
): Promise<void> {
  const provider = await getProvider();
  return provider.unsaveItem(userId, itemType, itemId);
}

/** Stable key used by the store's saved-item set. */
export const savedKey = (itemType: ItemType, itemId: string) => `${itemType}:${itemId}`;
