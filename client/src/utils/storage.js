/**
 * Offline & Local Snapshot Persistence Utility
 */

const STORAGE_PREFIX = 'boardcollab_cache_';

export const saveRoomCache = (roomId, elements) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${roomId}`, JSON.stringify({
      timestamp: Date.now(),
      elements
    }));
  } catch (err) {
    console.warn('Could not cache canvas locally:', err);
  }
};

export const loadRoomCache = (roomId) => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearRoomCache = (roomId) => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${roomId}`);
  } catch {
    // Ignored
  }
};
