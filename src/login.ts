import { DEMO_USERS, loginUser } from "./data/profileData.js";
import { syncNavigation } from "./components/navigation.js";
import type { Profile } from "./data/profileData.js";

// Login is now checked by the SERVER (POST /api/auth/login): the password is
// verified against a salted hash in the database and the server sets an
// httpOnly session cookie. Nothing about the password is decided in the
// browser any more. The demo accounts all use the password shown on the
// login page (see README.md — "Demo accounts").

const ROLE_HOME: Record<string, string> = {
  member: "index.html",
  donor: "requests.html",
  moderator: "moderation.html",
  admin: "admin.html",
};

const ROLE_BY_NAME: Record<string, string> = {
  "Community Member": "index.html",
  "Item Donor / Provider": "requests.html",
  "Community Moderator": "moderation.html",
  "System Administrator": "admin.html",
};

function bootstrap(): void {
  syncNavigation();

  const form = document.getElementById("login-form");
  if (!(form instanceof HTMLFormElement)) return;

  const pageRole = document.body.dataset.pageRole || "";
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

  const alert = alertBox;

  emailInput.value = account.email;
  emailInput.readOnly = true;

  function showAlert(message: string, isError = false): void {
    alert.textContent = message;
    alert.className = `login-alert ${isError ? "login-alert--error" : "login-alert--success"}`;
    alert.style.display = "block";
  }

  function hideAlert(): void {
    alert.style.display = "none";
  }

  togglePassBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert();

    const email = emailInput.value.trim().toLowerCase();
    const pass = passwordInput.value;

    if (email !== account.email.toLowerCase()) {
      showAlert(`This page is only for ${account.name}. Use ${account.email}.`, true);
      return;
    }

    if (!pass) {
      showAlert("Please enter your password.", true);
      passwordInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";
    try {
      const user = await loginUser(email, pass);
      showAlert(`Welcome, ${user.name}. Opening your ${user.role} tools.`);
      const next = ROLE_BY_NAME[user.role] || ROLE_HOME[pageRole] || "index.html";
      window.setTimeout(() => {
        window.location.href = next;
      }, 600);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
      showAlert(err instanceof Error ? err.message : "Sign-in failed. Please try again.", true);
      passwordInput.focus();
    }
  });
}

bootstrap();
