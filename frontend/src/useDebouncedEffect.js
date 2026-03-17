import { useEffect } from "react";

function useDebouncedEffect(effect, delay, dependencies) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      effect();
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, dependencies);
}

export { useDebouncedEffect };
