const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

function setMenu(open) {
  nav.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  document.body.style.overflow = open ? "hidden" : "";
}

menuToggle?.addEventListener("click", () => setMenu(!nav.classList.contains("open")));

// Header links to the current page scroll there without adding a hash to the URL.
document.querySelectorAll(".site-header a").forEach(link => {
  link.addEventListener("click", e => {
    setMenu(false);
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    const target = url.hash ? document.getElementById(url.hash.slice(1)) : null;
    if (url.hash && !target) return;
    e.preventDefault();
    if (target) target.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// Each .feature-tabs block is its own tab group.
document.querySelectorAll(".feature-tabs").forEach(group => {
  const buttons = group.querySelectorAll(".tab-btn");
  const panels = group.querySelectorAll(".tab-panel");

  const activate = btn => {
    buttons.forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    panels.forEach(p => p.classList.toggle("active", p.dataset.panel === btn.dataset.tab));
  };

  // Hover for mouse users; focus and click for keyboard and touch.
  buttons.forEach(btn => {
    ["mouseenter", "focus", "click"].forEach(type => btn.addEventListener(type, () => activate(btn)));
  });
});
