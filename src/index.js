import './styles.css';
import { AmevaScrollbar } from './AmevaScrollbar.js';

const DEFAULT_ELEMENT_SCROLLBAR_SELECTOR = '[data-amevascrollbar]';
const elementScrollbarInstanceMap = new WeakMap();
let viewportScrollbarInstance = null;
let viewportScrollbarHost = null;

export const getScopedElements = (container = document, selector = DEFAULT_ELEMENT_SCROLLBAR_SELECTOR) => {
    if (!container || typeof container.querySelectorAll !== 'function') {
        return [];
    }

    if (container instanceof Element && container.matches(selector)) {
        return [container, ...container.querySelectorAll(selector)];
    }

    return [...container.querySelectorAll(selector)];
};

export const initializeElementScrollbar = (container = document, options = {}) => {
    const selector = options.selector ?? DEFAULT_ELEMENT_SCROLLBAR_SELECTOR;
    const instances = [];

    getScopedElements(container, selector).forEach((element) => {
        const existingInstance = elementScrollbarInstanceMap.get(element);

        if (existingInstance) {
            existingInstance.refresh();
            instances.push(existingInstance);

            return;
        }

        const horizontal = element.dataset.amevascrollbarX === 'true';
        const vertical = element.dataset.amevascrollbarY !== 'false';
        const scrollbar = new AmevaScrollbar({
            host: element,
            scrollElement: element,
            horizontal,
            vertical,
        });

        scrollbar.initialize();
        elementScrollbarInstanceMap.set(element, scrollbar);
        instances.push(scrollbar);
    });

    return instances;
};

export const destroyElementScrollbar = (element) => {
    if (!(element instanceof Element)) {
        return false;
    }

    const scrollbar = elementScrollbarInstanceMap.get(element);

    if (!scrollbar) {
        return false;
    }

    scrollbar.destroy();
    elementScrollbarInstanceMap.delete(element);

    return true;
};

export const destroyScrollbar = (container = document, options = {}) => {
    const selector = options.selector ?? DEFAULT_ELEMENT_SCROLLBAR_SELECTOR;
    let elements = 0;

    getScopedElements(container, selector).forEach((element) => {
        if (destroyElementScrollbar(element)) {
            elements += 1;
        }
    });

    const viewport = options.viewport
        ? destroyViewportScrollbar()
        : false;

    return { elements, viewport };
};

export const initializeViewportScrollbar = (options = {}) => {
    const {
        enabled = true,
        host = document.body,
        scrollElement = document.scrollingElement || document.documentElement,
        horizontal = false,
        vertical = true,
    } = options;

    if (!enabled) {
        destroyViewportScrollbar();

        return null;
    }

    if (!(host instanceof HTMLElement)) {
        return null;
    }

    if (viewportScrollbarInstance) {
        if (
            viewportScrollbarHost === host
            && viewportScrollbarInstance.scrollElement === scrollElement
            && viewportScrollbarInstance.horizontalEnabled === horizontal
            && viewportScrollbarInstance.verticalEnabled === vertical
        ) {
            viewportScrollbarInstance.refresh();

            return viewportScrollbarInstance;
        }

        destroyViewportScrollbar();
    }

    viewportScrollbarInstance = new AmevaScrollbar({
        host,
        scrollElement,
        viewport: true,
        horizontal,
        vertical,
    });

    viewportScrollbarInstance.initialize();
    viewportScrollbarHost = host;
    host.dataset.amevascrollbarViewportInitialized = 'true';

    return viewportScrollbarInstance;
};

export const destroyViewportScrollbar = () => {
    if (!viewportScrollbarInstance) {
        return false;
    }

    viewportScrollbarInstance.destroy();

    if (viewportScrollbarHost) {
        delete viewportScrollbarHost.dataset.amevascrollbarViewportInitialized;
    }

    viewportScrollbarInstance = null;
    viewportScrollbarHost = null;

    return true;
};

export const initializeScrollbar = (options = {}) => {
    const {
        container = document,
        elements = true,
        viewport = false,
        ...elementOptions
    } = options;

    const elementInstances = elements
        ? initializeElementScrollbar(container, elementOptions)
        : [];
    const viewportInstance = viewport
        ? initializeViewportScrollbar(viewport === true ? {} : viewport)
        : null;

    return {
        elements: elementInstances,
        viewport: viewportInstance,
    };
};

export const refreshScrollbar = (container = document, options = {}) => {
    const elements = initializeElementScrollbar(container, options);
    viewportScrollbarInstance?.refresh();

    return {
        elements,
        viewport: viewportScrollbarInstance,
    };
};

export { AmevaScrollbar };
