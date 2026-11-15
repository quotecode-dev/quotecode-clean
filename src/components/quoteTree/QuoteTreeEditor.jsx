// 2026-11-13 (Owner console, typed: "מאשר שינוי ב-L-05, L-08, L-09, L-13, L-15, L-16, L-17, L-19, L-23, L-24, L-25, L-26, L-27, L-28, L-29
// לביצוע האפיון מ-13/11 בשחרור אחד"; spec docs/MANUAL_QUOTE_IMPLEMENTATION_SPEC_2026-11-13.txt; demo structure-buttons-proposal.html of
// 13/11 - structure, flow and proportions; colours, fonts and components stay the system's): the work area of the manual quote.
//   - three equal structure buttons with a help circle; "כל ההצעה" + a button per top heading; back; add by kind; add inside a heading;
//   - a full "add work or product" form under EVERY open heading (and at the root), its target written out ("אל: דירה 22 ← סלון");
//   - read rows with one "פעולות" menu (edit in place / duplicate / remove + undo / up / down / move); no "× N" for a new heading;
//   - the quantity starts EMPTY; "מחיר גלובלי" = a fixed price for a row without a quantity; an empty price is not 0.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import './quoteTree.css';
import { buildQuoteItemFromEntry, rowEntry, isCountedMethod } from '../../utils/quoteItemEntry';
import { askConfirm } from '../AppDialog';
import { groupWord } from '../../utils/quoteGroups';
import { isUntouchedPlaceholderItem } from '../../utils/structuredQuoteItemPersistence';
import { parseQuantityInput, parsePriceInput } from '../../utils/itemPrice';
import { formatQuantity, getProfessionalUnitLabel, normalizeRepeatCount } from '../../utils/professionalQuoteItem';
import { childrenOf, topHeadings, pathOf, depthOf, itemIndicesOf, lineTotal, headingTotal, addHeadings, removeHeadingWithContent, duplicateHeading,
  duplicateNames, sortServices, parentOf, subtreeKeys, kindWord, MAX_DEPTH, firstSiblingOf, copyRowsFromFirst } from './treeModel';

const T = {
  he: {
    simple: 'הצעה פשוטה', grouped: 'לפי דירות', tiered: 'קומות, דירות וחדרים',
    helpSimple: 'כל מוצר או עבודה בשורה משלו. לדוגמה: חלון, צביעה והתקנה.',
    helpGrouped: 'לכל דירה, קומה, חדר או נושא כותרת נפרדת, ומתחתיה המוצרים שלה.',
    helpTiered: 'אפשר להוסיף חדרים בתוך דירה ודירות בתוך קומה. לדוגמה: קומה 10 ← דירה 22 ← חדר ילדים ← צביעה.',
    addInsidePre: '+ הוספת כותרת בתוך ', countMax: 'אפשר להוסיף עד 100 בכל פעם',
    catalogNoPrice: 'מוצר בלי מחיר לא נשמר בקטלוג. השורה נוספה להצעה.', catalogFail: 'השמירה בקטלוג נכשלה. השורה נוספה להצעה.',
    sizeIncomplete: 'השלימו את כל המידות או הסירו מידה ריקה.', pendingLeave: (p) => `בטופס "${p}" יש שורה שעוד לא נוספה. כדי לצאת בלי להוסיף אותה, לחצו שוב על החזרה.`,
    help: 'הסבר', whole: 'כל ההצעה', back: 'חזרה', backClient: 'חזרה לפרטי הלקוח', backWhole: 'חזרה לכל ההצעה', backTo: 'חזרה ל',
    addFirst: '+ הוספת דירה, קומה, חדר או נושא אחר', addOf: (w) => `+ הוספת ${w}`, addOther: '+ הוספת סוג אחר', addInside: (n) => `+ הוספת כותרת בתוך ${n}`,
    formTitle: 'מוסיפים עבודה או מוצר', to: 'אל:', product: 'חיפוש מוצר', pricing: 'חישוב', qty: 'כמות', price: 'מחיר ליחידה',
    // short placeholders (the label above names the field): never cut in a nested heading's narrower form, in either language
    productPh: 'בחרו מוצר מהקטלוג', newProduct: '+ הוספת מוצר חדש', add: 'הוספה', clear: 'ניקוי השורה', more: 'מידות ופירוט נוסף',
    lineSum: 'סכום השורה', notPriced: 'טרם תומחר', saveCatalog: 'לשמור גם בקטלוג', savedCatalog: 'נשמר גם בקטלוג', catalogDup: 'מוצר בשם הזה כבר קיים בקטלוג - לא נשמר שוב',
    units: { units: 'ליחידה', area: 'למ״ר', linear: 'למטר', areaFt: 'לרגל רבועה', linearFt: 'לרגל', hour: 'לשעה', day: 'ליום עבודה', kg: 'לק״ג', fixed: 'מחיר גלובלי' },
    qtyPh: { units: "מס' יחידות", area: 'שטח במ״ר', linear: 'אורך במטרים', areaFt: 'שטח ברגל רבועה', linearFt: 'אורך ברגל', hour: "מס' שעות", day: "מס' ימי עבודה", kg: 'משקל בק״ג' },
    pricePh: { units: 'מחיר ליחידה', area: 'מחיר למ״ר', linear: 'מחיר למטר', areaFt: 'מחיר לרגל רבועה', linearFt: 'מחיר לרגל', hour: 'מחיר לשעה', day: 'מחיר ליום עבודה', kg: 'מחיר לק״ג', fixed: 'מחיר גלובלי' },
    // the label of the price field follows the pricing (as in the demo's work page)
    priceOf: { units: 'מחיר ליחידה', area: 'מחיר למ״ר', linear: 'מחיר למטר', areaFt: 'מחיר לרגל רבועה', linearFt: 'מחיר לרגל', hour: 'מחיר לשעה', day: 'מחיר ליום עבודה', kg: 'מחיר לק״ג', fixed: 'מחיר גלובלי' },
    needName: 'כתבו מה עושים או איזה מוצר מוסיפים.', needQty: 'הקלידו כמות או מידות גדולות מאפס.', badPrice: 'המחיר צריך להיות אפס או יותר. אפשר להשאיר ריק לטיוטה.',
    catalogNote: 'שם המוצר, דרך החישוב והמחיר יישמרו לשימוש הבא. הכמות שייכת להצעה הזו.',
    known: { area: 'השטח כבר ידוע', linear: 'האורך כבר ידוע' }, byMeasures: 'לפי מידות', measureName: 'שם המידה (לא חובה)', measureNameHelp: 'למשל: קיר ליד החלון.',
    lengthOf: { m: 'אורך במטרים', ft: 'אורך ברגל' }, widthOf: { m: 'רוחב במטרים', ft: 'רוחב ברגל' }, lengthHelp: 'הקלידו אורך גדול מאפס.', widthHelp: 'האורך כפול הרוחב הם השטח.', removeMeasure: 'הסרת המידה',
    workDetails: 'פירוט לעבודה (לא חובה)', workDetailsHelp: 'למשל: צבע, דגם או מה כלול במחיר. הפרטים יופיעו ליד העבודה.',
    editFormTitle: 'עריכת המוצר', update: 'עדכון השורה', cancelEdit: 'ביטול העריכה', fixedSub: 'מחיר אחד לכל העבודה',
    msgAdded: 'השורה נוספה להצעה.', msgUpdated: 'השורה עודכנה.', msgCopied: 'נוסף עותק של העבודה.', msgRemoved: 'העבודה הוסרה. אפשר לבטל את הפעולה.',
    msgHeadingAdded: 'הכותרת נוספה. המוצרים הבאים יופיעו מתחתיה.', msgHeadingCopied: 'נוסף עותק עם אותם חדרים ועבודות.', msgHeadingDeleted: 'המקום הוסר עם התוכן שלו. אפשר לבטל את הפעולה.',
    msgNamesSaved: 'השם נשמר.', msgCopiedFirst: 'העבודות נוספו. התוכן שהיה כאן נשמר.', firstNoCopy: 'זה המקום הראשון ברשימה. פתחו מקום אחר כדי להעתיק אליו.', undoLast: 'ביטול הפעולה האחרונה',
    blockMove: 'השורה עדיין לא נוספה. לחצו ״הוספה״ או ״ניקוי השורה״ לפני המעבר.', blockNav: 'הוסיפו את השורה או נקו אותה לפני המעבר.',
    blockInside: 'הוסיפו את השורה או נקו אותה לפני הוספת חדר או כותרת.', blockStructure: 'הוסיפו את השורה או נקו אותה לפני החלפת המבנה.',
    blockOther: 'הוסיפו את השורה הנוכחית או נקו אותה לפני עבודה בדירה אחרת.', blockCopy: 'סיימו את השורה או נקו אותה לפני שכפול מוצר אחר.',
    unsaved: 'יש שינויים שטרם נשמרו. שמרו אותם, או לחצו ״חזרה ללא שמירה״.', countRange: 'הקלידו מספר שלם מ־1 עד 20.', needEachName: (one) => 'כתבו שם לכל ' + one + '.',
    namesDistinct: 'תנו לכל כותרת שם שונה, כדי שיהיה קל לזהות אותה.', pendingAsk: 'יש פרטים שטרם נוספו. השלימו אותם, או לחצו ״חזרה ללא שמירה״.',
    pending: (p) => `בטופס "${p}" יש שורה שעוד לא נוספה.`, goPending: 'מעבר אליה',
    sizes: 'מידות', sizeW: 'אורך', sizeH: 'רוחב', addSize: '+ מידה נוספת', details: 'פירוט ללקוח', detailLabel: 'שם הפרט, למשל צבע', detailValue: 'הערך, למשל לבן', addDetail: '+ פרט נוסף',
    colWork: 'העבודה / המוצר', colQty: 'כמות', colPrice: 'מחיר', colSum: 'סכום', actions: 'פעולות',
    editTitle: 'עריכת השורה', saveChanges: 'שמירת השינויים',
    edit: 'עריכה', duplicate: 'שכפול', remove: 'הסרה', up: 'למעלה', down: 'למטה', moveTo: 'העברה אל:', save: 'שמירה', cancel: 'ביטול',
    removed: 'השורה הוסרה', undo: 'ביטול ההסרה', headingRemoved: (n) => `"${n}" הוסר. מה שהיה בתוכו עבר לרמה שמעליו.`,
    hMenu: (n) => `פעולות ל${n}`, rename: 'שינוי שם', open: 'פתיחה', close: 'סגירה',
    kindQ: 'מה מוסיפים?', kinds: { floor: 'קומה', apartment: 'דירה', room: 'חדר', section: 'נושא בשם אחר' },
    countQ: (w) => `כמה ${w} להוסיף להצעה?`, countLabel: (w) => `מספר ה${w}`, countPh: (w) => `הקלידו את מספר ה${w}`, countErr: 'כתבו מספר שלם, 1 ומעלה',
    namesQ: 'מה השמות?', namesHint: 'שם או מספר, למשל דירה 32. ריק = שם לפי הסדר.', namesDup: 'יש כבר כותרת בשם הזה באותה רמה',
    next: 'המשך', create: 'הוספה להצעה', closeNoSave: 'חזרה ללא שמירה', plural: { floor: 'קומות', apartment: 'דירות', room: 'חדרים', section: 'נושאים' },
    unnamed: '(ללא שם)', saveTemplate: 'שמירה כתבנית', fromTemplate: 'מתבנית שמורה', example: 'הצגת דוגמה (לא נשמרת)',
    total: 'סה״כ לתשלום', summary: 'סיכום ההצעה', customer: 'כך הלקוח יראה', saveQuote: 'שמירת ההצעה',
    // the in-page steps of the 13/11 demo (add headings; the options of a heading)
    kindQRoot: 'מה מוסיפים להצעה?', kindQIn: 'מה מוסיפים בתוך ',
    countQIn: (w) => `כמה ${w} להוסיף בתוך `, countHelp: (one) => `זו הכמות שמוסיפים. את השם או המספר של כל ${one} מקלידים בשלב הבא. אפשר להוסיף גם אחד.`,
    countHint: (one) => `את השם או המספר של כל ${one} מקלידים בשלב הבא.`, toNamesBtn: 'להמשך',
    namesQOf: (kind, one) => (kind === 'section' ? 'איך לקרוא לכל נושא?' : `מה השם או המספר של כל ${one}?`),
    nameLabel: (kind, one) => (kind === 'section' ? 'שם הנושא' : `שם או מספר ה${one}`),
    nameHelp: 'השם ישמש ככותרת. המוצרים שתוסיפו יופיעו מתחתיה.',
    namePh: { room: 'למשל: חדר ילדים', floor: 'למשל: קומה 10', apartment: 'למשל: דירה 33', section: 'למשל: חצר, בניין או אזור קבלה' },
    optionsOf: 'אפשרויות ל', headName: (one) => `שם ה${one}`, headNameHelp: 'שינוי השם לא משנה את העבודות או המחירים.', saveName: 'שמירת השם', needHeadName: 'כתבו שם',
    dupOf: (one) => `שכפול ${one}`, copyFirstOf: (kind, one) => `העתקת עבודות מה${one} ${kind === 'room' || kind === 'section' ? 'הראשון' : 'הראשונה'}`,
    moveUp: 'הזזה למעלה', moveDown: 'הזזה למטה', deleteWith: (one) => `מחיקת ${one} עם התוכן`,
    deletedWith: (n) => `"${n}" נמחק עם כל התוכן.`, copiedFirst: (n) => `העבודות הועתקו מ"${n}".`,
    helpProduct: 'פתחו את הרשימה והתחילו להקליד שם מוצר כדי לאתר אותו. המוצרים מסודרים לפי א׳–ב׳. ״הוספת מוצר חדש״ נמצאת בראש הרשימה.',
    helpPricing: 'בחרו על מה משלמים: יחידות, שטח, אורך, זמן, משקל או מחיר לכל העבודה.',
    helpQty: 'הקלידו כמות גדולה מאפס. לדוגמה: 2 יחידות.', helpPrice: 'מחיר עבור דרך החישוב שבחרתם. ריק = טרם תומחר; 0 = מחיר אפס.',
    nameLabelN: (kind, one, num) => `${kind === 'section' ? 'שם הנושא' : `שם או מספר ה${one}`}${num ? ` ${num}` : ''}`,
  },
  en: {
    simple: 'Simple quote', grouped: 'By apartments', tiered: 'Floors, apartments, rooms',
    helpSimple: 'Each product or job on its own line. For example: a window, painting and installation.',
    helpGrouped: 'A separate heading for each apartment, floor, room or topic, with its products under it.',
    helpTiered: 'Add rooms inside an apartment and apartments inside a floor. For example: Floor 10 → Apartment 22 → Kids room → Painting.',
    addInsidePre: '+ Add a heading inside ', countMax: 'Up to 100 at a time',
    catalogNoPrice: 'A product without a price is not saved to the catalog. The row was added to the quote.', catalogFail: 'Saving to the catalog failed. The row was added to the quote.',
    sizeIncomplete: 'Complete all the sizes or remove an empty one.', pendingLeave: (p) => `The form "${p}" has a row that was not added yet. To leave without adding it, click back again.`,
    help: 'Explain', whole: 'Whole quote', back: 'Back', backClient: 'Back to client', backWhole: 'Back to the whole quote', backTo: 'Back to ',
    addFirst: '+ Add apartment, floor, room or topic', addOf: (w) => { const l = String(w || '').toLowerCase(); return `+ Add ${/^[aeiou]/.test(l) ? 'an' : 'a'} ${l}`; }, addOther: '+ Add another kind', addInside: (n) => `+ Add a heading inside ${n}`,
    formTitle: 'Add work or a product', to: 'To:', product: 'Product search', pricing: 'Pricing', qty: 'Quantity', price: 'Unit price',
    // English runs longer than the demo's Hebrew: short placeholders, never cut in a narrow field (the label above names the field)
    productPh: 'Choose from the catalog', newProduct: '+ Add a new product', add: 'Add', clear: 'Clear', more: 'Sizes and details',
    lineSum: 'Line total', notPriced: 'Not priced yet', saveCatalog: 'Also save to the catalog', savedCatalog: 'Saved to the catalog too', catalogDup: 'A product with this name is already in the catalog - not saved again',
    units: { units: 'Per unit', area: 'Per m²', linear: 'Per m', areaFt: 'Per sq ft', linearFt: 'Per ft', hour: 'Per hour', day: 'Per work day', kg: 'Per kg', fixed: 'Lump sum' },
    qtyPh: { units: 'Units', area: 'm²', linear: 'Metres', areaFt: 'Sq ft', linearFt: 'Feet', hour: 'Hours', day: 'Work days', kg: 'kg' },
    pricePh: { units: 'Unit price', area: 'Price/m²', linear: 'Price/metre', areaFt: 'Price/sq ft', linearFt: 'Price/foot', hour: 'Price/hour', day: 'Price/day', kg: 'Price/kg', fixed: 'Lump sum price' },
    priceOf: { units: 'Unit price', area: 'Price/m²', linear: 'Price/metre', areaFt: 'Price/sq ft', linearFt: 'Price/foot', hour: 'Price/hour', day: 'Price/work day', kg: 'Price/kg', fixed: 'Lump sum price' },
    needName: 'Write what is done or which product is added.', needQty: 'Type a quantity or sizes above zero.', badPrice: 'The price must be zero or more. You can leave it empty for a draft.',
    catalogNote: 'The product name, the pricing and the price are kept for next time. The quantity belongs to this quote.',
    known: { area: 'The area is known', linear: 'The length is known' }, byMeasures: 'By sizes', measureName: 'Size name (optional)', measureNameHelp: 'For example: the wall by the window.',
    lengthOf: { m: 'Length in metres', ft: 'Length in feet' }, widthOf: { m: 'Width in metres', ft: 'Width in feet' }, lengthHelp: 'Type a length above zero.', widthHelp: 'The length times the width is the area.', removeMeasure: 'Remove the size',
    workDetails: 'Work details (optional)', workDetailsHelp: 'For example: a colour, a model or what the price includes. The details appear next to the work.',
    editFormTitle: 'Edit the product', update: 'Update the row', cancelEdit: 'Cancel the edit', fixedSub: 'One price for the whole job',
    msgAdded: 'Row added to the quote.', msgUpdated: 'The row was updated.', msgCopied: 'A copy of the work was added.', msgRemoved: 'The work was removed. You can undo it.',
    msgHeadingAdded: 'The heading was added. The next products appear under it.', msgHeadingCopied: 'A copy with the same rooms and works was added.', msgHeadingDeleted: 'The place was removed with its content. You can undo it.',
    msgNamesSaved: 'The name was saved.', msgCopiedFirst: 'The works were added. What was here is kept.', firstNoCopy: 'This is the first place in the list. Open another place to copy into it.', undoLast: 'Undo last action',
    blockMove: 'The row was not added yet. Click "Add" or "Clear" before moving on.', blockNav: 'Add the row or clear it before moving on.',
    blockInside: 'Add the row or clear it before adding a room or a heading.', blockStructure: 'Add the row or clear it before changing the structure.',
    blockOther: 'Add the current row or clear it before working on another place.', blockCopy: 'Finish the row or clear it before duplicating another product.',
    unsaved: 'There are unsaved changes. Save them, or click "Back without saving".', countRange: 'Type a whole number from 1 to 20.', needEachName: (one) => 'Write a name for each ' + one + '.',
    namesDistinct: 'Give each heading a different name, so it is easy to tell apart.', pendingAsk: 'Some details were not added yet. Complete them, or click "Back without saving".',
    pending: (p) => `The form "${p}" has a row that was not added yet.`, goPending: 'Go to it',
    sizes: 'Sizes', sizeW: 'Length', sizeH: 'Width', addSize: '+ Another size', details: 'Details for the customer', detailLabel: 'Detail, e.g. Colour', detailValue: 'Value, e.g. White', addDetail: '+ Another detail',
    colWork: 'Work / product', colQty: 'Quantity', colPrice: 'Price', colSum: 'Total', actions: 'Actions',
    editTitle: 'Edit the row', saveChanges: 'Save the changes',
    edit: 'Edit', duplicate: 'Duplicate', remove: 'Remove', up: 'Up', down: 'Down', moveTo: 'Move to:', save: 'Save', cancel: 'Cancel',
    removed: 'The row was removed', undo: 'Undo', headingRemoved: (n) => `"${n}" was removed. What was inside it moved one level up.`,
    hMenu: (n) => `Actions for ${n}`, rename: 'Rename', open: 'Open', close: 'Close',
    kindQ: 'What are you adding?', kinds: { floor: 'Floor', apartment: 'Apartment', room: 'Room', section: 'Other topic' },
    countQ: (w) => `How many ${w} to add to the quote?`, countLabel: (w) => `Number of ${w}`, countPh: (w) => `Type the number of ${w}`, countErr: 'Type a whole number, 1 or more',
    namesQ: 'What are they called?', namesHint: 'A name or a number, e.g. Apartment 32. Empty = a name in order.', namesDup: 'A heading with this name is already at this level',
    next: 'Continue', create: 'Add to the quote', closeNoSave: 'Back without saving', plural: { floor: 'floors', apartment: 'apartments', room: 'rooms', section: 'topics' },
    unnamed: '(unnamed)', saveTemplate: 'Save as a template', fromTemplate: 'From a template', example: 'Show an example (not saved)',
    total: 'Total to pay', summary: 'Quote summary', customer: 'Client view', saveQuote: 'Save the quote',
    kindQRoot: 'What goes in the quote?', kindQIn: 'What are you adding inside ',
    countQIn: (w) => `How many ${w} to add inside `, countHelp: (one) => `This is how many you add. You type the name or number of each ${one} in the next step. You can add just one.`,
    countHint: (one) => `You type the name or number of each ${one} in the next step.`, toNamesBtn: 'Continue',
    namesQOf: (kind, one) => (kind === 'section' ? 'What is each topic called?' : `What is the name or number of each ${one}?`),
    nameLabel: (kind, one) => (kind === 'section' ? 'Topic name' : `Name or number of the ${one}`),
    nameHelp: 'The name becomes a heading. The products you add appear under it.',
    namePh: { room: 'e.g. Kids room', floor: 'e.g. Floor 10', apartment: 'e.g. Apartment 33', section: 'e.g. Yard, building or reception' },
    optionsOf: 'Options for ', headName: (one) => `${one.charAt(0).toUpperCase()}${one.slice(1)} name`, headNameHelp: 'Renaming does not change the works or the prices.', saveName: 'Save the name', needHeadName: 'Type a name',
    dupOf: (one) => `Duplicate the ${one}`, copyFirstOf: (kind, one) => `Copy the works from the first ${one}`,
    moveUp: 'Move up', moveDown: 'Move down', deleteWith: (one) => `Delete the ${one} with its content`,
    deletedWith: (n) => `"${n}" was deleted with all its content.`, copiedFirst: (n) => `The works were copied from "${n}".`,
    helpProduct: 'Open the list and start typing a product name to find it. Products are in A–Z order. "+ Add a new product" is at the top of the list.',
    helpPricing: 'Choose what is paid for: units, area, length, time, weight or one price for the whole job.',
    helpQty: 'Type a quantity above zero. For example: 2 units.', helpPrice: 'The price for the pricing you chose. Empty = not priced yet; 0 = a zero price.',
    nameLabelN: (kind, one, num) => (kind === 'section' ? `Topic name${num ? ` ${num}` : ''}` : `${one.charAt(0).toUpperCase()}${one.slice(1)}${num ? ` ${num}` : ''} - name or number`),
  },
};
const METHODS = ['units', 'area', 'linear', 'hour', 'day', 'kg', 'fixed'];
// Owner 2026-11-05 (feet for the international market, metres stay available): an international account measures area / length in feet
// ("area" / "linear") and may still choose metres ("area_m" / "linear_m"); a local account measures in metres only
const METHODS_INTL = ['units', 'area', 'linear', 'area_m', 'linear_m', 'hour', 'day', 'kg', 'fixed'];
const COUNTED = ['units', 'hour', 'day', 'kg'];
const baseMethod = (m) => (m === 'area_m' ? 'area' : m === 'linear_m' ? 'linear' : m);
const isFeetMethod = (m, international) => Boolean(international) && (m === 'area' || m === 'linear');
/** the copy key of a method in its market: the feet keys for an international area / length, the metric keys otherwise */
const copyKey = (m, international) => (isFeetMethod(m, international) ? `${m}Ft` : baseMethod(m));
const methodOfBasis = (basis, international) => ({ unit: 'units', m2: international ? 'area_m' : 'area', sq_ft: 'area', linear_meter: international ? 'linear_m' : 'linear', linear_ft: 'linear', hour: 'hour', day: 'day', kg: 'kg', fixed: 'fixed' }[basis]);
const keyOf = (s) => s && (s.key ?? s.id);
const N = (v) => <bdi dir="ltr" className="pf-num">{v}</bdi>;
function PathText({ names, isHebrew }) {
  return <span dir={isHebrew ? 'rtl' : 'ltr'}>{names.map((n, i) => <Fragment key={i}>{i ? (isHebrew ? ' ← ' : ' → ') : ''}<bdi>{n}</bdi></Fragment>)}</span>;
}
/** Enter in a text field of the work area never submits the quote form around it */
const enterInField = (e) => e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox';

export function HelpCircle({ text, label, inline = false, testId = 'qt-help' }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || focus || pinned;
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeAll = () => { setHover(false); setFocus(false); setPinned(false); };
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) closeAll(); };
    const esc = (e) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  const toggle = () => { if (pinned) { setPinned(false); setHover(false); setFocus(false); } else setPinned(true); };
  return (
    <span ref={ref} className={inline ? 'qt-help-wrap' : undefined} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* PRODUCT_TRUTH_DECORATIVE: the help circle of a structure button - explains it, never chooses it */}
      <span role="button" tabIndex={0} className={inline ? 'qt-help qt-help--inline' : 'qt-help'} aria-label={label} aria-expanded={open} data-testid={testId}
        onClick={(e) => { e.stopPropagation(); toggle(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(); } }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}><span aria-hidden="true">?</span></span>
      {open && <span role="tooltip" className="qt-pop" data-testid="qt-help-pop">{text}</span>}
    </span>
  );
}

function CatalogField({ id, value, onText, onPick, onNew, services, t, isHebrew, sym, fmtMoney, inputRef, international = false }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const wrap = useRef(null);
  const all = useMemo(() => sortServices(services, isHebrew), [services, isHebrew]);
  const q = typed ? String(value || '').trim().toLowerCase() : '';
  const list = q ? all.filter((s) => String(s.name || '').toLowerCase().includes(q)) : all;
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, [open]);
  return (
    <div ref={wrap} className="qt-catalog">
      {/* PRODUCT_TRUTH_DECORATIVE: the product search field - typing or a click opens the catalog list; nothing is added until Add */}
      <input ref={inputRef} id={id} className="qt-input" value={value} placeholder={t.productPh} autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${id}-list`}
        // the list opens on a click, a key or typing - never by itself when the cursor comes back to the field after "Add"
        onFocus={() => setTyped(false)} onClick={() => setOpen(true)} onChange={(e) => { onText(e.target.value); setTyped(true); setOpen(true); }}
        // the cursor moving on to another field (quantity, price, pricing) closes the list - it never stays over the fields and the Add below it
        onBlur={(e) => { const to = e.relatedTarget; if (to && wrap.current && !wrap.current.contains(to)) setOpen(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Tab') setOpen(false); if (e.key === 'ArrowDown') setOpen(true); }} />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="qt-catalog-list" data-testid="qt-catalog-list">
          <li role="option" aria-selected="false">{/* PRODUCT_TRUTH_DECORATIVE: a new product - the name typed stays, the catalog is not changed until "also save to the catalog" and Add */}<button type="button" className="qt-catalog-new" onClick={() => { setOpen(false); onNew(); }}>{t.newProduct}</button></li>
          {list.map((s) => (
            <li key={s.id} role="option" aria-selected="false">
              {/* PRODUCT_TRUTH_DECORATIVE: picks a catalog product into the add form (name, price, pricing) - nothing is added until Add */}
              <button type="button" onClick={() => { setOpen(false); onPick(s); }}>
                <span>{s.name}</span>{s.price != null && s.price !== '' && <span className="qt-catalog-price"><span className="pf-money">{sym}{fmtMoney(Number(s.price))}</span> {t.units[copyKey(methodOfBasis(s.price_basis, international) || 'units', international)]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const emptyForm = (method = 'units') => ({ name: '', method, qty: '', price: '', catalogId: null, known: true, sizes: [{ name: '', w: '', h: '' }], details: '', more: false, toCatalog: false, isNew: false, error: '', note: '' });

/** 2026-11-15 (the demo's edit in place): the add form filled from a row - the row's own entry (rowEntry: the same reading as the row editor) */
function formFromItem(item, international) {
  const e = rowEntry(item, international);
  let method = e.pricingMethod;
  if (international && (method === 'area' || method === 'linear') && e.measureUnit === 'm') method = method === 'area' ? 'area_m' : 'linear_m';
  const meas = Array.isArray(item.measurements) ? item.measurements : [];
  const sizes = [{ w: e.widthCm, h: e.heightCm, name: meas[0]?.label || '' }, ...(e.extraMeasureRows || []).map((r, i) => ({ w: r.widthCm, h: r.heightCm, name: r.label || meas[i + 1]?.label || '' }))]
    .filter((z) => String(z.w ?? '').trim() !== '').map((z) => ({ name: String(z.name || ''), w: String(z.w ?? ''), h: String(z.h ?? '') }));
  const measured = baseMethod(method) === 'area' || baseMethod(method) === 'linear';
  const known = !measured || Boolean(e.useManualQty) || !sizes.length;
  const qty = measured ? (e.useManualQty ? e.manualQty : '') : (method === 'fixed' ? '' : e.quantity);
  const details = (e.specRows || []).map((r) => (r.label && r.value ? `${r.label}: ${r.value}` : (r.value || r.label || ''))).filter(Boolean).join('\n');
  return { ...emptyForm(method), name: String(e.description || ''), qty: String(qty ?? ''), price: e.unitPrice == null ? '' : String(e.unitPrice), known,
    sizes: sizes.length ? sizes : [{ name: '', w: '', h: '' }], details, more: Boolean(details) || (measured && !known) };
}

/** the demo's add form ("מוסיפים עבודה או מוצר"): the same form edits a row in place ("עריכת המוצר" / "עדכון השורה" / "ביטול העריכה") */
function AddForm({ formKey, targetKey, sections, isHebrew, international, services, sym, fmtMoney, onAdd, onSaveToCatalog, onPending, focusRef, recommendedMethod,
  editItem = null, onUpdate = null, onCancelEdit = null, guard = null, canUseMeasured = true, onMeasuredLocked = null }) {
  const t = T[isHebrew ? 'he' : 'en'];
  const methods = international ? METHODS_INTL : METHODS;
  const [f, setF] = useState(() => (editItem ? formFromItem(editItem, international) : emptyForm(methods.includes(recommendedMethod) ? recommendedMethod : 'units')));
  const base = baseMethod(f.method);
  const ck = copyKey(f.method, international);
  const set = (patch) => setF((p) => ({ ...p, ...patch, error: '' }));
  const nameRef = useRef(null);
  const qtyRef = useRef(null);
  const id = `qt-f-${String(formKey).replace(/[^a-z0-9_-]/gi, '')}`;
  const pathNames = pathOf(sections, targetKey).map((s) => s.name);
  const toText = targetKey ? pathNames.join(isHebrew ? ' ← ' : ' → ') : t.whole;
  const measured = base === 'area' || base === 'linear';
  // the demo's "pending": a name, a price, details, sizes, or (not a global price) a quantity - or any edit in place
  const dirty = Boolean(editItem) || Boolean(String(f.name).trim() || String(f.price).trim() || String(f.details).trim() || (f.method !== 'fixed' && String(f.qty).trim())
    || (measured && !f.known && f.sizes.some((z) => String(z.w).trim() || String(z.h).trim() || String(z.name).trim())));
  useEffect(() => { onPending(formKey, dirty ? toText : null); }, [dirty, formKey, toText]); // eslint-disable-line react-hooks/exhaustive-deps
  // a form that leaves the page (its heading removed) leaves no "row not added yet" behind
  useEffect(() => () => onPending(formKey, null), [formKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusRef) focusRef.current = () => nameRef.current?.focus(); }, [focusRef]);
  const measureUnit = isFeetMethod(f.method, international) ? 'ft' : 'm';
  const fullSize = (z) => String(z.w).trim() && (base === 'linear' || String(z.h).trim());
  const anySize = (z) => String(z.w).trim() || String(z.h).trim();
  const sizes = measured && !f.known ? f.sizes.filter(fullSize) : [];
  const qp = parseQuantityInput(String(f.qty));
  const qtyNum = qp.ok ? qp.value : NaN;
  const pp = parsePriceInput(String(f.price));
  const priceNum = pp.ok && pp.value !== '' ? Number(pp.value) : null; // '' = an empty price (missing), never 0
  const sizeQty = sizes.length ? sizes.reduce((n, z) => n + (base === 'area' ? (Number(z.w) || 0) * (Number(z.h) || 0) : (Number(z.w) || 0)), 0) : null;
  const effQty = f.method === 'fixed' ? 1 : (measured && !f.known ? sizeQty : qtyNum);
  const lineSum = priceNum != null && Number.isFinite(priceNum) && Number.isFinite(effQty) && effQty > 0 ? effQty * priceNum : (f.method === 'fixed' && priceNum != null ? priceNum : null);
  // a billing change of a saved row is asked first (restore item 03); measured pricing needs the professional entitlement (as the row editor)
  const askBasisChange = () => askConfirm(isHebrew ? 'אופן החיוב ישתנה. בדקו את הכמות והזינו מחיר לבסיס החדש.' : 'The billing method will change. Review the quantity and enter a price for the new unit.', isHebrew,
    { yes: isHebrew ? 'שינוי אופן חיוב' : 'Change billing method', no: isHebrew ? 'שמירת אופן החיוב הקיים' : 'Keep current billing method' });
  const changeMethod = async (m) => {
    if (m === f.method) return;
    const mb = baseMethod(m);
    if ((mb === 'area' || mb === 'linear') && canUseMeasured === false) { onMeasuredLocked?.(); return; }
    if (editItem && (editItem.id || editItem.price_link_id || String(f.price).trim()) && !(await askBasisChange())) return;
    // the demo: another pricing clears the quantity, the price and the size mode
    set({ method: m, qty: '', price: '', known: true, sizes: [{ name: '', w: '', h: '' }] });
  };
  const pick = (s) => {
    const m = methodOfBasis(s.price_basis, international) || 'units';
    const mb = baseMethod(m);
    if ((mb === 'area' || mb === 'linear') && canUseMeasured === false) { onMeasuredLocked?.(); return; }
    set({ name: String(s.name || ''), catalogId: String(s.id), price: s.price == null ? '' : String(s.price), method: m, qty: '', known: true, sizes: [{ name: '', w: '', h: '' }], isNew: false, toCatalog: false });
    // the demo: picking a product moves the cursor on to its quantity
    setTimeout(() => qtyRef.current?.focus(), 0);
  };
  const clearForm = () => {
    if (editItem) { onCancelEdit?.(); return; }
    setF(emptyForm(f.method));
  };
  const submit = async () => {
    if (typeof guard === 'function' && guard(formKey)) return;
    const name = String(f.name).trim();
    if (!name) { setF((p) => ({ ...p, error: t.needName })); nameRef.current?.focus(); return; }
    if (measured && !f.known && f.sizes.some((z) => anySize(z) && !fullSize(z))) { setF((p) => ({ ...p, error: t.sizeIncomplete })); return; }
    if (f.method !== 'fixed' && !(effQty > 0)) { setF((p) => ({ ...p, error: t.needQty })); return; }
    if (!pp.ok || (priceNum != null && priceNum < 0)) { setF((p) => ({ ...p, error: t.badPrice })); return; }
    const text = String(f.details).trim();
    const original = editItem ? formFromItem(editItem, international) : null;
    const specRows = text ? (original && original.details === f.details && Array.isArray(editItem.specification) ? editItem.specification.map((r) => ({ label: r.label || '', value: r.value || '' })) : [{ label: '', value: text }]) : [];
    const entry = {
      pricingMethod: base, description: name, unitPrice: priceNum == null ? '' : String(priceNum), catalogServiceId: f.catalogId, sectionKey: editItem ? (editItem.section_key ?? null) : (targetKey || null),
      quantity: COUNTED.includes(f.method) ? String(qtyNum) : '1', measureUnit,
      useManualQty: measured && f.known, manualQty: measured && f.known ? String(qtyNum) : '',
      widthCm: sizes[0]?.w ?? '', heightCm: base === 'linear' ? '1' : (sizes[0]?.h ?? ''),
      extraMeasureRows: sizes.slice(1).map((z) => ({ widthCm: z.w, heightCm: base === 'linear' ? '1' : z.h, label: z.name || '' })),
      specRows,
    };
    if (editItem) {
      // the row editor's commit rules (restore items 03-05 / item 08 / stage 3 / G8): the same row, its id, its shared-price link, its review mark
      const now = rowEntry(editItem, international);
      const conversionConfirmed = entry.pricingMethod !== now.pricingMethod || Boolean(entry.useManualQty) !== Boolean(now.useManualQty);
      const built = buildQuoteItemFromEntry({ ...entry, editingItem: editItem, isEditMode: true, conversionConfirmed });
      if (!conversionConfirmed && isCountedMethod(f.method) && String(qtyNum) === String(now.quantity) && editItem.quantity !== undefined) built.quantity = editItem.quantity;
      if (f.method === 'fixed' || f.method === 'units') built._billing = f.method;
      if (editItem.price_link_id && entry.pricingMethod === now.pricingMethod && (built.pricing_unit || null) === (editItem.pricing_unit || null)) built.price_link_id = editItem.price_link_id;
      if (editItem._review) built._review = true;
      if (editItem._noUnit && entry.pricingMethod === now.pricingMethod) built._noUnit = true;
      if (Array.isArray(built.measurements) && built.measurements[0] && sizes[0]) built.measurements[0] = { ...built.measurements[0], label: sizes[0].name || '' };
      onUpdate?.(built);
      return;
    }
    const item = { ...buildQuoteItemFromEntry(entry), ...(f.method === 'fixed' || f.method === 'units' ? { _billing: f.method } : {}) };
    if (Array.isArray(item.measurements) && item.measurements[0] && sizes[0]) item.measurements[0] = { ...item.measurements[0], label: sizes[0].name || '' };
    onAdd(item, f.catalogId);
    const toCatalog = f.toCatalog && f.isNew && typeof onSaveToCatalog === 'function';
    // the form is ready for the next row at once (a second click never adds the same row twice); the catalog answer comes after
    setF(emptyForm(f.method));
    if (!toCatalog) return;
    if (priceNum == null) { setF((p) => ({ ...p, note: t.catalogNoPrice })); return; }
    let note = t.catalogFail;
    try {
      const r = await onSaveToCatalog({ name, price: priceNum, method: base, international: isFeetMethod(f.method, international) });
      note = r && r.ok ? t.savedCatalog : (r && r.duplicate ? t.catalogDup : t.catalogFail);
    } catch { note = t.catalogFail; }
    setF((p) => ({ ...p, note }));
  };
  const typedNew = f.isNew && String(f.name).trim() && !services.some((s) => String(s.name || '').trim().toLowerCase() === String(f.name).trim().toLowerCase());
  return (
    <div className={`qt-form${editItem ? ' qt-form--edit' : ''}`} data-testid={editItem ? 'qt-edit-form' : 'qt-form'} data-target={targetKey || 'root'} id={id}
      // the demo: working in another place's form while a row is still pending there is blocked (the value is not taken)
      onPointerDownCapture={(e) => { if (typeof guard === 'function' && guard(formKey, true)) { e.preventDefault(); e.stopPropagation(); } }}
      onFocusCapture={(e) => { if (typeof guard === 'function' && guard(formKey, true)) { e.target.blur?.(); } }}>
      <div className="qt-form-head">
        <h4 className="qt-form-title">{editItem ? t.editFormTitle : t.formTitle}</h4>
        <span className="qt-to" data-testid="qt-form-to">{t.to} {targetKey ? <PathText names={pathNames} isHebrew={isHebrew} /> : t.whole}</span>
      </div>
      <div className={`qt-grid${f.method === 'fixed' || (measured && !f.known) ? ' qt-grid--noqty' : ''}`}>
        <div className="qt-field qt-field--product">
          <div className="qt-label"><label htmlFor={`${id}-name`}>{t.product}</label><HelpCircle inline text={t.helpProduct} label={`${t.help}: ${t.product}`} testId="qt-help-product" /></div>
          <CatalogField id={`${id}-name`} inputRef={nameRef} value={f.name} services={services} t={t} isHebrew={isHebrew} sym={sym} fmtMoney={fmtMoney} international={international}
            onText={(v) => set({ name: v, catalogId: null, isNew: true })} onPick={pick} onNew={() => { set({ name: '', catalogId: null, isNew: true, qty: '', price: '' }); setTimeout(() => nameRef.current?.focus(), 0); }} />
        </div>
        <div className="qt-field qt-field--unit">
          <div className="qt-label"><label htmlFor={`${id}-unit`}>{t.pricing}</label><HelpCircle inline text={t.helpPricing} label={`${t.help}: ${t.pricing}`} testId="qt-help-pricing" /></div>
          <select id={`${id}-unit`} className="qt-select" value={f.method} onChange={(e) => changeMethod(e.target.value)}>
            {methods.map((m) => <option key={m} value={m}>{t.units[copyKey(m, international)]}</option>)}
          </select>
        </div>
        {f.method !== 'fixed' && !(measured && !f.known) && (
          <div className="qt-field qt-field--qty">
            <div className="qt-label"><label htmlFor={`${id}-qty`}>{t.qty}</label><HelpCircle inline text={t.helpQty} label={`${t.help}: ${t.qty}`} testId="qt-help-qty" /></div>
            <input ref={qtyRef} id={`${id}-qty`} className="qt-input pf-num" inputMode="decimal" dir="ltr" value={f.qty} placeholder={t.qtyPh[ck]} onChange={(e) => set({ qty: e.target.value })} />
          </div>
        )}
        <div className="qt-field qt-field--price">
          <div className="qt-label"><label htmlFor={`${id}-price`}>{t.priceOf[ck]}</label><HelpCircle inline text={t.helpPrice} label={`${t.help}: ${t.priceOf[ck]}`} testId="qt-help-price" /></div>
          <input id={`${id}-price`} className="qt-input pf-num" inputMode="decimal" dir="ltr" value={f.price} placeholder={t.pricePh[ck]} onChange={(e) => set({ price: e.target.value })} />
        </div>
        {/* PRODUCT_TRUTH_DECORATIVE: adds the row to the place this form belongs to (never to another one); in an edit, updates the same row */}
        <button type="button" className="qt-add" data-testid={editItem ? 'qt-edit-save' : 'qt-add'} onClick={submit}>{editItem ? t.update : t.add}</button>
      </div>
      {typedNew && !editItem && (
        <div className="qt-catalog-line">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '32px' }}>
            <input type="checkbox" checked={f.toCatalog} onChange={(e) => set({ toCatalog: e.target.checked })} /> {t.saveCatalog}
          </label>
          <small>{t.catalogNote}</small>
        </div>
      )}
      {f.error && <div className="qt-note" role="alert" data-testid="qt-form-error">{f.error}</div>}
      {f.note && <div role="status" style={{ fontSize: '0.8rem', color: '#0F6672', fontWeight: 600 }}>{f.note}</div>}
      <div className="qt-tools">
        {/* PRODUCT_TRUTH_DECORATIVE: clears this form only - in an edit, the row stays exactly as it was */}
        <button type="button" className="qt-link qt-tools-clear" data-testid={editItem ? 'qt-edit-cancel' : 'qt-clear'} onClick={clearForm}>{editItem ? t.cancelEdit : t.clear}</button>
        {/* PRODUCT_TRUTH_DECORATIVE: opens the sizes and the work details of this form (its open state is kept) */}
        {!f.more && <button type="button" className="qt-link qt-tools-more" aria-expanded={false} onClick={() => set({ more: true })}>{t.more}</button>}
        <span className="qt-tools-sum">{t.lineSum}: {lineSum == null ? <strong className="qt-missing">{t.notPriced}</strong> : <strong className="pf-money">{sym}{fmtMoney(lineSum)}</strong>}</span>
      </div>
      {f.more && (
        <div className="qt-more-body">
          {/* the demo: the open disclosure moves under a line and its title stays its toggle (a click closes it; what was typed is kept) */}
          {/* PRODUCT_TRUTH_DECORATIVE: closes the sizes and the work details of this form (its values are kept) */}
          <button type="button" className="qt-more-title" aria-expanded onClick={() => set({ more: false })}>{t.more}</button>
          {measured && (
            <div className="qt-measure">
              <div className="qt-toggle" role="group">
                {/* PRODUCT_TRUTH_DECORATIVE: the known total (area / length) - one quantity */}
                <button type="button" className="qt-chip" aria-pressed={f.known} onClick={() => set({ known: true })}>{t.known[base]}</button>
                {/* PRODUCT_TRUTH_DECORATIVE: by sizes - the quantity is the sum of the sizes */}
                <button type="button" className="qt-chip" aria-pressed={!f.known} onClick={() => set({ known: false })}>{t.byMeasures}</button>
              </div>
              {!f.known && f.sizes.map((z, i) => (
                <div key={i} className="qt-measure-row">
                  <div className="qt-field">
                    <div className="qt-label"><label htmlFor={`${id}-mn-${i}`}>{t.measureName}</label><HelpCircle inline text={t.measureNameHelp} label={`${t.help}: ${t.measureName}`} testId="qt-help-mname" /></div>
                    <input id={`${id}-mn-${i}`} className="qt-input" value={z.name} onChange={(e) => set({ sizes: f.sizes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  </div>
                  <div className="qt-field">
                    <div className="qt-label"><label htmlFor={`${id}-mw-${i}`}>{t.lengthOf[measureUnit]}</label><HelpCircle inline text={t.lengthHelp} label={`${t.help}: ${t.lengthOf[measureUnit]}`} testId="qt-help-mlen" /></div>
                    <input id={`${id}-mw-${i}`} className="qt-input pf-num" inputMode="decimal" dir="ltr" aria-label={`${t.sizeW} ${i + 1}`} value={z.w} onChange={(e) => set({ sizes: f.sizes.map((x, j) => (j === i ? { ...x, w: e.target.value } : x)) })} />
                  </div>
                  {base === 'area' && (
                    <div className="qt-field">
                      <div className="qt-label"><label htmlFor={`${id}-mh-${i}`}>{t.widthOf[measureUnit]}</label><HelpCircle inline text={t.widthHelp} label={`${t.help}: ${t.widthOf[measureUnit]}`} testId="qt-help-mwid" /></div>
                      <input id={`${id}-mh-${i}`} className="qt-input pf-num" inputMode="decimal" dir="ltr" aria-label={`${t.sizeH} ${i + 1}`} value={z.h} onChange={(e) => set({ sizes: f.sizes.map((x, j) => (j === i ? { ...x, h: e.target.value } : x)) })} />
                    </div>
                  )}
                  {/* PRODUCT_TRUTH_DECORATIVE: removes this size of the form */}
                  {f.sizes.length > 1 && <button type="button" className="qt-link" onClick={() => set({ sizes: f.sizes.filter((_, j) => j !== i) })}>{t.removeMeasure}</button>}
                </div>
              ))}
              {/* PRODUCT_TRUTH_DECORATIVE: one more size of this form */}
              {!f.known && <button type="button" className="qt-link" style={{ alignSelf: 'flex-start' }} onClick={() => set({ sizes: [...f.sizes, { name: '', w: '', h: '' }] })}>{t.addSize}</button>}
            </div>
          )}
          <div className="qt-field">
            <div className="qt-label"><label htmlFor={`${id}-details`}>{t.workDetails}</label><HelpCircle inline text={t.workDetailsHelp} label={`${t.help}: ${t.workDetails}`} testId="qt-help-details" /></div>
            <textarea id={`${id}-details`} className="qt-input qt-textarea" rows={4} value={f.details} onChange={(e) => set({ details: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}

function RowMenu({ t, onEdit, onDuplicate, onRemove }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    // Escape closes the menu and returns the focus to its button
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* PRODUCT_TRUTH_DECORATIVE: the one actions menu of a row */}
      <button ref={btnRef} type="button" className="qt-menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={t.actions} data-testid="qt-row-actions" onClick={() => setOpen((v) => !v)}>
        {/* Owner 2026-11-10 (G6b "ב"): desktop and tablet show the word, a phone the three dots of the row */}
        <span className="qt-menu-text">{t.actions}</span><span className="qt-menu-dots" aria-hidden="true">⋯</span>
      </button>
      {open && (
        <ul role="menu" className="qt-menu">
          <li role="none">{/* PRODUCT_TRUTH_DECORATIVE: opens the row for editing in place (save / cancel) */}<button type="button" role="menuitem" onClick={run(onEdit)}>{t.edit}</button></li>
          <li role="none">{/* PRODUCT_TRUTH_DECORATIVE: duplicates the row (or the heading with everything under it) right after it */}<button type="button" role="menuitem" onClick={run(onDuplicate)}>{t.duplicate}</button></li>
          {onRemove && <li role="none">{/* PRODUCT_TRUTH_DECORATIVE: removes - with undo; a heading's content moves one level up */}<button type="button" role="menuitem" onClick={run(onRemove)} style={{ color: '#b91c1c' }}>{t.remove}</button></li>}
        </ul>
      )}
    </span>
  );
}

/** the frame of an in-page step (the 13/11 demo): "→ חזרה" on top, the question as a title, the card, then "חזרה ללא שמירה" */
function PageFrame({ t, isHebrew, title, onBack, onClose, children, testId, error = '' }) {
  const top = useRef(null);
  useEffect(() => { top.current?.scrollIntoView?.({ block: 'start' }); top.current?.focus?.({ preventScroll: true }); }, []);
  return (
    <div className="qt-page" data-testid={testId} dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* PRODUCT_TRUTH_DECORATIVE: back one step of this page (what was typed is remembered) */}
      <button type="button" className="qt-link qt-page-back" data-testid="qt-page-back" onClick={onBack}>{isHebrew ? '→ ' : '← '}{t.back}</button>
      {error && <div className="qt-note" role="alert" data-testid="qt-page-error">{error}</div>}
      <h3 className="qt-page-title" ref={top} tabIndex={-1}>{title}</h3>
      <section className="qt-card qt-page-card">{children}</section>
      <div className="qt-page-foot">
        {/* PRODUCT_TRUTH_DECORATIVE: closes the page - nothing on it is kept */}
        <button type="button" className="qt-quiet" data-testid="qt-page-close" onClick={onClose}>{t.closeNoSave}</button>
      </div>
    </div>
  );
}

/** a field of an in-page step: the label with its help circle on one line, the field under it */
function PageField({ id, label, help, t, children }) {
  return (
    <div className="qt-field">
      <div className="qt-page-label"><label htmlFor={id}>{label}</label><HelpCircle inline text={help} label={`${t.help}: ${label}`} testId={`${id}-help`} /></div>
      {children}
    </div>
  );
}

/** the options page of a heading (the demo's "⋯"): the name, then duplicate / copy the works of the first / template / delete with content.
 *  No "how many times" field and no one price for the heading (Owner 2026-11-13, answers ב / ב). */
function HeadingOptions({ isHebrew, section, kind, siblingNames, firstName, isFirst, onSaveName, onDuplicate, onCopyFirst, onTemplate, onDelete, onClose }) {
  const t = T[isHebrew ? 'he' : 'en'];
  const one = isHebrew ? kindWord(kind, true) : String(kindWord(kind, false)).toLowerCase();
  const [name, setName] = useState(String(section.name || ''));
  const [err, setErr] = useState('');
  const changed = name.trim() !== String(section.name || '').trim();
  const save = () => {
    const v = name.trim();
    if (!v) { setErr(t.needHeadName); return; }
    if (siblingNames.has(v.toLowerCase())) { setErr(t.namesDistinct); return; }
    onSaveName(v);
  };
  // the demo: back with an unsaved name is refused with a sentence ("חזרה ללא שמירה" leaves without it)
  const back = () => { if (changed) { setErr(t.unsaved); return; } onClose(); };
  const title = <>{t.optionsOf}<bdi>{String(section.name || '').trim() || t.unnamed}</bdi></>;
  return (
    <PageFrame t={t} isHebrew={isHebrew} title={title} onBack={back} onClose={onClose} testId="qt-heading-options" error={err}>
      <form className="qt-page-stack" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); save(); }}>
        <PageField id="qt-head-name" label={t.headName(one)} help={t.headNameHelp} t={t}>
          <input id="qt-head-name" className="qt-input" data-testid="qt-rename" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} />
        </PageField>
        {/* PRODUCT_TRUTH_DECORATIVE: keeps the new name of the heading (its works and prices stay) */}
        <button type="submit" className="qt-add qt-wide" data-testid="qt-save-name">{t.saveName}</button>
      </form>
      <hr className="qt-page-hr" />
      <div className="qt-page-stack">
        {/* PRODUCT_TRUTH_DECORATIVE: duplicates the heading with everything under it */}
        <button type="button" className="qt-option" data-testid="qt-head-duplicate" onClick={onDuplicate}>{t.dupOf(one)}</button>
        {/* PRODUCT_TRUTH_DECORATIVE: adds the works of the first heading at this level into this one (what is here is kept) */}
        <button type="button" className="qt-option" data-testid="unit-copy-first" title={firstName} onClick={() => { if (isFirst) { setErr(t.firstNoCopy); return; } onCopyFirst(); }}>{t.copyFirstOf(kind, one)}</button>
        {onTemplate && (
          // PRODUCT_TRUTH_DECORATIVE: saves the heading with its rows as a unit template (stage 4)
          <button type="button" className="qt-option" data-testid="qt-head-template" onClick={onTemplate}>{t.saveTemplate}</button>
        )}
        {/* PRODUCT_TRUTH_DECORATIVE: deletes the heading with everything under it - with undo */}
        <button type="button" className="qt-option qt-option--danger" data-testid="qt-head-delete" onClick={onDelete}>{t.deleteWith(one)}</button>
      </div>
    </PageFrame>
  );
}

/** the demo's kinds inside a parent: a floor holds apartments / rooms / topics, an apartment rooms / topics, a room topics */
const kindsInside = (parentKind) => (parentKind === 'floor' ? ['apartment', 'room', 'section'] : parentKind === 'apartment' ? ['room', 'section'] : parentKind === 'room' ? ['section'] : ['floor', 'apartment', 'room', 'section']);

/** the add step of the demo, in the page: the kind, how many (1-20), then the names (every name required, all different) */
function AddStep({ isHebrew, parentKey, presetKind, sections, memory, onCreate, onClose }) {
  const t = T[isHebrew ? 'he' : 'en'];
  const [kind, setKind] = useState(presetKind || null);
  const [step, setStep] = useState(presetKind ? 'count' : 'kind');
  const remembered = (k) => (k ? memory.current.get(`${parentKey || ''}|${k}`) : null);
  const [count, setCount] = useState(() => remembered(presetKind)?.count ?? '');
  const [names, setNames] = useState(() => remembered(presetKind)?.names ?? []);
  const [err, setErr] = useState('');
  const remember = (c, n) => { if (kind) memory.current.set(`${parentKey || ''}|${kind}`, { count: c, names: n }); };
  const one = kind ? (isHebrew ? kindWord(kind, true) : kindWord(kind, false).toLowerCase()) : '';
  const many = kind ? t.plural[kind] : '';
  const n = Number(count);
  const countOk = /^\d+$/.test(String(count).trim()) && n >= 1 && n <= 20;
  const shown = names.slice(0, n);
  const parent = parentKey ? sections.find((x) => keyOf(x) === parentKey) : null;
  const parentName = parent ? (parent.name || '') : '';
  const toNames = () => {
    if (!countOk) { setErr(t.countRange); return; }
    const next = Array.from({ length: Math.max(n, names.length) }, (_, i) => names[i] || '');
    setNames(next); remember(count, next); setErr(''); setStep('names');
  };
  const create = () => {
    if (shown.some((v) => !String(v || '').trim())) { setErr(t.needEachName(one)); return; }
    if (duplicateNames(sections, parentKey, shown).length) { setErr(t.namesDistinct); return; }
    memory.current.delete(`${parentKey || ''}|${kind}`); onCreate(kind, shown.map((v) => String(v).trim()));
  };
  const back = () => {
    if (step === 'names') { setStep('count'); setErr(''); return; }
    if (step === 'count') { remember(count, names); if (presetKind) onClose(); else { setStep('kind'); setErr(''); } return; }
    if (String(count).trim() || names.some((v) => String(v || '').trim())) { setErr(t.pendingAsk); return; }
    onClose();
  };
  const title = step === 'kind' ? (parentName ? <>{t.kindQIn}<bdi>{parentName}</bdi>?</> : t.kindQRoot)
    : step === 'count' ? (parentName ? <>{t.countQIn(many)}<bdi>{parentName}</bdi>?</> : t.countQ(many))
      : t.namesQOf(kind, one);
  return (
    <PageFrame t={t} isHebrew={isHebrew} title={title} onBack={back} onClose={onClose} testId="qt-wizard" error={step === 'kind' ? err : ''}>
      {step === 'kind' && (
        <div className="qt-kinds">
          {kindsInside(parent ? parent.kind || 'section' : null).map((k) => (
            // PRODUCT_TRUTH_DECORATIVE: chooses the kind of the new headings (floor / apartment / room / other topic)
            <button key={k} type="button" className="qt-chip" data-testid={`qt-kind-${k}`} onClick={() => { setKind(k); const m = remembered(k); setCount(m ? m.count : ''); setNames(m ? m.names : []); setErr(''); setStep('count'); }}>{t.kinds[k]}</button>
          ))}
        </div>
      )}
      {step === 'count' && (
        <div className="qt-page-stack">
          <PageField id="qt-count" label={t.countLabel(many)} help={t.countHelp(one)} t={t}>
            <input id="qt-count" className="qt-input pf-num" type="number" min="1" max="20" step="1" inputMode="numeric" dir="ltr" data-testid="qt-count" autoFocus value={count} placeholder={t.countPh(many)}
              onChange={(e) => { setCount(e.target.value); setErr(''); }} />
          </PageField>
          {err && <div className="qt-note" role="alert">{err}</div>}
          <p className="qt-page-hint">{t.countHint(one)}</p>
          {/* PRODUCT_TRUTH_DECORATIVE: checks the number and goes on to the names */}
          <div className="qt-actions"><button type="button" className="qt-add" data-testid="qt-count-next" disabled={!countOk} onClick={toNames}>{t.toNamesBtn}</button></div>
        </div>
      )}
      {step === 'names' && (
        <div className="qt-page-stack">
          {shown.map((v, i) => (
            <PageField key={i} id={`qt-name-${i}`} label={t.nameLabelN(kind, one, n > 1 ? i + 1 : 0)} help={t.nameHelp} t={t}>
              <input id={`qt-name-${i}`} className="qt-input" autoFocus={i === 0} value={v} data-testid={`qt-name-${i}`} placeholder={t.namePh[kind]}
                onChange={(e) => { const next = names.map((x, j) => (j === i ? e.target.value : x)); setNames(next); remember(count, next); setErr(''); }} />
            </PageField>
          ))}
          {err && <div className="qt-note" role="alert" data-testid="qt-names-error">{err}</div>}
          {/* PRODUCT_TRUTH_DECORATIVE: adds the new headings to the quote (no rows, nothing saved yet) */}
          <div className="qt-actions"><button type="button" className="qt-add" data-testid="qt-wizard-create" onClick={create}>{t.create}</button></div>
        </div>
      )}
    </PageFrame>
  );
}

export default function QuoteTreeEditor({
  isHebrew, international, items, setItems, sections, setSections, services, sym, fmtMoney, structure, onStructure, onBackToClient,
  onSaveToCatalog, onCatalogItemAdded, recommendedMethod, bottomBar, onSaveHeadingTemplate = null, onAddFromTemplate = null, onShowExample = null,
  canDuplicateRow = null, onDuplicateLocked = null, keyStore = null, onPendingChange = null, onPageChange = null, canUseMeasured = true, onMeasuredLocked = null,
  renderRowEditor = null, // eslint-disable-line no-unused-vars -- 2026-11-15: the demo edits a row in the add form itself (kept in the props for older callers)
}) {
  const t = T[isHebrew ? 'he' : 'en'];
  const [selected, setSelected] = useState(null);
  const lastTopic = useRef(null); // the demo: the heading left for "כל ההצעה" - back at the root returns to it
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [wizard, setWizard] = useState(null); // { parentKey, presetKind, returnTo }
  const memory = useRef(new Map());
  // the row being edited is followed by its row key (the shared key store of the row editor), never by its place in the list
  const ownStore = useRef({ map: new WeakMap(), seq: 0, focus: null });
  const store = keyStore || ownStore.current;
  const rowKey = (it) => { if (!store.map.has(it)) store.map.set(it, it.id || `r${(store.seq += 1)}`); return store.map.get(it); };
  const [editing, setEditing] = useState(null); // { rowKey }
  const editIndex = editing ? (items || []).findIndex((it) => it && store.map.get(it) === editing.rowKey) : -1;
  useEffect(() => { if (editing && editIndex < 0) setEditing(null); }, [editing, editIndex]);
  // the demo's one status line: a message of the last change with "ביטול הפעולה האחרונה" (until anything else changes), or a block
  const [status, setStatus] = useState(null); // { text, restore?, error?, after? }
  useEffect(() => {
    if (!status || !status.restore) return;
    if (!status.after) { setStatus((u) => (u ? { ...u, after: { items, sections } } : u)); return; }
    if (status.after.items !== items || status.after.sections !== sections) setStatus(null);
  }, [items, sections, status]);
  const done = (text) => { const before = { items, sections }; setStatus({ text, restore: () => { setSections(before.sections); setItems(before.items); } }); };
  const [lastMadeKind, setLastMadeKind] = useState(null);
  const [pending, setPending] = useState({}); // formKey -> label
  // the options page of a heading (the demo's "⋯"); like the add step it replaces the work area while open - the work area stays mounted
  // (hidden), so nothing typed in its forms is lost
  const [optionsKey, setOptionsKey] = useState(null);
  const pageOpen = Boolean(wizard) || (optionsKey != null && sections.some((x) => keyOf(x) === optionsKey));
  useEffect(() => { if (typeof onPageChange === 'function') onPageChange(pageOpen); }, [pageOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const tops = topHeadings(sections);
  // the add-more shortcut follows the kind of the top headings created last (then the last one in the list)
  const lastTopKind = lastMadeKind && tops.some((x) => (x.kind || 'section') === lastMadeKind) ? lastMadeKind : (tops.length ? tops[tops.length - 1].kind || 'section' : null);
  const allowNest = structure === 'tiered';
  const simple = structure === 'simple';

  // the demo: a row still pending (typed, not added; or an edit) blocks moving elsewhere, with its own sentence
  const anyPending = Object.keys(pending).length > 0;
  const blocked = (text) => { if (!anyPending) return false; setStatus({ text, error: true }); return true; };
  const guard = (formKey) => { const other = Object.keys(pending).find((k) => k !== formKey); if (!other) return false; setStatus({ text: t.blockOther, error: true }); return true; };
  const onPending = (formKey, label) => setPending((p) => { if ((p[formKey] || null) === (label || null)) return p; const n = { ...p }; if (label) n[formKey] = label; else delete n[formKey]; return n; });
  useEffect(() => { if (typeof onPendingChange === 'function') onPendingChange(Object.values(pending)); }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!anyPending && status && status.error) setStatus(null); }, [anyPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const expand = (key) => setCollapsed((prev) => { const n = new Set(prev); pathOf(sections, key).forEach((x) => n.delete(keyOf(x))); return n; });
  const reveal = (key) => {
    if (!key) return;
    expand(key);
    const smooth = !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setTimeout(() => { const el = document.getElementById(`qt-h-${String(key).replace(/[^a-z0-9_-]/gi, '')}`); el?.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }); }, 30);
  };
  const select = (key) => { setSelected(key); setStatus(null); reveal(key); };
  const toRoot = () => { if (selected) lastTopic.current = selected; setSelected(null); setStatus(null); };
  const exists = (k) => Boolean(k) && sections.some((x) => keyOf(x) === k);
  // the demo's back: a sub-heading -> its parent; a top heading -> the whole quote; the whole quote -> the heading left, else the client details
  const parentKey = selected ? parentOf(sections, selected) : null;
  const backLabel = selected ? (parentKey ? <>{t.backTo}<bdi>{sections.find((x) => keyOf(x) === parentKey)?.name || ''}</bdi></> : t.backWhole)
    : (exists(lastTopic.current) && !simple ? <>{t.backTo}<bdi>{sections.find((x) => keyOf(x) === lastTopic.current)?.name || ''}</bdi></> : t.backClient);
  const goBack = () => {
    if (blocked(t.blockNav)) return;
    if (selected) { if (parentKey) select(parentKey); else toRoot(); return; }
    if (exists(lastTopic.current) && !simple) { select(lastTopic.current); return; }
    if (typeof onBackToClient === 'function') onBackToClient();
  };
  const closePage = (returnTo) => { setWizard(null); setOptionsKey(null); if (returnTo !== undefined) { setSelected(returnTo); if (returnTo) expand(returnTo); } };

  // a new row is appended at the end of its place (the demo); its catalog extras (an image) follow it
  const placeOf = (it) => (it && it.section_key && sections.some((s) => keyOf(s) === it.section_key) ? it.section_key : null);
  const insertAtEndOf = (list, place, row) => { let at = -1; list.forEach((it, i) => { if (placeOf(it) === place) at = i; }); return at < 0 ? [...list, row] : [...list.slice(0, at + 1), row, ...list.slice(at + 1)]; };
  const addItem = (targetKey) => (item, catalogId = null) => {
    done(t.msgAdded);
    setItems((prev) => insertAtEndOf((prev || []).filter((it) => !(it && it.description === '' && (it.unit_price === '' || it.unit_price == null) && !it.id && !it.pricing_unit)), simple ? null : targetKey, item));
    if (catalogId && typeof onCatalogItemAdded === 'function') onCatalogItemAdded(catalogId, item);
  };
  const removeRow = (index) => { if (blocked(t.blockMove)) return; done(t.msgRemoved); setItems((prev) => prev.filter((_, i) => i !== index)); };
  // a professional row without the reuse entitlement is never copied - the upgrade window opens instead (as before 13/11)
  const locked = (list) => typeof canDuplicateRow === 'function' && list.some((it) => it && !canDuplicateRow(it));
  const duplicateRow = (index) => {
    if (blocked(t.blockCopy)) return;
    if (locked([items[index]])) { onDuplicateLocked?.(); return; }
    done(t.msgCopied);
    setItems((prev) => { const c = { ...prev[index] }; delete c.id; delete c.price_link_id; return insertAtEndOf(prev, placeOf(prev[index]), c); });
  };
  // the demo: editing a row moves the chosen place to the row's place (a whole-quote row -> "כל ההצעה")
  const startEdit = (it) => { if (blocked(t.blockMove)) return; const place = placeOf(it); if (!simple) { if (place) { setSelected(place); expand(place); } else setSelected(null); } setEditing({ rowKey: rowKey(it) }); setStatus(null); };
  const updateRow = (built) => {
    const rk = editing?.rowKey;
    done(t.msgUpdated);
    setItems((prev) => { const j = prev.findIndex((x) => x && store.map.get(x) === rk); if (j < 0) return prev; const next = prev.slice(); next[j] = built; store.map.set(built, rk); return next; });
    setPending((p) => { const n = { ...p }; delete n[`edit-${rk}`]; return n; });
    setEditing(null);
  };
  const cancelEdit = () => { const rk = editing?.rowKey; setPending((p) => { const n = { ...p }; delete n[`edit-${rk}`]; return n; }); setEditing(null); };

  const createHeadings = (kind, names) => {
    const pk = wizard?.parentKey ?? null;
    const { sections: next, added } = addHeadings(sections, { kind, names, parentKey: pk }, isHebrew);
    done(t.msgHeadingAdded);
    setSections(next);
    setWizard(null);
    if (!pk) setLastMadeKind(kind);
    if (simple) onStructure(pk ? 'tiered' : 'grouped');
    // the demo: the first new heading is selected (its path open)
    if (added[0]) setTimeout(() => { setSelected(added[0]); setCollapsed((prev) => { const n = new Set(prev); pathOf(next, added[0]).forEach((x) => n.delete(keyOf(x))); return n; }); }, 0);
  };

  // the untouched starter line of a new quote is never shown as a row (nothing typed yet - the add form is where work starts)
  const rowsOf = (key) => itemIndicesOf(items, sections, key).filter((i) => !isUntouchedPlaceholderItem(items[i]));
  // the simple structure lists every row in one table, in the order of the tree (root rows, then each heading's rows)
  const flatRows = () => { const out = [...rowsOf(null)]; const walk = (k) => childrenOf(sections, k).forEach((s) => { out.push(...rowsOf(keyOf(s))); walk(keyOf(s)); }); walk(null); return out; };
  const editPlace = editing && editIndex >= 0 ? (simple ? null : placeOf(items[editIndex])) : undefined;

  // Owner 2026-11-08 (restore item 17): the only line of the quote has no Remove
  const realRows = (items || []).filter((it) => it && !it._localExample && String(it.description || '').trim()).length;
  const unitWord = isHebrew ? 'יח׳' : 'pcs';
  const renderRows = (idx, placeKey) => {
    if (!idx.length) return null;
    return (
      <table className="qt-rows" data-testid="qt-rows">
        <colgroup><col /><col className="qt-col-qty" /><col className="qt-col-price" /><col className="qt-col-sum" /><col className="qt-col-act" /></colgroup>
        <thead><tr><th>{t.colWork}</th><th className="qt-num">{t.colQty}</th><th className="qt-num">{t.colPrice}</th><th className="qt-num">{t.colSum}</th><th className="qt-sr">{t.actions}</th></tr></thead>
        <tbody>
          {idx.map((i) => {
            const it = items[i];
            if (editing && editIndex === i) {
              const rk = editing.rowKey;
              return (
                <tr key={`e${rk}`} className="qt-edit-tr"><td colSpan={5} className="qt-edit" data-testid="qt-edit-row">
                  {/* the demo's edit in place: the row turns into the add form ("עריכת המוצר" / "עדכון השורה" / "ביטול העריכה") */}
                  <AddForm formKey={`edit-${rk}`} targetKey={simple ? null : placeKey} sections={sections} isHebrew={isHebrew} international={international} services={services} sym={sym} fmtMoney={fmtMoney}
                    onAdd={() => {}} onPending={onPending} guard={guard} editItem={it} onUpdate={updateRow} onCancelEdit={cancelEdit} recommendedMethod={recommendedMethod}
                    canUseMeasured={canUseMeasured} onMeasuredLocked={onMeasuredLocked} />
                </td></tr>
              );
            }
            const priceMissing = it.unit_price === '' || it.unit_price == null;
            const fixed = it._billing === 'fixed' && !it.pricing_unit;
            // only the number is isolated - the unit stays a word of the sentence ("6 מ״ר" reads right in Hebrew)
            const qty = it.pricing_unit ? <>{N(formatQuantity(Number(it.calculated_quantity ?? it.quantity), it.pricing_unit))} {getProfessionalUnitLabel(it.pricing_unit, isHebrew)}</>
              : (fixed ? '—' : <>{N(String(it.quantity || ''))} {unitWord}</>);
            const details = Array.isArray(it.specification) && it.specification.length ? it.specification.map((d) => (d.label && d.value ? `${d.label}: ${d.value}` : (d.value || d.label || ''))).filter(Boolean).join(' · ') : '';
            return (
              <tr key={i} data-testid="qt-row">
                <td className="qt-desc">
                  {it._localExample && <span className="qt-example" data-testid="quote-example-badge">{isHebrew ? 'דוגמה · לא נשמרת' : 'Example · not saved'}</span>}
                  {/* PRODUCT_TRUTH_DECORATIVE: the row name - a click opens it for editing in place (as "עריכה") */}
                  <button type="button" className="qt-row-name" onClick={() => startEdit(it)}>{it.description}</button>
                  {fixed && <small className="qt-row-sub">{t.fixedSub}</small>}
                  {details && <small className="qt-row-sub qt-row-details">{details}</small>}
                </td>
                <td className="qt-num" data-label={t.colQty}>{qty}</td>
                <td className="qt-num" data-label={t.colPrice}>{priceMissing ? <span className="qt-missing">{t.notPriced}</span> : <span className="pf-money">{sym}{fmtMoney(Number(it.unit_price))}</span>}</td>
                <td className="qt-num qt-sum" data-label={t.colSum}>{priceMissing ? <span className="qt-missing">{t.notPriced}</span> : <span className="pf-money">{sym}{fmtMoney(lineTotal(it))}</span>}</td>
                <td className="qt-act">
                  <RowMenu t={t} isHebrew={isHebrew} onEdit={() => startEdit(it)} onDuplicate={() => duplicateRow(i)}
                    onRemove={realRows > 1 || it._localExample ? () => removeRow(i) : null} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const optionsPage = () => {
    const s = optionsKey != null ? sections.find((x) => keyOf(x) === optionsKey) : null;
    if (!s) return null;
    const key = keyOf(s);
    const kids = childrenOf(sections, key);
    const sibs = childrenOf(sections, parentOf(sections, key));
    const first = firstSiblingOf(sections, key);
    const isReal = (it) => it && !isUntouchedPlaceholderItem(it) && !it._localExample;
    const siblingNames = new Set(sibs.filter((x) => keyOf(x) !== key).map((x) => String(x.name || '').trim().toLowerCase()));
    return (
      <HeadingOptions key={key} isHebrew={isHebrew} section={s} kind={s.kind || 'section'} siblingNames={siblingNames} firstName={first ? first.name : ''} isFirst={!first || keyOf(first) === key}
        onClose={() => closePage(key)}
        onSaveName={(v) => { done(t.msgNamesSaved); setSections(sections.map((x) => (keyOf(x) === key ? { ...x, name: v } : x))); closePage(key); }}
        onDuplicate={() => {
          const under = new Set(subtreeKeys(sections, key));
          if (locked(items.filter((it) => it && under.has(it.section_key)))) { onDuplicateLocked?.(); return; }
          const r = duplicateHeading(sections, items, key, isHebrew); done(t.msgHeadingCopied); setSections(r.sections); setItems(r.items); closePage(r.copyKey);
        }}
        onCopyFirst={() => { done(t.msgCopiedFirst); setItems(copyRowsFromFirst(sections, items, key, isReal)); closePage(key); }}
        onTemplate={onSaveHeadingTemplate && String(s.name || '').trim() && rowsOf(key).length && !kids.length ? () => { closePage(key); onSaveHeadingTemplate(s); } : null}
        onDelete={() => {
          const r = removeHeadingWithContent(sections, items, key);
          done(t.msgHeadingDeleted);
          setSections(r.sections); setItems(r.items);
          setOptionsKey(null);
          if (selected && !r.sections.some((x) => keyOf(x) === selected)) setSelected(parentOf(sections, key));
        }} />
    );
  };

  const renderHeading = (s) => {
    const key = keyOf(s);
    const depth = depthOf(sections, key);
    const isOpen = !collapsed.has(key);
    const kids = childrenOf(sections, key);
    const repeat = normalizeRepeatCount(s.repeat_count);
    return (
      <div key={key} className="qt-node" data-testid="qt-heading" data-depth={depth}>
        <div id={`qt-h-${String(key).replace(/[^a-z0-9_-]/gi, '')}`} className={`qt-head${selected === key ? ' qt-head--sel' : ''}`}>
          {/* PRODUCT_TRUTH_DECORATIVE: folds / opens a heading (its content stays; the selection does not change) */}
          <button type="button" className={`qt-tri ${depth ? 'qt-tri--sub' : 'qt-tri--top'}`} aria-expanded={isOpen} aria-label={`${isOpen ? t.close : t.open} ${s.name}`}
            onClick={() => setCollapsed((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })}>{isOpen ? '▾' : (isHebrew ? '◀' : '▶')}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: the heading name - a click selects the heading and scrolls to it (nothing changes) */}
          <button type="button" className="qt-head-name" aria-pressed={selected === key} onClick={() => { if (!blocked(t.blockMove)) select(key); }}>
            {String(s.name || '').trim() ? <bdi>{s.name}</bdi> : <span style={{ color: '#64748b', fontWeight: 600 }}>{t.unnamed}</span>}{repeat > 1 && <> × {N(repeat)}</>}
          </button>
          <span className="qt-head-total"><span className="pf-money">{sym}{fmtMoney(headingTotal(items, sections, key))}</span></span>
          <span className="qt-head-menu">
            {/* PRODUCT_TRUTH_DECORATIVE: opens the options page of the heading (name, duplicate, copy from the first, delete with content) */}
            <button type="button" className="qt-menu-btn" aria-label={t.hMenu(String(s.name || '').trim() || t.unnamed)} data-testid="qt-heading-actions" onClick={() => { if (!blocked(t.blockMove)) setOptionsKey(key); }}>⋯</button>
          </span>
        </div>
        {/* a folded heading keeps its forms mounted (hidden): nothing typed in them is lost */}
        <div className="qt-body" hidden={!isOpen}>
            {repeat > 1 && (() => {
              // an older quote whose heading stands for N identical copies (Owner 2026-11-10 G6a "א": the sums by name, not as an equation)
              const kind = s.kind || 'section';
              const W = groupWord(kind, true); const Wp = groupWord(kind, true, { plural: true });
              const w = groupWord(kind, false).toLowerCase(); const wp = groupWord(kind, false, { plural: true }).toLowerCase();
              const per = rowsOf(key).reduce((n, i) => n + lineTotal(items[i]), 0);
              return (
                <div className="qt-strip" data-testid="unit-per-copy">
                  <span>
                    {isHebrew
                      ? <>סכום ל{W}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per)}</bdi> · סכום לכל ה{Wp}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per * repeat)}</bdi></>
                      : <>Per {w}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per)}</bdi> · All {wp}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per * repeat)}</bdi></>}
                  </span>
                  <span>{isHebrew ? `השורות כאן הן ל${W} אחת` : `The rows here are for one ${w}`}</span>
                  <span data-testid="unit-applies-all">{isHebrew ? <>עריכה תחול על כל <bdi dir="ltr" className="pf-num">{repeat}</bdi> ה{Wp}.</> : <>Edits apply to all <bdi dir="ltr" className="pf-num">{repeat}</bdi> {wp}.</>}</span>
                </div>
              );
            })()}
            {allowNest && depth < MAX_DEPTH - 1 && repeat < 2 && (
              <div className="qt-actions">
                {/* PRODUCT_TRUTH_DECORATIVE: adds a heading INSIDE this heading (a room in an apartment, an apartment in a floor); never inside a heading of identical copies */}
                <button type="button" className="sq-add-btn" data-testid="qt-add-inside" aria-label={t.addInside(s.name)} onClick={() => { if (blocked(t.blockInside)) return; setSelected(key); setWizard({ parentKey: key, presetKind: null, returnTo: key }); }}>{t.addInsidePre}<bdi>{s.name}</bdi></button>
              </div>
            )}
            {editPlace !== key && (
              <AddForm formKey={key} targetKey={key} sections={sections} isHebrew={isHebrew} international={international} services={services} sym={sym} fmtMoney={fmtMoney}
                onAdd={addItem(key)} onSaveToCatalog={onSaveToCatalog} onPending={onPending} guard={guard} recommendedMethod={recommendedMethod} canUseMeasured={canUseMeasured} onMeasuredLocked={onMeasuredLocked} />
            )}
            {renderRows(rowsOf(key), key)}
            {kids.map(renderHeading)}
        </div>
      </div>
    );
  };

  const showRootForm = (simple || selected === null) && editPlace !== null;
  return (
    <div className="qt" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="qt-editor" onKeyDown={(e) => { if (enterInField(e)) e.preventDefault(); }}>
      {wizard && <AddStep key={`${wizard.parentKey || ''}|${wizard.presetKind || ''}`} isHebrew={isHebrew} parentKey={wizard.parentKey ?? null} presetKind={wizard.presetKind ?? null}
        sections={sections} memory={memory} onCreate={createHeadings} onClose={() => closePage(wizard.returnTo)} />}
      {!wizard && optionsPage()}
      <div className="qt-card" hidden={pageOpen}>
        {status && (
          <div className={status.error ? 'qt-status qt-status--error' : 'qt-status'} role={status.error ? 'alert' : 'status'} data-testid={status.error ? 'qt-block' : 'qt-undo'}>
            <span>{status.text}</span>
            {/* PRODUCT_TRUTH_DECORATIVE: undoes the last change exactly */}
            {status.restore && <button type="button" className="qt-link" onClick={() => { if (blocked(t.blockMove)) return; status.restore(); setStatus(null); }}>{t.undoLast}</button>}
          </div>
        )}
        <div className="qt-structure" role="group" aria-label={isHebrew ? 'מבנה ההצעה' : 'Quote structure'}>
          {[['simple', t.simple, t.helpSimple], ['grouped', t.grouped, t.helpGrouped], ['tiered', t.tiered, t.helpTiered]].map(([k, label, help]) => (
            <div key={k} style={{ position: 'relative' }}>
              {/* PRODUCT_TRUTH_DECORATIVE: chooses the quote structure directly - nothing that was entered is removed */}
              <button type="button" className="qt-structure-btn" aria-pressed={structure === k} data-testid={`qt-structure-${k}`} style={{ inlineSize: '100%' }}
                onClick={() => { if (blocked(t.blockStructure)) return; onStructure(k); setSelected(null); setEditing(null); }}>{label}</button>
              <HelpCircle text={help} label={`${t.help}: ${label}`} />
            </div>
          ))}
        </div>
        {!simple && (
          <nav className="qt-nav" aria-label={isHebrew ? 'מעבר לנושא בהצעה' : 'Go to a part of the quote'}>
            {/* PRODUCT_TRUTH_DECORATIVE: shows the whole quote (nothing changes) */}
            <button type="button" className="qt-chip" aria-current={selected === null} data-testid="qt-nav-whole" onClick={() => { if (!blocked(t.blockMove)) toRoot(); }}>{t.whole}</button>
            {tops.map((s) => (
              // PRODUCT_TRUTH_DECORATIVE: selects a top heading, opens it and jumps to it (nothing changes); marked while you work inside it
              <button key={keyOf(s)} type="button" className="qt-chip" aria-current={Boolean(selected) && pathOf(sections, selected).some((p) => keyOf(p) === keyOf(s))} data-testid="qt-nav-heading"
                onClick={() => { if (!blocked(t.blockNav)) select(keyOf(s)); }}><bdi>{s.name}</bdi></button>
            ))}
          </nav>
        )}
        <div className="qt-actions">
          {/* PRODUCT_TRUTH_DECORATIVE: back - to the parent heading, to the whole quote, then to the client details (nothing is removed) */}
          <button type="button" className="qt-link" data-testid="qt-back" onClick={goBack}>{backLabel}</button>
          {!simple && tops.length > 0 && (
            // PRODUCT_TRUTH_DECORATIVE: adds more top headings of the kind of the last one (how many, then names)
            <button type="button" className="sq-add-btn" data-testid="qt-add-same" onClick={() => { if (blocked(t.blockNav)) return; const back = selected; setSelected(null); setWizard({ parentKey: null, presetKind: lastTopKind, returnTo: back }); }}>{t.addOf(kindWord(lastTopKind, isHebrew))}</button>
          )}
          {!simple && selected === null && (tops.length ? (
            // PRODUCT_TRUTH_DECORATIVE: adds top headings of another kind
            <button type="button" className="sq-add-btn" data-testid="qt-add-other" onClick={() => { if (!blocked(t.blockMove)) setWizard({ parentKey: null, presetKind: null, returnTo: null }); }}>{t.addOther}</button>
          ) : (
            // PRODUCT_TRUTH_DECORATIVE: the first headings of the quote (choose the kind, how many, then names)
            <button type="button" className="sq-add-btn" data-testid="qt-add-first" onClick={() => { if (!blocked(t.blockMove)) setWizard({ parentKey: null, presetKind: null, returnTo: null }); }}>{t.addFirst}</button>
          ))}
          {/* PRODUCT_TRUTH_DECORATIVE: "from a saved template" (stage 4; Owner 13/11: in this row) - opens the unit templates; one heading with its rows is added */}
          {onAddFromTemplate && (simple || selected === null) && <button type="button" className="sq-add-btn" data-testid="unit-from-template" onClick={() => { if (!blocked(t.blockMove)) onAddFromTemplate(); }}>{t.fromTemplate}</button>}
          {/* PRODUCT_TRUTH_DECORATIVE: adds ONE local, never-saved example line to learn the row from (Owner restore item 07) */}
          {onShowExample && !items.some((it) => it && String(it.description || '').trim()) && !sections.length && <button type="button" className="sq-add-btn" data-testid="quote-show-example" onClick={onShowExample}>{t.example}</button>}
        </div>
        {showRootForm && (
          <AddForm formKey="__root__" targetKey={null} sections={sections} isHebrew={isHebrew} international={international} services={services} sym={sym} fmtMoney={fmtMoney}
            onAdd={addItem(null)} onSaveToCatalog={onSaveToCatalog} onPending={onPending} guard={guard} recommendedMethod={recommendedMethod} canUseMeasured={canUseMeasured} onMeasuredLocked={onMeasuredLocked} />
        )}
        {simple ? renderRows(flatRows(), null) : renderRows(rowsOf(null), null)}
        {!simple && tops.map(renderHeading)}
      </div>
      {!pageOpen && bottomBar}
    </div>
  );
}

export { T as QUOTE_TREE_COPY };
