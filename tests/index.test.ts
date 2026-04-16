import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateEnv } from "../src";
import { loadEnv, type Plugin, type UserConfig, type ConfigEnv } from "vite";

vi.mock("vite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vite")>();
  return {
    ...actual,
    loadEnv: vi.fn().mockReturnValue({}),
  };
});

/**
 * Helper to execute the Vite config hook safely bypassing strict `this` context requirements.
 */
const runConfig = async (
  plugin: Plugin,
  config: UserConfig,
  env: ConfigEnv,
) => {
  if (typeof plugin.config === "function") {
    return plugin.config.call({} as any, config, env);
  }
};

describe("validateEnv plugin", () => {
  let originalCI: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    originalCI = process.env.CI;
    process.env.CI = "1";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCI !== undefined) process.env.CI = originalCI;
    else delete process.env.CI;
  });

  it("returns a plugin with the correct name and enforce: 'pre'", () => {
    const plugin = validateEnv({
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v: any) => ({ value: v }),
      },
    });

    expect(plugin.name).toBe("vite-plugin-validate-env");
    expect(plugin.enforce).toBe("pre");
  });

  it("validates successfully when environment variables are correct", async () => {
    const plugin = validateEnv({
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v: any) => ({ value: v }),
      },
    });

    await expect(
      runConfig(plugin, {}, { mode: "development", command: "serve" }),
    ).resolves.toEqual({ define: {} });

    expect(console.error).not.toHaveBeenCalled();
  });

  it("throws an error and logs issues when validation fails", async () => {
    const plugin = validateEnv({
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v: any) => ({
          issues: [
            { message: "API_URL is required", path: ["VITE_API_URL"] },
            { message: "Invalid type", path: [{ key: "VITE_PORT" }] },
            { message: "Root error" },
          ],
        }),
      },
    });

    await expect(
      runConfig(plugin, {}, { mode: "development", command: "serve" }),
    ).rejects.toThrow("Invalid Environment Variables");

    expect(console.error).toHaveBeenCalledWith(
      "\nInvalid Environment Variables:",
    );
    expect(console.error).toHaveBeenCalledWith(
      "   - VITE_API_URL: API_URL is required",
    );
    expect(console.error).toHaveBeenCalledWith("   - VITE_PORT: Invalid type");
    expect(console.error).toHaveBeenCalledWith("   - root: Root error");
  });

  it("loads environment variables from the correct directory", async () => {
    const plugin = validateEnv({
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v: any) => ({ value: v }),
      },
    });

    // Test with process.cwd() fallback
    await runConfig(plugin, {}, { mode: "test1", command: "serve" });
    expect(loadEnv).toHaveBeenLastCalledWith("test1", process.cwd(), "VITE_");

    // Test with userConfig.root fallback
    await runConfig(
      plugin,
      { root: "/my/root" },
      { mode: "test2", command: "serve" },
    );
    expect(loadEnv).toHaveBeenLastCalledWith("test2", "/my/root", "VITE_");

    // Test with userConfig.envDir priority
    await runConfig(
      plugin,
      { root: "/my/root", envDir: "/my/env/dir" },
      { mode: "test3", command: "serve" },
    );
    expect(loadEnv).toHaveBeenLastCalledWith("test3", "/my/env/dir", "VITE_");
  });

  it("respects the options.prefix configuration", async () => {
    const plugin = validateEnv(
      {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: (v: any) => ({ value: v }),
        },
      },
      { prefix: "VITE_" },
    );

    await runConfig(plugin, {}, { mode: "test-prefix", command: "serve" });
    expect(loadEnv).toHaveBeenLastCalledWith(
      "test-prefix",
      process.cwd(),
      "VITE_",
    );
  });

  it("returns vite defined variables for import.meta.env with transformations", async () => {
    vi.mocked(loadEnv).mockReturnValueOnce({ VITE_PORT: "8080" });

    const plugin = validateEnv({
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v: any) => ({
          value: {
            VITE_PORT: 8080,
            VITE_EXTRA: { prop: true },
            VITE_STR: "hello",
            VITE_UNDEFINED: undefined,
          },
        }),
      },
    });

    const result = await runConfig(
      plugin,
      {},
      { mode: "test", command: "serve" },
    );

    expect(result).toEqual({
      define: {
        "import.meta.env.VITE_PORT": 8080,
        "import.meta.env.VITE_EXTRA": { prop: true },
        "import.meta.env.VITE_STR": '"hello"',
      },
    });
  });
});
