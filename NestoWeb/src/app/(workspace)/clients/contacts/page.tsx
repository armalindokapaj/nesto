import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listContacts } from "@/server/crm-module";
import { listClients } from "@/server/clients";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { CreateContactDialog } from "@/components/clients/create-contact-dialog";
import { getT } from "@/lib/i18n/server";

// PRD_Sales_Dashboard §6 sidebar item — Contacts across every client
// (distinct from the per-client contact list already on the Client Page).
export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");
  const params = await searchParams;

  const [contacts, clients] = await Promise.all([listContacts(tenantId), listClients(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.contactsTitle")}</CardTitle>
            <CardDescription>{t("crm.contactsSubtitle")}</CardDescription>
          </div>
          {canWrite && (
            <CreateContactDialog clients={clients.map((c) => ({ id: c.id, name: c.name }))} defaultOpen={params.open === "create"} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("crm.contactName")}</TH>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("crm.contactTitle")}</TH>
                <TH>{t("crm.contactRole")}</TH>
                <TH>{t("common.email")}</TH>
                <TH>{t("common.phone")}</TH>
              </TRow>
            </THead>
            <TBody>
              {contacts.map((contact) => (
                <TRow key={contact.id}>
                  <TD className="font-medium text-ink">{contact.name}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/clients/${contact.client.id}`} className="hover:text-gold hover:underline">
                      {contact.client.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{contact.title ?? "—"}</TD>
                  <TD className="text-ink-muted">{contact.role ?? "—"}</TD>
                  <TD className="text-ink-muted">{contact.email ?? "—"}</TD>
                  <TD className="text-ink-muted">{contact.phone ?? "—"}</TD>
                </TRow>
              ))}
              {contacts.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">
                    {t("crm.noContactsYet")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
