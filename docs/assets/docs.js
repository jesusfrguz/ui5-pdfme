const language = document.documentElement.lang === "en" ? "en" : "es";
const labels = language === "en"
  ? { copy: "Copy", copied: "Copied", captions: "Captions", captionsOn: "Captions on", captionsOff: "Captions off", audioEs: "Spanish (Spain)", audioEn: "English" }
  : { copy: "Copiar", copied: "Copiado", captions: "Subtítulos", captionsOn: "Subtítulos activados", captionsOff: "Subtítulos desactivados", audioEs: "Español (España)", audioEn: "Inglés" };
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

document.querySelectorAll("[data-guide-video]").forEach((player) => {
  const video = player.querySelector("video");
  const source = video?.querySelector("source");
  let track = video?.querySelector("track");
  const status = player.querySelector("[data-video-status]");
  const languageButtons = [...player.querySelectorAll("[data-video-language]")];
  const captionsButton = player.querySelector("[data-video-captions]");
  let activeLanguage = player.dataset.videoLanguage || language;
  let captionsEnabled = captionsButton?.getAttribute("aria-pressed") !== "false";

  if (!video || !source || !track) return;

  const updateStatus = () => {
    const audioLabel = activeLanguage === "es" ? labels.audioEs : labels.audioEn;
    if (status) status.textContent = `Audio: ${audioLabel} · ${captionsEnabled ? labels.captionsOn : labels.captionsOff}`;
    if (captionsButton) {
      captionsButton.textContent = `CC ${labels.captions}`;
      captionsButton.setAttribute("aria-pressed", String(captionsEnabled));
    }
  };

  const setCaptionMode = () => {
    [...video.textTracks].forEach((textTrack) => {
      textTrack.mode = captionsEnabled ? "showing" : "disabled";
    });
  };

  const replaceTrack = () => {
    const nextTrack = document.createElement("track");
    nextTrack.kind = "captions";
    nextTrack.src = player.dataset[`captions${activeLanguage === "es" ? "Es" : "En"}`];
    nextTrack.srclang = activeLanguage;
    nextTrack.label = activeLanguage === "es" ? "Español" : "English";
    nextTrack.default = captionsEnabled;
    track.replaceWith(nextTrack);
    track = nextTrack;
  };

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextLanguage = button.dataset.videoLanguage;
      if (!nextLanguage || nextLanguage === activeLanguage) return;
      const currentTime = video.currentTime;
      const shouldResume = !video.paused;
      activeLanguage = nextLanguage;
      player.dataset.videoLanguage = activeLanguage;
      source.src = player.dataset[`video${activeLanguage === "es" ? "Es" : "En"}`];
      replaceTrack();
      languageButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate.dataset.videoLanguage === activeLanguage)));
      video.load();
      video.addEventListener("loadedmetadata", () => {
        video.currentTime = Math.min(currentTime, Math.max(0, video.duration - .1));
        setCaptionMode();
        if (shouldResume) video.play().catch(() => {});
      }, { once: true });
      updateStatus();
    });
  });

  captionsButton?.addEventListener("click", () => {
    captionsEnabled = !captionsEnabled;
    setCaptionMode();
    updateStatus();
  });
  video.addEventListener("loadedmetadata", setCaptionMode);
  updateStatus();
});

const links = [...document.querySelectorAll(".side a")];
const sections = [...document.querySelectorAll("main section[id]")];
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  links.forEach((link) => link.classList.toggle("active", link.hash === `#${visible.target.id}`));
}, { rootMargin: "-15% 0px -65%", threshold: [0, .2, .6] });
sections.forEach((section) => observer.observe(section));

document.querySelectorAll("[data-screen-tour]").forEach((tour) => {
  const triggers = [...tour.querySelectorAll("[data-screen-zone]")];
  const options = [...tour.querySelectorAll(".screen-zone-option")];
  const panels = [...tour.querySelectorAll("[data-screen-panel]")];

  const activateZone = (zone) => {
    triggers.forEach((trigger) =>
      trigger.setAttribute(
        "aria-pressed",
        String(trigger.dataset.screenZone === zone),
      ),
    );
    panels.forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.screenPanel === zone),
    );
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () =>
      activateZone(trigger.dataset.screenZone),
    );
  });

  options.forEach((option, index) => {
    option.addEventListener("keydown", (event) => {
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      const direction =
        event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const next =
        options[(index + direction + options.length) % options.length];
      next.focus();
      activateZone(next.dataset.screenZone);
    });
  });

  const selected = tour.querySelector(
    '[data-screen-zone][aria-pressed="true"]',
  );
  activateZone(selected?.dataset.screenZone || options[0]?.dataset.screenZone);
});
