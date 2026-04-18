window.addEventListener('DOMContentLoaded', async () => {
  try {
    window.TerminalComponents?.init();
    await window.TerminalContent?.init?.();
    await window.TerminalHome?.init?.();
    await window.PasswordGeneratorPage?.init?.();
    await window.DownloadsPage?.init?.();
    await window.GalleryPage?.init?.();
    await window.TravelTubeStatusPage?.init?.();
    await window.TravelRoutesPage?.init?.();
    await window.TravelBusesPage?.init?.();
    await window.TravelTramsPage?.init?.();
    await window.SecureAuthPage?.init?.();
  } catch (error) {
    console.error(error);
    const target = document.getElementById('pageAlert');
    if (target) {
      target.innerHTML = '<div class="notice">An error occurred while loading this terminal page: ' + error.message + '</div>';
    }
  }
});
