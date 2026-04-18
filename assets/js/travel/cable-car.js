document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("cableCarBookingBtn");
  if (btn) {
    btn.addEventListener("click", cableCarBooking);
  }
});

function cableCarBooking() {
  const errorEl = document.getElementById("cableCarError");
  errorEl.textContent = "";

  try {
    // Placeholder booking logic
    // Replace later with real API integration
    alert("Cable car booking started.");
  } catch (err) {
    errorEl.textContent =
      "Sorry — booking is currently unavailable. Please try again later.";
    console.error(err);
  }
}


(function () {

  function detectWeatherDisruption(text) {
    if (!text) return false;

    const value = text.toLowerCase();
    const keywords = [
      'wind',
      'winds',
      'high winds',
      'strong winds',
      'weather',
      'adverse weather'
    ];

    return keywords.some(k => value.includes(k));
  }

  function renderWeatherBanner(reasonText) {
    const container = document.getElementById('cableCarWeatherBanner');
    if (!container) return;

    if (!detectWeatherDisruption(reasonText)) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="weather-banner">
        <strong>⚠ Weather-related disruption</strong>
        <div class="weather-banner-text">
          ${reasonText}
        </div>
      </div>
    `;
    container.style.display = 'block';
  }

  function loadStatus() {
    fetch('https://api.tfl.gov.uk/Line/cable-car/Status')
      .then(r => r.json())
      .then(data => {
        const line = data[0];
        const status = line.lineStatuses[0];

        const statusEl = document.getElementById('cableCarStatus');
        const reasonEl = document.getElementById('cableCarReason');

        statusEl.textContent =
          status.statusSeverityDescription || 'Unknown';

        if (status.reason) {
          reasonEl.textContent = status.reason;
          renderWeatherBanner(status.reason);
        } else {
          reasonEl.textContent = '';
          renderWeatherBanner(null);
        }
      })
      .catch(() => {
        document.getElementById('cableCarStatus').textContent =
          'Status unavailable';
        renderWeatherBanner(null);
      });
  }

  document.addEventListener('DOMContentLoaded', loadStatus);

})();