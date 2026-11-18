import { afterEach, vi } from "vitest";

//The API key that `utils/api.ts` reads when it makes the client. It is not a real key.
process.env.API_BIBLE_API_KEY ??= "test-api-key";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
