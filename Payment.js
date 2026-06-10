document.addEventListener("DOMContentLoaded", setupPaymentPage);

async function setupPaymentPage() {
  const tournamentSelect = document.getElementById("tournamentId");
  const paymentMessage = document.getElementById("paymentMessage");
  const receiptArea = document.getElementById("receiptArea");

  try {
    const tournaments = await TournamentApp.apiFetch("/tournaments");
    tournamentSelect.innerHTML = tournaments
      .map(tournament => `<option value="${tournament.id}">${tournament.title} • ${tournament.date}</option>`)
      .join("");
  } catch (error) {
    tournamentSelect.innerHTML = `<option value="">Could not load tournaments</option>`;
  }

  document.getElementById("paymentForm").addEventListener("submit", async event => {
    event.preventDefault();

    try {
      const registration = await TournamentApp.apiFetch("/registrations", {
        method: "POST",
        body: JSON.stringify({
          playerName: document.getElementById("playerName").value.trim(),
          gameId: document.getElementById("gameId").value.trim(),
          teamName: document.getElementById("teamName").value.trim(),
          tournamentId: Number(tournamentSelect.value),
        }),
      });

      const payment = await TournamentApp.apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          registrationId: registration.id,
          amountCents: 2500,
          currency: "USD",
          provider: "Demo Gateway",
        }),
      });

      paymentMessage.textContent = payment.gatewayMessage;
      receiptArea.innerHTML = `
        <p>Registration ID: ${registration.id}</p>
        <p>Payment Reference: ${payment.payment.reference}</p>
        <p>Status: ${payment.payment.status}</p>
        <p>Amount: $${(payment.payment.amountCents / 100).toFixed(2)}</p>
      `;
    } catch (error) {
      paymentMessage.textContent = error.message;
    }
  });
}
