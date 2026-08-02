import type { Locale } from "./config";

type RoleGuide = { role: string; title: string; points: string[] };
type FaqItem = { q: string; a: string };

type HelpContent = {
  gettingStarted: string[];
  roleGuides: RoleGuide[];
  faq: FaqItem[];
};

const en: HelpContent = {
  gettingStarted: [
    "Your Company Admin creates your account and sends you a temporary username and password — Nesto has no public sign-up for company workspaces.",
    "After signing in, you land on the dashboard built for your role. It's fixed by design (Section 33) so every person with the same role sees the same layout — nothing to configure.",
    "The sidebar only shows the modules your role has access to. If something you expect is missing, your Company Admin can grant the permission from Administration → Roles & Permissions.",
    "Use the search bar at the top to jump straight to a project, task or document by name — results you don't have access to appear locked rather than hidden entirely.",
  ],
  roleGuides: [
    {
      role: "OWNER",
      title: "Company Owner & Admin",
      points: [
        "Create and manage every user account from Administration → Users — this is the only way accounts are created.",
        "Assign roles and access modes (Standard, View-only, Suspended) per person.",
        "Review pending invitations and recent security activity from the Admin dashboard.",
        "Only the Owner can request company deletion or transfer ownership.",
      ],
    },
    {
      role: "CEO",
      title: "CEO / Executive",
      points: [
        "Your dashboard shows active projects, revenue, pending approvals and open risks at a glance — click any tile to jump to the filtered list behind it.",
        "The Project Overview lists every active project with live progress bars pulled from actual task completion, not manual entry.",
        "Financial Overview charts revenue against expenses month by month.",
      ],
    },
    {
      role: "ARCHITECT",
      title: "Architect / Engineer",
      points: [
        "Track drawing packages, revisions and RFIs from your dashboard — each has a clear status (Draft, In Review, Approved, Needs Revision).",
        "A drawing revision that needs rework shows as 'Needs Revision' until a new version is submitted.",
        "Open RFIs older than their due date are flagged so nothing falls through the cracks.",
      ],
    },
    {
      role: "FINANCE",
      title: "Finance",
      points: [
        "Invoices, bills and payments are separated so you can see money coming in versus going out at a glance.",
        "Every invoice follows a lifecycle: Draft → Submitted → Approved → Posted. Once posted, it's locked — corrections go through a reversal, never a silent edit.",
        "Cash Flow and Budget vs Actual give you the same numbers sliced two different ways.",
      ],
    },
    {
      role: "HR",
      title: "HR",
      points: [
        "Employee records, leave requests and department distribution are all on one dashboard.",
        "'On Leave' reflects approved leave requests that cover today — not a manually maintained flag, so it's always accurate.",
        "Recruitment and attendance tracking are on the roadmap for a later phase.",
      ],
    },
  ],
  faq: [
    {
      q: "Why can't I edit an invoice after it's posted?",
      a: "Posting is a deliberate, final action (Nesto's transaction-integrity model). Once posted, a record is locked to protect your financial history — corrections use a reversal, which creates a new linked entry rather than silently changing the original.",
    },
    {
      q: "I searched for something and it shows up locked. What does that mean?",
      a: "The record exists but you don't currently have permission to open it. You can request access with a reason; the record owner or an approver decides whether to grant it, and the request is logged either way.",
    },
    {
      q: "Can I change the language for just my account?",
      a: "Yes — use the language switch in the top bar or in Account Settings. It only affects your own session; it doesn't change what other users see.",
    },
    {
      q: "Why is there no keyboard shortcut for common actions?",
      a: "This is a deliberate choice for the current release — every action is reachable by mouse or touch so the interface stays approachable regardless of experience level. Shortcuts may come later.",
    },
    {
      q: "Who can create new user accounts?",
      a: "Only the Company Owner or a Company Admin. There's no public sign-up for a company workspace — this keeps every account traceable to the person who created it.",
    },
  ],
};

const sq: HelpContent = {
  gettingStarted: [
    "Administratori i Kompanisë suaj krijon llogarinë tuaj dhe ju dërgon një përdorues dhe fjalëkalim të përkohshëm — Nesto nuk ka regjistrim publik për hapësirat e kompanisë.",
    "Pas kyçjes, ju hapet paneli i ndërtuar për rolin tuaj. Është fiks për nga dizajni (Seksioni 33), kështu që çdo person me të njëjtin rol sheh të njëjtën strukturë — asgjë për të konfiguruar.",
    "Menyja anësore tregon vetëm modulet për të cilat roli juaj ka akses. Nëse mungon diçka që prisni, Administratori i Kompanisë mund t'ju japë lejen nga Administrimi → Rolet & Lejet.",
    "Përdorni shiritin e kërkimit lart për të kaluar direkt te një projekt, detyrë ose dokument sipas emrit — rezultatet për të cilat nuk keni akses shfaqen si të kyçura, jo krejtësisht të fshehura.",
  ],
  roleGuides: [
    {
      role: "OWNER",
      title: "Pronari i Kompanisë & Administratori",
      points: [
        "Krijoni dhe menaxhoni çdo llogari përdoruesi nga Administrimi → Përdoruesit — kjo është e vetmja mënyrë se si krijohen llogaritë.",
        "Caktoni role dhe mënyra aksesi (Standarde, Vetëm-Shikim, Pezulluar) për secilin person.",
        "Shqyrtoni ftesat në pritje dhe aktivitetin e fundit të sigurisë nga paneli i Administratorit.",
        "Vetëm Pronari mund të kërkojë fshirjen e kompanisë ose transferimin e pronësisë.",
      ],
    },
    {
      role: "CEO",
      title: "CEO / Ekzekutivi",
      points: [
        "Paneli juaj tregon projektet aktive, të ardhurat, miratimet në pritje dhe rreziqet e hapura me një shikim — klikoni çdo pllakë për të kaluar te lista e filtruar pas saj.",
        "Përmbledhja e Projekteve liston çdo projekt aktiv me shirita progresi të gjallë, të marrë nga përfundimi real i detyrave, jo nga futja manuale.",
        "Përmbledhja Financiare paraqet të ardhurat kundrejt shpenzimeve muaj pas muaji.",
      ],
    },
    {
      role: "ARCHITECT",
      title: "Arkitekti / Inxhinieri",
      points: [
        "Ndiqni paketat e vizatimeve, rishikimet dhe kërkesat për informacion nga paneli juaj — secila ka status të qartë (Draft, Në Shqyrtim, Miratuar, Kërkon Rishikim).",
        "Një rishikim vizatimi që kërkon ripunim shfaqet si 'Kërkon Rishikim' deri sa të dorëzohet një version i ri.",
        "Kërkesat për informacion të hapura më gjatë se afati i tyre shënohen që asgjë të mos harrohet.",
      ],
    },
    {
      role: "FINANCE",
      title: "Financa",
      points: [
        "Faturat e shitjes, faturat e blerjes dhe pagesat ndahen që të shihni me një shikim paranë hyrëse kundrejt daljes.",
        "Çdo faturë ndjek një cikël: Draft → Dërguar → Miratuar → Postuar. Pasi postohet, ajo kyçet — korrigjimet bëhen përmes një storno, kurrë me ndryshim të heshtur.",
        "Rrjedha e Parasë dhe Buxheti kundrejt Realizimit ju japin të njëjtat shifra në dy këndvështrime të ndryshme.",
      ],
    },
    {
      role: "HR",
      title: "Burimet Njerëzore",
      points: [
        "Të dhënat e punonjësve, kërkesat për leje dhe shpërndarja sipas departamentit gjenden të gjitha në një panel.",
        "'Në Leje' pasqyron kërkesat e miratuara për leje që mbulojnë ditën e sotme — jo një flamur i mbajtur manualisht, kështu që është gjithmonë i saktë.",
        "Rekrutimi dhe ndjekja e prezencës janë të planifikuara për një fazë të mëvonshme.",
      ],
    },
  ],
  faq: [
    {
      q: "Pse nuk mund ta ndryshoj një faturë pasi është postuar?",
      a: "Postimi është një veprim i qëllimshëm dhe final (modeli i integritetit të transaksioneve të Nesto-s). Pasi postohet, një regjistrim kyçet për të mbrojtur historikun tuaj financiar — korrigjimet bëhen përmes një storno, që krijon një regjistrim të ri të lidhur, në vend që të ndryshojë origjinalin në heshtje.",
    },
    {
      q: "Kërkova diçka dhe shfaqet e kyçur. Çfarë do të thotë kjo?",
      a: "Regjistrimi ekziston, por aktualisht nuk keni leje ta hapni. Mund të kërkoni akses me një arsye; pronari i regjistrimit ose një miratues vendos nëse do ta japë, dhe kërkesa regjistrohet në të dyja rastet.",
    },
    {
      q: "A mund ta ndryshoj gjuhën vetëm për llogarinë time?",
      a: "Po — përdorni ndërruesin e gjuhës në krye ose te Cilësimet e Llogarisë. Ndikon vetëm në sesionin tuaj; nuk ndryshon atë që shohin përdoruesit e tjerë.",
    },
    {
      q: "Pse nuk ka shkurtore tastiere për veprimet e zakonshme?",
      a: "Ky është një vendim i qëllimshëm për këtë version — çdo veprim është i arritshëm me miun ose me prekje, që ndërfaqja të mbetet e lehtë për t'u përdorur pavarësisht nivelit të përvojës. Shkurtoret mund të vijnë më vonë.",
    },
    {
      q: "Kush mund të krijojë llogari të reja përdoruesish?",
      a: "Vetëm Pronari i Kompanisë ose një Administrator i Kompanisë. Nuk ka regjistrim publik për një hapësirë kompanie — kjo bën që çdo llogari të jetë e gjurmueshme te personi që e krijoi.",
    },
  ],
};

export function getHelpContent(locale: Locale): HelpContent {
  return locale === "sq" ? sq : en;
}
