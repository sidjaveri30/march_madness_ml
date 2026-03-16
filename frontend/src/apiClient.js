const DEFAULT_TIMEOUT_MS = 5000;

async function fetchWithTimeout(resource, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchJson(resource, options = {}) {
  const response = await fetchWithTimeout(resource, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || options.errorMessage || "Request failed");
  }
  return payload;
}

export { DEFAULT_TIMEOUT_MS, fetchJson, fetchWithTimeout };
