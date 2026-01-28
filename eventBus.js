const listeners = Object.create(null);

export function subscribe(event, fn) {
	(listeners[event] = listeners[event] || []).push(fn);
	console.log(`[eventBus] subscribed -> ${event} (total: ${listeners[event].length})`);
	return () => {
		listeners[event] = (listeners[event] || []).filter((l) => l !== fn);
		console.log(`[eventBus] unsubscribed -> ${event} (remaining: ${listeners[event].length})`);
	};
}

export function emit(event, payload) {
	console.log('[eventBus] emit', event, payload);
	;(listeners[event] || []).slice().forEach((fn) => {
		try {
			fn(payload);
		} catch (e) {
			console.warn('[eventBus] handler error', e);
		}
	});
}