document.addEventListener("DOMContentLoaded", setupProfilePage);

async function setupProfilePage() {
  const user = TournamentApp.getCurrentUser();
  const profileMessage = document.getElementById("profileMessage");
  const sessionStatus = document.getElementById("sessionStatus");
  const paymentHistory = document.getElementById("paymentHistory");

  if (!user) {
    profileMessage.textContent = "Please log in first to access your profile.";
    sessionStatus.textContent = "No active session.";
    paymentHistory.textContent = "Login required.";
    document.getElementById("profileForm").style.display = "none";
    return;
  }

  profileMessage.textContent = `Signed in as ${user.email}`;
  sessionStatus.textContent = `Active session for ${user.firstName} ${user.lastName} (${user.role})`;

  document.getElementById("firstName").value = user.firstName || "";
  document.getElementById("lastName").value = user.lastName || "";
  document.getElementById("age").value = user.age || "";
  document.getElementById("bio").value = user.bio || "";
  document.getElementById("preferredTheme").value = user.preferredTheme || "cyan";

  try {
    const payments = await TournamentApp.apiFetch("/payments");
    paymentHistory.innerHTML = payments.length
      ? payments.map(payment => `<p>${payment.reference} • ${(payment.amountCents / 100).toFixed(2)} ${payment.currency} • ${payment.status}</p>`).join("")
      : "<p>No payments yet.</p>";
  } catch (error) {
    paymentHistory.textContent = error.message;
  }

  document.getElementById("profileForm").addEventListener("submit", async event => {
    event.preventDefault();

    try {
      const payload = {
        firstName: document.getElementById("firstName").value.trim(),
        lastName: document.getElementById("lastName").value.trim(),
        age: Number(document.getElementById("age").value),
        bio: document.getElementById("bio").value.trim(),
        preferredTheme: document.getElementById("preferredTheme").value,
      };

      const data = await TournamentApp.apiFetch("/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const session = TournamentApp.getStoredSession();
      TournamentApp.saveSession({ token: session.token, user: data.user });
      TournamentApp.applyTheme(data.user.preferredTheme);
      profileMessage.textContent = "Profile updated successfully.";
    } catch (error) {
      profileMessage.textContent = error.message;
    }
  });
}
