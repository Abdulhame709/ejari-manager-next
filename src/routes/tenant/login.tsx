import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/tenant/login")({
  component: () => <RedirectToMainLogin />,
});
// Tenant login is unified with the main /login page; we redirect to /login?mode=tenant.
import { Navigate } from "@tanstack/react-router";
function RedirectToMainLogin() {
  return <Navigate to="/login" search={{ mode: "tenant" }} />;
}
