
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { ReferenceDocumentProvider } from "./app/domain/referenceDocuments";
  import { ProtocolImportProvider } from "./app/domain/protocol/import/ProtocolImportContext";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <ReferenceDocumentProvider>
      <ProtocolImportProvider>
        <App />
      </ProtocolImportProvider>
    </ReferenceDocumentProvider>,
  );
  