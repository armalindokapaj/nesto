-- CreateTable
CREATE TABLE "PublicAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'sq',
    "country" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" DATETIME,
    "termsAcceptedAt" DATETIME,
    "termsVersion" TEXT,
    "privacyAcceptedAt" DATETIME,
    "privacyVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "primaryProfession" TEXT,
    "photoUrl" TEXT,
    "country" TEXT,
    "city" TEXT,
    "headline" TEXT,
    "summary" TEXT,
    "yearsExperience" INTEGER,
    "employmentStatus" TEXT,
    "availabilityStatus" TEXT,
    "professionalEmail" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "portfolioWebsite" TEXT,
    "addressVisibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "preferredContactMethod" TEXT,
    "engagementTypes" TEXT,
    "relocationAvailable" BOOLEAN,
    "expectedSalary" TEXT,
    "preferredProjectTypes" TEXT,
    "preferredCompanyTypes" TEXT,
    "workAuthorization" TEXT,
    "noticePeriod" TEXT,
    "availabilityDate" DATETIME,
    CONSTRAINT "ProfessionalProfile_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfessionalExperience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "employmentType" TEXT,
    "country" TEXT,
    "city" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "currentlyWorking" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfessionalExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfessionalEducation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT NOT NULL,
    "country" TEXT,
    "startDate" DATETIME NOT NULL,
    "graduationDate" DATETIME,
    "ongoing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfessionalEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfessionalCertification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingOrganization" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "country" TEXT,
    "verificationUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfessionalCertification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfessionalSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'PROFESSIONAL',
    "level" TEXT,
    CONSTRAINT "ProfessionalSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "contractorType" TEXT,
    "legalBusinessName" TEXT,
    "tradingName" TEXT,
    "registrationNumber" TEXT,
    "vatNumber" TEXT,
    "countryOfRegistration" TEXT,
    "legalStructure" TEXT,
    "foundingYear" INTEGER,
    "headquarters" TEXT,
    "mainContactPerson" TEXT,
    "businessEmail" TEXT,
    "businessPhone" TEXT,
    "website" TEXT,
    "companySize" TEXT,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "primaryService" TEXT,
    "additionalServices" TEXT,
    "countriesServed" TEXT,
    "maxProjectDistance" TEXT,
    "internationalAvailability" BOOLEAN,
    "typicalProjectSize" TEXT,
    "minContractValue" REAL,
    "maxContractValue" REAL,
    "activeTeams" TEXT,
    "equipmentCapacity" TEXT,
    CONSTRAINT "ContractorProfile_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractorContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractorContact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ContractorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "location" TEXT,
    "completionYear" INTEGER,
    "clientOrEmployer" TEXT,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "coverImageUrl" TEXT,
    "contractValue" REAL,
    "startDate" DATETIME,
    "completionDate" DATETIME,
    "teamSize" INTEGER,
    "publicVisibility" BOOLEAN NOT NULL DEFAULT true,
    "ownershipConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioProject_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileDocument_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ProfileDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PLATFORM_REVIEW',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerId" TEXT,
    "decisionReason" TEXT,
    "decidedAt" DATETIME,
    "restrictions" TEXT,
    "approvedProfileNumber" TEXT,
    CONSTRAINT "ProfileApplication_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "fieldsRequested" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ProfileApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileAuditEvent_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicAccountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "proposedRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileInvitation_publicAccountId_fkey" FOREIGN KEY ("publicAccountId") REFERENCES "PublicAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#B8860B',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_UserIdentity" ("avatarColor", "createdAt", "displayName", "email", "id", "passwordHash", "username") SELECT "avatarColor", "createdAt", "displayName", "email", "id", "passwordHash", "username" FROM "UserIdentity";
DROP TABLE "UserIdentity";
ALTER TABLE "new_UserIdentity" RENAME TO "UserIdentity";
CREATE UNIQUE INDEX "UserIdentity_email_key" ON "UserIdentity"("email");
CREATE UNIQUE INDEX "UserIdentity_username_key" ON "UserIdentity"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PublicAccount_email_key" ON "PublicAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PublicAccount_username_key" ON "PublicAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_publicAccountId_key" ON "ProfessionalProfile"("publicAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorProfile_publicAccountId_key" ON "ContractorProfile"("publicAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileDocument_supersedesId_key" ON "ProfileDocument"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileApplication_publicAccountId_key" ON "ProfileApplication"("publicAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileApplication_applicationNumber_key" ON "ProfileApplication"("applicationNumber");
