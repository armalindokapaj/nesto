"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  updateProfessionalProfileAction,
  updateContractorProfileAction,
  addExperienceAction,
  removeExperienceAction,
  addEducationAction,
  removeEducationAction,
  addCertificationAction,
  removeCertificationAction,
  addSkillAction,
  removeSkillAction,
  addContractorContactAction,
  removeContractorContactAction,
  addPortfolioProjectAction,
  removePortfolioProjectAction,
  uploadProfileDocumentAction,
  submitApplicationAction,
  type ActionState,
} from "@/app/actions/public-signup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PROFESSIONS,
  EMPLOYMENT_STATUSES,
  AVAILABILITY_STATUSES,
  CONTRACTOR_TYPES,
  CONTRACTOR_SERVICE_CATEGORIES,
  CONTRACTOR_CONTACT_ROLES,
  PROFILE_DOCUMENT_CATEGORIES,
  PORTFOLIO_PROJECT_STATUSES,
} from "@/lib/constants";
import type { PublicAccountFull } from "@/server/public-signup";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

const STEPS_PROFESSIONAL = ["profile", "experience", "skills", "portfolio", "documents", "review"] as const;
const STEPS_CONTRACTOR = ["profile", "services", "contacts", "portfolio", "documents", "review"] as const;

export function OnboardingWizard({
  account,
  completion,
}: {
  account: PublicAccountFull;
  completion: { percentage: number; missing: string[] };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const steps = account.accountType === "PROFESSIONAL" ? STEPS_PROFESSIONAL : STEPS_CONTRACTOR;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl text-ink">{t("apply.onboardingTitle")}</h1>
          <span className="text-xs text-ink-muted">{completion.percentage}% {t("apply.complete")}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full bg-gold transition-all" style={{ width: `${completion.percentage}%` }} />
        </div>
      </div>

      {account.status === "CHANGES_REQUESTED" && account.application && (
        <div className="rounded-lg bg-warning-soft px-3 py-2.5 text-xs text-warning">
          {t("apply.changesRequestedBanner")}
          {account.application.reviews[0]?.reason && <p className="mt-1 font-medium">{account.application.reviews[0].reason}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {steps.map((s, i) => (
          <button
            key={s}
            onClick={() => setStepIndex(i)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              i === stepIndex ? "bg-gold text-white" : "bg-surface-sunken text-ink-muted hover:text-ink"
            }`}
          >
            {t(`apply.step.${s}`)}
          </button>
        ))}
      </div>

      {step === "profile" && account.accountType === "PROFESSIONAL" && <ProfessionalProfileStep account={account} />}
      {step === "profile" && account.accountType === "CONTRACTOR" && <ContractorProfileStep account={account} />}
      {step === "experience" && <ExperienceEducationStep account={account} />}
      {step === "skills" && <SkillsCertificationsStep account={account} />}
      {step === "services" && <ServicesCoverageStep account={account} />}
      {step === "contacts" && <ContactsStep account={account} />}
      {step === "portfolio" && <PortfolioStep account={account} />}
      {step === "documents" && <DocumentsStep account={account} />}
      {step === "review" && <ReviewStep account={account} completion={completion} />}

      <div className="flex justify-between">
        <Button variant="secondary" size="sm" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
          {t("apply.previousStep")}
        </Button>
        {stepIndex < steps.length - 1 && (
          <Button
            size="sm"
            onClick={() => {
              setStepIndex((i) => Math.min(steps.length - 1, i + 1));
              router.refresh();
            }}
          >
            {t("apply.nextStep")}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SaveButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

function ErrorText({ state }: { state: ActionState }) {
  if (!state || !("error" in state)) return null;
  return <p className="text-xs text-danger">{state.error}</p>;
}

// ---------------------------------------------------------------------------

function ProfessionalProfileStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateProfessionalProfileAction, undefined);
  const p = account.professionalProfile;

  return (
    <StepCard title={t("apply.step.profile")}>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label={t("apply.firstName")}><Input name="firstName" defaultValue={p?.firstName ?? ""} /></Field>
        <Field label={t("apply.lastName")}><Input name="lastName" defaultValue={p?.lastName ?? ""} /></Field>
        <Field label={t("apply.professionalTitle")}><Input name="title" defaultValue={p?.title ?? ""} /></Field>
        <Field label={t("apply.primaryProfession")}>
          <select name="primaryProfession" defaultValue={p?.primaryProfession ?? ""} className={selectClass}>
            <option value="">{t("common.select")}</option>
            {PROFESSIONS.map((prof) => (
              <option key={prof} value={prof}>{t(`apply.profession.${prof}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("apply.country")}><Input name="country" defaultValue={p?.country ?? ""} /></Field>
        <Field label={t("apply.city")}><Input name="city" defaultValue={p?.city ?? ""} /></Field>
        <Field label={t("apply.yearsExperience")}><Input name="yearsExperience" type="number" min={0} defaultValue={p?.yearsExperience ?? ""} /></Field>
        <Field label={t("apply.employmentStatusLabel")}>
          <select name="employmentStatus" defaultValue={p?.employmentStatus ?? ""} className={selectClass}>
            <option value="">{t("common.select")}</option>
            {EMPLOYMENT_STATUSES.map((s) => (<option key={s} value={s}>{t(`apply.employmentStatus.${s}`)}</option>))}
          </select>
        </Field>
        <Field label={t("apply.availabilityStatusLabel")}>
          <select name="availabilityStatus" defaultValue={p?.availabilityStatus ?? ""} className={selectClass}>
            <option value="">{t("common.select")}</option>
            {AVAILABILITY_STATUSES.map((s) => (<option key={s} value={s}>{t(`apply.availabilityStatus.${s}`)}</option>))}
          </select>
        </Field>
        <Field label={t("apply.professionalEmail")}><Input name="professionalEmail" type="email" defaultValue={p?.professionalEmail ?? ""} /></Field>
        <Field label={t("apply.phone")}><Input name="phone" defaultValue={p?.phone ?? ""} /></Field>
        <Field label={t("apply.website")}><Input name="website" defaultValue={p?.website ?? ""} /></Field>
        <Field label={t("apply.linkedin")}><Input name="linkedin" defaultValue={p?.linkedin ?? ""} /></Field>
        <div className="sm:col-span-2">
            <Field label={t("apply.headline")}><Input name="headline" defaultValue={p?.headline ?? ""} /></Field>
          </div>
        <div className="sm:col-span-2">
            <Field label={t("apply.summary")}><Textarea name="summary" rows={4} defaultValue={p?.summary ?? ""} /></Field>
          </div>
        <div className="sm:col-span-2 flex items-center justify-between">
          <ErrorText state={state} />
          <SaveButton pending={pending} label={t("common.save")} />
        </div>
      </form>
    </StepCard>
  );
}

function ContractorProfileStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateContractorProfileAction, undefined);
  const c = account.contractorProfile;

  return (
    <StepCard title={t("apply.step.profile")}>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label={t("apply.contractorTypeLabel")}>
          <select name="contractorType" defaultValue={c?.contractorType ?? ""} className={selectClass}>
            <option value="">{t("common.select")}</option>
            {CONTRACTOR_TYPES.map((ct) => (<option key={ct} value={ct}>{t(`apply.contractorType.${ct}`)}</option>))}
          </select>
        </Field>
        <Field label={t("apply.legalBusinessName")}><Input name="legalBusinessName" defaultValue={c?.legalBusinessName ?? ""} /></Field>
        <Field label={t("apply.tradingName")}><Input name="tradingName" defaultValue={c?.tradingName ?? ""} /></Field>
        <Field label={t("apply.registrationNumber")}><Input name="registrationNumber" defaultValue={c?.registrationNumber ?? ""} /></Field>
        <Field label={t("apply.vatNumber")}><Input name="vatNumber" defaultValue={c?.vatNumber ?? ""} /></Field>
        <Field label={t("apply.countryOfRegistration")}><Input name="countryOfRegistration" defaultValue={c?.countryOfRegistration ?? ""} /></Field>
        <Field label={t("apply.headquarters")}><Input name="headquarters" defaultValue={c?.headquarters ?? ""} /></Field>
        <Field label={t("apply.mainContactPerson")}><Input name="mainContactPerson" defaultValue={c?.mainContactPerson ?? ""} /></Field>
        <Field label={t("apply.businessEmail")}><Input name="businessEmail" type="email" defaultValue={c?.businessEmail ?? ""} /></Field>
        <Field label={t("apply.businessPhone")}><Input name="businessPhone" defaultValue={c?.businessPhone ?? ""} /></Field>
        <Field label={t("apply.website")}><Input name="website" defaultValue={c?.website ?? ""} /></Field>
        <Field label={t("apply.companySize")}><Input name="companySize" defaultValue={c?.companySize ?? ""} /></Field>
        <div className="sm:col-span-2">
            <Field label={t("apply.shortDescription")}><Input name="shortDescription" defaultValue={c?.shortDescription ?? ""} /></Field>
          </div>
        <div className="sm:col-span-2">
            <Field label={t("apply.fullDescription")}><Textarea name="fullDescription" rows={4} defaultValue={c?.fullDescription ?? ""} /></Field>
          </div>
        <div className="sm:col-span-2 flex items-center justify-between">
          <ErrorText state={state} />
          <SaveButton pending={pending} label={t("common.save")} />
        </div>
      </form>
    </StepCard>
  );
}

function ExperienceEducationStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [expState, expAction, expPending] = useActionState(addExperienceAction, undefined);
  const [eduState, eduAction, eduPending] = useActionState(addEducationAction, undefined);
  const [, startTransition] = useTransition();
  const p = account.professionalProfile;

  return (
    <div className="space-y-4">
      <StepCard title={t("apply.experience")}>
        <div className="space-y-2 mb-4">
          {p?.experiences.map((exp) => (
            <div key={exp.id} className="flex items-start justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
              <div>
                <p className="font-medium text-ink">{exp.position} — {exp.employer}</p>
                <p className="text-xs text-ink-faint">
                  {formatDate(exp.startDate)} – {exp.currentlyWorking ? t("apply.present") : exp.endDate ? formatDate(exp.endDate) : "—"}
                </p>
                <p className="text-xs text-ink-muted mt-1">{exp.description}</p>
              </div>
              <button type="button" onClick={() => startTransition(() => removeExperienceAction(exp.id))} className="text-ink-faint hover:text-danger shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(p?.experiences.length ?? 0) === 0 && <p className="text-xs text-ink-faint">{t("apply.noneYet")}</p>}
        </div>
        <form action={expAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("apply.employer")}><Input name="employer" required /></Field>
          <Field label={t("apply.position")}><Input name="position" required /></Field>
          <Field label={t("apply.startDate")}>
            <Input name="startDate" type="date" required />
          </Field>
          <Field label={t("apply.endDate")}><Input name="endDate" type="date" /></Field>
          <label className="flex items-center gap-2 text-xs text-ink-muted sm:col-span-2">
            <input type="checkbox" name="currentlyWorking" value="true" className="accent-gold" /> {t("apply.currentlyWorking")}
          </label>
          <div className="sm:col-span-2">
            <Field label={t("apply.description")}><Textarea name="description" rows={2} required /></Field>
          </div>
          <div className="sm:col-span-2 flex items-center justify-between">
            <ErrorText state={expState} />
            <SaveButton pending={expPending} label={t("apply.addExperience")} />
          </div>
        </form>
      </StepCard>

      <StepCard title={t("apply.education")}>
        <div className="space-y-2 mb-4">
          {p?.educations.map((edu) => (
            <div key={edu.id} className="flex items-start justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
              <div>
                <p className="font-medium text-ink">{edu.degree}, {edu.fieldOfStudy}</p>
                <p className="text-xs text-ink-faint">{edu.institution}</p>
              </div>
              <button type="button" onClick={() => startTransition(() => removeEducationAction(edu.id))} className="text-ink-faint hover:text-danger shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(p?.educations.length ?? 0) === 0 && <p className="text-xs text-ink-faint">{t("apply.noneYet")}</p>}
        </div>
        <form action={eduAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("apply.institution")}><Input name="institution" required /></Field>
          <Field label={t("apply.degree")}><Input name="degree" required /></Field>
          <Field label={t("apply.fieldOfStudy")}><Input name="fieldOfStudy" required /></Field>
          <Field label={t("apply.educationStartDate")}><Input name="startDate" type="date" required /></Field>
          <div className="sm:col-span-2 flex items-center justify-between">
            <ErrorText state={eduState} />
            <SaveButton pending={eduPending} label={t("apply.addEducation")} />
          </div>
        </form>
      </StepCard>
    </div>
  );
}

function SkillsCertificationsStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [skillState, skillAction, skillPending] = useActionState(addSkillAction, undefined);
  const [certState, certAction, certPending] = useActionState(addCertificationAction, undefined);
  const [, startTransition] = useTransition();
  const p = account.professionalProfile;

  return (
    <div className="space-y-4">
      <StepCard title={t("apply.skills")}>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {p?.skills.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 text-xs text-gold-strong">
              {s.name}
              <button type="button" onClick={() => startTransition(() => removeSkillAction(s.id))}><Trash2 size={11} /></button>
            </span>
          ))}
          {(p?.skills.length ?? 0) === 0 && <p className="text-xs text-ink-faint">{t("apply.noneYet")}</p>}
        </div>
        <form action={skillAction} className="flex flex-wrap items-end gap-3">
          <Field label={t("apply.skillName")}><Input name="name" required /></Field>
          <Field label={t("apply.skillCategoryLabel")}>
            <select name="category" defaultValue="PROFESSIONAL" className={selectClass}>
              <option value="PROFESSIONAL">{t("apply.skillCategory.PROFESSIONAL")}</option>
              <option value="SOFTWARE">{t("apply.skillCategory.SOFTWARE")}</option>
              <option value="LANGUAGE">{t("apply.skillCategory.LANGUAGE")}</option>
            </select>
          </Field>
          <SaveButton pending={skillPending} label={t("apply.addSkill")} />
        </form>
        <ErrorText state={skillState} />
      </StepCard>

      <StepCard title={t("apply.certifications")}>
        <div className="space-y-2 mb-4">
          {p?.certifications.map((cert) => (
            <div key={cert.id} className="flex items-start justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
              <div>
                <p className="font-medium text-ink">{cert.name}</p>
                <p className="text-xs text-ink-faint">{cert.issuingOrganization}</p>
              </div>
              <button type="button" onClick={() => startTransition(() => removeCertificationAction(cert.id))} className="text-ink-faint hover:text-danger shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(p?.certifications.length ?? 0) === 0 && <p className="text-xs text-ink-faint">{t("apply.noneYet")}</p>}
        </div>
        <form action={certAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("apply.certificationName")}><Input name="name" required /></Field>
          <Field label={t("apply.issuingOrganization")}><Input name="issuingOrganization" required /></Field>
          <div className="sm:col-span-2 flex items-center justify-between">
            <ErrorText state={certState} />
            <SaveButton pending={certPending} label={t("apply.addCertification")} />
          </div>
        </form>
      </StepCard>
    </div>
  );
}

function ServicesCoverageStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateContractorProfileAction, undefined);
  const c = account.contractorProfile;

  return (
    <StepCard title={t("apply.step.services")}>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label={t("apply.primaryService")}>
          <select name="primaryService" defaultValue={c?.primaryService ?? ""} className={selectClass}>
            <option value="">{t("common.select")}</option>
            {CONTRACTOR_SERVICE_CATEGORIES.map((svc) => (<option key={svc} value={svc}>{t(`apply.service.${svc}`)}</option>))}
          </select>
        </Field>
        <Field label={t("apply.typicalProjectSize")}><Input name="typicalProjectSize" defaultValue={c?.typicalProjectSize ?? ""} /></Field>
        <div className="sm:col-span-2">
            <Field label={t("apply.countriesServed")}><Input name="countriesServed" placeholder={t("apply.countriesServedPlaceholder")} defaultValue={c?.countriesServed ?? ""} /></Field>
          </div>
        <div className="sm:col-span-2 flex items-center justify-between">
          <ErrorText state={state} />
          <SaveButton pending={pending} label={t("common.save")} />
        </div>
      </form>
    </StepCard>
  );
}

function ContactsStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addContractorContactAction, undefined);
  const [, startTransition] = useTransition();
  const c = account.contractorProfile;

  return (
    <StepCard title={t("apply.step.contacts")}>
      <div className="space-y-2 mb-4">
        {c?.contacts.map((contact) => (
          <div key={contact.id} className="flex items-start justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
            <div>
              <p className="font-medium text-ink">{contact.name}</p>
              <p className="text-xs text-ink-faint">{t(`apply.contactRole.${contact.role}`)}</p>
            </div>
            <button type="button" onClick={() => startTransition(() => removeContractorContactAction(contact.id))} className="text-ink-faint hover:text-danger shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {(c?.contacts.length ?? 0) === 0 && <p className="text-xs text-ink-faint">{t("apply.noneYet")}</p>}
      </div>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("apply.contactName")}><Input name="name" required /></Field>
        <Field label={t("apply.contactRoleLabel")}>
          <select name="role" defaultValue={CONTRACTOR_CONTACT_ROLES[0]} className={selectClass}>
            {CONTRACTOR_CONTACT_ROLES.map((r) => (<option key={r} value={r}>{t(`apply.contactRole.${r}`)}</option>))}
          </select>
        </Field>
        <Field label={t("common.email")}><Input name="email" type="email" /></Field>
        <Field label={t("apply.phone")}><Input name="phone" /></Field>
        <div className="sm:col-span-2 flex items-center justify-between">
          <ErrorText state={state} />
          <SaveButton pending={pending} label={t("apply.addContact")} />
        </div>
      </form>
    </StepCard>
  );
}

function PortfolioStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addPortfolioProjectAction, undefined);
  const [, startTransition] = useTransition();

  return (
    <StepCard title={t("apply.step.portfolio")}>
      <div className="space-y-2 mb-4">
        {account.portfolioProjects.map((proj) => (
          <div key={proj.id} className="flex items-start justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
            <div>
              <p className="font-medium text-ink">{proj.title}</p>
              <p className="text-xs text-ink-faint">{proj.role} — {proj.projectType}</p>
            </div>
            <button type="button" onClick={() => startTransition(() => removePortfolioProjectAction(proj.id))} className="text-ink-faint hover:text-danger shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {account.portfolioProjects.length === 0 && <p className="text-xs text-ink-faint">{t("apply.noneYet")}</p>}
      </div>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("apply.projectTitle")}><Input name="title" required /></Field>
        <Field label={t("apply.projectType")}><Input name="projectType" required /></Field>
        <Field label={t("apply.role")}><Input name="role" required /></Field>
        <Field label={t("apply.projectStatusLabel")}>
          <select name="status" defaultValue="COMPLETED" className={selectClass}>
            {PORTFOLIO_PROJECT_STATUSES.map((s) => (<option key={s} value={s}>{t(`apply.projectStatus.${s}`)}</option>))}
          </select>
        </Field>
        <div className="sm:col-span-2">
            <Field label={t("apply.description")}><Textarea name="description" rows={2} required /></Field>
          </div>
        <label className="flex items-start gap-2 text-xs text-ink-muted sm:col-span-2">
          <input type="checkbox" name="ownershipConfirmed" value="true" required className="mt-0.5 accent-gold" />
          {t("apply.ownershipDeclaration")}
        </label>
        <div className="sm:col-span-2 flex items-center justify-between">
          <ErrorText state={state} />
          <SaveButton pending={pending} label={t("apply.addProject")} />
        </div>
      </form>
    </StepCard>
  );
}

function DocumentsStep({ account }: { account: PublicAccountFull }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(uploadProfileDocumentAction, undefined);

  return (
    <StepCard title={t("apply.step.documents")}>
      <div className="space-y-2 mb-4">
        {account.documents.filter((d) => d.isActive).map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
            <div>
              <p className="font-medium text-ink">{doc.name}</p>
              <p className="text-xs text-ink-faint">{t(`apply.documentCategory.${doc.category}`)} — v{doc.version}</p>
            </div>
            <Badge status={doc.verificationStatus}>{doc.verificationStatus}</Badge>
          </div>
        ))}
        {account.documents.length === 0 && <p className="text-xs text-ink-faint">{t("apply.noneYet")}</p>}
      </div>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("apply.documentCategoryLabel")}>
          <select name="category" defaultValue="CV" className={selectClass}>
            {PROFILE_DOCUMENT_CATEGORIES.map((c) => (<option key={c} value={c}>{t(`apply.documentCategory.${c}`)}</option>))}
          </select>
        </Field>
        <Field label={t("documents.name")}><Input name="name" required placeholder={t("apply.documentNamePlaceholder")} /></Field>
        <div className="sm:col-span-2 flex items-center justify-between">
          <ErrorText state={state} />
          <SaveButton pending={pending} label={t("apply.addDocument")} />
        </div>
      </form>
    </StepCard>
  );
}

function ReviewStep({ account, completion }: { account: PublicAccountFull; completion: { percentage: number; missing: string[] } }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const summaryName =
    account.accountType === "PROFESSIONAL"
      ? [account.professionalProfile?.firstName, account.professionalProfile?.lastName].filter(Boolean).join(" ") || "—"
      : account.contractorProfile?.legalBusinessName || "—";
  const summaryCategory =
    account.accountType === "PROFESSIONAL"
      ? account.professionalProfile?.primaryProfession
        ? t(`apply.profession.${account.professionalProfile.primaryProfession}`)
        : "—"
      : account.contractorProfile?.primaryService
        ? t(`apply.service.${account.contractorProfile.primaryService}`)
        : "—";

  return (
    <StepCard title={t("apply.step.review")}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-sunken/60 p-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-ink-faint">{t("common.email")}</p>
            <p className="text-ink">{account.email}</p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">{account.accountType === "PROFESSIONAL" ? t("apply.step.profile") : t("apply.legalBusinessName")}</p>
            <p className="text-ink">{summaryName}</p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">{account.accountType === "PROFESSIONAL" ? t("apply.primaryProfession") : t("apply.primaryService")}</p>
            <p className="text-ink">{summaryCategory}</p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">{t("nav.documents")}</p>
            <p className="text-ink">{account.documents.filter((d) => d.isActive).length}</p>
          </div>
        </div>

        {completion.percentage < 100 ? (
          <div className="rounded-lg bg-warning-soft p-3">
            <p className="text-xs font-semibold text-warning">{t("apply.missingItems")}</p>
            <ul className="mt-1 text-xs text-warning list-disc pl-4">
              {completion.missing.map((m, i) => (<li key={i}>{m}</li>))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t("apply.readyToSubmit")}</p>
        )}

        <label className="flex items-start gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-gold" />
          {t("apply.submitConfirmation")}
        </label>

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button
          disabled={completion.percentage < 100 || !confirmed || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await submitApplicationAction();
              if (result && "error" in result) setError(result.error);
            })
          }
        >
          {pending ? t("common.saving") : t("apply.submitForReview")}
        </Button>
      </div>
    </StepCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
