// The signed-in account summary for nested surfaces (style picker, creator, catalog) that open the one capability notice
// without prop-drilling. Provided by Dashboard from useAccountSummary; outside a provider the state is 'loading'
// (never a plan). openPlans opens the plans view; it never purchases.
import { createContext } from 'react';

export const AccountSummaryContext = createContext({ summary: { state: 'loading' }, openPlans: null });
