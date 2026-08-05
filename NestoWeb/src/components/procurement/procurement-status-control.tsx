"use client";

import { useTransition } from "react";
import { transitionPurchaseRequestAction, transitionRfqAction, updateDeliveryStatusAction, updatePurchaseOrderStatusAction, updateSupplierStatusAction } from "@/app/actions/procurement";

const NEXT: Record<string, Record<string, string[]>> = {
  request: { DRAFT: ["SUBMITTED", "CANCELLED"], SUBMITTED: ["UNDER_REVIEW", "SOURCING", "REJECTED", "CANCELLED"], UNDER_REVIEW: ["SOURCING", "REJECTED", "CANCELLED"], SOURCING: ["PARTIALLY_ORDERED", "FULLY_ORDERED", "CANCELLED"], PARTIALLY_ORDERED: ["FULLY_ORDERED", "CANCELLED"], FULLY_ORDERED: ["CLOSED"] },
  rfq: { DRAFT: ["ISSUED", "CANCELLED"], ISSUED: ["OPEN", "CANCELLED"], OPEN: ["RESPONSES_RECEIVED", "EVALUATION", "CANCELLED"], RESPONSES_RECEIVED: ["EVALUATION", "NEGOTIATION"], EVALUATION: ["NEGOTIATION", "AWARDED"], NEGOTIATION: ["AWARDED"], AWARDED: ["CLOSED"] },
  order: { DRAFT: ["ISSUED", "CANCELLED"], SUBMITTED: ["ISSUED", "CANCELLED"], APPROVED: ["ISSUED", "CANCELLED"], ORDERED: ["ACKNOWLEDGED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"], ISSUED: ["ACKNOWLEDGED", "ON_HOLD", "CANCELLED"], ACKNOWLEDGED: ["PARTIALLY_FULFILLED", "FULFILLED", "ON_HOLD", "CANCELLED"], PARTIALLY_FULFILLED: ["FULFILLED", "ON_HOLD"], FULFILLED: ["CLOSED"], ON_HOLD: ["ISSUED", "ACKNOWLEDGED", "CANCELLED"], RECEIVED: ["CLOSED"] },
  delivery: { PLANNED: ["CONFIRMED", "DISPATCHED", "DELAYED"], CONFIRMED: ["DISPATCHED", "DELAYED"], DISPATCHED: ["IN_TRANSIT", "DELAYED"], IN_TRANSIT: ["ARRIVED", "DELAYED"], DELAYED: ["IN_TRANSIT", "ARRIVED", "REJECTED"], ARRIVED: ["PARTIALLY_ACCEPTED", "ACCEPTED", "REJECTED"], PARTIALLY_ACCEPTED: ["ACCEPTED", "REJECTED"], ACCEPTED: ["CLOSED"], REJECTED: ["CLOSED"] },
};

export function ProcurementStatusControl({ entity, id, status }: { entity: "request" | "rfq" | "order" | "delivery"; id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const options = NEXT[entity]?.[status] ?? [];
  if (!options.length) return null;
  return (
    <select disabled={pending} value="" aria-label={`Change ${entity} status`} onChange={(event) => {
      const next = event.target.value;
      if (!next) return;
      startTransition(async () => {
        if (entity === "request") await transitionPurchaseRequestAction(id, next);
        if (entity === "rfq") await transitionRfqAction(id, next);
        if (entity === "order") await updatePurchaseOrderStatusAction(id, next);
        if (entity === "delivery") await updateDeliveryStatusAction(id, next, ["DELAYED", "REJECTED"].includes(next) ? "MANUAL_EXCEPTION" : undefined);
      });
    }} className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-ink focus:border-gold focus:outline-none disabled:opacity-50">
      <option value="">Next action…</option>
      {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
    </select>
  );
}

export function SupplierStatusControl({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return <select disabled={pending} value={status} onChange={(event) => {
    const next = event.target.value;
    const reason = ["SUSPENDED", "BLACKLISTED"].includes(next) ? window.prompt(`Reason for ${next.toLowerCase()}:`) ?? undefined : undefined;
    if (["SUSPENDED", "BLACKLISTED"].includes(next) && !reason) return;
    startTransition(() => updateSupplierStatusAction(id, next, reason));
  }} className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-ink focus:border-gold focus:outline-none disabled:opacity-50">
    {["PROSPECT", "UNDER_QUALIFICATION", "QUALIFIED", "PREFERRED", "SUSPENDED", "BLACKLISTED", "ARCHIVED"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
  </select>;
}
