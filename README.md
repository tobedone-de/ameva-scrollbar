# AMEVA Scrollbar

A framework-free overlay scrollbar with DOM-based tracks and thumbs that can be fully styled with CSS.

It was built for ameva.app viewport and element scroll containers, including custom visual effects such as glow, blur, gradients, shadows, and glass-style overlays.

## Features

1. Framework-free JavaScript and CSS scrollbar.
2. Custom overlay scrollbar for viewport and element scroll containers.
3. Fully stylable DOM-based track and thumb elements.
4. Supports advanced CSS effects such as glow, blur, gradients, shadows, and glass-style overlays.
5. Vertical and optional horizontal scrollbars.
6. Data attribute based configuration.
7. Runtime refresh and destroy helpers for dynamic interfaces.
8. No runtime dependencies.

## Install

```bash
npm install @tobedone-de/ameva-scrollbar/
```

## Usage

```js
import { initializeScrollbar, refreshScrollbar } from '@tobedone-de/ameva-scrollbar/';
import '@tobedone-de/ameva-scrollbar/styles.css';

initializeScrollbar();
```

Add `data-amevascrollbar` to scrollable elements:

```html
<div data-amevascrollbar>
    ...
</div>
```

The viewport scrollbar is opt-in:

```js
initializeScrollbar({
    viewport: true,
});
```

The package does not auto-detect app-specific body classes. Pass `viewport: true` when a page-level scrollbar should be created.

Initialize only the viewport scrollbar:

```js
initializeScrollbar({
    elements: false,
    viewport: true,
});
```

`initializeScrollbar()` and `refreshScrollbar()` return `{ elements, viewport }`, where `elements` is an array of element scrollbar instances and `viewport` is the viewport instance or `null`. `destroyScrollbar()` returns `{ elements, viewport }`, where `elements` is the number of destroyed element instances and `viewport` is a boolean.

## Data Attributes

- `data-amevascrollbar-x="true"` enables a horizontal element scrollbar.
- `data-amevascrollbar-wheel-x="true"` forwards vertical mouse-wheel input to horizontal scrolling when no native horizontal wheel delta is present and the element does not scroll vertically.
- `data-amevascrollbar-y="false"` disables the vertical element scrollbar.
- `data-amevascrollbar-edge="flush"` aligns element scrollbar overlays to the host edge.
- `data-amevascrollbar-width`, `data-amevascrollbar-size`, or `data-amevascrollbar-track-size` override visible track size.
- `data-amevascrollbar-hit-area` or `data-amevascrollbar-hit-size` override pointer hit area.
- `data-amevascrollbar-inset`, `data-amevascrollbar-inset-x`, `data-amevascrollbar-inset-y`, and `data-amevascrollbar-inline-end-inset` control element scrollbar placement.
- `data-amevascrollbar-thumb-min-size` and `data-amevascrollbar-thumb-padding` control thumb sizing.
- `data-amevascrollbar-top`, `data-amevascrollbar-right`, and `data-amevascrollbar-bottom` control viewport scrollbar offsets.

Generated DOM classes and CSS variables stay inside the `ameva-scrollbar` namespace.

When creating instances programmatically, the same behavior can be enabled with `horizontalWheel: true`.

## Styling Hooks

- `--ameva-scrollbar-radius` controls track and thumb rounding.
- `--ameva-scrollbar-viewport-z-index` controls the viewport scrollbar layer.
- `--ameva-scrollbar-element-z-index` controls element scrollbar overlays.
- `--ameva-scrollbar-track-size`, `--ameva-scrollbar-hit-size`, `--ameva-scrollbar-thumb-min-size`, and `--ameva-scrollbar-thumb-padding` are set from data attributes at runtime and can also be overridden in CSS.

## Exports

```js
import {
    AmevaScrollbar,
    destroyElementScrollbar,
    destroyScrollbar,
    destroyViewportScrollbar,
    getScopedElements,
    initializeElementScrollbar,
    initializeScrollbar,
    initializeViewportScrollbar,
    refreshScrollbar,
} from '@tobedone-de/ameva-scrollbar';
```

## Notes

This package currently ships source ES modules and CSS directly. It has no runtime dependencies.

## License

MIT © 2026 ToBeDone.de
