import Link from "next/link";
import { ArrowLeft, Mail, Phone, Briefcase, Building2 } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getEmployeeProfile, getSalaryHistory } from "@/server/employee-profile";
import { canViewOwnTraining, listTrainingForEmployee } from "@/server/training";
import { EmployeeTrainingList } from "@/components/hr/employee-training-list";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PhotoUploadForm } from "@/components/hr/photo-upload-form";
import { EmployeeContactForm } from "@/components/hr/employee-contact-form";
import { EmployeeDocuments } from "@/components/hr/employee-documents";
import { SalaryHistoryList, AddSalaryRecordForm } from "@/components/hr/employee-salary-form";
import type { Role } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, user, role } = await getCurrentUser();
  const viewer = { userId: user.id, role: role as Role };
  const employee = await getEmployeeProfile(tenantId, id, viewer);
  const salaryHistory = employee.canViewSalary ? await getSalaryHistory(tenantId, id, viewer) : [];
  const canViewTraining = canViewOwnTraining(employee.userId, viewer);
  const trainingRecords = canViewTraining ? await listTrainingForEmployee(tenantId, id, viewer) : [];
  const { t } = await getT();

  const canAddContract = can(role, "HR", "FULL");
  const generalDocuments = employee.documents.filter((d) => d.category !== "WORK_CONTRACT");
  const contractDocuments = employee.documents.filter((d) => d.category === "WORK_CONTRACT");

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/employees" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("hr_sub.directoryTitle")}
      </Link>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {employee.canManage ? (
              <PhotoUploadForm
                employeeId={employee.id}
                fullName={employee.fullName}
                avatarColor={employee.avatarColor}
                photoDataUrl={employee.photoDataUrl}
              />
            ) : (
              <Avatar name={employee.fullName} color={employee.avatarColor} src={employee.photoDataUrl} size={64} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-ink">{employee.fullName}</h1>
                {employee.status !== "ACTIVE" && <Badge status={employee.status}>{employee.status.replace("_", " ")}</Badge>}
              </div>
              <p className="text-sm text-ink-muted mt-0.5">{employee.position}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-ink">
              <Briefcase size={14} className="text-ink-faint shrink-0" /> {employee.position}
            </div>
            <div className="flex items-center gap-2 text-sm text-ink">
              <Building2 size={14} className="text-ink-faint shrink-0" /> {employee.department}
            </div>
            {employee.user?.email && (
              <div className="flex items-center gap-2 text-sm text-ink">
                <Mail size={14} className="text-ink-faint shrink-0" />
                <a href={`mailto:${employee.user.email}`} className="hover:text-gold hover:underline">
                  {employee.user.email}
                </a>
              </div>
            )}
            {employee.phone && !employee.canManage && (
              <div className="flex items-center gap-2 text-sm text-ink">
                <Phone size={14} className="text-ink-faint shrink-0" />
                <a href={`tel:${employee.phone}`} className="hover:text-gold hover:underline">
                  {employee.phone}
                </a>
              </div>
            )}
            {employee.manager && (
              <div className="text-sm text-ink-muted">
                {t("hr_sub.reportsTo")}{" "}
                <Link href={`/employees/${employee.manager.id}`} className="text-ink hover:text-gold hover:underline">
                  {employee.manager.fullName}
                </Link>
              </div>
            )}
            <div className="text-sm text-ink-muted">
              {t("dashboards.admin.joined")} {formatDate(employee.hireDate)}
            </div>
          </div>

          {employee.canManage && (
            <div className="pt-3 border-t border-border">
              <EmployeeContactForm employeeId={employee.id} phone={employee.phone} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("hr_sub.cvCertificationsTitle")}</CardTitle>
            <CardDescription>{t("hr_sub.cvCertificationsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <EmployeeDocuments
            employeeId={employee.id}
            documents={generalDocuments}
            canManage={employee.canManage}
            mode="general"
          />
        </CardContent>
      </Card>

      {employee.canViewContract && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("hr_sub.workContractTitle")}</CardTitle>
              <CardDescription>{t("hr_sub.workContractSubtitle")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <EmployeeDocuments
              employeeId={employee.id}
              documents={contractDocuments}
              canManage={canAddContract}
              mode="contract"
            />
          </CardContent>
        </Card>
      )}

      {employee.canViewSalary && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("hr_sub.salaryTitle")}</CardTitle>
              <CardDescription>{t("hr_sub.salarySubtitle")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <SalaryHistoryList records={salaryHistory} />
            <AddSalaryRecordForm employeeId={employee.id} />
          </CardContent>
        </Card>
      )}

      {canViewTraining && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("hr_sub.trainingTitle")}</CardTitle>
              <CardDescription>{t("hr_sub.trainingSubtitle")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <EmployeeTrainingList records={trainingRecords} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
