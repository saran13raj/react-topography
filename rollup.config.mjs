import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import filesize from "rollup-plugin-filesize";
import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";

export default [
  {
    input: "src/cli.ts",
    output: [
      {
        file: "dist/cli.js",
        format: "esm",
        sourcemap: false,
      },
    ],
    plugins: [
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist",
      }),
      filesize(),
      terser(),
    ],
  },
  {
    input: "src/generateTopography.ts",
    output: [
      {
        file: "dist/generateTopography.js",
        format: "esm",
        sourcemap: false,
      },
    ],
    plugins: [
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist",
      }),
      filesize(),
      terser(),
    ],
  },
  {
    input: "src/server.ts",
    output: [
      {
        file: "dist/server.js",
        format: "esm",
        sourcemap: false,
      },
    ],
    plugins: [
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        outDir: "dist",
      }),
      filesize(),
      terser(),

      copy({
        targets: [{ src: "src/templates", dest: "dist" }],
        // Optionally, set verbose: true to log copied files
        verbose: true,
      }),
    ],
  },
];
