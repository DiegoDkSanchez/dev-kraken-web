const header = document.querySelector("[data-header]");

const syncHeaderState = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

if (header) {
  syncHeaderState();
  window.addEventListener("scroll", syncHeaderState, { passive: true });
}
