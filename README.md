# vite-validate-env

<p>
  <a href="https://github.com/handtrix/vite-validate-env/actions/workflows/ci.yml"><img src="https://github.com/handtrix/vite-validate-env/actions/workflows/ci.yml/badge.svg?branch=main" alt="build status"></a>
</p>

A Vite plugin to validate your environment variables using any standard schema library (Zod, Valibot, ArkType, etc.). It uses [`@standard-schema/spec`](https://github.com/standard-schema/standard-schema) under the hood to ensure full library-agnostic compatibility.

✨ **Features**

- 🛡️ **Fail-Safe Validation:** Validates environment variables at build & dev-time.
- ⚙️ **Agnostic:** Works with Zod, Valibot, ArkType, or any Standard Schema.
- 🛑 **Fails Fast:** Enforced pre-resolution execution halts the Vite process immediately with helpful error output.
- 🪶 **Zero Configuration:** Seamlessly respects your existing Vite `envDir` and `root` settings.
- 📝 **Ecosystem Binding:** Propagates schema defaults and data transformations directly back into `process.env`.
- 📦 **Lightweight:** Zero dependencies.

## Installation

```bash
npm install vite-validate-env -D
# Ensure you have your favorite schema library installed, e.g. zod
npm install zod
```

## Usage

First create an env schema. You can use any schema library that implements the standard [@standard-schema/spec](https://github.com/standard-schema/standard-schema) ([zod](https://zod.dev/), [valibot](https://valibot.dev/), [ArkType](https://arktype.io/), etc).

**File:** `src/env.ts`

```ts
import { z } from "zod";

export const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_APP_NAME: z.string().min(1),
});

declare global {
  interface ImportMetaEnv extends z.infer<typeof envSchema> {}
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
```

Then use it in your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { validateEnv } from "vite-validate-env";
import { envSchema } from "./src/env";

export default defineConfig({
  plugins: [
    validateEnv(envSchema, {
      // Optional: limit extraction to specific prefixes
      // prefix: "VITE_"
    }),
  ],
});
```

## How it works

The plugin hooks directly into Vite's `config` resolution step. It accurately loads the environment variables for your current `mode` (respecting Vite's native `envDir` and `root` configurations), and validates them against the schema you provide.

If any environment variables are mismatched or missing, the plugin will seamlessly intercept the build or dev server, print clear and pinpointed error paths directly in your console, and halt the Vite process via standard errors so your development experience remains tight and predictable.

Additionally, because we return evaluated values post-schema matching, any transformation values or default inputs automatically cascade down onto `process.env`.

## Gotchas & Behavior

- **Validation Prefix:** By default, the plugin specifically looks for the `VITE_` prefix (or whatever your Vite `envPrefix` configuration is set to) and applies schema matching exclusively to those bounds. If you want to expand schema validation to capture all OS-level environment factors, you must explicitly declare `{ prefix: "" }` in the plugin options.

## License

MIT
