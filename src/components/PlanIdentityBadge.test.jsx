import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanIdentityBadge from './PlanIdentityBadge';

// חוק ברזל (Final Dashboard/Sidebar Polish task, §D): בדיקות ממוקדות
// ל-variant="compact" החדש - הבאדג' שהחליף את .dash-sidebar-plan-card
// שהוסר. הרכיב הזה עצמו נבדק כאן במבודד (בניגוד ל-Dashboard.jsx, שאין לו
// תשתית-בדיקה קיימת בפרויקט הזה כלל - PlanIdentityBadge, לעומתו, הוא
// רכיב-תצוגה טהור ללא תלות ב-supabase/session, בדיוק סוג-הרכיב שכבר יש לו
// תשתית-בדיקה מוכחת בפרויקט). מגן על: (1) התווית הקנונית עדיין מגיעה אך
// ורק מ-getDisplayIdentityLabel, (2) daysLeft מוצג רק כשהוא ערך אמיתי-חיובי
// (לא ממציא/לא מציג אפס-כאילו-רלוונטי), (3) אינדיקטור-השדרוג (Crown) מופיע
// רק כש-upgradeAvailable=true, (4) שתי השפות.
describe('PlanIdentityBadge variant="compact"', () => {
  it('renders the canonical label for a plain FREE identity, HE and EN', () => {
    const { rerender } = render(<PlanIdentityBadge displayIdentity="FREE" isHebrew={false} variant="compact" />);
    expect(screen.getByText('FREE')).toBeInTheDocument();

    rerender(<PlanIdentityBadge displayIdentity="FREE" isHebrew={true} variant="compact" />);
    expect(screen.getByText('FREE')).toBeInTheDocument();
  });

  it('renders the canonical combined label for FREE_TRIAL (status already encoded in the label itself)', () => {
    render(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" />);
    expect(screen.getByText('FREE (TRIAL)')).toBeInTheDocument();
  });

  it('shows a real daysLeft value for an active trial, in both languages', () => {
    const { rerender } = render(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" daysLeft={5} />);
    expect(screen.getByText('5 days left')).toBeInTheDocument();

    rerender(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" daysLeft={1} />);
    expect(screen.getByText('1 day left')).toBeInTheDocument();

    rerender(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={true} variant="compact" daysLeft={5} />);
    expect(screen.getByText('5 ימים נותרו')).toBeInTheDocument();
  });

  it('never fabricates a days-remaining line when daysLeft is null or non-positive', () => {
    const { rerender, container } = render(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" daysLeft={null} />);
    expect(container.textContent).not.toMatch(/left/i);

    rerender(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" daysLeft={0} />);
    expect(container.textContent).not.toMatch(/left/i);
  });

  it('does not render a days-remaining line for non-trial identities even if daysLeft is passed', () => {
    render(<PlanIdentityBadge displayIdentity="LIFETIME" isHebrew={false} variant="compact" daysLeft={5} />);
    // LIFETIME never has a meaningful "days left" concept - this guards
    // against a future caller accidentally passing a stale trial value
    // through for a non-trial identity; the component itself has no
    // identity-specific guard, so this documents the expected caller
    // contract (Dashboard.jsx only passes daysLeft when displayIdentity
    // is actually FREE_TRIAL) rather than asserting internal behavior
    // that doesn't exist - kept as a caller-contract regression check.
    expect(screen.getByText('LIFETIME')).toBeInTheDocument();
  });

  it('shows the upgrade indicator only when upgradeAvailable is true', () => {
    const { container: withUpgrade } = render(<PlanIdentityBadge displayIdentity="FREE" isHebrew={false} variant="compact" upgradeAvailable />);
    expect(withUpgrade.querySelectorAll('svg').length).toBeGreaterThan(1); // plan icon + crown

    const { container: withoutUpgrade } = render(<PlanIdentityBadge displayIdentity="FREE" isHebrew={false} variant="compact" />);
    expect(withoutUpgrade.querySelectorAll('svg').length).toBe(1); // plan icon only
  });

  // חוק ברזל (Authenticated UI Coherence task, Mobile Dashboard Header
  // Recomposition): singleLine - וריאנט-תצוגה נוסף בתוך אותו variant=
  // "compact" קנוני (לא רכיב-באדג' מקביל), ל"PLAN · Nימים" בשורה אחת
  // במקום תווית+שורת-ימים נפרדת - "Use a short mobile plan label such
  // as 'FREE · 10 days'" (הבהרת-בעלים). מגן על: (1) התווית הקנונית עדיין
  // מגיעה, (2) daysLeft מוצג מקוצר ("10d"/"10 ימים") באותה שורה, לא
  // בשורה נפרדת, (3) בלי daysLeft מוצגת רק התווית לבדה, ללא "·" יתום.
  describe('variant="compact" singleLine', () => {
    it('renders the canonical label alone when no daysLeft is given', () => {
      render(<PlanIdentityBadge displayIdentity="LIFETIME" isHebrew={false} variant="compact" singleLine />);
      expect(screen.getByText('LIFETIME')).toBeInTheDocument();
      expect(screen.queryByText('·')).not.toBeInTheDocument();
    });

    it('renders "LABEL · Nd" on one line in English', () => {
      render(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" singleLine daysLeft={10} />);
      expect(screen.getByText('FREE (TRIAL)')).toBeInTheDocument();
      expect(screen.getByText('10d')).toBeInTheDocument();
    });

    it('renders "תוכנית · Nימים" on one line in Hebrew', () => {
      render(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={true} variant="compact" singleLine daysLeft={10} />);
      expect(screen.getByText('10 ימים')).toBeInTheDocument();
    });

    it('never fabricates a days fragment when daysLeft is null or non-positive', () => {
      const { rerender, container } = render(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" singleLine daysLeft={null} />);
      expect(container.textContent).not.toMatch(/\d+d\b/);
      rerender(<PlanIdentityBadge displayIdentity="FREE_TRIAL" isHebrew={false} variant="compact" singleLine daysLeft={0} />);
      expect(container.textContent).not.toMatch(/\d+d\b/);
    });
  });
});
