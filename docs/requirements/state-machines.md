# State-machine catalogue

Source of truth: PRD Appendix A. Every state below is a protected code (`UPPER_SNAKE_CASE`), localized at
display only. Companies may add intermediate display states mapped to a protected category; they may not
remove or redefine one.

Each machine is implemented as a declared transition table in its owning domain, and a unit test asserts
that no code path performs a transition the table does not contain.

| Aggregate | Owner domain | States |
|---|---|---|
| Company | foundation | DRAFT, UNDER_REVIEW, ACTIVE_ONBOARDING, ACTIVE, READ_ONLY_GRACE, LOCKED, DELETION_ELIGIBLE, DELETING, DELETED |
| CompanyVerification | network | UNVERIFIED, UNDER_REVIEW, VERIFIED, SUSPENDED |
| Account | identity | INVITED, ACTIVE, DISABLED |
| CompanyMembership | organization | PENDING, ACTIVE, SUSPENDED, ENDED |
| ProjectMembership | projects | SCHEDULED, ACTIVE, ENDED |
| ExternalAccess | network | INVITED, ACTIVE, REVOKED, EXPIRED |
| Project | projects | PROVISIONING, DRAFT, ACTIVE, ON_HOLD, CLOSED, ARCHIVED |
| WorkItem | tasks | DRAFT, READY, IN_PROGRESS, BLOCKED, IN_REVIEW, COMPLETED, CANCELLED |
| DocumentRevision | documents | DRAFT, IN_REVIEW, APPROVED, ISSUED, SUPERSEDED, ARCHIVED |
| Rfi | design-control | DRAFT, OPEN, ANSWERED, CLOSED, OVERDUE |
| Submittal | design-control | DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, APPROVED_AS_NOTED, REVISE_AND_RESUBMIT, REJECTED |
| Contract | contracts | DRAFT, INTERNAL_REVIEW, APPROVAL, ACTIVE, SUSPENDED, COMPLETED, TERMINATED, ARCHIVED |
| FinanceRecord | finance | DRAFT, APPROVAL_PENDING, POSTED, REVERSED |
| PurchaseOrder | procurement | DRAFT, APPROVAL_PENDING, ISSUED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED |
| Inspection | qaqc | DRAFT, REQUESTED, IN_PROGRESS, PASSED, FAILED, CLOSED |
| FormalCorrespondence | network | DRAFT, SENT, DELIVERED, READ, ACKNOWLEDGED, RESPONDED |
| JobApplication | jobs | APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED |
| Tender | tenders | DRAFT, PUBLISHED, ROUND_OPEN, ROUND_CLOSED, REVIEW, APPROVAL_PENDING, AWARDED, CLOSED_WITHOUT_AWARD, CANCELLED |
| TenderBid | tenders | DRAFT, SUBMITTED, WITHDRAWN, SUPERSEDED |
| Asset | site-operations | PLANNED, AVAILABLE, ASSIGNED, IN_USE, MAINTENANCE, RETIRED |
| FileObject | documents | PENDING_UPLOAD, SCANNING, CLEAN, REJECTED, QUARANTINED |
| WorkflowInstance | workflow | OPEN, APPROVED, REJECTED, CANCELLED, FINALIZED, FINALIZATION_FAILED |
| OutboxEvent | integration | PENDING, PUBLISHING, PUBLISHED, FAILED, DEAD_LETTERED |

## Terminal and irreversible transitions

These require recent authentication, a typed reason, and produce audit evidence that is never removed:
`Company → DELETING`, `Contract → TERMINATED`, `FinanceRecord → POSTED`, `DocumentRevision → ISSUED`,
`TenderBid → SUBMITTED`, `FormalCorrespondence → SENT`, `Baseline` creation.
