import { type SaveStore } from "@broadside/persistence";

/**
 * Save slots in the WebView's local storage (it survives app restarts in the APK; Ports and
 * Adapters: the game only sees SaveStore). Any storage error reads as an empty slot.
 */
export const localSaveStore = (): SaveStore => ({
  read: async (slot) => {
    try {
      return localStorage.getItem(`broadside.save.${slot}`);
    } catch {
      return null;
    }
  },
  write: async (slot, text) => {
    try {
      localStorage.setItem(`broadside.save.${slot}`, text);
    } catch {
      // Full or blocked storage: the game goes on without the save.
    }
  },
});
