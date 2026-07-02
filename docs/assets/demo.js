import { AmevaScrollbar } from './AmevaScrollbar.js';

const instances = [];

document.querySelectorAll('.js-demo-scrollbar').forEach((element) => {
    const scrollbar = new AmevaScrollbar({
        host: element,
        scrollElement: element,
        vertical: true,
        horizontal: false,
    });

    scrollbar.initialize();
    instances.push(scrollbar);
});

document.querySelectorAll('.js-demo-scrollbar-x').forEach((element) => {
    const scrollbar = new AmevaScrollbar({
        host: element,
        scrollElement: element,
        vertical: true,
        horizontal: true,
        horizontalWheel: true,
    });

    scrollbar.initialize();
    instances.push(scrollbar);
});

const viewportScrollbar = new AmevaScrollbar({
    host: document.body,
    scrollElement: document.scrollingElement || document.documentElement,
    viewport: true,
    vertical: true,
    horizontal: false,
});

viewportScrollbar.initialize();
instances.push(viewportScrollbar);

window.addEventListener('load', () => {
    instances.forEach((instance) => {
        instance.refresh();
    });
});
