-- =============================================================================
-- Datos SIMULADOS para la Bolsa (permitido por el examen, punto 5).
-- Todas las organizaciones son ficticias. Ejecutar después de 001_vacantes.sql
-- El administrador NO se crea aquí: usa `npm run crear-admin` en vacantes-service.
-- =============================================================================

insert into public.organizaciones (id, nombre, tipo, descripcion, contacto_nombre, contacto_email, sitio_web) values
  ('11111111-1111-4111-8111-111111111111', 'Laboratorio de Software ITC (simulado)', 'interna_itc',
   'Área interna que desarrolla sistemas para departamentos del Tec.', 'Coordinación del laboratorio', 'labsoftware@ejemplo.edu.mx', null),
  ('22222222-2222-4222-8222-222222222222', 'Dirección Municipal de Innovación (simulada)', 'dependencia_gobierno',
   'Dependencia que digitaliza trámites ciudadanos.', 'Enlace de vinculación', 'innovacion@ejemplo.gob.mx', null),
  ('33333333-3333-4333-8333-333333333333', 'Bajío Data Labs S.A. de C.V. (ficticia)', 'empresa',
   'Consultora de analítica de datos para la industria automotriz.', 'Recursos Humanos', 'talento@ejemplo.com', 'https://ejemplo.com'),
  ('44444444-4444-4444-8444-444444444444', 'Fundación Aprende Conmigo A.C. (ficticia)', 'ong',
   'Organización que imparte talleres de computación a comunidades rurales.', 'Coordinación de voluntariado', 'voluntarios@ejemplo.org', null)
on conflict (id) do nothing;

insert into public.vacantes
  (organizacion_id, titulo, tipo, descripcion, area, modalidad, ubicacion, cupo, horas_semana,
   remunerada, apoyo_economico, requisito_avance_min, requisito_promedio_min, requisito_semestre_min,
   habilidades, fecha_limite, estado)
values
  ('11111111-1111-4111-8111-111111111111', 'Desarrollo del portal de tutorías', 'servicio_social',
   'Apoyo en el desarrollo frontend del portal interno de tutorías usando React y APIs REST.',
   'Desarrollo web', 'hibrida', 'Edificio de Sistemas', 4, 20, false, null, 70, 0, 6,
   array['React','Git','APIs REST'], current_date + 60, 'publicada'),

  ('22222222-2222-4222-8222-222222222222', 'Digitalización de trámites municipales', 'servicio_social',
   'Captura, análisis y modelado de procesos para migrar trámites en papel a formularios web.',
   'Análisis de procesos', 'presencial', 'Centro, Celaya', 6, 20, false, null, 70, 0, 6,
   array['BPMN','Excel','Redacción'], current_date + 45, 'publicada'),

  ('44444444-4444-4444-8444-444444444444', 'Instructor de talleres de ofimática', 'servicio_social',
   'Impartir talleres básicos de computación a adultos mayores los sábados.',
   'Docencia', 'presencial', 'Comunidades de Celaya', 10, 8, false, null, 70, 0, 5,
   array['Comunicación','Paciencia','Office'], current_date + 30, 'publicada'),

  ('33333333-3333-4333-8333-333333333333', 'Residencia: pipeline de datos de producción', 'residencia',
   'Diseño de un pipeline ETL y dashboards para indicadores de planta. Proyecto de 4 a 6 meses.',
   'Ciencia de datos', 'hibrida', 'Parque industrial, Celaya', 2, 40, true, 'Apoyo de $6,000 mensuales', 80, 85, 8,
   array['Python','SQL','Power BI'], current_date + 75, 'publicada'),

  ('11111111-1111-4111-8111-111111111111', 'Residencia: app móvil de control escolar', 'residencia',
   'Desarrollo de una app móvil (Flutter) conectada a servicios REST institucionales.',
   'Desarrollo móvil', 'presencial', 'Edificio de Sistemas', 3, 40, false, null, 80, 80, 8,
   array['Flutter','Dart','Supabase'], current_date + 90, 'publicada'),

  ('33333333-3333-4333-8333-333333333333', 'Proyecto: modelo de mantenimiento predictivo', 'proyecto',
   'Proyecto corto de investigación aplicada con sensores IoT. Ideal para portafolio.',
   'Inteligencia artificial', 'remota', null, 5, 10, false, 'Constancia con valor curricular', 50, 80, 5,
   array['Python','Machine Learning'], current_date + 40, 'publicada'),

  ('22222222-2222-4222-8222-222222222222', 'Proyecto: mapa de accesibilidad urbana', 'proyecto',
   'Recolección de datos y visualización web de rampas, cruces y semáforos accesibles.',
   'Visualización de datos', 'hibrida', 'Celaya', 8, 6, false, null, 30, 0, 3,
   array['JavaScript','Mapas','Trabajo de campo'], current_date + 50, 'publicada'),

  ('44444444-4444-4444-8444-444444444444', 'Soporte técnico en centros comunitarios', 'servicio_social',
   'Mantenimiento de equipos donados y configuración de redes en centros comunitarios.',
   'Soporte y redes', 'presencial', 'Celaya y alrededores', 4, 20, false, null, 70, 0, 6,
   array['Redes','Hardware','Linux'], current_date + 20, 'borrador');
