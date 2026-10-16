import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { api } from "../lib/api";

export const SAMPLE_A = "/samples/sample-case-a.csv";
export const SAMPLE_B = "/samples/sample-case-b.csv";

export const fetchSample = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the sample file.");
  const blob = await res.blob();
  return new File([blob], url.split("/").pop() || "sample.csv", { type: "text/csv" });
};

/** Upload the bundled demo data and open the result. */
export const useDemoCase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"single" | "pair" | null>(null);

  const runSingle = async () => {
    setLoading("single");
    try {
      const file = await fetchSample(SAMPLE_A);
      const res = await api.uploadCase(file, { name: "Demo - Layering ring" });
      toast.success("Demo case analysed");
      navigate(`/cases/${res.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setLoading(null);
    }
  };

  const runPair = async () => {
    setLoading("pair");
    try {
      const files = await Promise.all([fetchSample(SAMPLE_A), fetchSample(SAMPLE_B)]);
      const res = await api.uploadPair([files[0], files[1]]);
      toast.success("Demo cases linked");
      navigate(`/compare/${res.caseA}/${res.caseB}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setLoading(null);
    }
  };

  return { loading, runSingle, runPair };
};
