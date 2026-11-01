// Data deletion requests on the project's Data page (spec §3.1, §12; ADR 0045).
const enPrivacy = {
  "deletion.title": "Delete data",
  "deletion.intro":
    "Removes stored events and visits for good. A background job does the work in steps; reports change as it runs.",
  "deletion.kind": "Delete by",
  "deletion.kind.range": "Date range",
  "deletion.kind.visitor": "Visitor",
  "deletion.kind.user": "User ID",
  "deletion.from": "First day",
  "deletion.to": "Last day",
  "deletion.rangeHint": "Whole days in the project's time zone, both included.",
  "deletion.anonymousId": "Anonymous ID",
  "deletion.anonymousIdHint":
    "The didban_aid value from the visitor's browser storage (persistent mode only). Cookieless visitors cannot be singled out.",
  "deletion.userId": "User ID",
  "deletion.userIdHint":
    "As sent with identify. Also removes the rest of the visits it appears in.",
  "deletion.invalid.range": "Pick a first day on or before the last day.",
  "deletion.invalid.id": "Enter 1 to 128 characters.",
  "deletion.submit": "Delete data",
  "deletion.confirmTitle": "Delete this data?",
  "deletion.confirmBody":
    "This cannot be undone. Deleted events and visits are gone from every report.",
  "deletion.confirm": "Delete for good",
  "deletion.none.title": "No deletions yet",
  "deletion.none.body": "Requests and their progress show here.",
  "deletion.what": "What",
  "deletion.requested": "Requested",
  "deletion.status": "Status",
  "deletion.deleted": "Deleted",
  "deletion.visitorTarget": "One visitor",
  "deletion.counts": "{events} events · {visits} visits",
  "deletion.status.pending": "Waiting",
  "deletion.status.running": "Running",
  "deletion.status.done": "Done",
  "deletion.status.failed": "Failed",
  "error.DELETION_LIMIT_REACHED":
    "This project already has 10 open deletions. Wait for them to finish.",
} as const;

export default enPrivacy;
