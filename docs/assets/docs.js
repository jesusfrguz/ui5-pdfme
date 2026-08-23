document.querySelector(".menu")?.addEventListener("click", () => document.querySelector(".topbar nav")?.classList.toggle("open"));

document.querySelectorAll("pre").forEach((block) => {
  const button = document.createElement("button");
  button.className = "copy";
  button.textContent = "Copiar";
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(block.querySelector("code")?.textContent || block.textContent);
    button.textContent = "Copiado";
    setTimeout(() => { button.textContent = "Copiar"; }, 1200);
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
