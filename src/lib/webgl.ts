/**
 * Can this browser draw WebGL at all?
 *
 * Two things in the app need it: the landing page's shader and the MapLibre
 * map. A browser with hardware acceleration switched off, a blocklisted GPU,
 * or a GPU process that keeps crashing (Chrome waiting on an update does this)
 * hands back `null` from getContext — and before this check both features
 * simply showed nothing. Each now has a fallback that needs no GPU: an
 * animated CSS background, and a Leaflet map on the same Esri tiles.
 *
 * MapLibre 3 no longer ships `maplibregl.supported()`, so this asks the same
 * question it used to: can a canvas give us a webgl2 or webgl context? It is
 * answered once and cached, and the probe context is released straight away
 * so it does not count against the browser's limit on live contexts.
 *
 * TESTING THE FALLBACKS on a machine where WebGL works:
 *
 *   - add `?nowebgl=1` to any URL. It is remembered for the tab (in
 *     sessionStorage), so it survives navigating from the landing page to
 *     /discover. `?nowebgl=0` switches it back off.
 *   - or, to keep it across tabs and restarts, run
 *     `localStorage.setItem('ns-nowebgl', '1')` in the console, and
 *     `localStorage.removeItem('ns-nowebgl')` to undo it.
 *   - or launch Chrome with `--disable-webgl --disable-3d-apis`, which is the
 *     closest thing to the real failure.
 *
 * These switches are for testing only; nothing in the UI sets them.
 */

const FLAG = 'ns-nowebgl';

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value == null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    /* private mode or blocked storage — the query string still works once */
  }
}

/** True when a tester has asked for the no-WebGL path. */
export function webglForcedOff(): boolean {
  if (typeof window === 'undefined') return false;

  const param = new URLSearchParams(window.location.search).get('nowebgl');
  if (param === '1' || param === 'true') {
    safeSet(() => window.sessionStorage, FLAG, '1');
    return true;
  }
  if (param === '0' || param === 'false') {
    safeSet(() => window.sessionStorage, FLAG, null);
    return false;
  }

  return (
    safeGet(() => window.sessionStorage, FLAG) === '1' ||
    safeGet(() => window.localStorage, FLAG) === '1'
  );
}

let cached: boolean | null = null;

function probe(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) return false;
    // A context that is born lost is no better than none.
    if (gl.isContextLost()) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Whether WebGL is usable here, honouring the testing switch above. */
export function webglAvailable(): boolean {
  if (webglForcedOff()) return false;
  if (cached == null) cached = probe();
  return cached;
}

/**
 * Remember that WebGL failed after all — a map that threw on creation or lost
 * its context — so the next map mounted in this tab goes straight to the
 * fallback instead of failing the same way first.
 */
export function markWebglBroken() {
  cached = false;
}

/** True for the errors MapLibre raises when it cannot get or keep a context. */
export function isWebglError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /webgl|context lost|failed to initialize/i.test(message);
}
