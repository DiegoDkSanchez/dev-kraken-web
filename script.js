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

// This short statement uses measured visual lines, not animated individual words.
const manifesto = document.querySelector("[data-manifesto]");
if (manifesto && "IntersectionObserver" in window && "ResizeObserver" in window) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prepareManifesto = () => {
    if (motionPreference.matches || manifesto.getBoundingClientRect().top < window.innerHeight) return;

    const section = manifesto.closest(".manifesto");
    const text = manifesto.textContent;
    const textNode = manifesto.firstChild;
    const range = document.createRange();
    const lines = [];
    let previousTop;

    // Read the browser's existing line breaks before making any DOM changes.
    for (const match of text.matchAll(/\S+/g)) {
      range.setStart(textNode, match.index);
      range.setEnd(textNode, match.index + match[0].length);
      const top = range.getBoundingClientRect().top;
      if (previousTop === undefined || Math.abs(top - previousTop) > 1) {
        lines.push(match.index);
        previousTop = top;
      }
    }
    if (!lines.length) return;
    const width = manifesto.getBoundingClientRect().width;
    const fragment = document.createDocumentFragment();
    const readable = document.createElement("span");
    readable.className = "manifesto-readable";
    readable.textContent = text;
    fragment.append(readable);
    lines.forEach((start, index) => {
      const mask = document.createElement("span");
      mask.className = "manifesto-line";
      mask.setAttribute("aria-hidden", "true");
      const line = document.createElement("span");
      line.textContent = text.slice(start, lines[index + 1] ?? text.length).trimEnd();
      line.style.setProperty("--line-index", index);
      mask.append(line);
      fragment.append(mask);
    });

    const finish = () => {
      observer.disconnect();
      resizeObserver.disconnect();
      motionPreference.removeEventListener("change", onMotionChange);
      manifesto.removeEventListener("animationend", onAnimationEnd);
      section.classList.remove("is-prepared", "is-revealing");
      manifesto.textContent = text;
    };
    const onMotionChange = (event) => { if (event.matches) finish(); };
    const onAnimationEnd = (event) => {
      if (event.animationName === "manifestoLineIn" && event.target === manifesto.lastElementChild.firstElementChild) finish();
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          section.classList.add("is-revealing");
        } else if (!entry.isIntersecting && section.classList.contains("is-revealing")) {
          finish(); // Fast scrolling should not leave line animations running offscreen.
        }
      });
    }, { threshold: [0, 0.25], rootMargin: "0px 0px -24px 0px" });
    // A resize during the short reveal prioritizes readable natural wrapping.
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.some((entry) => Math.abs(entry.contentRect.width - width) > 1)) finish();
    });

    section.classList.add("is-prepared");
    manifesto.replaceChildren(fragment);
    manifesto.addEventListener("animationend", onAnimationEnd);
    motionPreference.addEventListener("change", onMotionChange);
    resizeObserver.observe(manifesto);
    observer.observe(manifesto);
  };
  if (document.fonts) document.fonts.ready.then(prepareManifesto);
  else prepareManifesto();
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

const consultationModal = document.querySelector("[data-consultation-modal]");
const consultationTriggers = document.querySelectorAll("[data-consultation-trigger]");

if (consultationModal && consultationTriggers.length) {
  const state = { serviceNeed: "", existingProduct: "", name: "", email: "", phone: "", details: "" };
  const steps = [...consultationModal.querySelectorAll("[data-step]")];
  const title = consultationModal.querySelector("[data-step-title]");
  const subtitle = consultationModal.querySelector("[data-step-subtitle]");
  const kicker = consultationModal.querySelector("[data-step-kicker]");
  const progressLabel = consultationModal.querySelector("[data-progress-label]");
  const progressBar = consultationModal.querySelector("[data-progress-bar]");
  const form = consultationModal.querySelector("[data-consultation-form]");
  const confirmation = consultationModal.querySelector("[data-confirmation]");
  const copy = [
    ["Comencemos por el contexto", "¿Qué necesitas construir o mejorar?", "Cuéntame brevemente en qué etapa estás."],
    ["Un poco más de contexto", "¿Qué tienes actualmente?", "Esto me ayudará a entender mejor el punto de partida."],
    ["El siguiente paso", "Hablemos de tu proyecto", "Déjame tus datos y me pondré en contacto contigo para revisar tu caso."]
  ];
  let currentStep = 1;
  let closeTimer;
  let lastFocused;

  const showStep = (step) => {
    currentStep = step;
    steps.forEach((item) => { item.hidden = Number(item.dataset.step) !== step; });
    [kicker.textContent, title.textContent, subtitle.textContent] = copy[step - 1];
    progressLabel.textContent = `${step} de 3`;
    progressBar.style.width = `${step * 33.333}%`;
    consultationModal.querySelector(`[data-step="${step}"] button, [data-step="${step}"] input`)?.focus({ preventScroll: true });
  };
  const open = (event) => {
    event.preventDefault();
    lastFocused = event.currentTarget;
    clearTimeout(closeTimer);
    consultationModal.hidden = false;
    document.body.classList.add("modal-open");
    showStep(1);
  };
  const close = () => {
    consultationModal.hidden = true;
    document.body.classList.remove("modal-open");
    confirmation.hidden = true;
    form.querySelectorAll("[data-step]").forEach((item) => { item.hidden = Number(item.dataset.step) !== 1; });
    form.reset();
    Object.keys(state).forEach((key) => { state[key] = ""; });
    currentStep = 1;
    showStep(1);
    consultationModal.querySelectorAll("[data-existing-product]").forEach((option) => { option.disabled = false; });
    lastFocused?.focus({ preventScroll: true });
  };
  consultationTriggers.forEach((trigger) => trigger.addEventListener("click", open));
  consultationModal.querySelectorAll("[data-consultation-close]").forEach((button) => button.addEventListener("click", close));
  consultationModal.querySelectorAll("[data-consultation-back]").forEach((button) => button.addEventListener("click", () => showStep(Math.max(1, currentStep - 1))));
  consultationModal.addEventListener("click", (event) => {
    const service = event.target.closest("[data-service-need]");
    const product = event.target.closest("[data-existing-product]");
    if (service) {
      state.serviceNeed = service.dataset.serviceNeed;
      consultationModal.querySelector('[data-existing-product="none"]').disabled = state.serviceNeed === "fix";
      window.setTimeout(() => showStep(2), 220);
    }
    if (product && !(state.serviceNeed === "fix" && product.dataset.existingProduct === "none")) {
      state.existingProduct = product.dataset.existingProduct;
      window.setTimeout(() => showStep(3), 220);
    }
  });
  form.addEventListener("input", (event) => { if (event.target.name in state) state[event.target.name] = event.target.value; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.elements.email;
    const error = form.querySelector("[data-form-error]");
    if (!email.checkValidity()) { error.hidden = false; email.focus(); return; }
    error.hidden = true;
    form.querySelector("[data-submit-label]").hidden = true;
    form.querySelector("[data-submit-loading]").hidden = false;
    form.querySelector(".consultation-submit").disabled = true;
    // No contact API exists in this static site yet; this boundary is ready for one.
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    form.querySelector("[data-submit-label]").hidden = false;
    form.querySelector("[data-submit-loading]").hidden = true;
    form.querySelector(".consultation-submit").disabled = false;
    steps.forEach((item) => { item.hidden = true; });
    confirmation.hidden = false;
    confirmation.querySelector("button")?.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (consultationModal.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const focusable = [...consultationModal.querySelectorAll("button, input, textarea")].filter((el) => !el.disabled && !el.closest("[hidden]"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}
