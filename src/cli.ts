import { promises as fs } from "fs";
import * as path from "path";
import { Command } from "commander";
import { fileURLToPath } from "url";

import generateTopography from "./generateTopography";
import startServer from "./server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// npx tsx src/cli.ts -s ./test/src

const program = new Command();

program
  .version("1.0.0")
  .description("Generate a topography of a React codebase")
  .option(
    "-s, --source <path>",
    "Source directory of the React codebase",
    "./src",
  )
  .action(async (options: { source: string; output: string }) => {
    const outputDir = path.resolve("dist/react-topography");
    try {
      const srcDir = path.resolve(options.source);

      await fs.mkdir(outputDir, { recursive: true });

      const topography = await generateTopography(srcDir);
      await fs.writeFile(
        path.join(outputDir, "topography.json"),
        JSON.stringify(topography, null, 2),
      );

      const templatePath = path.join(__dirname, "./templates/index.html");
      const outputHtmlPath = path.join(outputDir, "index.html");
      await fs.copyFile(templatePath, outputHtmlPath);

      startServer(outputDir);
    } catch (err: any) {
      process.exit(1);
    }
  });

program.parse(process.argv);
