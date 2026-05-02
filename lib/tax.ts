export type TaxFramework = 'AU_GST' | 'UK_VAT' | 'US_SALES_TAX' | 'NZ_GST' | 'CA_GST' | 'SG_GST' | 'EU_VAT' | 'NONE'

export interface TaxConfig {
  framework: TaxFramework
  country: string
  label: string          // e.g. "GST", "VAT"
  rate: number           // e.g. 0.1 for 10%
  rateDisplay: string    // e.g. "10%"
  reportLabel: string    // e.g. "BAS", "VAT Return"
  periodMonths: number   // reporting period in months (1=monthly, 3=quarterly, 12=annual)
  thresholdAmount: number // registration threshold in local currency
  thresholdCurrency: string
  notes: string
  collectLabel: string   // "GST Collected" or "VAT on Sales"
  paidLabel: string      // "GST Paid" or "VAT on Purchases"
  netLabel: string       // "Net GST" or "Net VAT"
}

export const TAX_FRAMEWORKS: Record<TaxFramework, TaxConfig> = {
  AU_GST: {
    framework: 'AU_GST',
    country: 'AU',
    label: 'GST',
    rate: 0.1,
    rateDisplay: '10%',
    reportLabel: 'BAS',
    periodMonths: 3,
    thresholdAmount: 75000,
    thresholdCurrency: 'AUD',
    notes: 'Australian GST: 10% on most goods and services. Register if turnover ≥ AUD 75,000.',
    collectLabel: 'GST Collected',
    paidLabel: 'GST Paid',
    netLabel: 'Net GST Payable',
  },
  UK_VAT: {
    framework: 'UK_VAT',
    country: 'GB',
    label: 'VAT',
    rate: 0.2,
    rateDisplay: '20%',
    reportLabel: 'VAT Return',
    periodMonths: 3,
    thresholdAmount: 90000,
    thresholdCurrency: 'GBP',
    notes: 'UK VAT: Standard 20%. Register if turnover ≥ GBP 90,000.',
    collectLabel: 'VAT on Sales',
    paidLabel: 'VAT on Purchases',
    netLabel: 'Net VAT Due',
  },
  US_SALES_TAX: {
    framework: 'US_SALES_TAX',
    country: 'US',
    label: 'Sales Tax',
    rate: 0.0875,
    rateDisplay: 'varies by state',
    reportLabel: 'Sales Tax Return',
    periodMonths: 1,
    thresholdAmount: 100000,
    thresholdCurrency: 'USD',
    notes: 'US Sales Tax varies by state (avg ~8.75%). Economic nexus typically at USD 100,000 / 200 transactions.',
    collectLabel: 'Sales Tax Collected',
    paidLabel: 'Sales Tax Paid',
    netLabel: 'Net Sales Tax',
  },
  NZ_GST: {
    framework: 'NZ_GST',
    country: 'NZ',
    label: 'GST',
    rate: 0.15,
    rateDisplay: '15%',
    reportLabel: 'GST Return',
    periodMonths: 2,
    thresholdAmount: 60000,
    thresholdCurrency: 'NZD',
    notes: 'New Zealand GST: 15% flat rate. Register if turnover ≥ NZD 60,000.',
    collectLabel: 'GST Collected',
    paidLabel: 'GST Paid',
    netLabel: 'Net GST Payable',
  },
  CA_GST: {
    framework: 'CA_GST',
    country: 'CA',
    label: 'GST/HST',
    rate: 0.05,
    rateDisplay: '5% federal (HST varies)',
    reportLabel: 'GST/HST Return',
    periodMonths: 3,
    thresholdAmount: 30000,
    thresholdCurrency: 'CAD',
    notes: 'Canada GST: 5% federal. HST combines GST+PST in some provinces (13–15%). Register if turnover > CAD 30,000.',
    collectLabel: 'GST/HST Collected',
    paidLabel: 'Input Tax Credits',
    netLabel: 'Net GST/HST',
  },
  SG_GST: {
    framework: 'SG_GST',
    country: 'SG',
    label: 'GST',
    rate: 0.09,
    rateDisplay: '9%',
    reportLabel: 'GST F5 Return',
    periodMonths: 3,
    thresholdAmount: 1000000,
    thresholdCurrency: 'SGD',
    notes: 'Singapore GST: 9% (from 2024). Register if turnover > SGD 1M.',
    collectLabel: 'Output Tax',
    paidLabel: 'Input Tax',
    netLabel: 'Net GST Payable',
  },
  EU_VAT: {
    framework: 'EU_VAT',
    country: 'EU',
    label: 'VAT',
    rate: 0.21,
    rateDisplay: 'varies by country (15–27%)',
    reportLabel: 'VAT Return',
    periodMonths: 3,
    thresholdAmount: 10000,
    thresholdCurrency: 'EUR',
    notes: 'EU VAT rates vary by country (15–27%). EU-wide OSS threshold EUR 10,000 for cross-border digital services.',
    collectLabel: 'VAT on Sales',
    paidLabel: 'VAT on Purchases',
    netLabel: 'Net VAT Due',
  },
  NONE: {
    framework: 'NONE',
    country: '',
    label: 'No Tax',
    rate: 0,
    rateDisplay: '0%',
    reportLabel: 'None',
    periodMonths: 12,
    thresholdAmount: 0,
    thresholdCurrency: 'USD',
    notes: 'No tax tracking configured.',
    collectLabel: 'Tax Collected',
    paidLabel: 'Tax Paid',
    netLabel: 'Net Tax',
  },
}

export const COUNTRY_OPTIONS = [
  { value: 'AU', label: '🇦🇺 Australia', framework: 'AU_GST' as TaxFramework, currency: 'AUD' },
  { value: 'GB', label: '🇬🇧 United Kingdom', framework: 'UK_VAT' as TaxFramework, currency: 'GBP' },
  { value: 'US', label: '🇺🇸 United States', framework: 'US_SALES_TAX' as TaxFramework, currency: 'USD' },
  { value: 'NZ', label: '🇳🇿 New Zealand', framework: 'NZ_GST' as TaxFramework, currency: 'NZD' },
  { value: 'CA', label: '🇨🇦 Canada', framework: 'CA_GST' as TaxFramework, currency: 'CAD' },
  { value: 'SG', label: '🇸🇬 Singapore', framework: 'SG_GST' as TaxFramework, currency: 'SGD' },
  { value: 'DE', label: '🇩🇪 Germany', framework: 'EU_VAT' as TaxFramework, currency: 'EUR' },
  { value: 'FR', label: '🇫🇷 France', framework: 'EU_VAT' as TaxFramework, currency: 'EUR' },
  { value: 'NL', label: '🇳🇱 Netherlands', framework: 'EU_VAT' as TaxFramework, currency: 'EUR' },
  { value: 'IE', label: '🇮🇪 Ireland', framework: 'EU_VAT' as TaxFramework, currency: 'EUR' },
  { value: 'OTHER', label: '🌍 Other', framework: 'NONE' as TaxFramework, currency: 'USD' },
]

export function getTaxConfig(framework: TaxFramework): TaxConfig {
  return TAX_FRAMEWORKS[framework] || TAX_FRAMEWORKS['NONE']
}

export function calcTaxFromInclusive(amount: number, rate: number): { net: number; tax: number } {
  const tax = amount - amount / (1 + rate)
  return { net: amount - tax, tax: Math.round(tax * 100) / 100 }
}

export function calcTaxFromExclusive(net: number, rate: number): { gross: number; tax: number } {
  const tax = net * rate
  return { gross: net + tax, tax: Math.round(tax * 100) / 100 }
}

export function getBASPeriods(year: number): { label: string; start: string; end: string }[] {
  return [
    { label: `Q1 ${year} (Jul–Sep)`, start: `${year}-07-01`, end: `${year}-09-30` },
    { label: `Q2 ${year} (Oct–Dec)`, start: `${year}-10-01`, end: `${year}-12-31` },
    { label: `Q3 ${year} (Jan–Mar ${year + 1})`, start: `${year + 1}-01-01`, end: `${year + 1}-03-31` },
    { label: `Q4 ${year} (Apr–Jun ${year + 1})`, start: `${year + 1}-04-01`, end: `${year + 1}-06-30` },
  ]
}
