import { fetchJson } from "../apiClient";
import { buildOfficialBracketView } from "./liveBracketEngine";
import { createMockLiveProvider } from "./mockLiveProvider";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function createEspnLiveProvider({
  apiUrl = API_URL,
  fetchLiveScoreboard = (provider) => fetchJson(`${apiUrl}/live-scoreboard?provider=${provider}`, { timeoutMs: 8000, errorMessage: "Could not load live scoreboard." }),
  fallbackProvider = createMockLiveProvider(),
} = {}) {
  return {
    mode: "espn",
    pollIntervalMs: 30000,
    getInitialCursor() {
      return 0;
    },
    canAdvance() {
      return false;
    },
    getNextCursor(cursor) {
      return cursor;
    },
    getResetCursor() {
      return 0;
    },
    async getView({ definition }) {
      try {
        const payload = await fetchLiveScoreboard("espn");
        return buildOfficialBracketView({
          definition,
          games: payload.games || [],
          id: `espn-feed-${payload.fetchedAt || "live"}`,
          label: "Official Live Feed",
          meta: {
            sourceLabel: payload.fallbackProvider ? `ESPN fallback via ${payload.fallbackProvider}` : "ESPN provider",
            modeLabel: "Provider-backed feed",
            updatedAtLabel: payload.fetchedAt ? `Updated ${new Date(payload.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "",
            helperText: payload.error
              ? `Official provider was unavailable, so the feed fell back to mock data. ${payload.error}`
              : "Official schedule and scoring feed mode is enabled. User bracket entries remain separate from this official bracket.",
          },
        });
      } catch (error) {
        const fallbackView = await fallbackProvider.getView({ cursor: fallbackProvider.getInitialCursor(), definition });
        return {
          ...fallbackView,
          meta: {
            ...fallbackView.meta,
            sourceLabel: "Mock provider",
            modeLabel: "Fallback mock feed",
            helperText: `Official provider request failed, so mock mode is being used instead. ${error.message}`,
          },
        };
      }
    },
  };
}

export { createEspnLiveProvider };
