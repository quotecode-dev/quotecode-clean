// Task 16 (correction A): the landing stylesheet as a string, rendered as an inline <style> by LandingPage so the
// prerendered first paint (src/entry-prerender.jsx) is already styled.
import landingCss from './landing.css?raw';

export const LANDING_CSS = landingCss;
