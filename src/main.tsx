// First: a RUN build is served from a subdirectory, and root paths to the game's own files are rebased
// before any module loads art.
import "./platform/install-asset-base";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { bootPlatform } from "./platform/platform";
import { loadShippedCourses } from "./game/shipped-courses";
// The host comes first: on RUN.world the saves live in the player's cloud storage, which is put in place
// of localStorage before the first render reads any save. (App is imported statically: the single-file
// build inlines dynamic imports, and module code reads no saves at load.)
void bootPlatform().then(async () => {
  // The owner's published island (tracks, ground paint, lanes, sky): what a new player races on.
  await loadShippedCourses();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
