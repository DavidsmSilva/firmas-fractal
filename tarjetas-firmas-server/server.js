// ──────────────────────────────────────────────────────────────────────────────
//  GENERADOR DE FIRMAS FRACTAL — Servidor con autenticación Microsoft
// ──────────────────────────────────────────────────────────────────────────────
//  Fase 1: Localhost con Node.js + Express + MSAL
//  Fase 2: Migrar a Azure Static Web Apps + Easy Auth (mismo HTML, sin backend)
// ──────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');

const app = express();

app.use(express.urlencoded({ extended: true }));

// ─── Logos públicos ──────────────────────────────────────────────────────────
app.get('/logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'logo.png'));
});
app.get('/logo-blanco.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'logo-blanco.png'));
});

// ─── Modo desarrollo ─────────────────────────────────────────────────────────
// Si DEV_MODE=true, NO necesita Azure. Usa un login falso para pruebas locales.
const DEV_MODE = process.env.DEV_MODE === 'true';

if (DEV_MODE) {
    console.log('🔧  MODO DESARROLLO — Sin Azure, login simulado');
} else {
    // ─── Validación de configuración de Azure ────────────────────────────────
    const REQUIRED_ENV = ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_CLIENT_SECRET'];
    const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
    if (missingEnv.length > 0) {
        console.error('❌ Faltan variables de entorno requeridas:');
        missingEnv.forEach(key => console.error(`   - ${key}`));
        console.error('\n📄 Copiá .env.example a .env y completá los valores de Azure.');
        console.error('   O poné DEV_MODE=true para desarrollo sin Azure.');
        process.exit(1);
    }
}

// ─── MSAL (Microsoft Authentication Library) — solo en producción ────────────
let msalClient = null;
if (!DEV_MODE) {
    const msal = require('@azure/msal-node');
    const msalConfig = {
        auth: {
            clientId: process.env.AZURE_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
            clientSecret: process.env.AZURE_CLIENT_SECRET,
        }
    };
    msalClient = new msal.ConfidentialClientApplication(msalConfig);
}

// ─── Sesión ──────────────────────────────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// ─── Middleware: verifica autenticación ──────────────────────────────────────
function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        return next();
    }
    req.session.returnUrl = req.originalUrl;
    res.redirect('/auth/login');
}

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
//  RUTAS DE AUTENTICACIÓN
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

// Pagina de error compartida
function errorPage(title, message, link) {
    return `
        <html><body style="font-family:'Segoe UI',sans-serif;padding:40px;background:#f5f5f5;">
            <div style="max-width:500px;margin:40px auto;background:white;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color:#d32f2f;margin:0 0 10px;">${title}</h2>
                <p style="color:#555;">${message}</p>
                ${link ? `<a href="${link}" style="color:#1e3a6e;font-weight:600;">Volver al inicio</a>` : ''}
            </div>
        </body></html>`;
}

// ─── DEV MODE: Login con formulario simple ────────────────────────────────────
if (DEV_MODE) {
    app.get('/auth/login', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Iniciar Sesión — Generador de Firmas</title>
                <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Montserrat', sans-serif;
                        background: #ffffff;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .login-card {
                        width: 100%;
                        max-width: 400px;
                        text-align: center;
                    }
                    .login-card .logo {
                        max-width: 260px;
                        margin-bottom: 40px;
                    }
                    .login-card h1 {
                        font-size: 20px;
                        color: #343265;
                        margin-bottom: 4px;
                        font-weight: 700;
                    }
                    .login-card p {
                        font-size: 13px;
                        color: #888;
                        margin-bottom: 24px;
                    }
                    .login-card label {
                        display: block;
                        text-align: left;
                        font-size: 13px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 6px;
                    }
                    .login-card input {
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 14px;
                        font-family: 'Montserrat', sans-serif;
                        transition: border-color 0.2s;
                        margin-bottom: 20px;
                    }
                    .login-card input:focus {
                        outline: none;
                        border-color: #343265;
                    }
                    .login-card button {
                        width: 100%;
                        padding: 12px;
                        background: #343265;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 600;
                        font-family: 'Montserrat', sans-serif;
                        cursor: pointer;
                        transition: background 0.2s;
                    }
                    .login-card button:hover { background: #2a2852; }
                </style>
            </head>
            <body>
                <div class="login-card">
                    <img src="/logo.png" alt="Estrategias Fractal" class="logo">
                    <h1>Iniciar Sesión</h1>
                    <p>Ingresá tu correo corporativo</p>
                    <form method="POST" action="/auth/login">
                        <label for="email">Correo electrónico</label>
                        <input type="email" name="email" id="email"
                               placeholder="nombre@estrategiasfractal.com" required>
                        <button type="submit">Ingresar</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    });

    // POST del login en modo desarrollo
    app.post('/auth/login', (req, res) => {
        const email = req.body.email || 'dev@estrategiasfractal.com';
        const name = email.split('@')[0].replace(/[._]/g, ' ');
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);

        req.session.isAuthenticated = true;
        req.session.user = {
            name: displayName,
            email: email,
            id: `dev-${Date.now()}`,
        };

        console.log(`✅ [DEV] Sesión iniciada: ${displayName} (${email})`);

        const returnUrl = req.session.returnUrl || '/generador-firma.html';
        delete req.session.returnUrl;
        res.redirect(returnUrl);
    });

    // Logout en modo desarrollo
    app.get('/auth/logout', (req, res) => {
        const userName = req.session.user?.name;
        req.session.destroy(() => {
            console.log(`👋 [DEV] Sesión cerrada: ${userName || 'desconocido'}`);
            res.redirect('/auth/login');
        });
    });

// ─── PRODUCCIÓN: Login con Microsoft ─────────────────────────────────────────
} else {
    app.get('/auth/login', (req, res) => {
        const authCodeUrlParameters = {
            scopes: ['User.Read'],
            redirectUri: process.env.AZURE_REDIRECT_URI,
        };

        msalClient.getAuthCodeUrl(authCodeUrlParameters)
            .then((response) => res.redirect(response))
            .catch((error) => {
                console.error('❌ Error al generar URL de auth:', error);
                res.status(500).send(errorPage(
                    'Error al iniciar sesión',
                    'No se pudo conectar con Microsoft. Verificá la configuración en el .env',
                    '/'
                ));
            });
    });

    app.get('/auth/redirect', async (req, res) => {
        const { code, error } = req.query;

        if (error) {
            console.error('❌ Error de autenticación Microsoft:', error);
            return res.status(401).send(errorPage(
                'Autenticación cancelada o fallida',
                'No se pudo completar el inicio de sesión con Microsoft.',
                '/auth/login'
            ));
        }

        if (!code) {
            return res.status(400).send('Código de autenticación no recibido');
        }

        try {
            const tokenRequest = {
                code: code,
                scopes: ['User.Read'],
                redirectUri: process.env.AZURE_REDIRECT_URI,
            };

            const response = await msalClient.acquireTokenByCode(tokenRequest);

            // La autorización de usuarios se maneja desde Azure AD
            // (Enterprise Applications → User assignments)

            req.session.isAuthenticated = true;
            req.session.user = {
                name: response.account.name,
                email: response.account.username,
                id: response.account.homeAccountId,
            };

            console.log(`✅ Sesión iniciada: ${response.account.name} (${response.account.username})`);

            const returnUrl = req.session.returnUrl || '/generador-firma.html';
            delete req.session.returnUrl;
            res.redirect(returnUrl);

        } catch (error) {
            console.error('❌ Error al validar token:', error);
            res.status(500).send(errorPage(
                'Error al validar la autenticación',
                'Hubo un problema al procesar tu inicio de sesión.',
                '/auth/login'
            ));
        }
    });

    app.get('/auth/logout', (req, res) => {
        const userName = req.session.user?.name;
        req.session.destroy(() => {
            console.log(`👋 Sesión cerrada: ${userName || 'desconocido'}`);
            const logoutUri = `${process.env.AZURE_LOGOUT_URI}?post_logout_redirect_uri=${encodeURIComponent(process.env.AZURE_POST_LOGOUT_URI)}`;
            res.redirect(logoutUri);
        });
    });
}

// ─── API: devuelve info del usuario autenticado ──────────────────────────────
app.get('/api/me', isAuthenticated, (req, res) => {
    res.json(req.session.user);
});

// ─── SERVIR ARCHIVOS PROTEGIDOS ─────────────────────────────────────────────
app.get('/generador-firma.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'generador-firma.html'));
});
app.use('/protected', isAuthenticated, express.static(path.join(__dirname, 'protected')));

// ─── Raíz ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    if (req.session.isAuthenticated) {
        res.redirect('/generador-firma.html');
    } else {
        res.redirect('/auth/login');
    }
});

// ─── Error 404 ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).send(errorPage('404 — Página no encontrada', null, '/'));
});

// ─── Iniciar servidor ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  🚀  GENERADOR DE FIRMAS FRACTAL');
    if (DEV_MODE) {
        console.log('  🔧  MODO DESARROLLO (sin Azure)');
    } else {
        console.log('  🔒  Autenticación: Microsoft Entra ID');
    }
    console.log(`  📍  http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════');
    console.log('');
});
