const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const base = 'https://example.com/firmas-fractal/';
const user = { id: 'test-user', email: 'tester@estrategiasfractal.com', app_metadata: { provider: 'azure' } };
async function authState(brand, authenticated) {
    const html = fs.readFileSync('tarjetas-firmas-server/generador-' + brand + '.html', 'utf8');
    const start = html.indexOf('(async function initAuth() {');
    const source = html.slice(start, html.indexOf('})();', start) + 5);
    const calls = { app: 0, oauth: [], blocked: 0 };
    const nodes = new Map();
    const context = {
        AUTH_ENABLED: true, currentUser: null, URL,
        DOMINIOS_PERMITIDOS: ['@estrategiasfractal.com'], console,
        window: { location: new URL(base + 'generador-' + brand + '.html') },
        document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, { style: {}, textContent: '' }); return nodes.get(id); } },
        mostrarApp() { calls.app++; }, mostrarError() { calls.blocked++; }, mostrarBloqueo() { calls.blocked++; },
        supabaseClient: { auth: {
            getSession: async () => ({ data: { session: authenticated ? { user } : null } }),
            getUser: async () => ({ data: { user }, error: null }),
            signInWithOAuth: async options => { calls.oauth.push(options); }
        } }
    };
    await vm.runInNewContext(source, context);
    return { calls, context };
}
test('root preserves query and implicit OAuth fragment when opening shared selector', () => {
    const html = fs.readFileSync('tarjetas-firmas-server/index.html', 'utf8');
    const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    let result;
    vm.runInNewContext(source, { window: { location: { search: '?state=test', hash: '#access_token=test-only', replace(value) { result = value; } } } });
    assert.equal(result, 'generador-hyperesg.html?state=test#access_token=test-only');
});
for (const brand of ['firma', 'hyperesg']) {
    test(brand + ': anonymous OAuth returns to shared selector, never opens form', async () => {
        const { calls } = await authState(brand, false);
        assert.equal(calls.app, 0);
        assert.equal(calls.oauth.length, 1);
        assert.equal(calls.oauth[0].provider, 'azure');
        assert.equal(calls.oauth[0].options.redirectTo, base + 'generador-hyperesg.html');
    });
    test(brand + ': verified existing session opens requested view without another login', async () => {
        const { calls, context } = await authState(brand, true);
        assert.equal(calls.app, 1);
        assert.equal(calls.oauth.length, 0);
        assert.equal(context.currentUser.id, user.id);
        assert.equal(calls.blocked, 0);
    });
}
