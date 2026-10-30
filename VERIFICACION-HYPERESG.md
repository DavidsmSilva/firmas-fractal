# HYPERESG — registro y publicación, 30 octubre 2026

Destino: https://davidsmsilva.github.io/firmas-fractal/generador-hyperesg.html
El workflow del repositorio publica `tarjetas-firmas-server` al actualizar `main`.

Antes del cambio: HYPERESG devolvía HTTP 404, su archivo local tenía autenticación
desactivada y no existía `firmas_generadas_hyperesg` en Supabase
`xdogjudumunttrhzftwq`. `firmas_generadas` contenía 3 filas históricas.
Las generaciones anteriores no registradas no se pueden reconstruir.

Cada generación confirmada añade una fila nueva con identidad autenticada, hora
del servidor, datos usados y `datos_ingresados`: valores originales, plantilla y
foto recortada (NULL sin retrato), hasta 2 MiB. El servidor asigna identidad/fecha.
RLS exige Azure OAuth. Solo permite INSERT autenticado; el navegador no puede
consultar, editar ni borrar registros. No se guardan contraseñas ni tokens.

Copiar/descargar requieren INSERT confirmado. Los errores conservan el formulario
para reintentar. Editar datos, foto o plantilla, o cerrar sesión, invalida la salida.
Si la edición ocurre durante un INSERT pendiente, aquella fila histórica puede
quedar guardada, pero no se habilita exportar el resultado obsoleto.

Migración: `tarjetas-firmas-server/supabase/migration-audit.sql`, repetible y sin
inventar datos faltantes de las filas históricas. Aplicada en producción por el
coordinador; publicación Pages y comprobación posterior a cargo del coordinador.

Validación local: `node --test registro-firmas.test.cjs`, 9/9 pasan; revisión
independiente aprobada. Incluye fallo de escritura, sesión inválida, concurrencia,
edición durante render/guardado, foto, cierre de sesión y compilación de ambos HTML.

Validación en producción: 22/22 comprobaciones SQL aprobadas, con reversión de
todas las fichas de prueba. Se comprobaron identidad y fecha del servidor,
sesiones rechazadas, permisos y datos originales obligatorios. Conteos finales:
Fractal 3, HYPERESG 0; no quedaron registros ficticios.

Para revisar registros desde SQL Editor con permisos administrativos:

```sql
select id, user_id, user_email, plantilla, nombre, rol, correo, telefono,
       linkedin, created_at, datos_ingresados - 'foto_perfil' as datos_originales,
       length(datos_ingresados->>'foto_perfil') as longitud_foto
from public.firmas_generadas_hyperesg
order by created_at desc;
```

El acceso sigue mediante Microsoft Entra ID por Supabase Azure OAuth.
`prompt=login` y una sesión OAuth no demuestran MFA. La exigencia de MFA depende
de las políticas de Entra; falta comprobar un acceso real y su registro de
autenticación. No se cambiaron las políticas MFA ni proveedores habilitados.
Email también está activo, por lo que la base exige método `oauth` en el JWT
además de proveedor Azure.

El tenant antiguo del README está desactualizado: la redirección Azure actual usa
`751504e2-fdcc-4a03-8654-f8b4519e2270`, coincidente con las identidades Azure
existentes. No se utilizó el tenant antiguo para restringir usuarios.
