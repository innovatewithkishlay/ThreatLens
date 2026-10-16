import { Link } from "react-router-dom";
import { LegalPage } from "../components/layout/LegalPage";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PrivacyPolicy = () => {
  useDocumentTitle("Privacy policy");
  return (
    <LegalPage title="Privacy policy" updated="October 2026">
      <h2>Overview</h2>
      <p>
        ThreatLens is an open-source investigation tool. We collect the minimum data needed to run it and never sell or share your data with third parties for
        advertising.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> - if you sign in with Google: your name, email address and profile picture.</li>
        <li><strong>Case data</strong> - the transaction files you upload, stored as structured records so you can revisit your investigations.</li>
        <li><strong>Essential cookies</strong> - a session token and an anonymous workspace identifier. See the <Link to="/cookie-policy">cookie policy</Link>.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run the analysis you request and display the results.</li>
        <li>To keep your cases private to you (or to your browser, if you are not signed in).</li>
        <li>To protect the service against abuse, e.g. through rate limiting.</li>
      </ul>
      <h2>Uploaded files</h2>
      <p>
        Files are processed in memory and are not written to disk. Parsed transactions are stored in the database and are only accessible to the workspace that
        created them. Deleting a case permanently removes its transactions and accounts.
      </p>
      <h2>Your rights</h2>
      <ul>
        <li>Access the data we hold about you - every case can be exported as CSV or JSON.</li>
        <li>Delete any case at any time from the case workspace.</li>
        <li>Request deletion of your account by contacting us.</li>
      </ul>
      <h2>Self-hosting</h2>
      <p>If you run your own instance of ThreatLens, you are the data controller for that instance and this policy serves only as a template.</p>
      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:kishlay141@gmail.com">kishlay141@gmail.com</a>.</p>
    </LegalPage>
  );
};

export default PrivacyPolicy;
