const MIN_THUMB_SIZE = 56;
const ROOT_FADE_IN_DELAY_MS = 120;
const THUMB_EDGE_PADDING = 6;
const TRANSITION_TRACKING_DURATION_MS = 420;
const ELEMENT_TRACK_SIZE = 16;
const ELEMENT_VISIBLE_TRACK_SIZE = 12;
const VIEWPORT_VISIBLE_TRACK_SIZE = 16;
const THUMB_DRAG_HIT_SLOP = 14;
let ownerSequence = 0;

export class AmevaScrollbar {
    constructor({
        host,
        scrollElement,
        viewport = false,
        horizontal = false,
        vertical = true,
    }) {
        this.host = host;
        this.scrollElement = scrollElement;
        this.viewport = viewport;
        this.horizontalEnabled = horizontal;
        this.verticalEnabled = vertical;
        this.dragState = null;
        this.frame = null;
        this.fadeInTimer = null;
        this.hasActivated = false;

        this.root = null;
        this.vertical = null;
        this.horizontal = null;
        this.resizeObserver = null;
        this.mutationObserver = null;
        this.transitionTrackingFrame = null;
        this.transitionTrackingUntil = 0;
        this.ownerId = `ameva-scrollbar-${++ownerSequence}`;

        this.handleScroll = this.requestUpdate.bind(this);
        this.handleResize = this.requestUpdate.bind(this);
        this.handleWindowLoad = this.requestUpdate.bind(this);
        this.handleHostWheel = this.forwardHostWheel.bind(this);
        this.handleHostTransitionStart = this.handleLayoutTransitionStart.bind(this);
        this.handleHostTransitionEnd = this.handleLayoutTransitionEnd.bind(this);
    }

    initialize() {
        if (this.root) {
            this.refresh();

            return;
        }

        this.host.dataset.amevascrollbarInitialized = 'true';
        this.host.classList.add('ameva-scrollbar-host');

        if (this.viewport) {
            document.documentElement.classList.add('ameva-scrollbar-host', 'ameva-scrollbar-host--viewport');
            document.body.classList.add('ameva-scrollbar-host', 'ameva-scrollbar-host--viewport');
        }

        this.createRoot();
        this.bindEvents();
        this.requestUpdate();
    }

    createRoot() {
        this.root = document.createElement('div');
        this.root.className = `ameva-scrollbar ameva-scrollbar--initializing${this.viewport ? ' ameva-scrollbar--viewport' : ' ameva-scrollbar--element'}`;
        this.root.setAttribute('data-amevascrollbar-root', '');
        this.root.setAttribute('data-amevascrollbar-owner', this.ownerId);

        if (this.verticalEnabled) {
            this.vertical = this.createAxis('vertical');
            this.root.appendChild(this.vertical.track);
        }

        if (this.horizontalEnabled) {
            this.horizontal = this.createAxis('horizontal');
            this.root.appendChild(this.horizontal.track);
        }

        document.body.appendChild(this.root);
    }

    readDatasetValue(...keys) {
        for (const key of keys) {
            const value = this.host.dataset[key];

            if (typeof value === 'string' && value !== '') {
                return value;
            }
        }

        return null;
    }

    readDatasetNumber(...keys) {
        const value = this.readDatasetValue(...keys);

        if (value === null) {
            return null;
        }

        const parsedValue = Number.parseFloat(value);

        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    resolveVisibleTrackSize() {
        return this.readDatasetNumber('amevascrollbarWidth', 'amevascrollbarSize', 'amevascrollbarTrackSize')
            ?? (this.viewport ? VIEWPORT_VISIBLE_TRACK_SIZE : ELEMENT_VISIBLE_TRACK_SIZE);
    }

    resolveHitAreaSize() {
        return this.readDatasetNumber('amevascrollbarHitArea', 'amevascrollbarHitSize')
            ?? Math.max(this.resolveVisibleTrackSize() + 4, ELEMENT_TRACK_SIZE);
    }

    resolveThumbMinSize() {
        return this.readDatasetNumber('amevascrollbarThumbMinSize')
            ?? MIN_THUMB_SIZE;
    }

    resolveThumbPadding() {
        return this.readDatasetNumber('amevascrollbarThumbPadding')
            ?? THUMB_EDGE_PADDING;
    }

    setOrClearRootStyleProperty(property, value) {
        if (value === null) {
            this.root.style.removeProperty(property);

            return;
        }

        this.root.style.setProperty(property, value);
    }

    applyConfiguredCssVars() {
        this.root.style.setProperty('--ameva-scrollbar-track-size', `${this.resolveVisibleTrackSize()}px`);
        this.root.style.setProperty('--ameva-scrollbar-hit-size', `${this.resolveHitAreaSize()}px`);
        this.root.style.setProperty('--ameva-scrollbar-thumb-min-size', `${this.resolveThumbMinSize()}px`);
        this.root.style.setProperty('--ameva-scrollbar-thumb-padding', `${this.resolveThumbPadding()}px`);

        if (!this.viewport) {
            return;
        }

        const viewportTop = this.readDatasetNumber('amevascrollbarTop');
        const viewportRight = this.readDatasetNumber('amevascrollbarRight');
        const viewportBottom = this.readDatasetNumber('amevascrollbarBottom');
        this.setOrClearRootStyleProperty('--ameva-scrollbar-viewport-top', viewportTop === null ? null : `${viewportTop}px`);
        this.setOrClearRootStyleProperty('--ameva-scrollbar-viewport-right', viewportRight === null ? null : `${viewportRight}px`);
        this.setOrClearRootStyleProperty('--ameva-scrollbar-viewport-bottom', viewportBottom === null ? null : `${viewportBottom}px`);
    }

    createAxis(axis) {
        const track = document.createElement('button');
        track.className = `ameva-scrollbar__track ameva-scrollbar__track--${axis}`;
        track.type = 'button';
        track.tabIndex = -1;
        track.setAttribute('aria-hidden', 'true');

        const thumb = document.createElement('span');
        thumb.className = `ameva-scrollbar__thumb ameva-scrollbar__thumb--${axis}`;
        thumb.setAttribute('data-amevascrollbar-thumb', axis);

        track.appendChild(thumb);

        this.bindAxisEvents(axis, track, thumb);

        return { axis, track, thumb };
    }

    bindAxisEvents(axis, track, thumb) {
        const setHovering = (hovering) => {
            track.classList.toggle('ameva-scrollbar__track--hovering', hovering);
        };

        const setPressing = (pressing) => {
            track.classList.toggle('ameva-scrollbar__track--pressing', pressing);
        };

        track.addEventListener('pointerenter', () => {
            setHovering(true);
        });

        track.addEventListener('pointerleave', () => {
            setHovering(false);

            if (!this.dragState || this.dragState.axis !== axis) {
                setPressing(false);
            }
        });

        track.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) {
                return;
            }

            setPressing(true);

            if (event.target === thumb || !this.isPointerNearThumb(axis, thumb, event)) {
                return;
            }

            event.preventDefault();
            this.startDrag(axis, event, track, track, 'track');
        });

        track.addEventListener('pointermove', (event) => {
            this.updateDrag(axis, track, thumb, event, track);
        });

        track.addEventListener('pointerup', (event) => {
            this.releaseDrag(axis, track, event, track);

            if (!this.dragState || this.dragState.axis !== axis) {
                setPressing(false);
            }
        });

        track.addEventListener('pointercancel', (event) => {
            this.releaseDrag(axis, track, event, track);
            setPressing(false);
        });

        track.addEventListener('click', (event) => {
            if (track.dataset.amevascrollbarSkipClick === 'true') {
                delete track.dataset.amevascrollbarSkipClick;

                return;
            }

            if (event.target === thumb) {
                return;
            }

            this.scrollToTrackPosition(axis, track, thumb, event);
        });

        track.addEventListener('wheel', (event) => {
            this.forwardWheel(axis, event);
        }, { passive: false });

        thumb.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            this.startDrag(axis, event, track, thumb, 'thumb');
        });

        thumb.addEventListener('pointermove', (event) => {
            this.updateDrag(axis, track, thumb, event, thumb);
        });

        thumb.addEventListener('pointerup', (event) => {
            this.releaseDrag(axis, track, event, thumb);
        });
        thumb.addEventListener('pointercancel', (event) => {
            this.releaseDrag(axis, track, event, thumb);
        });
    }

    isPointerNearThumb(axis, thumb, event) {
        const thumbRect = thumb.getBoundingClientRect();

        if (axis === 'vertical') {
            return event.clientX >= thumbRect.left - THUMB_DRAG_HIT_SLOP
                && event.clientX <= thumbRect.right + THUMB_DRAG_HIT_SLOP
                && event.clientY >= thumbRect.top - THUMB_DRAG_HIT_SLOP
                && event.clientY <= thumbRect.bottom + THUMB_DRAG_HIT_SLOP;
        }

        return event.clientX >= thumbRect.left - THUMB_DRAG_HIT_SLOP
            && event.clientX <= thumbRect.right + THUMB_DRAG_HIT_SLOP
            && event.clientY >= thumbRect.top - THUMB_DRAG_HIT_SLOP
            && event.clientY <= thumbRect.bottom + THUMB_DRAG_HIT_SLOP;
    }

    startDrag(axis, event, track, captureTarget, source) {
        this.dragState = {
            axis,
            pointerId: event.pointerId,
            captureTarget,
            source,
        };

        if (typeof captureTarget.setPointerCapture === 'function') {
            captureTarget.setPointerCapture(event.pointerId);
        }
        track.classList.add('ameva-scrollbar__track--dragging', 'ameva-scrollbar__track--pressing');
    }

    updateDrag(axis, track, thumb, event, captureTarget) {
        if (
            !this.dragState
            || this.dragState.axis !== axis
            || this.dragState.pointerId !== event.pointerId
            || this.dragState.captureTarget !== captureTarget
        ) {
            return;
        }

        this.scrollToTrackPosition(axis, track, thumb, event, true);
    }

    releaseDrag(axis, track, event, captureTarget) {
        if (
            !this.dragState
            || this.dragState.axis !== axis
            || this.dragState.pointerId !== event.pointerId
            || this.dragState.captureTarget !== captureTarget
        ) {
            return;
        }

        if (
            typeof captureTarget.hasPointerCapture === 'function'
            && captureTarget.hasPointerCapture(event.pointerId)
        ) {
            captureTarget.releasePointerCapture(event.pointerId);
        }

        if (this.dragState.source === 'track') {
            track.dataset.amevascrollbarSkipClick = 'true';
        }

        this.dragState = null;
        track.classList.remove('ameva-scrollbar__track--dragging', 'ameva-scrollbar__track--pressing');
    }

    bindEvents() {
        if (this.viewport) {
            window.addEventListener('scroll', this.handleScroll, { passive: true });
            window.addEventListener('resize', this.handleResize, { passive: true });
            window.addEventListener('load', this.handleWindowLoad, { once: true });
            if ('ResizeObserver' in window) {
                this.resizeObserver = new ResizeObserver(this.handleResize);
                this.resizeObserver.observe(document.documentElement);
                this.resizeObserver.observe(document.body);
            }

            return;
        }

        this.scrollElement.addEventListener('scroll', this.handleScroll, { passive: true });
        this.host.addEventListener('wheel', this.handleHostWheel, { passive: false });
        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('scroll', this.handleResize, { passive: true });
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver(this.handleResize);
            this.resizeObserver.observe(this.host);
        }

        if ('MutationObserver' in window) {
            this.mutationObserver = new MutationObserver(this.handleResize);
            this.mutationObserver.observe(this.host, {
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
                childList: true,
                subtree: true,
                characterData: true,
            });
        }

        this.host.addEventListener('transitionrun', this.handleHostTransitionStart);
        this.host.addEventListener('transitionstart', this.handleHostTransitionStart);
        this.host.addEventListener('transitionend', this.handleHostTransitionEnd);
        this.host.addEventListener('transitioncancel', this.handleHostTransitionEnd);
        this.host.addEventListener('animationstart', this.handleHostTransitionStart);
        this.host.addEventListener('animationend', this.handleHostTransitionEnd);
        this.host.addEventListener('animationcancel', this.handleHostTransitionEnd);
    }

    requestUpdate() {
        if (this.frame !== null) {
            return;
        }

        this.frame = window.requestAnimationFrame(() => {
            this.frame = null;
            this.update();
        });
    }

    refresh() {
        this.requestUpdate();
        this.trackTransientLayout();
    }

    handleLayoutTransitionStart() {
        this.trackTransientLayout();
    }

    handleLayoutTransitionEnd() {
        this.trackTransientLayout(140);
    }

    trackTransientLayout(duration = TRANSITION_TRACKING_DURATION_MS) {
        this.transitionTrackingUntil = Math.max(
            this.transitionTrackingUntil,
            performance.now() + duration,
        );

        if (this.transitionTrackingFrame !== null) {
            return;
        }

        const run = () => {
            this.transitionTrackingFrame = null;
            this.requestUpdate();

            if (performance.now() >= this.transitionTrackingUntil) {
                return;
            }

            this.transitionTrackingFrame = window.requestAnimationFrame(run);
        };

        this.transitionTrackingFrame = window.requestAnimationFrame(run);
    }

    getMetrics() {
        const element = this.scrollElement;
        const scrollTop = this.viewport ? window.scrollY : element.scrollTop;
        const scrollLeft = this.viewport ? window.scrollX : element.scrollLeft;
        const viewportHeight = this.viewport ? window.innerHeight : element.clientHeight;
        const viewportWidth = this.viewport ? window.innerWidth : element.clientWidth;
        const scrollHeight = element.scrollHeight;
        const scrollWidth = element.scrollWidth;
        const maxScrollTop = Math.max(scrollHeight - viewportHeight, 0);
        const maxScrollLeft = Math.max(scrollWidth - viewportWidth, 0);

        return {
            scrollTop,
            scrollLeft,
            viewportHeight,
            viewportWidth,
            scrollHeight,
            scrollWidth,
            maxScrollTop,
            maxScrollLeft,
        };
    }

    update() {
        this.applyConfiguredCssVars();

        if (!this.viewport) {
            if (!this.isHostVisible()) {
                this.deactivateRoot();
                return;
            }

            this.prepareVisibleRoot();
            this.updateElementRootBounds();
        } else {
            this.prepareVisibleRoot();
        }

        const metrics = this.getMetrics();

        if (this.vertical) {
            this.updateAxis(this.vertical, metrics, 'vertical');
        }

        if (this.horizontal) {
            this.updateAxis(this.horizontal, metrics, 'horizontal');
        }

        this.updateRootVisibility();
    }

    updateElementRootBounds() {
        const rect = this.host.getBoundingClientRect();
        const resolvedZIndex = this.resolveOverlayZIndex();
        const { verticalInset, horizontalInset, inlineEndInset } = this.resolveElementInsets();
        const useFlushEdge = this.host.dataset.amevascrollbarEdge === 'flush';
        const hitAreaSize = this.resolveHitAreaSize();
        const resolvedInlineEndInset = inlineEndInset ?? (
            useFlushEdge
                ? 0
                : Math.min(Math.max(verticalInset * 0.45, 3), 8)
        );
        const verticalOnly = this.verticalEnabled && !this.horizontalEnabled;
        const horizontalOnly = this.horizontalEnabled && !this.verticalEnabled;

        if (verticalOnly) {
            this.root.style.left = `${rect.right - hitAreaSize - resolvedInlineEndInset}px`;
            this.root.style.top = `${rect.top + verticalInset}px`;
            this.root.style.width = `${hitAreaSize}px`;
            this.root.style.height = `${Math.max(rect.height - verticalInset * 2, 0)}px`;
        } else if (horizontalOnly) {
            this.root.style.left = `${rect.left + horizontalInset}px`;
            this.root.style.top = `${rect.bottom - hitAreaSize}px`;
            this.root.style.width = `${Math.max(rect.width - horizontalInset * 2, 0)}px`;
            this.root.style.height = `${hitAreaSize}px`;
        } else {
            this.root.style.left = `${rect.left}px`;
            this.root.style.top = `${rect.top}px`;
            this.root.style.width = `${rect.width}px`;
            this.root.style.height = `${rect.height}px`;
        }

        this.root.style.zIndex = `${resolvedZIndex}`;
        this.root.style.removeProperty('border-radius');
        this.root.style.setProperty('--ameva-scrollbar-element-vertical-inset', `${verticalInset}px`);
        this.root.style.setProperty('--ameva-scrollbar-element-horizontal-inset', `${horizontalInset}px`);
        this.root.style.setProperty('--ameva-scrollbar-element-inline-end-inset', `${resolvedInlineEndInset}px`);
    }

    resolveOverlayZIndex() {
        let currentElement = this.host;
        let highestZIndex = 4;

        while (currentElement && currentElement !== document.body) {
            const styles = window.getComputedStyle(currentElement);
            const resolvedZIndex = Number.parseInt(styles.zIndex, 10);

            if (!Number.isNaN(resolvedZIndex)) {
                highestZIndex = Math.max(highestZIndex, resolvedZIndex + 1);
            }

            currentElement = currentElement.parentElement;
        }

        return highestZIndex;
    }

    resolveElementInsets() {
        const styles = window.getComputedStyle(this.host);
        const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
        const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
        const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
        const radiusTopRight = Number.parseFloat(styles.borderTopRightRadius) || 0;
        const radiusBottomRight = Number.parseFloat(styles.borderBottomRightRadius) || 0;

        const paddingInset = Math.min(Math.max(Math.min(paddingTop, paddingRight, paddingBottom) * 0.5, 8), 18);
        const radiusInset = Math.min(Math.max(Math.min(radiusTopRight, radiusBottomRight) * 0.18, 0), 12);
        const fallbackInset = Math.max(paddingInset, radiusInset);
        const sharedInset = this.readDatasetNumber('amevascrollbarInset', 'amevascrollbarPadding');
        const horizontalInset = this.readDatasetNumber('amevascrollbarInsetX', 'amevascrollbarPaddingX')
            ?? sharedInset
            ?? fallbackInset;
        const verticalInset = this.readDatasetNumber('amevascrollbarInsetY', 'amevascrollbarPaddingY')
            ?? sharedInset
            ?? fallbackInset;
        const inlineEndInset = this.readDatasetNumber('amevascrollbarInlineEndInset');

        return {
            horizontalInset,
            verticalInset,
            inlineEndInset,
        };
    }

    isHostVisible() {
        if (!this.host.isConnected) {
            return false;
        }

        if (this.host.hidden || this.host.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        const styles = window.getComputedStyle(this.host);

        if (styles.display === 'none' || styles.visibility === 'hidden') {
            return false;
        }

        const rect = this.host.getBoundingClientRect();

        return rect.width > 0 && rect.height > 0;
    }

    clearFadeInTimer() {
        if (this.fadeInTimer !== null) {
            window.clearTimeout(this.fadeInTimer);
            this.fadeInTimer = null;
        }
    }

    prepareVisibleRoot() {
        this.root.classList.remove('ameva-scrollbar--hidden');
        this.root.style.pointerEvents = '';

        if (this.hasActivated) {
            this.root.classList.add('ameva-scrollbar--active');
            this.root.classList.remove('ameva-scrollbar--initializing');

            return;
        }

        this.hasActivated = true;
        this.clearFadeInTimer();

        this.fadeInTimer = window.setTimeout(() => {
            this.root.classList.add('ameva-scrollbar--active');
            this.root.classList.remove('ameva-scrollbar--initializing');
            this.fadeInTimer = null;
        }, ROOT_FADE_IN_DELAY_MS);
    }

    deactivateRoot() {
        this.clearFadeInTimer();
        this.hasActivated = false;
        this.root.classList.remove('ameva-scrollbar--active');
        this.root.classList.add('ameva-scrollbar--hidden', 'ameva-scrollbar--initializing');
        this.root.style.pointerEvents = 'none';

        if (this.vertical) {
            this.resetAxis(this.vertical, 'vertical');
        }

        if (this.horizontal) {
            this.resetAxis(this.horizontal, 'horizontal');
        }
    }

    updateRootVisibility() {
        const verticalHidden = this.vertical ? this.vertical.track.classList.contains('ameva-scrollbar__track--hidden') : true;
        const horizontalHidden = this.horizontal ? this.horizontal.track.classList.contains('ameva-scrollbar__track--hidden') : true;

        if (verticalHidden && horizontalHidden) {
            this.deactivateRoot();
            return;
        }

        this.prepareVisibleRoot();
    }

    resetAxis(axisRef, axis) {
        axisRef.track.classList.add('ameva-scrollbar__track--hidden');

        if (axis === 'vertical') {
            axisRef.thumb.style.height = '';
            axisRef.thumb.style.setProperty('--ameva-scrollbar-thumb-offset-y', '0px');

            return;
        }

        axisRef.thumb.style.width = '';
        axisRef.thumb.style.setProperty('--ameva-scrollbar-thumb-offset-x', '0px');
    }

    updateAxis(axisRef, metrics, axis) {
        const isVertical = axis === 'vertical';
        const viewportSize = isVertical ? metrics.viewportHeight : metrics.viewportWidth;
        const scrollSize = isVertical ? metrics.scrollHeight : metrics.scrollWidth;
        const scrollOffset = isVertical ? metrics.scrollTop : metrics.scrollLeft;
        const maxScroll = isVertical ? metrics.maxScrollTop : metrics.maxScrollLeft;
        const trackSize = isVertical ? axisRef.track.clientHeight : axisRef.track.clientWidth;

        if (!trackSize || scrollSize <= viewportSize + 1) {
            this.resetAxis(axisRef, axis);

            return;
        }

        axisRef.track.classList.remove('ameva-scrollbar__track--hidden');

        const thumbPadding = this.resolveThumbPadding();
        const thumbMinSize = this.resolveThumbMinSize();
        const thumbSize = Math.max((viewportSize / scrollSize) * trackSize, thumbMinSize);
        const availableTravel = Math.max(trackSize - thumbSize - thumbPadding * 2, 0);
        const progress = maxScroll > 0 ? scrollOffset / maxScroll : 0;
        const thumbOffset = thumbPadding + availableTravel * progress;

        if (isVertical) {
            axisRef.thumb.style.height = `${thumbSize}px`;
            axisRef.thumb.style.setProperty('--ameva-scrollbar-thumb-offset-y', `${thumbOffset}px`);

            return;
        }

        axisRef.thumb.style.width = `${thumbSize}px`;
        axisRef.thumb.style.setProperty('--ameva-scrollbar-thumb-offset-x', `${thumbOffset}px`);
    }

    scrollToTrackPosition(axis, track, thumb, event, dragging = false) {
        const rect = track.getBoundingClientRect();
        const metrics = this.getMetrics();

        if (axis === 'vertical') {
            const thumbPadding = this.resolveThumbPadding();
            const thumbHeight = thumb.offsetHeight || this.resolveThumbMinSize();
            const availableTravel = Math.max(rect.height - thumbHeight - thumbPadding * 2, 0);
            const targetOffset = Math.min(
                Math.max(event.clientY - rect.top - thumbHeight / 2 - thumbPadding, 0),
                availableTravel,
            );
            const progress = availableTravel > 0 ? targetOffset / availableTravel : 0;

            this.scrollTo({
                top: progress * metrics.maxScrollTop,
                behavior: dragging ? 'auto' : 'smooth',
            });

            return;
        }

        const thumbPadding = this.resolveThumbPadding();
        const thumbWidth = thumb.offsetWidth || this.resolveThumbMinSize();
        const availableTravel = Math.max(rect.width - thumbWidth - thumbPadding * 2, 0);
        const targetOffset = Math.min(
            Math.max(event.clientX - rect.left - thumbWidth / 2 - thumbPadding, 0),
            availableTravel,
        );
        const progress = availableTravel > 0 ? targetOffset / availableTravel : 0;

        this.scrollTo({
            left: progress * metrics.maxScrollLeft,
            behavior: dragging ? 'auto' : 'smooth',
        });
    }

    forwardWheel(axis, event) {
        const delta = axis === 'horizontal' ? event.deltaX : event.deltaY;

        if (delta === 0) {
            return;
        }

        event.preventDefault();

        if (axis === 'horizontal') {
            this.scrollBy({
                left: delta,
                behavior: 'auto',
            });

            return;
        }

        this.scrollBy({
            top: delta,
            behavior: 'auto',
        });
    }

    forwardHostWheel(event) {
        if (this.viewport || event.defaultPrevented) {
            return;
        }

        const target = event.target instanceof Element
            ? event.target
            : null;

        if (target?.closest('[data-amevascrollbar-root]')) {
            return;
        }

        const primaryAxis = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? 'vertical'
            : 'horizontal';

        if (this.canNestedScrollableConsumeWheel(target, event, primaryAxis)) {
            return;
        }

        const metrics = this.getMetrics();
        const canScrollVertically = this.verticalEnabled
            && metrics.maxScrollTop > 0
            && event.deltaY !== 0;
        const canScrollHorizontally = this.horizontalEnabled
            && metrics.maxScrollLeft > 0
            && event.deltaX !== 0;

        if (!canScrollVertically && !canScrollHorizontally) {
            return;
        }

        event.preventDefault();
        this.scrollElement.scrollBy({
            top: canScrollVertically ? event.deltaY : 0,
            left: canScrollHorizontally ? event.deltaX : 0,
            behavior: 'auto',
        });
    }

    scrollTo(options) {
        if (this.viewport) {
            window.scrollTo({
                top: options.top ?? window.scrollY,
                left: options.left ?? window.scrollX,
                behavior: options.behavior,
            });

            return;
        }

        this.scrollElement.scrollTo(options);
    }

    scrollBy(options) {
        if (this.viewport) {
            window.scrollBy(options);

            return;
        }

        this.scrollElement.scrollBy(options);
    }

    canNestedScrollableConsumeWheel(target, event, primaryAxis) {
        let currentElement = target;

        while (currentElement && currentElement !== this.host) {
            if (!(currentElement instanceof HTMLElement)) {
                currentElement = currentElement.parentElement;

                continue;
            }

            const styles = window.getComputedStyle(currentElement);
            const overflowY = styles.overflowY;
            const overflowX = styles.overflowX;
            const scrollableVertically = /(auto|scroll|overlay)/.test(overflowY) && currentElement.scrollHeight > currentElement.clientHeight;
            const scrollableHorizontally = /(auto|scroll|overlay)/.test(overflowX) && currentElement.scrollWidth > currentElement.clientWidth;

            if (primaryAxis === 'vertical' && scrollableVertically) {
                const nextScrollTop = currentElement.scrollTop + event.deltaY;
                const maxScrollTop = currentElement.scrollHeight - currentElement.clientHeight;

                if (nextScrollTop > 0 && nextScrollTop < maxScrollTop) {
                    return true;
                }
            }

            if (primaryAxis === 'horizontal' && scrollableHorizontally) {
                const nextScrollLeft = currentElement.scrollLeft + event.deltaX;
                const maxScrollLeft = currentElement.scrollWidth - currentElement.clientWidth;

                if (nextScrollLeft > 0 && nextScrollLeft < maxScrollLeft) {
                    return true;
                }
            }

            currentElement = currentElement.parentElement;
        }

        return false;
    }

    destroy() {
        this.clearFadeInTimer();

        if (this.frame !== null) {
            window.cancelAnimationFrame(this.frame);
            this.frame = null;
        }

        if (this.transitionTrackingFrame !== null) {
            window.cancelAnimationFrame(this.transitionTrackingFrame);
            this.transitionTrackingFrame = null;
        }

        if (this.viewport) {
            window.removeEventListener('scroll', this.handleScroll);
            window.removeEventListener('resize', this.handleResize);
            window.removeEventListener('load', this.handleWindowLoad);
            document.documentElement.classList.remove('ameva-scrollbar-host', 'ameva-scrollbar-host--viewport');
            document.body.classList.remove('ameva-scrollbar-host', 'ameva-scrollbar-host--viewport');
        } else {
            this.scrollElement.removeEventListener('scroll', this.handleScroll);
            this.host.removeEventListener('wheel', this.handleHostWheel);
            window.removeEventListener('resize', this.handleResize);
            window.removeEventListener('scroll', this.handleResize);
            this.host.removeEventListener('transitionrun', this.handleHostTransitionStart);
            this.host.removeEventListener('transitionstart', this.handleHostTransitionStart);
            this.host.removeEventListener('transitionend', this.handleHostTransitionEnd);
            this.host.removeEventListener('transitioncancel', this.handleHostTransitionEnd);
            this.host.removeEventListener('animationstart', this.handleHostTransitionStart);
            this.host.removeEventListener('animationend', this.handleHostTransitionEnd);
            this.host.removeEventListener('animationcancel', this.handleHostTransitionEnd);
        }

        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();
        this.root?.remove();

        this.host.classList.remove('ameva-scrollbar-host');
        delete this.host.dataset.amevascrollbarInitialized;
        this.dragState = null;
        this.root = null;
        this.vertical = null;
        this.horizontal = null;
    }
}
