import express from "express";
import * as path from "path";

export default function startServer(outputDir: string): void {
  const app = express();
  app.use(express.static(outputDir));
  app.get("/", (_, res) => {
    // res.sendFile(path.join(outputDir, "./templates/index.html"));

    res.sendFile(path.join(outputDir, "index.html"));
  });

  const port = 4001;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
