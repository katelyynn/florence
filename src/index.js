//
// florence, a framework for interacting with Last.fm
// Copyright (c) 2025 katelyn and contributors
// Licensed under GPLv3
//

import { log } from './log';

export const version = '2025.1126.1';

export { log };

let last_page_type = {
    state: undefined
};
let last_page_subpage = {
    state: undefined
};

export default function florence({
    page,
    on_head_load,
    on_body_load,
    on_mutation,
    on_page_change,
    on_subpage_change,
    on_error,
    on_dedicated_page
}) {
    log('starting florence', 'load', 'info', {
        page,
        on_head_load,
        on_body_load,
        on_mutation,
        on_page_change,
        on_subpage_change,
        on_error,
        on_dedicated_page
    });

    let head_observer = new MutationObserver(() => {
        if (document.head) {
            document.documentElement.classList.add('florence-supports-loading');
            if (on_head_load) on_head_load();

            head_observer.disconnect();
        }
    });

    head_observer.observe(document.documentElement, {
        childList: true
    });

    let pre_observer = new MutationObserver((mutations) => {
        log('pre', 'load', 'info', { mutations });
        if (document.body) {
            log(`${JSON.stringify(document.body.classList)}`, 'load');
            document.body.classList.add('florence');
        }

        if (
            document.body &&
            document.body.querySelector('.adaptive-skin-container') &&
            document.body.querySelector('.footer')
        ) {
            main();

            pre_observer.disconnect();
        } else if (
            document.body &&
            (
                document.body.querySelector(':scope > .container') ||
                document.body.classList.contains('namespace--user_now')
            )
        ) {
            // error 503 or other page
            document.body.classList.add('florence-loaded');

            if (document.body.querySelector(':scope > .container')) {
                on_dedicated_page('503');
            } else if (document.body.classList.contains('namespace--user_now')) {
                on_dedicated_page('now');
            }
        }
    });

    pre_observer.observe(document.documentElement, {
        childList: true
    });

    function main() {
        log('main thread starting', 'page', 'log', {
            document,
            body: document.body
        });
        let performance_start = performance.now();

        try {
            if (on_body_load) on_body_load();
            flow();

            // last.fm is a single page application
            const observer = new MutationObserver((mutations) => {
                if (!mutations[0]) return;
                const nodes = [
                    ...mutations[0].addedNodes,
                    ...mutations[0].removedNodes
                ];
                if (
                    nodes.length &&
                    nodes.every(
                        (n) =>
                            n.nodeType == 1 &&
                            (n.hasAttribute('data-tippy-root') ||
                                (n.id || '').startsWith('tippy-'))
                    )
                ) {
                    log('ignored', 'mutation', 'log', { mutations: mutations });
                    return;
                }

                log('loop', 'mutation', 'log', { mutations: mutations });

                flow();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            let performance_end = performance.now();
            log(
                `finished in ${(performance_end - performance_start) / 1000} seconds`,
                'load'
            );
        } catch (e) {
            log(`florence ran into an error`, 'load', 'error', { e });
            if (on_error) on_error(e);
        }
    }

    function flow() {
        let performance_start = performance.now();
        assign_page();

        if (page.state.error) return;

        if (on_mutation) on_mutation();

        let performance_end = performance.now();
        log(`finished in ${(performance_end - performance_start) / 1000} seconds`, 'loop');
    }

    function assign_page() {
        document.documentElement.classList.add('florence-supports-loading');
        if (!page.structure.wrapper)
            page.structure.wrapper = document.body.querySelector('.main-content');

        let main_content = page.structure.wrapper.querySelector(':scope > :last-child:not([data-florence])');
        if (main_content) {
            assign_page_type();

            if (on_page_change) on_page_change(main_content);

            main_content.setAttribute('data-florence', 'true');
        } else {
            assign_page_subpage();
        }

        document.body.classList.add('florence-loaded');
    }

    function assign_page_type() {
        let page_classes = document.body.classList;
        page_classes.forEach((page_class, index) => {
            if (page_class.startsWith('namespace')) {
                page.initial = page_class.replace('namespace--', '');
                let page_split = page.initial.split('_');

                page.type = page_split[0];
                if (page.type == 'music') {
                    page.type = page_split[1];
                }

                if (page.type != last_page_type.state) {
                    last_page_type.state = page.type;
                    log(page.type, 'page');
                }

                assign_page_subpage();

                return;
            }

            if (index > 4) return;
        });
    }

    function assign_page_subpage() {
        page.subpage = page.initial
            .replace(page.type, '')
            .replace('_', '')
            .replace('music_', '')
            .replace('festival_', 'event_');

        if (last_page_subpage.state != page.subpage) {
            last_page_subpage.state = page.subpage;
            log(`subpage of ${page.subpage}`, 'page');

            if (on_subpage_change) on_subpage_change();
        }
    }
}
