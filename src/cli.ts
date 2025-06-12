import { promises as fs } from "fs";
import * as path from "path";
import { Command } from "commander";
import { fileURLToPath } from "url";

import generateMindmap from "./generateMindmap";
import startServer from "./server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// npx tsx src/cli.ts -s ./test/src -o ./out

const program = new Command();

program
  .version("1.0.0")
  .description("Generate a mindmap of a React codebase")
  .option(
    "-s, --source <path>",
    "Source directory of the React codebase",
    "./src",
  )
  .option(
    "-o, --output <path>",
    "Output directory for generated files",
    "./mindmap-output",
  )
  .action(async (options: { source: string; output: string }) => {
    try {
      const srcDir = path.resolve(options.source);
      const outputDir = path.resolve(options.output);

      await fs.mkdir(outputDir, { recursive: true });

      const mindmap = await generateMindmap(srcDir);
      await fs.writeFile(
        path.join(outputDir, "mindmap.json"),
        JSON.stringify(mindmap, null, 2),
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
