import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function readProjectFile(relativePath) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Security invariant failed: ${message}`);
}

const trackedSourceFiles = execFileSync("git", ["ls-files", "src"], {
  cwd: projectRoot,
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

const browserSource = trackedSourceFiles
  .filter((file) => !file.endsWith(".server.ts") && !file.endsWith(".server.tsx"))
  .map((file) => ({ file, source: readProjectFile(file) }));

const leakedServiceRole = browserSource.find(({ source }) =>
  source.includes("SUPABASE_SERVICE_ROLE_KEY"),
);
assert(
  !leakedServiceRole,
  `service-role identifier found in browser source: ${leakedServiceRole?.file}`,
);

const serverClient = readProjectFile("src/integrations/supabase/client.server.ts");
assert(
  serverClient.includes("process.env.SUPABASE_SERVICE_ROLE_KEY"),
  "server client must resolve the service key from a server-side environment variable",
);

const reverseReceiptMigration = readProjectFile(
  "supabase/migrations/20260826010000_reverse_receipt_transaction.sql",
);
assert(
  reverseReceiptMigration.includes("SECURITY DEFINER"),
  "receipt reversal must stay transactional",
);
assert(
  reverseReceiptMigration.includes("REVOKE ALL ON FUNCTION public.reverse_receipt") &&
    reverseReceiptMigration.includes("TO authenticated"),
  "receipt reversal must remain unavailable to anonymous callers",
);

const renewContractMigration = readProjectFile(
  "supabase/migrations/20260826020000_renew_contract_transaction.sql",
);
assert(
  renewContractMigration.includes("SECURITY DEFINER"),
  "contract renewal must stay transactional",
);
assert(
  renewContractMigration.includes("REVOKE ALL ON FUNCTION public.renew_contract") &&
    renewContractMigration.includes("TO authenticated"),
  "contract renewal must remain unavailable to anonymous callers",
);

const dashboardMigration = readProjectFile(
  "supabase/migrations/20260827020000_dashboard_stats_rpc.sql",
);
assert(
  dashboardMigration.includes("p.is_active = true") &&
    dashboardMigration.includes("auth.uid() IS NULL"),
  "dashboard aggregation must reject unauthenticated or inactive accounts",
);
assert(
  dashboardMigration.includes("REVOKE ALL ON FUNCTION public.get_dashboard_stats") &&
    dashboardMigration.includes("TO authenticated"),
  "dashboard aggregation must remain unavailable to anonymous callers",
);

console.log(
  "Security guards verified: browser bundle isolation, server-only service key, and authenticated transactional RPC grants.",
);
