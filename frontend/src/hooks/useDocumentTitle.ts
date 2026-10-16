import { useEffect } from "react";

export const useDocumentTitle = (title?: string) => {
  useEffect(() => {
    document.title = title ? `${title} · ThreatLens` : "ThreatLens | AML & Financial Crime Investigation";
  }, [title]);
};
