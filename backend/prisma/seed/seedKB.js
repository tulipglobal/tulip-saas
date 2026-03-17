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
    content: `<h2>Setting Up Your Organisation Profile</h2>
<p>Your organisation profile is the foundation of your Sealayer account. It determines how your organisation appears to donors, what currency you operate in, and how your team is structured. Completing your profile is one of the first things you should do after signing up.</p>

<h3>Accessing Your Profile</h3>
<p>Navigate to <strong>Settings &gt; Organisation</strong> from the left sidebar, or use the <strong>Cmd+K</strong> shortcut and type "organisation" to jump there directly. You will see your organisation details form with several sections to complete.</p>

<h3>Basic Information</h3>
<ul>
<li><strong>Organisation name</strong> — this appears on all reports, funding agreements, and the donor portal. Use your official registered name.</li>
<li><strong>Slug</strong> — a URL-friendly identifier (e.g., <code>caritas-kenya</code>). This is set automatically from your name but can be customised. It cannot be changed once donors have been linked.</li>
<li><strong>Description</strong> — a brief summary of your organisation's mission. This is visible to donors on the portal.</li>
<li><strong>Logo</strong> — upload your organisation's logo. It appears in the top-left of your dashboard and on generated reports. Recommended size: 200x200px, PNG or SVG format.</li>
</ul>

<h3>Contact and Registration</h3>
<ul>
<li><strong>Registered address</strong> — your official registered address, used on formal documents and generated reports.</li>
<li><strong>Country</strong> — your country of registration. This affects default currency and regulatory settings.</li>
<li><strong>Registration number</strong> — your charity or NGO registration number, if applicable.</li>
<li><strong>Website</strong> — your public website URL.</li>
</ul>

<h3>Financial Settings</h3>
<ul>
<li><strong>Base currency</strong> — the currency your organisation operates in day-to-day (e.g., KES for a Kenyan NGO). All expenses default to this currency unless overridden at the project level.</li>
<li><strong>Financial year start</strong> — the month your financial year begins. This affects how annual reports are generated and how data is grouped in financial summaries.</li>
</ul>

<h3>Saving Changes</h3>
<p>Click <strong>Save</strong> at the bottom of the form. Changes take effect immediately across the platform. Your donors will see updated information the next time they access the portal. Once your profile is complete, you can invite team members, create your first project, and begin recording expenses. Your organisation profile is also used when generating funding agreements and donor reports, so keeping it accurate saves time later.</p>`
  },
  {
    title: 'Inviting team members',
    slug: 'inviting-team-members',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Inviting Team Members</h2>
<p>Sealayer is designed for collaborative use. You can invite colleagues to your organisation's workspace, assign them roles with specific permissions, and manage access as your team changes over time.</p>

<h3>How to Invite a Team Member</h3>
<ol>
<li>Navigate to <strong>Settings &gt; Team</strong> from the left sidebar.</li>
<li>Click the <strong>Invite Member</strong> button in the top-right corner.</li>
<li>Enter the person's email address. They do not need to have an existing Sealayer account — one will be created for them.</li>
<li>Select a <strong>role</strong> from the dropdown. The role determines what the user can see and do within your organisation.</li>
<li>Click <strong>Send Invitation</strong>.</li>
</ol>
<p>The invited person will receive an email with a link to set their password and access your workspace. The invitation expires after 7 days. You can resend it from the Team page if needed.</p>

<h3>Understanding Roles</h3>
<p>Sealayer uses role-based access control (RBAC). Each role is a collection of permissions that determine what actions a user can take:</p>
<ul>
<li><strong>Admin</strong> — full access to all features, including organisation settings, team management, API keys, and webhooks. Admins can also manage roles and permissions.</li>
<li><strong>Project Manager</strong> — can create and manage projects, record expenses, upload documents, and generate reports. Cannot access organisation settings or manage other users.</li>
<li><strong>Finance Officer</strong> — can record and approve expenses, manage funding agreements, and generate financial reports. Cannot create or delete projects.</li>
<li><strong>Viewer</strong> — read-only access to projects, expenses, and documents. Useful for board members or external advisors who need visibility without editing rights.</li>
</ul>

<h3>Custom Roles</h3>
<p>If the default roles do not fit your needs, admins can create custom roles. Navigate to <strong>Settings &gt; Roles &amp; Permissions</strong> and click <strong>Create Role</strong>. Give the role a name and select the permissions you want to include. Permissions are granular — for example, you can grant <code>expenses:read</code> without <code>expenses:write</code>, or allow <code>projects:read</code> without <code>projects:delete</code>.</p>

<h3>Managing Existing Members</h3>
<p>From the Team page, you can change a member's role, deactivate their account, or remove them entirely. Deactivating is preferred over removing, as it preserves the audit trail of actions they took while active. Removing a user anonymises their name in audit logs but retains the log entries themselves — Sealayer never deletes audit data.</p>

<h3>Multi-Tenant Isolation</h3>
<p>Every user belongs to exactly one organisation (tenant). There is no cross-tenant access — a user at Organisation A cannot see data from Organisation B, even if they know the project ID. This isolation is enforced at the database level, not just the UI.</p>`
  },
  {
    title: 'Understanding your dashboard',
    slug: 'understanding-dashboard',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Understanding Your Dashboard</h2>
<p>The dashboard is your home screen on Sealayer. It gives you a real-time overview of your organisation's financial activity, project health, and recent actions. Every time you log in, the dashboard is the first thing you see.</p>

<h3>Summary Cards</h3>
<p>At the top of the dashboard, you will see a row of summary cards showing key metrics at a glance:</p>
<ul>
<li><strong>Total Projects</strong> — the number of active projects in your organisation.</li>
<li><strong>Total Budget</strong> — the combined budget across all active projects, displayed in your base currency.</li>
<li><strong>Total Expenses</strong> — the total amount recorded in expenses so far.</li>
<li><strong>Total Documents</strong> — the number of documents uploaded across all projects.</li>
<li><strong>Pending Seals</strong> — audit log entries created but not yet anchored to the blockchain, typically processed within the next five-minute cycle.</li>
</ul>

<h3>Recent Activity</h3>
<p>Below the summary cards, a timeline shows the most recent actions across your organisation. Each entry shows what happened, who did it, and when. Actions include creating projects, recording expenses, uploading documents, and releasing tranches. Click any entry to navigate directly to the relevant item.</p>

<h3>Project Overview</h3>
<p>A table or card grid shows your active projects with key information: project name, budget, amount spent, percentage utilised, and the number of linked donors. Projects with health warnings such as overspending or approaching budget limits are highlighted in amber or red. Click a project to open its detail page.</p>

<h3>Budget Utilisation Chart</h3>
<p>A visual chart shows budget vs. actual spending across your projects. This helps you quickly identify which projects are on track and which may need attention. The chart updates in real time as new expenses are recorded.</p>

<h3>Quick Actions</h3>
<p>The dashboard includes quick-action buttons for common tasks: <strong>New Project</strong>, <strong>Record Expense</strong>, <strong>Upload Document</strong>, and <strong>Generate Report</strong>. You can also use <strong>Cmd+K</strong> from the dashboard to quickly navigate to any page or action in the platform. On mobile devices, the summary cards stack vertically and the activity timeline becomes scrollable.</p>`
  },
  {
    title: 'Your first project — step by step',
    slug: 'first-project',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Your First Project — Step by Step</h2>
<p>This guide walks you through creating your first project on Sealayer, from initial setup to recording your first expense. By the end, you will have a fully configured project ready for donor reporting and blockchain verification.</p>

<h3>Step 1: Create the Project</h3>
<ol>
<li>Click <strong>Projects</strong> in the left sidebar, then click <strong>New Project</strong>.</li>
<li>Enter a <strong>project name</strong> (e.g., "Water Access Program — Turkana County").</li>
<li>Add a <strong>description</strong> explaining the project's goals and scope. This is visible to donors.</li>
<li>Set the <strong>budget</strong> — the total planned expenditure for this project.</li>
<li>Choose the <strong>project currency</strong> — usually your base currency, but can differ for internationally funded projects.</li>
<li>Set <strong>start and end dates</strong> if known.</li>
<li>Click <strong>Create Project</strong>.</li>
</ol>

<h3>Step 2: Set Up the Budget</h3>
<p>After creating the project, open it and navigate to the <strong>Budget</strong> tab. Break down the total budget into line items such as Personnel, Equipment, Travel, Materials, and Overhead. For each category, specify whether it is <strong>CapEx</strong> (capital expenditure) or <strong>OpEx</strong> (operational expenditure) and set the budgeted amount. The sum of line items should match your total project budget.</p>

<h3>Step 3: Add a Funding Source</h3>
<p>Navigate to the <strong>Funding</strong> tab and click <strong>Add Funding Source</strong>. Enter the donor or grant name, the funding type (grant, impact loan, or impact investment), the amount and currency. Optionally, set up tranches with conditions for staged disbursement. A funding source represents the formal arrangement between your organisation and the donor.</p>

<h3>Step 4: Record Your First Expense</h3>
<p>Go to the <strong>Expenses</strong> tab and click <strong>Record Expense</strong>. Enter a description, amount, currency, budget category, and funding source. Attach a receipt by uploading a file. When you save the expense, Sealayer creates an audit log entry, hashes it with SHA-256, and queues it for blockchain anchoring. Within five minutes, your expense will have a Trust Seal — an immutable, verifiable proof on the Polygon blockchain.</p>

<h3>Step 5: Upload Supporting Documents</h3>
<p>Go to the <strong>Documents</strong> tab and upload relevant files — the signed grant agreement, project proposal, baseline study, or registration documents. Each document is stored securely on S3 with a SHA-256 integrity hash. Documents can be shared with donors through the donor portal.</p>

<h3>Step 6: Invite Your Donor</h3>
<p>Go to the <strong>Funding</strong> tab, find your funding source, and click <strong>Invite Donor</strong>. Enter the donor's email address. They will receive an invitation to create a donor account and access your project through the Sealayer donor portal, where they can view financials, verify transactions, and approve tranche releases.</p>`
  },
  {
    title: 'Understanding blockchain verification on Sealayer',
    slug: 'blockchain-verification-intro',
    category: 'getting-started',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Understanding Blockchain Verification on Sealayer</h2>
<p>Blockchain verification is the core feature that sets Sealayer apart from traditional financial management tools. This article explains how it works in plain language, what it means for your organisation, and why donors trust it.</p>

<h3>Why Blockchain?</h3>
<p>A blockchain is a distributed, append-only ledger. Once data is written to a blockchain, it cannot be altered or deleted — not by Sealayer, not by your organisation, not by anyone. This makes it the ideal foundation for an audit trail that donors can independently verify. Sealayer uses the <strong>Polygon blockchain</strong>, a widely adopted, energy-efficient network compatible with Ethereum. Every anchoring transaction costs a fraction of a cent and is confirmed within seconds.</p>

<h3>What Gets Anchored?</h3>
<p>Every significant action on Sealayer generates an audit log entry. This includes creating or updating projects, recording or editing expenses, uploading documents, creating or modifying funding agreements, releasing tranches, and any change to user roles or permissions. Each entry is hashed using SHA-256, producing a unique digital fingerprint.</p>

<h3>Merkle Trees and Batching</h3>
<p>Rather than writing each hash individually to the blockchain, Sealayer batches entries into a <strong>Merkle tree</strong>. Every five minutes, the batch anchor service collects up to 20 pending audit entries, builds a Merkle tree from their hashes, and writes the Merkle root to the Polygon blockchain. The Merkle tree structure means any individual entry can be proven to be part of the batch without revealing the other entries, using a <strong>Merkle proof</strong> — a small chain of hashes linking the entry to the on-chain root.</p>

<h3>Trust Seals</h3>
<p>Once an entry has been anchored, it receives a Trust Seal containing the transaction hash (a link to the Polygon transaction), the block number, the timestamp, and the Merkle proof. Anyone can verify a Trust Seal independently — no Sealayer account is needed. The public verification page at <strong>verify.sealayer.io</strong> allows anyone to enter a transaction hash and confirm the anchored data.</p>

<h3>RFC 3161 Timestamping</h3>
<p>In addition to blockchain anchoring, Sealayer generates RFC 3161 timestamps from trusted third-party timestamp authorities (FreeTSA, with Apple as a fallback). These provide legally recognised proof of when a record existed, adding another layer of verifiability. The combination of blockchain anchoring and RFC 3161 timestamping gives your audit trail both technological immutability and legal standing.</p>`
  },

  // ── Projects & Budgets ──────────────────────────────────
  {
    title: 'Creating a project',
    slug: 'creating-project',
    category: 'projects-budgets',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Creating a Project</h2>
<p>Projects are the central organising unit on Sealayer. Every expense, document, funding agreement, and audit log entry is linked to a project. This article covers how to create a new project and configure it properly.</p>

<h3>Starting a New Project</h3>
<ol>
<li>Click <strong>Projects</strong> in the left sidebar to open the projects list.</li>
<li>Click the <strong>New Project</strong> button in the top-right corner.</li>
<li>Fill in the project creation form.</li>
</ol>

<h3>Required Fields</h3>
<ul>
<li><strong>Project Name</strong> — a clear, descriptive name that donors will see. Use the official project title from your grant agreement (e.g., "Clean Water Initiative — Marsabit County").</li>
<li><strong>Description</strong> — a summary of objectives, target beneficiaries, and expected outcomes. Appears on the donor portal and in reports.</li>
<li><strong>Budget</strong> — total planned expenditure. Used to calculate budget utilisation percentages and health indicators.</li>
</ul>

<h3>Optional Fields</h3>
<ul>
<li><strong>Start date and end date</strong> — define the implementation period for timeline views and reports.</li>
<li><strong>Project currency</strong> — defaults to your base currency. Change this if the project operates in a different currency.</li>
<li><strong>Status</strong> — new projects start as Active. Other statuses include Planning, On Hold, and Completed.</li>
<li><strong>Tags</strong> — add tags for internal categorisation (e.g., "water", "education"). Tags help with filtering across multiple projects.</li>
</ul>

<h3>After Creation</h3>
<p>Once created, the project detail page becomes available. From there you can set up the budget breakdown with CapEx and OpEx line items, add funding sources, record expenses, upload documents, define a logframe for impact measurement, and view the audit trail with blockchain seals. Creating a project automatically generates an audit log entry that is hashed and anchored to the Polygon blockchain within the next five-minute cycle.</p>

<h3>Tips</h3>
<ul>
<li>Use specific, donor-recognisable names — donors will see the project name in their portal.</li>
<li>Set realistic budgets — you can adjust later, but every change is logged in the immutable audit trail.</li>
<li>Add a thorough description — it helps team members and donors understand the project context at a glance.</li>
</ul>`
  },
  {
    title: 'Setting up a project budget',
    slug: 'project-budget',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Setting Up a Project Budget</h2>
<p>A well-structured budget is essential for financial transparency. Sealayer allows you to break down your project budget into detailed line items, categorised by type, so that donors can see exactly how funds are planned to be used.</p>

<h3>Accessing the Budget</h3>
<p>Open your project and click the <strong>Budget</strong> tab. If no budget lines have been created yet, you will see an empty state with a prompt to add your first budget category.</p>

<h3>Adding Budget Lines</h3>
<p>Click <strong>Add Budget Line</strong> and enter the following:</p>
<ul>
<li><strong>Category name</strong> — a descriptive label such as "Personnel", "Equipment", "Travel", "Materials", "Office Rent", or "Monitoring &amp; Evaluation".</li>
<li><strong>Type</strong> — select <strong>CapEx</strong> (capital expenditure) or <strong>OpEx</strong> (operational expenditure). This classification helps donors understand the nature of spending.</li>
<li><strong>Budgeted amount</strong> — the planned spend for this line item.</li>
<li><strong>Notes</strong> — optional notes explaining what this budget line covers.</li>
</ul>

<h3>Budget Validation</h3>
<p>Sealayer checks that the sum of your budget lines matches the total project budget. If there is a discrepancy, a warning appears at the top of the budget tab. You can either adjust the line items or update the project's total budget to match.</p>

<h3>Tracking Spend Against Budget</h3>
<p>As expenses are recorded against each budget category, the budget tab updates to show:</p>
<ul>
<li><strong>Budgeted</strong> — the planned amount for this category.</li>
<li><strong>Actual</strong> — the total expenses recorded against this category.</li>
<li><strong>Remaining</strong> — the difference between budgeted and actual.</li>
<li><strong>Utilisation %</strong> — actual as a percentage of budgeted. Colour-coded: green (under 80%), amber (80-100%), red (over 100%).</li>
</ul>

<h3>Budget Revisions</h3>
<p>You can edit budget lines at any time. However, every change is recorded in the audit trail. If you increase a budget line, the audit log captures the old value and the new value, along with who made the change and when. This ensures complete transparency — donors can see the full history of budget modifications through their portal.</p>`
  },
  {
    title: 'CapEx vs OpEx — what is the difference',
    slug: 'capex-vs-opex',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>CapEx vs OpEx — What Is the Difference?</h2>
<p>When setting up budget lines on Sealayer, you are asked to classify each line as either <strong>CapEx</strong> (capital expenditure) or <strong>OpEx</strong> (operational expenditure). This classification is standard in financial management and helps donors understand how their funds are being used.</p>

<h3>Capital Expenditure (CapEx)</h3>
<p>CapEx refers to spending on assets that provide long-term value — typically items with a useful life of more than one year. Examples in an NGO context include:</p>
<ul>
<li>Vehicles for field operations</li>
<li>Construction of buildings, schools, or clinics</li>
<li>Drilling equipment or boreholes</li>
<li>Solar panel installations</li>
<li>IT infrastructure (servers, laptops, networking equipment)</li>
<li>Medical equipment</li>
</ul>
<p>CapEx items are typically one-off or infrequent purchases that create lasting assets. Donors often want to see CapEx spending separately because it represents investment in infrastructure that will continue to deliver value after the project ends.</p>

<h3>Operational Expenditure (OpEx)</h3>
<p>OpEx refers to day-to-day running costs that are consumed within the financial period. Examples include:</p>
<ul>
<li>Staff salaries and benefits</li>
<li>Office rent and utilities</li>
<li>Travel and accommodation for field visits</li>
<li>Consumable supplies (paper, fuel, medical consumables)</li>
<li>Training and workshop costs</li>
<li>Insurance premiums</li>
<li>Communication costs (phone, internet)</li>
<li>Monitoring and evaluation activities</li>
</ul>
<p>OpEx is recurring and typically represents the cost of keeping the project running. Most donor grants have a higher proportion of OpEx than CapEx.</p>

<h3>Why It Matters on Sealayer</h3>
<p>Classifying budget lines correctly helps donors understand the balance between infrastructure investment and operational costs. Many donors have specific policies about CapEx — for example, some grants cap CapEx at 20% of the total budget, or require separate approval for large capital purchases. On Sealayer, the CapEx/OpEx split is visible in financial reports, the budget tab, and the donor portal. It is also used in the comparison tool, which allows donors to compare spending patterns across projects.</p>

<h3>Tips for Classification</h3>
<ul>
<li>If an item will be used for more than one year and has significant value, it is probably CapEx.</li>
<li>If it is consumed within the period or recurs regularly, it is OpEx.</li>
<li>When in doubt, refer to your donor's grant agreement — many specify how to classify expenditure.</li>
<li>Be consistent across projects — if "laptops" are CapEx in one project, they should be CapEx in all projects.</li>
</ul>`
  },
  {
    title: 'Linking donors to a project',
    slug: 'linking-donors',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Linking Donors to a Project</h2>
<p>On Sealayer, donors are linked to projects through funding sources. When you add a funding source to a project and invite the donor, they gain access to that project's data through the donor portal.</p>

<h3>Adding a Funding Source</h3>
<ol>
<li>Open your project and navigate to the <strong>Funding</strong> tab.</li>
<li>Click <strong>Add Funding Source</strong>.</li>
<li>Enter the donor or grant name, the funding type (grant, impact loan, or impact investment), the amount, and the currency.</li>
<li>Optionally, set up tranches with conditions for staged disbursement.</li>
<li>Click <strong>Save</strong>.</li>
</ol>

<h3>Inviting the Donor</h3>
<p>Once the funding source is created, click the <strong>Invite Donor</strong> button. Enter the donor's email address and an optional personalised message. The donor will receive an email invitation to create a Sealayer donor account (or log in if they already have one) and will be linked to your project automatically.</p>

<h3>What Donors Can See</h3>
<p>Linked donors have access to the following for the project they are linked to:</p>
<ul>
<li><strong>Project overview</strong> — name, description, status, timeline, and overall budget utilisation.</li>
<li><strong>Budget breakdown</strong> — all budget lines with actual vs. budgeted amounts and utilisation percentages.</li>
<li><strong>Expenses</strong> — all recorded expenses, including amounts, categories, dates, and attached receipts.</li>
<li><strong>Documents</strong> — any documents you have shared with the donor.</li>
<li><strong>Funding agreement</strong> — the terms of their funding, including tranche schedules and conditions.</li>
<li><strong>Audit trail</strong> — the full audit log with Trust Seals and blockchain verification links.</li>
</ul>

<h3>Multiple Donors</h3>
<p>A single project can have multiple funding sources, each linked to a different donor. Each donor only sees their own funding agreement details but can see the overall project financials. This provides transparency while respecting the confidentiality of individual funding arrangements. If a funding relationship ends, you can deactivate the donor's access from the Funding tab without affecting historical data.</p>`
  },
  {
    title: 'Project health and status indicators',
    slug: 'project-health',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Project Health and Status Indicators</h2>
<p>Sealayer provides visual indicators to help you quickly assess the health of your projects. These indicators appear on the project list, the dashboard, and individual project pages, giving you and your donors an at-a-glance view of how things are going.</p>

<h3>Status Indicators</h3>
<p>Every project has a status, displayed as a coloured badge:</p>
<ul>
<li><strong>Planning</strong> (blue) — the project has been created but implementation has not started.</li>
<li><strong>Active</strong> (green) — the project is in implementation. This is the default status when you start recording expenses.</li>
<li><strong>On Hold</strong> (amber) — the project is temporarily paused, perhaps due to funding delays or operational issues.</li>
<li><strong>Completed</strong> (grey) — the project has finished. No new expenses can be recorded, but data remains accessible.</li>
</ul>

<h3>Budget Utilisation</h3>
<p>The budget utilisation indicator shows actual spending as a percentage of the total budget, using a colour-coded progress bar:</p>
<ul>
<li><strong>Green (0-79%)</strong> — spending is within normal range.</li>
<li><strong>Amber (80-99%)</strong> — spending is approaching the budget limit. Review upcoming expenses to ensure remaining budget is sufficient.</li>
<li><strong>Red (100%+)</strong> — the project has exceeded its budget. This requires immediate attention.</li>
</ul>

<h3>Funding Health</h3>
<p>The funding health indicator shows how much of the committed funding has been received: Fully Funded, Partially Funded, or Awaiting Funding. This is calculated from the tranche disbursement status across all funding sources.</p>

<h3>Activity Indicators</h3>
<p>Projects also show indicators for recent activity: last expense date, document count, and seal status. A project with no expenses in 30 or more days may show a staleness warning. Projects with zero documents are flagged as incomplete. Donors see the same health indicators on their portal, ensuring both parties can identify issues early and take action.</p>`
  },
  {
    title: 'Archiving and closing a project',
    slug: 'archiving-projects',
    category: 'projects-budgets',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Archiving and Closing a Project</h2>
<p>When a project reaches completion, you should close it on Sealayer. This marks it as finished, prevents new expenses from being recorded, and preserves the full audit trail for future reference and verification.</p>

<h3>When to Close a Project</h3>
<p>Close a project when all planned activities have been completed, all funding has been received and accounted for, the final report has been submitted to the donor, and all outstanding expenses have been recorded with receipts attached.</p>

<h3>How to Close a Project</h3>
<ol>
<li>Open the project and go to <strong>Settings</strong> (the gear icon on the project page).</li>
<li>Click <strong>Close Project</strong>.</li>
<li>Review the checklist showing the project's current state: total expenses, budget utilisation, document count, and any pending items.</li>
<li>Add a <strong>closing note</strong> explaining why the project is being closed.</li>
<li>Click <strong>Confirm</strong> to close the project.</li>
</ol>

<h3>What Happens When a Project Is Closed</h3>
<ul>
<li>The project status changes to <strong>Completed</strong>.</li>
<li>No new expenses, documents, or funding changes can be added.</li>
<li>The project remains visible in your project list, marked as completed.</li>
<li>Donors retain read-only access through their portal.</li>
<li>All audit logs, Trust Seals, and blockchain anchors remain intact and verifiable.</li>
<li>The closing action itself is recorded in the audit trail and anchored to the blockchain.</li>
</ul>

<h3>Archiving vs. Closing</h3>
<p>Closing a project marks it as completed but keeps it visible in your project list. If you want to reduce clutter, you can <strong>archive</strong> a closed project. Archived projects are hidden from the default project list view but can be accessed through the "Show Archived" filter. Archiving does not delete any data.</p>

<h3>Reopening a Project</h3>
<p>If a project needs to be reopened (e.g., additional funding received or extension granted), an admin can reopen it from the project settings. The reopen action is logged in the audit trail. Closed and archived projects are never deleted — the data is retained indefinitely for donor and auditor verification.</p>`
  },

  // ── Expenses ────────────────────────────────────────────
  {
    title: 'Recording an expense',
    slug: 'recording-expense',
    category: 'expenses',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Recording an Expense</h2>
<p>Recording expenses is one of the most common actions on Sealayer. Every expense you record becomes part of your project's immutable audit trail, anchored to the blockchain for independent verification by donors.</p>

<h3>How to Record an Expense</h3>
<ol>
<li>Navigate to your project and click the <strong>Expenses</strong> tab.</li>
<li>Click <strong>Record Expense</strong> in the top-right corner.</li>
<li>Fill in the expense form with the required details.</li>
</ol>

<h3>Required Fields</h3>
<ul>
<li><strong>Description</strong> — a clear, concise description of what the expense is for (e.g., "Monthly office rent — March 2026").</li>
<li><strong>Amount</strong> — the expense amount in the specified currency.</li>
<li><strong>Currency</strong> — defaults to the project currency but can be changed. If recorded in a different currency, Sealayer converts it using the applicable exchange rate.</li>
<li><strong>Category</strong> — select from your project's budget categories (e.g., Personnel, Equipment, Travel). This links the expense to the correct budget line.</li>
<li><strong>Funding Source</strong> — select which funding source this expense should be charged against.</li>
<li><strong>Date</strong> — the date the expense was incurred (not the date you are recording it).</li>
</ul>

<h3>Optional Fields</h3>
<ul>
<li><strong>Receipt</strong> — attach a receipt, invoice, or supporting document. Accepted formats include PDF, JPG, PNG, and TIFF. Stored on S3 with a SHA-256 integrity hash.</li>
<li><strong>Notes</strong> — additional context or justification for the expense.</li>
<li><strong>Vendor/Supplier</strong> — the name of the vendor or supplier.</li>
</ul>

<h3>What Happens After You Save</h3>
<p>When you click <strong>Save</strong>, Sealayer creates the expense record, generates an audit log entry with a SHA-256 hash, and queues it for blockchain anchoring. Within five minutes, the entry is batched into a Merkle tree and the Merkle root is written to the Polygon blockchain. The project's budget utilisation and financial summaries update in real time. Every expense creation generates an immutable audit log entry that can be independently verified by donors or auditors through the Trust Seal.</p>`
  },
  {
    title: 'Uploading receipts and documents',
    slug: 'uploading-receipts',
    category: 'expenses',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Uploading Receipts and Documents</h2>
<p>Attaching receipts and supporting documents to expenses is a critical part of financial transparency. Sealayer makes it easy to upload, store, and share these documents with donors, while ensuring their integrity through cryptographic hashing.</p>

<h3>Uploading a Receipt</h3>
<ol>
<li>When recording a new expense, click the <strong>Attach Receipt</strong> button in the expense form.</li>
<li>Select a file from your device. Accepted formats: PDF, JPG, JPEG, PNG, TIFF, and WEBP. Maximum file size is 10MB.</li>
<li>The file uploads immediately and a preview appears in the form.</li>
<li>You can also add a receipt to an existing expense by opening the expense and clicking <strong>Add Receipt</strong>.</li>
</ol>

<h3>File Storage and Integrity</h3>
<p>When a file is uploaded, Sealayer uploads it to Amazon S3 (secure, redundant cloud storage), calculates a <strong>SHA-256 hash</strong> from the file's contents as a digital fingerprint, and records the upload event in the audit trail including the file name, size, type, and hash. If the file is ever modified, the hash will no longer match, making tampering detectable.</p>

<h3>OCR and Document Scanning</h3>
<p>Sealayer includes OCR (optical character recognition) capabilities that can extract text from scanned receipts and invoices. When enabled, the system automatically reads the vendor name, date, and amount from uploaded receipts and suggests these values in the expense form fields, saving time on manual entry.</p>

<h3>Donor Access</h3>
<p>Receipts attached to expenses are visible to linked donors through the donor portal. Donors can view and download receipts for any expense in the project, providing the supporting evidence they need to verify that funds were used as reported.</p>

<h3>Tips</h3>
<ul>
<li>Upload receipts at the time of recording the expense — it saves going back later.</li>
<li>Use clear photos or scans. Blurry or illegible receipts undermine trust.</li>
<li>For handwritten receipts common in field operations, take a photo in good lighting and ensure the amount, date, and vendor are legible.</li>
<li>Keep the original physical receipts as well — Sealayer supplements but does not replace your physical records.</li>
</ul>`
  },
  {
    title: 'Expense categories explained',
    slug: 'expense-categories',
    category: 'expenses',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Expense Categories Explained</h2>
<p>Expense categories on Sealayer correspond to the budget lines you set up for each project. They are the mechanism that links individual expenses to your planned budget, enabling accurate tracking of spend against plan.</p>

<h3>How Categories Work</h3>
<p>When you create budget lines for a project (e.g., Personnel, Equipment, Travel), those budget lines automatically become the available expense categories for that project. When recording an expense, you select the category from a dropdown, and the expense amount is deducted from that budget line's remaining balance.</p>

<h3>Common Categories</h3>
<ul>
<li><strong>Personnel</strong> — salaries, wages, benefits, consultant fees, and temporary staff costs.</li>
<li><strong>Equipment</strong> — purchase or rental of equipment, vehicles, tools, and technology assets.</li>
<li><strong>Travel</strong> — transportation, accommodation, per diem, and travel-related insurance.</li>
<li><strong>Materials &amp; Supplies</strong> — consumable materials for project activities (construction materials, medical supplies).</li>
<li><strong>Office &amp; Administration</strong> — rent, utilities, internet, phone, printing, and other overhead costs.</li>
<li><strong>Training &amp; Workshops</strong> — capacity building, training sessions, and workshops.</li>
<li><strong>Monitoring &amp; Evaluation</strong> — data collection, surveys, evaluations, and reporting.</li>
<li><strong>Contingency</strong> — a reserve for unexpected costs, often required by donors (typically 5-10% of the budget).</li>
</ul>

<h3>Category Reporting</h3>
<p>Categories are used extensively in Sealayer's reporting features. Financial reports break down spending by category showing budgeted vs. actual amounts. The comparison tool allows donors to compare category-level spending across multiple projects. Consistent use of categories across your projects makes these comparisons more meaningful.</p>

<h3>Donor Alignment</h3>
<p>Many donors specify the budget categories they expect in their grant agreements. When setting up your project budget on Sealayer, align your categories with your donor's requirements. This avoids confusion and makes donor reporting straightforward — the categories in Sealayer match the categories in the grant agreement, so reports map directly to donor expectations.</p>`
  },
  {
    title: 'Editing and deleting expenses',
    slug: 'editing-expenses',
    category: 'expenses',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Editing and Deleting Expenses</h2>
<p>Sealayer allows you to edit and delete expenses, but with full transparency. Every change is recorded in the immutable audit trail and anchored to the blockchain, ensuring that the history of modifications is always visible to donors and auditors.</p>

<h3>Editing an Expense</h3>
<ol>
<li>Navigate to the expense you want to edit from the project's Expenses tab or the global expenses list.</li>
<li>Click the expense to open its detail view.</li>
<li>Click <strong>Edit</strong> and modify the fields you need to change — description, amount, category, date, or attachments.</li>
<li>Click <strong>Save</strong> to apply the changes.</li>
</ol>

<h3>What Happens When You Edit</h3>
<p>When an expense is edited, Sealayer creates a new audit log entry that records which fields were changed, the old values and the new values, who made the change, and when. This audit entry is hashed, batched, and anchored to the blockchain just like any other action. Donors can see not just the current state of the expense, but every change that was made to it over time.</p>

<h3>Deleting an Expense</h3>
<p>Deleting an expense removes it from active views and financial calculations, but the audit trail is preserved. Sealayer does not perform hard deletes on financial data — the original record and all its associated audit entries remain in the system for verification purposes. Open the expense, click <strong>Delete</strong>, and confirm. You may be asked to provide a reason. The expense is then marked as deleted and excluded from budget calculations and reports.</p>

<h3>Why Full Transparency Matters</h3>
<p>The ability to see every edit and deletion is a core part of Sealayer's value proposition. In traditional systems, an expense can be quietly changed or removed with no trace. On Sealayer, every change is permanent and verifiable. This gives donors confidence that the financial data they are reviewing has not been manipulated.</p>

<h3>Permissions</h3>
<p>Editing and deleting expenses requires the <code>expenses:write</code> or <code>expenses:delete</code> permission. By default, Admins and Finance Officers have these permissions. Viewers and standard Project Managers have read-only access. You can customise permissions in Settings &gt; Roles &amp; Permissions.</p>`
  },
  {
    title: 'Understanding expense seals',
    slug: 'expense-seals',
    category: 'expenses',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Understanding Expense Seals</h2>
<p>Every expense recorded on Sealayer receives a Trust Seal — a cryptographic proof that the record existed at a specific point in time and has not been tampered with since. This article explains what seals are, how they work, and how to use them.</p>

<h3>What Is a Trust Seal?</h3>
<p>A Trust Seal is a bundle of cryptographic evidence that proves an expense record was created at a specific time and anchored to the Polygon blockchain. It contains:</p>
<ul>
<li><strong>Data hash</strong> — the SHA-256 hash of the expense record at the time it was created.</li>
<li><strong>Transaction hash</strong> — the Polygon blockchain transaction that recorded the Merkle root containing this entry.</li>
<li><strong>Block number</strong> — the Polygon block where the transaction was confirmed.</li>
<li><strong>Timestamp</strong> — the blockchain timestamp of the anchoring transaction.</li>
<li><strong>Merkle proof</strong> — a chain of hashes proving this specific entry is part of the anchored batch.</li>
</ul>

<h3>How Seals Are Created</h3>
<p>Seals are created automatically — you do not need to take any action. When you record an expense, Sealayer creates an audit log entry and computes its SHA-256 hash. The entry enters the pending queue (you will see a "Pending" status). Within five minutes, the batch anchor service collects up to 20 pending entries, builds a Merkle tree, and writes the Merkle root to Polygon. Once confirmed on-chain, the status changes to "Sealed" and the Trust Seal details become available.</p>

<h3>Viewing and Sharing a Seal</h3>
<p>Open any sealed expense and look for the <strong>Trust Seal</strong> section. You will see the transaction hash (clickable — it links to Polygonscan), the block number, and the timestamp. Click <strong>Share Verification</strong> to copy a link that anyone can open — no Sealayer account required. The link goes to verify.sealayer.io for independent verification.</p>

<h3>What If an Expense Is Edited?</h3>
<p>If an expense is edited after being sealed, the edit creates a new audit log entry with its own seal. The original seal remains valid — it proves the original data existed at the original time. The new seal proves the edited data existed at the time of the edit. Both seals are preserved, giving a complete verifiable history of the expense over its lifetime.</p>`
  },
  {
    title: 'Bulk expense management',
    slug: 'bulk-expenses',
    category: 'expenses',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Bulk Expense Management</h2>
<p>For organisations that process a high volume of transactions, recording expenses one at a time can be tedious. Sealayer provides bulk expense management tools to help you import, categorise, and process multiple expenses efficiently.</p>

<h3>Bulk Import via CSV</h3>
<p>The fastest way to record multiple expenses is to import them from a CSV file:</p>
<ol>
<li>Navigate to your project's <strong>Expenses</strong> tab.</li>
<li>Click the <strong>Import</strong> button (upload icon) in the toolbar.</li>
<li>Download the CSV template with required columns: description, amount, currency, category, funding source, and date.</li>
<li>Fill in the template with your expense data — each row is one expense.</li>
<li>Upload the completed CSV file.</li>
<li>Sealayer validates the data and shows a preview. Review it to catch errors such as invalid categories or missing amounts.</li>
<li>Click <strong>Import All</strong> to create the expenses.</li>
</ol>

<h3>Validation and Error Handling</h3>
<p>During import, Sealayer checks each row for valid amount (positive number), valid currency (supported ISO 4217 code), valid category (must match an existing budget line), valid funding source, and valid date format. Rows that fail validation are highlighted in red with error messages. You can fix them in the preview and retry, or skip them and import only valid rows.</p>

<h3>Bulk Actions</h3>
<p>On the expenses list, you can select multiple expenses using the checkboxes and perform bulk actions:</p>
<ul>
<li><strong>Change category</strong> — reassign selected expenses to a different budget category.</li>
<li><strong>Change funding source</strong> — move expenses from one funding source to another.</li>
<li><strong>Export</strong> — download selected expenses as a CSV or Excel file.</li>
<li><strong>Delete</strong> — mark selected expenses as deleted with full audit trail.</li>
</ul>

<h3>Audit Trail for Bulk Operations</h3>
<p>Bulk actions generate individual audit log entries for each affected expense. If you bulk-import 50 expenses, 50 audit entries are created, hashed, and queued for blockchain anchoring. The audit trail is never summarised — every individual change is recorded and anchored independently. For programmatic integration, you can also create expenses via the Sealayer API.</p>`
  },

  // ── Funding & Donors ────────────────────────────────────
  {
    title: 'Creating a funding agreement',
    slug: 'creating-funding-agreement',
    category: 'funding-donors',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Creating a Funding Agreement</h2>
<p>Funding agreements on Sealayer represent the formal arrangement between your organisation and a donor. They capture the terms of the funding — amount, currency, disbursement schedule, and conditions — and provide the framework for tracking and reporting throughout the project lifecycle.</p>

<h3>Setting Up an Agreement</h3>
<ol>
<li>Open your project and navigate to the <strong>Funding</strong> tab.</li>
<li>Click <strong>Add Funding Source</strong>.</li>
<li>Enter the details of the funding arrangement.</li>
</ol>

<h3>Agreement Details</h3>
<ul>
<li><strong>Donor/Grant Name</strong> — the name of the donor organisation or grant programme (e.g., "EU Delegation — Water &amp; Sanitation Grant").</li>
<li><strong>Funding Type</strong> — select from: <strong>Grant</strong> (non-repayable), <strong>Impact Loan</strong> (repayable with agreed terms), or <strong>Impact Investment</strong> (returns linked to impact outcomes).</li>
<li><strong>Amount</strong> — the total committed funding amount.</li>
<li><strong>Currency</strong> — the currency of the funding, which may differ from your project currency.</li>
<li><strong>Agreement Date</strong> — the date the agreement was signed.</li>
<li><strong>End Date</strong> — the agreement's expiry or final reporting date.</li>
</ul>

<h3>Uploading the Agreement Document</h3>
<p>You can attach the signed funding agreement document (PDF or scan) directly to the funding source. This is stored securely on S3 with a SHA-256 integrity hash and can be shared with the donor through the portal.</p>

<h3>Tranches and Donor Notification</h3>
<p>Most funding agreements involve staged disbursement through tranches. After creating the funding source, you can set up tranches from the funding detail page. When you invite a donor, they receive access to the agreement details through their portal, where they can review terms, see the tranche schedule, and track disbursements in real time. A project can have multiple funding sources, each tracking independently.</p>`
  },
  {
    title: 'Setting up tranches',
    slug: 'setting-up-tranches',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Setting Up Tranches</h2>
<p>Tranches are staged disbursements of funding. Most donors release funds in instalments rather than as a lump sum, with each instalment tied to specific milestones or conditions. Sealayer allows you to define the tranche schedule, track disbursements, and manage the approval process.</p>

<h3>Creating Tranches</h3>
<ol>
<li>Open your project, go to the <strong>Funding</strong> tab, and click on the funding source.</li>
<li>In the funding source detail view, click <strong>Add Tranche</strong>.</li>
<li>For each tranche, enter a name (e.g., "Tranche 1 — Initial Disbursement"), the amount, expected date, and any conditions that must be met before release.</li>
<li>Click <strong>Save</strong> to create the tranche. The sum of all tranches should equal the total funding amount.</li>
</ol>

<h3>Tranche Statuses</h3>
<p>Each tranche has a status reflecting its current state:</p>
<ul>
<li><strong>Pending</strong> — defined but no action taken.</li>
<li><strong>Conditions Met</strong> — all conditions fulfilled.</li>
<li><strong>Requested</strong> — the NGO has formally requested release.</li>
<li><strong>Approved</strong> — the donor has approved the release.</li>
<li><strong>Disbursed</strong> — funds have been received.</li>
<li><strong>Rejected</strong> — the donor has declined the request with a reason.</li>
</ul>

<h3>Tranche Timeline</h3>
<p>The funding source detail page shows a visual timeline of all tranches with amounts, expected dates, and current statuses. Completed tranches appear in green, pending in grey, and overdue in amber. This gives both the NGO and the donor a clear view of disbursement progress.</p>

<h3>Audit Trail</h3>
<p>Every tranche action — creation, condition fulfilment, request, approval, disbursement, or rejection — generates an audit log entry anchored to the blockchain. This provides an immutable record of the entire disbursement process, verifiable by both parties at any time.</p>`
  },
  {
    title: 'Tranche conditions — how they work',
    slug: 'tranche-conditions',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Tranche Conditions — How They Work</h2>
<p>Tranche conditions are requirements that must be met before a tranche can be released. They provide donors with assurance that key milestones have been achieved before additional funds are disbursed.</p>

<h3>Types of Conditions</h3>
<ul>
<li><strong>Document submission</strong> — a specific document must be uploaded (e.g., "Submit Q1 financial report").</li>
<li><strong>Expenditure threshold</strong> — a minimum percentage of the previous tranche must be spent (e.g., "At least 70% of Tranche 1 funds utilised").</li>
<li><strong>Activity completion</strong> — a specific project activity must be completed (e.g., "Baseline survey completed").</li>
<li><strong>Impact milestone</strong> — an impact metric must reach a target (e.g., "500 beneficiaries reached").</li>
<li><strong>Custom condition</strong> — any free-text condition agreed between the NGO and donor.</li>
</ul>

<h3>Adding Conditions</h3>
<p>Open the tranche detail view, click <strong>Add Condition</strong>, select the type, enter the specific requirement, and set whether it is <strong>required</strong> (must be met before release) or <strong>optional</strong> (informational, not blocking).</p>

<h3>Fulfilling Conditions</h3>
<p>Conditions can be fulfilled automatically or manually depending on type. Expenditure threshold conditions are automatically checked by Sealayer — when spending reaches the required percentage, the condition is marked as met. For document submissions, activity completions, and custom conditions, you mark them as fulfilled manually and can attach supporting evidence.</p>

<h3>Donor Review and Blockchain Verification</h3>
<p>Donors can see all conditions and their statuses through the donor portal. When all required conditions are met, the donor receives a notification and can approve the tranche release after reviewing the evidence. Every condition fulfilment is recorded in the audit trail and anchored to the blockchain, providing an immutable, verifiable record of when each condition was met, who marked it as fulfilled, and what evidence was provided.</p>`
  },
  {
    title: 'Releasing a tranche',
    slug: 'releasing-tranche',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Releasing a Tranche</h2>
<p>Releasing a tranche is the process of disbursing funds from a donor to your organisation. On Sealayer, the release involves both the NGO (requesting) and the donor (approving), with full transparency and blockchain verification at every step.</p>

<h3>The Release Workflow</h3>
<ol>
<li><strong>Conditions Fulfilled</strong> — ensure all required conditions for the tranche are met. The status shows "Conditions Met" when ready.</li>
<li><strong>Request Release</strong> — click the <strong>Request Release</strong> button. Add a note if needed. The status changes to "Requested".</li>
<li><strong>Donor Review</strong> — the donor receives a notification and reviews the request through their portal, checking conditions, evidence, and the project's financial status.</li>
<li><strong>Approval or Rejection</strong> — the donor approves or rejects the request. If rejected, they provide a reason.</li>
<li><strong>Disbursement Confirmation</strong> — once funds are received, mark the tranche as "Disbursed". This updates the project's funding balance.</li>
</ol>

<h3>Partial Releases</h3>
<p>In some cases, a donor may approve a partial release — disbursing part of the tranche amount. Sealayer supports this by allowing you to record the actual amount received, which may differ from the planned amount.</p>

<h3>Currency and Exchange Rates</h3>
<p>If the funding currency differs from the project currency, the exchange rate at the time of disbursement is recorded. Sealayer captures the rate used, the source of the rate, and the converted amount. This exchange rate record is also anchored to the blockchain.</p>

<h3>Audit Trail and Notifications</h3>
<p>Every step generates an audit log entry: the request, the donor's review, the approval or rejection, and the disbursement confirmation. Each entry is hashed and anchored to the blockchain. Sealayer sends notifications at key points — when a request is submitted (to the donor), when approved or rejected (to the NGO), and when disbursement is confirmed (to both parties).</p>`
  },
  {
    title: 'Inviting a donor to your project',
    slug: 'inviting-donor',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Inviting a Donor to Your Project</h2>
<p>Inviting a donor gives them access to the Sealayer donor portal, where they can view project financials, verify transactions, review documents, and approve tranche releases.</p>

<h3>How to Invite a Donor</h3>
<ol>
<li>Open your project and navigate to the <strong>Funding</strong> tab.</li>
<li>Find the funding source associated with the donor you want to invite.</li>
<li>Click the <strong>Invite Donor</strong> button.</li>
<li>Enter the donor's email address and optionally add a personalised message.</li>
<li>Click <strong>Send Invitation</strong>.</li>
</ol>

<h3>What the Donor Receives</h3>
<p>The donor receives an email with a link to the Sealayer donor portal. If they do not already have an account, they are prompted to create one. If they already have an account, they log in and the project appears in their portfolio.</p>

<h3>Donor Portal Access</h3>
<p>Once accepted, the donor can access: project overview and status, budget breakdown with actual vs. planned spending, all recorded expenses with receipts, their funding agreement and tranche schedule, the full audit trail with Trust Seals and blockchain verification, impact data and logframe progress, and the messenger for direct communication with your team.</p>

<h3>Managing Invitations</h3>
<p>From the Funding tab, you can see the status of each invitation: pending, accepted, or expired. Pending invitations can be resent. Some donor organisations have multiple people who need access — you can invite multiple email addresses to the same funding source, each creating their own account.</p>

<h3>Revoking Access</h3>
<p>If you need to revoke a donor's access, deactivate it from the Funding tab. This immediately removes portal access but preserves all historical data and audit trails. The deactivation only affects future access, not historical records.</p>`
  },
  {
    title: 'Understanding donor currency and reporting currency',
    slug: 'donor-currency',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Understanding Donor Currency and Reporting Currency</h2>
<p>International development projects often involve multiple currencies. A Kenyan NGO might receive funding in EUR from a European donor, operate day-to-day in KES, and need to report to the donor in EUR. Sealayer handles this complexity through its currency management system.</p>

<h3>Key Currency Concepts</h3>
<ul>
<li><strong>Base currency</strong> — your organisation's operating currency, set in your organisation profile. This is the default for new expenses.</li>
<li><strong>Project currency</strong> — the currency a specific project operates in. Usually the same as your base currency, but can differ.</li>
<li><strong>Funding currency</strong> — the currency of a specific funding agreement. This is what the donor commits and disburses in.</li>
<li><strong>Reporting currency</strong> — the currency used in reports to the donor. Typically the funding currency, so the donor sees amounts in their own currency.</li>
</ul>

<h3>How Conversion Works</h3>
<p>When you record an expense in your base currency but the funding source is in a different currency, Sealayer converts the amount using the applicable exchange rate. The conversion is shown on the expense detail: the base currency amount, the exchange rate used, and the equivalent amount in the funding/reporting currency.</p>

<h3>Exchange Rate Sources</h3>
<p>Sealayer uses monthly exchange rates set at the project level. These can be set manually (when a specific contractual rate applies) or pulled from a reference source. Exchange rates are sealed on the blockchain, providing verifiable proof of the rate applied.</p>

<h3>Best Practices</h3>
<ul>
<li>Set the funding currency to match the donor's grant agreement.</li>
<li>Record expenses in the currency they were actually paid in — Sealayer handles the conversion.</li>
<li>Update exchange rates monthly at a minimum.</li>
<li>Document the source of your exchange rates (e.g., "Central Bank of Kenya monthly average rate").</li>
</ul>`
  },
  {
    title: 'Managing multiple donors on one project',
    slug: 'multiple-donors',
    category: 'funding-donors',
    targetRole: 'ngo',
    order: 7,
    content: `<h2>Managing Multiple Donors on One Project</h2>
<p>Many NGO projects receive funding from more than one source. A single project might have a European Commission grant, a bilateral agency contribution, and an impact investment. Sealayer supports multi-donor projects with clear separation of funding sources, independent tranche management, and donor-specific reporting.</p>

<h3>Adding Multiple Funding Sources</h3>
<p>From your project's Funding tab, click <strong>Add Funding Source</strong> for each donor. Each funding source is independent with its own donor name, funding type, amount and currency, tranche schedule and conditions, and agreement documents.</p>

<h3>Allocating Expenses</h3>
<p>When recording an expense on a multi-donor project, you must select which funding source the expense should be charged against. This is critical for donor reporting — each donor needs to know how their specific contribution was used. If an expense is co-funded, you may need to split it into separate expense records for each funding source.</p>

<h3>Donor Visibility</h3>
<p>Each donor sees the overall project financials (total budget, total spending, budget utilisation) through their portal. However, they only see their own funding agreement details — their amount, tranches, and conditions. They do not see other donors' agreement details. This respects confidentiality while maintaining project-level transparency.</p>

<h3>Reporting</h3>
<p>When generating reports, you can filter by funding source. A donor report for "EU Grant" will show only expenses charged against the EU funding source, converted to the EU grant's reporting currency. The report includes grant amount, disbursements received, expenses to date, and remaining balance.</p>

<h3>Tips</h3>
<ul>
<li>Keep funding sources clearly named — use the donor's official name or grant reference number.</li>
<li>Be diligent about expense allocation — assigning expenses to the wrong funding source creates reporting errors.</li>
<li>Review funding balances regularly to ensure no single source is over-committed.</li>
</ul>`
  },

  // ── Documents ───────────────────────────────────────────
  {
    title: 'Uploading project documents',
    slug: 'uploading-documents',
    category: 'documents',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Uploading Project Documents</h2>
<p>Sealayer provides secure document management for all your project files. Documents are stored on Amazon S3 with SHA-256 integrity verification and blockchain anchoring, ensuring that every file can be independently verified as authentic and unaltered.</p>

<h3>How to Upload</h3>
<ol>
<li>Navigate to <strong>Documents</strong> from the sidebar or open a specific project and click the <strong>Documents</strong> tab.</li>
<li>Click <strong>Upload Document</strong>.</li>
<li>Select the project this document belongs to (if not already in a project context).</li>
<li>Choose the document type: Contract, Report, Invoice, Certificate, Proposal, Audit Report, or Other.</li>
<li>Add a title and optional description explaining what the document contains.</li>
<li>Set an expiry date if applicable (e.g., for contracts or insurance certificates).</li>
<li>Drag and drop the file or click browse to select it. Accepted formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, TIFF.</li>
<li>Click <strong>Upload</strong>.</li>
</ol>

<h3>What Happens After Upload</h3>
<p>When a file is uploaded, Sealayer stores it securely on Amazon S3 with server-side encryption, calculates a SHA-256 hash of the file contents as a tamper-detection fingerprint, creates an audit log entry recording the upload (who uploaded it, when, which project), and queues the audit entry for blockchain anchoring. A presigned URL is generated for secure access — these URLs expire after a set period, ensuring documents are only accessible to authorised users.</p>

<h3>Document Organisation</h3>
<p>Documents are organised by project and by type. You can filter the document list by type, date range, or search by title. Each document shows its upload date, file size, type, and blockchain seal status. Keeping your documents well-organised and properly categorised makes it easier for donors to find what they need and for auditors to verify your records.</p>

<h3>Integrity Verification</h3>
<p>The SHA-256 hash stored with each document means that if the file is ever modified, the hash will no longer match. This provides cryptographic proof that the document is identical to what was originally uploaded. Combined with blockchain anchoring, this gives donors and auditors confidence that project documents have not been tampered with after upload.</p>`
  },
  {
    title: 'Document expiry and alerts',
    slug: 'document-expiry',
    category: 'documents',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Document Expiry and Alerts</h2>
<p>Many project documents have expiry dates — contracts, insurance certificates, registration documents, work permits, and compliance certifications. Sealayer tracks these dates and proactively alerts you before documents expire, helping you stay compliant and avoid gaps in documentation.</p>

<h3>Setting Expiry Dates</h3>
<p>When uploading a document, set the <strong>Expiry Date</strong> field. This is optional but strongly recommended for any time-sensitive document. You can also add or edit expiry dates on existing documents from the document detail page.</p>

<h3>Alert Schedule</h3>
<p>Sealayer sends notifications at three stages:</p>
<ul>
<li><strong>30 days before expiry</strong> — an early warning giving you time to arrange renewal or replacement.</li>
<li><strong>7 days before expiry</strong> — an urgent reminder to take action.</li>
<li><strong>On the expiry date</strong> — the document is marked as expired in the system.</li>
</ul>
<p>Alerts appear as in-app notifications on your dashboard and in the notification centre. Expired documents are highlighted in the document list with a red badge, and they appear in the dashboard's "Pending Actions" section.</p>

<h3>Donor Impact</h3>
<p>Expired documents can affect your project's health indicators. Some donors require current documentation (e.g., valid insurance, up-to-date registration) as conditions for tranche releases. If a required document expires, the associated tranche condition may be flagged as unfulfilled. Keeping your documents current demonstrates diligence and professionalism to your donors.</p>

<h3>Renewal Workflow</h3>
<p>When a document expires, upload the renewed version as a new document. The expired version remains in the system as a historical record — Sealayer never deletes documents. Both versions are preserved with their respective blockchain seals, providing a complete document history.</p>`
  },
  {
    title: 'Sharing documents with donors',
    slug: 'sharing-documents',
    category: 'documents',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Sharing Documents with Donors</h2>
<p>Sealayer gives you control over which documents donors can see. By default, documents uploaded to a project are visible to linked donors, but you can customise sharing settings for each document.</p>

<h3>Project-Level Sharing</h3>
<p>All documents uploaded to a project are visible to donors who have a funding agreement on that project by default. Donors can view and download these documents from the Documents tab in their donor portal. This ensures donors always have access to the latest project documentation without you needing to send files manually.</p>

<h3>Direct Sharing via Messenger</h3>
<p>You can share specific documents through the Sealayer messenger. Open a conversation with a donor, click the attachment icon, and select a document from your project. The donor receives the document in their message thread and can download it directly.</p>

<h3>Presigned URLs</h3>
<p>For sharing with people outside Sealayer, you can generate a presigned URL — a time-limited download link that expires after a set period (default: 7 days). This is useful for sharing documents with auditors, board members, or government agencies who do not have Sealayer accounts. The presigned URL provides secure, temporary access to the specific document without exposing other project data.</p>

<h3>Visibility Controls</h3>
<p>If you have internal documents that should not be visible to donors (e.g., internal meeting notes, draft budgets), you can mark them as "Internal Only" when uploading. Internal documents are visible only to your team members and are hidden from the donor portal. You can change a document's visibility at any time from the document detail page. The visibility change is recorded in the audit trail.</p>

<h3>Integrity Assurance</h3>
<p>Regardless of how a document is shared, the SHA-256 hash ensures integrity. If a donor downloads a document and wants to verify it has not been altered, they can check the hash against the value stored in Sealayer's blockchain-anchored audit trail.</p>`
  },
  {
    title: 'OCR and document scanning',
    slug: 'ocr-scanning',
    category: 'documents',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>OCR and Document Scanning</h2>
<p>Sealayer includes Optical Character Recognition (OCR) capabilities that can automatically extract structured data from scanned receipts, invoices, and other financial documents. This reduces manual data entry and helps catch errors early.</p>

<h3>What OCR Extracts</h3>
<p>When a receipt or invoice is uploaded, the OCR engine attempts to extract:</p>
<ul>
<li><strong>Amount</strong> — the total or line-item amounts on the document.</li>
<li><strong>Date</strong> — the transaction or invoice date.</li>
<li><strong>Vendor name</strong> — the merchant, supplier, or service provider name.</li>
<li><strong>Currency</strong> — the currency symbol or code shown on the document.</li>
<li><strong>Invoice number</strong> — reference numbers for cross-checking.</li>
</ul>

<h3>How It Works</h3>
<p>OCR processing runs automatically when you upload an image or scanned PDF to an expense. The extracted data appears as suggestions in the expense form — you can accept, modify, or ignore the suggestions. OCR works best with clear, high-resolution images. Printed receipts typically yield better results than handwritten ones, though the engine handles both.</p>

<h3>Mismatch Detection</h3>
<p>If the OCR-extracted data does not match the expense entry (e.g., the receipt shows $500 but the expense is recorded as $50), Sealayer flags the mismatch with a warning icon. This helps catch data entry errors before they become part of the permanent audit trail. Mismatches are visible to donors in the donor portal, so resolving them promptly maintains trust.</p>

<h3>Supported Formats and Tips</h3>
<p>OCR supports PNG, JPG, TIFF, and scanned PDF files. For best results, ensure good lighting when photographing receipts, keep the document flat and well-aligned, and avoid shadows or glare. For field operations where receipt quality may be variable, the OCR serves as an aid rather than a replacement for careful manual entry. Always verify OCR suggestions against the original document before saving the expense.</p>`
  },

  // ── Impact & Reporting ──────────────────────────────────
  {
    title: 'Setting up a logframe',
    slug: 'logframe',
    category: 'impact-reporting',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Setting Up a Logframe</h2>
<p>A logframe (Logical Framework) is a structured planning tool used widely in the development sector to define project objectives, indicators, and assumptions. On Sealayer, the logframe provides the foundation for impact measurement and donor reporting.</p>

<h3>Creating a Logframe</h3>
<ol>
<li>Open your project and go to the <strong>Impact</strong> tab.</li>
<li>Click <strong>Create Logframe</strong>.</li>
<li>Define your <strong>Goal</strong> — the high-level impact you aim to achieve (e.g., "Improved access to clean water in Turkana County").</li>
<li>Add <strong>Outcomes</strong> — the changes you expect to see as a result of your work (e.g., "Reduced waterborne disease incidence by 30%").</li>
<li>Add <strong>Outputs</strong> — the tangible deliverables (e.g., "20 boreholes constructed and operational").</li>
<li>Add <strong>Activities</strong> — the actions required to produce outputs (e.g., "Conduct hydrogeological surveys").</li>
</ol>

<h3>Indicators and Verification</h3>
<p>For each level of the logframe, define <strong>Indicators</strong> (measurable signs of progress), <strong>Means of Verification</strong> (how you will measure the indicators), and <strong>Assumptions</strong> (external conditions that must hold for the logic to work). Well-defined indicators are specific, measurable, achievable, relevant, and time-bound.</p>

<h3>Donor Visibility</h3>
<p>The logframe is visible to donors through the donor portal. It provides a structured framework for understanding your project's theory of change — how activities lead to outputs, how outputs lead to outcomes, and how outcomes contribute to the overall goal. As you record impact metrics against logframe indicators, donors can track progress in real time.</p>

<h3>Tips</h3>
<ul>
<li>Align your logframe with your donor's expectations — many donors have specific logframe formats.</li>
<li>Keep indicators measurable and realistic — you will need to report against them throughout the project.</li>
<li>Review and update assumptions regularly — if key assumptions change, communicate with donors promptly.</li>
</ul>`
  },
  {
    title: 'Recording impact metrics',
    slug: 'impact-metrics',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Recording Impact Metrics</h2>
<p>Impact metrics track the measurable outcomes of your project against the indicators defined in your logframe. Recording them regularly demonstrates progress to donors and provides evidence that your project is achieving its intended impact.</p>

<h3>Adding a Metric</h3>
<ol>
<li>Go to the <strong>Impact</strong> tab in your project.</li>
<li>Click <strong>Add Metric</strong>.</li>
<li>Select the logframe indicator this metric relates to (e.g., "Number of boreholes completed").</li>
<li>Enter the <strong>value</strong> (e.g., 12), the <strong>date</strong> of measurement, and any <strong>notes</strong> providing context.</li>
<li>Attach supporting evidence if available — photos, survey results, or third-party verification reports.</li>
<li>Click <strong>Save</strong>.</li>
</ol>

<h3>Tracking Progress Over Time</h3>
<p>As you add metrics over the life of the project, Sealayer builds a time-series view for each indicator. This is displayed as charts and tables showing progress against targets. Donors can see these charts through their portal, giving them a visual representation of your project's impact trajectory.</p>

<h3>Baseline and Target Values</h3>
<p>When setting up logframe indicators, you can define baseline values (the starting point before the project began) and target values (what you aim to achieve by the end). Each metric entry is plotted against these reference points, making it easy to see whether you are on track, ahead, or behind.</p>

<h3>Audit Trail</h3>
<p>Like all data on Sealayer, impact metrics are recorded in the audit trail and anchored to the blockchain. This means donors can verify that the impact data you report is authentic and has not been altered after the fact. The combination of financial transparency and impact verification sets Sealayer apart from traditional reporting tools.</p>`
  },
  {
    title: 'Risk register — how to use it',
    slug: 'risk-register',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Risk Register — How to Use It</h2>
<p>The risk register helps you identify, assess, and mitigate risks to your project. Proactive risk management builds donor confidence and helps your team prepare for challenges before they become crises.</p>

<h3>Adding a Risk</h3>
<ol>
<li>Go to the <strong>Impact</strong> tab and select <strong>Risk Register</strong>.</li>
<li>Click <strong>Add Risk</strong>.</li>
<li>Describe the risk clearly (e.g., "Seasonal flooding may delay construction during Q3").</li>
<li>Set the <strong>likelihood</strong> — Low, Medium, or High.</li>
<li>Set the <strong>impact</strong> — Low, Medium, or High.</li>
<li>Define <strong>mitigation actions</strong> — what you will do to reduce the likelihood or impact (e.g., "Accelerate construction schedule to complete before rainy season").</li>
<li>Assign an <strong>owner</strong> — the team member responsible for monitoring and mitigating this risk.</li>
</ol>

<h3>Risk Scoring and Matrix</h3>
<p>Risks are automatically scored based on likelihood multiplied by impact, producing a risk rating. These are displayed in a visual risk matrix — a grid showing risks by severity. High-likelihood, high-impact risks appear in the red zone and require immediate attention. Low-likelihood, low-impact risks appear in the green zone and may only need monitoring.</p>

<h3>Ongoing Management</h3>
<p>The risk register is a living document. Review it regularly (monthly is recommended) and update risks as circumstances change. Mark risks as "Mitigated" when they have been resolved or as "Occurred" if the risk materialised. Add new risks as they are identified. The full history of risk changes is preserved in the audit trail.</p>

<h3>Donor Visibility</h3>
<p>Donors can view the risk register through their portal. Proactive risk identification and management demonstrates operational maturity and builds trust. Many donors explicitly require risk registers as part of their reporting requirements, and having one integrated with your project management on Sealayer simplifies compliance.</p>`
  },
  {
    title: 'Generating financial reports',
    slug: 'financial-reports',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Generating Financial Reports</h2>
<p>Sealayer can generate comprehensive financial reports for your projects, suitable for donor reporting, internal review, and audit preparation. Reports pull data directly from your project records, ensuring accuracy and consistency.</p>

<h3>Report Types</h3>
<ul>
<li><strong>Budget vs Actual</strong> — shows budgeted amounts against actual spend per budget category, with utilisation percentages and variance analysis. The most commonly requested report by donors.</li>
<li><strong>Expense Summary</strong> — all expenses grouped by category, date, or funding source. Includes individual expense details with receipt references.</li>
<li><strong>Funding Summary</strong> — status of all funding agreements and tranches, including amounts committed, disbursed, and outstanding.</li>
<li><strong>NAV Report</strong> — Net Asset Value report for impact investment projects, showing investment balances, drawdowns, and repayments.</li>
</ul>

<h3>Generating a Report</h3>
<ol>
<li>Go to <strong>Reports</strong> in the sidebar.</li>
<li>Select the report type.</li>
<li>Choose the project and date range.</li>
<li>Select the <strong>currency</strong> — you can generate the report in your base currency or the donor's reporting currency. Sealayer handles conversion using the sealed exchange rates for each period.</li>
<li>Click <strong>Generate</strong>.</li>
<li>Download as PDF or share directly with donors through the portal or messenger.</li>
</ol>

<h3>Report Integrity</h3>
<p>Every generated report includes a summary of blockchain verification: the number of sealed transactions, the date range of anchoring, and links to representative transaction hashes on Polygonscan. This gives the report's recipients independent verification that the underlying data is authentic. Reports shared through Sealayer also receive their own blockchain seal, proving the report content has not been modified after generation.</p>

<h3>Scheduling</h3>
<p>For recurring reporting needs, you can set up scheduled reports that are generated automatically at defined intervals (monthly, quarterly). Scheduled reports are saved in your Reports archive and can be automatically shared with linked donors.</p>`
  },
  {
    title: 'Generating donor reports',
    slug: 'donor-reports',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Generating Donor Reports</h2>
<p>Donor reports combine financial data, impact metrics, and blockchain verification into a single, comprehensive document designed specifically for your donors. They are the primary deliverable that demonstrates how funds have been used and what impact has been achieved.</p>

<h3>What Is Included</h3>
<ul>
<li><strong>Project overview</strong> — name, description, status, and timeline.</li>
<li><strong>Budget vs actual spend</strong> — in the donor's reporting currency, showing each budget category with planned, actual, and remaining amounts.</li>
<li><strong>Expense breakdown</strong> — detailed expense list with dates, descriptions, amounts, and receipt references.</li>
<li><strong>Tranche status</strong> — the full history of tranche requests, approvals, and disbursements.</li>
<li><strong>Impact metrics</strong> — logframe progress with charts showing indicator values over time against targets.</li>
<li><strong>Exchange rate table</strong> — the rates used for currency conversion in each reporting period.</li>
<li><strong>Blockchain verification summary</strong> — the number of anchored transactions, representative transaction hashes, and links to Polygonscan for independent verification.</li>
</ul>

<h3>Generating and Sharing</h3>
<p>Navigate to <strong>Reports &gt; Donor Report</strong>, select the project, donor (funding source), and date range, then click Generate. The report can be downloaded as PDF, shared via a secure link (blockchain-verified), or sent directly through the Sealayer messenger. When you share a report link, the recipient can verify the report's integrity through the attached blockchain seal — proving the content has not been modified after generation.</p>

<h3>Customisation</h3>
<p>You can customise which sections appear in the donor report. For example, some donors may want only financial data, while others want the full package including impact metrics and risk register. Save your preferences as a template for future reports. Donor reports are also available in multiple languages if your organisation has configured multilingual support.</p>`
  },
  {
    title: 'Understanding the comparison tool',
    slug: 'comparison-tool',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Understanding the Comparison Tool</h2>
<p>The comparison tool lets you compare financial data between two periods side by side — useful for quarterly reviews, year-on-year analysis, or tracking how spending patterns evolve over the life of a project.</p>

<h3>How to Use It</h3>
<ol>
<li>Go to <strong>Reports &gt; Compare</strong>.</li>
<li>Select the project you want to analyse.</li>
<li>Choose <strong>Period A</strong> (e.g., Q1 2026) and <strong>Period B</strong> (e.g., Q2 2026).</li>
<li>Click <strong>Compare</strong>.</li>
</ol>

<h3>What You See</h3>
<p>The tool displays side-by-side columns for each period showing:</p>
<ul>
<li><strong>Expense totals</strong> by budget category for each period.</li>
<li><strong>Variance</strong> — the absolute difference between Period A and Period B.</li>
<li><strong>Percentage change</strong> — how much spending increased or decreased between periods.</li>
<li><strong>Budget utilisation</strong> — how much of the total budget was consumed in each period.</li>
</ul>

<h3>Use Cases</h3>
<ul>
<li><strong>Quarterly review</strong> — compare Q1 vs Q2 to see if spending is accelerating or slowing down.</li>
<li><strong>Year-on-year</strong> — compare the same quarter across different years for multi-year projects.</li>
<li><strong>Donor discussions</strong> — use comparison data in donor meetings to explain spending trends and justify budget adjustments.</li>
<li><strong>Cross-project</strong> — compare two different projects to identify spending patterns or efficiency differences.</li>
</ul>

<h3>Export</h3>
<p>Comparison results can be exported as PDF or CSV for inclusion in reports or presentations. The exported file includes the period definitions, all data rows, and variance calculations. Donors can also access the comparison tool through their portal for independent analysis.</p>`
  },
  {
    title: 'NAV reports explained',
    slug: 'nav-reports',
    category: 'impact-reporting',
    targetRole: 'ngo',
    order: 7,
    content: `<h2>NAV Reports Explained</h2>
<p>NAV (Net Asset Value) reports are specialised financial reports used for impact investment projects. They show the current value of investments, outstanding balances, returns, and repayment progress. If your project has impact investment funding sources, NAV reports provide investors with the financial transparency they need.</p>

<h3>What NAV Reports Include</h3>
<ul>
<li><strong>Total investment value</strong> — the total amount committed by the investor.</li>
<li><strong>Drawdowns to date</strong> — the cumulative amount drawn down from the investment.</li>
<li><strong>Repayments made</strong> — total repayments returned to the investor, broken down by principal and any returns.</li>
<li><strong>Outstanding balance</strong> — the remaining amount to be repaid.</li>
<li><strong>Return on investment</strong> — calculated returns based on the repayment schedule and actual payments made.</li>
<li><strong>Currency conversion details</strong> — if the investment and project operate in different currencies, the report shows all conversion details with the sealed exchange rates used.</li>
</ul>

<h3>Generating a NAV Report</h3>
<p>Navigate to <strong>Reports &gt; NAV Report</strong>, select the project and the investment funding source, choose the reporting date (the NAV is calculated as of this date), and click Generate. The report can be downloaded as PDF or shared with the investor through the platform.</p>

<h3>Blockchain Verification</h3>
<p>NAV reports include blockchain verification data for all underlying transactions — drawdowns, repayments, and balance calculations. This gives investors cryptographic proof that the financial data in the report is authentic and has not been modified. The NAV report itself also receives a blockchain seal when generated, providing end-to-end verification from individual transactions to the final report.</p>

<h3>Scheduling</h3>
<p>For ongoing investment relationships, NAV reports can be scheduled for automatic generation (typically monthly or quarterly). Scheduled reports are saved in your Reports archive and can be shared automatically with the linked investor.</p>`
  },

  // ── Impact Investment ───────────────────────────────────
  {
    title: 'What is impact investment on Sealayer',
    slug: 'what-is-impact-investment',
    category: 'impact-investment',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>What Is Impact Investment on Sealayer</h2>
<p>Impact investment on Sealayer allows organisations to receive investment capital — not grants — with defined repayment schedules and returns. Unlike traditional grants where funds are non-repayable, impact investments are structured as financial instruments where the investor expects their capital back, often with a return.</p>

<h3>Key Concepts</h3>
<ul>
<li><strong>Investment opportunity</strong> — a proposal you create describing the investment, expected returns, use of funds, and social impact objectives.</li>
<li><strong>Drawdown</strong> — a request to draw funds from an approved investment. Drawdowns can be partial, allowing you to access capital as needed.</li>
<li><strong>Repayment schedule</strong> — the agreed timeline for repaying the investment, including principal and any returns or interest.</li>
<li><strong>Outstanding balance</strong> — the remaining amount to be repaid, updated automatically as repayments are made.</li>
<li><strong>NAV (Net Asset Value)</strong> — the current value of the investment, calculated from drawdowns, repayments, and any accrued returns.</li>
</ul>

<h3>How It Differs from Grants</h3>
<p>With grants, funds flow one way — from donor to NGO. With impact investment, funds flow in both directions. The investor provides capital, the NGO uses it to achieve social impact, and the NGO repays the capital (plus agreed returns) over time. Sealayer tracks this complete cycle with the same blockchain-anchored transparency it provides for grants.</p>

<h3>Why Sealayer for Impact Investment</h3>
<p>Impact investors need confidence that their capital is being used as intended and that repayments will be made on schedule. Sealayer provides this through real-time financial visibility, blockchain-verified audit trails, automated balance tracking, and NAV reporting. Every drawdown, expense, and repayment is sealed to the blockchain, giving investors the same level of verifiable transparency that grant-making donors receive.</p>`
  },
  {
    title: 'Creating an investment opportunity',
    slug: 'creating-investment',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Creating an Investment Opportunity</h2>
<p>An investment opportunity is a structured proposal that describes how investment capital will be used, what social impact it will achieve, and how and when the capital will be repaid.</p>

<h3>Creating an Opportunity</h3>
<ol>
<li>Go to <strong>Impact Investment</strong> in the sidebar.</li>
<li>Click <strong>New Opportunity</strong>.</li>
<li>Enter the investment details: title, description, total amount, and currency.</li>
<li>Define the <strong>expected return rate</strong> — the percentage return the investor can expect.</li>
<li>Set the <strong>repayment timeline</strong> — frequency (monthly, quarterly), duration, and start date.</li>
<li>Describe the <strong>use of funds</strong> — how the capital will be deployed and what impact it will achieve.</li>
<li>Add supporting documents — business plans, financial projections, impact assessments.</li>
<li>Click <strong>Submit for Review</strong>.</li>
</ol>

<h3>Investor Review</h3>
<p>Once submitted, the investment opportunity is visible to potential investors through the platform. Investors can review the proposal, examine supporting documents, and assess the risk and return profile. If they decide to proceed, they can approve the investment, triggering the creation of a formal investment agreement on Sealayer.</p>

<h3>Investment Agreement</h3>
<p>The approved investment creates a funding source on the linked project with type "Impact Investment". It includes the total amount, currency, repayment schedule, and any conditions. From this point, you can make drawdown requests, record expenses against the investment, and track repayments — all with blockchain-anchored transparency. The entire lifecycle from proposal to final repayment is captured in the immutable audit trail.</p>`
  },
  {
    title: 'Drawdown requests',
    slug: 'drawdown-requests',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Drawdown Requests</h2>
<p>A drawdown is a request to release funds from an approved investment. Unlike grants which are typically disbursed in pre-defined tranches, investment drawdowns are initiated by the NGO based on operational needs. You can request partial or full drawdowns as your project requires capital.</p>

<h3>Making a Drawdown Request</h3>
<ol>
<li>Open the investment agreement from the project's Funding tab or the Impact Investment section.</li>
<li>Click <strong>Request Drawdown</strong>.</li>
<li>Enter the <strong>amount</strong> you wish to draw — this cannot exceed the remaining undrawn balance.</li>
<li>Provide a <strong>purpose</strong> description explaining how the funds will be used.</li>
<li>Attach any supporting documentation if required by the investment agreement.</li>
<li>Click <strong>Submit</strong>.</li>
</ol>

<h3>Investor Approval</h3>
<p>The investor receives a notification and reviews the drawdown request through their portal. They can see the requested amount, purpose, the current outstanding balance, and the project's financial position. The investor approves or rejects the request. Once approved, the drawdown amount is added to the outstanding balance and deducted from the available investment amount.</p>

<h3>Tracking Drawdowns</h3>
<p>All drawdowns are listed in the investment detail view with dates, amounts, and statuses. The cumulative drawdown total is tracked against the total investment amount, giving both parties a clear view of how much capital has been deployed. Every drawdown request, approval, and disbursement is recorded in the blockchain-anchored audit trail, providing verifiable proof of the complete funding flow.</p>`
  },
  {
    title: 'Repayment schedules',
    slug: 'repayment-schedules',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Repayment Schedules</h2>
<p>Repayment schedules define when and how much you will repay to the investor. They are agreed upon when the investment is created and form a binding commitment that Sealayer tracks automatically.</p>

<h3>Setting Up a Repayment Schedule</h3>
<p>When creating an investment opportunity, you define the repayment schedule with:</p>
<ul>
<li><strong>Frequency</strong> — how often repayments are due: monthly, quarterly, semi-annually, or custom dates.</li>
<li><strong>Amount</strong> — fixed amount per instalment, or a percentage of the principal. Some schedules include graduated repayments that increase over time.</li>
<li><strong>Start date</strong> — when repayments begin. This is often set after a grace period to allow the project to generate revenue or impact before repayment starts.</li>
<li><strong>Duration</strong> — the total repayment period (e.g., 36 months, 5 years).</li>
<li><strong>Return rate</strong> — the agreed return (interest) rate, if applicable.</li>
</ul>

<h3>Tracking Repayments</h3>
<p>Sealayer generates a repayment calendar showing each upcoming instalment with its due date and amount. As repayments are made, you record them in the system. Each repayment updates the outstanding balance automatically. Overdue repayments are flagged with an alert for both the NGO and the investor.</p>

<h3>Recording a Repayment</h3>
<p>When you make a repayment, open the investment agreement, click <strong>Record Repayment</strong>, enter the amount paid and the date. If the repayment currency differs from the investment currency, the exchange rate is captured. Each repayment is recorded in the audit trail and anchored to the blockchain.</p>

<h3>Investor Visibility</h3>
<p>Investors can see the full repayment schedule, history of payments made, and the current outstanding balance through their portal. This real-time visibility, combined with blockchain verification of each repayment, gives investors confidence that their capital is being managed responsibly and repaid according to the agreed terms.</p>`
  },
  {
    title: 'Tracking outstanding balances',
    slug: 'tracking-balances',
    category: 'impact-investment',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Tracking Outstanding Balances</h2>
<p>The investment dashboard provides a real-time view of your outstanding balances across all impact investments. This is essential for financial planning and for maintaining transparency with your investors.</p>

<h3>What You See</h3>
<ul>
<li><strong>Total invested amount</strong> — the total capital committed across all investment agreements.</li>
<li><strong>Total drawn down</strong> — the cumulative amount you have drawn from all investments.</li>
<li><strong>Total repaid</strong> — the cumulative amount you have repaid, including any returns or interest.</li>
<li><strong>Outstanding balance</strong> — the remaining amount to be repaid (drawn down minus repaid).</li>
<li><strong>Next repayment</strong> — the due date and amount of your next scheduled repayment.</li>
</ul>

<h3>Per-Investment View</h3>
<p>Click on any individual investment to see its specific balance details: the original investment amount, drawdown history, repayment history, current outstanding balance, and the remaining repayment schedule. A visual chart shows the balance trajectory over time — how it increased with drawdowns and decreased with repayments.</p>

<h3>Alerts and Reminders</h3>
<p>Sealayer sends reminders before repayments are due: 7 days before and 1 day before. If a repayment is overdue, both you and the investor receive notifications. Overdue repayments are highlighted in the investment dashboard and may affect your project's health indicators.</p>

<h3>Shared Transparency</h3>
<p>Both you and the investor see exactly the same balance data, verified by the blockchain. There is no discrepancy between what you see and what they see. Every drawdown and repayment is anchored with a Trust Seal, so either party can independently verify the complete financial history of the investment at any time. This shared, verified view eliminates disputes and builds the trust that long-term investment relationships require.</p>`
  },

  // ── Blockchain & Verification ───────────────────────────
  {
    title: 'How blockchain anchoring works on Sealayer',
    slug: 'how-anchoring-works',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>How Blockchain Anchoring Works on Sealayer</h2>
<p>Blockchain anchoring is the technical process that makes Sealayer's audit trail immutable and independently verifiable. This article explains each step of the process in detail.</p>

<h3>The Anchoring Process</h3>
<ol>
<li><strong>Audit log creation</strong> — every significant action (creating expenses, uploading documents, releasing tranches) creates an audit log entry. Each entry is hashed using SHA-256 to produce a unique digital fingerprint.</li>
<li><strong>Batching</strong> — every 5 minutes, the batch anchor service collects pending entries into a batch of up to 20. This batching approach is more efficient than anchoring each entry individually.</li>
<li><strong>Merkle tree construction</strong> — a Merkle tree is built from the batch's hashes, producing a single root hash (the Merkle root) that represents the entire batch.</li>
<li><strong>Blockchain transaction</strong> — the Merkle root is written to the Polygon blockchain as a transaction. Once confirmed, this root hash is permanently stored on-chain.</li>
<li><strong>S3 archive</strong> — the full batch data, individual hashes, and Merkle proofs are archived in S3 for retrieval during verification.</li>
<li><strong>RFC 3161 timestamp</strong> — every 10 minutes, batches receive an RFC 3161 timestamp from a trusted third-party authority (FreeTSA, with Apple as fallback), providing legally recognised proof of when the data existed.</li>
</ol>

<h3>Why Polygon?</h3>
<p>Sealayer uses the Polygon blockchain because it provides fast transaction confirmation (seconds, not minutes), extremely low transaction costs (fractions of a cent per anchor), Ethereum compatibility and security inheritance, and wide industry adoption with established block explorers. This combination makes Polygon ideal for high-frequency anchoring at minimal cost.</p>

<h3>Merkle Proofs</h3>
<p>The Merkle tree structure means any individual entry can be proven to be part of the anchored batch without revealing the other entries. This is done through a Merkle proof — a chain of hashes linking the individual entry to the on-chain root. This is how Sealayer can verify a single expense against a batch of 20 entries without exposing the other 19.</p>

<h3>Automatic and Transparent</h3>
<p>The entire anchoring process is automatic — you do not need to take any action. Every action you take on Sealayer is automatically captured, hashed, batched, and anchored without any manual intervention.</p>`
  },
  {
    title: 'What is a Trust Seal',
    slug: 'what-is-trust-seal',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>What Is a Trust Seal</h2>
<p>A Trust Seal is Sealayer's blockchain-anchored proof that a piece of data — an expense, document, report, or any other audited action — is authentic and has not been altered since it was recorded. Trust Seals are the core differentiator of Sealayer, providing mathematical proof that your data is trustworthy.</p>

<h3>What a Trust Seal Contains</h3>
<ul>
<li><strong>Data hash</strong> — the SHA-256 hash of the original data at the time it was recorded. This is the digital fingerprint that uniquely identifies the record.</li>
<li><strong>Merkle proof</strong> — a chain of hashes linking this specific record to the Merkle root that was anchored on-chain. This proves the record is part of the anchored batch.</li>
<li><strong>Transaction hash</strong> — the Polygon blockchain transaction that recorded the Merkle root. Anyone can look this up on Polygonscan.</li>
<li><strong>Block number and timestamp</strong> — the specific Polygon block and the time of anchoring.</li>
<li><strong>RFC 3161 timestamp</strong> — a legally recognised timestamp from a trusted third-party authority.</li>
</ul>

<h3>How Trust Seals Protect Your Data</h3>
<p>The mathematical properties of SHA-256 hashing mean that if even a single character in the original record were changed, the hash would be completely different. Since the hash is anchored to the blockchain (which is immutable), any tampering with the original data would be immediately detectable — the recalculated hash would not match the on-chain record.</p>

<h3>Verification</h3>
<p>Anyone can verify a Trust Seal without needing a Sealayer account. The public verification page at verify.sealayer.io accepts a transaction hash and shows the verification result. Alternatively, the transaction can be looked up directly on Polygonscan. This independence — the ability to verify without relying on Sealayer — is what gives donors confidence in the platform.</p>

<h3>Seal Status</h3>
<p>Items on Sealayer show their seal status: <strong>Pending</strong> (awaiting the next anchoring cycle), <strong>Sealed</strong> (anchored to the blockchain), or <strong>Verified</strong> (independently verified by a third party). Most items move from Pending to Sealed within 5 minutes of creation.</p>`
  },
  {
    title: 'Understanding transaction hashes',
    slug: 'transaction-hashes',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Understanding Transaction Hashes</h2>
<p>A transaction hash (txHash) is a unique identifier for a blockchain transaction. On Sealayer, transaction hashes are the key to independent verification — they link your financial records to the immutable Polygon blockchain.</p>

<h3>What It Looks Like</h3>
<p>A transaction hash is a 66-character hexadecimal string starting with <code>0x</code>. For example: <code>0x3a7b8c9d...</code>. Every Polygon transaction has a unique hash that can never be duplicated. It serves as an address where anyone can look up the transaction details.</p>

<h3>Where to Find It</h3>
<p>Transaction hashes appear in several places on Sealayer:</p>
<ul>
<li>On sealed expenses — in the Trust Seal section of the expense detail.</li>
<li>On sealed documents — in the document detail view.</li>
<li>In the audit log — each anchored batch shows its transaction hash.</li>
<li>In reports — the blockchain verification section lists transaction hashes for the period covered.</li>
</ul>
<p>Click any transaction hash to open it directly on Polygonscan, the Polygon block explorer, where you can see the full transaction details on the public blockchain.</p>

<h3>What It Proves</h3>
<p>A transaction hash proves that specific data (the Merkle root containing your audit entries) was recorded on the Polygon blockchain at a specific time and block number. Because the blockchain is immutable, this proof cannot be forged or altered. Anyone — donors, auditors, regulators, or the public — can verify this independently using Polygonscan or verify.sealayer.io.</p>

<h3>Sharing Transaction Hashes</h3>
<p>You can share transaction hashes with anyone who needs to verify your data. Include them in donor reports, audit submissions, or board presentations. The recipient does not need a Sealayer account to verify — they simply paste the hash into Polygonscan or verify.sealayer.io and see the proof for themselves.</p>`
  },
  {
    title: 'Verifying a seal on verify.sealayer.io',
    slug: 'verify-seal',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Verifying a Seal on verify.sealayer.io</h2>
<p>The public verification page at <strong>verify.sealayer.io</strong> allows anyone to independently verify that a Sealayer record is authentic and has not been tampered with. No account or login is required — this is the cornerstone of Sealayer's trust model.</p>

<h3>How to Verify</h3>
<ol>
<li>Go to <strong>verify.sealayer.io</strong> in any web browser.</li>
<li>Enter the transaction hash or paste the full verification link.</li>
<li>Click <strong>Verify</strong>.</li>
<li>The system checks the Polygon blockchain and returns the verification result.</li>
</ol>

<h3>What You See</h3>
<p>A successful verification shows:</p>
<ul>
<li><strong>Verification status</strong> — confirmed or failed.</li>
<li><strong>Data hash</strong> — the SHA-256 hash of the original record.</li>
<li><strong>Timestamp</strong> — when the record was anchored to the blockchain.</li>
<li><strong>Block number</strong> — the Polygon block containing the transaction.</li>
<li><strong>Merkle proof</strong> — the chain of hashes proving this record is part of the anchored batch.</li>
<li><strong>Link to Polygonscan</strong> — for further independent verification directly on the block explorer.</li>
</ul>

<h3>Who Uses It</h3>
<p>The verification page is designed for donors, auditors, board members, regulators, and anyone else who needs to confirm the authenticity of your financial data. You can include verification links in donor reports, audit submissions, or public accountability documents. The fact that verification does not require a Sealayer account means there is no dependency on the platform — the proof exists independently on the public blockchain.</p>

<h3>What If Verification Fails</h3>
<p>A failed verification means the data hash does not match what was anchored on-chain. This would only happen if the original record was modified after anchoring — which Sealayer's architecture prevents. If you encounter a failed verification, contact support immediately.</p>`
  },
  {
    title: 'Sharing a verification link',
    slug: 'sharing-verification',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Sharing a Verification Link</h2>
<p>Every sealed item on Sealayer has a shareable verification link. You can send this link to anyone — donors, auditors, board members, the public — and they can verify the record independently without needing a Sealayer account.</p>

<h3>How to Share</h3>
<ol>
<li>Find the sealed item — an expense, document, audit log entry, or report.</li>
<li>Click the <strong>seal icon</strong> or the <strong>Share Verification</strong> button.</li>
<li>Copy the verification URL to your clipboard.</li>
<li>Send it via email, messenger, include it in a report, or paste it into a presentation.</li>
</ol>

<h3>What the Recipient Sees</h3>
<p>The link opens on verify.sealayer.io and displays the full verification details: the data hash, timestamp, block number, Merkle proof, and a direct link to the Polygon transaction on Polygonscan. The recipient can confirm that the record is authentic and has not been modified since it was anchored.</p>

<h3>Use Cases</h3>
<ul>
<li><strong>Donor reports</strong> — include verification links for key transactions in your quarterly or annual reports. Donors can click through to verify any specific item.</li>
<li><strong>Audit submissions</strong> — provide auditors with verification links for all financial records in the audit scope.</li>
<li><strong>Public accountability</strong> — share verification links on your website or in annual reports to demonstrate your commitment to transparency.</li>
<li><strong>Board presentations</strong> — include verification links to show your board that financial records are blockchain-verified.</li>
</ul>

<h3>Link Permanence</h3>
<p>Verification links are permanent. They do not expire, do not require login, and will work for as long as the Polygon blockchain exists. This means records verified today can be re-verified years from now, providing long-term accountability that outlasts any individual platform or service.</p>`
  },
  {
    title: 'Exchange rates and blockchain — how rates are sealed',
    slug: 'exchange-rates-blockchain',
    category: 'blockchain-verification',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Exchange Rates and Blockchain — How Rates Are Sealed</h2>
<p>Sealayer seals exchange rates to the blockchain, ensuring that the rates used for currency conversion are verifiable, transparent, and cannot be altered after the fact. This is a unique feature that addresses a common source of dispute in multi-currency project reporting.</p>

<h3>How It Works</h3>
<p>At the project level, exchange rates are captured monthly. These rates are hashed, included in the audit trail, and anchored to the Polygon blockchain just like any other record. Once sealed, the rate cannot be changed — any attempt to use a different rate would be detectable through the blockchain verification.</p>

<h3>Rate Sources</h3>
<p>Exchange rates can be set manually by the project manager (when a specific contractual rate is agreed with the donor) or pulled from reference sources such as central bank rates or international rate services. The source of the rate is recorded alongside the rate itself, so donors can verify both the rate and where it came from.</p>

<h3>Why This Matters</h3>
<p>Currency conversion is one of the most contentious areas in multi-currency grant reporting. Small differences in exchange rates can translate to significant differences in reported amounts. By sealing rates to the blockchain, Sealayer eliminates any possibility of rate manipulation. Donors can verify that the rates used in their reports match the rates that were sealed at the time, and they can cross-check these rates against independent sources.</p>

<h3>Verification</h3>
<p>Exchange rate seals appear in the audit trail alongside the rates themselves. Donors can view the sealed rates in their portal, in generated reports (which include an exchange rate table), and through the public verification page. Each sealed rate has its own Trust Seal that can be independently verified on the Polygon blockchain, providing cryptographic proof of the rate applied.</p>`
  },

  // ── Currency & Exchange Rates ───────────────────────────
  {
    title: 'Setting base currency and donor reporting currency on a project',
    slug: 'base-currency',
    category: 'currency-exchange',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Setting Base Currency and Donor Reporting Currency</h2>
<p>Sealayer supports multi-currency operations at every level: organisation, project, and funding source. Understanding how currencies are configured ensures that your financial data is recorded correctly and that donor reports show amounts in the right currency.</p>

<h3>Organisation Base Currency</h3>
<p>Your organisation's base currency is set in <strong>Settings &gt; Organisation</strong>. This is your day-to-day operating currency (e.g., KES for a Kenyan NGO, UGX for a Ugandan one). It serves as the default currency for new projects and expenses.</p>

<h3>Project Currency</h3>
<p>When creating a project, you can set a project-specific currency. This defaults to your base currency but can be changed. For example, a Kenyan NGO running a regional project might set the project currency to USD. All expenses on the project default to this currency.</p>

<h3>Funding/Donor Reporting Currency</h3>
<p>Each funding source has its own currency — the currency the donor commits and reports in. When you create a funding source (e.g., an EU grant in EUR), set the currency to match the grant agreement. This becomes the reporting currency for that donor. All reports generated for this donor will show amounts converted to EUR.</p>

<h3>How They Work Together</h3>
<p>An expense might be recorded in KES (project currency), but the donor report shows it in EUR (funding currency). Sealayer handles this conversion automatically using the sealed monthly exchange rate. The expense detail page shows both amounts: the original in KES and the converted amount in EUR, with the exchange rate used.</p>

<h3>Best Practice</h3>
<p>Always set the funding currency to match the donor's grant agreement. Record expenses in the currency they were actually incurred in. Sealayer handles all conversions transparently, with every rate sealed to the blockchain for independent verification.</p>`
  },
  {
    title: 'Understanding monthly exchange rates',
    slug: 'monthly-exchange-rates',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Understanding Monthly Exchange Rates</h2>
<p>Sealayer uses monthly exchange rates for currency conversion. Rather than using daily fluctuating rates (which can cause inconsistencies), Sealayer captures a rate at the beginning of each month and applies it consistently to all transactions within that month.</p>

<h3>Why Monthly Rates?</h3>
<p>Monthly rates provide several benefits for NGO financial management:</p>
<ul>
<li><strong>Consistency</strong> — all expenses within a month use the same rate, making reports predictable and easy to reconcile.</li>
<li><strong>Verifiability</strong> — each monthly rate is sealed to the blockchain, so donors can verify exactly which rate was applied.</li>
<li><strong>Simplicity</strong> — you do not need to track daily rate fluctuations or worry about which rate applies to which transaction.</li>
<li><strong>Donor alignment</strong> — many donor grant agreements specify monthly rates for reporting purposes, aligning with standard practice in the sector.</li>
</ul>

<h3>Setting Monthly Rates</h3>
<p>Navigate to <strong>Settings &gt; Exchange Rates</strong> or the project's currency settings. For each currency pair (e.g., KES/EUR, KES/USD), enter the rate for the current month. You can set rates manually or import them from a reference source. Once set, the rate is sealed to the blockchain and cannot be changed retroactively.</p>

<h3>Viewing Historical Rates</h3>
<p>The exchange rates page shows a history of all monthly rates with their blockchain seals. Each rate entry displays the month, the currency pair, the rate value, and the transaction hash of the blockchain seal. Click any entry to verify the rate on the public blockchain. This historical record is essential for audit purposes and donor verification.</p>`
  },
  {
    title: 'How to read the exchange rate table',
    slug: 'reading-exchange-table',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>How to Read the Exchange Rate Table</h2>
<p>The exchange rate table is available in project settings, in generated reports, and in the donor portal. Understanding how to read it ensures you and your donors are aligned on how currency conversions are calculated.</p>

<h3>Table Columns</h3>
<ul>
<li><strong>Month</strong> — the calendar month the rate applies to (e.g., "March 2026").</li>
<li><strong>From</strong> — the source currency (typically your project's base currency, e.g., KES).</li>
<li><strong>To</strong> — the target currency (typically the donor's reporting currency, e.g., EUR).</li>
<li><strong>Rate</strong> — the conversion rate. Read as "1 unit of From = X units of To" (e.g., 1 KES = 0.0069 EUR, or equivalently 1 EUR = 145.00 KES).</li>
<li><strong>Source</strong> — where the rate came from (e.g., "Central Bank of Kenya", "Manual entry", "OANDA").</li>
<li><strong>Seal</strong> — the blockchain transaction hash confirming the rate was sealed. Click to verify on Polygonscan.</li>
</ul>

<h3>Reading the Table in Reports</h3>
<p>Donor reports include an exchange rate table showing all rates used in the reporting period. This allows the donor to verify every conversion: they can take any expense amount in the base currency, apply the rate from the table, and confirm the converted amount matches what appears in the report. This mathematical transparency eliminates disputes about currency conversion.</p>

<h3>Cross-Checking Rates</h3>
<p>Donors can cross-check sealed rates against independent sources. If the sealed rate for March 2026 KES/EUR is 0.0069, the donor can look up the Central Bank of Kenya rate for that month and confirm they match. The combination of blockchain sealing and source documentation makes Sealayer's exchange rate handling one of its most trusted features for multi-currency projects.</p>`
  },
  {
    title: 'Currency conversion on expenses',
    slug: 'currency-conversion',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Currency Conversion on Expenses</h2>
<p>When your project operates in one currency but your donor reports in another, Sealayer automatically handles the conversion. This article explains exactly how expense currency conversion works and how it is verified.</p>

<h3>How Conversion Works</h3>
<p>Consider a project operating in KES (Kenyan Shillings) with a donor reporting in EUR:</p>
<ol>
<li>You record an expense of 100,000 KES in March 2026.</li>
<li>Sealayer looks up the sealed exchange rate for March 2026 (e.g., 1 EUR = 145 KES).</li>
<li>The expense is converted: 100,000 / 145 = 689.66 EUR.</li>
<li>Both amounts are displayed: 100,000 KES (original) and 689.66 EUR (converted).</li>
</ol>

<h3>Where Conversion Appears</h3>
<p>Converted amounts appear in several places:</p>
<ul>
<li><strong>Expense detail</strong> — shows both the original and converted amounts with the rate used.</li>
<li><strong>Budget view</strong> — budget utilisation can be viewed in either the project currency or the donor's reporting currency.</li>
<li><strong>Donor portal</strong> — donors see all amounts in their reporting currency by default.</li>
<li><strong>Reports</strong> — donor reports show converted amounts with an exchange rate table for reference.</li>
</ul>

<h3>Multi-Currency Expenses</h3>
<p>Sometimes an expense is incurred in a third currency (e.g., USD for an international supplier on a KES project with a EUR donor). In this case, you record the expense in USD, and Sealayer converts it to both KES (project currency) and EUR (donor reporting currency) using the respective sealed rates.</p>

<h3>Verification</h3>
<p>The exchange rate used for conversion is sealed to the blockchain, so donors can verify that the correct rate was applied. The rate, its source, and the blockchain seal are all visible in the expense detail and in generated reports. This end-to-end transparency eliminates disputes about currency conversion.</p>`
  },
  {
    title: 'Impact investment currency rules',
    slug: 'investment-currency',
    category: 'currency-exchange',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Impact Investment Currency Rules</h2>
<p>Impact investments follow the same multi-currency framework as grants, with some specific rules around repayments and balance tracking that are important to understand.</p>

<h3>Currency Rules</h3>
<ul>
<li><strong>Investment amount</strong> — defined in the investor's currency (e.g., USD). This is the agreed capital commitment.</li>
<li><strong>Drawdowns</strong> — when you draw funds, the amount is converted from the investment currency to the project currency at the sealed exchange rate for that month. Both amounts are recorded.</li>
<li><strong>Expenses</strong> — recorded in the project's base currency, as with any project. Converted to the investment currency for investor reporting.</li>
<li><strong>Repayments</strong> — must be made in the investment currency. If your project operates in a different currency, you convert at the prevailing rate and record the exchange rate used.</li>
<li><strong>Outstanding balance</strong> — always shown in the investment currency. This is the amount remaining to be repaid.</li>
</ul>

<h3>Exchange Rate Impact on Investments</h3>
<p>Currency fluctuations can affect the effective cost of an investment. If the project currency weakens against the investment currency between drawdown and repayment, the repayment becomes more expensive in local currency terms. Conversely, if the project currency strengthens, repayments become cheaper. Sealayer tracks and seals all exchange rates used, providing a complete, verifiable record of how currency movements affected the investment.</p>

<h3>NAV Reporting in Multiple Currencies</h3>
<p>NAV reports can be generated in either the investment currency or the project currency. When generated in the project currency, all investment amounts are converted using the sealed rates for each period. The report includes a currency conversion section showing all rates applied. This multi-currency capability ensures both the NGO and the investor have clear, verified visibility into the investment's financial position regardless of which currency they prefer to view.</p>`
  },

  // ── Messenger ───────────────────────────────────────────
  {
    title: 'Using the messenger with donors',
    slug: 'using-messenger',
    category: 'messenger',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Using the Messenger with Donors</h2>
<p>Sealayer's built-in messenger allows you to communicate directly with donors within the platform. Unlike external email, messenger conversations are linked to your projects, keeping all communication in context alongside your financial data and documents.</p>

<h3>Starting a Conversation</h3>
<ol>
<li>Go to <strong>Messenger</strong> in the sidebar.</li>
<li>Click <strong>New Conversation</strong> or select an existing contact from the list.</li>
<li>Select the donor contact you want to message. Contacts are automatically populated from linked funding sources.</li>
<li>Type your message and press Enter or click Send.</li>
</ol>

<h3>Features</h3>
<ul>
<li><strong>Real-time messaging</strong> — messages appear instantly with typing indicators so you know when the other person is composing a response.</li>
<li><strong>File attachments</strong> — share documents, receipts, reports, and images directly in the conversation (up to 10MB per file).</li>
<li><strong>Online/offline status</strong> — see whether your donor contacts are currently online, making it easy to know when to expect a quick response.</li>
<li><strong>Read receipts</strong> — confirm that your messages have been seen by the recipient.</li>
<li><strong>Project context</strong> — conversations can be linked to specific projects, keeping discussions organised and contextual.</li>
</ul>

<h3>When to Use Messenger</h3>
<p>The messenger is ideal for quick updates, clarifications about expenses or documents, tranche release discussions, informal progress updates, and any communication that benefits from being linked to your Sealayer data. For formal submissions (e.g., quarterly reports, tranche requests), use the platform's dedicated workflows — but the messenger is perfect for the discussions around those formal processes.</p>

<h3>Privacy and Security</h3>
<p>Messenger conversations are private between the participants and are not visible to other users in your organisation unless they are part of the conversation. Messages are stored securely and are accessible only to the parties involved. The messenger is a communication tool, not part of the audit trail — messages are not anchored to the blockchain.</p>`
  },
  {
    title: 'Sending files via messenger',
    slug: 'sending-files',
    category: 'messenger',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>Sending Files via Messenger</h2>
<p>The Sealayer messenger supports file sharing, allowing you to send documents, images, and other files directly to donors within your conversations. This is useful for quick sharing that does not need to go through the formal document management system.</p>

<h3>How to Send a File</h3>
<ol>
<li>Open a conversation in the messenger.</li>
<li>Click the <strong>attachment icon</strong> (paperclip) in the message input area, or drag and drop a file directly into the conversation.</li>
<li>Select the file from your device.</li>
<li>Optionally add a message to accompany the file.</li>
<li>Press Enter or click Send.</li>
</ol>

<h3>Supported File Types</h3>
<ul>
<li><strong>Documents</strong> — PDF, DOC, DOCX, XLS, XLSX.</li>
<li><strong>Images</strong> — PNG, JPG, JPEG, WebP.</li>
<li><strong>Maximum size</strong> — 10MB per file.</li>
</ul>

<h3>File Storage and Access</h3>
<p>Files shared through the messenger are stored securely and remain accessible to both parties in the conversation. Recipients can download files by clicking on them in the conversation history. Files sent through the messenger are separate from documents uploaded to the Documents section of a project — messenger files are for informal sharing, while project documents are part of the formal record.</p>

<h3>Sharing Project Documents</h3>
<p>If you want to share a document that is already uploaded to a project, you can reference it in a messenger conversation by clicking the document link icon and selecting from your project's document library. This links to the existing document rather than creating a duplicate, ensuring the donor accesses the same version with its associated blockchain seal and integrity hash.</p>`
  },
  {
    title: 'Online status and notifications',
    slug: 'online-status',
    category: 'messenger',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>Online Status and Notifications</h2>
<p>The Sealayer messenger shows real-time online status for your contacts and provides notifications for new messages, ensuring you never miss an important communication from a donor.</p>

<h3>Status Indicators</h3>
<ul>
<li><strong>Green dot</strong> — the contact is online and active on Sealayer. Messages sent will likely be seen immediately.</li>
<li><strong>Grey dot</strong> — the contact is offline. Messages will be delivered and they will see them when they next log in.</li>
</ul>

<h3>Notifications</h3>
<p>You receive in-app notifications for new messages. These appear as:</p>
<ul>
<li><strong>Badge count</strong> — a red badge on the Messenger sidebar link showing the number of unread conversations.</li>
<li><strong>Per-conversation badges</strong> — individual conversations show unread message counts.</li>
<li><strong>Browser notifications</strong> — if enabled, you receive desktop notifications even when Sealayer is not the active tab.</li>
<li><strong>Email notifications</strong> — for messages received while you are offline, Sealayer sends an email summary after a configurable delay (default: 15 minutes).</li>
</ul>

<h3>Notification Settings</h3>
<p>You can configure notification preferences from <strong>Settings &gt; Notifications</strong>. Options include enabling or disabling browser notifications, setting the email notification delay, and muting specific conversations. Finding the right balance ensures you stay informed without being overwhelmed, especially if you manage multiple donor relationships.</p>

<h3>Read Receipts</h3>
<p>When a recipient reads your message, you see a subtle indicator showing the message has been seen. This helps you know whether follow-up is needed or whether the donor has already reviewed your communication.</p>`
  },

  // ── Settings & Admin ────────────────────────────────────
  {
    title: 'Managing team permissions',
    slug: 'team-permissions',
    category: 'settings-admin',
    targetRole: 'ngo',
    isFeatured: true,
    order: 1,
    content: `<h2>Managing Team Permissions</h2>
<p>Sealayer uses role-based access control (RBAC) with granular, string-based permissions. This system gives you fine-grained control over what each team member can see and do within your organisation.</p>

<h3>Permission Format</h3>
<p>Permissions follow the pattern <code>resource:action</code>. Common permissions include:</p>
<ul>
<li><code>projects:read</code> — view projects and their details.</li>
<li><code>projects:write</code> — create and edit projects.</li>
<li><code>projects:delete</code> — delete or archive projects.</li>
<li><code>expenses:read</code> — view expenses.</li>
<li><code>expenses:write</code> — record and edit expenses.</li>
<li><code>expenses:delete</code> — delete expenses.</li>
<li><code>documents:read</code> — view documents.</li>
<li><code>documents:write</code> — upload and manage documents.</li>
<li><code>funding:read</code> — view funding agreements and tranches.</li>
<li><code>funding:write</code> — create and manage funding agreements.</li>
<li><code>system:admin</code> — full system administration including team management and settings.</li>
</ul>

<h3>Customising Roles</h3>
<p>Navigate to <strong>Settings &gt; Roles &amp; Permissions</strong> to view existing roles and their permissions. You can create custom roles by clicking <strong>Create Role</strong>, giving it a name, and selecting the permissions you want to include. For example, you might create a "Field Officer" role with <code>expenses:write</code> and <code>documents:write</code> but without access to funding agreements or settings.</p>

<h3>Assigning Roles</h3>
<p>Each user is assigned one or more roles. The user's effective permissions are the union of all permissions from their assigned roles. Go to <strong>Settings &gt; Team</strong>, click on a team member, and change their role assignment. Role changes take effect immediately.</p>

<h3>Audit Trail</h3>
<p>All permission and role changes are recorded in the audit trail. This means there is a permanent, blockchain-verified record of who had what access at any point in time — essential for compliance and accountability.</p>`
  },
  {
    title: 'API keys and webhooks',
    slug: 'api-keys-webhooks',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 2,
    content: `<h2>API Keys and Webhooks</h2>
<p>Sealayer provides API keys and webhooks for integrating with external systems. These tools allow you to programmatically interact with Sealayer and receive real-time notifications when events occur.</p>

<h3>API Keys</h3>
<p>API keys allow external systems to authenticate with the Sealayer API. Keys use a Stripe-style format: <code>tl_live_</code> prefix followed by random bytes.</p>
<ol>
<li>Go to <strong>Settings &gt; API Keys</strong>.</li>
<li>Click <strong>Generate Key</strong>.</li>
<li>Give the key a name (e.g., "Accounting System Integration") and select the permissions it should have.</li>
<li>Copy the key immediately and store it securely — it will not be shown again. Only the bcrypt hash is stored in Sealayer.</li>
</ol>
<p>API keys can be scoped with specific permissions (e.g., only <code>expenses:read</code>) and can have expiry dates. Revoke keys immediately if they are compromised.</p>

<h3>Webhooks</h3>
<p>Webhooks send real-time HTTP POST requests to external URLs when events occur on Sealayer. This is useful for triggering actions in your accounting system, notification services, or data warehouse.</p>
<ol>
<li>Go to <strong>Settings &gt; Webhooks</strong>.</li>
<li>Click <strong>Add Webhook</strong>.</li>
<li>Enter the endpoint URL and select which events should trigger the webhook (expense created, document uploaded, tranche released, etc.).</li>
<li>Save — the HMAC-SHA256 signing secret will be shown once. Use this to verify webhook payloads in your receiving application.</li>
</ol>

<h3>Webhook Security</h3>
<p>All webhook payloads are signed with HMAC-SHA256 using your signing secret. Verify the signature in your receiving application to ensure the payload is authentic and has not been tampered with. Sealayer retries failed deliveries up to 3 times with exponential backoff, ensuring reliable delivery even if your endpoint is temporarily unavailable.</p>

<h3>API Documentation</h3>
<p>Full API documentation is available at <code>/api/docs</code> on your Sealayer instance. The documentation includes endpoint descriptions, request/response schemas, authentication examples, and error codes.</p>`
  },
  {
    title: 'SSO setup',
    slug: 'sso-setup',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 3,
    content: `<h2>SSO Setup</h2>
<p>Single Sign-On (SSO) allows your team to log in to Sealayer using your organisation's existing identity provider. This simplifies access management and improves security by centralising authentication.</p>

<h3>Supported Identity Providers</h3>
<p>Sealayer supports SSO with major identity providers including Google Workspace, Microsoft Entra ID (formerly Azure AD), Okta, and any provider that supports OpenID Connect (OIDC) or SAML 2.0.</p>

<h3>Setting Up SSO</h3>
<ol>
<li>Go to <strong>Settings &gt; Security &gt; SSO</strong>.</li>
<li>Select your identity provider from the list, or choose "Custom OIDC" for other providers.</li>
<li>Enter the required configuration: Client ID, Client Secret, and Issuer URL. These are obtained from your identity provider's admin console.</li>
<li>Configure the redirect URI in your identity provider. Sealayer provides the exact URI to use.</li>
<li>Click <strong>Test Connection</strong> to verify the configuration works.</li>
<li>Enable SSO.</li>
</ol>

<h3>User Experience</h3>
<p>Once SSO is enabled, team members see a "Sign in with [Provider]" button on the login page. Clicking it redirects to your identity provider for authentication, then back to Sealayer. Users do not need a separate Sealayer password — their identity provider handles authentication.</p>

<h3>Security Benefits</h3>
<p>SSO provides several security advantages: centralised user management (deactivate access in one place), enforcement of your organisation's password policies and multi-factor authentication, reduced risk of password reuse, and simplified onboarding and offboarding. When a team member leaves your organisation, deactivating their identity provider account automatically revokes their Sealayer access.</p>

<h3>Fallback Access</h3>
<p>Admin users retain the ability to log in with email/password as a fallback in case the identity provider is unavailable. This ensures you are never locked out of your Sealayer account due to an identity provider outage.</p>`
  },
  {
    title: 'Dark mode and display preferences',
    slug: 'dark-mode',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 4,
    content: `<h2>Dark Mode and Display Preferences</h2>
<p>Sealayer supports both light and dark display modes, along with other display preferences that let you customise the interface to your comfort and working environment.</p>

<h3>Display Mode Options</h3>
<ul>
<li><strong>Light mode</strong> — the default theme with a warm cream background, optimised for well-lit environments and daytime use.</li>
<li><strong>Dark mode</strong> — a dark background with adjusted colours for comfortable viewing in low-light conditions. Reduces eye strain during extended use and saves battery on OLED screens.</li>
<li><strong>System</strong> — automatically follows your operating system's appearance preference. If your OS is set to dark mode, Sealayer switches to dark mode automatically.</li>
</ul>

<h3>How to Switch</h3>
<p>Toggle between modes using the theme icon in the sidebar, or go to <strong>Settings &gt; Display</strong> for the full range of options. Your preference is saved to your account and applies across all devices you use to access Sealayer.</p>

<h3>Additional Display Preferences</h3>
<ul>
<li><strong>Font size</strong> — adjust the base font size for better readability.</li>
<li><strong>Language</strong> — Sealayer supports multiple interface languages. Select your preferred language from the dropdown.</li>
<li><strong>Date format</strong> — choose between DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD formats.</li>
<li><strong>Number format</strong> — choose between decimal separators (1,000.00 vs 1.000,00) based on your regional convention.</li>
</ul>

<h3>Accessibility</h3>
<p>Sealayer is designed with accessibility in mind. The colour schemes in both light and dark mode maintain sufficient contrast ratios for readability. Keyboard navigation is supported throughout the interface, and the Cmd+K shortcut provides quick access to any feature without using a mouse.</p>`
  },
  {
    title: 'Currency settings',
    slug: 'currency-settings',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 5,
    content: `<h2>Currency Settings</h2>
<p>Currency settings control how your organisation handles currencies across the platform. Proper configuration ensures that expenses are recorded in the right currency, reports show correct conversions, and donors see amounts in their expected format.</p>

<h3>Organisation-Level Settings</h3>
<p>Navigate to <strong>Settings &gt; Currency</strong> to configure:</p>
<ul>
<li><strong>Base currency</strong> — your organisation's default operating currency (e.g., KES, UGX, NGN). This is the default currency for new projects and expenses.</li>
<li><strong>Display format</strong> — how amounts are formatted. Choose between formats like 1,000.00 (common in English-speaking countries) or 1.000,00 (common in continental Europe).</li>
<li><strong>Decimal places</strong> — the number of decimal places shown in amounts (typically 2, but some currencies use 0 or 3).</li>
<li><strong>Currency symbol position</strong> — whether the symbol appears before (USD 100) or after (100 EUR) the amount.</li>
</ul>

<h3>Project-Level Currency</h3>
<p>Each project can have its own currency that overrides the organisation base currency. This is useful for projects funded in a specific currency or operating in a different country. Set the project currency when creating the project — it can be changed later, but changes affect how new expenses are recorded.</p>

<h3>Supported Currencies</h3>
<p>Sealayer supports all ISO 4217 currencies, including major currencies (USD, EUR, GBP, CHF) and currencies commonly used in development contexts (KES, UGX, NGN, TZS, ETB, ZAR, GHS, XOF, XAF). If you need a currency that is not listed, contact support.</p>

<h3>Exchange Rate Configuration</h3>
<p>Currency settings also include exchange rate management. See the dedicated articles on monthly exchange rates and the exchange rate table for detailed guidance on setting up and managing multi-currency conversion.</p>`
  },
  {
    title: 'Cmd+K shortcuts guide',
    slug: 'cmd-k-shortcuts',
    category: 'settings-admin',
    targetRole: 'ngo',
    order: 6,
    content: `<h2>Cmd+K Shortcuts Guide</h2>
<p>The Cmd+K (or Ctrl+K on Windows/Linux) command palette is a powerful navigation tool that gives you instant access to any page, action, or search result in Sealayer. Power users rely on it to move through the platform quickly without reaching for the mouse.</p>

<h3>How to Use It</h3>
<p>Press <strong>Cmd+K</strong> (Mac) or <strong>Ctrl+K</strong> (Windows/Linux) from any page in Sealayer. The command palette appears as a search bar overlay. Start typing immediately — no need to click the input field.</p>

<h3>What You Can Do</h3>
<ul>
<li><strong>Navigate</strong> — type a page name to jump directly to it. Examples: "projects", "expenses", "documents", "settings", "reports", "messenger", "audit log".</li>
<li><strong>Search</strong> — search across projects, expenses, documents, and team members. Type a project name, expense description, or document title to find it instantly.</li>
<li><strong>Quick actions</strong> — type "new expense" to start recording an expense, "new project" to create a project, or "upload document" to open the upload dialog.</li>
<li><strong>Switch context</strong> — quickly jump between projects without navigating through the sidebar.</li>
</ul>

<h3>Keyboard Navigation</h3>
<ul>
<li><strong>Arrow keys</strong> — move up and down through results.</li>
<li><strong>Enter</strong> — select the highlighted result and navigate to it.</li>
<li><strong>Escape</strong> — close the command palette without taking action.</li>
<li><strong>Tab</strong> — in some contexts, Tab auto-completes the current suggestion.</li>
</ul>

<h3>Tips for Efficiency</h3>
<p>The command palette supports fuzzy matching — you do not need to type the exact page name. Typing "exp" will match "Expenses", "proj" will match "Projects", and "set" will match "Settings". Results are ranked by relevance and frequency of use, so your most-used pages appear first. The command palette is available on every page in Sealayer, making it the fastest way to navigate the platform.</p>`
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
    content: `<h2>Welcome to the Sealayer Donor Portal</h2>
<p>The Sealayer donor portal gives you real-time visibility into how your funds are being used by NGO partners. Unlike traditional grant reporting where you receive periodic reports weeks or months after the fact, Sealayer provides continuous, blockchain-verified transparency into every transaction.</p>

<h3>What You Can Do</h3>
<ul>
<li><strong>View project financials</strong> — see real-time budget vs. actual spend, broken down by category, with full expense details and receipts.</li>
<li><strong>Verify transactions</strong> — every financial record is anchored to the Polygon blockchain. You can independently verify any transaction using the public verification page.</li>
<li><strong>Approve tranches</strong> — review conditions, examine supporting evidence, and approve or reject funding releases.</li>
<li><strong>Raise flags</strong> — if you see an expense that looks incorrect or needs clarification, raise a flag directly from the expense view.</li>
<li><strong>Generate reports</strong> — download financial and impact reports in your preferred currency with blockchain verification summaries.</li>
<li><strong>Message your NGO</strong> — communicate directly with your NGO partner through the built-in messenger.</li>
</ul>

<h3>Getting Started</h3>
<p>You should have received an invitation email from your NGO partner. Click the link to set up your account — you will need to create a password and confirm your email. Once logged in, your funded projects appear on your dashboard. Each project shows its current status, budget utilisation, and recent activity. Click any project to dive into the details.</p>

<h3>The Trust Model</h3>
<p>Sealayer's donor portal is built on the principle that you should not have to trust the NGO's word alone. Every piece of data you see — expenses, documents, exchange rates, funding flows — is backed by a blockchain-anchored Trust Seal. You can verify any record independently using the public blockchain, without relying on Sealayer or the NGO. This is verifiable trust, not blind trust.</p>`
  },
  {
    title: 'Understanding your donor dashboard',
    slug: 'donor-dashboard',
    category: 'donor-getting-started',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Understanding Your Donor Dashboard</h2>
<p>Your dashboard is the central hub of the Sealayer donor portal. It provides an at-a-glance overview of all projects you are funding, with key financial metrics, recent activity, and items requiring your attention.</p>

<h3>Dashboard Sections</h3>
<ul>
<li><strong>Funding overview</strong> — summary cards showing total committed across all projects, total disbursed, total remaining, and the number of active projects you fund.</li>
<li><strong>Project cards</strong> — each funded project displayed as a card showing its name, status, budget utilisation percentage, transparency score, and the number of pending items. Click any card to open the project detail view.</li>
<li><strong>Recent activity</strong> — a timeline of the latest transactions across all your funded projects: expenses recorded, documents uploaded, tranches released, and any flags or challenges.</li>
<li><strong>Pending actions</strong> — items that require your attention: tranche approval requests, open flags awaiting resolution, and documents shared for your review.</li>
</ul>

<h3>Currency Display</h3>
<p>All amounts on your dashboard are shown in your reporting currency (the currency of your funding agreement). If you fund multiple projects in different currencies, each project card shows amounts in the respective funding currency. The funding overview aggregates amounts across currencies where applicable.</p>

<h3>Navigating from the Dashboard</h3>
<p>Click on any project card to see full project details. Click on activity items to go directly to the relevant expense, document, or tranche. The Pending Actions section links directly to approval workflows, so you can take action without navigating through multiple pages. The dashboard refreshes automatically when you load the page.</p>`
  },
  {
    title: 'Reading project financials',
    slug: 'reading-financials',
    category: 'donor-getting-started',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Reading Project Financials</h2>
<p>Each project you fund shows detailed financial data in your reporting currency. This article explains how to read and interpret the financial information available on the donor portal.</p>

<h3>Key Metrics</h3>
<ul>
<li><strong>Total budget</strong> — the full project budget, converted to your reporting currency using sealed exchange rates.</li>
<li><strong>Your contribution</strong> — the total amount committed under your funding agreement.</li>
<li><strong>Disbursed</strong> — how much of your commitment has been released through tranches.</li>
<li><strong>Spent to date</strong> — total expenses recorded against the project (or against your specific funding source).</li>
<li><strong>Remaining</strong> — budget remaining, calculated as budget minus spent.</li>
<li><strong>Utilisation %</strong> — percentage of budget spent. Colour-coded: green (under 80%), amber (80-100%), red (over 100%).</li>
</ul>

<h3>Expense Breakdown</h3>
<p>The expense breakdown tab shows all expenses grouped by budget category (e.g., Personnel, Equipment, Travel), with the CapEx/OpEx classification visible. Each category shows budgeted, actual, and remaining amounts. Click any category to expand and see individual expenses. Click any expense to see its full details, attached receipt, and blockchain Trust Seal.</p>

<h3>Currency and Exchange Rates</h3>
<p>All amounts are shown in your reporting currency. The exchange rates used for conversion are sealed to the blockchain and visible in the Exchange Rate table. You can cross-check these rates against independent sources to verify they are accurate. Each report period uses a consistent monthly rate.</p>

<h3>Verifying Financials</h3>
<p>Every financial record you see is backed by a blockchain Trust Seal. Click the seal icon on any expense to see the transaction hash, block number, and timestamp. You can verify these independently on verify.sealayer.io or Polygonscan without relying on Sealayer or the NGO.</p>`
  },
  {
    title: 'What blockchain verification means for you',
    slug: 'blockchain-for-donors',
    category: 'donor-getting-started',
    targetRole: 'donor',
    order: 4,
    content: `<h2>What Blockchain Verification Means for You</h2>
<p>As a donor, blockchain verification means you do not have to take the NGO's word for it. Every financial record, document, and exchange rate is anchored to the Polygon blockchain, giving you independently verifiable proof that the data is authentic and unaltered.</p>

<h3>Why It Matters</h3>
<p>Traditional grant reporting relies on trust. You receive a PDF report from the NGO and hope the numbers are accurate. There is no independent mechanism to verify. Blockchain verification changes this fundamentally. Every transaction hash is a mathematical proof that specific data existed at a specific time and has not changed since. You can verify this yourself — you do not need to trust the NGO, and you do not even need to trust Sealayer.</p>

<h3>How to Verify</h3>
<ol>
<li>Click the <strong>seal icon</strong> on any expense, document, or audit entry in the donor portal.</li>
<li>You will see the Trust Seal: transaction hash, block number, timestamp, and Merkle proof.</li>
<li>Click the transaction hash to view it on Polygonscan (the Polygon block explorer).</li>
<li>Alternatively, go to <strong>verify.sealayer.io</strong> and paste the transaction hash for a detailed verification result.</li>
</ol>

<h3>What You Can Verify</h3>
<p>Everything on Sealayer is verifiable: individual expenses and their amounts, document uploads and their integrity, exchange rates used for currency conversion, funding agreement changes, tranche releases and approvals, and any modifications to existing records. If something was changed — an expense amount was edited, for example — the audit trail shows both the original and the modified version, each with its own blockchain seal.</p>

<h3>The Bottom Line</h3>
<p>Blockchain verification transforms your relationship with NGO partners from "trust and verify later" to "verify in real time, every time". This level of transparency reduces due diligence costs, accelerates funding decisions, and builds lasting confidence in your NGO partnerships.</p>`
  },

  // ── Donor: Verification & Trust ─────────────────────────
  {
    title: 'How to verify a transaction hash',
    slug: 'verify-transaction',
    category: 'verification-trust',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>How to Verify a Transaction Hash</h2>
<p>Verifying a transaction hash is the most direct way to confirm that a Sealayer record is authentic and has not been tampered with. This guide walks you through the verification process step by step.</p>

<h3>Finding the Transaction Hash</h3>
<p>Transaction hashes appear throughout the donor portal: on sealed expenses (in the Trust Seal section), on documents (in the document detail view), and in the audit trail. A transaction hash is a 66-character hexadecimal string starting with <code>0x</code>.</p>

<h3>Verification Steps</h3>
<ol>
<li>Copy the transaction hash from the item you want to verify.</li>
<li>Go to <strong>verify.sealayer.io</strong> in any web browser.</li>
<li>Paste the transaction hash into the verification field.</li>
<li>Click <strong>Verify</strong>.</li>
<li>The system checks the Polygon blockchain and displays: the data hash, block number, timestamp, Merkle proof, and verification result (confirmed or failed).</li>
</ol>

<h3>Alternative: Verify on Polygonscan</h3>
<p>For complete independence from Sealayer, you can verify directly on Polygonscan (polygonscan.com), the Polygon block explorer. Search for the transaction hash and you will see the on-chain transaction details, confirming that the Merkle root was recorded at the stated time and block.</p>

<h3>What a Successful Verification Proves</h3>
<p>A successful verification confirms that the specific data existed at the time shown in the timestamp, the data has not been modified since it was anchored, and the record is part of a batch that was permanently stored on the Polygon blockchain. No account or login is required for verification — anyone with the transaction hash can verify independently. This independence is the foundation of Sealayer's trust model.</p>`
  },
  {
    title: 'Understanding the Trust Seal',
    slug: 'understanding-trust-seal',
    category: 'verification-trust',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Understanding the Trust Seal</h2>
<p>Every sealed item on Sealayer displays a Trust Seal badge — a visual indicator that the data has been cryptographically hashed and permanently anchored to the Polygon blockchain. As a donor, Trust Seals are your guarantee that the data you are viewing is authentic.</p>

<h3>What the Seal Proves</h3>
<ul>
<li><strong>Existence</strong> — the data existed at the time shown in the timestamp. It was not created retroactively.</li>
<li><strong>Integrity</strong> — the data has not been modified since it was sealed. Any change would produce a different hash, which would not match the on-chain record.</li>
<li><strong>Immutability</strong> — no one can alter the sealed data — not the NGO, not Sealayer, not anyone. The proof is on the public blockchain.</li>
</ul>

<h3>Seal Contents</h3>
<p>Click any Trust Seal to see its full details:</p>
<ul>
<li><strong>Data hash</strong> — the SHA-256 fingerprint of the original data.</li>
<li><strong>Transaction hash</strong> — the Polygon blockchain transaction (clickable link to Polygonscan).</li>
<li><strong>Block number</strong> — the specific Polygon block where the transaction was recorded.</li>
<li><strong>Timestamp</strong> — when the anchoring occurred.</li>
<li><strong>Merkle proof</strong> — the mathematical proof linking this specific record to the on-chain batch.</li>
</ul>

<h3>What Items Are Sealed</h3>
<p>All significant actions are sealed: expense creation and edits, document uploads, funding agreement changes, tranche releases and approvals, exchange rate entries, and impact metric recordings. Every sealed item provides the same level of cryptographic verification, giving you comprehensive coverage of the project's financial and operational data.</p>`
  },
  {
    title: 'What the transparency score means',
    slug: 'transparency-score',
    category: 'verification-trust',
    targetRole: 'donor',
    order: 3,
    content: `<h2>What the Transparency Score Means</h2>
<p>The transparency score is a 0-100 rating that reflects the NGO's overall transparency practices on Sealayer. It provides a quick, objective assessment of how well the NGO is maintaining financial records and documentation.</p>

<h3>Scoring Factors</h3>
<ul>
<li><strong>Data completeness</strong> — are all expenses properly categorised with receipts attached? Missing receipts or uncategorised expenses lower the score.</li>
<li><strong>Timeliness</strong> — are expenses recorded promptly after being incurred? Long delays between expense dates and recording dates reduce the score.</li>
<li><strong>Document coverage</strong> — are supporting documents (contracts, reports, certifications) uploaded and current? Missing or expired documents lower the score.</li>
<li><strong>Blockchain coverage</strong> — what percentage of audit log entries have been successfully anchored to the blockchain? Ideally 100%.</li>
<li><strong>Reporting frequency</strong> — are reports generated and shared regularly? Active reporting demonstrates engagement and transparency.</li>
</ul>

<h3>Interpreting the Score</h3>
<ul>
<li><strong>90-100</strong> — excellent transparency. The NGO maintains complete, timely records with full blockchain coverage.</li>
<li><strong>70-89</strong> — good transparency. Minor gaps in documentation or timeliness.</li>
<li><strong>50-69</strong> — adequate transparency. Some areas need improvement.</li>
<li><strong>Below 50</strong> — significant transparency gaps that should be discussed with the NGO.</li>
</ul>

<h3>Using the Score</h3>
<p>The transparency score is an objective indicator, but it should be one of several factors in your assessment. A lower score does not necessarily indicate problems — a new project that is just getting started may have a lower score simply because there is less data. Over time, the score trend is more informative than any single snapshot. Consistently improving scores indicate the NGO is strengthening its transparency practices.</p>`
  },
  {
    title: 'Reading the audit trail',
    slug: 'reading-audit-trail',
    category: 'verification-trust',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Reading the Audit Trail</h2>
<p>The audit trail is the complete, chronological record of every action taken on a project. Each entry is immutable and blockchain-anchored, providing you with a verifiable history that cannot be altered or deleted.</p>

<h3>What You See</h3>
<p>Each audit trail entry includes:</p>
<ul>
<li><strong>Timestamp</strong> — the exact date and time the action occurred.</li>
<li><strong>Action</strong> — what happened: expense created, expense edited, document uploaded, tranche requested, tranche approved, etc.</li>
<li><strong>User</strong> — who performed the action (the team member's name).</li>
<li><strong>Entity</strong> — the specific item affected (e.g., the expense name, document title, or tranche number).</li>
<li><strong>Data hash</strong> — the SHA-256 hash of the data at the time of the action.</li>
<li><strong>Seal status</strong> — whether the entry has been anchored to the blockchain (Pending, Sealed, or Verified).</li>
</ul>

<h3>Using the Audit Trail</h3>
<p>The audit trail lets you trace the complete history of any item. If an expense was edited, you can see the original entry and the edit entry side by side, showing exactly what changed, when, and by whom. If a document was uploaded and later replaced, both versions appear in the trail. This level of detail is invaluable for due diligence and for understanding the complete story behind the financial data.</p>

<h3>Filtering and Searching</h3>
<p>For projects with many entries, you can filter the audit trail by action type (e.g., show only expense-related entries), date range, or user. You can also search for specific items. Click any entry to see its full details, including the blockchain seal with verification link.</p>

<h3>Immutability</h3>
<p>Audit trail entries cannot be deleted or modified — not by the NGO, not by Sealayer, not by anyone. GDPR erasure requests anonymise user names but preserve the audit entries themselves. This permanence is the foundation of Sealayer's accountability model.</p>`
  },

  // ── Donor: Funding & Tranches ───────────────────────────
  {
    title: 'Reviewing a funding agreement',
    slug: 'reviewing-agreement',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Reviewing a Funding Agreement</h2>
<p>Your funding agreement on Sealayer shows the complete terms of your funding commitment — total amount, currency, disbursement schedule, and conditions. It is your reference point for tracking how your funds are being managed.</p>

<h3>Where to Find It</h3>
<p>Open the project from your dashboard and go to the <strong>Funding</strong> tab. Your agreement is displayed with its current status, total amount, disbursed amount, and remaining balance. If the NGO attached the signed agreement document, you can view and download it from this page.</p>

<h3>Agreement Details</h3>
<ul>
<li><strong>Total committed</strong> — the full amount of your funding commitment in your currency.</li>
<li><strong>Funding type</strong> — whether this is a grant, impact loan, or impact investment.</li>
<li><strong>Disbursement method</strong> — lump sum or tranches with conditions.</li>
<li><strong>Agreement date</strong> — when the agreement was created on Sealayer.</li>
<li><strong>Tranche schedule</strong> — if applicable, the timeline and amounts for each tranche with associated conditions.</li>
</ul>

<h3>Tranche Overview</h3>
<p>If your funding is disbursed in tranches, you will see a visual timeline showing each tranche with its amount, expected date, conditions, and current status (Pending, Conditions Met, Requested, Approved, Disbursed, or Rejected). Click any tranche to see its detailed conditions and evidence provided by the NGO.</p>

<h3>Agreement Changes</h3>
<p>If the agreement terms are modified (e.g., the total amount changes or a tranche schedule is adjusted), the change is recorded in the audit trail with a blockchain seal. You can see exactly what changed, when, and who made the modification.</p>`
  },
  {
    title: 'Approving a tranche release',
    slug: 'approving-tranche',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Approving a Tranche Release</h2>
<p>When the NGO has fulfilled the conditions for a tranche and submits a release request, you will receive a notification prompting you to review and decide. This article explains the approval process.</p>

<h3>Approval Steps</h3>
<ol>
<li>Open the notification (it appears in your notification centre and as an email) or navigate to the project's Funding tab.</li>
<li>Review the tranche details: the amount, the conditions, and the evidence the NGO has provided for each condition.</li>
<li>Examine the project's current financial position: expenses to date, budget utilisation, and any open flags or concerns.</li>
<li>Click <strong>Approve</strong> to approve the release, or <strong>Reject</strong> if conditions are not adequately met. If rejecting, provide a reason so the NGO knows what needs to be addressed.</li>
</ol>

<h3>What to Check Before Approving</h3>
<ul>
<li>Have all required conditions been genuinely fulfilled? Review the evidence attached to each condition.</li>
<li>Is the expense reporting up to date? Check that the previous tranche's spending has been properly documented.</li>
<li>Are there any open flags or unresolved challenges on the project?</li>
<li>Does the project's transparency score indicate good financial management practices?</li>
</ul>

<h3>After Approval</h3>
<p>Your approval is recorded in the blockchain-anchored audit trail with a Trust Seal, creating permanent proof of your decision. The NGO receives a notification that the tranche has been approved. Once the funds are actually transferred and received, the NGO marks the tranche as "Disbursed", completing the cycle. Every step is verifiable on the blockchain.</p>`
  },
  {
    title: 'Understanding tranche conditions',
    slug: 'understanding-conditions',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Understanding Tranche Conditions</h2>
<p>Tranche conditions are the requirements that must be fulfilled before a tranche can be released. They are defined when the funding agreement is created and provide you with assurance that key milestones are achieved before additional funds are disbursed.</p>

<h3>Common Condition Types</h3>
<ul>
<li><strong>Document submission</strong> — the NGO must upload a specific document (e.g., quarterly financial report, audit report, progress update).</li>
<li><strong>Expenditure threshold</strong> — a minimum percentage of the previous tranche must be spent before the next is released (e.g., "At least 70% of Tranche 1 utilised").</li>
<li><strong>Activity completion</strong> — a project activity or milestone must be completed (e.g., "Baseline survey completed", "Training programme delivered").</li>
<li><strong>Impact milestone</strong> — a measurable impact target must be reached (e.g., "500 beneficiaries served").</li>
<li><strong>Custom conditions</strong> — any other requirement specific to your agreement (e.g., "Government approval received").</li>
</ul>

<h3>Reviewing Condition Evidence</h3>
<p>When the NGO marks a condition as fulfilled, they attach evidence — a document, a note, or a link to relevant data in Sealayer. You can review this evidence from the tranche detail view. Each fulfilment is recorded in the audit trail with a blockchain seal, so you can verify exactly when the condition was marked as met and what evidence was provided.</p>

<h3>Required vs Optional Conditions</h3>
<p>Conditions are marked as either <strong>required</strong> (must be met before the tranche can be released) or <strong>optional</strong> (informational, not blocking). Required conditions must all show as fulfilled before the NGO can request the tranche release. Optional conditions provide additional context but do not block disbursement.</p>`
  },
  {
    title: 'Your funding breakdown explained',
    slug: 'funding-breakdown',
    category: 'donor-funding-tranches',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Your Funding Breakdown Explained</h2>
<p>The funding breakdown gives you a clear picture of how your contribution flows through the project — from commitment to disbursement to spending. All amounts are shown in your reporting currency.</p>

<h3>Key Sections</h3>
<ul>
<li><strong>Total committed</strong> — the full amount of your funding agreement. This is your total financial commitment to the project.</li>
<li><strong>Disbursed</strong> — the amount you have released through approved tranches. This is money that has left your control and is available to the NGO.</li>
<li><strong>Spent</strong> — the amount the NGO has spent against your funding. Each expense charged to your funding source is tracked here, with full details available by clicking through.</li>
<li><strong>Remaining (disbursed but unspent)</strong> — funds you have released that the NGO has not yet spent. This represents cash in hand available for upcoming activities.</li>
<li><strong>Undisbursed</strong> — the portion of your commitment that has not yet been released. These are future tranches awaiting conditions and approval.</li>
</ul>

<h3>Expense Allocation</h3>
<p>The breakdown shows which expenses have been charged against your funding source, organised by budget category. This lets you see exactly where your money has gone — how much went to personnel, equipment, travel, etc. Click any category to see individual expenses with receipts and blockchain seals.</p>

<h3>Currency and Exchange Rates</h3>
<p>All amounts are converted to your reporting currency using blockchain-sealed monthly exchange rates. The exchange rate table is available from the funding breakdown page, showing the exact rates used for each period. You can cross-check these rates against independent sources to verify their accuracy.</p>

<h3>Multi-Donor Context</h3>
<p>If the project has multiple donors, the funding breakdown shows your contribution in the context of the overall project. You see the total project budget and spending, but the detailed allocation view focuses specifically on your funding source.</p>`
  },

  // ── Donor: Flags & Challenges ───────────────────────────
  {
    title: 'Raising a flag on an expense',
    slug: 'raising-flag',
    category: 'flags-challenges',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Raising a Flag on an Expense</h2>
<p>If you see an expense that looks incorrect, unusual, or needs clarification, you can raise a flag directly from the donor portal. Flagging is Sealayer's formal mechanism for donors to challenge or question specific expenses.</p>

<h3>How to Raise a Flag</h3>
<ol>
<li>Navigate to the expense you want to question — either from the project's expense list or from a report.</li>
<li>Open the expense detail view.</li>
<li>Click the <strong>Raise Flag</strong> button.</li>
<li>Select the reason for the flag: Amount Discrepancy, Missing Receipt, Incorrect Category, Duplicate Entry, Insufficient Documentation, or Other.</li>
<li>Add a detailed description of your concern — be specific about what seems wrong and what you expect to see instead.</li>
<li>Click <strong>Submit</strong>.</li>
</ol>

<h3>What Happens Next</h3>
<p>The NGO receives an immediate notification about the flag. The flagged expense is marked with a visible flag icon in both your portal and the NGO's dashboard. The NGO must review the flagged expense and respond — either correcting the issue, providing an explanation, or requesting further discussion. Every action taken on the flag is recorded in the immutable audit trail.</p>

<h3>When to Flag</h3>
<p>Raise a flag when you notice something that needs attention: an amount that does not match the attached receipt, a missing or illegible receipt, an expense categorised under the wrong budget line, a suspicious or unusual transaction, or any expense that needs further explanation. Flagging is not adversarial — it is a transparency mechanism that helps both parties maintain accurate records.</p>`
  },
  {
    title: 'What happens after you raise a flag',
    slug: 'after-flag',
    category: 'flags-challenges',
    targetRole: 'donor',
    order: 2,
    content: `<h2>What Happens After You Raise a Flag</h2>
<p>When you raise a flag, a structured process begins. The NGO is notified immediately and must respond. This article explains the lifecycle of a flag from creation to resolution.</p>

<h3>NGO Notification</h3>
<p>The NGO's team receives an in-app notification and email alerting them to the flag. The flagged expense appears in their dashboard's "Pending Actions" section with a prominent flag indicator. The flag includes your reason and description, so the NGO knows exactly what concern needs to be addressed.</p>

<h3>Possible Outcomes</h3>
<ul>
<li><strong>Corrected</strong> — the NGO acknowledges the error and corrects the expense (e.g., fixes the amount, uploads the correct receipt, changes the category). The correction is logged in the audit trail alongside the original record. Both versions are blockchain-sealed.</li>
<li><strong>Explained</strong> — the NGO provides an explanation that addresses your concern (e.g., "The amount includes tax which was not on the receipt", or "The receipt was uploaded to a different document entry"). You can review the explanation and accept it.</li>
<li><strong>Disputed</strong> — if the NGO disagrees with the flag, they can provide their reasoning. The discussion continues in the flag thread until both parties reach agreement.</li>
<li><strong>Escalated</strong> — if the flag cannot be resolved through normal discussion, it can be escalated for additional review.</li>
</ul>

<h3>Audit Trail</h3>
<p>Every action on a flag — creation, response, correction, resolution — is permanently recorded in the blockchain-anchored audit trail. This creates a complete, verifiable record of the challenge and how it was handled, demonstrating the accountability and responsiveness of both parties.</p>`
  },
  {
    title: 'Resolving a challenge',
    slug: 'resolving-challenge',
    category: 'flags-challenges',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Resolving a Challenge</h2>
<p>When an NGO responds to a flag you have raised, the challenge enters the resolution phase. This is a structured process designed to ensure both parties reach a transparent, documented outcome. Every step in the resolution is recorded in the blockchain-anchored audit trail, so there is a permanent record of how the concern was addressed.</p>

<h3>Reviewing the NGO's Response</h3>
<p>Open the flagged expense from your <strong>Flags</strong> dashboard. You will see the NGO's response, which may include a text explanation, updated documentation, corrected figures, or newly uploaded receipts. Take time to review the response thoroughly. If the NGO attached supporting documents, click each one to view it — documents are stored in S3 with SHA-256 integrity hashes, so you can be confident they have not been altered since upload.</p>

<h3>Accepting a Resolution</h3>
<p>If the NGO's response satisfactorily addresses your concern, click <strong>Accept Resolution</strong>. You can optionally add a closing comment explaining why you are satisfied. Once accepted, the flag status changes to "Resolved" and both the flag and the resolution are sealed to the blockchain. The expense returns to normal status in your dashboard, though the full flag history remains accessible for audit purposes.</p>

<h3>Continuing the Discussion</h3>
<p>If the response does not fully address your concern, you can add a follow-up comment. Be specific about what additional information or correction you need. The NGO will be notified of your follow-up and can respond again. This back-and-forth continues until both parties reach agreement. There is no limit to the number of exchanges, and every message in the thread is permanently recorded.</p>

<h3>Escalation</h3>
<p>If the discussion reaches an impasse, you can escalate the flag. Escalation brings the issue to the attention of platform administrators and may involve additional review. Escalated flags are marked prominently in both the donor and NGO dashboards. The complete discussion history, including all documents and responses, is preserved as part of the escalation record.</p>

<h3>Resolution Outcomes</h3>
<ul>
<li><strong>Resolved — Corrected</strong>: The NGO made a correction to the expense. Both the original and corrected versions are preserved in the audit trail.</li>
<li><strong>Resolved — Explained</strong>: The NGO provided an explanation that you accepted. The explanation is part of the permanent record.</li>
<li><strong>Resolved — Escalated</strong>: The flag was escalated and resolved through additional review.</li>
<li><strong>Withdrawn</strong>: You withdrew the flag (e.g., if you raised it in error). The withdrawal is also recorded.</li>
</ul>`
  },

  // ── Donor: Impact Investment ────────────────────────────
  {
    title: 'Reviewing an investment proposal',
    slug: 'reviewing-proposal',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Reviewing an Investment Proposal</h2>
<p>Impact investments on Tulip allow donors to provide capital to NGOs with an expectation of financial return alongside social impact. When an NGO creates an investment opportunity and shares it with you, it appears in your <strong>Impact Investments</strong> dashboard for review. This article walks you through evaluating a proposal before making a commitment.</p>

<h3>Where to Find Proposals</h3>
<p>Navigate to <strong>Impact Investments</strong> in the sidebar. The proposals list shows all investment opportunities shared with you, organized by status: New, Under Review, Approved, and Closed. Each proposal card shows the NGO name, project title, requested amount, target return rate, and term length. Click any proposal to open the full detail view.</p>

<h3>Proposal Details</h3>
<p>The proposal detail page contains several sections:</p>
<ul>
<li><strong>Executive Summary</strong> — A description of the investment opportunity, the social impact goals, and how the capital will be deployed.</li>
<li><strong>Financial Terms</strong> — The investment amount, currency, expected return rate (annualized), repayment schedule (monthly, quarterly, or at maturity), and term length.</li>
<li><strong>Use of Funds</strong> — A breakdown of how the invested capital will be spent, with line items for each planned expenditure.</li>
<li><strong>Risk Assessment</strong> — The NGO's own assessment of risks and mitigating factors, including operational risks, currency risks, and market risks.</li>
<li><strong>Supporting Documents</strong> — Business plans, financial projections, audit reports, and other documents uploaded by the NGO. Each document is SHA-256 hashed and stored in S3.</li>
<li><strong>NGO Track Record</strong> — Historical data on the NGO's previous projects, completion rates, and any past investment repayment history on the platform.</li>
</ul>

<h3>Due Diligence Checklist</h3>
<p>Before approving, consider reviewing: the NGO's Trust Seal score, their expense transparency history, whether their audit logs show consistent blockchain anchoring, the reasonableness of the projected returns, and whether the repayment schedule aligns with the project's expected cash flows. You can also use the platform's messaging feature to ask the NGO questions directly about the proposal.</p>

<h3>Next Steps</h3>
<p>Once you have reviewed the proposal, you can approve it, request modifications, or decline. All actions are recorded in the audit trail. See the "Approving an Investment" article for the approval workflow.</p>`
  },
  {
    title: 'Approving an investment',
    slug: 'approving-investment',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Approving an Investment</h2>
<p>After completing your review of an investment proposal, you can formally approve it. Approval is a significant action — it creates a binding commitment that is sealed to the Polygon blockchain, providing an immutable record of the terms both parties agreed to. This article explains the approval workflow and what happens afterward.</p>

<h3>Pre-Approval Checklist</h3>
<p>Before clicking approve, verify the following:</p>
<ul>
<li>The investment amount and currency match your intended commitment</li>
<li>The return rate and repayment schedule are acceptable</li>
<li>You have reviewed all supporting documents</li>
<li>You understand the risks outlined in the proposal</li>
<li>The term length fits your investment horizon</li>
</ul>

<h3>Approval Process</h3>
<ol>
<li>Open the investment proposal from <strong>Impact Investments</strong></li>
<li>Click <strong>Approve Investment</strong> at the bottom of the proposal</li>
<li>A confirmation dialog appears showing the key terms: amount, return rate, currency, repayment schedule, and term</li>
<li>Review the terms one final time and click <strong>Confirm Approval</strong></li>
<li>The system creates a blockchain-anchored audit log entry recording the approval, including a SHA-256 hash of the full proposal terms</li>
</ol>

<h3>What Happens After Approval</h3>
<p>Once approved, several things happen automatically:</p>
<ul>
<li>The NGO is notified that the investment has been approved</li>
<li>A funding agreement is generated with the agreed terms, and both parties can reference it at any time</li>
<li>The investment appears in your portfolio dashboard under "Active Investments"</li>
<li>The NGO can begin making drawdown requests (tranches) against the approved amount</li>
<li>A repayment schedule is generated based on the agreed terms, showing expected payment dates and amounts</li>
</ul>

<h3>Tranche Drawdowns</h3>
<p>Most investments are not disbursed all at once. The NGO requests capital in tranches as needed for project milestones. Each tranche request comes to you for approval. You can review the tranche amount, the milestone it corresponds to, and any supporting documentation before approving the disbursement. This gives you ongoing control over capital deployment.</p>

<h3>Modifying or Withdrawing</h3>
<p>Once approved, an investment cannot be unilaterally withdrawn. If circumstances change, use the messenger to discuss modifications with the NGO. Any agreed changes are documented as amendments to the original agreement, with both the original and amended terms preserved in the audit trail.</p>`
  },
  {
    title: 'Tracking repayments',
    slug: 'tracking-repayments',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Tracking Repayments</h2>
<p>Once an impact investment is active and capital has been disbursed, the repayment phase begins. Tulip provides a comprehensive repayment tracking system that gives you real-time visibility into payment status, upcoming obligations, and historical performance. Every repayment event is blockchain-anchored for verifiable, tamper-proof record-keeping.</p>

<h3>Repayment Dashboard</h3>
<p>Navigate to <strong>Impact Investments → [Investment Name] → Repayments</strong> to see the full repayment schedule. The dashboard displays:</p>
<ul>
<li><strong>Schedule Overview</strong> — A timeline showing all expected repayment dates, amounts, and current status (Pending, Paid, Overdue)</li>
<li><strong>Total Disbursed</strong> — The cumulative amount released to the NGO across all tranches</li>
<li><strong>Total Repaid</strong> — The sum of all repayments received to date</li>
<li><strong>Outstanding Balance</strong> — The remaining amount owed, including any accrued returns</li>
<li><strong>Next Payment Due</strong> — The date and amount of the upcoming scheduled repayment</li>
<li><strong>Payment History</strong> — A chronological list of all completed repayments with dates, amounts, and blockchain seal references</li>
</ul>

<h3>Repayment Notifications</h3>
<p>You receive notifications for key repayment events: when a scheduled payment is approaching (7 days before), when a payment is received, and if a payment becomes overdue. Notification preferences can be customized under <strong>Settings → Notifications</strong>. For overdue payments, the system sends escalating reminders to the NGO and alerts you so you can follow up directly.</p>

<h3>Blockchain Verification</h3>
<p>Each repayment is recorded as an audit log entry, SHA-256 hashed, batched into a Merkle tree with other audit events, and anchored to the Polygon blockchain. You can click any repayment entry to view the Merkle proof and verify it against the on-chain transaction. This means neither you nor the NGO can dispute whether a payment was made — the blockchain provides an independent, immutable record.</p>

<h3>Currency Considerations</h3>
<p>If the investment operates in a different currency than your reporting currency, repayments are shown in both the original currency and your preferred currency. The exchange rate used is the blockchain-sealed monthly rate, ensuring consistent and verifiable conversion across all reporting periods.</p>`
  },
  {
    title: 'Your investment portfolio',
    slug: 'investment-portfolio',
    category: 'donor-impact-investment',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Your Investment Portfolio</h2>
<p>The portfolio view is your central hub for managing all impact investments across every NGO you work with. It aggregates data from all active, completed, and pending investments into a single dashboard, giving you a comprehensive picture of your impact investment activity on the Tulip platform.</p>

<h3>Portfolio Overview</h3>
<p>The top section of the portfolio page shows aggregate metrics:</p>
<ul>
<li><strong>Total Committed</strong> — The sum of all approved investment amounts across all NGOs</li>
<li><strong>Total Disbursed</strong> — Capital that has been released to NGOs through approved tranches</li>
<li><strong>Total Repaid</strong> — Cumulative repayments received to date</li>
<li><strong>Total Outstanding</strong> — The remaining balance owed across all active investments</li>
<li><strong>Weighted Average Return</strong> — The average return rate weighted by investment size</li>
<li><strong>Active Investments</strong> — The count of investments currently in repayment phase</li>
</ul>

<h3>Investment Breakdown</h3>
<p>Below the summary, each investment is listed as a card showing the NGO name, project title, investment amount, disbursement progress, repayment progress, and current status. Click any card to drill into that specific investment's details, including its full repayment schedule, tranche history, and associated documents.</p>

<h3>Filtering and Sorting</h3>
<p>Use the filter controls to view investments by status (Active, Completed, Pending Approval), by NGO, by currency, or by date range. You can sort by amount, return rate, next payment date, or completion percentage. These controls help you quickly find specific investments or focus on those needing attention, such as those with upcoming payments or overdue balances.</p>

<h3>Portfolio Analytics</h3>
<p>The analytics tab provides charts and visualizations: investment allocation by NGO (pie chart), repayment timeline (bar chart showing scheduled vs. actual payments over time), currency exposure breakdown, and a performance comparison across investments. These visualizations help you make informed decisions about future investment allocations.</p>

<h3>Export Options</h3>
<p>You can export your portfolio data as a PDF summary report, a CSV file for spreadsheet analysis, or an Excel workbook with multiple tabs covering summary, individual investments, and repayment history. All exports include blockchain verification references so the data can be independently verified. The portfolio report is especially useful for your own reporting requirements or for sharing with stakeholders who need visibility into your impact investment activity.</p>`
  },

  // ── Donor: Reports & Data ───────────────────────────────
  {
    title: 'Generating a donor report',
    slug: 'generating-donor-report',
    category: 'donor-reports-data',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Generating a Donor Report</h2>
<p>Donor reports provide a comprehensive, verifiable summary of how your funds have been used. Each report combines financial data, impact metrics, and blockchain verification references into a single document that you can share with stakeholders, use for compliance, or keep for your records. Reports are generated on-demand and can cover any time period.</p>

<h3>Step-by-Step</h3>
<ol>
<li>Navigate to <strong>Reports</strong> in the sidebar</li>
<li>Select the project (or select "All Projects" for a cross-project report)</li>
<li>Choose the report type: <strong>Financial Summary</strong>, <strong>Expense Detail</strong>, <strong>Impact Report</strong>, or <strong>Full Audit Report</strong></li>
<li>Set the date range using the date picker — you can choose preset ranges (This Month, This Quarter, This Year) or set custom start and end dates</li>
<li>Select your preferred reporting currency — all amounts will be converted using blockchain-sealed exchange rates</li>
<li>Click <strong>Generate Report</strong></li>
</ol>

<h3>Report Types Explained</h3>
<ul>
<li><strong>Financial Summary</strong> — High-level overview: total funding, total expenses, budget utilization percentage, and funding source breakdown. Ideal for quick stakeholder updates.</li>
<li><strong>Expense Detail</strong> — Line-by-line listing of every expense, with descriptions, amounts, categories, dates, and links to supporting documents. Each expense shows its blockchain seal status.</li>
<li><strong>Impact Report</strong> — Focuses on project outcomes and impact metrics: beneficiaries reached, milestones completed, and progress against stated goals.</li>
<li><strong>Full Audit Report</strong> — The most comprehensive option. Includes all financial data, complete audit log history, blockchain anchoring references, Merkle proofs, and document integrity verification. This is the report you would provide to an external auditor.</li>
</ul>

<h3>Viewing and Downloading</h3>
<p>Once generated, the report opens in an in-browser viewer. You can download it as a <strong>PDF</strong> (formatted with charts and tables), <strong>CSV</strong> (raw data for your own analysis), or <strong>Excel</strong> (multi-tab workbook). PDF reports include QR codes linking to blockchain verification for key data points, making it easy for third parties to verify the report's accuracy independently.</p>

<h3>Scheduled Reports</h3>
<p>For recurring reporting needs, you can set up scheduled reports that are automatically generated and emailed to you on a weekly, monthly, or quarterly basis. Configure these under <strong>Reports → Scheduled</strong>.</p>`
  },
  {
    title: 'Understanding currency conversion',
    slug: 'understanding-currency',
    category: 'donor-reports-data',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Understanding Currency Conversion</h2>
<p>Many NGO projects operate in local currencies (KES, UGX, NGN, INR) while donors report in major currencies (USD, EUR, GBP, CHF). Tulip handles this through a transparent, verifiable currency conversion system. Exchange rates are sealed to the Polygon blockchain before they are used, ensuring that neither party can manipulate rates after the fact.</p>

<h3>How Conversion Works</h3>
<p>At the beginning of each month, Tulip captures exchange rates from trusted market data sources and seals them to the blockchain. When expenses are recorded in a local currency and you view them in your reporting currency, the system uses the sealed rate for the month the expense was incurred. This means:</p>
<ul>
<li>All conversions are consistent — the same expense always converts to the same amount in your currency for a given month</li>
<li>Rates are immutable — once sealed, a rate cannot be changed retroactively</li>
<li>Rates are verifiable — you can click any converted amount to see the rate used and its blockchain proof</li>
</ul>

<h3>Viewing Conversion Details</h3>
<p>In any report or expense view, converted amounts show a small currency indicator. Hover over it to see the original amount, the original currency, the conversion rate, and the month the rate applies to. Click the indicator to open the full rate verification page, which shows the Merkle proof and Polygon transaction hash for that rate.</p>

<h3>Setting Your Reporting Currency</h3>
<p>Your default reporting currency is set in <strong>Settings → Preferences</strong>. You can also override it per-report when generating reports. All dashboard figures, portfolio totals, and summary statistics use your default reporting currency unless you specify otherwise.</p>

<h3>Handling Multiple Currencies</h3>
<p>If you fund projects operating in different currencies, your portfolio dashboard aggregates everything into your reporting currency. The exchange rate table (see the next article) shows all rates used, so you can verify every conversion. For investments with repayments, both the original currency amount and the converted amount are shown side by side.</p>`
  },
  {
    title: 'Exchange rate table explained',
    slug: 'exchange-rate-table',
    category: 'donor-reports-data',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Exchange Rate Table Explained</h2>
<p>The exchange rate table is a reference tool that shows every monthly exchange rate used across your projects. It provides full transparency into how currency conversions are calculated and allows you to independently verify each rate against the blockchain. This article explains each column and how to use the table effectively.</p>

<h3>Accessing the Table</h3>
<p>Navigate to <strong>Reports → Exchange Rates</strong> to view the full table. You can filter by currency pair (e.g., KES/USD, UGX/EUR), by date range, or by project. The table is sorted by month in descending order, showing the most recent rates first.</p>

<h3>Table Columns</h3>
<ul>
<li><strong>Month</strong> — The calendar month the rate applies to. All expenses incurred during this month use this rate for conversion.</li>
<li><strong>Currency Pair</strong> — The source and target currencies (e.g., KES → USD). The rate converts one unit of the source currency to the target currency.</li>
<li><strong>Rate</strong> — The exchange rate value. For example, a KES → USD rate of 0.0065 means 1 KES = 0.0065 USD, or equivalently, 1 USD = approximately 153.85 KES.</li>
<li><strong>Sealed Date</strong> — The date and time the rate was captured and sealed to the blockchain. This is always before the first day of the month the rate applies to, proving the rate was fixed before any transactions occurred.</li>
<li><strong>Blockchain Seal</strong> — The Polygon transaction hash. Click it to view the on-chain transaction on a block explorer (e.g., Polygonscan), confirming the rate was permanently recorded at the stated time.</li>
<li><strong>Merkle Proof</strong> — A link to the Merkle proof showing how this specific rate was included in the batch of records anchored to the blockchain. The proof allows independent mathematical verification without trusting the platform.</li>
</ul>

<h3>Why Sealed Rates Matter</h3>
<p>In traditional financial reporting, exchange rates can be a source of disputes. An NGO might use one rate and a donor another, leading to discrepancies. By sealing rates to the blockchain before they are used, Tulip eliminates this ambiguity. Both parties use the same verifiable rate, and neither can claim a different rate was applied. This is especially important for large projects where even small rate differences can translate to significant amounts.</p>

<h3>Exporting Rate Data</h3>
<p>Click <strong>Export</strong> to download the exchange rate table as a CSV or Excel file. The export includes all columns, including blockchain references, so you can archive the data or share it with auditors.</p>`
  },
  {
    title: 'Downloading your data',
    slug: 'downloading-data',
    category: 'donor-reports-data',
    targetRole: 'donor',
    order: 4,
    content: `<h2>Downloading Your Data</h2>
<p>Tulip provides comprehensive data export capabilities so you always have full access to your information. Whether you need formatted reports for stakeholders, raw data for your own analysis, or complete data archives for compliance, the platform supports multiple export formats and scopes.</p>

<h3>Export Formats</h3>
<ul>
<li><strong>PDF Reports</strong> — Professionally formatted documents with charts, tables, and visual summaries. PDF reports include the Tulip header, date range, and blockchain verification QR codes. These are ideal for sharing with boards, stakeholders, or external auditors.</li>
<li><strong>CSV Export</strong> — Comma-separated values files containing raw, tabular data. CSV exports are perfect for importing into spreadsheet applications, databases, or business intelligence tools. Each row represents one record (expense, repayment, audit entry, etc.) with all relevant fields as columns.</li>
<li><strong>Excel Export</strong> — Multi-tab workbooks (.xlsx) with formatted headers, column widths, and data types. Tabs are organized by data type: Summary, Expenses, Funding Sources, Audit Log, and Exchange Rates. Excel exports include formulas for subtotals and are ready to use without additional formatting.</li>
<li><strong>JSON Export</strong> — For technical users or system integrations. JSON exports contain the complete data structure including nested relationships, blockchain references, and metadata.</li>
</ul>

<h3>What You Can Export</h3>
<p>You can export data at several levels:</p>
<ul>
<li><strong>Project-level</strong> — All data related to a specific project: expenses, documents, audit logs, funding details</li>
<li><strong>Portfolio-level</strong> — All your investments, repayments, and related financial data across all NGOs</li>
<li><strong>Full Account Export</strong> — Everything associated with your donor account, including messages, settings, and activity history. This is also available under <strong>Settings → Privacy → Export My Data</strong> as part of GDPR compliance</li>
</ul>

<h3>How to Download</h3>
<ol>
<li>Navigate to <strong>Reports</strong> in the sidebar</li>
<li>Select the scope (project, portfolio, or full account)</li>
<li>Choose your date range if applicable</li>
<li>Select the export format from the dropdown</li>
<li>Click <strong>Download</strong> — the file is generated and your browser downloads it automatically</li>
</ol>

<h3>Data Integrity</h3>
<p>Every export includes a SHA-256 checksum in the filename or as a companion file. This allows you to verify that the downloaded file has not been corrupted or tampered with. For PDF reports, blockchain verification QR codes are embedded directly in the document.</p>`
  },

  // ── Donor: Messenger & Communication ────────────────────
  {
    title: 'Messaging your NGO',
    slug: 'messaging-ngo',
    category: 'donor-messenger',
    targetRole: 'donor',
    isFeatured: true,
    order: 1,
    content: `<h2>Messaging Your NGO</h2>
<p>The built-in messenger provides a secure, contextual communication channel between you and your NGO partners. Unlike external email, messages sent through Tulip are linked to your funding relationship and can reference specific projects, expenses, or documents. This keeps all project-related communication in one place and ensures that important discussions are preserved alongside the financial records they relate to.</p>

<h3>Getting Started</h3>
<ol>
<li>Navigate to <strong>Messenger</strong> in the sidebar</li>
<li>Your NGO contacts are listed on the left panel, organized by organization name. A green dot indicates the contact is currently online.</li>
<li>Click an NGO contact to open the conversation thread</li>
<li>Type your message in the text area at the bottom and press Enter or click <strong>Send</strong></li>
</ol>

<h3>Contextual References</h3>
<p>One of the most powerful features of the Tulip messenger is the ability to reference platform entities directly in your messages. When composing a message, you can:</p>
<ul>
<li>Type <strong>@project:</strong> to link to a specific project</li>
<li>Type <strong>@expense:</strong> to reference a particular expense entry</li>
<li>Type <strong>@document:</strong> to link to an uploaded document</li>
<li>Type <strong>@flag:</strong> to reference an active or resolved flag</li>
</ul>
<p>These references appear as clickable links in the message, allowing the recipient to jump directly to the referenced item. This eliminates the need to describe where to find something — you can simply link to it.</p>

<h3>Message History</h3>
<p>All messages are permanently stored and searchable. Use the search bar at the top of the messenger to find past conversations by keyword, date, or referenced entity. Message history is preserved even if team members change on the NGO side, ensuring continuity of communication across personnel changes.</p>

<h3>Security</h3>
<p>Messages are transmitted over encrypted connections and stored securely on the platform. They are included in your data export if you request a full account export under GDPR provisions. Messages are not shared with third parties and are only visible to authorized users on both the donor and NGO sides.</p>`
  },
  {
    title: 'Sending files',
    slug: 'donor-sending-files',
    category: 'donor-messenger',
    targetRole: 'donor',
    order: 2,
    content: `<h2>Sending Files</h2>
<p>The Tulip messenger supports file sharing, allowing you to exchange documents with your NGO partners directly within the platform. Files sent through the messenger are stored securely in S3 with SHA-256 integrity hashing, ensuring they cannot be tampered with after sending. This is especially useful for sharing supplementary documentation, contracts, or reports that relate to your funding relationship.</p>

<h3>How to Send a File</h3>
<ol>
<li>Open a conversation with your NGO contact in <strong>Messenger</strong></li>
<li>Click the <strong>attachment icon</strong> (paperclip) in the message input area, or simply drag and drop a file into the message area</li>
<li>Select the file from your computer — a preview will appear showing the filename, size, and type</li>
<li>Optionally add a text message to accompany the file (e.g., "Please find the updated funding agreement attached")</li>
<li>Click <strong>Send</strong> to upload and deliver the file</li>
</ol>

<h3>Supported Formats and Limits</h3>
<ul>
<li><strong>Documents</strong> — PDF, DOC, DOCX, TXT, RTF</li>
<li><strong>Spreadsheets</strong> — XLS, XLSX, CSV</li>
<li><strong>Images</strong> — PNG, JPG, JPEG, GIF</li>
<li><strong>Maximum file size</strong> — 10 MB per file</li>
<li><strong>Multiple files</strong> — You can attach up to 5 files in a single message</li>
</ul>

<h3>File Security</h3>
<p>Every file sent through the messenger is uploaded to S3 with a SHA-256 integrity hash calculated at upload time. This hash is stored alongside the file reference, allowing either party to verify that the file has not been modified since it was sent. Files are accessible only to the participants in the conversation — they are not publicly accessible and require authentication to download.</p>

<h3>Downloading Received Files</h3>
<p>Files sent to you appear as clickable attachments in the conversation. Click the filename to download it, or click the preview icon to view it in the browser (for PDFs and images). All files you have sent or received are also accessible from <strong>Messenger → Files</strong>, which provides a searchable list of all shared files across all conversations.</p>

<h3>File Retention</h3>
<p>Files shared through the messenger are retained for the duration of your account. They are included in full account data exports and are subject to the same data retention policies as other platform data.</p>`
  },
  {
    title: 'Notification preferences',
    slug: 'notification-preferences',
    category: 'donor-messenger',
    targetRole: 'donor',
    order: 3,
    content: `<h2>Notification Preferences</h2>
<p>Tulip sends notifications to keep you informed about important events: new messages, flag updates, repayment activity, report availability, and more. You can customize which notifications you receive and how they are delivered, ensuring you stay informed without being overwhelmed.</p>

<h3>Accessing Notification Settings</h3>
<p>Navigate to <strong>Settings → Notifications</strong> to view and modify your preferences. The settings page is organized by notification category, with toggle controls for each delivery channel.</p>

<h3>Notification Channels</h3>
<ul>
<li><strong>In-App Notifications</strong> — Appear as a badge on the bell icon in the top navigation bar. Click the bell to see your notification feed. In-app notifications are always enabled for critical actions (such as flag responses and overdue repayments) and cannot be disabled for these events.</li>
<li><strong>Email Notifications</strong> — Sent to the email address associated with your account. You can choose which events trigger emails. Email notifications include a summary of the event and a direct link to the relevant page in the platform.</li>
<li><strong>Digest Emails</strong> — Instead of receiving individual emails for each event, you can opt for a daily or weekly digest that summarizes all activity. This is useful if you prefer to review updates in batch rather than as they occur.</li>
</ul>

<h3>Notification Categories</h3>
<p>You can independently control notifications for each of the following categories:</p>
<ul>
<li><strong>Messages</strong> — New messages from NGO partners. Options: instant notification, digest only, or in-app only.</li>
<li><strong>Flags & Challenges</strong> — Updates on flags you have raised: NGO responses, resolutions, escalations. These are considered high-priority and email is enabled by default.</li>
<li><strong>Investment Activity</strong> — New proposals shared with you, tranche requests awaiting approval, repayment received, and overdue payment alerts.</li>
<li><strong>Reports</strong> — Notifications when scheduled reports are ready for download.</li>
<li><strong>Project Updates</strong> — Changes to projects you are funding: new expenses recorded, documents uploaded, milestones achieved.</li>
<li><strong>Security</strong> — Account security events: new login from an unrecognized device, password changes, API key creation. Security notifications are always enabled and cannot be turned off.</li>
</ul>

<h3>Do Not Disturb</h3>
<p>Enable <strong>Do Not Disturb</strong> mode to temporarily suppress all non-critical notifications. Critical security notifications will still be delivered. You can set DND to expire after a specified duration (1 hour, 4 hours, until tomorrow) or toggle it off manually.</p>`
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
