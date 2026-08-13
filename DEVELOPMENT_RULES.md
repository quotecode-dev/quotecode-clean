# ProFlow SaaS - Strict Development Rules & Architecture Protocol

Please always remember and strictly apply the following ironclad rules in the ProFlow project:

1. **Absolute Separation of Languages and Currencies:**
   * **Israel Platform (Hebrew):** Interface, landing page, and content must be strictly in complete Hebrew (no other languages), and the currency must be strictly NIS (ILS - ₪).
   * **International Platform (English):** Interface, landing page, and content must be strictly in complete English (not a single Hebrew letter), and currencies must be strictly Dollar ($), Euro (€), and Pound (£).
   * **Modular Enforcement:** Every extracted component (such as `ClientsTab`, `FinancesTab`, `QuotesTab`, `QuoteForm`, and modals) must strictly inherit and respect the `isHebrew` and regional configuration rules.

2. **Documented System Backup (Mandatory after critical changes):**
   * Always after a critical change or update, a full cloud backup must be performed immediately.
   * **Backup Execution:** After a code update and once the user confirms the fix is satisfactory, you MUST offer to perform a full cloud backup and provide the Git commands (in a single line) ONLY after explicit approval.
   * <span style="color:red;"><b>UNDER NO CIRCUMSTANCES should a full backup be executed independently or automatically!</b></span>

3. **File Update & Review Protocol:**
   * Before updating or replacing any code file, you MUST ask me for the current existing file.
   * NEVER send or publish a code file without receiving explicit prior permission.
   * When providing an updated file, ALWAYS provide the complete file from start to finish (no partial code, placeholders, or omissions).
   * **Post-Update Protocol:** After sending the corrected code, you MUST wait for the user to verify the fix and confirm that it meets their satisfaction before proceeding.

4. **Git Commands:**
   * All Git commands must ALWAYS be provided in a single, connected line (separated by `;`) within a dedicated code block (e.g., `git add . ; git commit -m "..." ; git push origin main`).

5. **Design Component Isolation (CSS/UI):**
   * Perform pinpoint changes strictly on the specific element being addressed, WITHOUT modifying the overall structure of the container or surrounding components, to prevent layout breakage.

6. **Strict Preservation of Existing Code (Non-Destructive Updates):**
   * It is MANDATORY to ensure that all existing functions, buttons, logic, and components remain intact.
   * <span style="color:red;"><b>It is ABSOLUTELY FORBIDDEN to remove, delete, alter, or overwrite any existing feature</b></span> without explicit prior request and approval.

7. **Admin Notification & Counter Protocol:**
   * The "New Users (24H)" counter must reset to 0 in the UI as soon as the admin opens the new users list modal (tracked via `last_seen_new_users` in `localStorage`).
   * Resetting the counter must NOT hide or remove the actual list of users from the view; all users from the last 24 hours remain visible.

8. **Project File Map & Technical Glossary:**
   * `src/App.jsx` - Main router, initial language detection, and global modals.
   * `src/pages/Dashboard.jsx` - Central business management orchestrator.
   * `src/pages/LandingGlobal.jsx` - International landing page.
   * `src/pages/LandingLocal.jsx` - Local Israeli landing page.
   * `src/pages/PublicQuote.jsx` - Public quote view and digital signature screen.
   * `src/components/ClientsTab.jsx` - CRM and clients management.
   * `src/components/FinancesTab.jsx` - Finances, expenses management, and Recharts reports.
   * `src/components/QuotesTab.jsx` - Quotes history table and action dropdowns.
   * `src/components/QuoteForm.jsx` - Quote creation and editing form.
   * `src/components/PricingModal.jsx` - Subscription pricing and upgrade modal.
   * `src/components/EditClientModal.jsx` - Client details editing.
   * `src/components/EditExpenseModal.jsx` - Business expense editing.
   * `src/components/LifetimeConfirmModal.jsx` - Lifetime access confirmation.
   * `src/components/RegionConfirmModal.jsx` - Region change confirmation.
   * `src/components/UserDetailsModal.jsx` - Full user details review modal.
   * `src/components/EmailConfirmModal.jsx` - Quote email dispatch confirmation.
   * `src/components/ProFlowLogo.jsx` - Responsive logo.
   * `src/components/AccessibilityModal.jsx` - Accessibility controls.
   * `src/AIChatWidget.jsx` - AI assistant widget.
   * `src/supabase.js` - Supabase client configuration.