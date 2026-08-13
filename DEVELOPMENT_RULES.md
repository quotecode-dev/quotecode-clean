# ProFlow SaaS - Strict Development Rules & Architecture Protocol

Please always remember and strictly apply the following ironclad rules in the ProFlow project:

1. **Absolute Separation of Languages and Currencies:**
   * **Israel Platform (Hebrew):** Interface, landing page, and content must be strictly in complete Hebrew (no other languages), and the currency must be strictly NIS (ILS - ₪).
   * **International Platform (English):** Interface, landing page, and content must be strictly in complete English (not a single Hebrew letter), and currencies must be strictly Dollar ($), Euro (€), and Pound (£).
   * **Modular Enforcement:** Every extracted component (such as `ClientsTab`, `FinancesTab`, `QuotesTab`, `QuoteForm`, and modals) must strictly inherit and respect the `isHebrew` and regional configuration rules.

2. **Documented System Backup (Mandatory after critical changes):**
   * Always after a critical change or update, a full cloud backup must be performed immediately, including code, rules, and documentation. A GitHub Tag must be created describing exactly the changes from the previous version (Format: `v[version]-[short_description]-full-backup`).
   * <span style="color:red;"><b>UNDER NO CIRCUMSTANCES should a full backup be executed independently or automatically!</b></span> After a system update, you must ONLY suggest a full cloud backup or wait for an explicit request. The backup must be executed ONLY after receiving explicit confirmation from the user.

3. **File Update Protocol:**
   * Before updating or replacing any code file, you MUST ask me for the current existing file.
   * NEVER send or publish a code file without receiving explicit prior permission from me.
   * When providing an updated file, ALWAYS provide the complete file from start to finish (no partial code, placeholders, or omissions).

4. **Git Commands:**
   * Always provide Git commands concentrated in a single line within a code block (e.g., `git add . ; git commit -m "..." ; git push origin main ; git tag ... ; git push origin ...`).

5. **Design Component Isolation (CSS/UI):**
   * When making design changes (like text alignment, CSS, or visual elements), perform pinpoint changes strictly on the specific element being addressed, WITHOUT modifying or touching the overall structure of the container or surrounding wrapper components, to prevent breaking the layout or functionality of other parts of the system.

6. **Strict Preservation of Existing Code & Features (Non-Destructive Updates):**
   * When updating, upgrading, or replacing any code file, it is MANDATORY to ensure that all existing functions, buttons, logic, and components that currently work in the system remain strictly in place and intact.
   * <span style="color:red;"><b>It is ABSOLUTELY FORBIDDEN to remove, delete, alter, or overwrite any existing feature, button, or code</b></span> without explicit prior request and approval from me.
   * In any addition or fix, the new code must integrate harmoniously alongside the existing code, maintaining 100% functionality of everything already developed and working in the system.

7. **Project File Map & Technical Glossary:**
   * `src/App.jsx` - Main router, initial language detection, and global modals (recovery/auth state).
   * `src/pages/Dashboard.jsx` - Central business management orchestrator (state management, Supabase queries, cached region).
   * `src/pages/LandingGlobal.jsx` - International landing page (strictly English, foreign currencies).
   * `src/pages/LandingLocal.jsx` - Local Israeli landing page (strictly Hebrew, ILS currency, 18% VAT).
   * `src/pages/PublicQuote.jsx` - Public quote view, digital client approval, and signature screen.
   * `src/pages/Contact.jsx` - Contact page component.
   * `src/pages/Privacy.jsx` - Privacy policy page component.
   * `src/pages/Terms.jsx` - Terms of service page component.
   * `src/components/ClientsTab.jsx` - CRM and clients management tab component.
   * `src/components/FinancesTab.jsx` - Finances, expenses management, and Recharts reports tab component.
   * `src/components/QuotesTab.jsx` - Central quotes history table and action dropdowns component with modern SVG icons.
   * `src/components/QuoteForm.jsx` - Central quote creation and editing form component.
   * `src/components/PricingModal.jsx` - Subscription pricing and upgrade modal.
   * `src/components/EditClientModal.jsx` - Client details editing modal.
   * `src/components/EditExpenseModal.jsx` - Business expense editing modal.
   * `src/components/LifetimeConfirmModal.jsx` - Super admin lifetime access confirmation modal.
   * `src/components/RegionConfirmModal.jsx` - Region/country change confirmation modal.
   * `src/components/UserDetailsModal.jsx` - Full user details review modal for super admins.
   * `src/components/EmailConfirmModal.jsx` - Quote email dispatch confirmation modal.
   * `src/components/ProFlowLogo.jsx` - Responsive logo component with directional support (RTL/LTR).
  <u>* `src/components/PublicQuoteHeader.jsx` - Business header component for public quote views.</u>
  <u>* `src/components/AccessibilityModal.jsx` - Accessibility controls modal.</u>
  <u>* `src/AIChatWidget.jsx` - AI assistant widget for user support.</u>
  <u>* `src/supabase.js` - Supabase client configuration and cloud connection.</u>