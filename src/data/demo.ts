import { addDays, formatISO, subDays, subHours, subMinutes } from 'date-fns'
import type { AccessItem, ActivityEvent, AppNotification, Client, ClientMember, Invite, Invoice, InvoiceSettings, Payment, PaymentReminder, Profile, Project, ProjectNote, Subtask, Task, TaskAttachment, TaskComment, TaskWatcher, TimeEntry, LearningGoal, LearningItem, LearningTopic, LearningLesson, LearningResource, LearningTopicMember, LearningProgress } from '@/types'

// Dates are relative to "today" so demo mode always shows live overdue/upcoming states.
const day = (offset: number) => formatISO(addDays(new Date(), offset), { representation: 'date' })
const hoursAgo = (h: number) => subHours(new Date(), h).toISOString()
const minsAgo = (m: number) => subMinutes(new Date(), m).toISOString()
const daysAgo = (d: number) => subDays(new Date(), d).toISOString()

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
  invoices: Invoice[]
  invoiceSettings: InvoiceSettings | null
  subtasks: Subtask[]
  comments: TaskComment[]
  attachments: TaskAttachment[]
  timeEntries: TimeEntry[]
  watchers: TaskWatcher[]
  notifications: AppNotification[]
  invites: Invite[]
  reminders: PaymentReminder[]
  learning: LearningItem[]
  goals: LearningGoal[]
  topics: LearningTopic[]
  lessons: LearningLesson[]
  resources: LearningResource[]
  topicMembers: LearningTopicMember[]
  progress: LearningProgress[]
}

export function emptyData(): DemoData {
  return {
    clients: [], projects: [], tasks: [], accessItems: [], payments: [], notes: [], activity: [],
    profiles: [], clientMembers: [], invoices: [], invoiceSettings: null, subtasks: [], comments: [],
    attachments: [], timeEntries: [], watchers: [], notifications: [], invites: [], reminders: [],
    learning: [], goals: [], topics: [], lessons: [], resources: [], topicMembers: [], progress: [],
  }
}

const prefs = { assigned: true, mentioned: true, comment: false, overdue: true, weekly: true, due_soon: true, access: true }

export function demoData(empty = false): DemoData {
  if (empty) return emptyData()

  const profiles: Profile[] = [
    { id: 'u1', email: 'info@alifmahmud.com', display_name: 'Alif', full_name: 'Alif Mahmud', role: 'owner', job_title: 'Founder', timezone: 'Asia/Dhaka', phone: '+880 1700 000000', notification_prefs: prefs, last_active_at: minsAgo(1), created_at: daysAgo(400) },
    { id: 'u2', email: 'ibrahim@alifmahmud.com', display_name: 'Mahedi', full_name: 'Mahedi Hasan', role: 'member', job_title: 'PPC Specialist', timezone: 'Asia/Dhaka', notification_prefs: prefs, last_active_at: minsAgo(12), created_at: daysAgo(40) },
    { id: 'u3', email: 'anikabdur007@gmail.com', display_name: 'Anik', full_name: 'Anik Abdur', role: 'member', job_title: 'Analyst', timezone: 'Asia/Dhaka', notification_prefs: prefs, last_active_at: hoursAgo(2), created_at: daysAgo(30) },
  ]

  const c = (id: string, name: string, extra: Partial<Client>): Client => ({
    id, name, status: 'active', invoice_fields: [], created_at: daysAgo(120), ...extra,
  })
  const clients: Client[] = [
    c('c1', 'Yamin Khan', { company_name: 'ACE & CPS Vending', notes: 'Invoice on the 1st of each month. Prefers WhatsApp for quick questions.', country: 'United States', timezone: 'America/Denver', brand_color: '#4F46E5', pinned: true, email: 'yamin@cpsvending.com', created_at: daysAgo(140) }),
    c('c2', 'Variscite', { company_name: 'Variscite Ltd', use_company_name: false, country: 'Israel', timezone: 'Asia/Jerusalem', brand_color: '#DC2626', pinned: true, email: 'ops@variscite.com', notes: 'Server-side tracking.' }),
    c('c3', 'Tony', { company_name: 'Heyy.io · Sakuraknives · AiWomen', country: 'Israel', timezone: 'Asia/Jerusalem', brand_color: '#C026D3', pinned: true, email: 'tony@heyy.io' }),
    c('c4', 'Sandi', { company_name: 'Monthly marketing management', country: 'Sweden', timezone: 'Europe/Stockholm', brand_color: '#7C3AED', pinned: true, default_currency: 'EUR' }),
    c('c5', 'Anan Zreik', { company_name: 'Ananas Digital', country: 'Israel', timezone: 'Asia/Jerusalem', brand_color: '#D97706', email: 'anan@ananas.digital' }),
    c('c6', 'Segments', { company_name: 'Segments Digital Pty Ltd', use_company_name: false, country: 'Australia', timezone: 'Australia/Sydney', brand_color: '#E11D48', default_currency: 'AUD', company_address: 'Segments Digital Pty Ltd\n12 George St\nSydney NSW 2000' }),
    c('c7', 'PinePple', { status: 'archived', brand_color: '#16A34A', created_at: daysAgo(320) }),
    c('c8', 'Myron Katsapas', { status: 'archived', brand_color: '#334155', created_at: daysAgo(300) }),
    c('c9', 'Lagoon Media', { status: 'archived', brand_color: '#0284C7', created_at: daysAgo(280) }),
    c('c10', 'Pareto Leads', { status: 'archived', brand_color: '#0D9488', created_at: daysAgo(260) }),
    c('c11', 'Fiverr', { status: 'archived', brand_color: '#65A30D', created_at: daysAgo(240) }),
  ]

  const p = (id: string, client_id: string, title: string, extra: Partial<Project>): Project => ({
    id, client_id, title, amount: 0, currency: 'USD', status: 'not_started', priority: 'medium',
    payment_status: 'unpaid', tags: [], created_at: daysAgo(30), ...extra,
  })
  const projects: Project[] = [
    p('p1', 'c1', 'Oct: CPC Vending — Google Ads Management', { key: 'CPS', project_type: 'Google Ads', billing_type: 'retainer', status: 'in_progress', start_date: day(-23), due_date: day(7), amount: 100, description: '<p>Monthly Google Ads management for CPS / Utah Vending Services: search campaign hygiene, negative keywords and form-lead tracking.</p><p>Deliverables: weekly Loom, month-end report, optimization log.</p>', link_url: 'https://ads.google.com', link_label: 'Google Ads account', created_at: daysAgo(25) }),
    p('p2', 'c1', 'Oct: Ace Vending — Google Ads Management', { key: 'ACE', project_type: 'Google Ads', billing_type: 'retainer', start_date: day(-23), due_date: day(6), amount: 100, created_at: daysAgo(25) }),
    p('p3', 'c4', 'October — Marketing Management', { key: 'MM', project_type: 'Marketing', billing_type: 'retainer', start_date: day(-23), due_date: day(7), amount: 135, currency: 'EUR', created_at: daysAgo(24) }),
    p('p4', 'c2', 'Server Side Tracking', { key: 'VS', project_type: 'sGTM', billing_type: 'fixed', status: 'in_progress', start_date: day(-90), due_date: day(-75), amount: 100, priority: 'high', created_at: daysAgo(95) }),
    p('p5', 'c5', 'Lehemsnir.co.il — Tracking Consultant', { key: 'LEH', status: 'completed', due_date: day(-24), amount: 50, completed_at: daysAgo(26), created_at: daysAgo(40) }),
    p('p6', 'c3', 'Heyy.io — Tracking Setup', { key: 'HEY', status: 'completed', due_date: day(-16), amount: 250, completed_at: daysAgo(16), created_at: daysAgo(30) }),
    p('p7', 'c3', 'Heyy.io — Report Dashboard', { key: 'HRD', status: 'completed', due_date: day(-10), amount: 150, completed_at: daysAgo(10), created_at: daysAgo(20) }),
    p('p8', 'c3', 'Sakuraknives.co.il — GA4 + Meta + Google Ads', { key: 'SAK', status: 'completed', due_date: day(-21), amount: 120, completed_at: daysAgo(21), created_at: daysAgo(35) }),
    p('p9', 'c2', 'Open AI — Tracking Setup', { key: 'OAI', status: 'completed', due_date: day(-57), amount: 100, completed_at: daysAgo(57), created_at: daysAgo(70) }),
    p('p10', 'c1', 'Sep: CPC Vending — Google Ads Management', { key: 'CPS', project_type: 'Google Ads', billing_type: 'retainer', status: 'finished', due_date: day(-24), amount: 100, payment_status: 'paid', completed_at: daysAgo(24), created_at: daysAgo(55) }),
    p('p11', 'c1', 'Sep: Ace Vending — Google Ads Management', { key: 'ACE', project_type: 'Google Ads', billing_type: 'retainer', status: 'finished', due_date: day(-24), amount: 100, payment_status: 'paid', completed_at: daysAgo(24), created_at: daysAgo(55) }),
    p('p12', 'c3', 'AiWomen — Google Ads + GA4 + Data Layer', { key: 'AIW', status: 'completed', due_date: day(-12), amount: 100, completed_at: daysAgo(12), created_at: daysAgo(25) }),
  ]

  const t = (id: string, project_id: string, number: number, title: string, extra: Partial<Task>): Task => ({
    id, project_id, number, title, status: 'todo', priority: 'medium', labels: [], created_by: 'u1', created_at: daysAgo(5), ...extra,
  })
  const tasks: Task[] = [
    t('t1', 'p1', 12, 'Review CPS Vending campaigns and find optimization options', { status: 'in_progress', due_date: day(4), assignee_id: 'u2', labels: ['Google Ads', 'Audit'], estimate_minutes: 180, description: '<p>Go through the CPS / Utah Vending search campaigns for the last 30 days and list what we should change before the November budget.</p><p>Look at</p><ul><li>Search terms with spend and no conversions</li><li>Ad groups below 5% CTR</li><li>Call-tracking numbers vs. form leads</li></ul><p>Share findings as a comment and tag @Alif when ready.</p>', created_at: daysAgo(2) }),
    t('t2', 'p1', 11, 'Review search terms — negatives + keywords', { status: 'done', due_date: day(-3), assignee_id: 'u3', completed_at: hoursAgo(2), created_at: daysAgo(9) }),
    t('t3', 'p1', 10, 'CPS fix form submission system', { status: 'done', due_date: day(-6), assignee_id: 'u1', completed_at: daysAgo(6), created_at: daysAgo(12) }),
    t('t4', 'p4', 3, 'Setup Stape server', { labels: ['sGTM'], assignee_id: 'u1', created_at: daysAgo(30) }),
    t('t5', 'p4', 2, 'Review current setup', { assignee_id: 'u1', created_at: daysAgo(31) }),
    t('t6', 'p2', 4, 'Restaurant equipment: campaign setup', { status: 'done', due_date: day(-8), assignee_id: 'u3', completed_at: daysAgo(8), created_at: daysAgo(15) }),
    t('t7', 'p2', 3, 'Restaurant equipment: create assets per product', { status: 'done', due_date: day(-10), assignee_id: 'u2', completed_at: daysAgo(10), created_at: daysAgo(16) }),
    t('t8', 'p3', 2, 'Stad: checking tracking — window + moving', { status: 'done', due_date: day(-15), assignee_id: 'u2', completed_at: daysAgo(15), created_at: daysAgo(20) }),
  ]

  const subtasks: Subtask[] = [
    { id: 's1', task_id: 't1', title: 'Export 30-day search terms', done: true, assignee_id: 'u2', position: 0, created_at: daysAgo(2) },
    { id: 's2', task_id: 't1', title: 'Flag ad groups under 5% CTR', done: true, assignee_id: 'u2', position: 1, created_at: daysAgo(2) },
    { id: 's3', task_id: 't1', title: 'Pull call-tracking numbers', done: false, assignee_id: 'u3', position: 2, created_at: daysAgo(2) },
    { id: 's4', task_id: 't1', title: 'Write recommendations', done: false, assignee_id: 'u2', position: 3, created_at: daysAgo(2) },
  ]

  const comments: TaskComment[] = [
    { id: 'cm1', task_id: 't1', author_id: 'u2', body: 'Started on this. 3 ad groups are under 5% CTR, mostly the “vending machine repair” ones. Will finish the search-terms pass tomorrow.', mentions: [], created_at: daysAgo(1.2) },
    { id: 'cm2', task_id: 't1', author_id: 'u1', body: 'Good. @[Anik](u3) can you pull the call-tracking numbers for the same period so Mahedi can compare?', mentions: ['u3'], created_at: daysAgo(1.1) },
    { id: 'cm3', task_id: 't1', author_id: 'u2', body: '@[Alif](u1) search-terms export is attached, ready for review.', mentions: ['u1'], created_at: minsAgo(12) },
  ]

  const attachments: TaskAttachment[] = [
    { id: 'a1', task_id: 't1', kind: 'file', name: 'search-terms-30d.csv', size_bytes: 48_000, uploaded_by: 'u2', created_at: minsAgo(13) },
    { id: 'a2', task_id: 't1', kind: 'link', name: 'Google Ads — CPS account', url: 'https://ads.google.com', uploaded_by: 'u1', created_at: daysAgo(2) },
  ]

  const timeEntries: TimeEntry[] = [
    { id: 'te1', task_id: 't1', user_id: 'u2', minutes: 70, logged_on: day(-1), created_at: daysAgo(1) },
    { id: 'te2', task_id: 't1', user_id: 'u2', minutes: 30, logged_on: day(0), created_at: hoursAgo(3) },
  ]

  const watchers: TaskWatcher[] = [
    { id: 'w1', task_id: 't1', user_id: 'u1', created_at: daysAgo(2) },
    { id: 'w2', task_id: 't1', user_id: 'u2', created_at: daysAgo(2) },
  ]

  const accessItems: AccessItem[] = [
    { id: 'ac1', project_id: 'p1', access_name: 'Google Ads account', description: 'Admin access for analyticsbyte MCC', status: 'received', is_required: true, created_at: daysAgo(24) },
    { id: 'ac2', project_id: 'p1', access_name: 'Google Tag Manager', description: 'Publish access to the web container', status: 'requested', is_required: true, created_at: daysAgo(24) },
    { id: 'ac3', project_id: 'p1', access_name: 'Call-tracking dashboard', description: 'Read access to CallRail', status: 'needed', is_required: false, created_at: daysAgo(24) },
  ]

  const notes: ProjectNote[] = [
    { id: 'n1', project_id: 'p1', note: 'Client prefers a weekly Loom over calls. Never pause brand campaigns without asking first.', created_by: 'Alif', author_id: 'u1', pinned: true, mentions: [], created_at: daysAgo(21) },
    { id: 'n2', project_id: 'p1', note: 'Form submissions are firing again after the fix — conversions back in Ads since Oct 19. @[Alif](u1)', created_by: 'Mahedi', author_id: 'u2', mentions: ['u1'], created_at: daysAgo(4) },
  ]

  const pay = (id: string, client_id: string, project_ids: string[], amount: number, extra: Partial<Payment>): Payment => ({
    id, client_id, project_ids, amount, currency: 'USD', status: 'unpaid', created_at: daysAgo(20), ...extra,
  })
  const payments: Payment[] = [
    pay('py1', 'c2', ['p4'], 100, { due_date: day(-75), notes: 'Invoice for "Server Side Tracking"' }),
    pay('py2', 'c2', ['p9'], 100, { due_date: day(-53) }),
    pay('py3', 'c2', [], 150, { notes: 'Others: meeting, audit, hourly' }),
    pay('py4', 'c3', ['p6'], 250, {}),
    pay('py5', 'c3', ['p7'], 150, {}),
    pay('py6', 'c3', ['p8'], 120, {}),
    pay('py7', 'c3', ['p12'], 100, {}),
    pay('py8', 'c5', ['p5'], 50, { due_date: day(-24) }),
    pay('py9', 'c1', ['p10', 'p11'], 200, { status: 'paid', payment_date: day(-1), payment_method: 'Wise', invoice_id: 'inv1', due_date: day(-7) }),
    pay('py10', 'c6', [], 1300, { currency: 'AUD', status: 'paid', payment_date: day(-9), payment_method: 'Bank transfer', invoice_id: 'inv3' }),
    pay('py11', 'c4', ['p3'], 135, { currency: 'EUR', status: 'paid', payment_date: day(-18), payment_method: 'Payoneer', invoice_id: 'inv2' }),
    pay('py12', 'c1', [], 200, { status: 'paid', payment_date: day(-20), payment_method: 'Wise', invoice_id: 'inv4', created_at: daysAgo(55) }),
    pay('py13', 'c7', [], 640, { status: 'paid', payment_date: day(-170), payment_method: 'Wise', created_at: daysAgo(175) }),
    pay('py14', 'c7', [], 480, { status: 'paid', payment_date: day(-140), payment_method: 'Wise', created_at: daysAgo(145) }),
    pay('py15', 'c9', [], 600, { status: 'paid', payment_date: day(-110), payment_method: 'Payoneer', created_at: daysAgo(115) }),
    pay('py16', 'c10', [], 220, { status: 'paid', payment_date: day(-105), payment_method: 'Wise', created_at: daysAgo(110) }),
    pay('py17', 'c7', [], 290, { status: 'paid', payment_date: day(-75), payment_method: 'Wise', created_at: daysAgo(80) }),
    pay('py18', 'c7', [], 210, { status: 'paid', payment_date: day(-37), payment_method: 'Wise', created_at: daysAgo(40) }),
    pay('py19', 'c10', [], 80, { status: 'paid', payment_date: day(-52), payment_method: 'Wise', created_at: daysAgo(55) }),
  ]

  const inv = (id: string, client_id: string, number: string, issue: number, items: [string, number][], currency = 'USD'): Invoice => ({
    id, client_id, number, issue_date: day(issue), due_date: day(issue + 7), currency,
    line_items: items.map(([description, price]) => ({ description, price, qty: 1 })),
    tax_rate: 0, notes: 'It was great doing business with you, and I appreciate your continued collaboration.',
    brand_color: '#4F46E5', payment_fields: [{ label: 'Account name', value: 'Alif Mahmud' }, { label: 'Email', value: 'info@alifmahmud.com' }],
    payment_profile_id: 'pp1', created_at: daysAgo(-issue),
  })
  const invoices: Invoice[] = [
    inv('inv1', 'c1', 'YA-02', -14, [['Oct: Ace Vending — Google Ads Management', 100], ['Oct: CPC Vending — Google Ads Management', 100]]),
    inv('inv2', 'c4', 'SA-01', -23, [['October — Marketing Management', 135]], 'EUR'),
    inv('inv3', 'c6', 'DG-07', -22, [['Tracking & reporting retainer', 1300]], 'AUD'),
    inv('inv4', 'c1', 'YA-01', -24, [['Sep: CPC Vending — Google Ads Management', 100], ['Sep: Ace Vending — Google Ads Management', 100]]),
  ]

  const invoiceSettings: InvoiceSettings = {
    id: 'is1', business_name: 'Alif Mahmud', business_address: 'Birabo, Kanchan,\nDhaka, Bangladesh', email: 'info@alifmahmud.com',
    brand_color: '#4F46E5', default_note: 'It was great doing business with you, and I appreciate your continued collaboration.',
    default_currency: 'USD', default_due_days: 7, default_tax: 0, workspace_name: 'analyticsbyte',
    payment_profiles: [
      { id: 'pp1', name: 'Wise', fields: [{ label: 'Account name', value: 'Alif Mahmud' }, { label: 'Email', value: 'info@alifmahmud.com' }, { label: 'Currency', value: 'USD' }] },
      { id: 'pp2', name: 'Payoneer', fields: [{ label: 'Account name', value: 'Alif Mahmud' }, { label: 'Email', value: 'info@alifmahmud.com' }] },
    ],
    created_at: daysAgo(300),
  }

  const clientMembers: ClientMember[] = [
    { id: 'cm-1', client_id: 'c1', user_id: 'u2', created_at: daysAgo(40) },
    { id: 'cm-2', client_id: 'c4', user_id: 'u2', created_at: daysAgo(40) },
    { id: 'cm-3', client_id: 'c1', user_id: 'u3', created_at: daysAgo(12) },
  ]

  const notifications: AppNotification[] = [
    { id: 'nt1', user_id: 'u1', type: 'mentioned', actor_id: 'u2', entity: 'task', entity_id: 't1', project_id: 'p1', title: 'Review CPS Vending campaigns and find optimization options', excerpt: 'search-terms export is attached, ready for review.', link: '/tasks/t1#c-cm3', emailed: true, created_at: minsAgo(12) },
    { id: 'nt2', user_id: 'u1', type: 'mentioned_note', actor_id: 'u2', entity: 'project', entity_id: 'p1', project_id: 'p1', title: 'Oct: CPC Vending — Google Ads Management', excerpt: 'Form submissions are firing again after the fix.', link: '/projects/p1?tab=notes', emailed: true, created_at: daysAgo(4) },
    { id: 'nt3', user_id: 'u1', type: 'completed', actor_id: 'u3', entity: 'task', entity_id: 't2', project_id: 'p1', title: 'Review search terms — negatives + keywords', excerpt: 'Oct: CPC Vending — Google Ads Management', link: '/tasks/t2', emailed: false, read_at: hoursAgo(1), created_at: hoursAgo(2) },
    { id: 'nt4', user_id: 'u1', type: 'overdue', entity: 'payment', entity_id: 'py8', title: 'Payment overdue · Anan Zreik · USD 50', excerpt: 'Lehemsnir.co.il was due ' + day(-24), link: '/payments?p=py8', emailed: true, read_at: hoursAgo(20), created_at: daysAgo(1) },
    { id: 'nt5', user_id: 'u1', type: 'invite_accepted', actor_id: 'u3', entity: 'member', entity_id: 'u3', title: 'Anik accepted your invite', excerpt: 'Has access to Yamin Khan', link: '/team/u3', emailed: false, read_at: daysAgo(11), created_at: daysAgo(12) },
  ]

  const invites: Invite[] = [
    { id: 'iv1', email: 'designer@lagoonmedia.co', role: 'member', client_ids: [], token: 'demo-token', invited_by: 'u1', created_at: daysAgo(3) },
  ]

  const reminders: PaymentReminder[] = []

  const a = (id: string, actor: string, entity: ActivityEvent['entity'], entity_id: string, action: ActivityEvent['action'], message: string, at: string, project_id?: string): ActivityEvent => ({
    id, actor_id: actor, entity, entity_id, action, message, created_at: at, project_id: project_id ?? null, meta: {},
  })
  const activity: ActivityEvent[] = [
    a('ev1', 'u2', 'comment', 't1', 'commented', 'commented on “Review CPS Vending campaigns”', minsAgo(12), 'p1'),
    a('ev2', 'u3', 'task', 't2', 'completed', 'completed “Review search terms — negatives + keywords”', hoursAgo(2), 'p1'),
    a('ev3', 'u1', 'payment', 'py9', 'paid', 'Received $200 from Yamin Khan', daysAgo(1)),
    a('ev4', 'u2', 'subtask', 't1', 'completed', 'checked “Flag ad groups under 5% CTR”', daysAgo(1.1), 'p1'),
    a('ev5', 'u2', 'task', 't1', 'status_changed', 'changed status To do → In progress', daysAgo(1.15), 'p1'),
    a('ev6', 'u1', 'task', 't1', 'updated', 'set due date', daysAgo(2), 'p1'),
    a('ev7', 'u1', 'task', 't1', 'assigned', 'assigned Mahedi', daysAgo(2), 'p1'),
    a('ev8', 'u1', 'task', 't1', 'created', 'created the task', daysAgo(2.01), 'p1'),
  ]

  return {
    clients, projects, tasks, accessItems, payments, notes, activity, profiles, clientMembers,
    invoices, invoiceSettings, subtasks, comments, attachments, timeEntries, watchers, notifications,
    invites, reminders, learning: demoLearning(), goals: demoGoals(), ...demoTopics(),
  }
}

function demoGoals(): LearningGoal[] {
  const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
  return [
    { id: 'lg1', user_id: 'u2', created_by: 'u2', title: 'Get confident with server-side GTM', target_date: null, status: 'active', created_at: ago(20) },
    { id: 'lg2', user_id: 'u1', created_by: 'u1', title: 'Learn Looker Studio dashboards', target_date: null, status: 'active', created_at: ago(15) },
  ]
}

function demoLearning(): LearningItem[] {
  const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
  return [
    { id: 'li1', created_by: 'u1', assignee_id: 'u2', goal_id: 'lg1', title: 'Server-side tagging fundamentals', url: 'https://www.youtube.com/watch?v=example', kind: 'video', note: 'Watch this before the Stape setup next week.', status: 'learning', started_at: ago(2), created_at: ago(3) },
    { id: 'li2', created_by: 'u2', assignee_id: 'u2', goal_id: 'lg1', title: 'Simo Ahava: GTM server container guide', url: 'https://www.simoahava.com/', kind: 'article', status: 'done', takeaway: 'Run the server container on a subdomain so cookies stay first-party.', started_at: ago(6), completed_at: ago(4), created_at: ago(7) },
    { id: 'li3', created_by: 'u1', assignee_id: 'u1', goal_id: 'lg2', title: 'Looker Studio blending explained', url: 'https://support.google.com/looker-studio', kind: 'article', status: 'todo', created_at: ago(1) },
  ]
}

function demoTopics() {
  const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
  const topics: LearningTopic[] = [
    { id: 'tp1', created_by: 'u1', title: 'Google Tag Manager', description: 'From a clean container to server-side tagging. Everyone on tracking work should finish this.', color: '#2563EB', created_at: ago(10) },
    { id: 'tp2', created_by: 'u2', title: 'Google Analytics 4', description: 'Events, conversions and the reports clients actually ask about.', color: '#D97706', created_at: ago(6) },
  ]
  const lessons: LearningLesson[] = [
    { id: 'ls1', topic_id: 'tp1', created_by: 'u1', title: 'How to set it up', details: 'Create the account and container, install the snippet, and check it with Tag Assistant.', position: 1, created_at: ago(10) },
    { id: 'ls2', topic_id: 'tp1', created_by: 'u1', title: 'Tags, triggers and variables', details: 'How the three pieces fit together. Build a GA4 page_view and a click trigger.', position: 2, created_at: ago(10) },
    { id: 'ls3', topic_id: 'tp1', created_by: 'u1', title: 'Data layer basics', details: 'What developers push and how to read it in GTM.', position: 3, created_at: ago(9) },
    { id: 'ls4', topic_id: 'tp1', created_by: 'u2', title: 'Server-side tagging with Stape', position: 4, created_at: ago(5) },
    { id: 'ls5', topic_id: 'tp2', created_by: 'u2', title: 'Events vs. conversions', position: 1, created_at: ago(6) },
    { id: 'ls6', topic_id: 'tp2', created_by: 'u2', title: 'Explorations for client reports', position: 2, created_at: ago(6) },
  ]
  const resources: LearningResource[] = [
    { id: 'rs1', lesson_id: 'ls1', created_by: 'u1', title: 'Google Tag Manager setup walkthrough', url: 'https://www.youtube.com/watch?v=example', kind: 'video', created_at: ago(10) },
    { id: 'rs2', lesson_id: 'ls1', created_by: 'u1', title: 'Official GTM install guide', url: 'https://support.google.com/tagmanager', kind: 'article', created_at: ago(10) },
    { id: 'rs3', lesson_id: 'ls2', created_by: 'u1', title: 'Triggers explained', url: 'https://www.simoahava.com/', kind: 'article', note: 'Read the part on trigger groups.', created_at: ago(9) },
    { id: 'rs4', lesson_id: 'ls4', created_by: 'u2', title: 'Stape server GTM course', url: 'https://stape.io/', kind: 'course', created_at: ago(5) },
  ]
  const topicMembers: LearningTopicMember[] = [
    { id: 'tm1', topic_id: 'tp1', user_id: 'u1', added_by: 'u1', created_at: ago(10) },
    { id: 'tm2', topic_id: 'tp1', user_id: 'u2', added_by: 'u1', created_at: ago(10) },
    { id: 'tm3', topic_id: 'tp1', user_id: 'u3', added_by: 'u1', created_at: ago(9) },
    { id: 'tm4', topic_id: 'tp2', user_id: 'u2', added_by: 'u2', created_at: ago(6) },
  ]
  const progress: LearningProgress[] = [
    { id: 'pg1', lesson_id: 'ls1', user_id: 'u2', status: 'done', takeaway: 'Always publish a version with a clear name so rollbacks are easy.', completed_at: ago(4), created_at: ago(8) },
    { id: 'pg2', lesson_id: 'ls2', user_id: 'u2', status: 'learning', created_at: ago(2) },
    { id: 'pg3', lesson_id: 'ls1', user_id: 'u1', status: 'done', completed_at: ago(9), created_at: ago(9) },
  ]
  return { topics, lessons, resources, topicMembers, progress }
}
