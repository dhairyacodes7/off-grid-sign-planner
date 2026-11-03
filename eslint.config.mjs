import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain-JS physics model copied from ../Sign_Planner/model (tested there with node test_*.js)
    "src/lib/model.ts",
    "src/lib/planner.ts",
    "src/lib/parts.ts",
  ]),
]);

export default eslintConfig;
