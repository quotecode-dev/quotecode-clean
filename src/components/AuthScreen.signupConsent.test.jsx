// Owner 2026-10-15: the signup form has a required, never pre-ticked Terms of Use + Privacy Policy consent (links open in a new tab)
// and two optional fields (full name, business name). The sign-in form shows none of them.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import AuthScreen from './AuthScreen';

afterEach(() => cleanup());

function Harness({ isSignUp, isHebrew }) {
  const [fullName, setFullName] = useState('');
  const [bizName, setBizName] = useState('');
  const [accepted, setAccepted] = useState(false);
  return (
    <AuthScreen bundleIsHebrew={isHebrew} isInitializing={false} isPasswordRecoveryMode={false} isSignUp={isSignUp} setIsSignUp={() => {}}
      authSuccess="" authError="" handleAuth={(e) => e.preventDefault()} authLoading={false} emailInput="" setEmailInput={() => {}}
      passwordInput="" setPasswordInput={() => {}} forgotOpen={false} setForgotOpen={() => {}} resetMsg="" resetMsgIsError={false}
      handleResetSubmit={() => {}} resetEmail="" setResetEmail={() => {}} resetLoading={false}
      signupFullName={fullName} setSignupFullName={setFullName} signupBusinessName={bizName} setSignupBusinessName={setBizName}
      signupTermsAccepted={accepted} setSignupTermsAccepted={setAccepted} />
  );
}

describe('AuthScreen signup consent + optional fields', () => {
  it.each([
    [true, 'תנאי השימוש', '/he/terms', 'מדיניות הפרטיות', '/he/privacy', /לא חובה/],
    [false, 'Terms of Use', '/en/terms', 'Privacy Policy', '/en/privacy', /optional/],
  ])('isHebrew=%s: unticked required checkbox, market links in a new tab, optional name fields', (he, terms, termsHref, privacy, privacyHref, optional) => {
    const { getByTestId, getByText, container } = render(<Harness isSignUp isHebrew={he} />);
    const box = getByTestId('signup-terms-consent');
    expect(box.checked).toBe(false);
    expect(box.required).toBe(true);
    const t = getByText(terms); const p = getByText(privacy);
    expect(t.getAttribute('href')).toBe(termsHref); expect(t.getAttribute('target')).toBe('_blank');
    expect(p.getAttribute('href')).toBe(privacyHref); expect(p.getAttribute('target')).toBe('_blank');
    expect(getByTestId('signup-full-name').required).toBe(false);
    expect(getByTestId('signup-business-name').required).toBe(false);
    expect(container.textContent).toMatch(optional);
    if (!he) expect(container.textContent).not.toMatch(/[֐-׿]/);
    fireEvent.click(box);
    expect(getByTestId('signup-terms-consent').checked).toBe(true);
    fireEvent.change(getByTestId('signup-business-name'), { target: { value: 'Cohen Windows' } });
    expect(getByTestId('signup-business-name').value).toBe('Cohen Windows');
  });
  it('the sign-in form has no consent checkbox and no name fields', () => {
    const { queryByTestId } = render(<Harness isSignUp={false} isHebrew />);
    expect(queryByTestId('signup-terms-consent')).toBeNull();
    expect(queryByTestId('signup-full-name')).toBeNull();
    expect(queryByTestId('signup-business-name')).toBeNull();
  });
});
