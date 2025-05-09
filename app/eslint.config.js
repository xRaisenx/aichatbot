import { defineConfig } from "eslint/config";

const nextPlugin = await (async () => {
  return await import('eslint-plugin-next');
})();

export default defineConfig([
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    extends: [
      'next/core-web-vitals',
      'next/typescript'
    ],
    plugins: {
      next: nextPlugin,
    },
  }
]);
