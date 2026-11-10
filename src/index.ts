//
// florence, a framework for interacting with Last.fm
// Copyright (c) 2026 katelyn and contributors
// Licensed under GPLv3
//

import { log } from './log.js';

export const version = '2026.1110';

let last_page_type: { state?: string } = {};
let last_page_subpage: { state?: string } = {};

interface page {
	type: string;
	subpage: string;
	initial?: string;
	name: string;
	sister?: string;
	structure: {
		wrapper?: HTMLElement;
	},
	state: {
		error: boolean;
	},
	previous: {
		type: string;
		name: string;
		sister?: string;
	}
}

interface florence {
	page: page,
	on_head_load?: () => void;
	on_body_load?: () => void;
	on_mutation?: () => void;
	on_page_change?: (main_content: HTMLElement) => void;
	on_subpage_change?: () => void;
	on_error?: (e: Error) => void;
	on_dedicated_page?: (type: '503' | 'now') => void;
}

export default function florence({
	page,
	on_head_load,
	on_body_load,
	on_mutation,
	on_page_change,
	on_subpage_change,
	on_error,
	on_dedicated_page
}: florence) {
	let abort_loading = false;
	let continue_loop = true;

	log(`starting florence ${version}`, 'load', 'info', {
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
		if (!document.head) return;

		const split = window.location.pathname.split('/');
		const length = split.length - 1;

		// we check for the existence of last.fm playback
		// and if so abort immediately to avoid issues
		// the same is done with /pro pages to allow purchases
		if ((split[length] == 'playback' && split[length - 3] == 'listening-report') || (split[0] == 'pro' || (split[1] == 'pro'))) {
			head_observer.disconnect();
			abort_loading = true;
			return;
		}

		document.documentElement.classList.add('florence-supports-loading');
		if (on_head_load) on_head_load();

		head_observer.disconnect();
	});

	head_observer.observe(document.documentElement, {
		childList: true
	});

	let pre_observer = new MutationObserver((mutations) => {
		if (abort_loading) {
			pre_observer.disconnect();
			return;
		}

		log('awaiting a body element', 'load', 'info', { mutations });
		if (!document.body) return;

		log(`located: ${JSON.stringify(document.body.classList)}`, 'load');
		document.body.classList.add('florence');

		if (
			document.body.querySelector('.adaptive-skin-container') &&
			document.body.querySelector('.footer')
		) {
			main();

			pre_observer.disconnect();
		} else if (
			document.body.querySelector(':scope > .container') ||
			document.body.classList.contains('namespace--user_now')
		) {
			// error 503 or other page
			document.body.classList.add('florence-loaded');

			if (document.body.querySelector(':scope > .container')) {
				on_dedicated_page?.('503');
			} else if (document.body.classList.contains('namespace--user_now')) {
				on_dedicated_page?.('now');
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

			// last.fm is a single page application
			const observer = new MutationObserver((mutations) => {
				if (!continue_loop) {
					observer.disconnect();
					return;
				}

				if (!mutations[0]) return;

				// skip tooltip events
				const is_tooltip = mutations.every(mutation => {
					const nodes = [...mutation.addedNodes, ...mutation.removedNodes];

					return nodes.length > 0 && nodes.every(node => node.nodeType == 1 && (node as HTMLElement).className == 'tippy-box');
				});

				if (is_tooltip) return;

				log('loop', 'mutation', 'log', { mutations: mutations });

				schedule(observer);
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
			continue_loop = false;
			log(`florence ran into an error`, 'load', 'error', { e });
			if (on_error) on_error(e as Error);
		}
	}

	let running = false;
	let scheduled = false;

	function schedule(observer: MutationObserver) {
		if (running || scheduled) return;

		scheduled = true;
		log('scheduled response to loop', 'load');

		queueMicrotask(() => {
			scheduled = false;
			flow(observer);
		});
	}

	function flow(observer: MutationObserver) {
		if (running) return;
		running = true;

		try {
			let performance_start = performance.now();
			assign_page();

			if (page.state.error) return;

			if (on_mutation) on_mutation();

			let performance_end = performance.now();
			log(`finished in ${(performance_end - performance_start) / 1000} seconds`, 'loop');
		} catch (e) {
			log('flow error', 'loop', 'error', { e });
			if (observer) observer.disconnect();
			if (on_error) on_error(e as Error);
		} finally {
			running = false;
		}
	}

	function assign_page() {
		document.documentElement.classList.add('florence-supports-loading');
		if (!page.structure.wrapper)
			page.structure.wrapper = document.body.querySelector('.main-content') as HTMLElement;

		const main_content = page.structure.wrapper!.querySelector(':scope > :last-child:not([data-florence])') as HTMLElement;
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
		page.previous = {
			type: page.type,
			name: page.name
		}

		const namespace = [...document.body.classList].find(c => c.startsWith('namespace'));
		if (!namespace) return;

		page.initial = namespace.replace('namespace--', '');
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
	}

	function assign_page_subpage() {
		page.subpage = page.initial!
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
