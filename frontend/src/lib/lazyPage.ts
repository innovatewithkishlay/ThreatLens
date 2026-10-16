import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "tl_chunk_reload";

export const isChunkLoadError = (err: unknown) => {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Failed to fetch|preload/i.test(msg);
};

/** Reload the page once to pick up fresh assets; returns false if we already tried. */
export const reloadOnce = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* storage unavailable - still try once */
  }
  window.location.reload();
  return true;
};

/**
 * React.lazy with recovery: if a page's code can't be loaded (for example
 * after a new deploy replaced the old files), reload the page once instead of
 * leaving a blank screen.
 */
export const lazyPage = <T extends ComponentType<object>>(factory: () => Promise<{ default: T }>) =>
  lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && reloadOnce()) {
        return new Promise<{ default: T }>(() => {}); // page is reloading
      }
      throw err;
    })
  );
