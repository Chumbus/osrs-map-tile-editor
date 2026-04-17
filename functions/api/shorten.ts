/// <reference types="@cloudflare/workers-types" />

interface Env {
	SHORT_URLS: KVNamespace;
}

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const ID_LENGTH = 6;
const MAX_URL_LENGTH = 8192;
const MAX_COLLISION_RETRIES = 5;

function randomId(): string {
	const bytes = new Uint8Array(ID_LENGTH);
	crypto.getRandomValues(bytes);
	let id = "";
	for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length];
	return id;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	let body: { url?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "invalid JSON body" }, { status: 400 });
	}

	const target = body.url;
	if (typeof target !== "string" || target.length === 0) {
		return Response.json({ error: "missing url" }, { status: 400 });
	}
	if (target.length > MAX_URL_LENGTH) {
		return Response.json({ error: "url too long" }, { status: 413 });
	}

	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		return Response.json({ error: "invalid url" }, { status: 400 });
	}

	const origin = new URL(request.url).origin;
	if (parsed.origin !== origin) {
		return Response.json({ error: "url must match this origin" }, { status: 400 });
	}

	for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
		const id = randomId();
		const existing = await env.SHORT_URLS.get(id);
		if (existing !== null) continue;
		await env.SHORT_URLS.put(id, target);
		return Response.json({ id, shortUrl: `${origin}/s/${id}` });
	}
	return Response.json({ error: "could not allocate id" }, { status: 500 });
};
