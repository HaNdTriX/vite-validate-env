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
        console.error("\n❌ Invalid Environment Variables:");

        for (const issue of result.issues) {
          const path = issue.path
            ? issue.path
                .map((p) => (typeof p === "object" ? p.key : p))
                .join(".")
            : "root";
          console.error(`   - ${path}: ${issue.message}`);
        }

        console.error("\n");
        const error = new Error("Invalid Environment Variables");
        error.stack = "- vite-plugin-validate-env";
        throw error;
      }

      // Inject validated and transformed values back into process.env
      if (result.value) {
        for (const [key, value] of Object.entries(result.value)) {
          if (value !== undefined) {
            process.env[key] =
              typeof value === "string" ? value : JSON.stringify(value);
          }
        }
      }
    },
  };
}
