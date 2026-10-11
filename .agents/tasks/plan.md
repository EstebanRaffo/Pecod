# Implementation Plan — "Material de Lectura" (cuarta acción por tema)

## Hallazgos de exploración

**Modelo Topic** — `backend/prisma/schema.prisma` tiene el modelo `Topic` con los campos
`videoUrl String?`, `screenRecordingUrl String?`, `contentText String?`, y `materials Material[]`.
El campo `contentText` (material teórico escrito) **ya existe** en el esquema. No se necesita
agregar un nuevo campo: se reutiliza `contentText` como campo de almacenamiento del
"Material de Lectura". Esto es coherente con el comentario existente
`// material teórico escrito (HU7)`.

**`findDetail` en CoursesService** — `courses.service.ts` ya hace `select` incluyendo
`screenRecordingUrl: true` y `materials: true` dentro de `topics`. Falta agregar
`contentText: true` al mismo select para que el dato llegue al frontend.

**Endpoint de actualización de topic** — existe `PATCH /topics/:topicId` en
`topics.controller.ts` que llama a `topicsService.updateTopic`. El servicio actualmente
sólo escribe `title` y `order`. Se extiende para manejar `contentText`.

**DTO `UpdateTopicDto`** — `update-topic.dto.ts` sólo tiene `title?` y `order?`.
Se agrega `contentText?: string`.

**Frontend** — La página `/profesor/cursos/:id` es `CourseEditorPage.tsx`. Las tres
acciones existentes están en `TopicMediaUploader.tsx`. La cuarta acción se agrega en ese
mismo componente, siguiendo exactamente el mismo estilo Tailwind/inline que las demás.

**API client** — `api` es un Axios con `baseURL = VITE_API_URL ?? 'http://localhost:3000/api'`
e interceptor JWT. Se usa directamente con `api.patch(...)` para guardar.

**UI library** — sólo Tailwind CSS. No hay MUI ni Chakra. El modal de confirmación ya
existe como componente `ConfirmDialog` en `TopicMediaUploader.tsx`; se reutiliza.

**Tests backend** — `topics.service.spec.ts` usa Jest + mocks de Prisma vía
`createMockPrismaService()`. Se añade un bloque `describe` nuevo para `updateContentText`.

**Tests frontend** — hay Cypress e2e en `frontend/cypress/e2e/`. No hay tests unitarios de
componentes. Se agrega un test Cypress e2e para el flujo completo.

---

## Plan paso a paso

- [ ] 1. Agregar `contentText` al select de `findDetail` en CoursesService.
      En `courses.service.ts`, dentro del `include: { topics: { ... select: { ... } } }`,
      el select actual incluye `id`, `title`, `order`, `videoUrl`, `screenRecordingUrl`,
      `materials`. Agregar `contentText: true` al mismo objeto de select para que el dato
      llegue al frontend cuando carga la página del curso.
      Files: `backend/src/courses/courses.service.ts`
      Verify: `cd backend && npm run build` — compila sin errores.

- [ ] 2. Agregar `readingMaterial?: string` a `UpdateTopicDto`.
      En `update-topic.dto.ts` agregar:
      ```ts
      @IsOptional()
      @IsString()
      contentText?: string;
      ```
      Importar `IsString` ya está; `IsOptional` también. No cambiar imports.
      Files: `backend/src/topics/dto/update-topic.dto.ts`
      Verify: `cd backend && npm run build` — compila sin errores.

- [ ] 3. Extender `updateTopic` en TopicsService para persistir `contentText`.
      En `topics.service.ts`, dentro de `updateTopic`, agregar al objeto `data` del
      `prisma.topic.update` el manejo de `contentText`:
      ```ts
      ...(dto.contentText !== undefined ? { contentText: dto.contentText } : {}),
      ```
      El valor vacío (`''`) es válido (el profesor puede borrar el contenido). No se
      valida longitud mínima en el backend — el campo es `String?` y acepta vacío.
      Files: `backend/src/topics/topics.service.ts`
      Verify: `cd backend && npm run test -- --testPathPattern=topics` — todos los tests
      existentes pasan.

- [ ] 4. Agregar tests unitarios a `topics.service.spec.ts` para `updateTopic` con `contentText`.
      Agregar un `describe('updateTopic — contentText')` con estos casos:
      - CA: el Profesor dueño puede guardar texto en `contentText` — mock de
        `topic.findUnique` retorna `{ id: 'topic-1', course: { professorId: 'prof-1' } }`;
        mock de `topic.update` retorna `{ id: 'topic-1', contentText: 'texto de lectura' }`;
        verificar que `prisma.topic.update` fue llamado con
        `data: expect.objectContaining({ contentText: 'texto de lectura' })`.
      - CA: un Profesor de otro curso no puede guardar `contentText` — mock retorna
        `{ course: { professorId: 'otro-profesor' } }`; esperar `ForbiddenException`.
      - CA: guardar `contentText` vacío (`''`) es aceptado — verificar que `topic.update`
        es llamado con `{ contentText: '' }` sin lanzar error.
      Files: `backend/src/topics/topics.service.spec.ts`
      Verify: `cd backend && npm run test -- --testPathPattern=topics` — todos los tests
      (incluyendo los nuevos) pasan.

- [ ] 5. Actualizar el tipo `Topic` en `CourseEditorPage.tsx` para incluir `contentText`.
      En la interfaz `Topic` de `CourseEditorPage.tsx` agregar el campo:
      ```ts
      contentText?: string | null;
      ```
      Luego, pasar el nuevo prop a `<TopicMediaUploader>`:
      ```tsx
      <TopicMediaUploader
        topicId={topic.id}
        videoUrl={topic.videoUrl ?? null}
        screenRecordingUrl={topic.screenRecordingUrl ?? null}
        materials={topic.materials ?? []}
        contentText={topic.contentText ?? null}
        onChanged={loadCourse}
      />
      ```
      Files: `frontend/src/pages/CourseEditorPage.tsx`
      Verify: Build puede fallar hasta que el paso 6 actualice el componente; ejecutar la
      verificación al finalizar el paso 6.

- [ ] 6. Agregar la cuarta acción "Material de Lectura" a `TopicMediaUploader.tsx`.
      Este es el cambio principal de UI. A continuación se especifica cada parte:

      **6a — Actualizar la interfaz `Props`**: agregar `contentText: string | null`.
      ```ts
      interface Props {
        topicId: string;
        videoUrl: string | null;
        screenRecordingUrl: string | null;
        materials: Array<{ id: string; fileName: string; fileUrl: string; fileType: string }>;
        contentText: string | null;        // ← nuevo
        onChanged: () => void;
      }
      ```

      **6b — Agregar estado local** para el editor de lectura. Añadir los siguientes
      `useState` al inicio del componente (junto a los existentes `status`, `error`, etc.):
      ```ts
      // Estado del editor de Material de Lectura
      const [readingOpen, setReadingOpen] = useState(false);
      const [draftReading, setDraftReading] = useState('');
      const [savingReading, setSavingReading] = useState(false);
      ```

      **6c — Función `handleSaveReading`**: guarda mediante `api.patch` y llama `onChanged`.
      Importar `api` desde `'../api/client'` (ya está importado). Agregar:
      ```ts
      async function handleSaveReading() {
        setSavingReading(true);
        setError(null);
        try {
          await api.patch(`/topics/${topicId}`, { contentText: draftReading });
          setReadingOpen(false);
          onChanged();
        } catch (err: any) {
          setError(err.response?.data?.message ?? 'No se pudo guardar el material de lectura.');
        } finally {
          setSavingReading(false);
        }
      }
      ```

      **6d — Función `handleCancelReading`**: si el borrador difiere del valor guardado,
      usar el `ConfirmDialog` existente; si son iguales, cerrar directamente.
      ```ts
      function handleCancelReading() {
        const saved = contentText ?? '';
        if (draftReading !== saved) {
          askConfirm(
            '¿Descartás los cambios en el Material de Lectura?',
            async () => { setReadingOpen(false); },
          );
        } else {
          setReadingOpen(false);
        }
      }
      ```

      **6e — Botón de apertura**: agregar como cuarta acción en el `<div className="flex flex-wrap items-center gap-3">`, luego del botón "Agregar material":
      ```tsx
      {/* HU nueva: Material de Lectura */}
      <button
        type="button"
        onClick={() => {
          setDraftReading(contentText ?? '');
          setReadingOpen(true);
        }}
        className="text-slate-700 underline"
      >
        Material de Lectura
      </button>
      ```

      **6f — Panel de edición**: agregar inmediatamente después del bloque de botones de
      acción (`</div>`) y antes de los bloques de preview de video. Se muestra cuando
      `readingOpen === true`:
      ```tsx
      {readingOpen && (
        <div className="mt-2 border rounded p-3 space-y-2">
          <p className="text-xs font-medium text-slate-600">Material de Lectura</p>
          <textarea
            autoFocus
            rows={6}
            value={draftReading}
            onChange={(e) => setDraftReading(e.target.value)}
            placeholder="Escribí el texto del material de lectura. Podés pegar links externos (ej: https://docs.example.com)."
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm resize-y"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveReading}
              disabled={savingReading}
              className="bg-slate-800 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
            >
              {savingReading ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleCancelReading}
              disabled={savingReading}
              className="border border-slate-300 px-3 py-2 rounded text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      ```

      **6g — Vista de display** (cuando `readingOpen === false` y hay contenido guardado):
      Agregar inmediatamente después del bloque `{readingOpen && ...}` anterior. Muestra el
      texto guardado con URLs convertidas en `<a target="_blank">`. Si no hay contenido
      guardado, no mostrar nada (el botón "Material de Lectura" es suficiente indicador).
      ```tsx
      {!readingOpen && contentText && (
        <div className="mt-2 border rounded p-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">Material de Lectura</p>
            <button
              type="button"
              onClick={() => { setDraftReading(contentText ?? ''); setReadingOpen(true); }}
              className="text-xs text-slate-500 underline"
            >
              Editar
            </button>
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
            <ReadingMaterialDisplay text={contentText} />
          </div>
        </div>
      )}
      ```

      **6h — Componente `ReadingMaterialDisplay`**: renderiza texto plano con URLs
      detectadas automáticamente como `<a target="_blank" rel="noopener noreferrer">`.
      No usar librería externa — implementar con un regex simple. Agregar como función
      auxiliar en el mismo archivo, **antes** del componente `TopicMediaUploader`:
      ```tsx
      /**
       * Detecta URLs en `text` y las envuelve en <a target="_blank">.
       * Regex: http(s):// seguido de caracteres no-espacio.
       */
      function ReadingMaterialDisplay({ text }: { text: string }) {
        const urlRegex = /https?:\/\/[^\s]+/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = urlRegex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
          }
          const url = match[0];
          parts.push(
            <a
              key={match.index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline break-all"
            >
              {url}
            </a>,
          );
          lastIndex = match.index + url.length;
        }
        if (lastIndex < text.length) {
          parts.push(text.slice(lastIndex));
        }
        return <>{parts}</>;
      }
      ```

      **Import de React**: `React.ReactNode` requiere que `React` esté en scope. El archivo
      ya tiene `import { useState } from 'react'`; cambiarlo a
      `import React, { useState } from 'react'` (o agregar `ReactNode` al named import:
      `import { useState, type ReactNode } from 'react'` y usar `ReactNode` en lugar de
      `React.ReactNode`).

      Files: `frontend/src/components/TopicMediaUploader.tsx`
      Verify: `cd frontend && npm run build` — TypeScript + Vite compila sin errores.
      Verificar también que `cd frontend && npm run lint` no reporta errores nuevos.

- [ ] 7. Agregar test de backend `updateTopic` en `courses.service.spec.ts` (smoke).
      Revisar si `findDetail` en `courses.service.spec.ts` mockea un topic con `contentText`.
      Si los mocks existentes retornan topics sin ese campo, actualizar los mocks para
      incluir `contentText: null` (valor neutral) en los objetos topic del mock, de manera
      que el test no falle por campos inesperados.
      Files: `backend/src/courses/courses.service.spec.ts`
      Verify: `cd backend && npm run test` — toda la suite de tests pasa.

- [ ] 8. Agregar test Cypress e2e para el flujo completo de Material de Lectura.
      Crear `frontend/cypress/e2e/reading-material.cy.ts` con los siguientes casos de prueba,
      siguiendo el patrón de `auth.cy.ts` (visitar ruta, interactuar con selectores de texto):

      ```ts
      describe('Material de Lectura — flujo del Profesor', () => {
        beforeEach(() => {
          cy.seedFullScenario().then(({ professor }) => {
            cy.visit('/login');
            cy.get('input[type="email"]').type(professor.email);
            cy.get('input[type="password"]').type(professor.password);
            cy.contains('button', 'Ingresar').click();
          });
        });

        it('CA: el botón "Material de Lectura" aparece en cada tema del Temario', () => {
          cy.visit('/profesor/cursos');
          cy.get('a').first().click(); // accede al primer curso del profesor
          cy.contains('Material de Lectura').should('be.visible');
        });

        it('CA: al hacer clic se abre el editor con textarea y botones Guardar/Cancelar', () => {
          cy.visit('/profesor/cursos');
          cy.get('a').first().click();
          cy.contains('Material de Lectura').click();
          cy.get('textarea').should('be.visible');
          cy.contains('button', 'Guardar').should('be.visible');
          cy.contains('button', 'Cancelar').should('be.visible');
        });

        it('CA: al cancelar con cambios, aparece popup de confirmación', () => {
          cy.visit('/profesor/cursos');
          cy.get('a').first().click();
          cy.contains('Material de Lectura').click();
          cy.get('textarea').type('Texto de prueba');
          cy.contains('button', 'Cancelar').click();
          // El ConfirmDialog del componente debe aparecer
          cy.contains('¿Descartás los cambios en el Material de Lectura?').should('be.visible');
        });

        it('CA: al guardar, el texto se muestra en modo display con links clickeables', () => {
          cy.visit('/profesor/cursos');
          cy.get('a').first().click();
          cy.contains('Material de Lectura').click();
          const texto = 'Documentación oficial: https://docs.example.com';
          cy.get('textarea').clear().type(texto);
          cy.contains('button', 'Guardar').click();
          // El textarea desaparece y se muestra la vista de display
          cy.get('textarea').should('not.exist');
          cy.contains('https://docs.example.com')
            .should('have.attr', 'target', '_blank')
            .and('have.attr', 'rel', 'noopener noreferrer');
        });
      });
      ```

      Nota: estos tests son e2e y requieren que la base de datos de test esté seeded y el
      servidor corriendo. El comando es `cd frontend && npx cypress run` (o
      `npx cypress open` para modo interactivo).

      Files: `frontend/cypress/e2e/reading-material.cy.ts`
      Verify: `cd frontend && npx cypress run --spec cypress/e2e/reading-material.cy.ts` —
      los 4 tests pasan (requiere servidor backend y frontend corriendo).

---

## Resumen de archivos modificados/creados

| Archivo | Operación |
|---|---|
| `backend/src/courses/courses.service.ts` | Modificar: agregar `contentText: true` al select de topics en `findDetail` |
| `backend/src/topics/dto/update-topic.dto.ts` | Modificar: agregar campo `contentText?: string` |
| `backend/src/topics/topics.service.ts` | Modificar: extender `updateTopic` para manejar `contentText` |
| `backend/src/topics/topics.service.spec.ts` | Modificar: agregar describe `updateTopic — contentText` con 3 CAs |
| `backend/src/courses/courses.service.spec.ts` | Modificar: actualizar mocks de topic para incluir `contentText: null` |
| `frontend/src/pages/CourseEditorPage.tsx` | Modificar: agregar `contentText` al tipo `Topic` y al prop de `TopicMediaUploader` |
| `frontend/src/components/TopicMediaUploader.tsx` | Modificar: nuevo prop `contentText`, estados, botón, editor inline, display con links |
| `frontend/cypress/e2e/reading-material.cy.ts` | Crear: 4 tests e2e del flujo completo |

## Decisiones de diseño

- **Reutilizar `contentText`** — Ya existe en el modelo Topic con exactamente el propósito
  de "material teórico escrito". Agregar una columna nueva habría requerido una migración
  innecesaria y duplicaría un campo semánticamente idéntico.

- **Endpoint existente `PATCH /topics/:topicId`** — El controller y service ya manejan
  updates parciales de topics. Extender el DTO y el data object es suficiente; no se crea
  un endpoint nuevo. Esto es consistente con cómo `title` y `order` ya se actualizan.

- **`ConfirmDialog` reutilizado** — Ya existe en el mismo archivo con la misma interfaz
  `{ message, onConfirm, onCancel }` y el mismo estado `confirmDialog`. Se llama a
  `askConfirm(...)` directamente, sin agregar ningún nuevo componente ni librería.

- **Links con regex propio** — No se agrega `linkify-it`, `autolinker` ni ningún otro
  paquete. Un regex `https?:\/\/[^\s]+` cubre todos los casos de uso descritos (pegar
  links externos a documentación oficial) y es consistente con la política del proyecto de
  no agregar dependencias nuevas si no es necesario.

- **No se agrega migración** — `contentText` ya existe en la base de datos. No hay cambio
  de esquema en este feature.
