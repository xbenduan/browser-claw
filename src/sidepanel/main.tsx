import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/i18n";
import SidePanelApp from "./App";
import "../popup/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <SidePanelApp />
    </I18nProvider>
  </StrictMode>,
);
