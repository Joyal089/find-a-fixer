import {
  isAdmin,
  isConfigured,
  leadSummary,
  listCompanies,
  listLeads,
  PAGE_SIZE,
  setCompanyStatus,
  setLeadCounted,
  setLeadLimit,
  supabase,
  type Company,
  type CompanyStatus,
  type LeadRow,
} from './api';
import { el, friendly, replaceChildren, withBusy } from './dom';
import { currentDarwinMonth, downloadCsv, formatDateTime, monthPeriod, toCsv } from './format';

const app = document.getElementById('app') as HTMLElement;
const STATUSES: readonly CompanyStatus[] = ['pending', 'approved', 'suspended'];
const STATUS_LABELS: Record<CompanyStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  suspended: 'Suspended',
};

// ---------- Login ----------

function renderLogin(message = ''): void {
  const email = el('input', { type: 'email', required: true, autocomplete: 'username' });
  const password = el('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const status = el('p', { class: message ? 'error' : 'muted' }, message);
  const submit = el('button', { class: 'primary', type: 'submit' }, 'Log in');
  const form = el(
    'form',
    { class: 'login' },
    el('label', {}, 'Email', email),
    el('label', {}, 'Password', password),
    submit,
    status,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void withBusy(submit, status, async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value,
      });
      if (error) throw new Error(error.message);
    });
  });
  replaceChildren(app, el('h1', {}, 'Find a Fixer Admin'), form);
}

// ---------- Companies ----------

function companyCard(company: Company, reload: () => void): HTMLElement {
  const status = el('p', { class: 'muted' });
  const limit = el('input', {
    class: 'small',
    type: 'number',
    min: '0',
    value: String(company.monthly_lead_limit),
    ariaLabel: `Monthly lead limit for ${company.name}`,
  });
  const saveLimit = el('button', {}, 'Save limit');
  saveLimit.addEventListener('click', () => {
    void withBusy(saveLimit, status, async () => {
      await setLeadLimit(company.id, Number(limit.value));
      status.textContent = 'Limit saved.';
    });
  });

  const statusButton = (label: string, next: CompanyStatus, className: string) => {
    const button = el('button', { class: className }, label);
    button.addEventListener('click', () => {
      void withBusy(button, status, async () => {
        await setCompanyStatus(company.id, next);
        reload();
      });
    });
    return button;
  };

  return el(
    'article',
    { class: 'card' },
    el(
      'div',
      { class: 'row' },
      el('h3', {}, company.name),
      el('span', { class: `badge ${company.status}` }, STATUS_LABELS[company.status]),
    ),
    el('div', {}, `Licence ${company.licence_number} · Insured with ${company.insurance_provider} until ${company.insurance_expiry}${company.abn ? ` · ABN ${company.abn}` : ''}`),
    el('div', { class: 'muted' }, `Trades: ${company.trades.join(', ')}`),
    el('div', { class: 'muted' }, `Areas: ${company.service_areas.join(', ')}`),
    el('div', { class: 'muted' }, `Registered ${formatDateTime(company.created_at)}`),
    el(
      'div',
      { class: 'row' },
      company.status !== 'approved' && statusButton('Approve', 'approved', 'primary'),
      company.status !== 'suspended' && statusButton('Suspend', 'suspended', 'danger'),
      el('label', {}, 'Monthly lead limit', limit),
      saveLimit,
    ),
    status,
  );
}

function renderCompanies(container: HTMLElement, status: CompanyStatus = 'pending'): void {
  const list = el('div');
  const more = el('button', {}, 'Load more');
  const message = el('p', { class: 'muted' }, 'Loading…');
  let page = 0;

  const reload = () => renderCompanies(container, status);
  const loadPage = async () => {
    const companies = await listCompanies(status, page);
    page += 1;
    list.append(...companies.map((company) => companyCard(company, reload)));
    more.hidden = companies.length < PAGE_SIZE;
    message.textContent = list.childElementCount === 0 ? 'No companies here.' : '';
  };
  more.hidden = true;
  more.addEventListener('click', () => void withBusy(more, message, loadPage));

  const filters = el(
    'div',
    { class: 'row' },
    ...STATUSES.map((value) =>
      el(
        'button',
        { ariaPressed: value === status, onClick: () => renderCompanies(container, value) },
        STATUS_LABELS[value],
      ),
    ),
  );
  replaceChildren(container, el('h2', {}, 'Companies'), filters, message, list, more);
  void withBusy(more, message, loadPage);
}

// ---------- Leads ----------

function leadRow(lead: LeadRow, onChanged: () => void): HTMLTableRowElement {
  const status = el('span', { class: 'muted' });
  const note = el('input', {
    value: lead.admin_note ?? '',
    placeholder: 'Reason (optional)',
    ariaLabel: 'Note for this lead',
  });
  const toggle = el('button', {}, lead.counted ? 'Mark not charged' : 'Count again');
  toggle.addEventListener('click', () => {
    void withBusy(toggle, status, async () => {
      await setLeadCounted(lead.id, !lead.counted, note.value);
      onChanged();
    });
  });
  return el(
    'tr',
    {},
    el('td', {}, formatDateTime(lead.created_at)),
    el('td', {}, lead.companies?.name ?? '—'),
    el('td', {}, `${lead.jobs?.title ?? '—'} (${lead.jobs?.suburb ?? ''})`),
    el('td', {}, lead.counted ? 'Counted' : 'Not charged'),
    el('td', {}, el('div', { class: 'row' }, note, toggle, status)),
  );
}

function renderLeads(container: HTMLElement, month = currentDarwinMonth()): void {
  const period = monthPeriod(month);
  const monthInput = el('input', { type: 'month', value: month, ariaLabel: 'Billing month' });
  monthInput.addEventListener('change', () => {
    if (monthInput.value) renderLeads(container, monthInput.value);
  });
  const message = el('p', { class: 'muted' }, 'Loading…');
  const summaryBody = el('tbody');
  const detailBody = el('tbody');
  const exportButton = el('button', { class: 'primary' }, 'Export lead counts (CSV)');
  const more = el('button', {}, 'Load more');
  more.hidden = true;
  let page = 0;
  const reload = () => renderLeads(container, month);

  const loadSummary = async () => {
    const rows = await leadSummary(period);
    summaryBody.replaceChildren(
      ...rows.map((row) =>
        el(
          'tr',
          {},
          el('td', {}, row.company_name),
          el('td', { class: 'num' }, String(row.leads_total)),
          el('td', { class: 'num' }, String(row.leads_counted)),
        ),
      ),
    );
    exportButton.onclick = () =>
      downloadCsv(
        `find-a-fixer-leads-${month}.csv`,
        toCsv([
          ['Company', 'Period start', 'Period end', 'Leads logged', 'Leads to invoice'],
          ...rows.map((row) => [row.company_name, period.from, period.to, row.leads_total, row.leads_counted]),
        ]),
      );
    message.textContent = rows.length === 0 ? 'No companies yet.' : '';
  };

  const loadDetail = async () => {
    const leads = await listLeads(period, page);
    page += 1;
    detailBody.append(...leads.map((lead) => leadRow(lead, reload)));
    more.hidden = leads.length < PAGE_SIZE;
  };
  more.addEventListener('click', () => void withBusy(more, message, loadDetail));

  const table = (head: string[], body: HTMLElement, numericFrom = Infinity) =>
    el(
      'div',
      { class: 'scroll' },
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, ...head.map((text, index) => el('th', { class: index >= numericFrom ? 'num' : '' }, text)))),
        body,
      ),
    );

  replaceChildren(
    container,
    el('h2', {}, 'Leads'),
    el('div', { class: 'row' }, el('label', {}, 'Billing month (Darwin time)', monthInput), exportButton),
    el('p', { class: 'muted' }, 'A lead is logged the moment the customer accepts a quote. "Leads to invoice" leaves out any you have marked as not charged.'),
    message,
    table(['Company', 'Leads logged', 'Leads to invoice'], summaryBody, 1),
    el('h2', {}, 'Every lead this month'),
    table(['Logged', 'Company', 'Job', 'Status', 'Dispute'], detailBody),
    more,
  );
  void withBusy(exportButton, message, async () => {
    await Promise.all([loadSummary(), loadDetail()]);
  });
}

// ---------- Shell ----------

function renderDashboard(email: string): void {
  const content = el('section');
  const companiesTab = el('button', { ariaPressed: true }, 'Companies');
  const leadsTab = el('button', { ariaPressed: false }, 'Leads');
  const show = (tab: 'companies' | 'leads') => {
    companiesTab.setAttribute('aria-pressed', String(tab === 'companies'));
    leadsTab.setAttribute('aria-pressed', String(tab === 'leads'));
    if (tab === 'companies') renderCompanies(content);
    else renderLeads(content);
  };
  companiesTab.addEventListener('click', () => show('companies'));
  leadsTab.addEventListener('click', () => show('leads'));

  replaceChildren(
    app,
    el(
      'header',
      { class: 'topbar' },
      el('h1', {}, 'Find a Fixer Admin'),
      el(
        'div',
        { class: 'row' },
        el('span', { class: 'muted' }, email),
        el('button', { onClick: () => void supabase.auth.signOut() }, 'Sign out'),
      ),
    ),
    el('nav', { class: 'tabs' }, companiesTab, leadsTab),
    content,
  );
  show('companies');
}

async function route(userId: string | null, email: string): Promise<void> {
  if (!userId) {
    renderLogin();
    return;
  }
  try {
    if (await isAdmin(userId)) {
      renderDashboard(email);
    } else {
      await supabase.auth.signOut();
      renderLogin('This login is not an admin.');
    }
  } catch (error) {
    renderLogin(friendly(error));
  }
}

if (!isConfigured) {
  replaceChildren(
    app,
    el('h1', {}, 'Find a Fixer Admin'),
    el('p', { class: 'error' }, 'Setup needed: set VITE_SUPABASE_URL and VITE_SUPABASE_KEY (see admin/.env.example).'),
  );
} else {
  let shownFor: string | null | undefined;
  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id ?? null;
    // Token refreshes fire this again for the same user; only re-render on a real change.
    if (userId === shownFor) return;
    shownFor = userId;
    // Deferred: Supabase asks that no other Supabase call runs inside this callback.
    setTimeout(() => void route(userId, session?.user.email ?? ''), 0);
  });
}
