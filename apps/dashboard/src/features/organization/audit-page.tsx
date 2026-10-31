import { useParams } from "react-router";
import { AuditLog } from "../audit/audit-log";

/** `/organizations/:id/settings/audit`: every entry of the organization. */
export function OrgAuditPage() {
  return <AuditLog organizationId={useParams().organizationId ?? ""} />;
}
