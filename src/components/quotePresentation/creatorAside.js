// 2026-11-12 (unified quote, spec 1 row 4): the quote summary + save sit above the live preview when the preview is beside the form;
// QuoteCreatorLayout provides the slot element, QuoteForm renders its summary there (null = stay inline)
import { createContext } from 'react';

export const CreatorAsideContext = createContext(null);
