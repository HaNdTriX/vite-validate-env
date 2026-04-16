import { type Plugin, loadEnv } from "vite";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface ValidateEnvOptions {
  /**
   * The prefix(es) to use when loading environment variables for validation.
   * Defaults to Vite's `envPrefix` configuration, or `"VITE_"`.
   */
  prefix?: string | string[];
}

export function validateEnv<
  T extends StandardSchemaV1<Record<string, unknown>, unknown>,
>(schema: T, options?: ValidateEnvOptions): Plugin {
  return {
    name: "vite-plugin-validate-env",
    enforce: "pre",
    async config(userConfig, { mode }) {
      // Load environment variables for the current mode
      const envDir = userConfig.envDir || userConfig.root || process.cwd();
      const rawEnv = loadEnv(
        mode,
        envDir,
        options?.prefix ?? userConfig.envPrefix ?? "VITE_",
      );

      const result = await schema["~standard"].validate(rawEnv);

      if (result.issues) {
        const isCI = process.env.CI;
        const c = {
          red: (s: string) => (isCI ? s : `\x1b[31m${s}\x1b[0m`),
          redBold: (s: string) => (isCI ? s : `\x1b[31;1m${s}\x1b[0m`),
          cyanBold: (s: string) => (isCI ? s : `\x1b[36;1m${s}\x1b[0m`),
          yellow: (s: string) => (isCI ? s : `\x1b[33m${s}\x1b[0m`),
        };

        console.error(`\n${c.redBold("Invalid Environment Variables:")}`);

        for (const issue of result.issues) {
          const path = issue.path
            ? issue.path
                .map((p) => (typeof p === "object" ? p.key : p))
                .join(".")
            : "root";
          console.error(
            `   ${c.red("-")} ${c.cyanBold(path)}: ${c.yellow(issue.message)}`,
          );
        }

        console.error("\n");
        const error = new Error("Invalid Environment Variables");
        error.stack = "- vite-plugin-validate-env";
        throw error;
      }

      if (!result.value) return;

      const env = Object.entries(result.value).filter(
        ([, value]) => value !== undefined,
      );

      return {
        define: Object.fromEntries(
          env.map(([key, value]) => [
            `import.meta.env.${key}`,
            typeof value === "string" ? JSON.stringify(value) : value,
          ]),
        ),
      };
    },
  };
}
