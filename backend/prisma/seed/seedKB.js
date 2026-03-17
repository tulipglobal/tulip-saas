require('dotenv').config()
const prisma = require('../../lib/client')

/* ─────────────────────────────────────────────────────────────
   KNOWLEDGE BASE SEED — Categories + Articles
   Run: node backend/prisma/seed/seedKB.js
   ───────────────────────────────────────────────────────────── */

const NGO_CATEGORIES = [
  { name: 'Getting Started', slug: 'getting-started', description: 'Everything you need to set up and start using Sealayer', icon: '🚀', targetRole: 'ngo', order: 1 },
  { name: 'Projects & Budgets', slug: 'projects-budgets', description: 'Create projects, set budgets and track financial health', icon: '📊', targetRole: 'ngo', order: 2 },
  { name: 'Expenses', slug: 'expenses', description: 'Record, manage and seal expenses with blockchain verification', icon: '💰', targetRole: 'ngo', order: 3 },
  { name: 'Funding & Donors', slug: 'funding-donors', description: 'Manage funding agreements, tranches and donor relationships', icon: '🤝', targetRole: 'ngo', order: 4 },
  { name: 'Documents', slug: 'documents', description: 'Upload, manage and share project documents securely', icon: '📄', targetRole: 'ngo', order: 5 },
  { name: 'Impact & Reporting', slug: 'impact-reporting', description: 'Logframes, impact metrics, risk registers and reports', icon: '📈', targetRole: 'ngo', order: 6 },
  { name: 'Impact Investment', slug: 'impact-investment', description: 'Investment opportunities, drawdowns and repayment tracking', icon: '💼', targetRole: 'ngo', order: 7 },
  { name: 'Blockchain & Verification', slug: 'blockchain-verification', description: 'How Sealayer anchors data to the blockchain for transparency', icon: '🔗', targetRole: 'ngo', order: 8 },
  { name: 'Currency & Exchange Rates', slug: 'currency-exchange', description: 'Multi-currency support, exchange rates and conversions', icon: '💱', targetRole: 'ngo', order: 9 },
  { name: 'Messenger', slug: 'messenger', description: 'Real-time communication with donors', icon: '💬', targetRole: 'ngo', order: 10 },
  { name: 'Settings & Admin', slug: 'settings-admin', description: 'Team permissions, API keys, SSO and platform settings', icon: '⚙️', targetRole: 'ngo', order: 11 },
]

const DONOR_CATEGORIES = [
  { name: 'Getting Started', slug: 'donor-getting-started', description: 'Welcome to the Sealayer donor portal', icon: '🚀', targetRole: 'donor', order: 1 },
  { name: 'Verification & Trust', slug: 'verification-trust', description: 'Verify transactions and understand trust scores', icon: '✅', targetRole: 'donor', order: 2 },
  { name: 'Funding & Tranches', slug: 'donor-funding-tranches', description: 'Review agreements, approve tranches and track funding', icon: '💰', targetRole: 'donor', order: 3 },
  { name: 'Flags & Challenges', slug: 'flags-challenges', description: 'Raise flags on expenses and resolve challenges', icon: '🚩', targetRole: 'donor', order: 4 },
  { name: 'Impact Investment', slug: 'donor-impact-investment', description: 'Review proposals, approve investments and track returns', icon: '💼', targetRole: 'donor', order: 5 },
  { name: 'Reports & Data', slug: 'donor-reports-data', description: 'Generate reports and download your data', icon: '📊', targetRole: 'donor', order: 6 },
  { name: 'Messenger & Communication', slug: 'donor-messenger', description: 'Communicate with your NGO partners', icon: '💬', targetRole: 'donor', order: 7 },
]

const NGO_ARTICLES = [
  // ── Getting Started ──────────────────────────────────────
  {
    title: 'What is Sealayer and how does it work',
    slug: 'what-is-sealayer',
    category: 'getting-started',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>What is Sealayer?</h2>
<p>Sealayer is a transparency platform designed specifically for NGOs and their donors. It provides an immutable audit trail for every financial transaction, anchored to the Polygon blockchain, so donors can independently verify how funds are being used.</p>
<h3>How it works</h3>
<p>Every action you take on Sealayer — recording an expense, uploading a document, releasing a tranche — is logged in an immutable audit trail. These audit entries are:</p>
<ul>
<li><strong>SHA-256 hashed</strong> to create a unique fingerprint of the data</li>
<li><strong>Batched into a Merkle tree</strong> every 5 minutes</li>
<li><strong>Anchored to the Polygon blockchain</strong> with a transaction hash</li>
<li><strong>RFC 3161 timestamped</strong> for legal-grade proof of when data existed</li>
</ul>
<p>This means no one — not even Sealayer — can alter historical records. Donors can verify any transaction independently using the public verification page at <strong>verify.sealayer.io</strong>.</p>
<h3>Key features</h3>
<ul>
<li><strong>Project management</strong> — Create projects with budgets, CapEx/OpEx breakdown, and donor linkage</li>
<li><strong>Expense tracking</strong> — Record expenses with receipt uploads and automatic blockchain sealing</li>
<li><strong>Funding agreements</strong> — Set up tranches with conditions that donors can approve</li>
<li><strong>Document management</strong> — Upload, share and track project documents with expiry alerts</li>
<li><strong>Impact reporting</strong> — Logframes, impact metrics and automated donor reports</li>
<li><strong>Real-time messenger</strong> — Communicate directly with donors within the platform</li>
</ul>
<h3>Who is it for?</h3>
<p>Sealayer is built for NGOs who want to demonstrate financial transparency to their donors, and for donors who want verifiable proof that funds are being used as intended. The platform is used by organisations across the humanitarian, development and social enterprise sectors.</p>`
  },
  {
    title: 'Setting up your organisation profile',
    slug: 'setting-up-organisation',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Setting up your organisation profile</h2>
<p>Your organisation profile is the first thing donors see when they interact with you on Sealayer. A complete profile builds trust and credibility.</p>
<h3>Step 1: Access your profile</h3>
<p>Navigate to <strong>Settings → Organisation</strong> from the sidebar. You will see your organisation's current details.</p>
<h3>Step 2: Complete your details</h3>
<ul>
<li><strong>Organisation name</strong> — Your official registered name</li>
<li><strong>Logo</strong> — Upload a square logo (recommended 256x256px or larger)</li>
<li><strong>Country</strong> — Your primary country of operation</li>
<li><strong>Registration number</strong> — Your NGO registration or charity number</li>
<li><strong>Website</strong> — Your organisation's website URL</li>
<li><strong>Description</strong> — A brief summary of your mission and activities</li>
</ul>
<h3>Step 3: Set your base currency</h3>
<p>Your base currency is the default currency used across all projects. This can be overridden per project if needed. Go to <strong>Settings → Currency</strong> to configure this.</p>
<h3>Step 4: Save</h3>
<p>Click <strong>Save Changes</strong>. Your profile is now visible to any donor linked to your projects.</p>`
  },
  {
    title: 'Inviting team members',
    slug: 'inviting-team-members',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Inviting team members</h2>
<p>Sealayer supports role-based access control (RBAC), allowing you to invite team members with specific permissions tailored to their responsibilities.</p>
<h3>How to invite a team member</h3>
<ol>
<li>Go to <strong>Settings → Team</strong></li>
<li>Click <strong>Invite Member</strong></li>
<li>Enter their email address</li>
<li>Select a role (Admin, Manager, Member, or Viewer)</li>
<li>Click <strong>Send Invitation</strong></li>
</ol>
<p>The invited user will receive an email with a link to create their account and join your organisation.</p>
<h3>Understanding roles</h3>
<ul>
<li><strong>Admin</strong> — Full access to all features including team management, settings, and API keys</li>
<li><strong>Manager</strong> — Can create and manage projects, expenses, and documents. Cannot manage team or settings</li>
<li><strong>Member</strong> — Can record expenses and upload documents for assigned projects</li>
<li><strong>Viewer</strong> — Read-only access to all projects and reports</li>
</ul>
<h3>Managing permissions</h3>
<p>Permissions are granular and string-based (e.g. <code>projects:read</code>, <code>expenses:write</code>). Admins can customise role permissions under <strong>Settings → Roles & Permissions</strong>.</p>`
  },
  {
    title: 'Understanding your dashboard',
    slug: 'understanding-dashboard',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Understanding your dashboard</h2>
<p>Your dashboard is the central hub of Sealayer, giving you an at-a-glance view of your organisation's activity and financial health.</p>
<h3>Dashboard sections</h3>
<ul>
<li><strong>Overview cards</strong> — Total projects, total budget, total expenses, and remaining balance</li>
<li><strong>Recent activity</strong> — The latest audit log entries across your organisation</li>
<li><strong>Project health</strong> — A quick view of project statuses (on track, at risk, over budget)</li>
<li><strong>Pending actions</strong> — Items requiring your attention (tranche approvals, document expiries, etc.)</li>
<li><strong>Blockchain status</strong> — The latest anchoring batch and transaction hash</li>
</ul>
<h3>Filtering</h3>
<p>Use the date range picker to filter dashboard data to a specific period. You can also filter by project to see metrics for a single project.</p>
<h3>Quick actions</h3>
<p>The dashboard supports quick actions via the <strong>Cmd+K</strong> shortcut, allowing you to quickly navigate to any page, create a new expense, or search for a project.</p>`
  },
  {
    title: 'Your first project — step by step',
    slug: 'first-project',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Your first project — step by step</h2>
<p>This guide walks you through creating your first project on Sealayer, from start to finish.</p>
<h3>Step 1: Create the project</h3>
<ol>
<li>Click <strong>Projects</strong> in the sidebar</li>
<li>Click <strong>New Project</strong></li>
<li>Enter a project name, description, start date and end date</li>
<li>Select the project currency (defaults to your base currency)</li>
<li>Click <strong>Create Project</strong></li>
</ol>
<h3>Step 2: Set up the budget</h3>
<ol>
<li>Open your new project</li>
<li>Go to the <strong>Budget</strong> tab</li>
<li>Add budget lines with categories (CapEx or OpEx)</li>
<li>Set amounts for each line</li>
</ol>
<h3>Step 3: Link a donor</h3>
<ol>
<li>Go to the <strong>Funding</strong> tab</li>
<li>Click <strong>Add Funding Agreement</strong></li>
<li>Enter the donor name, agreement amount, and currency</li>
<li>Set up tranches with conditions if needed</li>
</ol>
<h3>Step 4: Record your first expense</h3>
<ol>
<li>Go to <strong>Expenses</strong> in the sidebar</li>
<li>Click <strong>New Expense</strong></li>
<li>Select the project, enter details, and upload a receipt</li>
<li>Click <strong>Save</strong> — the expense is automatically sealed to the blockchain</li>
</ol>
<h3>Step 5: Invite the donor</h3>
<p>Send the donor an invitation to view your project. They will be able to see all expenses, documents and blockchain seals in real time.</p>`
  },
  {
    title: 'Understanding blockchain verification on Sealayer',
    slug: 'blockchain-verification-intro',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Understanding blockchain verification</h2>
<p>Sealayer uses the Polygon blockchain to create an immutable, verifiable record of your financial data. This is what makes Sealayer different from traditional reporting tools.</p>
<h3>What gets anchored?</h3>
<p>Every significant action on Sealayer generates an audit log entry. These entries are:</p>
<ol>
<li><strong>Hashed</strong> — Each entry is SHA-256 hashed to create a unique digital fingerprint</li>
<li><strong>Batched</strong> — Every 5 minutes, pending entries are combined into a Merkle tree</li>
<li><strong>Anchored</strong> — The Merkle root is written to the Polygon blockchain as a transaction</li>
<li><strong>Timestamped</strong> — An RFC 3161 timestamp provides legal-grade proof of when the data existed</li>
</ol>
<h3>What does this mean for you?</h3>
<p>Once data is anchored, it cannot be changed or deleted — not even by Sealayer. This provides donors with independent, verifiable proof that your financial records are authentic and unaltered.</p>
<h3>Verification</h3>
<p>Anyone with a transaction hash can verify it on the public page at <strong>verify.sealayer.io</strong>. No login required. This is how donors independently confirm the integrity of your data.</p>`
  },

  // ── Projects & Budgets ──────────────────────────────────
  {
    title: 'Creating a project',
    slug: 'creating-project',
    category: 'projects-budgets',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Creating a project</h2>
<p>Projects are the core organisational unit in Sealayer. Every expense, document and funding agreement is linked to a project.</p>
<h3>How to create a project</h3>
<ol>
<li>Navigate to <strong>Projects</strong> in the sidebar</li>
<li>Click <strong>New Project</strong></li>
<li>Fill in the required fields:
<ul>
<li><strong>Project name</strong> — A clear, descriptive name</li>
<li><strong>Description</strong> — What the project aims to achieve</li>
<li><strong>Start date</strong> and <strong>End date</strong></li>
<li><strong>Currency</strong> — The project's operating currency</li>
<li><strong>Status</strong> — Active, Planning, or On Hold</li>
</ul>
</li>
<li>Click <strong>Create</strong></li>
</ol>
<p>Once created, you can set up the budget, link donors, and start recording expenses.</p>`
  },
  {
    title: 'Setting up a project budget',
    slug: 'project-budget',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Setting up a project budget</h2>
<p>Budgets in Sealayer are broken down into line items categorised as CapEx (capital expenditure) or OpEx (operating expenditure). This breakdown helps donors understand how funds are allocated.</p>
<h3>Adding budget lines</h3>
<ol>
<li>Open your project and go to the <strong>Budget</strong> tab</li>
<li>Click <strong>Add Budget Line</strong></li>
<li>Enter a description (e.g. "Vehicle purchase", "Staff salaries")</li>
<li>Select the type: <strong>CapEx</strong> or <strong>OpEx</strong></li>
<li>Enter the budgeted amount</li>
<li>Click <strong>Save</strong></li>
</ol>
<h3>Budget tracking</h3>
<p>As you record expenses, the budget view automatically updates to show spent vs remaining amounts. The project health indicator reflects budget utilisation — projects over 90% utilisation are flagged as "at risk".</p>`
  },
  {
    title: 'CapEx vs OpEx — what is the difference',
    slug: 'capex-vs-opex',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>CapEx vs OpEx</h2>
<p>Understanding the difference between Capital Expenditure (CapEx) and Operating Expenditure (OpEx) is important for budget reporting and donor compliance.</p>
<h3>CapEx — Capital Expenditure</h3>
<p>Spending on long-term assets that provide value over time. Examples include:</p>
<ul>
<li>Vehicles</li>
<li>Equipment and machinery</li>
<li>Building construction or renovation</li>
<li>IT infrastructure</li>
</ul>
<h3>OpEx — Operating Expenditure</h3>
<p>Day-to-day running costs required to operate the project. Examples include:</p>
<ul>
<li>Staff salaries</li>
<li>Office rent and utilities</li>
<li>Travel and per diem</li>
<li>Supplies and materials</li>
<li>Training and workshops</li>
</ul>
<h3>Why it matters</h3>
<p>Many donors have specific requirements about the CapEx/OpEx ratio. Sealayer's budget breakdown makes it easy to demonstrate compliance with these requirements and generate reports that show exactly how funds are split.</p>`
  },
  {
    title: 'Linking donors to a project',
    slug: 'linking-donors',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Linking donors to a project</h2>
<p>Linking a donor to your project creates a funding agreement and gives the donor visibility into the project's financial activity.</p>
<h3>Steps</h3>
<ol>
<li>Open the project and go to the <strong>Funding</strong> tab</li>
<li>Click <strong>Add Funding Agreement</strong></li>
<li>Select or create the donor organisation</li>
<li>Enter the total funding amount and currency</li>
<li>Set up tranches if the funding is released in stages</li>
<li>Click <strong>Create Agreement</strong></li>
</ol>
<p>Once linked, the donor will be able to see the project on their donor portal, including all expenses, documents and blockchain verification data.</p>`
  },
  {
    title: 'Project health and status indicators',
    slug: 'project-health',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Project health and status indicators</h2>
<p>Sealayer automatically calculates project health based on budget utilisation, timeline progress and activity.</p>
<h3>Status indicators</h3>
<ul>
<li><strong>On Track</strong> (green) — Budget utilisation is within expected range for the project timeline</li>
<li><strong>At Risk</strong> (amber) — Budget utilisation is higher than expected, or the project is falling behind schedule</li>
<li><strong>Over Budget</strong> (red) — Expenses have exceeded the allocated budget</li>
<li><strong>Completed</strong> — The project has been marked as complete</li>
<li><strong>Archived</strong> — The project has been archived and is read-only</li>
</ul>
<h3>How health is calculated</h3>
<p>Project health considers: percentage of budget spent vs percentage of timeline elapsed, document expiry status, and whether required reports have been submitted on time.</p>`
  },
  {
    title: 'Archiving and closing a project',
    slug: 'archiving-projects',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Archiving and closing a project</h2>
<p>When a project is complete, you can close and archive it. Archived projects are read-only — all data, documents and blockchain seals are preserved permanently.</p>
<h3>Closing a project</h3>
<ol>
<li>Open the project and go to <strong>Settings</strong></li>
<li>Change the status to <strong>Completed</strong></li>
<li>Generate a final report for your donors</li>
<li>Click <strong>Archive Project</strong></li>
</ol>
<p>Archived projects remain visible in your project list with a filter, and all blockchain verification links continue to work indefinitely.</p>`
  },

  // ── Expenses ────────────────────────────────────────────
  {
    title: 'Recording an expense',
    slug: 'recording-expense',
    category: 'expenses',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Recording an expense</h2>
<p>Expenses in Sealayer are the core financial records that get sealed to the blockchain. Each expense is linked to a project and a budget line.</p>
<h3>How to record an expense</h3>
<ol>
<li>Go to <strong>Expenses</strong> in the sidebar</li>
<li>Click <strong>New Expense</strong></li>
<li>Select the <strong>project</strong></li>
<li>Choose the <strong>budget category</strong> (CapEx or OpEx line)</li>
<li>Enter the <strong>amount</strong> and <strong>currency</strong></li>
<li>Add a <strong>description</strong></li>
<li>Select the <strong>date</strong> of the expense</li>
<li>Upload a <strong>receipt</strong> (photo or PDF)</li>
<li>Click <strong>Save</strong></li>
</ol>
<p>The expense is immediately recorded in the audit trail and will be anchored to the Polygon blockchain in the next batch cycle (every 5 minutes).</p>`
  },
  {
    title: 'Uploading receipts and documents',
    slug: 'uploading-receipts',
    category: 'expenses',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Uploading receipts and documents</h2>
<p>Every expense should have supporting documentation. Sealayer stores receipts securely in S3 with SHA-256 integrity verification.</p>
<h3>Supported formats</h3>
<ul>
<li>Images: PNG, JPG, WebP</li>
<li>Documents: PDF</li>
<li>Maximum file size: 10MB per file</li>
</ul>
<h3>How to upload</h3>
<p>When creating or editing an expense, click the <strong>Upload Receipt</strong> button or drag and drop a file into the upload area. Sealayer automatically generates a SHA-256 hash of the file to ensure integrity.</p>
<h3>OCR scanning</h3>
<p>Sealayer includes OCR (Optical Character Recognition) that can automatically extract amounts, dates and vendor information from receipts. This data is compared against the expense entry to flag any mismatches.</p>`
  },
  {
    title: 'Expense categories explained',
    slug: 'expense-categories',
    category: 'expenses',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Expense categories explained</h2>
<p>Expense categories help organise your spending and make reporting clearer for donors.</p>
<h3>Default categories</h3>
<ul>
<li><strong>Personnel</strong> — Salaries, benefits, consultants</li>
<li><strong>Travel</strong> — Transportation, accommodation, per diem</li>
<li><strong>Equipment</strong> — Hardware, vehicles, machinery</li>
<li><strong>Supplies</strong> — Office supplies, materials</li>
<li><strong>Services</strong> — Professional services, subscriptions</li>
<li><strong>Facilities</strong> — Rent, utilities, maintenance</li>
<li><strong>Training</strong> — Workshops, courses, capacity building</li>
<li><strong>Other</strong> — Miscellaneous expenses</li>
</ul>
<p>Categories map to your budget lines, so each expense is tracked against the correct budget allocation.</p>`
  },
  {
    title: 'Editing and deleting expenses',
    slug: 'editing-expenses',
    category: 'expenses',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Editing and deleting expenses</h2>
<p>You can edit expense details after creation, but it is important to understand how this interacts with the audit trail.</p>
<h3>Editing an expense</h3>
<p>Open the expense and click <strong>Edit</strong>. You can change the amount, description, category, or receipt. Every edit creates a new audit log entry — the original record is preserved in the blockchain.</p>
<h3>Deleting an expense</h3>
<p>Deleted expenses are soft-deleted — they are marked as removed but the audit trail entry remains. Donors can still see that an expense was recorded and then deleted, which preserves full transparency.</p>
<p><strong>Important:</strong> Sealed expenses cannot be permanently deleted. The blockchain record is immutable.</p>`
  },
  {
    title: 'Understanding expense seals',
    slug: 'expense-seals',
    category: 'expenses',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Understanding expense seals</h2>
<p>Every expense on Sealayer receives a Trust Seal — a blockchain-anchored proof that the expense data is authentic and unaltered.</p>
<h3>Seal status indicators</h3>
<ul>
<li><strong>Pending</strong> — The expense has been recorded but not yet anchored (within the next 5-minute batch)</li>
<li><strong>Sealed</strong> — The expense has been anchored to the Polygon blockchain with a transaction hash</li>
<li><strong>Verified</strong> — The seal has been independently verified</li>
</ul>
<h3>What a seal contains</h3>
<p>Each seal includes: the SHA-256 hash of the expense data, the Merkle proof linking it to the batch root, the Polygon transaction hash, and the RFC 3161 timestamp.</p>
<h3>Sharing a seal</h3>
<p>Click the seal icon on any expense to copy the verification link. Anyone with this link can verify the expense on verify.sealayer.io without needing a Sealayer account.</p>`
  },
  {
    title: 'Bulk expense management',
    slug: 'bulk-expenses',
    category: 'expenses',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Bulk expense management</h2>
<p>For organisations processing high volumes of expenses, Sealayer supports bulk operations.</p>
<h3>Bulk upload</h3>
<p>You can upload multiple expenses at once using a CSV file. Go to <strong>Expenses → Import</strong> and download the template CSV. Fill in the required columns (project, amount, date, category, description) and upload the completed file.</p>
<h3>Bulk actions</h3>
<p>Select multiple expenses using the checkboxes in the expense list to:</p>
<ul>
<li>Change category for multiple expenses</li>
<li>Export selected expenses to CSV or PDF</li>
<li>Generate a report for selected expenses</li>
</ul>`
  },

  // ── Funding & Donors ────────────────────────────────────
  {
    title: 'Creating a funding agreement',
    slug: 'creating-funding-agreement',
    category: 'funding-donors',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Creating a funding agreement</h2>
<p>A funding agreement on Sealayer represents a commitment from a donor to fund your project. It defines the total amount, currency, and how the funding will be released.</p>
<h3>Steps</h3>
<ol>
<li>Open your project and go to the <strong>Funding</strong> tab</li>
<li>Click <strong>New Funding Agreement</strong></li>
<li>Select or create the donor organisation</li>
<li>Enter the agreement reference number (optional)</li>
<li>Set the total amount and donor currency</li>
<li>Choose how funds will be released: <strong>Lump sum</strong> or <strong>Tranches</strong></li>
<li>Click <strong>Create</strong></li>
</ol>
<p>The agreement is recorded in the audit trail and the donor will see it on their portal.</p>`
  },
  {
    title: 'Setting up tranches',
    slug: 'setting-up-tranches',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Setting up tranches</h2>
<p>Tranches allow you to structure funding releases in stages, each with optional conditions that must be met before the funds are released.</p>
<h3>Adding tranches</h3>
<ol>
<li>In the funding agreement, click <strong>Add Tranche</strong></li>
<li>Enter the tranche amount</li>
<li>Set the expected release date</li>
<li>Add conditions if required (e.g. "Submit Q1 report", "Complete training programme")</li>
<li>Click <strong>Save</strong></li>
</ol>
<p>You can add as many tranches as needed. The total of all tranches should equal the funding agreement amount.</p>
<h3>Tranche statuses</h3>
<ul>
<li><strong>Pending</strong> — Awaiting conditions to be met</li>
<li><strong>Requested</strong> — Conditions met, awaiting donor approval</li>
<li><strong>Approved</strong> — Donor has approved the release</li>
<li><strong>Released</strong> — Funds have been disbursed</li>
</ul>`
  },
  {
    title: 'Tranche conditions — how they work',
    slug: 'tranche-conditions',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Tranche conditions</h2>
<p>Conditions are requirements that must be fulfilled before a tranche can be released. They give donors confidence that milestones are being met.</p>
<h3>Types of conditions</h3>
<ul>
<li><strong>Document submission</strong> — A specific document must be uploaded (e.g. quarterly report)</li>
<li><strong>Milestone completion</strong> — A project milestone must be marked as complete</li>
<li><strong>Custom</strong> — Any text-based condition (e.g. "Government approval received")</li>
</ul>
<h3>Fulfilling conditions</h3>
<p>When a condition is met, mark it as fulfilled in the tranche view. Attach any supporting evidence. The donor will be notified and can review the evidence before approving the tranche release.</p>`
  },
  {
    title: 'Releasing a tranche',
    slug: 'releasing-tranche',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Releasing a tranche</h2>
<p>Once all conditions for a tranche are met, you can request the release from the donor.</p>
<h3>Process</h3>
<ol>
<li>Ensure all tranche conditions are marked as fulfilled</li>
<li>Click <strong>Request Release</strong> on the tranche</li>
<li>The donor receives a notification on their portal</li>
<li>The donor reviews the evidence and approves or requests changes</li>
<li>Once approved, mark the tranche as <strong>Released</strong> when funds are received</li>
</ol>
<p>Every step in this process is recorded in the immutable audit trail.</p>`
  },
  {
    title: 'Inviting a donor to your project',
    slug: 'inviting-donor',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Inviting a donor to your project</h2>
<p>Inviting a donor gives them access to the donor portal where they can view your project's financial data, documents and blockchain verification in real time.</p>
<h3>Steps</h3>
<ol>
<li>Go to the project's <strong>Funding</strong> tab</li>
<li>Find the funding agreement for the donor</li>
<li>Click <strong>Invite Donor</strong></li>
<li>Enter the donor contact's email address</li>
<li>Click <strong>Send Invitation</strong></li>
</ol>
<p>The donor will receive an email with a link to access the donor portal at donor.sealayer.io.</p>`
  },
  {
    title: 'Understanding donor currency and reporting currency',
    slug: 'donor-currency',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Understanding donor currency and reporting currency</h2>
<p>Sealayer supports multi-currency operations. Each project can have a base currency (the currency you operate in) and each donor can have a different reporting currency.</p>
<h3>How it works</h3>
<ul>
<li><strong>Project base currency</strong> — The currency expenses are recorded in (e.g. KES, UGX)</li>
<li><strong>Donor reporting currency</strong> — The currency the donor wants to see reports in (e.g. USD, EUR)</li>
<li><strong>Exchange rates</strong> — Sealayer uses monthly exchange rates that are sealed to the blockchain</li>
</ul>
<p>When a donor views a report, all amounts are automatically converted from the project base currency to their reporting currency using the sealed exchange rate for that month.</p>`
  },
  {
    title: 'Managing multiple donors on one project',
    slug: 'multiple-donors',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 7,
    content: `<h2>Managing multiple donors on one project</h2>
<p>Sealayer supports multiple funding agreements on a single project, each with its own donor, amount, currency and tranches.</p>
<h3>How it works</h3>
<p>Each donor sees only the financial data relevant to their funding agreement. This means you can have USAID funding one part of a project in USD and DFID funding another part in GBP, with each donor seeing reports in their own currency.</p>
<h3>Budget allocation</h3>
<p>When you have multiple donors, you can allocate specific budget lines to specific donors. This ensures each donor can see exactly how their funds are being used.</p>`
  },

  // ── Documents ───────────────────────────────────────────
  {
    title: 'Uploading project documents',
    slug: 'uploading-documents',
    category: 'documents',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Uploading project documents</h2>
<p>Sealayer stores all project documents securely in S3 with SHA-256 integrity verification and blockchain anchoring.</p>
<h3>How to upload</h3>
<ol>
<li>Go to <strong>Documents</strong> in the sidebar</li>
<li>Click <strong>Upload Document</strong></li>
<li>Select the project</li>
<li>Choose the document type (Contract, Report, Invoice, Certificate, Other)</li>
<li>Add a title and optional description</li>
<li>Set an expiry date if applicable</li>
<li>Drag and drop or browse to select the file</li>
<li>Click <strong>Upload</strong></li>
</ol>
<p>The document is stored in S3, hashed, and anchored to the blockchain. A presigned URL is generated for secure access.</p>`
  },
  {
    title: 'Document expiry and alerts',
    slug: 'document-expiry',
    category: 'documents',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Document expiry and alerts</h2>
<p>Some documents have expiry dates — contracts, insurance certificates, licences, etc. Sealayer tracks these and alerts you before they expire.</p>
<h3>Setting expiry dates</h3>
<p>When uploading a document, set the <strong>Expiry Date</strong> field. Sealayer will send in-app notifications:</p>
<ul>
<li><strong>30 days before</strong> expiry — Early warning</li>
<li><strong>7 days before</strong> expiry — Urgent reminder</li>
<li><strong>On expiry</strong> — Document marked as expired</li>
</ul>
<p>Expired documents are flagged in the document list and on the dashboard.</p>`
  },
  {
    title: 'Sharing documents with donors',
    slug: 'sharing-documents',
    category: 'documents',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Sharing documents with donors</h2>
<p>Documents linked to a project are automatically visible to donors who have a funding agreement on that project. You can also share individual documents with specific donors.</p>
<h3>Sharing options</h3>
<ul>
<li><strong>Project-level sharing</strong> — All documents on a project are visible to linked donors by default</li>
<li><strong>Direct sharing</strong> — Share a specific document via the messenger or by generating a secure download link</li>
<li><strong>Presigned URLs</strong> — Time-limited download links that expire after a set period</li>
</ul>`
  },
  {
    title: 'OCR and document scanning',
    slug: 'ocr-scanning',
    category: 'documents',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>OCR and document scanning</h2>
<p>Sealayer includes Optical Character Recognition (OCR) to automatically extract data from uploaded receipts and documents.</p>
<h3>What OCR extracts</h3>
<ul>
<li><strong>Amount</strong> — The total amount on a receipt or invoice</li>
<li><strong>Date</strong> — The date of the transaction</li>
<li><strong>Vendor name</strong> — The merchant or supplier name</li>
<li><strong>Currency</strong> — The currency shown on the document</li>
</ul>
<h3>Mismatch detection</h3>
<p>If the OCR-extracted data does not match the expense entry (e.g. the receipt shows $500 but the expense is recorded as $50), Sealayer flags the mismatch. This helps catch data entry errors and improves accuracy.</p>`
  },

  // ── Impact & Reporting ──────────────────────────────────
  {
    title: 'Setting up a logframe',
    slug: 'logframe',
    category: 'impact-reporting',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Setting up a logframe</h2>
<p>A logframe (logical framework) is a structured tool for planning and monitoring your project's goals, outcomes, outputs and activities.</p>
<h3>Creating a logframe</h3>
<ol>
<li>Open your project and go to the <strong>Impact</strong> tab</li>
<li>Click <strong>Create Logframe</strong></li>
<li>Define your <strong>Goal</strong> — the high-level impact you aim to achieve</li>
<li>Add <strong>Outcomes</strong> — the changes you expect to see</li>
<li>Add <strong>Outputs</strong> — the deliverables that lead to outcomes</li>
<li>Add <strong>Activities</strong> — the actions required to produce outputs</li>
<li>For each level, define <strong>Indicators</strong>, <strong>Means of Verification</strong>, and <strong>Assumptions</strong></li>
</ol>
<p>The logframe is visible to donors and provides a structured framework for understanding your project's theory of change.</p>`
  },
  {
    title: 'Recording impact metrics',
    slug: 'impact-metrics',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Recording impact metrics</h2>
<p>Impact metrics track the measurable outcomes of your project. Record them regularly to demonstrate progress to donors.</p>
<h3>Adding metrics</h3>
<ol>
<li>Go to the <strong>Impact</strong> tab in your project</li>
<li>Click <strong>Add Metric</strong></li>
<li>Select the logframe indicator this metric relates to</li>
<li>Enter the value, date, and any notes</li>
<li>Attach supporting evidence if available</li>
<li>Click <strong>Save</strong></li>
</ol>
<p>Metrics are displayed as charts and tables in donor reports, showing progress over time.</p>`
  },
  {
    title: 'Risk register — how to use it',
    slug: 'risk-register',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Risk register</h2>
<p>The risk register helps you identify, assess and mitigate risks to your project. Proactive risk management builds donor confidence.</p>
<h3>Adding a risk</h3>
<ol>
<li>Go to the <strong>Impact</strong> tab and select <strong>Risk Register</strong></li>
<li>Click <strong>Add Risk</strong></li>
<li>Describe the risk</li>
<li>Set the <strong>likelihood</strong> (Low, Medium, High)</li>
<li>Set the <strong>impact</strong> (Low, Medium, High)</li>
<li>Define <strong>mitigation actions</strong></li>
<li>Assign an <strong>owner</strong></li>
</ol>
<p>Risks are automatically scored based on likelihood × impact and displayed in a risk matrix.</p>`
  },
  {
    title: 'Generating financial reports',
    slug: 'financial-reports',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Generating financial reports</h2>
<p>Sealayer can generate comprehensive financial reports for your projects, suitable for donor reporting and internal review.</p>
<h3>Report types</h3>
<ul>
<li><strong>Budget vs Actual</strong> — Shows budgeted amounts against actual spend per category</li>
<li><strong>Expense Summary</strong> — All expenses grouped by category, date or project</li>
<li><strong>Funding Summary</strong> — Status of all funding agreements and tranches</li>
<li><strong>NAV Report</strong> — Net Asset Value report for investment-linked projects</li>
</ul>
<h3>Generating a report</h3>
<ol>
<li>Go to <strong>Reports</strong> in the sidebar</li>
<li>Select the report type</li>
<li>Choose the project and date range</li>
<li>Click <strong>Generate</strong></li>
<li>Download as PDF or share directly with donors</li>
</ol>`
  },
  {
    title: 'Generating donor reports',
    slug: 'donor-reports',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Generating donor reports</h2>
<p>Donor reports combine financial data, impact metrics and blockchain verification into a single shareable document.</p>
<h3>What's included</h3>
<ul>
<li>Project overview and status</li>
<li>Budget vs actual spend (in the donor's reporting currency)</li>
<li>Expense breakdown by category</li>
<li>Tranche status and release history</li>
<li>Impact metrics and logframe progress</li>
<li>Blockchain verification summary with transaction hashes</li>
</ul>
<h3>Sharing</h3>
<p>Reports can be downloaded as PDF, shared via a secure link, or sent directly through the messenger. Shared report links include blockchain verification that the report content is authentic.</p>`
  },
  {
    title: 'Understanding the comparison tool',
    slug: 'comparison-tool',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Understanding the comparison tool</h2>
<p>The comparison tool lets you compare two periods side by side — useful for quarterly reviews or year-on-year analysis.</p>
<h3>How to use it</h3>
<ol>
<li>Go to <strong>Reports → Compare</strong></li>
<li>Select the project</li>
<li>Choose <strong>Period A</strong> (e.g. Q1 2025)</li>
<li>Choose <strong>Period B</strong> (e.g. Q2 2025)</li>
<li>Click <strong>Compare</strong></li>
</ol>
<p>The tool shows side-by-side columns for each period with variance calculations and percentage changes.</p>`
  },
  {
    title: 'NAV reports explained',
    slug: 'nav-reports',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 7,
    content: `<h2>NAV reports explained</h2>
<p>NAV (Net Asset Value) reports are used for impact investment projects to show the current value of investments, outstanding balances and returns.</p>
<h3>What NAV reports include</h3>
<ul>
<li>Total investment value</li>
<li>Drawdowns to date</li>
<li>Repayments made</li>
<li>Outstanding balance</li>
<li>Return on investment calculations</li>
<li>Currency conversion details</li>
</ul>
<p>NAV reports are generated from the <strong>Reports</strong> section and can be shared with investors through the platform.</p>`
  },

  // ── Impact Investment ───────────────────────────────────
  {
    title: 'What is impact investment on Sealayer',
    slug: 'what-is-impact-investment',
    category: 'impact-investment',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>What is impact investment on Sealayer</h2>
<p>Impact investment on Sealayer allows organisations to receive investment capital (not grants) with defined repayment schedules and returns. Unlike traditional grants, investments are structured as financial instruments with expected repayment.</p>
<h3>Key concepts</h3>
<ul>
<li><strong>Investment opportunity</strong> — A proposal you create describing the investment, expected returns, and use of funds</li>
<li><strong>Drawdown</strong> — A request to draw funds from the approved investment</li>
<li><strong>Repayment schedule</strong> — The agreed timeline for repaying the investment with returns</li>
<li><strong>Outstanding balance</strong> — The remaining amount to be repaid</li>
</ul>
<p>All investment activity is recorded in the blockchain-anchored audit trail, providing investors with verifiable transparency.</p>`
  },
  {
    title: 'Creating an investment opportunity',
    slug: 'creating-investment',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Creating an investment opportunity</h2>
<ol>
<li>Go to <strong>Impact Investment</strong> in the sidebar</li>
<li>Click <strong>New Opportunity</strong></li>
<li>Enter the investment details: title, description, total amount, currency</li>
<li>Define the expected return rate</li>
<li>Set the repayment timeline</li>
<li>Add any supporting documents</li>
<li>Click <strong>Submit for Review</strong></li>
</ol>
<p>The opportunity will be visible to potential investors on the platform.</p>`
  },
  {
    title: 'Drawdown requests',
    slug: 'drawdown-requests',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Drawdown requests</h2>
<p>A drawdown is a request to release funds from an approved investment. You can request partial or full drawdowns based on your needs.</p>
<h3>Making a drawdown request</h3>
<ol>
<li>Open the investment agreement</li>
<li>Click <strong>Request Drawdown</strong></li>
<li>Enter the amount and purpose</li>
<li>The investor reviews and approves the drawdown</li>
</ol>
<p>Each drawdown is recorded in the audit trail with blockchain anchoring.</p>`
  },
  {
    title: 'Repayment schedules',
    slug: 'repayment-schedules',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Repayment schedules</h2>
<p>Repayment schedules define when and how much you will repay to the investor.</p>
<h3>Setting up repayments</h3>
<p>When creating an investment opportunity, you define the repayment schedule with:</p>
<ul>
<li><strong>Frequency</strong> — Monthly, quarterly, or custom dates</li>
<li><strong>Amount</strong> — Fixed amount or percentage of principal</li>
<li><strong>Start date</strong> — When repayments begin</li>
<li><strong>Duration</strong> — Total repayment period</li>
</ul>
<p>Sealayer tracks each repayment and updates the outstanding balance automatically.</p>`
  },
  {
    title: 'Tracking outstanding balances',
    slug: 'tracking-balances',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Tracking outstanding balances</h2>
<p>The investment dashboard shows your current outstanding balance across all investments, including:</p>
<ul>
<li>Total invested amount</li>
<li>Total drawn down</li>
<li>Total repaid</li>
<li>Outstanding balance</li>
<li>Next repayment due date and amount</li>
</ul>
<p>Both you and the investor see the same data, verified by the blockchain.</p>`
  },

  // ── Blockchain & Verification ───────────────────────────
  {
    title: 'How blockchain anchoring works on Sealayer',
    slug: 'how-anchoring-works',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>How blockchain anchoring works</h2>
<p>Sealayer uses the Polygon blockchain to anchor financial data, creating an immutable proof of record.</p>
<h3>The anchoring process</h3>
<ol>
<li><strong>Audit log creation</strong> — Every significant action creates a SHA-256 hashed audit entry</li>
<li><strong>Batching</strong> — Every 5 minutes, pending entries are collected into a batch of up to 20</li>
<li><strong>Merkle tree</strong> — A Merkle tree is constructed from the batch, producing a single root hash</li>
<li><strong>Blockchain transaction</strong> — The Merkle root is written to the Polygon blockchain</li>
<li><strong>S3 archive</strong> — The full batch data and Merkle proofs are archived in S3</li>
<li><strong>RFC 3161 timestamp</strong> — Every 10 minutes, batches receive an RFC 3161 timestamp for legal-grade proof</li>
</ol>
<h3>Why Polygon?</h3>
<p>Polygon provides fast, low-cost transactions while inheriting Ethereum's security. This makes it ideal for high-frequency anchoring at minimal cost.</p>`
  },
  {
    title: 'What is a Trust Seal',
    slug: 'what-is-trust-seal',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>What is a Trust Seal</h2>
<p>A Trust Seal is Sealayer's blockchain-anchored proof that a piece of data (expense, document, report) is authentic and unaltered. Every sealed item includes:</p>
<ul>
<li>A SHA-256 hash of the original data</li>
<li>A Merkle proof linking it to the batch root</li>
<li>The Polygon transaction hash</li>
<li>An RFC 3161 timestamp</li>
<li>A fraud risk score (if applicable)</li>
</ul>
<p>Trust Seals are the core differentiator of Sealayer — they provide mathematical proof that your data is trustworthy.</p>`
  },
  {
    title: 'Understanding transaction hashes',
    slug: 'transaction-hashes',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Understanding transaction hashes</h2>
<p>A transaction hash (txHash) is a unique identifier for a blockchain transaction. It is a 66-character hexadecimal string starting with <code>0x</code>.</p>
<h3>Where to find it</h3>
<p>Transaction hashes appear on sealed expenses, documents and in the audit log. Click the hash to view the transaction on PolygonScan (the Polygon block explorer).</p>
<h3>What it proves</h3>
<p>A transaction hash proves that specific data was recorded on the blockchain at a specific time. Anyone can verify this independently using PolygonScan or verify.sealayer.io.</p>`
  },
  {
    title: 'Verifying a seal on verify.sealayer.io',
    slug: 'verify-seal',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Verifying a seal</h2>
<p>The public verification page at <strong>verify.sealayer.io</strong> allows anyone to independently verify that a Sealayer record is authentic.</p>
<h3>How to verify</h3>
<ol>
<li>Go to <strong>verify.sealayer.io</strong></li>
<li>Enter the transaction hash or paste the verification link</li>
<li>The system checks the Polygon blockchain and returns the verification result</li>
<li>You will see: the data hash, timestamp, block number, and verification status</li>
</ol>
<p>No account or login is required. This is how donors can independently confirm the integrity of your data.</p>`
  },
  {
    title: 'Sharing a verification link',
    slug: 'sharing-verification',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Sharing a verification link</h2>
<p>You can share a verification link for any sealed item. The recipient can verify it without needing a Sealayer account.</p>
<h3>How to share</h3>
<ol>
<li>Find the sealed item (expense, document, etc.)</li>
<li>Click the <strong>seal icon</strong> or <strong>Share Verification</strong></li>
<li>Copy the verification URL</li>
<li>Send it to anyone via email, chat, or include it in reports</li>
</ol>
<p>The link opens on verify.sealayer.io and shows the full verification details including blockchain proof.</p>`
  },
  {
    title: 'Exchange rates and blockchain — how rates are sealed',
    slug: 'exchange-rates-blockchain',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Exchange rates and blockchain</h2>
<p>Sealayer seals exchange rates to the blockchain monthly, ensuring that the rates used for currency conversion are verifiable and cannot be altered after the fact.</p>
<h3>How it works</h3>
<p>At the start of each month, Sealayer captures exchange rates from trusted sources and anchors them to the Polygon blockchain. These sealed rates are then used for all currency conversions within that month.</p>
<h3>Why this matters</h3>
<p>By sealing exchange rates, donors can verify that the conversion rates used in reports are authentic and were not manipulated. This is especially important for multi-currency projects where conversion rates significantly affect reported amounts.</p>`
  },

  // ── Currency & Exchange Rates ───────────────────────────
  {
    title: 'Setting base currency and donor reporting currency on a project',
    slug: 'base-currency',
    category: 'currency-exchange',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Setting base currency and donor reporting currency</h2>
<p>Each project has a base currency (the currency you record expenses in) and each donor can have a different reporting currency.</p>
<h3>Setting base currency</h3>
<ol>
<li>When creating a project, select the <strong>Project Currency</strong></li>
<li>This becomes the base currency for all expenses on the project</li>
</ol>
<h3>Setting donor reporting currency</h3>
<ol>
<li>Open the funding agreement for the donor</li>
<li>Set the <strong>Donor Currency</strong> field</li>
<li>All reports for this donor will show amounts converted to their currency</li>
</ol>
<p>Exchange rates are captured monthly and sealed to the blockchain for transparency.</p>`
  },
  {
    title: 'Understanding monthly exchange rates',
    slug: 'monthly-exchange-rates',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Understanding monthly exchange rates</h2>
<p>Sealayer uses monthly exchange rates for currency conversion. At the start of each month, rates are captured from trusted sources and sealed to the blockchain.</p>
<h3>Why monthly rates?</h3>
<p>Monthly rates provide consistency across reporting periods. All expenses within a month use the same rate, making reports predictable and verifiable.</p>
<h3>Where to view rates</h3>
<p>Go to <strong>Settings → Exchange Rates</strong> to view the current and historical exchange rates. Each rate shows its blockchain seal with transaction hash.</p>`
  },
  {
    title: 'How to read the exchange rate table',
    slug: 'reading-exchange-table',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>How to read the exchange rate table</h2>
<p>The exchange rate table shows the monthly rates used for currency conversion across your projects.</p>
<h3>Table columns</h3>
<ul>
<li><strong>Month</strong> — The month the rate applies to</li>
<li><strong>From</strong> — The base currency</li>
<li><strong>To</strong> — The target currency</li>
<li><strong>Rate</strong> — The conversion rate (1 unit of From = X units of To)</li>
<li><strong>Seal</strong> — The blockchain transaction hash confirming the rate</li>
</ul>
<p>Click any row to see the full seal details and verify the rate on the blockchain.</p>`
  },
  {
    title: 'Currency conversion on expenses',
    slug: 'currency-conversion',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Currency conversion on expenses</h2>
<p>When an expense is recorded in the project base currency and the donor reports in a different currency, Sealayer automatically converts the amount using the sealed monthly exchange rate.</p>
<h3>How conversion works</h3>
<p>For an expense of 100,000 KES on a project where the donor reports in USD:</p>
<ol>
<li>Sealayer looks up the sealed exchange rate for that month (e.g. 1 USD = 130 KES)</li>
<li>The expense is shown as $769.23 in the donor's report</li>
<li>Both the original amount and converted amount are displayed</li>
</ol>
<p>The donor can verify the exchange rate was sealed to the blockchain before the conversion was made.</p>`
  },
  {
    title: 'Impact investment currency rules',
    slug: 'investment-currency',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Impact investment currency rules</h2>
<p>Impact investments follow the same currency framework as grants, with one key difference: repayments must be in the currency of the investment agreement.</p>
<h3>Rules</h3>
<ul>
<li>The investment amount is defined in the investor's currency</li>
<li>Drawdowns are converted to the project currency at the sealed rate for that month</li>
<li>Repayments are made in the investment currency</li>
<li>Outstanding balance is always shown in the investment currency</li>
</ul>`
  },

  // ── Messenger ───────────────────────────────────────────
  {
    title: 'Using the messenger with donors',
    slug: 'using-messenger',
    category: 'messenger',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Using the messenger with donors</h2>
<p>Sealayer's built-in messenger allows you to communicate directly with donors within the platform. Messages are linked to projects for context.</p>
<h3>Starting a conversation</h3>
<ol>
<li>Go to <strong>Messenger</strong> in the sidebar</li>
<li>Select a donor contact from the list</li>
<li>Type your message and press Enter or click Send</li>
</ol>
<h3>Features</h3>
<ul>
<li>Real-time messaging with typing indicators</li>
<li>File attachments (up to 10MB)</li>
<li>Online/offline status indicators</li>
<li>Message read receipts</li>
<li>Project context linking</li>
</ul>`
  },
  {
    title: 'Sending files via messenger',
    slug: 'sending-files',
    category: 'messenger',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Sending files via messenger</h2>
<p>You can share files directly through the messenger. Click the <strong>attachment icon</strong> to upload a file, or drag and drop into the message area.</p>
<h3>Supported files</h3>
<ul>
<li>Documents: PDF, DOC, DOCX, XLS, XLSX</li>
<li>Images: PNG, JPG, WebP</li>
<li>Maximum size: 10MB per file</li>
</ul>
<p>Files shared through messenger are stored securely and accessible to both parties.</p>`
  },
  {
    title: 'Online status and notifications',
    slug: 'online-status',
    category: 'messenger',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Online status and notifications</h2>
<p>The messenger shows online/offline status for contacts so you know when they are available.</p>
<h3>Status indicators</h3>
<ul>
<li><strong>Green dot</strong> — Online and active</li>
<li><strong>Grey dot</strong> — Offline</li>
</ul>
<h3>Notifications</h3>
<p>You receive in-app notifications for new messages. Unread message counts appear as badges on the Messenger sidebar link and on individual conversations.</p>`
  },

  // ── Settings & Admin ────────────────────────────────────
  {
    title: 'Managing team permissions',
    slug: 'team-permissions',
    category: 'settings-admin',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Managing team permissions</h2>
<p>Sealayer uses role-based access control (RBAC) with granular string-based permissions.</p>
<h3>Permission format</h3>
<p>Permissions follow the pattern <code>resource:action</code>. For example:</p>
<ul>
<li><code>projects:read</code> — View projects</li>
<li><code>projects:write</code> — Create and edit projects</li>
<li><code>expenses:write</code> — Record expenses</li>
<li><code>expenses:delete</code> — Delete expenses</li>
<li><code>system:admin</code> — Full system administration</li>
</ul>
<h3>Customising roles</h3>
<p>Go to <strong>Settings → Roles & Permissions</strong> to create custom roles or modify existing ones. Each role can have any combination of permissions.</p>`
  },
  {
    title: 'API keys and webhooks',
    slug: 'api-keys-webhooks',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>API keys and webhooks</h2>
<h3>API keys</h3>
<p>Generate API keys to integrate Sealayer with external systems. Keys use the format <code>tl_live_</code> followed by random bytes. The full key is shown once — only the hash is stored.</p>
<ol>
<li>Go to <strong>Settings → API Keys</strong></li>
<li>Click <strong>Generate Key</strong></li>
<li>Copy and store the key securely — it will not be shown again</li>
</ol>
<h3>Webhooks</h3>
<p>Webhooks send real-time notifications to external URLs when events occur (expense created, document uploaded, tranche released, etc.). Webhook payloads are HMAC-SHA256 signed for security.</p>
<ol>
<li>Go to <strong>Settings → Webhooks</strong></li>
<li>Click <strong>Add Webhook</strong></li>
<li>Enter the endpoint URL and select events</li>
<li>Save — the signing secret will be shown once</li>
</ol>`
  },
  {
    title: 'SSO setup',
    slug: 'sso-setup',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>SSO setup</h2>
<p>Single Sign-On (SSO) allows your team to log in using your organisation's identity provider (e.g. Google Workspace, Microsoft Entra, Okta).</p>
<h3>Setting up SSO</h3>
<ol>
<li>Go to <strong>Settings → Security → SSO</strong></li>
<li>Select your identity provider</li>
<li>Enter the required configuration (Client ID, Client Secret, Issuer URL)</li>
<li>Configure the redirect URI in your identity provider</li>
<li>Test the connection</li>
<li>Enable SSO</li>
</ol>
<p>Once enabled, team members can log in using their organisation credentials instead of a separate Sealayer password.</p>`
  },
  {
    title: 'Dark mode and display preferences',
    slug: 'dark-mode',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Dark mode and display preferences</h2>
<p>Sealayer supports both light and dark mode. Toggle between them from the sidebar settings icon or go to <strong>Settings → Display</strong>.</p>
<h3>Options</h3>
<ul>
<li><strong>Light mode</strong> — Default warm cream theme</li>
<li><strong>Dark mode</strong> — Dark background with adjusted colours for comfortable viewing</li>
<li><strong>System</strong> — Follows your operating system preference</li>
</ul>`
  },
  {
    title: 'Currency settings',
    slug: 'currency-settings',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Currency settings</h2>
<p>Configure your organisation's base currency and display preferences under <strong>Settings → Currency</strong>.</p>
<h3>Settings</h3>
<ul>
<li><strong>Base currency</strong> — Your default operating currency</li>
<li><strong>Display format</strong> — How amounts are formatted (e.g. 1,000.00 or 1.000,00)</li>
<li><strong>Decimal places</strong> — Number of decimal places shown</li>
</ul>
<p>Per-project currencies can override the base currency when needed.</p>`
  },
  {
    title: 'Cmd+K shortcuts guide',
    slug: 'cmd-k-shortcuts',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Cmd+K shortcuts guide</h2>
<p>The Cmd+K (or Ctrl+K on Windows/Linux) command palette gives you quick access to any page or action in Sealayer.</p>
<h3>What you can do</h3>
<ul>
<li><strong>Navigate</strong> — Type a page name to jump to it instantly (e.g. "projects", "expenses", "settings")</li>
<li><strong>Search</strong> — Search across projects, expenses and documents</li>
<li><strong>Quick actions</strong> — Create a new expense, project or document</li>
</ul>
<h3>Tips</h3>
<ul>
<li>Start typing immediately after pressing Cmd+K — no need to click</li>
<li>Use arrow keys to navigate results</li>
<li>Press Enter to select</li>
<li>Press Escape to close</li>
</ul>`
  },
]

const DONOR_ARTICLES = [
  // ── Donor: Getting Started ──────────────────────────────
  {
    title: 'Welcome to the Sealayer donor portal',
    slug: 'welcome-donor',
    category: 'donor-getting-started',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Welcome to the Sealayer donor portal</h2>
<p>The Sealayer donor portal gives you real-time visibility into how your funds are being used by NGO partners. Every transaction is anchored to the Polygon blockchain, giving you verifiable proof of fund usage.</p>
<h3>What you can do</h3>
<ul>
<li><strong>View project financials</strong> — See real-time budget vs actual spend</li>
<li><strong>Verify transactions</strong> — Check any transaction on the blockchain</li>
<li><strong>Approve tranches</strong> — Review conditions and approve funding releases</li>
<li><strong>Raise flags</strong> — Challenge any expense that looks incorrect</li>
<li><strong>Generate reports</strong> — Download financial and impact reports in your currency</li>
<li><strong>Message your NGO</strong> — Communicate directly within the platform</li>
</ul>
<h3>Getting started</h3>
<p>You should have received an invitation email from your NGO partner. Click the link to set up your account and access the donor portal at <strong>donor.sealayer.io</strong>.</p>`
  },
  {
    title: 'Understanding your donor dashboard',
    slug: 'donor-dashboard',
    category: 'donor-getting-started',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Understanding your donor dashboard</h2>
<p>Your dashboard shows an overview of all projects you are funding, with key metrics at a glance.</p>
<h3>Dashboard sections</h3>
<ul>
<li><strong>Funding overview</strong> — Total committed, disbursed and remaining</li>
<li><strong>Project cards</strong> — Each project showing status, budget utilisation, and transparency score</li>
<li><strong>Recent activity</strong> — Latest transactions across all your funded projects</li>
<li><strong>Pending actions</strong> — Tranche approvals and flags awaiting your attention</li>
</ul>`
  },
  {
    title: 'Reading project financials',
    slug: 'reading-financials',
    category: 'donor-getting-started',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Reading project financials</h2>
<p>Each project you fund shows detailed financial data in your reporting currency.</p>
<h3>Key metrics</h3>
<ul>
<li><strong>Total budget</strong> — The full project budget (converted to your currency)</li>
<li><strong>Your contribution</strong> — Your funding agreement amount</li>
<li><strong>Spent to date</strong> — Total expenses recorded against the project</li>
<li><strong>Remaining</strong> — Budget remaining</li>
<li><strong>Utilisation %</strong> — Percentage of budget spent</li>
</ul>
<h3>Expense breakdown</h3>
<p>The expense breakdown tab shows all expenses grouped by category (CapEx/OpEx), with individual line items. Click any expense to see its details, receipt and blockchain seal.</p>`
  },
  {
    title: 'What blockchain verification means for you',
    slug: 'blockchain-for-donors',
    category: 'donor-getting-started',
    targetRole: 'donor',
    order: 4,
    content: `<h2>What blockchain verification means for you</h2>
<p>As a donor, blockchain verification means you can independently verify that the financial data you see is authentic and has not been altered.</p>
<h3>Why it matters</h3>
<p>Traditional reporting relies on trust — you trust that the NGO is showing you accurate data. Blockchain verification removes this trust requirement. Every transaction hash is a mathematical proof that the data existed at a specific time and has not changed since.</p>
<h3>How to verify</h3>
<p>Click the <strong>seal icon</strong> on any transaction to see its blockchain proof. You can also visit <strong>verify.sealayer.io</strong> to verify any transaction hash independently.</p>`
  },

  // ── Donor: Verification & Trust ─────────────────────────
  {
    title: 'How to verify a transaction hash',
    slug: 'verify-transaction',
    category: 'verification-trust',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>How to verify a transaction hash</h2>
<ol>
<li>Find the transaction hash on the expense or document (a 66-character hex string starting with 0x)</li>
<li>Go to <strong>verify.sealayer.io</strong></li>
<li>Paste the transaction hash</li>
<li>Click <strong>Verify</strong></li>
<li>The system shows: data hash, block number, timestamp, and verification result</li>
</ol>
<p>You can also verify directly on PolygonScan by searching for the transaction hash.</p>`
  },
  {
    title: 'Understanding the Trust Seal',
    slug: 'understanding-trust-seal',
    category: 'verification-trust',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Understanding the Trust Seal</h2>
<p>Every sealed item on Sealayer displays a Trust Seal badge. This means the data has been cryptographically hashed and anchored to the Polygon blockchain.</p>
<h3>What the seal proves</h3>
<ul>
<li>The data existed at the time shown in the timestamp</li>
<li>The data has not been modified since it was sealed</li>
<li>No one — including Sealayer — can alter the sealed data</li>
</ul>
<p>Click any Trust Seal to see the full verification details.</p>`
  },
  {
    title: 'What the transparency score means',
    slug: 'transparency-score',
    category: 'verification-trust',
    targetRole: 'donor',
    order: 3,
    content: `<h2>What the transparency score means</h2>
<p>The transparency score is a 0-100 rating that reflects the NGO's overall transparency on Sealayer.</p>
<h3>Factors</h3>
<ul>
<li><strong>Data completeness</strong> — Are all expenses properly categorised with receipts?</li>
<li><strong>Timeliness</strong> — Are expenses recorded promptly?</li>
<li><strong>Document coverage</strong> — Are supporting documents uploaded?</li>
<li><strong>Blockchain coverage</strong> — What percentage of transactions are sealed?</li>
<li><strong>Reporting frequency</strong> — Are reports generated regularly?</li>
</ul>
<p>A higher score indicates better transparency practices.</p>`
  },
  {
    title: 'Reading the audit trail',
    slug: 'reading-audit-trail',
    category: 'verification-trust',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Reading the audit trail</h2>
<p>The audit trail shows every action taken on a project in chronological order. Each entry is immutable and blockchain-anchored.</p>
<h3>What you see</h3>
<ul>
<li><strong>Timestamp</strong> — When the action occurred</li>
<li><strong>Action</strong> — What happened (expense created, document uploaded, etc.)</li>
<li><strong>User</strong> — Who performed the action</li>
<li><strong>Data hash</strong> — The SHA-256 hash of the data</li>
<li><strong>Seal status</strong> — Whether it has been anchored to the blockchain</li>
</ul>`
  },

  // ── Donor: Funding & Tranches ───────────────────────────
  {
    title: 'Reviewing a funding agreement',
    slug: 'reviewing-agreement',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Reviewing a funding agreement</h2>
<p>Your funding agreement shows the total amount committed, the currency, and how funds will be released (lump sum or tranches).</p>
<h3>Where to find it</h3>
<p>Open the project and go to the <strong>Funding</strong> tab. Your agreement is shown with its current status, total amount, disbursed amount and remaining balance.</p>`
  },
  {
    title: 'Approving a tranche release',
    slug: 'approving-tranche',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Approving a tranche release</h2>
<p>When the NGO has met the conditions for a tranche and requests release, you will receive a notification.</p>
<h3>Steps</h3>
<ol>
<li>Open the notification or go to the project's Funding tab</li>
<li>Review the tranche conditions and evidence provided</li>
<li>Click <strong>Approve</strong> to approve the release, or <strong>Request Changes</strong> if conditions are not met</li>
</ol>
<p>Your approval is recorded in the blockchain-anchored audit trail.</p>`
  },
  {
    title: 'Understanding tranche conditions',
    slug: 'understanding-conditions',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Understanding tranche conditions</h2>
<p>Tranche conditions are requirements set when the funding agreement is created. They must be met before funds can be released.</p>
<h3>Common conditions</h3>
<ul>
<li>Submission of a quarterly report</li>
<li>Achievement of a project milestone</li>
<li>Receipt of government approval</li>
<li>Completion of a specific activity</li>
</ul>
<p>When a condition is met, the NGO marks it as fulfilled and provides evidence. You can review the evidence and approve or request changes.</p>`
  },
  {
    title: 'Your funding breakdown explained',
    slug: 'funding-breakdown',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Your funding breakdown</h2>
<p>The funding breakdown shows how your contribution is allocated across the project budget.</p>
<h3>Key sections</h3>
<ul>
<li><strong>Total committed</strong> — Your full funding amount</li>
<li><strong>Disbursed</strong> — Amount released through approved tranches</li>
<li><strong>Spent</strong> — Amount spent against your funding</li>
<li><strong>Remaining</strong> — Undisbursed balance</li>
</ul>
<p>All amounts are shown in your reporting currency with blockchain-sealed exchange rates.</p>`
  },

  // ── Donor: Flags & Challenges ───────────────────────────
  {
    title: 'Raising a flag on an expense',
    slug: 'raising-flag',
    category: 'flags-challenges',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Raising a flag on an expense</h2>
<p>If you see an expense that looks incorrect, unusual or needs clarification, you can raise a flag.</p>
<h3>How to flag</h3>
<ol>
<li>Open the expense detail view</li>
<li>Click <strong>Raise Flag</strong></li>
<li>Select the reason (Amount discrepancy, Missing receipt, Incorrect category, Other)</li>
<li>Add a description of your concern</li>
<li>Click <strong>Submit</strong></li>
</ol>
<p>The NGO will be notified and must respond to your flag. The flag and all responses are recorded in the immutable audit trail.</p>`
  },
  {
    title: 'What happens after you raise a flag',
    slug: 'after-flag',
    category: 'flags-challenges',
    targetRole: 'donor',
    order: 2,
    content: `<h2>What happens after you raise a flag</h2>
<p>When you raise a flag, the NGO is notified immediately. They must review the flagged expense and respond.</p>
<h3>Possible outcomes</h3>
<ul>
<li><strong>Corrected</strong> — The NGO corrects the expense and the flag is resolved</li>
<li><strong>Explained</strong> — The NGO provides an explanation that addresses your concern</li>
<li><strong>Escalated</strong> — If unresolved, the flag can be escalated</li>
</ul>
<p>All flag activity is permanently recorded in the audit trail for full transparency.</p>`
  },
  {
    title: 'Resolving a challenge',
    slug: 'resolving-challenge',
    category: 'flags-challenges',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Resolving a challenge</h2>
<p>Once the NGO responds to your flag, review their response and either accept the resolution or continue the discussion.</p>
<h3>Steps</h3>
<ol>
<li>Open the flagged expense</li>
<li>Review the NGO's response and any supporting evidence</li>
<li>Click <strong>Accept Resolution</strong> if satisfied</li>
<li>Or add a follow-up comment if the issue is not resolved</li>
</ol>`
  },

  // ── Donor: Impact Investment ────────────────────────────
  {
    title: 'Reviewing an investment proposal',
    slug: 'reviewing-proposal',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Reviewing an investment proposal</h2>
<p>When an NGO creates an investment opportunity, you can review the proposal details including: the investment amount, expected returns, repayment schedule, and use of funds.</p>
<h3>Where to find proposals</h3>
<p>Go to <strong>Impact Investments</strong> in the sidebar to see all proposals shared with you. Click any proposal to see the full details.</p>`
  },
  {
    title: 'Approving an investment',
    slug: 'approving-investment',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Approving an investment</h2>
<ol>
<li>Review the investment proposal details</li>
<li>Check the terms: amount, return rate, repayment schedule</li>
<li>Click <strong>Approve Investment</strong></li>
<li>The investment is recorded in the blockchain-anchored audit trail</li>
</ol>
<p>Once approved, the NGO can begin making drawdown requests against the investment.</p>`
  },
  {
    title: 'Tracking repayments',
    slug: 'tracking-repayments',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Tracking repayments</h2>
<p>The investment dashboard shows all repayment activity:</p>
<ul>
<li>Scheduled repayments and due dates</li>
<li>Completed repayments</li>
<li>Outstanding balance</li>
<li>Next payment due</li>
</ul>
<p>Each repayment is sealed to the blockchain for verifiable tracking.</p>`
  },
  {
    title: 'Your investment portfolio',
    slug: 'investment-portfolio',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Your investment portfolio</h2>
<p>The portfolio view shows all your investments across NGOs in a single dashboard.</p>
<h3>Portfolio metrics</h3>
<ul>
<li>Total invested</li>
<li>Total repaid</li>
<li>Total outstanding</li>
<li>Average return rate</li>
<li>Investment-by-investment breakdown</li>
</ul>`
  },

  // ── Donor: Reports & Data ───────────────────────────────
  {
    title: 'Generating a donor report',
    slug: 'generating-donor-report',
    category: 'donor-reports-data',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Generating a donor report</h2>
<ol>
<li>Go to <strong>Reports</strong> in the sidebar</li>
<li>Select the project</li>
<li>Choose the report type and date range</li>
<li>Click <strong>Generate</strong></li>
<li>Download as PDF or view online</li>
</ol>
<p>Reports include financial data, impact metrics and blockchain verification, all in your reporting currency.</p>`
  },
  {
    title: 'Understanding currency conversion',
    slug: 'understanding-currency',
    category: 'donor-reports-data',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Understanding currency conversion</h2>
<p>If the project operates in a different currency than your reporting currency, all amounts are automatically converted using blockchain-sealed monthly exchange rates.</p>
<h3>How to check the rate</h3>
<p>Reports show the exchange rate used for each conversion. Click the rate to see its blockchain seal and verify it independently.</p>`
  },
  {
    title: 'Exchange rate table explained',
    slug: 'exchange-rate-table',
    category: 'donor-reports-data',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Exchange rate table explained</h2>
<p>The exchange rate table shows all monthly rates used for converting project expenses to your reporting currency.</p>
<ul>
<li><strong>Month</strong> — The month the rate applies to</li>
<li><strong>Rate</strong> — How much 1 unit of the project currency equals in your currency</li>
<li><strong>Seal</strong> — The blockchain transaction hash confirming the rate was sealed before use</li>
</ul>
<p>Sealed rates cannot be changed retroactively, ensuring fair and transparent conversion.</p>`
  },
  {
    title: 'Downloading your data',
    slug: 'downloading-data',
    category: 'donor-reports-data',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Downloading your data</h2>
<p>You can export your data in multiple formats:</p>
<ul>
<li><strong>PDF reports</strong> — Formatted reports with charts and tables</li>
<li><strong>CSV export</strong> — Raw data for your own analysis</li>
<li><strong>Excel export</strong> — Formatted spreadsheets with multiple tabs</li>
</ul>
<p>Go to <strong>Reports</strong> and select your preferred format when generating or downloading.</p>`
  },

  // ── Donor: Messenger & Communication ────────────────────
  {
    title: 'Messaging your NGO',
    slug: 'messaging-ngo',
    category: 'donor-messenger',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Messaging your NGO</h2>
<p>Use the built-in messenger to communicate directly with your NGO partner. Messages are linked to your funding relationship for context.</p>
<h3>How to message</h3>
<ol>
<li>Go to <strong>Messenger</strong> in the sidebar</li>
<li>Select the NGO contact</li>
<li>Type your message and send</li>
</ol>
<p>You will receive in-app notifications when the NGO replies.</p>`
  },
  {
    title: 'Sending files',
    slug: 'donor-sending-files',
    category: 'donor-messenger',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Sending files</h2>
<p>Share files with your NGO partner through the messenger. Click the <strong>attachment icon</strong> or drag and drop a file into the message area.</p>
<h3>Supported formats</h3>
<p>PDF, DOC, DOCX, XLS, XLSX, PNG, JPG — up to 10MB per file.</p>`
  },
  {
    title: 'Notification preferences',
    slug: 'notification-preferences',
    category: 'donor-messenger',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Notification preferences</h2>
<p>Manage your notification settings under <strong>Settings → Notifications</strong>.</p>
<h3>Options</h3>
<ul>
<li><strong>In-app notifications</strong> — Always enabled for critical actions</li>
<li><strong>Email notifications</strong> — Choose which events trigger email alerts</li>
<li><strong>Message notifications</strong> — Get notified for new messages</li>
</ul>
<p>You can adjust these settings at any time.</p>`
  },
]

async function main() {
  console.log('Seeding KB categories and articles...')

  // Clear existing data
  await prisma.knowledgeBaseArticle.deleteMany({})
  await prisma.knowledgeBaseCategory.deleteMany({})
  console.log('Cleared existing KB data')

  // Create categories
  const allCategories = [...NGO_CATEGORIES, ...DONOR_CATEGORIES]
  for (const cat of allCategories) {
    await prisma.knowledgeBaseCategory.create({ data: cat })
  }
  console.log(`Created ${allCategories.length} categories`)

  // Create articles
  const allArticles = [...NGO_ARTICLES, ...DONOR_ARTICLES]
  for (const art of allArticles) {
    await prisma.knowledgeBaseArticle.create({
      data: {
        ...art,
        isPublished: true,
        isFeatured: art.isFeatured || false,
      }
    })
  }
  console.log(`Created ${allArticles.length} articles`)

  console.log('KB seed complete!')
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
