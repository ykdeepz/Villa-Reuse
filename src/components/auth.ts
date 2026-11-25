import { logoutUser } from "../data/profileData.js";
import { confirmAction } from "./feedback.js";

export function mountLogout(): void {
  const handleLogout = async (): Promise<void> => {
    if (!(await confirmAction({ title: "Log out?", message: "Log out of Villa-Reuse?", confirmLabel: "Log out" }))) return;
    await logoutUser();
    window.location.href = "login.html";
  };

  document.querySelectorAll<HTMLElement>('[data-logout]').forEach((button) => {
    button.addEventListener("click", handleLogout);
  });
}
