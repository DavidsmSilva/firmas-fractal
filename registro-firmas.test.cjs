const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('tarjetas-firmas-server/registro-firmas.js', 'utf8');
function setup({ error = null, authError = null, pending = null } = {}) {
    const user = { id: 'azure-id', email: 'persona@example.com', app_metadata: { provider: 'azure' } };
    const values = { nombre: ' Nombre ', telefono: '123', plantilla: 'ejecutiva', foto_perfil: null };
    const inserts = [];
    const context = { window: {} };
    vm.runInNewContext(source, context);
    const client = {
        auth: { getUser: async () => ({ data: { user }, error: authError }) },
        from: (table) => ({ insert: async (payload) => {
            inserts.push({ table, payload });
            if (pending) await pending;
            return { error };
        } })
    };
    const registro = context.window.crearRegistroFirmas({ client, snapshot: () => values, invalidate() {} });
    return { registro, user, values, inserts, client };
}
test('anonymous/non-Azure cannot begin or export', () => {
    const x = setup();
    assert.throws(() => x.registro.iniciar(null));
    assert.throws(() => x.registro.iniciar({ ...x.user, app_metadata: { provider: 'email' } }));
    assert.equal(x.registro.puedeExportar(x.user), false);
});
test('success preserves original values/identity and waits for completion', async () => {
    const x = setup();
    assert.equal(x.registro.iniciar(x.user), true);
    assert.equal(x.registro.iniciar(x.user), false);
    assert.equal(await x.registro.guardar('firmas_generadas_hyperesg', { nombre: 'Nombre' }), true);
    assert.equal(x.registro.puedeExportar(x.user), false);
    x.registro.finalizar();
    assert.equal(x.registro.puedeExportar(x.user), true);
    assert.equal(x.inserts.length, 1);
    assert.equal(x.inserts[0].payload.datos_ingresados.nombre, ' Nombre ');
    assert.equal(x.inserts[0].payload.user_id, x.user.id);
});
test('save failure never enables export', async () => {
    const x = setup({ error: { code: 'PGRST205' } });
    x.registro.iniciar(x.user);
    await assert.rejects(x.registro.guardar('firmas_generadas_hyperesg', {}), /guardar el registro/);
    x.registro.finalizar();
    assert.equal(x.registro.puedeExportar(x.user), false);
});
test('expired authentication prevents insert', async () => {
    const x = setup({ authError: new Error('expired') });
    x.registro.iniciar(x.user);
    await assert.rejects(x.registro.guardar('firmas_generadas_hyperesg', {}), /sesión expiró/);
    assert.equal(x.inserts.length, 0);
});
test('editing during rendering cancels before insert', async () => {
    const x = setup();
    x.registro.iniciar(x.user);
    x.values.plantilla = 'minimalista';
    x.registro.invalidar();
    assert.equal(await x.registro.guardar('firmas_generadas_hyperesg', {}), false);
    assert.equal(x.inserts.length, 0);
});
test('editing during pending save blocks stale export, keeps original history', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const x = setup({ pending });
    x.registro.iniciar(x.user);
    const saving = x.registro.guardar('firmas_generadas_hyperesg', {});
    await new Promise(resolve => setImmediate(resolve));
    x.values.nombre = 'Otro';
    x.registro.invalidar();
    release();
    assert.equal(await saving, false);
    x.registro.finalizar();
    assert.equal(x.registro.puedeExportar(x.user), false);
    assert.equal(x.inserts[0].payload.datos_ingresados.nombre, ' Nombre ');
});
test('edits, photo changes and signout block saved exports', async () => {
    const x = setup();
    x.registro.iniciar(x.user);
    await x.registro.guardar('firmas_generadas_hyperesg', {});
    x.registro.finalizar();
    assert.equal(x.registro.puedeExportar(null), false);
    x.values.foto_perfil = 'data:image/png;base64,changed';
    assert.equal(x.registro.puedeExportar(x.user), false);
    x.registro.invalidar();
    assert.equal(x.registro.puedeExportar(x.user), false);
});
for (const brand of ['firma', 'hyperesg']) {
    test(`${brand}: inline JS compiles; insert precedes output; export gates exist`, () => {
        const html = fs.readFileSync(`tarjetas-firmas-server/generador-${brand}.html`, 'utf8');
        const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
        new vm.Script(script);
        const submit = script.slice(script.indexOf("document.getElementById('firmaForm').addEventListener('submit'"));
        assert.ok(submit.indexOf('await registroFirmas.guardar(') < submit.indexOf('iframe.srcdoc = generatedHtml'));
        assert.ok(!submit.includes('if (currentUser) {'));
        assert.ok(script.includes('datos.foto_perfil = croppedDataUrl || null'));
        assert.ok((script.match(/registroFirmas.puedeExportar\(currentUser\)/g) || []).length >= 4);
        if (brand === 'hyperesg') assert.ok(script.includes('const AUTH_ENABLED = true;'));
    });
}
