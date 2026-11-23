// Iron numeric / bidi rule (Owner 23/11 review of the simplify sketch): a size such as "120×150" keeps its left-to-right order inside a Hebrew
// sentence. In an RTL line the "×" between two numbers takes the line's direction and the size shows as "150×120"; an LTR isolate
// (U+2066 ... U+2069) around the size keeps it "120×150" everywhere the text is shown (editor rows, the customer page, the PDF).
const LRI = '⁦';
const PDI = '⁩';
const SIZE = /\d+(?:[.,]\d+)?\s*[×xX*]\s*\d+(?:[.,]\d+)?(?:\s*[×xX*]\s*\d+(?:[.,]\d+)?)?/g;
export function isolateSizes(text) {
  if (typeof text !== 'string' || !text) return text;
  const plain = text.split(LRI).join('').split(PDI).join('');
  return plain.replace(SIZE, (m) => `${LRI}${m}${PDI}`);
}
export const stripIsolates = (text) => (typeof text === 'string' ? text.split(LRI).join('').split(PDI).join('') : text);
