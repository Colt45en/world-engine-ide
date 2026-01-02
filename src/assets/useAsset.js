import { useEffect, useMemo, useState } from 'react';
import { assets } from './assets';

/**
 * @param {'models'|'textures'|'audio'|'materials'|'shaders'|'config'} assetType
 * @param {string} id
 * @param {{ priority?: number, options?: any }} cfg
 */
export function useAsset(assetType, id, cfg = {}) {
  const priority = typeof cfg.priority === 'number' ? cfg.priority : 0;
  const options = cfg.options ?? {};

  const [state, setState] = useState(() => ({
    status: 'idle',
    progress: 0,
    value: null,
    error: null,
  }));

  const reqKey = useMemo(() => `${assetType}:${id}`, [assetType, id]);

  useEffect(() => {
    let alive = true;

    const rec = assets.getRecord(assetType, id);
    if (rec && rec.status === 'loaded' && rec.value != null) {
      setState({ status: 'loaded', progress: 1, value: rec.value, error: null });
      return () => {
        alive = false;
      };
    }

    setState({ status: 'loading', progress: 0, value: null, error: null });

    assets
      .request(assetType, id, priority, options)
      .then((value) => {
        if (!alive) return;
        setState({ status: 'loaded', progress: 1, value, error: null });
      })
      .catch((e) => {
        if (!alive) return;
        setState({
          status: 'error',
          progress: 0,
          value: null,
          error: String(e && e.message ? e.message : e),
        });
      });

    return () => {
      alive = false;
    };
  }, [reqKey, priority]);

  return state;
}
