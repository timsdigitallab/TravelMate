import { createCrudView } from '../components/crud-view.js';
import { getAll, get } from '../db.js';
import { STORES } from '../schema.js';
import { formatDisplay, todayISO } from '../utils/date.js';
import { formatCurrency, computeBalances, estimateCombinedAUD } from '../utils/currency.js';
import { on } from '../state.js';

const fields = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'expense', label: 'Expense' },
      { value: 'income', label: 'Income' },
    ],
  },
  { key: 'amount', label: 'Amount', type: 'number', step: '0.01', required: true },
  {
    key: 'currency',
    label: 'Currency',
    type: 'select',
    options: [
      { value: 'AUD', label: 'AUD' },
      { value: 'EUR', label: 'EUR' },
    ],
  },
  { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Accommodation, Food, Job income' },
  { key: 'description', label: 'Description', type: 'text' },
];

const transactionsCrud = createCrudView({
  store: STORES.transactions,
  title: 'Budget & Expenses',
  addLabel: 'Add transaction',
  emptyMessage: 'No transactions yet.',
  fields,
  defaultValues: () => ({ date: todayISO(), type: 'expense', amount: null, currency: 'AUD', category: '', description: '' }),
  sort: (a, b) => b.date.localeCompare(a.date),
  toListItem: (r) => ({
    title: r.description || r.category || (r.type === 'income' ? 'Income' : 'Expense'),
    subtitle: r.category || '',
    badge: r.type,
    badgeVariant: r.type === 'income' ? 'success' : 'muted',
    meta: `${formatCurrency(r.amount, r.currency)} · ${formatDisplay(r.date)}`,
  }),
});

async function renderBalances(container) {
  const [transactions, rateSetting] = await Promise.all([getAll(STORES.transactions), get(STORES.settings, 'eurToAudRate')]);
  const balances = computeBalances(transactions);
  const rate = rateSetting?.value;
  const estimate = estimateCombinedAUD(balances, rate);
  container.innerHTML = `
    <div class="balance-cards">
      <div class="balance-card"><span>AUD balance</span><strong>${formatCurrency(balances.AUD, 'AUD')}</strong></div>
      <div class="balance-card"><span>EUR balance</span><strong>${formatCurrency(balances.EUR, 'EUR')}</strong></div>
      ${
        estimate !== null
          ? `<div class="balance-card balance-card--estimate"><span>Estimated total (AUD)</span><strong>${formatCurrency(estimate, 'AUD')}</strong></div>`
          : `<p class="form-hint">Set an EUR→AUD rate in Settings to see a combined estimate.</p>`
      }
    </div>`;
}

async function render(container) {
  container.innerHTML = `<div data-balances></div><div data-list-container></div>`;
  const balancesEl = container.querySelector('[data-balances]');
  await renderBalances(balancesEl);
  await transactionsCrud.render(container.querySelector('[data-list-container]'));

  const unsubscribe = on('data:changed', ({ store }) => {
    if (store === STORES.transactions || store === STORES.settings) renderBalances(balancesEl);
  });
  container.addEventListener('view:unmount', unsubscribe, { once: true });
}

export default { render };
