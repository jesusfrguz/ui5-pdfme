const localeRoot = new URL("../i18n/", import.meta.url);
const docsRoot = new URL("../", import.meta.url);
const page = document.documentElement.dataset.i18nPage || "deferred";
const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
const preferredLanguage = localStorage.getItem("ui5-pdfme-docs-language");
const fallbackManifest = {
  defaultLanguage: "es",
  languages: [{ code: "es", label: "ES", name: "Español", pages: [page] }]
};
const fallbackLabels = {
  copy: "Copiar",
  copied: "Copiado",
  captions: "Subtítulos",
  captionsOn: "Subtítulos activados",
  captionsOff: "Subtítulos desactivados",
  audioEs: "Español (España)",
  audioEn: "Inglés"
};

async function loadJson(relativePath) {
  const response = await fetch(new URL(relativePath, localeRoot), { cache: "no-cache" });
  if (!response.ok) throw new Error(`Unable to load ${relativePath}: HTTP ${response.status}`);
  return response.json();
}

function applyTranslations(translations) {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = translations[element.dataset.i18n];
    if (typeof value === "string") element.innerHTML = value;
  });

  document.querySelectorAll("[data-i18n-attrs]").forEach((element) => {
    element.dataset.i18nAttrs.split(",").forEach((binding) => {
      const separator = binding.indexOf(":");
      const attribute = binding.slice(0, separator);
      const key = binding.slice(separator + 1);
      const value = translations[key];
      if (attribute && typeof value === "string") element.setAttribute(attribute, value);
    });
  });
}

function normalizeLegacyEnglishUrl(target) {
  if (target.pathname.endsWith("/en.html")) {
    target.pathname = target.pathname.slice(0, -"en.html".length);
  }
}

function isDocumentationRoute(target) {
  if (target.origin !== docsRoot.origin || !target.pathname.startsWith(docsRoot.pathname)) return false;
  const relativePath = target.pathname.slice(docsRoot.pathname.length);
  if (/^(?:assets|downloads|examples)(?:\/|$)/.test(relativePath)) return false;
  return !/\.[^/]+$/.test(relativePath) || relativePath.endsWith(".html");
}

function localizeDocumentationLinks(language) {
  document.querySelectorAll("a[href]").forEach((link) => {
    const rawHref = link.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#") || link.hasAttribute("data-language")) return;
    const target = new URL(rawHref, window.location.href);
    normalizeLegacyEnglishUrl(target);
    if (!isDocumentationRoute(target)) return;
    target.searchParams.set("lang", language);
    link.href = target.href;
  });
}

function renderLanguageSwitch(manifest, language) {
  const languageSwitch = document.querySelector(".language-switch");
  if (!languageSwitch) return;
  const languages = manifest.languages.filter((candidate) => candidate.pages.includes(page));
  languageSwitch.replaceChildren(...languages.map((candidate) => {
    const link = document.createElement("a");
    const target = new URL(window.location.href);
    target.searchParams.set("lang", candidate.code);
    target.hash = window.location.hash;
    link.href = target.href;
    link.lang = candidate.code;
    link.hreflang = candidate.code;
    link.dataset.language = candidate.code;
    link.textContent = candidate.label;
    link.title = candidate.name;
    if (candidate.code === language) link.setAttribute("aria-current", "page");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.setItem("ui5-pdfme-docs-language", candidate.code);
      const currentTarget = new URL(link.href);
      currentTarget.hash = window.location.hash;
      window.location.assign(currentTarget);
    });
    return link;
  }));
}

async function initializeI18n() {
  let manifest = fallbackManifest;
  try {
    manifest = await loadJson("manifest.json");
  } catch (error) {
    console.warn("Documentation language manifest could not be loaded; using Spanish.", error);
  }

  const candidateLanguage = requestedLanguage || preferredLanguage || manifest.defaultLanguage;
  const candidate = manifest.languages.find((item) => item.code === candidateLanguage && item.pages.includes(page));
  const language = candidate?.code || manifest.defaultLanguage;
  let labels = fallbackLabels;

  try {
    const common = await loadJson(`${language}/common.json`);
    labels = common.labels;
    if (language !== manifest.defaultLanguage) {
      const catalog = await loadJson(`${language}/${page}.json`);
      applyTranslations(catalog.translations);
    }
  } catch (error) {
    console.warn(`Documentation translations for ${language}/${page} could not be loaded; using Spanish.`, error);
    return { language: manifest.defaultLanguage, labels: fallbackLabels, manifest };
  }

  return { language, labels, manifest };
}

const { language, labels, manifest } = await initializeI18n();
document.documentElement.lang = language;
const currentUrl = new URL(window.location.href);
currentUrl.searchParams.set("lang", language);
window.history.replaceState(null, "", currentUrl);
renderLanguageSwitch(manifest, language);
localizeDocumentationLinks(language);

document.querySelector(".menu")?.addEventListener("click", () => document.querySelector(".topbar nav")?.classList.toggle("open"));

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
  let activeLanguage = language === "en" ? "en" : "es";
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

  player.dataset.videoLanguage = activeLanguage;
  source.src = player.dataset[`video${activeLanguage === "es" ? "Es" : "En"}`];
  replaceTrack();
  languageButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.videoLanguage === activeLanguage)));
  video.load();

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
