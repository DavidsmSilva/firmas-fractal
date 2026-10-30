/* El resultado solo queda disponible después de confirmar el registro. */
(function (root) {
    'use strict';
    function crearRegistroFirmas({ client, snapshot, invalidate }) {
        let version = 0;
        let busy = false;
        let saved = null;
        let attempt = null;
        function invalidar() {
            version += 1;
            saved = null;
            invalidate();
        }
        return {
            invalidar,
            iniciar(user) {
                if (busy) return false;
                invalidar();
                if (!user || !user.id || !user.email || user.app_metadata?.provider !== 'azure') {
                    throw new Error('Inicia sesión con tu cuenta corporativa de Microsoft.');
                }
                busy = true;
                attempt = { version, snapshot: JSON.stringify(snapshot()), user };
                return true;
            },
            async guardar(table, values) {
                if (!busy || !attempt) throw new Error('No hay una generación autenticada en curso.');
                const active = attempt;
                const { data, error: authError } = await client.auth.getUser();
                if (authError || data?.user?.id !== active.user.id || data.user.app_metadata?.provider !== 'azure') {
                    throw new Error('La sesión expiró. Inicia sesión y vuelve a generar la firma.');
                }
                if (version !== active.version || JSON.stringify(snapshot()) !== active.snapshot) return false;
                const { error } = await client.from(table).insert({
                    ...values,
                    user_id: data.user.id,
                    user_email: data.user.email,
                    datos_ingresados: JSON.parse(active.snapshot)
                });
                if (error) throw new Error('No se pudo guardar el registro. Intenta generar la firma nuevamente.');
                if (version !== active.version || JSON.stringify(snapshot()) !== active.snapshot) return false;
                saved = { snapshot: active.snapshot, userId: data.user.id };
                return true;
            },
            puedeExportar(user) {
                return !busy && !!saved && saved.userId === user?.id && saved.snapshot === JSON.stringify(snapshot());
            },
            finalizar() { busy = false; attempt = null; }
        };
    }
    root.crearRegistroFirmas = crearRegistroFirmas;
    if (typeof module !== 'undefined') module.exports = { crearRegistroFirmas };
})(typeof window !== 'undefined' ? window : globalThis);
