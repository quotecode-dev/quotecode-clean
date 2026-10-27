// Owner console 2026-10-27, typed: "מאשר את התוכנית לגיא ולמיכל, כולל שינוי ב-L-22 במסך הפניות" - the service card in the agents room
// opens one inquiry: it leaves the inquiry id here and moves to the inquiries screen, which takes it once and opens that inquiry.
let focus = null;

export function focusInquiry(id) {
  focus = typeof id === 'string' && id ? id : null;
}

// peek = read without clearing (a render may run twice); take = read and clear, once the inquiry list is loaded
export function peekInquiryFocus() {
  return focus;
}

export function takeInquiryFocus() {
  const id = focus;
  focus = null;
  return id;
}
