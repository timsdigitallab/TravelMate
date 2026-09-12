// Login gate rendered before the router mounts. Deliberately sign-in only -
// no sign-up form - the app's one account is created once via the Firebase
// Console (see README). Resolves once sign-in succeeds.
import { signIn, resetPassword } from '../auth.js';

const ERROR_MESSAGES = {
  'auth/invalid-email': 'That email address looks wrong.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts - wait a bit and try again.',
  'auth/network-request-failed': 'No connection right now - try again once you are online.',
};

export function showLoginScreen() {
  return new Promise((resolve) => {
    const container = document.getElementById('view');
    container.innerHTML = `
      <div class="login-screen">
        <h1>WAT Organizer</h1>
        <p class="form-hint">Sign in to sync your trip data across devices.</p>
        <form data-login-form>
          <label class="form-field" for="login-email">
            <span>Email</span>
            <input type="email" id="login-email" name="email" required autocomplete="username" />
          </label>
          <label class="form-field" for="login-password">
            <span>Password</span>
            <input type="password" id="login-password" name="password" required autocomplete="current-password" />
          </label>
          <p class="form-hint" data-login-error hidden></p>
          <button type="submit" class="button button--primary">Sign in</button>
          <button type="button" class="button button--ghost" data-forgot-password>Forgot password?</button>
        </form>
      </div>`;

    const form = container.querySelector('[data-login-form]');
    const errorEl = container.querySelector('[data-login-error]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const email = form.elements.namedItem('email').value.trim();
      const password = form.elements.namedItem('password').value;
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      try {
        await signIn(email, password);
        resolve();
      } catch (err) {
        errorEl.textContent = ERROR_MESSAGES[err.code] || 'Sign-in failed. Please try again.';
        errorEl.hidden = false;
        submitButton.disabled = false;
      }
    });

    container.querySelector('[data-forgot-password]').addEventListener('click', async () => {
      const email = form.elements.namedItem('email').value.trim();
      if (!email) {
        errorEl.textContent = 'Enter your email above first, then tap "Forgot password?" again.';
        errorEl.hidden = false;
        return;
      }
      try {
        await resetPassword(email);
        errorEl.textContent = 'Password reset email sent - check your inbox.';
        errorEl.hidden = false;
      } catch (err) {
        errorEl.textContent = ERROR_MESSAGES[err.code] || 'Could not send reset email.';
        errorEl.hidden = false;
      }
    });
  });
}
