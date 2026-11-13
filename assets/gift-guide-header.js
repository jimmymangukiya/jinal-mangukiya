/* Opens / closes the mobile dropdown menu */
(function () {
  const OPEN_CLASS = 'is-open';
  const DESKTOP_QUERY = window.matchMedia('(min-width: 990px)');

  function initHeader(header) {
    const menuButton = header.querySelector('[data-gift-guide-menu-button]');
    const menuContent = header.querySelector('[data-gift-guide-content]');
    if (!menuButton || !menuContent) return;

    function isMenuOpen() {
      return menuButton.getAttribute('aria-expanded') === 'true';
    }

    function setMenuOpen(isOpen) {
      menuContent.classList.toggle(OPEN_CLASS, isOpen);
      menuButton.setAttribute('aria-expanded', String(isOpen));
    }

    // Hamburger click: open / close the menu
    menuButton.addEventListener('click', () => setMenuOpen(!isMenuOpen()));

    // Escape closes the menu and returns focus to the hamburger
    header.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isMenuOpen()) {
        setMenuOpen(false);
        menuButton.focus();
      }
    });

    // Click outside the header closes the menu
    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) setMenuOpen(false);
    });

    // Reset state when the viewport grows to desktop
    DESKTOP_QUERY.addEventListener('change', (event) => {
      if (event.matches) setMenuOpen(false);
    });
  }

  document.querySelectorAll('[data-gift-guide-header]').forEach(initHeader);
})();
