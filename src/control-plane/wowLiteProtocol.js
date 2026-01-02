/**
 * WoW-Lite Host Protocol Helpers
 *
 * Purpose:
 * - Centralize postMessage origin checks + target origin selection
 * - Centralize schema/version and message shape checks (host side)
 *
 * This is host-side only (Vite/React). The iframe runtime lives in public/tools/wow-lite.html.
 */

export const WOW_LITE_SCHEMA_VERSION = 1;

export const WOW_LITE_TYPES = /** @type {const} */ ({
  READY: 'WOW_LITE/READY',
  STATUS: 'WOW_LITE/STATUS',
  TELEMETRY: 'WOW_LITE/TELEMETRY',
  APPLIED: 'WOW_LITE/APPLIED',
  REJECTED: 'WOW_LITE/REJECTED',
  CONFIG: 'WOW_LITE/CONFIG',
  DEBUG_SET: 'WOW_LITE/DEBUG_SET',
  STABLE_STATS: 'WOW_LITE/STABLE_STATS',
  TUNER_SET: 'WOW_LITE/TUNER_SET',
  ASSET_TEXTURE_SET: 'WOW_LITE/ASSET_TEXTURE_SET',
  ASSET_TEXTURE_APPLIED: 'WOW_LITE/ASSET_TEXTURE_APPLIED',
  ASSET_TEXTURE_REJECTED: 'WOW_LITE/ASSET_TEXTURE_REJECTED',
  EDITOR_PLACE_REQUEST: 'WOW_LITE/EDITOR_PLACE_REQUEST',
  ENTITY_UPSERT: 'WOW_LITE/ENTITY_UPSERT',
  ENTITY_REMOVE: 'WOW_LITE/ENTITY_REMOVE',
});

function safeUrlOrigin(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return new URL(raw, globalThis.location.href).origin;
  } catch {
    return null;
  }
}

/**
 * Return the expected origin for postMessage targetOrigin based on iframe src.
 * Falls back to window origin.
 *
 * @param {any} iframeRef
 */
export function getWowLiteTargetOrigin(iframeRef) {
  const src =
    iframeRef && iframeRef.current && typeof iframeRef.current.src === 'string'
      ? iframeRef.current.src
      : '';
  return safeUrlOrigin(src) || globalThis.location.origin;
}

/**
 * Return an allowlist of origins we accept messages from (iframe -> host).
 *
 * @param {any} iframeRef
 */
export function getWowLiteAllowedOrigins(iframeRef) {
  const out = new Set();
  out.add(globalThis.location.origin);

  const src =
    iframeRef && iframeRef.current && typeof iframeRef.current.src === 'string'
      ? iframeRef.current.src
      : '';
  const iframeOrigin = safeUrlOrigin(src);
  if (iframeOrigin) out.add(iframeOrigin);

  return Array.from(out);
}

/**
 * Parse and validate a message coming from the WoW-Lite iframe.
 *
 * - Ensures source window matches
 * - Ensures origin matches allowlist (host origin or iframe src origin)
 * - Ensures msg.type is a string
 *
 * NOTE: schemaVersion enforcement is done by callers (some messages historically omitted it).
 *
 * @param {MessageEvent} event
 * @param {any} iframeRef
 */
export function parseWowLiteMessageFromIframe(event, iframeRef) {
  const iframeWin =
    iframeRef && iframeRef.current && iframeRef.current.contentWindow
      ? iframeRef.current.contentWindow
      : null;
  if (!iframeWin) return null;
  if (event.source !== iframeWin) return null;

  const allowedOrigins = getWowLiteAllowedOrigins(iframeRef);
  if (!allowedOrigins.includes(event.origin)) return null;

  const msg = event.data;
  if (!msg || typeof msg !== 'object') return null;
  if (typeof msg.type !== 'string') return null;

  return msg;
}
