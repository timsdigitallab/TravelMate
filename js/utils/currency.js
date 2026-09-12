export const CURRENCIES = ['EUR', 'AUD'];

export function formatCurrency(amount, currencyCode) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

// Sums income minus expense per currency. Currencies are never mixed
// automatically since there is no reliable live exchange rate offline.
export function computeBalances(transactions) {
  const balances = { EUR: 0, AUD: 0 };
  for (const t of transactions) {
    const sign = t.type === 'income' ? 1 : -1;
    balances[t.currency] = (balances[t.currency] || 0) + sign * Number(t.amount || 0);
  }
  return balances;
}

// Purely informational combined estimate using a manually-entered rate
// (never fetched live, so the app keeps working offline).
export function estimateCombinedAUD(balances, eurToAudRate) {
  if (!eurToAudRate) return null;
  return balances.AUD + balances.EUR * Number(eurToAudRate);
}
