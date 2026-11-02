# HU-9: Alta de Institución

**Versión:** V1

- **Cómo:** Administrador de Sistema
- **Quiero:** Dar de alta manualmente una institución y sus usuarios (Profesores y Alumnos), sin requerir que estos se autoregistren.
- **Para:** Habilitar a una nueva institución para operar dentro de la plataforma, con control centralizado de qué usuarios pueden acceder a ella en esta primera versión.

## Criterios de aceptación

1. Se puede registrar una nueva institución completando los datos obligatorios definidos: nombre, dominio/subdominio único, dirección, teléfono y email de contacto.
2. Los usuarios (Profesores y Alumnos) son dados de alta exclusivamente por el Administrador de Sistema (no existe auto-registro en V1), completando nombre, email y rol (Profesor o Alumno), y quedan vinculados a la institución correspondiente.
3. No se permite dar de alta una institución con datos duplicados (nombre o dominio ya existentes).
4. Si los datos son inválidos o incompletos, el sistema informa los errores correspondientes antes de guardar.
5. Al completarse el alta de un usuario, este recibe el medio de acceso inicial definido (credenciales, invitación, etc.).
