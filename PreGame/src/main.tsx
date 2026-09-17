// rundot-import:sdk-init:begin
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
try {
  await RundotGameAPI.initializeAsync();
} catch {
  // Boot continues even if SDK init fails.
}
// rundot-import:sdk-init:end

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./powerups.css";
import "./layout.css";
import "./kit.css";
import App from "./App";
import { preloadStorage } from "./game/storage";

await preloadStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
