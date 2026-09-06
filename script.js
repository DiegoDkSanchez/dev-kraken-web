const header = document.querySelector("[data-header]");

if (header) {
  let wasScrolled;
  const syncHeaderState = () => {
    const isScrolled = window.scrollY > 12;
    if (isScrolled === wasScrolled) return;
    header.classList.toggle("is-scrolled", isScrolled);
    wasScrolled = isScrolled;
  };
  syncHeaderState();
  window.addEventListener("scroll", syncHeaderState, { passive: true });
}

const revealElements = document.querySelectorAll("[data-reveal]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (revealElements.length && !reducedMotion.matches && "IntersectionObserver" in window) {
  const pending = new Set();
  const reveal = (element) => {
    element.classList.remove("reveal-pending");
    observer.unobserve(element);
    pending.delete(element);
    if (!pending.size) {
      observer.disconnect();
      document.removeEventListener("focusin", onFocus);
      reducedMotion.removeEventListener("change", onMotionChange);
    }
  };
  const onFocus = (event) => {
    const group = event.target.closest("[data-reveal]");
    if (group && pending.has(group)) reveal(group);
  };
  const onMotionChange = (event) => {
    if (event.matches) pending.forEach(reveal);
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) reveal(entry.target);
    });
  }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });

  // Batch measurements before writes. Already-visible content never starts hidden.
  const belowViewport = Array.from(revealElements).filter(
    (element) => element.getBoundingClientRect().top >= window.innerHeight
  );
  belowViewport.forEach((element) => {
    pending.add(element);
    element.classList.add("reveal-ready", "reveal-pending");
    observer.observe(element);
  });
  if (pending.size) {
    document.addEventListener("focusin", onFocus);
    reducedMotion.addEventListener("change", onMotionChange);
  } else {
    observer.disconnect();
  }
}
