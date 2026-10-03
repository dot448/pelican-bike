# Pelican Pedal Club

A dependency-free animated SVG postcard. Open index.html in any modern browser.

Use **Ride speed** to adjust the animation from 0.25× to 3×. The slider supports
arrow keys, Home, and End. **Pause ride** freezes the scene, and **Honk** shows
a greeting even while paused. Reduced-motion preferences start the ride paused;
you can explicitly resume it. Hidden tabs suspend animation until visible again.

For local development, run from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Run the animation regression suite with Node.js 18 or newer (no installation needed):

```sh
node test-animation.cjs
```

The suite covers speed changes, rolling geometry, pause/resume, reduced motion,
visibility, honk timing, and cloud wrapping. `animation.js` owns the animation
clock and controls, `styles.css` owns the layout, and `index.html` contains the SVG
artwork and accessible controls. When changing JavaScript or CSS, update the
corresponding asset query version in `index.html` so returning visitors receive it.

Published with GitHub Pages from the main branch.
