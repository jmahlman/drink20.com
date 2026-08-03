/* ===========================================================================
   Hidden roll — type dice notation anywhere on the site: "d20", "2d20",
   "3d10", "4d6"...

   Loaded on demand by theme.js, so visitors who never find it pay nothing.

   Every die is a real polyhedron built from one <div> per face. Rather than
   hand-tuning rotations, each face is mapped onto its own plane with a
   matrix3d() built from that face's basis vectors — see prepareFace(). Because
   that works for any planar convex polygon, the same code renders triangles
   (d4/d8/d20), squares (d6), pentagons (d12) and kites (d10).
   =========================================================================== */

const RADIUS = 74; // circumradius in px — every die reads the same size
const RIM = 5; // black edge left showing around each face, px

const PHI = (1 + Math.sqrt(5)) / 2;

/* --- vector helpers ------------------------------------------------------ */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0],
];
const mean = (pts) =>
	mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);

/* --- solids --------------------------------------------------------------
   Each returns { verts, faces } where a face is a list of vertex indices in
   order around its perimeter. Winding doesn't matter: prepareFace() derives
   the outward normal from the centroid, so faces can't come out inside-out.
   ------------------------------------------------------------------------- */

const TETRAHEDRON = {
	verts: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
	faces: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
};

const CUBE = {
	verts: [
		[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
		[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
	],
	faces: [
		[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
		[2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3],
	],
};

const OCTAHEDRON = {
	verts: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
	faces: [
		[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
		[2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
	],
};

const ICOSAHEDRON = {
	verts: [
		[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
		[0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
		[PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
	],
	faces: [
		[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
		[1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
		[3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
		[4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
	],
};

/*
 * The dodecahedron is the icosahedron's dual: one pentagonal face per icosa
 * vertex, whose corners are the centroids of the five triangles meeting there.
 * Deriving it beats hand-typing twenty vertices and twelve five-index faces.
 */
function dodecahedron() {
	const verts = [];
	const faces = ICOSAHEDRON.verts.map((v, vi) => {
		const around = ICOSAHEDRON.faces
			.filter((f) => f.includes(vi))
			.map((f) => mean(f.map((i) => ICOSAHEDRON.verts[i])));

		// Order the five corners around the face, or the polygon self-crosses.
		const n = norm(v);
		const u = norm(sub(around[0], mul(n, dot(around[0], n))));
		const w = cross(n, u);
		around.sort(
			(a, b) => Math.atan2(dot(a, w), dot(a, u)) - Math.atan2(dot(b, w), dot(b, u))
		);

		return around.map((p) => {
			verts.push(p);
			return verts.length - 1;
		});
	});
	return { verts, faces };
}

/*
 * A d10 is a pentagonal trapezohedron: two apexes and two rings of five,
 * offset 36° from each other, giving ten kite faces.
 *
 * The ring offset `a` and apex height `h` aren't free — the four corners of a
 * kite have to be coplanar. Solving that gives h = 9.472·a (the ratio falls
 * out of 2·sin36°·(a−h) = sin72°·(−a−h)).
 */
function trapezohedron() {
	const a = 0.115;
	const h = 9.472136 * a;
	const at = (i, off, z) => {
		const t = ((72 * i + off) * Math.PI) / 180;
		return [Math.cos(t), Math.sin(t), z];
	};

	const verts = [[0, 0, h], [0, 0, -h]];
	for (let i = 0; i < 5; i += 1) verts.push(at(i, 0, a)); // 2..6  upper ring
	for (let i = 0; i < 5; i += 1) verts.push(at(i, 36, -a)); // 7..11 lower ring

	const up = (i) => 2 + (i % 5);
	const lo = (i) => 7 + (i % 5);

	const faces = [];
	for (let i = 0; i < 5; i += 1) faces.push([0, up(i), lo(i), up(i + 1)]);
	for (let i = 0; i < 5; i += 1) faces.push([1, lo(i), up(i + 1), lo(i + 1)]);

	return { verts, faces };
}

const SOLIDS = {
	4: TETRAHEDRON,
	6: CUBE,
	8: OCTAHEDRON,
	10: trapezohedron(),
	12: dodecahedron(),
	20: ICOSAHEDRON,
};

export const SIDES = Object.keys(SOLIDS).map(Number);

/* --- face geometry -------------------------------------------------------
   Map a face element's own 2D box onto that face's plane in 3D.

   Working in the face's plane, with the origin at its centroid:
     n = outward normal, which for a centred convex solid is just the
         direction of the centroid
     U = any unit vector in the plane (we take the first corner)
     V = n × U, which makes (U, V, n) right-handed, so cross(U,V) === n and
         the numerals can never come out mirrored

   Projecting the corners onto (U,V) gives 2D coordinates; their bounding box
   becomes the element's width and height, and the corners become a clip-path
   in percentages. The affine map is then P(x,y) = O + x·U + y·V, which is
   exactly what matrix3d takes as its first, second and fourth columns.
   ------------------------------------------------------------------------- */

function prepareFace(pts) {
	const C = mean(pts);
	const n = norm(C);

	/*
	 * V is the face's own "down", which decides both how the shape sits and
	 * which way up its numeral prints. Anchoring it at a corner stands that
	 * corner up — right for triangles, pentagons, and the d10's kites, whose
	 * points should aim at the poles. A square wants a flat edge on top
	 * instead, or the d6 reads as a diamond, so equilateral even-sided faces
	 * anchor on an edge midpoint.
	 */
	const edges = pts.map((p, i) => len(sub(pts[(i + 1) % pts.length], p)));
	const equilateral = Math.max(...edges) - Math.min(...edges) < 1e-6;
	const anchor =
		equilateral && pts.length % 2 === 0 ? mean([pts[0], pts[1]]) : pts[0];

	const V = norm(sub(C, anchor));
	const U = cross(V, n); // keeps (U, V, n) right-handed, so cross(U,V) === n

	const uv = pts.map((p) => [dot(sub(p, C), U), dot(sub(p, C), V)]);
	const us = uv.map((p) => p[0]);
	const vs = uv.map((p) => p[1]);
	const minU = Math.min(...us);
	const minV = Math.min(...vs);
	const W = Math.max(...us) - minU;
	const H = Math.max(...vs) - minV;

	const clip = uv
		.map(
			([u, v]) =>
				`${(((u - minU) / W) * 100).toFixed(3)}% ${(((v - minV) / H) * 100).toFixed(3)}%`
		)
		.join(",");

	// Distance from centroid to the nearest edge — the face's inradius. Used to
	// keep the black rim an even width whatever shape the face is.
	let inradius = Infinity;
	for (let i = 0; i < uv.length; i += 1) {
		const p = uv[i];
		const q = uv[(i + 1) % uv.length];
		const ex = q[0] - p[0];
		const ey = q[1] - p[1];
		const edge = Math.hypot(ex, ey) || 1;
		inradius = Math.min(inradius, Math.abs(ex * p[1] - ey * p[0]) / edge);
	}

	return {
		normal: n,
		V,
		W,
		H,
		clip,
		inradius,
		// Where the element's top-left corner lands in 3D.
		origin: add(C, add(mul(U, minU), mul(V, minV))),
		// The centroid's position inside the element, as percentages.
		cx: ((-minU) / W) * 100,
		cy: ((-minV) / H) * 100,
	};
}

/*
 * Number the faces. Real dice put opposite faces on facing values that sum to
 * sides + 1; solids without antipodal faces (the tetrahedron) just count up.
 */
function assignValues(faces) {
	const total = faces.length;
	const values = new Array(total).fill(0);
	let next = 1;

	faces.forEach((face, i) => {
		if (values[i]) return;
		const opposite = faces.findIndex(
			(other) => dot(other.normal, face.normal) < -0.999
		);
		values[i] = next;
		if (opposite >= 0 && !values[opposite]) values[opposite] = total + 1 - next;
		next += 1;
	});

	return values;
}

const CACHE = new Map();

function geometry(sides) {
	if (CACHE.has(sides)) return CACHE.get(sides);

	const solid = SOLIDS[sides];
	// Scale so every die shares a circumradius. A trapezohedron's vertices
	// aren't equidistant, so normalise against the furthest one.
	const longest = Math.max(...solid.verts.map(len));
	const verts = solid.verts.map((v) => mul(v, RADIUS / longest));

	const faces = solid.faces.map((f) => prepareFace(f.map((i) => verts[i])));
	const values = assignValues(faces);
	const built = faces.map((face, i) => ({ ...face, value: values[i] }));

	CACHE.set(sides, built);
	return built;
}

/* --- rendering ----------------------------------------------------------- */

// Fake lighting: shade each face by how squarely it faces the light.
const LIGHT = norm([0.35, -0.8, 0.6]);

function makeDie(sides, resultIndex) {
	const faces = geometry(sides);

	const die = document.createElement("div");
	die.className = "die";
	die.style.width = `${RADIUS * 2}px`;
	die.style.height = `${RADIUS * 2}px`;

	const centre = [RADIUS, RADIUS, 0];

	faces.forEach((face) => {
		const el = document.createElement("div");
		el.className = "die__face";
		el.style.width = `${face.W}px`;
		el.style.height = `${face.H}px`;
		el.style.setProperty("--clip", `polygon(${face.clip})`);
		el.style.setProperty("--cx", `${face.cx}%`);
		el.style.setProperty("--cy", `${face.cy}%`);

		// Shrinking about the centroid reduces the inradius by the same factor,
		// so this leaves a rim of RIM px on every edge, on any face shape.
		const rim = Math.max(0.55, (face.inradius - RIM) / face.inradius);
		el.style.setProperty("--rim", String(rim));
		el.style.setProperty(
			"--pip-size",
			`${Math.max(12, Math.min(30, face.inradius * 0.92))}px`
		);

		const o = add(face.origin, centre);
		const { normal: n, V } = face;
		const U = cross(V, n); // (U,V,n) right-handed, so this recovers U
		el.style.transform = `matrix3d(${U[0]},${U[1]},${U[2]},0,${V[0]},${V[1]},${V[2]},0,${n[0]},${n[1]},${n[2]},0,${o[0]},${o[1]},${o[2]},1)`;

		const lit = 0.58 + 0.42 * Math.max(0, dot(n, LIGHT));
		el.style.setProperty(
			"--face-bg",
			`color-mix(in srgb, var(--d20-face) ${Math.round(lit * 100)}%, #000)`
		);

		const num = document.createElement("span");
		num.className = "die__pip";
		// 6 and 9 are the same glyph upside down, so real dice underline them.
		if (face.value === 6 || face.value === 9) num.className += " die__pip--bar";
		num.textContent = String(face.value);
		el.appendChild(num);

		die.appendChild(el);
	});

	// Orient so the winning face turns to camera: rotate its normal onto +Z.
	const win = faces[resultIndex];
	const n = win.normal;
	const axis = cross(n, [0, 0, 1]);
	const flat = len(axis) < 1e-6;
	const k = flat ? [1, 0, 0] : norm(axis);
	const turn = flat
		? n[2] > 0
			? 0
			: Math.PI
		: Math.acos(Math.max(-1, Math.min(1, n[2])));

	// Rodrigues' rotation, so we can work out where that leaves the numeral.
	const rotate = (v) =>
		add(
			add(mul(v, Math.cos(turn)), mul(cross(k, v), Math.sin(turn))),
			mul(k, dot(k, v) * (1 - Math.cos(turn)))
		);

	/*
	 * Turning the normal to camera leaves the face free to spin in its own
	 * plane, which lands numerals at arbitrary angles — and an upside-down 6
	 * reads as a 9. So add a rotateZ that puts the face's own "down" axis (V)
	 * back to screen-down, standing the numeral upright.
	 */
	const vs = rotate(win.V);
	const spin = (Math.atan2(vs[0], vs[1]) * 180) / Math.PI;
	const deg = (turn * 180) / Math.PI;

	/*
	 * Landing dead square to the camera looks staged, and on a d6 it hides the
	 * fact there's a solid there at all — you just see a flat square. These
	 * screen-space rotations are applied after the settle, so they tip the die
	 * to a jaunty angle while the winning face still clearly faces front and
	 * keeps matching the announced result.
	 */
	const jitter = (range) => (Math.random() * 2 - 1) * range;
	const tilt = `rotateX(${jitter(15)}deg) rotateY(${jitter(15)}deg) rotateZ(${jitter(14)}deg)`;

	return {
		die,
		value: win.value,
		settle: `${tilt} rotateZ(${spin}deg) rotate3d(${k[0]},${k[1]},${k[2]},${deg}deg)`,
	};
}

/* --- critical hit -------------------------------------------------------- */

const CHEER = ["🎉", "🎊", "🎲", "🍻", "✨", "⭐️", "🔥", "💥", "🐉", "⚔️"];

/*
 * Fires only on a single d20 showing 20. Recolouring works by overriding
 * --d20-face on the die: every face's background is a color-mix against that
 * property, so all twenty turn gold from one declaration.
 */
function celebrate(overlay, drop, reduced) {
	overlay.classList.add("dice-overlay--crit");
	drop.classList.add("dice-drop--crit");

	const banner = document.createElement("p");
	banner.className = "crit-banner";
	banner.textContent = "Natural 20";
	overlay.appendChild(banner);

	if (reduced) return;

	banner.animate(
		[
			{ transform: "scale(.6) rotate(-4deg)", opacity: 0 },
			{ transform: "scale(1.08) rotate(1deg)", opacity: 1, offset: 0.55 },
			{ transform: "scale(1) rotate(0deg)", opacity: 1 },
		],
		{ duration: 620, easing: "cubic-bezier(.2,1.5,.4,1)", fill: "both" }
	);

	const burst = document.createElement("div");
	burst.className = "cheer";
	overlay.appendChild(burst);

	// Throw far enough to cross the viewport rather than puff around the die.
	const reach = Math.max(window.innerWidth, window.innerHeight) * 0.55;

	for (let i = 0; i < 38; i += 1) {
		const piece = document.createElement("span");
		piece.className = "cheer__bit";
		piece.textContent = CHEER[Math.floor(Math.random() * CHEER.length)];
		piece.style.fontSize = `${20 + Math.random() * 26}px`;
		burst.appendChild(piece);

		const angle = Math.random() * Math.PI * 2;
		const dist = reach * (0.35 + Math.random() * 0.65);
		const x = Math.cos(angle) * dist;
		const y = Math.sin(angle) * dist;
		const spin = (Math.random() - 0.5) * 900;

		piece.animate(
			[
				{ transform: "translate3d(-50%,-50%,0) scale(.2) rotate(0deg)", opacity: 0 },
				{
					transform: `translate3d(calc(-50% + ${x * 0.55}px), calc(-50% + ${
						y * 0.55 - 40
					}px), 0) scale(1.1) rotate(${spin * 0.5}deg)`,
					opacity: 1,
					offset: 0.35,
				},
				{
					// Gravity takes over once the throw runs out of momentum.
					transform: `translate3d(calc(-50% + ${x}px), calc(-50% + ${
						y + window.innerHeight * 0.45
					}px), 0) scale(.85) rotate(${spin}deg)`,
					opacity: 0,
				},
			],
			{
				duration: 1500 + Math.random() * 900,
				delay: Math.random() * 260,
				easing: "cubic-bezier(.12,.6,.35,1)",
				fill: "both",
			}
		);
	}
}

/* --- the roll ------------------------------------------------------------ */

export const MAX_DICE = 8;

/*
 * Where the dice come to rest, as offsets from the centre of the tray.
 *
 * Rejection sampling with a minimum separation — the cheap cousin of Poisson
 * disc. Purely random points clump and overlap; this keeps them apart enough
 * to read while still looking thrown rather than arranged. If a die can't find
 * a clear spot in 40 tries it takes the roomiest one it found.
 */
function scatter(n, areaW, areaH) {
	const minDist = RADIUS * 1.8;
	const spots = [];

	for (let i = 0; i < n; i += 1) {
		let best = [0, 0];
		let bestGap = -1;

		for (let attempt = 0; attempt < 40; attempt += 1) {
			const p = [
				(Math.random() - 0.5) * areaW,
				(Math.random() - 0.5) * areaH,
			];
			const gap = spots.length
				? Math.min(...spots.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))
				: Infinity;

			if (gap >= minDist) {
				best = p;
				bestGap = gap;
				break;
			}
			if (gap > bestGap) {
				bestGap = gap;
				best = p;
			}
		}

		spots.push(best);
	}

	return spots;
}

export function roll(count = 1, sides = 20) {
	if (!SOLIDS[sides]) return;
	const n = Math.max(1, Math.min(MAX_DICE, count));

	// Guard on the DOM rather than a module-level flag: if the overlay is ever
	// removed by some path other than dismiss(), a flag would latch shut and
	// the egg would be dead until reload.
	if (document.querySelector(".dice-overlay")) return;

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const overlay = document.createElement("div");
	overlay.className = "dice-overlay";

	const areaW = Math.min(window.innerWidth * 0.78, 640);
	const areaH = Math.min(window.innerHeight * 0.44, 320);
	const spots = n === 1 ? [[0, 0]] : scatter(n, areaW, areaH);

	const tray = document.createElement("div");
	tray.className = "dice-tray";
	tray.style.width = `${areaW}px`;
	tray.style.height = `${areaH}px`;
	overlay.appendChild(tray);

	// Everything is thrown from roughly one point off the bottom of the screen,
	// the way a handful of dice leaves a hand.
	const throwY = window.innerHeight * 0.62;
	const throwX = window.innerWidth * 0.12;

	const results = [];
	// Populated below so the celebration can wait for the die to finish rolling.
	let critDrop = null;
	let critFall = null;

	for (let i = 0; i < n; i += 1) {
		const index = Math.floor(Math.random() * sides);
		const { die, value, settle } = makeDie(sides, index);
		results.push(value);

		const [dx, dy] = spots[i];

		const drop = document.createElement("div");
		drop.className = "dice-drop";
		// Negative margins centre the die on its spot, leaving `transform` free
		// for the animation.
		drop.style.left = `calc(50% + ${dx}px)`;
		drop.style.top = `calc(50% + ${dy}px)`;
		drop.style.marginLeft = `${-RADIUS}px`;
		drop.style.marginTop = `${-RADIUS}px`;
		drop.appendChild(die);
		tray.appendChild(drop);

		// A natural 20 only counts on a single d20 — "20" on one of four dice
		// isn't a crit, it's just arithmetic.
		if (n === 1 && sides === 20 && value === 20) critDrop = drop;

		if (reduced) {
			die.style.transform = settle;
			drop.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 260,
				delay: i * 60,
				fill: "both",
			});
			continue;
		}

		// Offsets are relative to the die's resting spot, so subtracting it puts
		// every die at the same launch point regardless of where it lands.
		const fromX = throwX - dx;
		const fromY = throwY - dy;
		const dir = dx < 0 ? -1 : 1;
		const delay = i * 70;
		// Vary the flight time so they don't land in lockstep.
		const duration = 1450 + Math.random() * 350;

		const fall = drop.animate(
			[
				{ transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(.35)`, opacity: 0 },
				{ transform: `translate3d(${fromX * 0.45}px, ${fromY * 0.3 - 90}px, 0) scale(.9)`, opacity: 1, offset: 0.35 },
				// Overshoot past the spot, then settle back — one small bounce.
				{ transform: "translate3d(0, 14px, 0) scale(1.04)", offset: 0.72 },
				{ transform: "translate3d(0, -10px, 0) scale(1)", offset: 0.86 },
				{ transform: "translate3d(0,0,0) scale(1)" },
			],
			{ duration, delay, easing: "cubic-bezier(.22,.68,.3,1)", fill: "both" }
		);

		die.animate(
			[
				{ transform: `rotate3d(${dir},1,.4,0deg)` },
				{ transform: `rotate3d(${dir},1,.4,${820 + Math.random() * 480}deg)`, offset: 0.62 },
				{ transform: settle },
			],
			{ duration, delay, easing: "cubic-bezier(.22,.68,.3,1)", fill: "both" }
		);

		if (drop === critDrop) critFall = fall;
	}

	// Screen readers get the outcome without the theatre.
	const total = results.reduce((a, b) => a + b, 0);
	const said = document.createElement("p");
	said.className = "visually-hidden";
	said.setAttribute("role", "status");
	said.textContent = critDrop
		? "Rolled d20: 20. Natural twenty!"
		: n === 1
		? `Rolled d${sides}: ${results[0]}.`
		: `Rolled ${n}d${sides}: ${results.join(", ")}. Total ${total}.`;
	overlay.appendChild(said);

	document.body.appendChild(overlay);

	// Hold the gold until the die has actually stopped rolling — turning it mid
	// tumble gives the result away before the die has landed.
	if (critDrop) {
		if (reduced || !critFall) celebrate(overlay, critDrop, true);
		else {
			critFall.finished
				.then(() => celebrate(overlay, critDrop, false))
				.catch(() => {});
		}
	}

	const dismiss = () => {
		if (!overlay.isConnected) return;
		document.removeEventListener("keydown", onKey);
		overlay
			.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: 260,
				fill: "forwards",
			})
			.finished.then(() => overlay.remove())
			.catch(() => overlay.remove());
	};

	const onKey = (e) => {
		if (e.key === "Escape") dismiss();
	};

	document.addEventListener("keydown", onKey);
	overlay.addEventListener("click", dismiss);
	// A crit earns a longer look.
	setTimeout(dismiss, reduced ? 3200 : critDrop ? 7200 : 5200);
}
