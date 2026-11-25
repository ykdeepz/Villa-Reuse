import { DEMO_USERS, loginUser } from "./data/profileData.js";
import type { Profile } from "./data/profileData.js";

// Login and sign-up are checked by the SERVER (POST /api/auth/login and
// POST /api/auth/register): passwords are verified against salted hashes
// in the database and the server sets an httpOnly session cookie.
//
// There is ONE community account type now: the same account browses,
// requests, and posts items. login.html is the single entry point with
// both Sign In and Create Account. Moderators and Admins keep their own
// small sign-in pages (data-page-role="moderator" | "admin"), linked
// discreetly from the bottom of login.html.

const ROLE_HOME: Record<string, string> = {
  "Community Member": "index.html",
  "Community Moderator": "moderation.html",
  "System Administrator": "admin.html",
};

function homeFor(user: Profile): string {
  return ROLE_HOME[user.role] || "index.html";
}

function wirePasswordToggle(toggleBtn: HTMLButtonElement, passwordInput: HTMLInputElement): void {
  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
}

function makeAlert(alertBox: HTMLElement): {
  show: (message: string, isError?: boolean) => void;
  hide: () => void;
} {
  return {
    show(message: string, isError = false): void {
      alertBox.textContent = message;
      alertBox.className = `login-alert ${isError ? "login-alert--error" : "login-alert--success"}`;
      alertBox.style.display = "block";
    },
    hide(): void {
      alertBox.style.display = "none";
    },
  };
}

/** The staff pages (moderator / admin): one pre-filled demo account each. */
function bootstrapStaffPage(pageRole: string): void {
  const form = document.getElementById("login-form");
  if (!(form instanceof HTMLFormElement)) return;
  const account: Profile | undefined = DEMO_USERS[pageRole];
  if (!account) return;

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const togglePassBtn = document.getElementById("toggle-password");
  const submitBtn = document.getElementById("submit-login-btn");
  const alertBox = document.getElementById("login-alert");
  if (
    !(emailInput instanceof HTMLInputElement) ||
    !(passwordInput instanceof HTMLInputElement) ||
    !(togglePassBtn instanceof HTMLButtonElement) ||
    !(submitBtn instanceof HTMLButtonElement) ||
    !alertBox
  ) {
    return;
  }

  const alert = makeAlert(alertBox);
  emailInput.value = account.email;
  emailInput.readOnly = true;
  wirePasswordToggle(togglePassBtn, passwordInput);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alert.hide();

    const email = emailInput.value.trim().toLowerCase();
    const pass = passwordInput.value;
    if (email !== account.email.toLowerCase()) {
      alert.show(`This page is only for ${account.name}. Use ${account.email}.`, true);
      return;
    }
    if (!pass) {
      alert.show("Please enter your password.", true);
      passwordInput.focus();
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Signing in...";
    try {
      const user = await loginUser(email, pass);
      alert.show(`Welcome, ${user.name}. Opening your ${user.role} tools.`);
      window.setTimeout(() => {
        window.location.href = homeFor(user);
      }, 600);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      alert.show(err instanceof Error ? err.message : "Sign-in failed. Please try again.", true);
      passwordInput.focus();
    }
  });
}

/** login.html: single sign-in form + create-account form for everyone. */
function bootstrapUnifiedPage(): void {
  const loginFormEl = document.getElementById("login-form");
  const signupFormEl = document.getElementById("signup-form");
  if (!(loginFormEl instanceof HTMLFormElement) || !(signupFormEl instanceof HTMLFormElement)) return;
  const loginForm: HTMLFormElement = loginFormEl;
  const signupForm: HTMLFormElement = signupFormEl;

  const title = document.getElementById("auth-title");
  const subtitle = document.getElementById("auth-subtitle");
  const showSignup = document.getElementById("show-signup");
  const showLogin = document.getElementById("show-login");

  function setMode(mode: "login" | "signup"): void {
    const signingUp = mode === "signup";
    loginForm.hidden = signingUp;
    signupForm.hidden = !signingUp;
    if (title) title.textContent = signingUp ? "Create your account" : "Welcome back";
    if (subtitle) {
      subtitle.textContent = signingUp
        ? "One free account for the whole neighborhood — browse, request, and post items with the same sign-in."
        : "Sign in with your Villa-Reuse account — one account lets you browse, request, and post items.";
    }
  }
  showSignup?.addEventListener("click", (e) => { e.preventDefault(); setMode("signup"); });
  showLogin?.addEventListener("click", (e) => { e.preventDefault(); setMode("login"); });
  if (window.location.hash === "#signup") setMode("signup");

  // ---- sign in
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const togglePassBtn = document.getElementById("toggle-password");
  const submitBtn = document.getElementById("submit-login-btn");
  const alertBox = document.getElementById("login-alert");
  if (
    emailInput instanceof HTMLInputElement &&
    passwordInput instanceof HTMLInputElement &&
    togglePassBtn instanceof HTMLButtonElement &&
    submitBtn instanceof HTMLButtonElement &&
    alertBox
  ) {
    const alert = makeAlert(alertBox);
    wirePasswordToggle(togglePassBtn, passwordInput);

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      alert.hide();
      const email = emailInput.value.trim().toLowerCase();
      const pass = passwordInput.value;
      if (!email) { alert.show("Please enter your email.", true); emailInput.focus(); return; }
      if (!pass) { alert.show("Please enter your password.", true); passwordInput.focus(); return; }

      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = "Signing in...";
      try {
        const user = await loginUser(email, pass);
        alert.show(`Welcome, ${user.name}. Opening Villa-Reuse for you.`);
        window.setTimeout(() => {
          window.location.href = homeFor(user);
        }, 600);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        alert.show(err instanceof Error ? err.message : "Sign-in failed. Please try again.", true);
        passwordInput.focus();
      }
    });
  }

  // ---- sign up
  const nameInput = document.getElementById("signup-name");
  const signupEmail = document.getElementById("signup-email");
  const signupPassword = document.getElementById("signup-password");
  const signupBtn = document.getElementById("submit-signup-btn");
  const signupAlertBox = document.getElementById("signup-alert");
  if (
    nameInput instanceof HTMLInputElement &&
    signupEmail instanceof HTMLInputElement &&
    signupPassword instanceof HTMLInputElement &&
    signupBtn instanceof HTMLButtonElement &&
    signupAlertBox
  ) {
    const alert = makeAlert(signupAlertBox);
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      alert.hide();
      const name = nameInput.value.trim();
      const email = signupEmail.value.trim().toLowerCase();
      const pass = signupPassword.value;
      if (!name) { alert.show("Please enter your name.", true); nameInput.focus(); return; }
      if (!email) { alert.show("Please enter your email.", true); signupEmail.focus(); return; }
      if (!pass || pass.length < 6) {
        alert.show("Password must be at least 6 characters.", true);
        signupPassword.focus();
        return;
      }

      signupBtn.disabled = true;
      const originalLabel = signupBtn.textContent;
      signupBtn.textContent = "Creating account...";
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password: pass }),
        });
        const data = (await res.json().catch(() => ({}))) as { user?: Profile; error?: string };
        if (!res.ok || !data.user) {
          throw new Error(data.error || "Could not create the account. Please try again.");
        }
        alert.show(`Welcome to Villa-Reuse, ${data.user.name}! Your account is ready.`);
        window.setTimeout(() => {
          window.location.href = "index.html";
        }, 600);
      } catch (err) {
        signupBtn.disabled = false;
        signupBtn.textContent = originalLabel;
        alert.show(err instanceof Error ? err.message : "Could not create the account. Please try again.", true);
      }
    });
  }
}

function bootstrap(): void {
  const pageRole = document.body.dataset.pageRole || "";
  if (pageRole === "moderator" || pageRole === "admin") {
    bootstrapStaffPage(pageRole);
  } else {
    bootstrapUnifiedPage();
  }
}

bootstrap();
