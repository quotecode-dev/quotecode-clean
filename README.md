> ### **חוקי ברזל לעבודה על פרויקט ProFlow:**
> 1. **סדר פעולות מחייב:** לעולם לא יישלח קובץ קוד מתוקן מבלי לקבל קודם את הקובץ הקיים מהמשתמש.
> 2. **פקודות Git:** כל פקודות ה-Git ינתנו תמיד בשורה אחת מחוברת (מופרדות בנקודה-פסיק `;`) בתוך בלוק קוד.
> 3. **בקרת איכות:** לאחר שליחת תיקון, התיקון נחשב "סגור" רק לאחר אישור המשתמש.
> 4. **גיבוי:** גיבוי מלא לענן יוצע ויבוצע אך ורק לאחר אישור שהתיקון האחרון לשביעות רצון המשתמש.
> 5. **אמינות:** אין לנחש מיקומי כפתורים או פונקציונליות. לפני כל תשובה תבוצע חקירה יסודית.
> 6. **עיצוב:** אזהרות חשובות יוצגו באדום בולט (HTML) והנחיות העתקה יסומנו בקו תחתון.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/plugin-react-swc/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.