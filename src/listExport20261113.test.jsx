// 2026-11-13 (Owner approved part 1): the clients and the catalog to Excel - the sheet, the buttons and where they sit
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { buildListWorkbook } from './utils/listExport';
import ServicesCatalog from './components/ServicesCatalog';

afterEach(cleanup);
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('the list export sheet', () => {
  it('title, export date, headers on row 4, one row per item; Hebrew sheets right to left', () => {
    const wb = buildListWorkbook({ sheetName: 'לקוחות', title: 'עסק – רשימת לקוחות', dateLine: 'תאריך הפקה: 13/11/2026', headers: ['שם הלקוח', 'טלפון'], widths: [20, 14],
      rows: [['כהן', '050-1234567'], ['לוי', null]], rtl: true });
    const sheet = wb.getWorksheet('לקוחות');
    expect(sheet.views[0].rightToLeft).toBe(true);
    expect(sheet.getCell(1, 1).value).toBe('עסק – רשימת לקוחות');
    expect(sheet.getCell(2, 1).value).toBe('תאריך הפקה: 13/11/2026');
    expect([sheet.getCell(4, 1).value, sheet.getCell(4, 2).value]).toEqual(['שם הלקוח', 'טלפון']);
    expect([sheet.getCell(5, 1).value, sheet.getCell(6, 1).value, sheet.getCell(6, 2).value]).toEqual(['כהן', 'לוי', '']);
  });
});

describe('the export buttons', () => {
  it('the catalog: "ייצוא לאקסל" beside "add item" exports the items shown', () => {
    const onExportCatalog = vi.fn();
    const services = [{ id: 's1', name: 'צביעה', price: 40, price_basis: 'm2' }, { id: 's2', name: 'חלון', price: 900 }];
    render(<ServicesCatalog onExportCatalog={onExportCatalog} t={{ serviceName: 'שם', defaultPrice: 'מחיר', description: 'תיאור', price: 'מחיר', actions: 'פעולות' }} isHebrew services={services}
      newServiceName="" setNewServiceName={() => {}} newServicePrice="" setNewServicePrice={() => {}} handleAddService={() => {}} editingServiceId={null} setEditingServiceId={() => {}}
      editServiceName="" setEditServiceName={() => {}} editServicePrice="" setEditServicePrice={() => {}} handleSaveEditedService={() => {}} handleDeleteService={() => {}}
      sym="₪" formatMoneyDisplay={(n) => Number(n).toFixed(2)} />);
    const btn = screen.getByTestId('catalog-export');
    expect(btn.textContent).toBe('ייצוא לאקסל');
    fireEvent.click(btn);
    expect(onExportCatalog).toHaveBeenCalledTimes(1);
    expect(onExportCatalog.mock.calls[0][0].map((s) => s.id).sort()).toEqual(['s1', 's2']);
  });
  it('the clients: the button sits in the search row, before the phone sort control (at its right in Hebrew - L-26)', () => {
    const c = src('./components/ClientsTab.jsx');
    const at = c.indexOf('data-testid="clients-export"');
    expect(at).toBeGreaterThan(c.indexOf("placeholder={isHebrew ? 'חיפוש לקוח"));
    expect(at).toBeLessThan(c.indexOf('opens/closes the mobile sort-options dropdown menu'));
    const d = src('./pages/Dashboard.jsx');
    expect(d).toContain('onExportClients={() => handleExportClients(filteredClients)}');
    expect(d).toContain("fileName: 'clients_report.xlsx'");
    expect(d).toContain("fileName: 'catalog_report.xlsx'");
  });
});
