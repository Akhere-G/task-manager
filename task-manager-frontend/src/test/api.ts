import MockAdapter from "axios-mock-adapter";
import { afterAll, afterEach, beforeEach, vi } from "vitest";
import apiClient from "../services/api";

/**
 * Replaces the network for the calling test file: every request goes to the returned
 * adapter, which is cleared between tests. Expected failures are logged with
 * console.error, so it is silenced unless `quiet` is false.
 */
export function mockApi({ quiet = true }: { quiet?: boolean } = {}) {
  const mock = new MockAdapter(apiClient);
  beforeEach(() => {
    if (quiet) vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    mock.reset();
  });
  afterAll(() => {
    mock.restore();
  });
  return mock;
}
