import { createCrudView } from '../components/crud-view.js';
import { STORES } from '../schema.js';

const fields = [
  { key: 'listName', label: 'List', type: 'text', required: true, placeholder: 'Pre-departure' },
  { key: 'itemName', label: 'Item', type: 'text', required: true, placeholder: 'e.g. First aid kit' },
  { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Clothing, Electronics' },
];

export default createCrudView({
  store: STORES.packingItems,
  title: 'Packing List',
  addLabel: 'Add item',
  emptyMessage: 'Nothing on your packing list yet. Add your first item.',
  fields,
  defaultValues: () => ({ listName: 'Pre-departure', itemName: '', category: '', isChecked: false }),
  quickToggleField: 'isChecked',
  sort: (a, b) => (a.listName + a.category).localeCompare(b.listName + b.category),
  toListItem: (r) => ({
    title: r.itemName,
    subtitle: r.category || '',
    badge: r.listName,
    checkbox: { checked: !!r.isChecked },
  }),
});
