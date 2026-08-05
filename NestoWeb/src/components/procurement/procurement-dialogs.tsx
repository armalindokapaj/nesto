"use client";

import { useActionState, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  createDeliveryAction,
  addSupplierQualificationAction,
  createProcurementPackageAction,
  createPurchaseRequestAction,
  createQuotationAction,
  createRfqAction,
  type ProcurementActionState,
} from "@/app/actions/procurement";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Action = (state: ProcurementActionState, formData: FormData) => Promise<ProcurementActionState>;

function Field({ label, name, children }: { label: string; name: string; children?: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label>{children ?? <Input id={name} name={name} required />}</div>;
}

function Select({ name, defaultValue = "", children, required }: { name: string; defaultValue?: string; children: ReactNode; required?: boolean }) {
  return <select id={name} name={name} defaultValue={defaultValue} required={required} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20">{children}</select>;
}

function ActionDialog({ title, trigger, action, children, size = "max-w-lg" }: { title: string; trigger: string; action: Action; children: ReactNode; size?: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button size="sm"><Plus size={14} /> {trigger}</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className={`fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[94vw] ${size} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl`}>
          <div className="mb-4 flex items-center justify-between"><Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title><Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close></div>
          <form action={formAction} className="space-y-3.5">
            {children}
            {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            {state?.success && <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">{state.success} You can close this dialog.</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Create"}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Picker = { id: string; name: string };

export function CreatePurchaseRequestDialog({ projects }: { projects: Picker[] }) {
  return <ActionDialog title="New purchase request" trigger="New request" action={createPurchaseRequestAction}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Request title" name="title" />
      <Field label="Project" name="projectId"><Select name="projectId"><option value="">Company-wide</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Request type" name="type"><Select name="type" defaultValue="CONSTRUCTION_MATERIAL" required><option value="CONSTRUCTION_MATERIAL">Construction material</option><option value="STOCK_ITEM">Stock item</option><option value="ASSET_ACQUISITION">Asset acquisition</option><option value="SERVICE">Service</option><option value="SUBCONTRACT_WORK">Subcontract work</option><option value="RENTAL">Rental</option><option value="EMERGENCY_PURCHASE">Emergency purchase</option><option value="MIXED">Mixed request</option></Select></Field>
      <Field label="Priority" name="priority"><Select name="priority" defaultValue="NORMAL"><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></Select></Field>
      <Field label="Required by" name="requiredBy"><Input id="requiredBy" name="requiredBy" type="date" /></Field>
      <Field label="Delivery location" name="deliveryLocation"><Input id="deliveryLocation" name="deliveryLocation" /></Field>
    </div>
    <Field label="Business justification" name="justification"><textarea id="justification" name="justification" rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></Field>
    <div className="rounded-xl border border-border bg-surface-sunken/40 p-3"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">First request line</p><div className="grid gap-3 sm:grid-cols-2">
      <Field label="Line type" name="lineType"><Select name="lineType" defaultValue="MATERIAL"><option>MATERIAL</option><option>ASSET</option><option>SERVICE</option><option>SUBCONTRACT</option><option>RENTAL</option><option>NON_STOCK</option></Select></Field>
      <Field label="Description" name="description" />
      <Field label="Quantity" name="quantity"><Input id="quantity" name="quantity" type="number" min="0.0001" step="any" required /></Field>
      <Field label="Unit" name="unit"><Input id="unit" name="unit" placeholder="m², kg, item, hour" required /></Field>
      <Field label="Estimated unit cost" name="estimatedUnitCost"><Input id="estimatedUnitCost" name="estimatedUnitCost" type="number" min="0" step="0.01" required /></Field>
      <Field label="Category" name="category"><Input id="category" name="category" /></Field>
    </div></div>
  </ActionDialog>;
}

export function CreatePackageDialog({ projects }: { projects: Picker[] }) {
  return <ActionDialog title="New procurement package" trigger="New package" action={createProcurementPackageAction}>
    <Field label="Package name" name="name" />
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Project" name="projectId"><Select name="projectId"><option value="">Company-wide</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Type" name="type"><Select name="type" defaultValue="PROJECT_PACKAGE"><option>PROJECT_PACKAGE</option><option>ANNUAL_PROGRAM</option><option>FRAMEWORK</option><option>DIRECT_PURCHASE</option></Select></Field>
      <Field label="Target value" name="targetValue"><Input id="targetValue" name="targetValue" type="number" min="0" step="0.01" /></Field>
      <Field label="Award target" name="awardTarget"><Input id="awardTarget" name="awardTarget" type="date" /></Field>
      <Field label="Risk level" name="riskLevel"><Select name="riskLevel" defaultValue="LOW"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></Select></Field>
    </div>
    <Field label="Scope and boundaries" name="scope"><textarea id="scope" name="scope" rows={4} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></Field>
  </ActionDialog>;
}

export function CreateRfqDialog({ suppliers, projects, requests, packages }: { suppliers: Picker[]; projects: Picker[]; requests: { id: string; number: string; title: string }[]; packages: { id: string; number: string; name: string }[] }) {
  return <ActionDialog title="Create sourcing event" trigger="New RFQ" action={createRfqAction}>
    <Field label="RFQ title" name="title" />
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Type" name="type"><Select name="type" defaultValue="RFQ"><option value="RFQ">Request for quotation</option><option value="RFP">Request for proposal</option><option value="SUBCONTRACT_TENDER">Subcontract tender</option><option value="SINGLE_SOURCE">Single-source negotiation</option><option value="BAFO">Best and final offer</option></Select></Field>
      <Field label="Deadline" name="deadline"><Input id="deadline" name="deadline" type="date" required /></Field>
      <Field label="Supplier" name="supplierId"><Select name="supplierId" required><option value="">Select supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Project" name="projectId"><Select name="projectId"><option value="">Company-wide</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Source request" name="requestId"><Select name="requestId"><option value="">None</option>{requests.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.title}</option>)}</Select></Field>
      <Field label="Package" name="packageId"><Select name="packageId"><option value="">None</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}</Select></Field>
    </div>
    <Field label="Instructions" name="instructions"><textarea id="instructions" name="instructions" rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></Field>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="Line description" name="description" /><Field label="Quantity" name="quantity"><Input id="quantity" name="quantity" type="number" min="0.0001" step="any" required /></Field><Field label="Unit" name="unit" /></div>
  </ActionDialog>;
}

export function CreateQuotationDialog({ rfqId, projectId, suppliers, defaultDescription }: { rfqId: string; projectId?: string | null; suppliers: Picker[]; defaultDescription?: string }) {
  return <ActionDialog title="Record supplier quotation" trigger="Record quotation" action={createQuotationAction}>
    <input type="hidden" name="rfqId" value={rfqId} /><input type="hidden" name="projectId" value={projectId ?? ""} />
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Supplier" name="supplierId"><Select name="supplierId" required><option value="">Select supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field><Field label="Supplier reference" name="supplierReference"><Input id="supplierReference" name="supplierReference" /></Field><Field label="Currency" name="currency"><Input id="currency" name="currency" defaultValue="EUR" required /></Field><Field label="Validity date" name="validityDate"><Input id="validityDate" name="validityDate" type="date" /></Field><Field label="Lead time (days)" name="leadTimeDays"><Input id="leadTimeDays" name="leadTimeDays" type="number" min="0" /></Field><Field label="Payment terms" name="paymentTerms"><Input id="paymentTerms" name="paymentTerms" /></Field></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Line description" name="description"><Input id="description" name="description" defaultValue={defaultDescription} required /></Field><Field label="Quantity" name="quantity"><Input id="quantity" name="quantity" type="number" min="0.0001" step="any" required /></Field><Field label="Unit" name="unit" /><Field label="Unit price" name="unitPrice"><Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.01" required /></Field><Field label="Discount" name="discount"><Input id="discount" name="discount" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Tax" name="tax"><Input id="tax" name="tax" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Freight" name="freight"><Input id="freight" name="freight" type="number" min="0" step="0.01" defaultValue="0" /></Field></div>
  </ActionDialog>;
}

export function CreateDeliveryDialog({ orders }: { orders: { id: string; number: string; supplier: string }[] }) {
  return <ActionDialog title="Schedule delivery" trigger="Schedule delivery" action={createDeliveryAction}>
    <Field label="Purchase order" name="purchaseOrderId"><Select name="purchaseOrderId" required><option value="">Select issued order</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.supplier}</option>)}</Select></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Expected arrival" name="expectedAt"><Input id="expectedAt" name="expectedAt" type="date" /></Field><Field label="Carrier reference" name="carrierReference"><Input id="carrierReference" name="carrierReference" /></Field></div>
    <Field label="Delivery location" name="deliveryLocation" />
  </ActionDialog>;
}

export function AddSupplierQualificationDialog({ supplierId }: { supplierId: string }) {
  return <ActionDialog title="Supplier qualification" trigger="Record qualification" action={addSupplierQualificationAction}>
    <input type="hidden" name="supplierId" value={supplierId} />
    <Field label="Outcome" name="outcome"><Select name="outcome" defaultValue="QUALIFIED" required><option>QUALIFIED</option><option>CONDITIONALLY_QUALIFIED</option><option>REJECTED</option><option>SUSPENDED</option><option>RENEWAL_REQUIRED</option></Select></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Score (0-100)" name="score"><Input id="score" name="score" type="number" min="0" max="100" /></Field><Field label="Valid until" name="validUntil"><Input id="validUntil" name="validUntil" type="date" /></Field></div>
    <Field label="Category scope" name="category"><Input id="category" name="category" /></Field>
    <Field label="Review notes" name="notes"><textarea id="notes" name="notes" rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></Field>
  </ActionDialog>;
}
