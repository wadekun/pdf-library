import { ReadingProgress } from "../types";
import * as idb from './indexedDB';

const PROGRESS_STORE_KEY = 'progressStore';

// --- Reading Progress Store (chrome.storage) ---

export const getProgressStore = async (): Promise<Record<string, ReadingProgress>> => {
  try {
    const result = await chrome.storage.local.get(PROGRESS_STORE_KEY);
    return result[PROGRESS_STORE_KEY] || {};
  } catch (e) {
    console.error("Failed to load progress from chrome.storage", e);
    return {};
  }
};

export const saveProgressStore = async (data: Record<string, ReadingProgress>): Promise<void> => {
  try {
    await chrome.storage.local.set({ [PROGRESS_STORE_KEY]: data });
  } catch (e) {
    console.error("Failed to save progress to chrome.storage", e);
  }
};

// --- Directory Handle Store (IndexedDB) ---

export const getDirectoryHandles = async (): Promise<[string, FileSystemDirectoryHandle][]> => {
    const handleKeys = await idb.keys();
    const handles: [string, FileSystemDirectoryHandle][] = [];
    for (const key of handleKeys) {
        const handle = await idb.get<FileSystemDirectoryHandle>(key);
        if (handle) {
            handles.push([key as string, handle]);
        }
    }
    return handles;
};

export const saveDirectoryHandle = async (id: string, handle: FileSystemDirectoryHandle): Promise<void> => {
  await idb.set(id, handle);
};

export const removeDirectoryHandle = async (id: string): Promise<void> => {
  await idb.del(id);
};