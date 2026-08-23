const language = document.documentElement.lang === "en" ? "en" : "es";
const labels = language === "en"
  ? { copy: "Copy", copied: "Copied" }
  : { copy: "Copiar", copied: "Copiado" };
const preferredLanguage = localStorage.getItem("ui5-pdfme-docs-language");

if (preferredLanguage && preferredLanguage !== language) {
  const target = new URL(preferredLanguage === "en" ? "en.html" : "index.html", window.location.href);
  target.hash = window.location.hash;
  window.location.replace(target);
}

document.querySelector(".menu")?.addEventListener("click", () => document.querySelector(".topbar nav")?.classList.toggle("open"));

document.querySelectorAll("[data-language]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    localStorage.setItem("ui5-pdfme-docs-language", link.dataset.language);
    const target = new URL(link.href, window.location.href);
    target.hash = window.location.hash;
    window.location.assign(target);
  });
});

document.querySelectorAll("pre").forEach((block) => {
  const button = document.createElement("button");
  button.className = "copy";
  button.textContent = labels.copy;
  button.setAttribute("aria-label", labels.copy);
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(block.querySelector("code")?.textContent || block.textContent);
    button.textContent = labels.copied;
    setTimeout(() => { button.textContent = labels.copy; }, 1200);
  });
  block.append(button);
});

const links = [...document.querySelectorAll(".side a")];
const sections = [...document.querySelectorAll("main section[id]")];
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  links.forEach((link) => link.classList.toggle("active", link.hash === `#${visible.target.id}`));
}, { rootMargin: "-15% 0px -65%", threshold: [0, .2, .6] });
sections.forEach((section) => observer.observe(section));
