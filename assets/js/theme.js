/* Drink20 theme — mobile nav + skin switcher.
   The skin is applied by an inline script in <head> before first paint; this
   file only handles interaction after load. */

(function () {
	"use strict";

	/* --- Mobile navigation ------------------------------------------------ */

	var toggle = document.querySelector("[data-nav-toggle]");
	var menu = document.getElementById("nav-menu");

	if (toggle && menu) {
		var setOpen = function (open) {
			toggle.setAttribute("aria-expanded", String(open));
			menu.hidden = !open;
		};

		// The menu ships with `hidden` so it degrades to a plain list without
		// JS; on wide screens CSS overrides `hidden` back to a flex row.
		toggle.addEventListener("click", function () {
			setOpen(toggle.getAttribute("aria-expanded") !== "true");
		});

		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") setOpen(false);
		});
	}

	/* --- Skin switcher ---------------------------------------------------- */

	var switcher = document.querySelector("[data-skin-switcher]");
	if (!switcher) return;

	var buttons = switcher.querySelectorAll("[data-skin-value]");

	var sync = function (active) {
		buttons.forEach(function (button) {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.skinValue === active)
			);
		});
	};

	sync(document.documentElement.getAttribute("data-skin"));

	buttons.forEach(function (button) {
		button.addEventListener("click", function () {
			var skin = button.dataset.skinValue;
			document.documentElement.setAttribute("data-skin", skin);
			try {
				localStorage.setItem("d20-skin", skin);
			} catch (e) {}
			sync(skin);
		});
	});
})();
