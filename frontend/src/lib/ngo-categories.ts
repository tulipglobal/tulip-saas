// ─── Funding Source Types & Sub-Types ──────────────────────
export const FUNDING_SOURCE_TYPES: Record<string, string[]> = {
  'Own Funds': ['Internal Cash', 'Internal Allocation', 'Internal Grant'],
  'Government Grant': ['Restricted Grant', 'Program Grant'],
  'Foundation Grant': ['Restricted Grant', 'Unrestricted Grant'],
  'Corporate CSR': ['CSR Restricted Grant', 'CSR Program Grant'],
  'Individual Donations': ['General Donation', 'Campaign Donation'],
  'Impact Investment': ['Equity Impact Investment', 'Debt Impact Investment', 'Outcome Based Financing'],
  'Development Finance': ['Concessional Loan', 'Blended Finance', 'Program Loan'],
}

export const FUNDING_SOURCE_TYPE_KEYS = Object.keys(FUNDING_SOURCE_TYPES)

// ─── Expense Types ─────────────────────────────────────────
export type ExpenseType = 'CAPEX' | 'OPEX'

export const CAPEX_CATEGORIES: Record<string, string[]> = {
  'Land & Buildings': [
    'Land purchase', 'Land registration fees', 'Legal & title fees',
    'Building construction', 'Architectural design', 'Building permits',
    'Building renovation', 'Site preparation',
  ],
  'Vehicles': ['Vehicle purchase', 'Import duty', 'Vehicle registration'],
  'Equipment & Machinery': ['Machinery purchase', 'Medical equipment', 'Equipment installation'],
  'IT Infrastructure': ['Servers', 'Networking equipment', 'Computers'],
  'Furniture & Fixtures': ['Office furniture', 'School furniture', 'Hospital furniture'],
  'Energy Systems': ['Solar installation', 'Generators', 'Battery storage'],
  'Water & Sanitation Infrastructure': ['Borewell drilling', 'Water tanks', 'Sanitation facilities'],
}

export const OPEX_CATEGORIES: Record<string, string[]> = {
  'Personnel & HR': [
    'Executive salaries', 'Program staff salaries', 'Field staff salaries',
    'Allowances & benefits', 'Payroll taxes', 'Insurance benefits',
  ],
  'Program Implementation': ['Workshops', 'Training materials', 'Program supplies'],
  'Beneficiary Support': ['Stipends', 'Food assistance', 'Medical supplies'],
  'Office & Administration': ['Rent', 'Utilities', 'Internet', 'Security'],
  'Travel & Field Operations': ['Airfare', 'Accommodation', 'Per diem', 'Vehicle fuel'],
  'Technology': ['Software subscriptions', 'Cloud hosting', 'IT support'],
  'Monitoring & Evaluation': ['Monitoring visits', 'Surveys', 'External evaluation', 'Impact assessment'],
  'Compliance': ['Audit', 'Legal services', 'Compliance reporting'],
  'Communications & Fundraising': ['Campaigns', 'Donor outreach', 'Fundraising events'],
  'Procurement & Logistics': ['Warehousing', 'Distribution'],
  'Training & Capacity Building': ['Staff training', 'Leadership development'],
  'Research': ['Baseline surveys', 'Research studies'],
}

export function getCategoriesForType(type: ExpenseType): Record<string, string[]> {
  return type === 'CAPEX' ? CAPEX_CATEGORIES : OPEX_CATEGORIES
}

export const CAPEX_CATEGORY_KEYS = Object.keys(CAPEX_CATEGORIES)
export const OPEX_CATEGORY_KEYS = Object.keys(OPEX_CATEGORIES)

// ─── ISO 3166 Countries ────────────────────────────────────
export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
  'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
  'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic',
  'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo (DRC)',
  'Congo (Republic)', 'Costa Rica', "Cote d'Ivoire", 'Croatia', 'Cuba', 'Cyprus',
  'Czech Republic',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia',
  'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
  'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein',
  'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
  'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay',
  'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar',
  'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
  'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen',
  'Zambia', 'Zimbabwe',
]
