import express from "express";
import * as path from "path";
import { exec } from "child_process";

export default function startServer(outputDir: string): void {
  const app = express();
  app.use(express.static(outputDir));
  app.get("/", (_, res) => {
    // res.sendFile(path.join(outputDir, "./templates/index.html"));

    res.sendFile(path.join(outputDir, "index.html"));
  });

  const port = 4001;
  const server = app.listen(port, () => {
    console.log(`React topography server running at http://localhost:${port}`);

    // Open the browser (cross-platform)
    const url = `http://localhost:${port}`;
    let openCmd = "";
    if (process.platform === "win32") {
      openCmd = `start ${url}`;
    } else if (process.platform === "darwin") {
      openCmd = `open ${url}`;
    } else {
      openCmd = `xdg-open ${url}`;
    }

    exec(openCmd, (err) => {
      if (err) {
        console.error("Failed to open browser:", err.message);
      }
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use. Server could not start.`,
        );
      } else {
        console.error("Server failed to start:", err.message);
      }
      process.exit(1);
    });

    // Catch any uncaught exceptions
    process.on("uncaughtException", (err) => {
      console.error("Uncaught exception:", err);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled promise rejection:", reason);
      process.exit(1);
    });
  });
}
