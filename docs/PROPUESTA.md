# Propuesta de funcionalidad adicional

## Bolsa de Servicio Social, Residencias y Proyectos

### Problema

Para iniciar el servicio social o la residencia profesional, un estudiante del TecNM Celaya tiene que:

1. Saber si ya cumple el porcentaje de créditos (70 % para servicio social y 80 % para residencia, según los lineamientos del TecNM).
2. Encontrar programas o empresas con lugares disponibles, normalmente en avisos dispersos (pizarrones, grupos de mensajería, correos).
3. Contactar a cada organización por su cuenta sin saber si cubre sus requisitos.

Hoy el SII muestra el porcentaje de avance, pero no lo conecta con las oportunidades reales. Muchos alumnos descubren tarde que ya podían iniciar, o se postulan a vacantes para las que no califican.

### Solución

Un módulo dentro de Linces ITC que **cruza los requisitos de cada vacante con los datos reales del SII del alumno**:

- **Para el estudiante**
  - Ve su avance en una "pista de créditos" con las metas de servicio social (70 %), residencia (80 %) y egreso (100 %), además de la proyección si aprueba lo que está cursando.
  - Consulta vacantes de servicio social, residencia y proyectos, filtradas por tipo, búsqueda y "solo en las que califico".
  - Cada vacante le indica qué requisitos cumple y cuáles le faltan (avance, promedio y semestre), comparados contra su SII.
  - Se postula con un mensaje y da seguimiento al estado (enviada → en revisión → aceptada / no seleccionada), incluidos los comentarios del coordinador.
- **Para la coordinación (backend de administración propio)**
  - Panel con autenticación independiente del SII y roles `admin` y `revisor`.
  - CRUD de organizaciones y vacantes (borrador / publicada / cerrada), con cupo, fecha límite y requisitos.
  - Revisión de postulaciones con los indicadores del alumno validados por el SII al momento de postular.
  - Estadísticas (postulaciones por día, vacantes con más interés, lugares asignados) y bitácora de acciones.

### Beneficios concretos

| Para quién | Beneficio |
|---|---|
| Estudiantes | Saben en segundos si ya pueden iniciar y en qué vacantes califican, sin hacer cálculos ni preguntar en ventanilla. |
| Estudiantes | Un solo lugar para encontrar oportunidades, en lugar de avisos dispersos. |
| Coordinadores | Reciben solo postulaciones elegibles: el backend valida los requisitos con el SII, no con lo que el alumno declare. |
| Coordinadores | Controlan el cupo (no se acepta más gente que lugares) y llevan historial de decisiones. |
| Institución | Datos sobre la demanda de cada tipo de vacante para planear convenios. |

### Por qué es confiable

- La elegibilidad se calcula **en el servidor** (BFF) con datos frescos del SII cada vez que alguien se postula; el navegador no puede alterarla.
- A los mínimos de cada vacante se suma siempre el mínimo institucional del tipo (70 % o 80 %).
- La postulación guarda una "foto" mínima de los indicadores (avance, promedio, semestre y créditos) como evidencia, sin copiar el kardex ni las calificaciones.

### Datos simulados

Como permite el examen, las organizaciones y vacantes de ejemplo son **ficticias** (`supabase/vacantes/002_seed_simulado.sql`). Los datos académicos (puntos 1 a 4) siempre vienen del API real del SII.
