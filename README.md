# Generador de Firmas Fractal

## Configuracion para subir a Directorio de Microsoft (Azure)

### 1. Subir el codigo a GitHub

```bash
git add .
git commit -m "feat: add login server with signature generator"
git push
```

### 2. Crear App Registration (Azure AD)

Azure Portal → App Registrations → New Registration

- Nombre: `Generador Firmas Fractal`
- Redirect URI: `https://firma.estrategiasfractal.com/auth/redirect`

Una vez creada copiar:
- **Tenant ID**
- **Client ID**

Ir a Certificates & Secrets → New client secret → Copiar el **valor del secret**.

### 3. Crear App Service

Azure Portal → App Services → Create

- Runtime stack: **Node.js 20 LTS**
- Plan: **Free F1**
- Deployment: conectar GitHub repo (rama main)

Azure instala las dependencias automaticamente al desplegar.

### 4. Configurar variables de entorno

App Service → Settings → Environment variables

| Variable | Valor |
|---|---|
| `DEV_MODE` | `false` |
| `AZURE_TENANT_ID` | Tenant ID del paso 2 |
| `AZURE_CLIENT_ID` | Client ID del paso 2 |
| `AZURE_CLIENT_SECRET` | Secret del paso 2 |
| `AZURE_REDIRECT_URI` | `https://firma.estrategiasfractal.com/auth/redirect` |
| `AZURE_POST_LOGOUT_URI` | `https://firma.estrategiasfractal.com` |
| `NODE_ENV` | `production` |

### 5. Verificar

Entrar a `https://firma.estrategiasfractal.com`. Redirige al login de Microsoft.

## Notas

- El logo de la firma ya esta incrustado en el codigo (base64). No requiere configuracion externa.
- El acceso de usuarios se controla desde Azure AD → Enterprise Applications → User assignments.
- El archivo `.env` real no se sube (esta en `.gitignore`). Las variables van en Environment variables de Azure.
