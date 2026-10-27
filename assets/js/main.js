(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const themeToggle = document.querySelector("[data-theme-toggle]");
  const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (error) {
      return null;
    }
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";

    if (themeToggle) {
      themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      themeToggle.setAttribute("aria-pressed", String(isDark));
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", isDark ? "#0f1a14" : "#f6f7f2");
  }

  // Wrap the theme flip in a view transition where supported, so the change
  // cross-fades instead of snapping. Falls back to an instant swap.
  function changeTheme(nextTheme) {
    const root = document.documentElement;
    const supportsTransition =
      typeof document.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsTransition) {
      applyTheme(nextTheme);
      return;
    }

    root.classList.add("theme-switching");
    const transition = document.startViewTransition(function () {
      applyTheme(nextTheme);
    });
    transition.finished.finally(function () {
      root.classList.remove("theme-switching");
    });
  }

  applyTheme(storedTheme() || (systemThemeQuery.matches ? "dark" : "light"));

  // Follow the OS preference only while the visitor hasn't chosen a theme.
  systemThemeQuery.addEventListener("change", function (event) {
    if (!storedTheme()) applyTheme(event.matches ? "dark" : "light");
  });

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      changeTheme(nextTheme);
      try {
        localStorage.setItem("theme", nextTheme);
      } catch (error) {
        // Storage can be unavailable in private browsing; the theme still applies.
      }
    });
  }

  // Pointer-tracked sheen on AI cards, driven by the registered --sheen property.
  if (window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".ai-card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        const box = card.getBoundingClientRect();
        const percent = ((event.clientX - box.left) / box.width) * 100;
        card.style.setProperty("--sheen-start", percent + "%");
      });
    });
  }

  const header = document.querySelector("[data-header]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const navigation = document.querySelector("[data-navigation]");
  const navigationLinks = navigation ? Array.from(navigation.querySelectorAll("a")) : [];
  const desktopQuery = window.matchMedia("(min-width: 901px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function scrollToSection(hash, behavior) {
    const target = document.querySelector(hash);
    if (!target) return;

    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: behavior });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (!document.querySelector(link.hash)) return;

      event.preventDefault();
      scrollToSection(link.hash, reducedMotionQuery.matches ? "instant" : "smooth");
      history.pushState(null, "", link.hash);
    });
  });

  function setMenu(open, restoreFocus) {
    if (!menuToggle || !navigation) return;

    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    menuToggle.querySelector("i").className = open ? "bx bx-x" : "bx bx-menu";
    navigation.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);

    if (restoreFocus) menuToggle.focus();
  }

  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", function () {
      setMenu(menuToggle.getAttribute("aria-expanded") !== "true", false);
    });

    navigationLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false, false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
        setMenu(false, true);
      }
    });

    document.addEventListener("click", function (event) {
      if (menuToggle.getAttribute("aria-expanded") === "true" && !header.contains(event.target)) {
        setMenu(false, false);
      }
    });

    desktopQuery.addEventListener("change", function (event) {
      if (event.matches) setMenu(false, false);
    });
  }

  function updateHeader() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const revealElements = document.querySelectorAll(".reveal");
  const showRevealed = function (element) {
    element.classList.add("is-visible");
  };

  if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    revealElements.forEach(showRevealed);
  } else {
    const revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          showRevealed(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -5% 0px", threshold: 0.05 });

    revealElements.forEach(function (element) {
      // Anything already in view stays visible even if the observer never fires
      // (background tabs, prerendering, or a stalled observer).
      const box = element.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) showRevealed(element);
      else revealObserver.observe(element);
    });

    // Failsafe: content must never remain permanently invisible.
    window.setTimeout(function () {
      revealElements.forEach(showRevealed);
    }, 2500);
  }

  const observedSections = Array.from(document.querySelectorAll("main section[id]"))
    .filter(function (section) { return section.id !== "home" && section.id !== "skills"; });

  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        navigationLinks.forEach(function (link) {
          if (link.hash === "#" + entry.target.id) {
            link.classList.add("is-active");
            link.setAttribute("aria-current", "location");
          } else {
            link.classList.remove("is-active");
            link.removeAttribute("aria-current");
          }
        });
      });
    }, { rootMargin: "-15% 0px -60% 0px", threshold: 0 });

    observedSections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const projectCards = Array.from(document.querySelectorAll("[data-category]"));

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const selectedCategory = button.dataset.filter;

      filterButtons.forEach(function (filterButton) {
        const isSelected = filterButton === button;
        filterButton.classList.toggle("is-active", isSelected);
        filterButton.setAttribute("aria-pressed", String(isSelected));
      });

      projectCards.forEach(function (card) {
        const isVisible = selectedCategory === "all" || card.dataset.category === selectedCategory;
        card.hidden = !isVisible;
        if (isVisible) card.classList.add("is-visible");
      });
    });
  });

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  if (window.location.hash && document.querySelector(window.location.hash)) {
    scrollToSection(window.location.hash, "instant");
    window.addEventListener("load", function () {
      scrollToSection(window.location.hash, "instant");
    }, { once: true });
  }
})();
