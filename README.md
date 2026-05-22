# Generador de Firmas Fractal

**Aplicación web** para que los colaboradores de **Estrategias Fractal Sostenibles SAS** generen sus firmas corporativas (email signature) con formato unificado, logo, foto y enlaces a redes sociales.

La aplicación cuenta con autenticación mediante **Microsoft Entra ID** (Azure Active Directory), restringiendo el acceso exclusivamente a los usuarios del tenant `@estrategiasfractal.com`.

**Repositorio:** https://github.com/lukhack/firmas  
**Rama principal:** `main`

---

## 📑 Índice

1. [Descripción del proyecto](#1-descripción-del-proyecto)
2. [Lo que ya está implementado (no requiere acción)](#2-lo-que-ya-está-implementado-no-requiere-acción)
3. [Lo que debe configurar el ingeniero de infraestructura](#3-lo-que-debe-configurar-el-ingeniero-de-infraestructura)
   - [A. Microsoft Entra ID — App Registration](#a-microsoft-entra-id--app-registration)
   - [B. Servidor (VPS o Cloud)](#b-servidor-vps-o-cloud)
   - [C. DNS](#c-dns)
   - [D. Redirect URIs en Azure AD](#d-redirect-uris-en-azure-ad)
4. [Especificaciones técnicas](#4-especificaciones-técnicas)
   - [Stack tecnológico](#stack-tecnológico)
   - [Arquitectura de red](#arquitectura-de-red)
   - [Variables de entorno](#variables-de-entorno)
   - [Estructura del proyecto](#estructura-del-proyecto)
5. [Guía de deploy paso a paso](#5-guía-de-deploy-paso-a-paso)
   - [Paso 1: Preparar el servidor](#paso-1-preparar-el-servidor)
   - [Paso 2: Clonar y configurar](#paso-2-clonar-y-configurar)
   - [Paso 3: Configurar Nginx como proxy inverso](#paso-3-configurar-nginx-como-proxy-inverso)
   - [Paso 4: SSL con Let's Encrypt](#paso-4-ssl-con-lets-encrypt)
   - [Paso 5: PM2 — Gestión del proceso Node.js](#paso-5-pm2--gestión-del-proceso-nodejs)
   - [Paso 6: Script de deploy automático](#paso-6-script-de-deploy-automático)
   - [Paso 7: Logrotate](#paso-7-logrotate)
6. [Mantenimiento](#6-mantenimiento)
   - [Renovar Client Secret en Azure AD](#renovar-client-secret-en-azure-ad)
   - [Renovar certificado SSL](#renovar-certificado-ssl)
   - [Actualizar la aplicación](#actualizar-la-aplicación)
   - [Monitoreo](#monitoreo)
7. [Seguridad](#7-seguridad)
8. [Resolución de problemas](#8-resolución-de-problemas)

---

## 1. Descripción del proyecto

El **Generador de Firmas Fractal** permite al usuario:

1. Iniciar sesión con su cuenta corporativa de Microsoft (`@estrategiasfractal.com`)
2. Completar un formulario con su nombre, cargo, correo, teléfono y LinkedIn
3. Recortar su foto de perfil (con marco corporativo incluido)
4. Generar una firma HTML lista para copiar y pegar en Outlook

La firma generada incluye:
- Logo corporativo en blanco (cargado desde CDN de Wix, con fallback a base64 embebido)
- Nombre y cargo del colaborador
- Correo electrónico y teléfono
- Enlace a LinkedIn
- Foto con marco corporativo
- Iconos de redes sociales

---

## 2. Lo que ya está implementado (no requiere acción)

El desarrollo de la aplicación está COMPLETO. El ingeniero solo debe ocuparse de la configuración de infraestructura y Azure AD. No hay que escribir ni modificar código.

| Componente | Estado | Detalle |
|------------|--------|---------|
| **Aplicación frontend** | ✅ Listo | `generador-firma.html` — Generador de firmas completo con formulario, recorte de foto, previsualización y copia al portapapeles |
| **Servidor Node.js** | ✅ Listo | `tarjetas-firmas-server/server.js` — Servidor Express con rutas, sesiones, y autenticación MSAL |
| **Autenticación MSAL** | ✅ Listo | Integración con `@azure/msal-node` para flujo Authorization Code + PKCE contra Microsoft Entra ID |
| **Logo corporativo** | ✅ Listo | Configurado con URL pública de CDN de Wix + fallback a base64 embebido en caso de que la CDN no esté disponible |
| **Logout y expiración de sesión** | ✅ Listo | Sesión expira a las 24 horas. Logout redirige a Microsoft para cerrar sesión también en Azure AD |
| **Modo desarrollo** | ✅ Listo | `DEV_MODE=true` permite probar sin Azure AD (login simulado) — para desarrollo local únicamente |

---

## 3. Lo que debe configurar el ingeniero de infraestructura

### A. Microsoft Entra ID — App Registration

Crear una **App Registration** en Azure Portal para que la aplicación pueda autenticar usuarios mediante Microsoft Entra ID.

#### Pasos en Azure Portal

1. Ir a **[Azure Portal](https://portal.azure.com/)** → buscar **"App registrations"**
2. Hacer clic en **+ New registration**
3. Completar los siguientes campos:

| Campo | Valor |
|-------|-------|
| **Name** | `Generador Firmas Fractal` |
| **Supported account types** | ✅ **Accounts in this organizational directory only** (`6cf449e1-48ba-466f-8c91-4af9cd491a58`) |
| **Redirect URI** | (dejar vacío, se configura después) |

4. Hacer clic en **Register**

#### Obtener los identificadores

Una vez creada la aplicación, copiar los siguientes valores desde la página principal:

| Variable | Valor esperado |
|----------|----------------|
| **Application (client) ID** | `80d140e3-2169-4725-9997-265e7d1e83a6` |
| **Directory (tenant) ID** | `6cf449e1-48ba-466f-8c91-4af9cd491a58` |

#### Generar Client Secret

1. En el menú izquierdo → **Certificates & secrets**
2. Pestaña **Client secrets** → **+ New client secret**
3. Configurar:

| Campo | Valor |
|-------|-------|
| **Description** | `Generador Firmas Fractal - Producción` |
| **Expires** | **12 months** (recomendado, con alerta de renovación) |

4. Hacer clic en **Add**
5. ⚠️ **Copiar el Value inmediatamente** — Microsoft lo muestra una sola vez. Guardar en un gestor de contraseñas corporativo (Bitwarden, 1Password, Azure Key Vault, etc.)

#### Configurar Redirect URIs

1. En el menú izquierdo → **Authentication**
2. Agregar las siguientes URIs de redireccionamiento:

| Entorno | Redirect URI |
|---------|-------------|
| **Desarrollo local** | `http://localhost:3000/auth/redirect` |
| **Producción** | `https://firma.estrategiasfractal.com/auth/redirect` |

> **Importante:** Azure AD valida que la Redirect URI coincida EXACTAMENTE (incluyendo `http` vs `https`, `www` vs sin `www`, barra final, etc.). Pegar el valor sin modificaciones.

---

### B. Servidor (VPS o Cloud)

La aplicación Node.js necesita un servidor con los siguientes recursos mínimos:

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| **Sistema operativo** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **RAM** | 512 MB | 1 GB |
| **CPU** | 1 vCPU | 1 vCPU |
| **Disco** | 10 GB SSD | 20 GB SSD |
| **Puertos requeridos** | 80 (HTTP), 443 (HTTPS) | — |

**Software requerido:**
- Node.js 20.x LTS
- Nginx
- PM2 (gestor de procesos Node.js)
- Certbot + python3-certbot-nginx (SSL Let's Encrypt)
- Git
- Firewall (UFW)

> Todo el software es open source y sin costo de licencia.

---

### C. DNS

Configurar un registro **A** en el DNS del dominio `estrategiasfractal.com`:

| Tipo | Nombre | Valor |
|------|--------|-------|
| **A** | `firma` | `{IP pública del servidor}` |

Esto hará que `https://firma.estrategiasfractal.com` apunte al servidor.

---

### D. Redirect URIs en Azure AD

Una vez que el servidor esté funcionando con dominio y SSL, **verificar que la Redirect URI de producción esté agregada en Azure AD** (paso A.4 más arriba):

```
https://firma.estrategiasfractal.com/auth/redirect
```

---

## 4. Especificaciones técnicas

### Stack tecnológico

| Componente | Tecnología |
|------------|-----------|
| **Backend** | Node.js 20 LTS + Express 4.x |
| **Autenticación** | Microsoft Authentication Library (`@azure/msal-node` 2.16.x) con flujo Authorization Code + PKCE |
| **Sesiones** | `express-session` con almacenamiento en memoria (24 horas de expiración) |
| **Frontend** | HTML5 + CSS3 + JavaScript vanilla (sin frameworks) |
| **Logo** | CDN de Wix con fallback a base64 embebido |
| **Proxy inverso** | Nginx |
| **SSL/TLS** | Let's Encrypt (Certbot) |
| **Gestor de procesos** | PM2 |
| **Puerto interno** | 3000 (solo loopback — no expuesto al exterior) |

### Arquitectura de red

```
Usuario (navegador)
       │
       ▼
  [Internet]
       │
       ▼
  ┌─────────────┐    ┌──────────────────────┐
  │  Nginx       │───▶│  Node.js (puerto 3000)│
  │  :80 / :443  │    │  localhost solamente  │
  │  (SSL)       │    └──────────────────────┘
  └──────┬──────┘
         │
         ▼
  ┌──────────────┐
  │  Microsoft   │
  │  Entra ID    │
  │  (Azure AD)  │
  └──────────────┘
```

- Nginx termina SSL y sirve como proxy inverso hacia Node.js
- Node.js escucha únicamente en `127.0.0.1:3000` (no accesible desde el exterior)
- La autenticación se delega a Microsoft Entra ID
- Las sesiones se almacenan en memoria del servidor Node.js

### Variables de entorno

Toda la configuración sensible se maneja mediante variables de entorno en el archivo `.env`. Este archivo **nunca se sube al repositorio** (incluido en `.gitignore`).

Archivo de referencia: `.env.example` (contiene los valores de ejemplo, sin datos reales)

```env
# ─── Azure AD ──────────────────────────────────────────
AZURE_TENANT_ID=6cf449e1-48ba-466f-8c91-4af9cd491a58
AZURE_CLIENT_ID=80d140e3-2169-4725-9997-265e7d1e83a6
AZURE_CLIENT_SECRET=           # ← COMPLETAR CON EL VALOR REAL

# ─── URLs ──────────────────────────────────────────────
AZURE_REDIRECT_URI=https://firma.estrategiasfractal.com/auth/redirect
AZURE_LOGOUT_URI=https://login.microsoftonline.com/common/oauth2/v2.0/logout
AZURE_POST_LOGOUT_URI=https://firma.estrategiasfractal.com

# ─── Servidor ──────────────────────────────────────────
PORT=3000
NODE_ENV=production
SESSION_SECRET=                # Opcional: si se omite, se genera automáticamente

# ─── Modo de autenticación ──────────────────────────────
DEV_MODE=false                 # true = login simulado (SOLO desarrollo local)
```

> **⚠️ ADVERTENCIA:** `DEV_MODE=true` deshabilita la autenticación. Cualquier persona podría acceder a la aplicación. Nunca activarlo en producción.

### Estructura del proyecto

```
Tarjetas-Firmas/
├── generador-firma.html                       # Frontend standalone de la firma
├── firma.html                                 # Ejemplo de firma generada
├── logo-blanco.png                            # Logo corporativo 400×150px
├── logo-original.png                          # Logo original
├── README.md                                  # Este documento
│
└── tarjetas-firmas-server/                    # 🚀 Servidor Node.js (punto de entrada)
    ├── server.js                              # Servidor Express + MSAL
    ├── .env                                   # Configuración (NO subir a git)
    ├── .env.example                           # Template de variables de entorno
    ├── package.json                           # Dependencias del proyecto
    ├── package-lock.json
    ├── logo-blanco.png                        # Logo para incrustar en firmas
    ├── logo.png
    │
    └── protected/
        └── generador-firma.html               # Frontend protegido con autenticación
```

---

## 5. Guía de deploy paso a paso

### Paso 1: Preparar el servidor

Conectarse por SSH al servidor y ejecutar los siguientes comandos.

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # Debe mostrar v20.x
npm -v

# Instalar Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Instalar PM2 (gestor de procesos Node.js)
sudo npm install -g pm2

# Instalar Certbot para SSL
sudo apt install -y certbot python3-certbot-nginx

# Configurar firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

---

### Paso 2: Clonar y configurar

```bash
# Crear usuario dedicado para la aplicación
sudo adduser --disabled-password --gecos "" firmas
sudo usermod -aG sudo firmas

# Clonar el repositorio
su - firmas
cd /home/firmas
git clone https://github.com/lukhack/firmas.git
cd firmas/tarjetas-firmas-server

# Instalar dependencias (solo producción)
npm install --production

# Configurar variables de entorno
cp .env.example .env
nano .env
```

Completar el archivo `.env` con los valores reales de Azure AD obtenidos en la sección 3.A. Para producción, debe quedar así:

```env
AZURE_TENANT_ID=6cf449e1-48ba-466f-8c91-4af9cd491a58
AZURE_CLIENT_ID=80d140e3-2169-4725-9997-265e7d1e83a6
AZURE_CLIENT_SECRET=el-valor-que-copio-de-azure
AZURE_REDIRECT_URI=https://firma.estrategiasfractal.com/auth/redirect
AZURE_LOGOUT_URI=https://login.microsoftonline.com/common/oauth2/v2.0/logout
AZURE_POST_LOGOUT_URI=https://firma.estrategiasfractal.com
PORT=3000
NODE_ENV=production
SESSION_SECRET=
DEV_MODE=false
```

---

### Paso 3: Configurar Nginx como proxy inverso

Nginx recibe las peticiones en los puertos 80/443 y las reenvía al servidor Node.js (puerto 3000, solo loopback).

```bash
sudo nano /etc/nginx/sites-available/firma
```

Pegar la siguiente configuración:

```nginx
# Redirección HTTP → HTTPS
server {
    listen 80;
    server_name firma.estrategiasfractal.com;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS
server {
    listen 443 ssl http2;
    server_name firma.estrategiasfractal.com;

    # SSL (se completa con Certbot en el paso 4)
    ssl_certificate     /etc/letsencrypt/live/firma.estrategiasfractal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/firma.estrategiasfractal.com/privkey.pem;

    # Configuración SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de seguridad
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Archivos estáticos (con caché prolongado)
    location /static/ {
        alias /home/firmas/firmas/tarjetas-firmas-server/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy hacia Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/firma-access.log;
    error_log  /var/log/nginx/firma-error.log warn;
}
```

Habilitar y verificar:

```bash
sudo ln -s /etc/nginx/sites-available/firma /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Paso 4: SSL con Let's Encrypt

```bash
sudo certbot --nginx -d firma.estrategiasfractal.com
```

Certbot solicitará:
1. Una dirección de correo electrónico para notificaciones de vencimiento
2. Aceptación de los términos de servicio
3. Si se desea redirigir HTTP a HTTPS (responder que sí)

Verificar que la renovación automática esté configurada:

```bash
sudo certbot certificates
sudo systemctl status certbot.timer         # Timer de renovación automática
sudo certbot renew --dry-run                 # Probar renovación
```

Los certificados Let's Encrypt tienen una validez de 90 días. El timer `certbot.timer` los renueva automáticamente.

---

### Paso 5: PM2 — Gestión del proceso Node.js

PM2 mantiene el proceso Node.js en ejecución, lo reinicia si falla, y lo inicia automáticamente al arrancar el servidor.

```bash
# Iniciar la aplicación
cd /home/firmas/firmas/tarjetas-firmas-server
pm2 start server.js --name "firmas" --log-date-format "YYYY-MM-DD HH:mm:ss"

# Configurar inicio automático al bootear el servidor
pm2 startup systemd
# Ejecutar el comando que PM2 muestra (similar al siguiente)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u firmas --hp /home/firmas

# Guardar la configuración para que persista entre reinicios
pm2 save
```

**Configuración opcional para servidores con poca RAM (≤1 GB):**

Crear un archivo `ecosystem.config.cjs` en `tarjetas-firmas-server/`:

```javascript
module.exports = {
  apps: [{
    name: 'firmas',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production' }
  }]
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

**Comandos útiles de PM2:**

| Comando | Descripción |
|---------|-------------|
| `pm2 status` | Estado de todos los procesos |
| `pm2 logs firmas` | Ver logs en tiempo real |
| `pm2 logs firmas --lines 100` | Últimas 100 líneas de log |
| `pm2 restart firmas` | Reiniciar la aplicación |
| `pm2 stop firmas` | Detener la aplicación |
| `pm2 monit` | Dashboard con CPU, RAM y logs |

---

### Paso 6: Script de deploy automático

Crear un script para actualizar la aplicación con un solo comando.

```bash
sudo nano /home/firmas/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🔄 Actualizando Generador de Firmas..."
cd /home/firmas/firmas

# Preservar el .env actual
cp tarjetas-firmas-server/.env /tmp/.env.backup

# Obtener la última versión del código
git pull origin main

# Restaurar .env (git pull no lo sobreescribe, pero por seguridad)
mv /tmp/.env.backup tarjetas-firmas-server/.env

# Instalar nuevas dependencias si las hay
cd tarjetas-firmas-server
npm install --production

# Reiniciar el proceso
pm2 restart firmas

echo "✅ Deploy completado: $(date)"
```

```bash
sudo chmod +x /home/firmas/deploy.sh
```

**Uso:** Para actualizar, ejecutar localmente:

```bash
git push origin main
ssh usuario@firma.estrategiasfractal.com "cd /home/firmas && ./deploy.sh"
```

---

### Paso 7: Logrotate

Evitar que los logs de Nginx y PM2 llenen el disco:

```bash
sudo nano /etc/logrotate.d/firmas
```

```
/var/log/nginx/firma-*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/home/firmas/.pm2/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

Verificar:

```bash
sudo logrotate -d /etc/logrotate.d/firmas   # Prueba en seco
```

---

## 6. Mantenimiento

### Renovar Client Secret en Azure AD

El Client Secret generado en Azure AD tiene fecha de vencimiento (generalmente 12 meses). **Planificar la renovación con 2 semanas de antelación.**

**Procedimiento:**

1. Azure Portal → **App Registrations** → **Generador Firmas Fractal** → **Certificates & secrets**
2. Crear un **nuevo** Client Secret
3. Copiar el valor inmediatamente
4. Actualizar en el servidor:

   ```bash
   ssh usuario@firma.estrategiasfractal.com
   cd /home/firmas/firmas/tarjetas-firmas-server
   nano .env
   # Reemplazar AZURE_CLIENT_SECRET con el nuevo valor
   pm2 restart firmas
   ```

5. Verificar que el login funciona correctamente en la URL de producción
6. Una vez confirmado, eliminar el Client Secret anterior desde Azure Portal

### Renovar certificado SSL

Los certificados de Let's Encrypt se renuevan automáticamente mediante `certbot.timer`. Verificar periódicamente:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

Si por alguna razón la renovación automática falla, ejecutar manualmente:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Actualizar la aplicación

```bash
# Opción A: Usar el script de deploy
/home/firmas/deploy.sh

# Opción B: Manual
cd /home/firmas/firmas
git pull origin main
cd tarjetas-firmas-server
npm install --production
pm2 restart firmas
```

### Monitoreo

```bash
# Estado del proceso Node.js
pm2 status
pm2 monit

# Logs de la aplicación
pm2 logs firmas --lines 50

# Logs de Nginx
sudo tail -f /var/log/nginx/firma-access.log
sudo tail -f /var/log/nginx/firma-error.log

# Recursos del servidor
htop                    # CPU y RAM en tiempo real
df -h                   # Espacio en disco disponible

# Health check
curl -I https://firma.estrategiasfractal.com
```

---

## 7. Seguridad

### Implementado en la aplicación

| Medida | Descripción |
|--------|-------------|
| **Autenticación Azure AD** | Solo usuarios del tenant corporativo pueden acceder. La autenticación la maneja Microsoft. |
| **Sesiones con expiración** | 24 horas. Al expirar, se requiere nuevo inicio de sesión. |
| **Proxy inverso (Nginx)** | Node.js no está expuesto directamente. Solo Nginx tiene puertos abiertos (80/443). |
| **SSL/TLS** | Cifrado TLS 1.2 y 1.3 con algoritmos fuertes. |
| **HSTS** | Strict-Transport-Security: 2 años, incluyendo subdominios. |
| **Headers de seguridad** | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy. |
| **Firewall (UFW)** | Solo puertos 22 (SSH), 80 (HTTP) y 443 (HTTPS) abiertos. |
| **Redirección forzada HTTPS** | Todo tráfico HTTP redirige automáticamente a HTTPS. |
| **Credenciales fuera de git** | El archivo `.env` está en `.gitignore`. No se suben secretos al repositorio. |

### Recomendaciones para el administrador

1. **Mantener el sistema actualizado:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Respaldar el `.env`:** Guardar una copia del archivo `.env` en un gestor de contraseñas corporativo o Azure Key Vault.

3. **Auditar accesos:** Azure Portal → **Enterprise Applications** → **Generador Firmas Fractal** → **Sign-in logs**. Allí se puede ver quién inició sesión, desde dónde y cuándo.

4. **Control de usuarios:** En Azure Portal → **Enterprise Applications** → **Generador Firmas Fractal** → **Users and groups** se puede restringir qué cuentas del tenant tienen acceso a la aplicación.

5. **No exponer el puerto 3000:** Node.js escucha solo en `127.0.0.1:3000`. Verificar que no haya reglas de firewall que expongan este puerto al exterior.

---

## 8. Resolución de problemas

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| `EADDRINUSE` al iniciar server | Ya hay un proceso en el puerto 3000 | `pm2 stop firmas && pm2 delete firmas` o `kill $(lsof -t -i:3000)` |
| Error en login de Azure AD | Redirect URI no coincide exactamente | Verificar en Azure Portal que la URI sea idéntica a la configurada en `.env` |
| | Client Secret vencido o incorrecto | Generar nuevo Client Secret y actualizar en `.env` |
| | Tipo de cuenta no soportada | Verificar que sea "Accounts in this organizational directory only" |
| `ERR_CERT_AUTHORITY_INVALID` | Certificado SSL vencido | `sudo certbot renew` |
| 502 Bad Gateway | Node.js no está corriendo | `pm2 status` y `pm2 restart firmas` |
| | proxy_pass en Nginx incorrecto | Verificar `proxy_pass http://127.0.0.1:3000;` en la config de Nginx |
| 504 Gateway Timeout | Node.js tardó en responder | Revisar `pm2 logs firmas` para identificar la causa |
| El logo no se ve en la firma | URL de CDN de Wix caída o cambiada | Verificar `LOGO_URL` en ambos archivos `generador-firma.html` |
| "No se pudo conectar con Microsoft" | Variables de Azure mal configuradas | Revisar `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` y `AZURE_CLIENT_SECRET` en `.env` |
| Usuario no autorizado | La cuenta no pertenece al tenant | Solo cuentas `@estrategiasfractal.com` pueden acceder |
| El nombre/cargo se ve mal en Outlook | Limitación del renderizador HTML de Outlook | Problema conocido con `<span>` y `display:inline-block` en Outlook para Windows. No se puede resolver desde el código. |

---

## 📝 Notas finales

- **Client Secret de Azure AD:** Tiene fecha de vencimiento. Configurar una alerta en el calendario 2 semanas antes de la expiración.
- **Logo corporativo:** Se carga desde la CDN de Wix (`static.wixstatic.com`). Si en el futuro se cambia el logo, hay que actualizar la `LOGO_URL` en ambos archivos `generador-firma.html`.
- **DEV_MODE:** Diseñado exclusivamente para desarrollo local. **Nunca activar en producción** ya que deshabilita la autenticación.
- **Commit history:** El repositorio utiliza [Conventional Commits](https://www.conventionalcommits.org/) para mantener un historial claro.
- **Soporte:** Cualquier duda técnica, abrir un issue en el repositorio de GitHub o contactar al desarrollador.
