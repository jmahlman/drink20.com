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

/* --- Hidden roll ---------------------------------------------------------
   Type dice notation anywhere — "d20", "2d20", "3d10", "4d6" — and that many
   dice tumble across the screen. The renderer is only fetched once someone
   actually finds it, so it costs nothing to anyone who never does. */

(function () {
	"use strict";

	// Sizes we have geometry for. Anything else is ignored, which is also what
	// stops the "d2" inside "2d20" from firing early.
	var SIDES = [4, 6, 8, 10, 12, 20];
	var NOTATION = /(\d{0,2})d(\d{1,3})$/;
	var typed = "";

	document.addEventListener("keydown", function (event) {
		// Don't hijack real typing, or shortcuts like ⌘D.
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		var el = event.target;
		if (
			el &&
			(el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
		) {
			return;
		}
		if (event.key.length !== 1) return;

		typed = (typed + event.key.toLowerCase()).slice(-6);

		var match = typed.match(NOTATION);
		if (!match) return;

		var sides = parseInt(match[2], 10);
		if (SIDES.indexOf(sides) === -1) return;

		var count = match[1] ? parseInt(match[1], 10) : 1;

		typed = "";
		import("/assets/js/dice.js")
			.then(function (mod) {
				mod.roll(count, sides);
			})
			.catch(function () {
				/* An Easter egg doesn't get to break the page. */
			});
	});
})();
