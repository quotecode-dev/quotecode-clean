import React, { useState, useRef, useEffect } from 'react';

export default function AIChatWidget({ isHebrew, isDashboard = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    const defaultWelcome = isHebrew 
      ? (isDashboard ? 'שלום! אני עוזר ה-AI של ProFlow. איך אעזור לך בממשק המערכת היום?' : 'שלום! אני עוזר ה-AI של ProFlow. יש לך שאלות על המחירים, המסלולים או הפיצ\'רים שלנו?') 
      : (isDashboard ? 'Hello! I am ProFlow AI assistant. How can I help you with the interface today?' : 'Hello! I am ProFlow AI assistant. Have questions about our pricing, plans, or features?');

    try {
      const storageKey = isDashboard ? 'proflow_ai_chat_app' : 'proflow_ai_chat_public';
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          if (parsed[0].role === 'assistant') {
            parsed[0].content = defaultWelcome;
          }
          return parsed;
        }
      }
    } catch (e) {}
    return [
      { role: 'assistant', content: defaultWelcome }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleOpenExternalChat = () => setIsOpen(true);
    window.addEventListener('open-proflow-ai-chat', handleOpenExternalChat);
    return () => window.removeEventListener('open-proflow-ai-chat', handleOpenExternalChat);
  }, []);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].role === 'assistant') {
        const updated = [...prev];
        updated[0] = {
          role: 'assistant',
          content: isHebrew 
            ? (isDashboard ? 'שלום! אני עוזר ה-AI של ProFlow. איך אעזור לך בממשק המערכת היום?' : 'שלום! אני עוזר ה-AI של ProFlow. יש לך שאלות על המחירים, המסלולים או הפיצ\'רים שלנו?') 
            : (isDashboard ? 'Hello! I am ProFlow AI assistant. How can I help you with the interface today?' : 'Hello! I am ProFlow AI assistant. Have questions about our pricing, plans, or features?')
        };
        return updated;
      }
      return prev;
    });
  }, [isHebrew, isDashboard]);

  useEffect(() => {
    try {
      const storageKey = isDashboard ? 'proflow_ai_chat_app' : 'proflow_ai_chat_public';
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {}
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isDashboard]);

  const processUserQuery = (queryText) => {
    const lower = queryText.toLowerCase().trim();
    let reply = '';
    let options = null;

    if (isHebrew) {
      if (!isDashboard) {
        if (lower.includes('מחיר') || lower.includes('עולה') || lower.includes('מסלול') || lower.includes('כמה')) {
          reply = 'אנחנו מציעים 3 מסלולים עיקריים: מסלול חינמי (Free) ב-0 ₪, מסלול בסיסי (Basic) החל מ-39 ₪ לחודש, ומסלול עסקי (Pro) הפופולרי ב-79 ₪ לחודש (בחיוב שנתי). ניתן לעבור בין המסלולים בכל עת!';
        } else if (lower.includes('ניסיון') || lower.includes('חינם') || lower.includes('14')) {
          reply = 'תקופת הניסיון מעניקה לך 14 יום חינם לגמרי עם גישה מלאה לכל פיצ\'רי ה-PRO של המערכת (הצעות מחיר ללא הגבלה, שליחת וואטסאפ ועוד) ללא שום התחייבות!';
        } else if (lower.includes('מע"מ') || lower.includes('מס') || lower.includes('vat')) {
          reply = 'ללקוחות בארץ המחירים כוללים מע"מ 18% כחוק (עם פירוט סכום לפני מע"מ). ללקוחות מחו"ל (International) המע"מ מוגדר אוטומטית כ-0%.';
        } else if (lower.includes('עובדים') || lower.includes('צוות') || lower.includes('הרשאות')) {
          reply = 'במסלול PRO ניתן לנהל גישות מתקדמות ולצרף משתמשים נוספים לעסק בהתאם לצורך ניהול המכירות והמשרד.';
        } else if (lower.includes('לוגו') || lower.includes('מיתוג') || lower.includes('צבעים') || lower.includes('עיצוב')) {
          reply = 'בהחלט! תוכל להעלות את לוגו העסק שלך בהגדרות המערכת, והוא יופיע באופן אוטומטי בראש כל הצעת מחיר שתפיק ללקוחותיך.';
        } else if (lower.includes('חשבונית') || lower.includes('קבלה') || lower.includes('תשלום') || lower.includes('אשראי') || lower.includes('פייפאל')) {
          reply = 'המנוי נרכש בצורה מאובטחת באשראי או באמצעים דיגיטליים, והמערכת מספקת אסמכתאות וחשבונות מסודרים. ProFlow מתמקדת בהפקת הצעות מחיר חכמות, גבייה וחתימות דיגיטליות.';
        } else if (lower.includes('ייבוא') || lower.includes('ייבא') || lower.includes('אקסל') || lower.includes('מיגרציה')) {
          reply = 'כן, ניתן לייבא נתונים ולקוחות בקלות אל תוך ספר הלקוחות (CRM) של ProFlow, וכן לייצא את כל הנתונים החוצה בפורמט CSV בכל עת.';
        } else if (lower.includes('אינטגרציה') || lower.includes('api') || lower.includes('סליקה') || lower.includes('חיבור')) {
          reply = 'ProFlow תומכת בחיבורים מתקדמים, שליחת הודעות וואטסאפ ישירות, וייצוא נתונים נוח למערכות חיצוניות ולאקסל.';
        } else if (lower.includes('קשר') || lower.includes('תמיכה') || lower.includes('אימייל') || lower.includes('support')) {
          reply = 'ניתן לפנות אלינו בכל שאלה ישירות לכתובת האימייל של שירות הלקוחות: support@quotecodepro.com. אנו משתדלים להשיב בתוך 24 שעות בימי עסקים.';
        } else if (lower.includes('ענן') || lower.includes('אבטחה') || lower.includes('בטוח')) {
          reply = 'בהחלט! ProFlow מבוססת על שרתי ענן מתקדמים ברמת אבטחה גבוהה ביותר, כולל הצפנת נתונים וגיבויים אוטומטיים שמבטיחים שהמידע שלך תמיד שמור.';
        } else if (lower.includes('ביטול') || lower.includes('להקפיא') || lower.includes('לבטל')) {
          reply = 'ניתן לבטל או להקפיא את המנוי בכל עת ללא התחייבות. בעת הביטול מתוך "הגדרות עסק" במערכת, תוכל לבחור אם למחוק את כל הנתונים שלך לצמיתות, או לשמור אותם בארכיון לצפייה עתידית.';
        } else {
          reply = 'ProFlow היא פלטפורמת SaaS עננית לניהול עסק, הפקת הצעות מחיר חכמות, חתימות דיגיטליות וניהול לקוחות. האם תרצה להתחיל 14 יום ניסיון חינם או לשאול על המסלולים והפיצ\'רים שלנו?';
        }
      } else {
        if (lower === 'מייל' || lower === 'אימייל') {
          reply = 'האם אתה מתכוון ליצירת קשר עם שירות הלקוחות, או לשליחת הצעת מחיר במייל ללקוח?';
          options = [
            { label: '📞 יצירת קשר עם שירות הלקוחות', action: 'contact_support' },
            { label: '📄 שליחת הצעת מחיר במייל', action: 'send_quote_email' }
          ];
        } else if (lower === 'עריכה' || lower === 'לערוך' || lower === 'שינוי') {
          reply = 'למה אתה מתכוון כשאתה אומר עריכה? בחר את האפשרות המתאימה:';
          options = [
            { label: '✏️ עריכת הצעת מחיר קיימת', action: 'edit_quote' },
            { label: '👥 עריכת פרטי לקוח (CRM)', action: 'edit_client' },
            { label: '📦 עריכת שירות/מוצר בקטלוג', action: 'edit_catalog' },
            { label: '⚙️ עריכת הגדרות עסק', action: 'edit_settings' }
          ];
        } else if (lower === 'מחיקה' || lower === 'למחוק') {
          reply = 'מה ברצונך למחוק? בחר את האפשרות הרצויה:';
          options = [
            { label: '🗑️ מחיקת הצעת מחיר', action: 'delete_quote' },
            { label: '👥 מחיקת לקוח מספר הלקוחות', action: 'delete_client' },
            { label: '📦 מחיקת שירות מהקטלוג', action: 'delete_catalog' },
            { label: '📊 מחיקת הוצאה מהדוחות', action: 'delete_expense' },
            { label: '🛑 ביטול / מחיקת מנוי', action: 'cancel_subscription' }
          ];
        } else if (lower === 'לקוח' || lower === 'לקוחות') {
          reply = 'האם אתה מתכוון לניהול ספר הלקוחות או ליצירת הצעה ללקוח חדש?';
          options = [
            { label: '👥 ניהול וצפייה בספר הלקוחות (CRM)', action: 'manage_clients' },
            { label: '➕ יצירת הצעת מחיר חדשה ללקוח', action: 'new_quote' }
          ];
        } else if (lower.includes('שליחת הצעת מחיר במייל') || lower.includes('שולח') && lower.includes('הצעה') && lower.includes('מייל')) {
          reply = 'כדי לשלוח הצעת מחיר במייל ללקוח: פתח את תפריט "פעולות ▼" בשורת ההצעה המבוקשת ובחר באפשרות "שלח במייל". המערכת תשלח את ההצעה אוטומטית לכתובת המייל של הלקוח דרך השרת שלנו (support@quotecodepro.com).';
        } else if (lower.includes('קשר') || lower.includes('פנייה') || lower.includes('לפנות') || lower.includes('אימייל של שירות') || lower.includes('מייל של שירות') || lower.includes('מה האימייל') || lower.includes('כתובת מייל') || lower.includes('שירות לקוחות') || lower.includes('תמיכה') || lower.includes('support')) {
          reply = 'ניתן ליצור איתנו קשר ישירות דרך כתובת האימייל של שירות הלקוחות: support@quotecodepro.com, או להמשיך לקבל מענה מיידי וזמין 24/7 כאן בעוזר ה-AI. לידיעתך, הפעילות שלנו מתנהלת באופן דיגיטלי בענן ללא קבלת קהל פיזית במשרדים.';
        } else if (lower.includes('קטלוג') || lower.includes('מוצר') || lower.includes('שירות בקטלוג') || lower.includes('הוספת מוצר') || lower.includes('הוספת שירות')) {
          reply = 'כדי להוסיף מוצר או שירות לקטלוג: גלול למטה בטאב "הצעות מחיר" הראשי אל טבלת "קטלוג שירותים ומוצרים". הזן בשדה הייעודי את שם השירות/המוצר ואת המחיר הקבוע שלו, ולחץ על כפתור "הוסף לקטלוג". לאחר מכן תוכל לבחור אותו בלחיצה מהירה מתוך רשימת הקטלוג בעת יצירת הצעת מחיר!';
        } else if (lower.includes('פעולות') || lower.includes('תפריט') || lower.includes('כפתור') || lower.includes('צפה')) {
          reply = 'בכל שורה של הצעת מחיר בטבלה ישנו כפתור "פעולות ▼" מצד שמאל. בלחיצה עליו נפתח תפריט המאפשר לך: לצפות במסמך (👁️), לערוך אותו (✏️), לשכפל (📋), לשלוח בוואטסאפ או במייל, או למחוק את ההצעה.';
        } else if (lower.includes('סיכום') || lower.includes('הזמנות') || lower.includes('רשימה') || lower.includes('היסטוריה') || lower.includes('טבלה')) {
          reply = 'את סיכום כל ההצעות וההזמנות ניתן לראות בטאב "הצעות מחיר" הראשי. הטבלה מציגה את מספר ההזמנה, שם הלקוח, תיאור הפריט הראשון, הסכום הכולל, תאריך היצירה, סטטוס העסק (טיוטה, נשלח, אושר, שולם) ומספר צפיות אמיתיות של לקוחות (👁️).';
        } else if (lower.includes('הצעה') || lower.includes('חדשה') || lower.includes('ליצור') || lower.includes('הפקת')) {
          reply = 'כדי ליצור הצעת מחיר חדשה לחץ על כפתור "➕ צור הצעת מחיר חדשה" בראש הדשבורד. מלא את פרטי הלקוח, בחר את סוג הלקוח (עסקי או פרטי), הוסף פריטים (ידנית או מהקטלוג) ולחיצה על "הפק ושמור בענן" תשמור את ההצעה.';
        } else if (lower.includes('וואטסאפ') || lower.includes('whatsapp') || lower.includes('וואט סאפ'))  {
          reply = 'שליחת הצעת מחיר ישירות בוואטסאפ מתבצעת דרך תפריט "פעולות ▼" בשורת ההצעה (פיצ\'ר בלעדי למנויי PRO) המייצר הודעה מוכנה עם לינק ישיר ללקוח.';
        } else if (lower.includes('מע"מ') || lower.includes('vat') || lower.includes('מס')) {
          reply = 'המערכת מחשבת מע"מ אוטומטית בהתאם להגדרות העסק: 18% ללקוחות בארץ (עם אפשרות לחישוב כולל/לפני מע"מ לפי סוג הלקוח) ו-0% ללקוחות מחו"ל.';
        } else if (lower.includes('פיזי') || lower.includes('משרד') || lower.includes('להגיע') || lower.includes('כתובת') || lower.includes('פגישה') || lower.includes('פרונטלית') || lower.includes('סניף')) {
          reply = 'מערכת ProFlow הינה פלטפורמת SaaS עננית ודיגיטלית מלאה הפועלת אונליין, ולכן אינה מקבלת קהל באופן פיזי במשרדים. כל הפעולות, ניהול העסק, הפקת הצעות והתמיכה מתבצעות באופן דיגיטלי נוח ומהיר ישירות דרך המערכת או באמצעות יצירת קשר עמנו באימייל (support@quotecodepro.com) ובעוזר ה-AI כאן 24/7!';
        } else if (lower.includes('מיון') || lower.includes('סדר') || lower.includes('למיין') || lower.includes('עמודות')) {
          reply = 'ניתן למיין את טבלת ההצעות בקלות בלחיצה על כותרות העמודות בטבלה (מספר הזמנה, שם לקוח, סכום, תאריך, סטטוס או צפיות).';
        } else if (lower.includes('הוצאות') || lower.includes('דוחות') || lower.includes('רווח') || lower.includes('הכנסות'))  {
          reply = 'בטאב "הוצאות/הכנסות" (למנהלי מערכת) תוכל לנהל את הוצאות העסק השוטפות, לצפות בגרפים שנתיים של הכנסות מול הוצאות, ולייצא דוחות מרוכזים לאקסל (CSV).';
        } else if (lower.includes('אזור') || lower.includes('lcl') || lower.includes('intl') || lower.includes('משתמשים') || lower.includes('אדמין')) {
          reply = 'פאנל ה-Super Admin מאפשר לראות את כל משתמשי המערכת, לנהל את החבילות שלהם (Free, Basic, Pro), להעניק מנוי לכל החיים (Lifetime), ולשנות את אזור הפעילות (LCL לישראל בירוק, או Intl לחו"ל באדום עם התראת אישור).';
        } else if (lower.includes('ביטול מנוי') || lower.includes('לבטל מנוי') || lower.includes('להקפיא') || lower.includes('הקפאה') || lower.includes('למחוק מנוי') || lower.includes('איך מבטלים')) {
          reply = 'כדי לבטל או להקפיא את המנוי שלך: עבור לטאב "הגדרות עסק", גלול למטה לאזור "ניהול מנוי וחבילת שירות". לחץ על "ביטול מנוי" – במהלך תהליך העזיבה תוכל לבחור האם לשמור את כל הנתונים שלך בארכיון לצפייה עתידית (Read-only), או למחוק את כל הנתונים מהשרתים לצמיתות באופן מיידי.';
        } else {
          reply = 'מערכת ProFlow מספקת ניהול עסק חכם, הצעות מחיר, קטלוג מוצרים ושירותים, חתימות דיגיטליות, ניהול אזורי פעילות LCL/Intl ודוחות פיננסיים. שאל אותי למשל על: הוספת מוצר לקטלוג, יצירת הצעת מחיר, ניהול לקוחות, ביטול מנוי, או יצירת קשר!';
        }
      }
    } else {
      if (!isDashboard) {
        if (lower.includes('price') || lower.includes('cost') || lower.includes('plan')) {
          reply = 'We offer 3 main plans: Free ($0), Basic (starting at $12/mo billed annually), and our most popular Pro Business plan ($23/mo billed annually).';
        } else if (lower.includes('trial') || lower.includes('free') || lower.includes('14')) {
          reply = 'The 14-day free trial gives you full access to all PRO features with zero obligations!';
        } else if (lower.includes('tax') || lower.includes('vat')) {
          reply = 'Prices for Israeli clients include 18% VAT as required by law, while international clients are billed at 0% VAT automatically.';
        } else if (lower.includes('team') || lower.includes('employees') || lower.includes('staff') || lower.includes('users')) {
          reply = 'With the PRO plan, you can manage user access and add team members to handle sales and business operations efficiently.';
        } else if (lower.includes('logo') || lower.includes('brand') || lower.includes('colors') || lower.includes('design')) {
          reply = 'Yes! You can upload your business logo in your settings, and it will automatically appear at the top of every price quote you send to clients.';
        } else if (lower.includes('invoice') || lower.includes('payment') || lower.includes('credit card') || lower.includes('paypal')) {
          reply = 'Subscriptions are securely paid via credit card or digital methods with proper receipts provided. ProFlow focuses on smart price quoting, digital signatures, and client billing.';
        } else if (lower.includes('import') || lower.includes('excel') || lower.includes('migrate')) {
          reply = 'Yes, you can easily import your client database into ProFlow CRM, and export all data to CSV format at any time.';
        } else if (lower.includes('integration') || lower.includes('api') || lower.includes('connect')) {
          reply = 'ProFlow supports seamless integrations, direct WhatsApp messaging, and easy data exporting to external tools and Excel.';
        } else if (lower.includes('cancel') || lower.includes('freeze') || lower.includes('pause') || lower.includes('unsubscribe')) {
          reply = 'You can cancel or freeze your subscription at any time with no commitments. During cancellation from the "Business Settings" screen, you can choose to permanently delete all your data or archive it for future read-only access.';
        } else {
          reply = 'ProFlow is a cloud-based SaaS platform for smart business management and price quoting. Feel free to ask about our pricing, free trial, or features!';
        }
      } else {
        if (lower === 'email' || lower === 'mail' || lower === 'e-mail') {
          reply = 'Are you referring to contacting customer support via email, or sending a quote via email to a client?';
          options = [
            { label: '📞 Contact Support', action: 'contact_support' },
            { label: '📄 Send Quote via Email', action: 'send_quote_email' }
          ];
        } else if (lower === 'edit' || lower === 'change' || lower === 'modify') {
          reply = 'What would you like to edit? Please select an option:';
          options = [
            { label: '✏️ Edit an existing quote', action: 'edit_quote' },
            { label: '👥 Edit client details (CRM)', action: 'edit_client' },
            { label: '📦 Edit catalog service/product', action: 'edit_catalog' },
            { label: '⚙️ Edit business settings', action: 'edit_settings' }
          ];
        } else if (lower === 'delete' || lower === 'remove') {
          reply = 'What would you like to delete? Please select an option:';
          options = [
            { label: '🗑️ Delete a quote', action: 'delete_quote' },
            { label: '👥 Delete a client', action: 'delete_client' },
            { label: '📦 Delete a catalog item', action: 'delete_catalog' },
            { label: '📊 Delete an expense', action: 'delete_expense' },
            { label: '🛑 Cancel Subscription', action: 'cancel_subscription' }
          ];
        } else if (lower === 'client' || lower === 'clients') {
          reply = 'Are you referring to managing your client database or creating a new quote for a client?';
          options = [
            { label: '👥 Manage Clients Database (CRM)', action: 'manage_clients' },
            { label: '➕ Create New Quote for Client', action: 'new_quote' }
          ];
        } else if (lower.includes('send') && lower.includes('quote') && lower.includes('email')) {
          reply = 'To send a quote via email to your client, click the "Actions ▼" menu on the quote row and select "Send Email" (sent via support@quotecodepro.com).';
        } else if (lower.includes('support') || lower.includes('email') || lower.includes('contact') || lower.includes('reach out') || lower.includes('customer service')) {
          reply = 'You can contact our support team directly via email at support@quotecodepro.com, or continue getting immediate 24/7 assistance right here through the AI assistant. Please note that ProFlow operates as a fully digital cloud platform without public walk-in offices.';
        } else if (lower.includes('catalog') || lower.includes('product') || lower.includes('add catalog') || lower.includes('catalog item')) {
          reply = 'To add a product or service to the catalog: scroll down on the main "Quotes" tab to the "Services & Products Catalog" section. Enter the service name and fixed price, then click "Add to Catalog". You can then quickly select it when building quotes!';
        } else if (lower.includes('action') || lower.includes('menu') || lower.includes('button') || lower.includes('view')) {
          reply = 'In the quotes table, click the "Actions ▼" button on any row to open a menu where you can view, edit, duplicate, WhatsApp/email, or delete the quote.';
        } else if (lower.includes('quote') || lower.includes('create')) {
          reply = 'To create a new quote, click "Create New Quote" at the top of your dashboard, fill in client details, add items, and click generate.';
        } else if (lower.includes('whatsapp')) {
          reply = 'You can send quotes directly via WhatsApp using the actions menu in your quotes list (PRO feature).';
        } else if (lower.includes('physical') || lower.includes('office') || lower.includes('address') || lower.includes('visit') || lower.includes('meeting') || lower.includes('location') || lower.includes('in-person')) {
          reply = 'ProFlow is a fully cloud-based digital SaaS platform operating online, and therefore does not have a physical walk-in office or public reception. All business operations, quote generation, and support are managed seamlessly and securely online via the platform or through our digital support channels 24/7!';
        } else if (lower.includes('sort') || lower.includes('column')) {
          reply = 'You can sort the quotes table by clicking on any column header (Order #, Client Name, Amount, Date, Status, or Views).';
        } else if (lower.includes('lcl') || lower.includes('intl') || lower.includes('region') || lower.includes('admin')) {
          reply = 'In the Super Admin panel, you can manage user subscription plans, grant Lifetime access, and control business regions (LCL in green for Israel or Intl in red for international).';
        } else if (lower.includes('cancel subscription') || lower.includes('unsubscribe') || lower.includes('freeze') || lower.includes('pause') || lower.includes('delete account')) {
          reply = 'To cancel or freeze your subscription: go to the "Business Settings" tab and scroll down to "Subscription Management". Click "Cancel Subscription" – during the cancellation process, you can complete a quick exit survey and choose whether to archive your data for future read-only access or delete it permanently.';
        } else {
          reply = 'ProFlow provides smart business management, quotes, product catalog, digital signatures, region management (LCL/Intl), and financial reports. Feel free to ask about adding catalog items, creating quotes, managing clients, canceling subscriptions, or contacting support!';
        }
      }
    }

    return { reply, options };
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    setTimeout(() => {
      const { reply, options } = processUserQuery(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, options }]);
      setLoading(false);
    }, 400);
  };

  const handleOptionSelect = (action) => {
    let simulatedQuery = '';
    if (action === 'contact_support') {
      simulatedQuery = isHebrew ? 'יצירת קשר עם שירות הלקוחות' : 'Contact Support';
    } else if (action === 'send_quote_email') {
      simulatedQuery = isHebrew ? 'שליחת הצעת מחיר במייל' : 'Send Quote via Email';
    } else if (action === 'edit_quote') {
      simulatedQuery = isHebrew ? 'עריכת הצעת מחיר' : 'Edit an existing quote';
    } else if (action === 'edit_client') {
      simulatedQuery = isHebrew ? 'עריכת פרטי לקוח' : 'Edit client details';
    } else if (action === 'edit_catalog') {
      simulatedQuery = isHebrew ? 'עריכת שירות בקטלוג' : 'Edit catalog service';
    } else if (action === 'edit_settings') {
      simulatedQuery = isHebrew ? 'עריכת הגדרות עסק' : 'Edit business settings';
    } else if (action === 'delete_quote') {
      simulatedQuery = isHebrew ? 'מחיקת הצעת מחיר' : 'Delete a quote';
    } else if (action === 'delete_client') {
      simulatedQuery = isHebrew ? 'מחיקת לקוח' : 'Delete a client';
    } else if (action === 'delete_catalog') {
      simulatedQuery = isHebrew ? 'מחיקת שירות מהקטלוג' : 'Delete a catalog item';
    } else if (action === 'delete_expense') {
      simulatedQuery = isHebrew ? 'מחיקת הוצאה' : 'Delete an expense';
    } else if (action === 'manage_clients') {
      simulatedQuery = isHebrew ? 'ניהול ספר לקוחות' : 'Manage Clients Database';
    } else if (action === 'new_quote') {
      simulatedQuery = isHebrew ? 'יצירת הצעת מחיר חדשה' : 'Create New Quote';
    } else if (action === 'cancel_subscription') {
      simulatedQuery = isHebrew ? 'ביטול מנוי' : 'Cancel subscription';
    }

    setMessages(prev => [...prev, { role: 'user', content: simulatedQuery }]);
    setLoading(true);

    setTimeout(() => {
      const { reply } = processUserQuery(simulatedQuery);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, options: null }]);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="no-print ai-chat-container" style={{ 
      position: 'fixed', 
      bottom: '24px', 
      left: 0, 
      right: 0, 
      pointerEvents: 'none',
      display: 'flex', 
      justifyContent: 'center',
      zIndex: 999999
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1050px',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'flex-start',
      }}>
        <div style={{
          position: 'relative',
          pointerEvents: 'auto', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}>
          
          <style>{`
            @media (max-width: 768px) {
              .ai-chat-container {
                bottom: 85px !important;
              }
              .ai-chat-popup {
                position: fixed !important;
                top: 0 !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100% !important;
                height: 100% !important;
                max-width: 100% !important;
                max-height: 100% !important;
                margin: 0 !important;
                border-radius: 0 !important;
                box-sizing: border-box !important;
                z-index: 999999 !important;
                transform: none !important;
              }
            }
          `}</style>

          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className="ai-support-btn"
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '30px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                boxShadow: '0 10px 25px rgba(79, 70, 229, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              <span className="ai-btn-text" style={{ whiteSpace: 'nowrap' }}>{isHebrew ? 'צאט AI' : 'AI Chat'}</span>
            </button>
          )}

          {isOpen && (
            <div className="ai-chat-popup" style={{
              position: 'absolute',
              bottom: 'calc(100% + 15px)',
              [isHebrew ? 'right' : 'left']: '0',
              width: '360px',
              height: '520px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              textAlign: isHebrew ? 'right' : 'left'
            }} dir={isHebrew ? 'rtl' : 'ltr'}>
              <div style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>✨</span>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{isHebrew ? 'שירות לקוחות ProFlow' : 'ProFlow Support'}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{isHebrew ? '🟢 זמין 24/7' : '🟢 Available 24/7'}</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}
                >
                  ✕
                </button>
              </div>

              <div 
                ref={scrollContainerRef} 
                style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc' }}
              >
                {messages.map((msg, idx) => (
                  <div key={idx} style={{
                    alignSelf: msg.role === 'user' ? (isHebrew ? 'flex-start' : 'flex-end') : (isHebrew ? 'flex-end' : 'flex-start'),
                    background: msg.role === 'user' ? '#4f46e5' : 'white',
                    color: msg.role === 'user' ? 'white' : '#1e293b',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    fontSize: '0.85rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                    lineHeight: '1.4',
                    textAlign: isHebrew ? 'right' : 'left'
                  }}>
                    {msg.content}
                    {msg.options && msg.options.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                        {msg.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            onClick={() => handleOptionSelect(opt.action)}
                            style={{
                              background: '#f1f5f9',
                              color: '#4f46e5',
                              border: '1px solid #cbd5e1',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: '600',
                              textAlign: isHebrew ? 'right' : 'left',
                              transition: 'all 0.2s'
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div style={{ alignSelf: isHebrew ? 'flex-end' : 'flex-start', background: 'white', padding: '8px 12px', borderRadius: '12px', fontSize: '0.8rem', color: '#64748b', border: '1px solid #e2e8f0' }}>
                    {isHebrew ? 'מקליד תשובה...' : 'Typing...'}
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} style={{ padding: '10px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isHebrew ? 'שאל משהו...' : 'Ask something...'}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', textAlign: isHebrew ? 'right' : 'left', color: '#000000' }}
                />
                <button
                  type="submit"
                  style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ➤
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}