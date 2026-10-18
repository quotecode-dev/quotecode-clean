// Owner console 2026-10-18, typed: "להחזיר את כל מה ששונה ללא אישור שלי עכשיו!!!!!!" (docs/OWNER_LOST_BEHAVIOURS_2026-10-18.md #2):
// "show all" of the desktop quote list is remembered while the app is open (it no longer drops back to 4 after an edit / tab switch).
// A page reload starts compact again. The test setup resets it between tests.
let showAll = false;
export const getQuotesShowAll = () => showAll;
export const setQuotesShowAll = (value) => { showAll = !!value; };
export const resetQuotesListMemory = () => { showAll = false; };
