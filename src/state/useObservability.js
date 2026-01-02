import { useMemo } from 'react';
import { useMathRouter } from '../math-router/MathRouter';

export function useObservability() {
  const { observability, delivery } = useMathRouter();

  return useMemo(() => {
    return {
      observability,
      delivery,
    };
  }, [observability, delivery]);
}
