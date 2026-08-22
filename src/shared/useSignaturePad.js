import { useRef, useState } from 'react';

// לוגיקת ציור החתימה הדיגיטלית (קנבס) זהה לחלוטין בין PublicQuote.jsx (עברית)
// ל-PublicQuoteEn.jsx (אנגלית) - לא תלויה בשפה בשום שלב, ולכן חולצה לכאן כדי
// שהשכפול לא ימשיך לסטות בין שני הקבצים. טקסטים/הודעות שפה נשארים בכל קובץ בנפרד.
export function useSignaturePad() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const getPoint = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPoint(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPoint(e, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const getSignatureDataUrl = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : null;
  };

  return { canvasRef, hasSigned, startDrawing, draw, stopDrawing, clearSignature, getSignatureDataUrl };
}
