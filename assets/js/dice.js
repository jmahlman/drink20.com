/* ===========================================================================
   Hidden roll — type "d20" anywhere on the site.

   Loaded on demand by theme.js, so visitors who never find it pay nothing.

   The die is a real icosahedron built from 20 <div>s. Rather than hand-tuning
   rotations per face, each face is mapped onto its plane with a matrix3d()
   built from the triangle's own basis vectors — see faceMatrix() below. That
   makes the geometry exact and the code short.
   =========================================================================== */

const SIDE = 84; // triangle edge length, px
const TRI_H = (SIDE * Math.sqrt(3)) / 2; // height of an equilateral triangle
const RADIUS = SIDE * Math.sin((2 * Math.PI) / 5); // icosahedron circumradius

const PHI = (1 + Math.sqrt(5)) / 2;

// The 12 vertices of a regular icosahedron. Edge length here is 2, so scaling
// by SIDE/2 gives triangles with edge SIDE.
const VERTS = [
	[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
	[0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
	[PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];

const FACES = [
	[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
	[1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
	[3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
	[4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

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

/* --- geometry ------------------------------------------------------------ */

/*
 * Map the face element's own 2D box onto the triangle A-B-C in 3D.
 *
 * The clip-path triangle has its apex at (SIDE/2, 0), and its base corners at
 * (0, TRI_H) and (SIDE, TRI_H). We want apex→A, bottom-left→B, bottom-right→C,
 * which pins down an affine map P(x,y) = O + x·U + y·V:
 *
 *   U = (C − B) / SIDE          the base direction, unit length
 *   V = (midpoint(B,C) − A) / TRI_H   the median, unit length and ⟂ to U
 *   O = A − (SIDE/2)·U          where the element's top-left lands
 *
 * matrix3d takes those as its first, second and fourth columns; the third is
 * the face's outward normal, which for a regular solid is just the direction
 * of its centroid.
 */
function faceMatrix(A, B, C, centre) {
	const U = mul(sub(C, B), 1 / SIDE);
	const mid = mul(add(B, C), 0.5);
	const V = mul(sub(mid, A), 1 / TRI_H);
	const N = cross(U, V);
	const O = add(sub(A, mul(U, SIDE / 2)), centre);

	return {
		matrix: `matrix3d(${U[0]},${U[1]},${U[2]},0,${V[0]},${V[1]},${V[2]},0,${N[0]},${N[1]},${N[2]},0,${O[0]},${O[1]},${O[2]},1)`,
		normal: N,
	};
}

/*
 * Build the 20 faces once. Winding is normalised so every face's cross(U,V)
 * points outward — otherwise half the matrices are reflections and their
 * numerals render mirrored.
 *
 * Values follow the convention of a real d20, where opposite faces sum to 21.
 */
function buildFaces() {
	const k = SIDE / 2;
	const faces = FACES.map(([ia, ib, ic]) => {
		let A = mul(VERTS[ia], k);
		let B = mul(VERTS[ib], k);
		let C = mul(VERTS[ic], k);

		const outward = norm(mul(add(add(A, B), C), 1 / 3));
		const U = mul(sub(C, B), 1 / SIDE);
		const V = mul(sub(mul(add(B, C), 0.5), A), 1 / TRI_H);
		if (dot(cross(U, V), outward) < 0) [B, C] = [C, B];

		return { A, B, C, outward };
	});

	// Pair antipodal faces so the numbers add to 21, as on a real die.
	const values = new Array(20).fill(0);
	let next = 1;
	faces.forEach((face, i) => {
		if (values[i]) return;
		const opposite = faces.findIndex(
			(other) => dot(other.outward, face.outward) < -0.99
		);
		values[i] = next;
		if (opposite >= 0) values[opposite] = 21 - next;
		next += 1;
	});

	return faces.map((face, i) => ({ ...face, value: values[i] }));
}

/* --- rendering ----------------------------------------------------------- */

// Fake lighting: shade each face by how squarely it faces the light.
const LIGHT = norm([0.35, -0.8, 0.6]);

function makeDie(faces, resultIndex) {
	const die = document.createElement("div");
	die.className = "d20";
	die.style.width = `${RADIUS * 2}px`;
	die.style.height = `${RADIUS * 2}px`;

	const centre = [RADIUS, RADIUS, 0];

	faces.forEach((face) => {
		const el = document.createElement("div");
		el.className = "d20__face";
		el.style.width = `${SIDE}px`;
		el.style.height = `${TRI_H}px`;

		const { matrix, normal } = faceMatrix(face.A, face.B, face.C, centre);
		el.style.transform = matrix;

		// The face element is the black edge; its ::before is the shaded body.
		const lit = 0.58 + 0.42 * Math.max(0, dot(normal, LIGHT));
		const pct = Math.round(lit * 100);
		el.style.setProperty(
			"--face-bg",
			`color-mix(in srgb, var(--d20-face) ${pct}%, #000)`
		);

		const num = document.createElement("span");
		num.className = "d20__pip";
		// 6 and 9 are the same glyph upside down, so real dice underline them.
		if (face.value === 6 || face.value === 9) num.className += " d20__pip--bar";
		num.textContent = String(face.value);
		el.appendChild(num);

		die.appendChild(el);
	});

	// Orient so the winning face turns to camera: rotate its normal onto +Z.
	const win = faces[resultIndex];
	const n = win.outward;
	const axis = cross(n, [0, 0, 1]);
	const rad = Math.acos(Math.max(-1, Math.min(1, n[2])));
	const flat = len(axis) < 1e-6;
	const k = flat ? [1, 0, 0] : norm(axis);
	const turn = flat ? (n[2] > 0 ? 0 : Math.PI) : rad;

	// Rodrigues' rotation, so we can work out where that leaves the numeral.
	const rotate = (v) =>
		add(
			add(mul(v, Math.cos(turn)), mul(cross(k, v), Math.sin(turn))),
			mul(k, dot(k, v) * (1 - Math.cos(turn)))
		);

	/*
	 * Turning the normal to camera leaves the face free to spin in its own
	 * plane, which lands numerals at arbitrary angles — and an upside-down 6
	 * reads as a 9. So add a rotateZ that puts the face's "down" axis (V, from
	 * apex toward the base) back to screen-down, standing the numeral upright.
	 */
	const V = mul(sub(mul(add(win.B, win.C), 0.5), win.A), 1 / TRI_H);
	const vs = rotate(V);
	const spin = (Math.atan2(vs[0], vs[1]) * 180) / Math.PI;

	const deg = (turn * 180) / Math.PI;
	const settle = `rotateZ(${spin}deg) rotate3d(${k[0]},${k[1]},${k[2]},${deg}deg)`;

	return { die, settle };
}

/* --- the roll ------------------------------------------------------------ */

const FACES_BUILT = buildFaces();

export function roll() {
	// Guard on the DOM rather than a module-level flag: if the overlay is ever
	// removed by some path other than dismiss(), a flag would latch shut and
	// the egg would be dead until reload.
	if (document.querySelector(".dice-overlay")) return;

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const overlay = document.createElement("div");
	overlay.className = "dice-overlay";

	const tray = document.createElement("div");
	tray.className = "dice-tray";
	overlay.appendChild(tray);

	const results = [];

	[0, 1].forEach((i) => {
		const index = Math.floor(Math.random() * 20);
		results.push(FACES_BUILT[index].value);

		const drop = document.createElement("div");
		drop.className = "dice-drop";

		const { die, settle } = makeDie(FACES_BUILT, index);
		drop.appendChild(die);
		tray.appendChild(drop);

		if (reduced) {
			die.style.transform = settle;
			drop.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 260,
				fill: "forwards",
			});
			return;
		}

		const dir = i === 0 ? -1 : 1;
		const delay = i * 110;

		drop.animate(
			[
				{ transform: `translate3d(${dir * 30}vw, 60vh, 0) scale(.35)`, opacity: 0 },
				{ transform: `translate3d(${dir * 4}vw, -14vh, 0) scale(1.05)`, opacity: 1, offset: 0.45 },
				{ transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
			],
			{ duration: 1500, delay, easing: "cubic-bezier(.18,.7,.3,1)", fill: "both" }
		);

		// Several turns before landing on the chosen face.
		die.animate(
			[
				{ transform: `rotate3d(${dir},1,.4,0deg)` },
				{ transform: `rotate3d(${dir},1,.4,${900 + i * 180}deg)`, offset: 0.6 },
				{ transform: settle },
			],
			{ duration: 1500, delay, easing: "cubic-bezier(.18,.7,.3,1)", fill: "both" }
		);
	});

	// Screen readers get the outcome without the theatre.
	const said = document.createElement("p");
	said.className = "visually-hidden";
	said.setAttribute("role", "status");
	said.textContent = `Rolled ${results[0]} and ${results[1]}. Total ${
		results[0] + results[1]
	}.`;
	overlay.appendChild(said);

	document.body.appendChild(overlay);

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
	setTimeout(dismiss, reduced ? 3200 : 4800);
}
