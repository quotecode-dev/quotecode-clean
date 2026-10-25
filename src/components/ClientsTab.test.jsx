import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClientsTab from './ClientsTab';

// חוק ברזל (Clients Table Completion task, §7): בדיקות על ה-wiring של
// כפתורי-המיון העצמאיים (Name/Type) ועל מיקום התג - לוגיקת-המיון עצמה
// (compareClients) כבר מכוסה ב-clientSort.test.js; כאן נבדק רק ש-ClientsTab
// קורא ל-handleClientSort עם השדה הנכון ושמציג את האינדיקטור הנכון.

function mockDesktopMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

const baseClients = [
  { id: 'c1', company_name: 'Acme Corp', client_type: 'business', phone: '0501111111', email: null },
  { id: 'c2', company_name: 'Beta LLC', client_type: 'private', phone: null, email: 'beta@example.com' },
];

function renderClientsTab(props = {}) {
  return render(
    <ClientsTab
      filteredClients={baseClients}
      clientSearchTerm=""
      setClientSearchTerm={vi.fn()}
      clientSortField="company_name"
      clientSortDirection="asc"
      handleClientSort={vi.fn()}
      setEditingClient={vi.fn()}
      handleDeleteClient={vi.fn()}
      onCreateClient={vi.fn()}
      quotes={[]}
      isHebrew={false}
      currency="USD"
      {...props}
    />
  );
}

describe('ClientsTab - independent Name/Type sorting controls', () => {
  beforeEach(() => mockDesktopMatchMedia());

  it('renders separate Name and Type sort buttons', () => {
    renderClientsTab();
    expect(screen.getByText(/Company \/ Name/)).toBeInTheDocument();
    expect(screen.getByText(/^Type/)).toBeInTheDocument();
  });

  it('shows the sort indicator only on the currently active field', () => {
    renderClientsTab({ clientSortField: 'company_name', clientSortDirection: 'asc' });
    expect(screen.getByText('Company / Name ▲')).toBeInTheDocument();
    expect(screen.getByText(/^Type/).textContent.trim()).toBe('Type'); // no arrow appended
  });

  it('moves the indicator to Type when Type is the active field', () => {
    renderClientsTab({ clientSortField: 'client_type', clientSortDirection: 'desc' });
    expect(screen.getByText('Type ▼')).toBeInTheDocument();
    expect(screen.getByText(/Company \/ Name/).textContent.trim()).toBe('Company / Name');
  });

  it('clicking the Type header calls handleClientSort("client_type"), not the name field', () => {
    const handleClientSort = vi.fn();
    renderClientsTab({ handleClientSort });
    fireEvent.click(screen.getByText(/^Type/));
    expect(handleClientSort).toHaveBeenCalledWith('client_type');
  });

  it('clicking the Name header calls handleClientSort("company_name"), not the type field', () => {
    const handleClientSort = vi.fn();
    renderClientsTab({ handleClientSort });
    fireEvent.click(screen.getByText(/Company \/ Name/));
    expect(handleClientSort).toHaveBeenCalledWith('company_name');
  });
});

describe('ClientsTab - type badge placement (§D, preserved)', () => {
  beforeEach(() => mockDesktopMatchMedia());

  it('renders the type badge before the client name in DOM order (between chevron and name)', () => {
    renderClientsTab();
    const row = screen.getByText('Acme Corp').closest('button');
    const text = row.textContent;
    // "Business" (the badge label) must appear before "Acme Corp" in the
    // rendered text, proving DOM order [chevron, badge, name].
    expect(text.indexOf('Business')).toBeLessThan(text.indexOf('Acme Corp'));
  });

  it('does not render a badge for a client with an unknown/missing type, and the row still renders', () => {
    renderClientsTab({ filteredClients: [{ id: 'c3', company_name: 'No Type Co', client_type: null }] });
    expect(screen.getByText('No Type Co')).toBeInTheDocument();
    expect(screen.queryByText('Business')).toBeNull();
    expect(screen.queryByText('Private')).toBeNull();
  });
});

describe('ClientsTab - preserved behavior', () => {
  beforeEach(() => mockDesktopMatchMedia());

  it('search input still calls setClientSearchTerm', () => {
    const setClientSearchTerm = vi.fn();
    renderClientsTab({ setClientSearchTerm });
    fireEvent.change(screen.getByPlaceholderText('Search clients...'), { target: { value: 'Acme' } });
    expect(setClientSearchTerm).toHaveBeenCalledWith('Acme');
  });

  it('row expansion still works (accordion, single-open)', () => {
    renderClientsTab();
    const row = screen.getByText('Acme Corp').closest('button');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  it('New Client button still calls onCreateClient', () => {
    const onCreateClient = vi.fn();
    renderClientsTab({ onCreateClient });
    fireEvent.click(screen.getByText('New Client'));
    expect(onCreateClient).toHaveBeenCalled();
  });

  it('renders an empty state when filteredClients is empty', () => {
    renderClientsTab({ filteredClients: [] });
    expect(screen.getByText('No clients found.')).toBeInTheDocument();
  });
});
