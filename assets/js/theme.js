/* Drink20 theme — mobile nav + dark/light toggle.
   The saved mode is applied by an inline script in <head> before first paint;
   this file only handles interaction after load. */

(function () {
	"use strict";

	/* --- Mobile navigation ------------------------------------------------ */

	var navToggle = document.querySelector("[data-nav-toggle]");
	var menu = document.getElementById("nav-menu");

	if (navToggle && menu) {
		var setOpen = function (open) {
			navToggle.setAttribute("aria-expanded", String(open));
			menu.hidden = !open;
		};

		// The menu ships with `hidden` so it degrades to a plain list without
		// JS; on wide screens CSS overrides `hidden` back to a flex row.
		navToggle.addEventListener("click", function () {
			setOpen(navToggle.getAttribute("aria-expanded") !== "true");
		});

		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") setOpen(false);
		});
	}

	/* --- Dark / light ----------------------------------------------------- */

	var themeToggle = document.querySelector("[data-theme-toggle]");
	if (!themeToggle) return;

	var label = themeToggle.querySelector(".visually-hidden");

	var apply = function (theme) {
		var light = theme === "light";
		document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
		themeToggle.setAttribute("aria-pressed", String(light));
		if (label) label.textContent = "Switch to " + (light ? "dark" : "light") + " mode";
	};

	// Nothing stored means dark, which is what the CSS already renders.
	var stored = "dark";
	try {
		stored = localStorage.getItem("d20-theme") === "light" ? "light" : "dark";
	} catch (e) {}
	apply(stored);

	themeToggle.addEventListener("click", function () {
		var next =
			document.documentElement.getAttribute("data-theme") === "light"
				? "dark"
				: "light";
		apply(next);
		try {
			localStorage.setItem("d20-theme", next);
		} catch (e) {}
	});
})();
