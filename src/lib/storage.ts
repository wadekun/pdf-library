import { ReadingProgress } from "../types";

const PROGRESS_STORE_KEY = 'progressStore';
const DIRECTORY_IDS_KEY = 'directoryIds';

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


// --- Directory Handle ID Store (chrome.storage) ---

export const getDirectoryIds = async (): Promise<Record<string, string>> => {
  try {
    const result = await chrome.storage.local.get(DIRECTORY_IDS_KEY);
    return result[DIRECTORY_IDS_KEY] || {};
  } catch (e) {
    console.error("Failed to load directory IDs from chrome.storage", e);
    return {};
  }
};

export const saveDirectoryId = async (id: string, retainedId: string): Promise<void> => {
  try {
    const ids = await getDirectoryIds();
    ids[id] = retainedId;
    await chrome.storage.local.set({ [DIRECTORY_IDS_KEY]: ids });
  } catch (e) {
    console.error("Failed to save directory ID to chrome.storage", e);
  }
};

export const removeDirectoryId = async (id: string): Promise<void> => {
  try {
    const ids = await getDirectoryIds();
    delete ids[id];
    await chrome.storage.local.set({ [DIRECTORY_IDS_KEY]: ids });
  } catch (e) {
    console.error("Failed to remove directory ID from chrome.storage", e);
  }
};