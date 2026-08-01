import { addDays, formatISO, subDays, subHours } from 'date-fns'
import type {
  AccessItem,
  ActivityEvent,
  Client,
  ClientMember,
  Payment,
  Profile,
  Project,
  ProjectNote,
  Task,
} from '@/types'

// Dates are generated relative to "today" so the demo always shows live overdue/upcoming states.
const day = (offset: number) => formatISO(addDays(new Date(), offset), { representation: 'date' })
const ago = (hours: number) => subHours(new Date(), hours).toISOString()
const past = (days: number) => subDays(new Date(), days).toISOString()

export interface DemoData {
  clients: Client[]
  projects: Project[]
  tasks: Task[]
  accessItems: AccessItem[]
  payments: Payment[]
  notes: ProjectNote[]
  activity: ActivityEvent[]
  profiles: Profile[]
  clientMembers: ClientMember[]
}

export function demoData(): DemoData {
  const clients: Client[] = [
    { id: 'c1', name: 'Sarah Chen', company_name: 'Northwind Outfitters', use_company_name: true, email: 'sarah@northwind.co', phone: '+1 415 555 0132', website: 'northwind.co', country: 'United States', timezone: 'America/Los_Angeles', status: 'active', notes: 'Shopify store, ~40k sessions/mo. Prefers Loom updates over calls.', created_at: past(210) },
    { id: 'c2', name: 'Jonas Weber', company_name: 'Lumen Health', use_company_name: true, email: 'jonas@lumenhealth.de', phone: '+49 30 555 0198', website: 'lumenhealth.de', country: 'Germany', timezone: 'Europe/Berlin', status: 'active', notes: 'GDPR-sensitive — everything must run server-side via sGTM.', created_at: past(150) },
    { id: 'c3', name: 'Priya Nair', company_name: 'Brightpath Learning', use_company_name: true, email: 'priya@brightpath.io', website: 'brightpath.io', country: 'India', timezone: 'Asia/Kolkata', status: 'active', notes: 'EdTech SaaS. Monthly retainer for CRO experiments.', created_at: past(120) },
    { id: 'c4', name: 'Tom Aldridge', company_name: 'Aldridge & Co', email: 'tom@aldridge.co.uk', country: 'United Kingdom', timezone: 'Europe/London', status: 'paused', notes: 'Paused until their site rebuild ships (est. next quarter).', created_at: past(300) },
    { id: 'c5', name: 'Maria Duarte', company_name: 'Casa Verde', use_company_name: true, email: 'maria@casaverde.pt', country: 'Portugal', timezone: 'Europe/Lisbon', status: 'completed', notes: 'GA4 audit wrapped. Good referral source.', created_at: past(400) },
  ]

  const projects: Project[] = [
    { id: 'p1', client_id: 'c1', title: 'Shopify GA4 + GTM rebuild', project_type: 'Tracking setup', description: 'Full datalayer rebuild, GA4 ecommerce events, checkout funnel tracking.', amount: 3200, currency: 'USD', start_date: day(-24), due_date: day(-2), status: 'in_progress', priority: 'urgent', payment_status: 'partial', tags: ['GTM', 'GA4', 'Shopify'], created_at: past(24) },
    { id: 'p2', client_id: 'c1', title: 'Klaviyo flow tracking', project_type: 'Integration', description: 'Attribution for email flows into GA4 + Looker Studio report.', amount: 900, currency: 'USD', start_date: day(-10), due_date: day(12), status: 'not_started', priority: 'medium', payment_status: 'unpaid', tags: ['GA4', 'Email'], created_at: past(10) },
    { id: 'p3', client_id: 'c2', title: 'Server-side GTM migration', project_type: 'sGTM', description: 'Move all tags to a server container on Stape, consent-mode v2 across the stack.', amount: 4800, currency: 'EUR', start_date: day(-30), due_date: day(9), status: 'waiting_for_client', priority: 'high', payment_status: 'partial', tags: ['sGTM', 'Consent', 'GDPR'], created_at: past(30) },
    { id: 'p4', client_id: 'c2', title: 'Cookie banner consent audit', project_type: 'Audit', description: 'Verify consent signals reach every vendor tag correctly.', amount: 1200, currency: 'EUR', start_date: day(-6), due_date: day(6), status: 'blocked', priority: 'high', payment_status: 'unpaid', tags: ['Consent', 'GDPR'], created_at: past(6) },
    { id: 'p5', client_id: 'c3', title: 'Pricing page CRO sprint', project_type: 'CRO', description: 'Three A/B tests on the pricing page, targeting trial-start rate.', amount: 2500, currency: 'USD', start_date: day(-14), due_date: day(16), status: 'in_progress', priority: 'medium', payment_status: 'paid', tags: ['CRO', 'A/B testing'], created_at: past(14) },
    { id: 'p6', client_id: 'c3', title: 'Onboarding funnel dashboard', project_type: 'Reporting', description: 'Looker Studio dashboard for the activation funnel.', amount: 1400, currency: 'USD', start_date: day(-45), due_date: day(-20), status: 'completed', priority: 'low', payment_status: 'paid', tags: ['Looker Studio', 'Reporting'], created_at: past(45) },
    { id: 'p7', client_id: 'c5', title: 'GA4 property audit', project_type: 'Audit', description: 'Full audit + fixes doc.', amount: 950, currency: 'EUR', start_date: day(-80), due_date: day(-60), status: 'completed', priority: 'medium', payment_status: 'paid', tags: ['GA4', 'Audit'], created_at: past(80) },
  ]

  const tasks: Task[] = [
    { id: 't1', project_id: 'p1', title: 'Rebuild checkout datalayer events', status: 'in_progress', priority: 'urgent', due_date: day(0), assignee_id: 'u2', created_at: past(12) },
    { id: 't2', project_id: 'p1', title: 'QA purchase event dedup (browser vs server)', status: 'todo', priority: 'high', due_date: day(1), assignee_id: 'u1', created_at: past(10) },
    { id: 't3', project_id: 'p1', title: 'Map custom dimensions in GA4 admin', status: 'done', priority: 'medium', due_date: day(-4), created_at: past(14) },
    { id: 't4', project_id: 'p1', title: 'Write handover doc for Sarah', status: 'todo', priority: 'medium', due_date: day(3), assignee_id: 'u2', created_at: past(4) },
    { id: 't5', project_id: 'p3', title: 'Configure Stape server container', status: 'done', priority: 'high', due_date: day(-8), created_at: past(20) },
    { id: 't6', project_id: 'p3', title: 'Move Meta CAPI to server-side', status: 'review', priority: 'high', due_date: day(2), created_at: past(9) },
    { id: 't7', project_id: 'p3', title: 'Waiting: DNS record for tagging subdomain', status: 'in_progress', priority: 'urgent', due_date: day(-1), notes: 'Blocked on Lumen IT — chased on Monday.', created_at: past(7) },
    { id: 't8', project_id: 'p4', title: 'Crawl site for tags firing pre-consent', status: 'todo', priority: 'high', due_date: day(4), created_at: past(5) },
    { id: 't9', project_id: 'p5', title: 'Ship test #2: social proof above CTA', status: 'in_progress', priority: 'medium', due_date: day(5), created_at: past(6) },
    { id: 't10', project_id: 'p5', title: 'Analyze test #1 results (annual toggle)', status: 'done', priority: 'medium', due_date: day(-3), created_at: past(13) },
    { id: 't11', project_id: 'p5', title: 'Draft test #3 hypothesis doc', status: 'todo', priority: 'low', due_date: day(9), created_at: past(3) },
    { id: 't12', project_id: 'p2', title: 'Scope Klaviyo UTM conventions', status: 'todo', priority: 'medium', due_date: day(6), created_at: past(2) },
  ]

  const accessItems: AccessItem[] = [
    { id: 'a1', project_id: 'p1', access_name: 'Shopify admin (collaborator)', status: 'received', is_required: true, created_at: past(23) },
    { id: 'a2', project_id: 'p1', access_name: 'GA4 property — Editor', status: 'received', is_required: true, created_at: past(23) },
    { id: 'a3', project_id: 'p2', access_name: 'Klaviyo account access', status: 'requested', is_required: true, notes: 'Requested from Sarah last Thursday.', created_at: past(8) },
    { id: 'a4', project_id: 'p3', access_name: 'DNS access for tagging subdomain', status: 'needed', is_required: true, notes: 'Their IT must add a CNAME.', created_at: past(15) },
    { id: 'a5', project_id: 'p3', access_name: 'Meta Business Manager — admin', status: 'received', is_required: true, created_at: past(20) },
    { id: 'a6', project_id: 'p4', access_name: 'Usercentrics dashboard', status: 'requested', is_required: true, created_at: past(5) },
    { id: 'a7', project_id: 'p5', access_name: 'PostHog project access', status: 'received', is_required: false, created_at: past(12) },
  ]

  const payments: Payment[] = [
    { id: 'pay1', client_id: 'c1', project_ids: ['p1'], amount: 1600, currency: 'USD', status: 'paid', payment_method: 'Wise', payment_date: day(-20), due_date: day(-21), notes: '50% upfront', created_at: past(21) },
    { id: 'pay2', client_id: 'c1', project_ids: ['p1'], amount: 1600, currency: 'USD', status: 'overdue', payment_method: 'Wise', invoice_url: 'https://invoices.example.com/NW-2041', due_date: day(-3), notes: 'Final 50% on delivery', created_at: past(6) },
    { id: 'pay3', client_id: 'c2', project_ids: ['p3'], amount: 2400, currency: 'EUR', status: 'paid', payment_method: 'Bank transfer', payment_date: day(-26), due_date: day(-28), notes: '50% upfront', created_at: past(29) },
    { id: 'pay4', client_id: 'c2', project_ids: ['p3'], amount: 2400, currency: 'EUR', status: 'unpaid', payment_method: 'Bank transfer', due_date: day(10), notes: 'Due on migration go-live', created_at: past(9) },
    { id: 'pay5', client_id: 'c2', project_ids: ['p4'], amount: 1200, currency: 'EUR', status: 'unpaid', due_date: day(14), created_at: past(5) },
    { id: 'pay6', client_id: 'c3', project_ids: ['p5'], amount: 2500, currency: 'USD', status: 'paid', payment_method: 'Stripe', payment_date: day(-12), due_date: day(-14), created_at: past(15) },
    { id: 'pay7', client_id: 'c3', project_ids: ['p6'], amount: 1400, currency: 'USD', status: 'paid', payment_method: 'Stripe', payment_date: day(-19), due_date: day(-20), created_at: past(22) },
    { id: 'pay8', client_id: 'c5', project_ids: ['p7'], amount: 950, currency: 'EUR', status: 'paid', payment_method: 'Bank transfer', payment_date: day(-58), due_date: day(-60), created_at: past(62) },
  ]

  const notes: ProjectNote[] = [
    { id: 'n1', project_id: 'p1', note: 'Sarah confirmed the new theme ships Friday — retest datalayer after deploy.', created_by: 'Alif', created_at: ago(30) },
    { id: 'n2', project_id: 'p1', note: 'Purchase dedup issue traced to duplicate transaction_id on thank-you page reloads.', created_by: 'Alif', created_at: ago(76) },
    { id: 'n3', project_id: 'p3', note: 'Lumen IT ticket #4432 opened for the DNS record. ETA unknown.', created_by: 'Alif', created_at: ago(50) },
    { id: 'n4', project_id: 'p5', note: 'Test #1 won: +11% trial starts with annual toggle default. Rolling out.', created_by: 'Alif', created_at: ago(100) },
    { id: 'n5', project_id: 'p4', note: 'Blocked until Usercentrics access arrives — audit crawl ready to run.', created_by: 'Alif', created_at: ago(20) },
  ]

  const activity: ActivityEvent[] = [
    { id: 'ev1', entity: 'task', entity_id: 't3', action: 'completed', message: 'Completed task "Map custom dimensions in GA4 admin"', created_at: ago(4) },
    { id: 'ev2', entity: 'payment', entity_id: 'pay2', action: 'status_changed', message: 'Payment for "Shopify GA4 + GTM rebuild" is now overdue', created_at: ago(9) },
    { id: 'ev3', entity: 'task', entity_id: 't6', action: 'status_changed', message: 'Moved "Move Meta CAPI to server-side" to In review', created_at: ago(26) },
    { id: 'ev4', entity: 'note', entity_id: 'n1', action: 'created', message: 'Added a note to "Shopify GA4 + GTM rebuild"', created_at: ago(30) },
    { id: 'ev5', entity: 'project', entity_id: 'p4', action: 'status_changed', message: 'Project "Cookie banner consent audit" is blocked', created_at: ago(44) },
    { id: 'ev6', entity: 'access_item', entity_id: 'a6', action: 'status_changed', message: 'Requested access: Usercentrics dashboard', created_at: ago(52) },
    { id: 'ev7', entity: 'payment', entity_id: 'pay6', action: 'paid', message: 'Received $2,500 from Brightpath Learning', created_at: ago(70) },
    { id: 'ev8', entity: 'task', entity_id: 't10', action: 'completed', message: 'Completed task "Analyze test #1 results (annual toggle)"', created_at: ago(80) },
    { id: 'ev9', entity: 'project', entity_id: 'p2', action: 'created', message: 'Created project "Klaviyo flow tracking" for Northwind Outfitters', created_at: ago(96) },
  ]

  const profiles: Profile[] = [
    { id: 'u1', email: 'you@mydesk.app', display_name: 'You', role: 'owner', created_at: past(400) },
    { id: 'u2', email: 'mahedi@mydesk.app', display_name: 'Mahedi', role: 'member', created_at: past(30) },
  ]

  // u2 (Mahedi) has access to the whole Northwind Outfitters account — every
  // project under c1, not just one — matching the client-level access model.
  const clientMembers: ClientMember[] = [
    { id: 'cm1', client_id: 'c1', user_id: 'u2', created_at: past(20) },
  ]

  return { clients, projects, tasks, accessItems, payments, notes, activity, profiles, clientMembers }
}
