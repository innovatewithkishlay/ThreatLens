import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { PageLoader } from "../components/ui/Spinner";
import { PageContainer } from "../components/layout/AppShell";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LinkButton } from "../components/ui/Button";
import { useWorkspace } from "../context/WorkspaceContext";

/** Opens a shared workspace from a link like /join/<key>. */
const JoinWorkspace = () => {
  const { key = "" } = useParams();
  const { join } = useWorkspace();
  const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    join(key)
      .then((w) => {
        toast.success(`Shared workspace opened · ${w.cases} case${w.cases === 1 ? "" : "s"}`);
        navigate("/cases", { replace: true });
      })
      .catch(setError);
  }, [key, join, navigate]);

  if (error)
    return (
      <PageContainer className="max-w-xl">
        <ErrorPanel error={error} title="Could not open workspace" />
        <LinkButton to="/" variant="secondary" className="mt-4">Go home</LinkButton>
      </PageContainer>
    );
  return <PageLoader label="Opening shared workspace" />;
};

export default JoinWorkspace;
