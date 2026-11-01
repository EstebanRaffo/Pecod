# Prompt: Implementar Tema Claro y Oscuro en PECOD Frontend

## Contexto del proyecto

- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS v3
- **Estructura relevante**:
  - `src/main.tsx` — punto de entrada, contiene `<BrowserRouter>` y `<AuthProvider>`
  - `src/App.tsx` — root component con `<NavBar>` y `<Routes>`
  - `src/context/AuthContext.tsx` — patrón de Context existente (usar como referencia de estilo)
  - `src/components/NavBar.tsx` — barra de navegación (aquí va el botón de toggle)
  - `src/index.css` — solo tiene `@tailwind base/components/utilities`
  - Tailwind está configurado con la estrategia `class` para dark mode (a activar)

---

## Tarea

Implementar soporte de tema **claro** y **oscuro** en toda la aplicación, con las siguientes características:

1. El tema se activa/desactiva manualmente con un botón en la `NavBar`.
2. La preferencia del usuario se persiste en `localStorage` con la clave `pecod_theme`.
3. Al cargar la app, se respeta en orden: `localStorage` → preferencia del sistema operativo (`prefers-color-scheme`).
4. El modo oscuro se activa añadiendo la clase `dark` en el elemento `<html>` (estrategia `class` de Tailwind).

---

## Cambios a realizar (en orden)

### 1. `tailwind.config.js` (o `tailwind.config.ts`)

Añadir `darkMode: 'class'` en la configuración:

```js
// tailwind.config.js
export default {
  darkMode: 'class',   // ← añadir esta línea
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

---

### 2. Crear `src/context/ThemeContext.tsx`

Nuevo context que gestiona el estado del tema. Modelar igual que `AuthContext.tsx`.

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('pecod_theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('pecod_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
```

---

### 3. `src/main.tsx`

Envolver `<App>` con `<ThemeProvider>`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
```

---

### 4. `src/components/NavBar.tsx`

Añadir el botón de toggle usando el ícono de `lucide-react` (`Sun` / `Moon`). Colocarlo en el `div` derecho, antes del nombre del usuario.

```tsx
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  if (!user) return null;

  return (
    <nav className="relative bg-slate-800 dark:bg-slate-900 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-4 items-center">
        <span className="font-semibold">PECOD</span>
        {user.role === 'STUDENT' && (
          <>
            <Link to="/catalogo">Catálogo</Link>
            <Link to="/mis-cursos">Mis cursos</Link>
          </>
        )}
        {user.role === 'PROFESSOR' && <Link to="/profesor/cursos">Mis cursos</Link>}
        {user.role === 'ADMIN' && (
          <>
            <Link to="/admin/instituciones">Instituciones</Link>
            <Link to="/admin/usuarios">Usuarios</Link>
          </>
        )}
      </div>
      <div className="flex gap-3 items-center text-sm min-w-0 max-w-full ml-auto">
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          className="p-1 rounded hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <span className="break-words min-w-0">{user.name}</span>
        {user.role === 'STUDENT' && <NotificationBell key={user.id} />}
        <button onClick={logout} className="underline shrink-0">
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
```

---

### 5. Actualizar clases de Tailwind en todas las páginas y componentes

Recorrer cada archivo en `src/pages/` y `src/components/` y agregar variantes `dark:` para los colores de fondo, texto y borde. Guiarse por esta tabla de equivalencias:

| Clase actual (light)           | Clase oscura a añadir              |
|--------------------------------|------------------------------------|
| `bg-slate-50`                  | `dark:bg-slate-900`                |
| `bg-white`                     | `dark:bg-slate-800`                |
| `bg-slate-100`                 | `dark:bg-slate-700`                |
| `bg-slate-200`                 | `dark:bg-slate-600`                |
| `text-slate-800`               | `dark:text-slate-100`              |
| `text-slate-700`               | `dark:text-slate-200`              |
| `text-slate-600`               | `dark:text-slate-300`              |
| `text-slate-500`               | `dark:text-slate-400`              |
| `border-slate-200`             | `dark:border-slate-600`            |
| `border-slate-300`             | `dark:border-slate-500`            |
| `shadow` / `shadow-md`         | mantener (funciona en ambos temas) |
| `ring-slate-300`               | `dark:ring-slate-500`              |
| Inputs `bg-white border-...`   | `dark:bg-slate-700 dark:border-slate-500 dark:text-white dark:placeholder-slate-400` |

> **Prioridad**: empezar por `LoginPage.tsx` (pantalla de entrada), luego `NavBar.tsx`, y después el resto de páginas en orden alfabético.

---

### 6. `src/pages/LoginPage.tsx` — ejemplo de resultado esperado

El `div` raíz y el `form` deben quedar así:

```tsx
<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
  <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-lg shadow">
    <h1 className="text-2xl font-semibold mb-6 text-slate-800 dark:text-slate-100">
      Ingresar a PECOD
    </h1>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
      Email
    </label>
    <input
      className="... border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
      ...
    />
    {/* Igual para el campo contraseña y botón de submit */}
  </form>
</div>
```

---

## Restricciones

- **No instalar** ninguna librería nueva; `lucide-react` ya está en las dependencias.
- **No modificar** el backend ni archivos fuera de `frontend/src/`.
- **No eliminar** comentarios existentes (ej. `// HU10: ...`).
- **No cambiar** la lógica de autenticación ni de rutas.
- Mantener el `aria-label` en el botón de toggle para accesibilidad.
- El `ThemeProvider` debe ir **por fuera** de `AuthProvider` en el árbol de providers.

---

## Verificación

Tras implementar los cambios, verificar manualmente:

1. Al cargar la app sin `pecod_theme` en `localStorage`, se respeta `prefers-color-scheme`.
2. Al hacer clic en el botón de la `NavBar`, el tema cambia en toda la app instantáneamente.
3. Al recargar la página, el tema persiste.
4. Todas las páginas se ven correctamente en ambos temas (sin texto ilegible ni contrastes rotos).
5. El botón muestra `Sun` en modo oscuro y `Moon` en modo claro.
