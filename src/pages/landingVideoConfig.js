// Single source of truth for the commercial-video release gate, shared by
// LandingLocal.jsx (HE) and LandingGlobal.jsx (EN) so both locales flip
// together and can never diverge into a mismatched release state.
// Isolated Landing Release Local Commit task: the Owner has explicitly
// re-approved the privacy-corrected English commercial after review, and
// the isolated Release Candidate previously passed 243/243 with this value
// enabled - flipped to true here as the committed release state.
export const VIDEOS_READY = true;
