import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import filesize from "rollup-plugin-filesize";
import terser from "@rollup/plugin-terser";

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.min.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [commonjs(), typescript(), filesize(), terser()],
  },
];
