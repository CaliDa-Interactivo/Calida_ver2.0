// ============================================================
// admin/insumos.js — A4. Gestionar insumos.
//   Estantería con las 5 categorías (punto de color = estado). Al
//   tocar una, su recuadro se acerca EN LA MISMA PANTALLA y muestra
//   cada subcategoría con su cantidad (0 a 5) sobre la repisa; con
//   − y + se cambia, y "Guardar" la hace oficial.
// ============================================================

import { estadoDeNivel, ETIQUETA_ESTADO, NIVEL_MAX } from '../data.js';
import { actualizarNivelInsumo, actualizarNecesidades, getCentroAdminActual } from '../store.js';
import { renderRepisaNivel, cargarMiniaturas } from '../ilustraciones.js';
import { activarZoomEstanteria, renderCapaZoom, renderCabeceraZoom } from '../zoom-estanteria.js';
import { renderEscena3D, montarVistaEstanteria3D } from '../estanteria-vista.js';
import {
  ESTADOS,
  conSesion,
  renderEncabezado,
  renderEstanteriaAdmin,
  renderBuscador,
  activarBuscador,
  mostrarConfirmacion,
} from './comun.js';

const TAMANO = 54;

// Lo que se ve de cerca: cada subcategoría con su repisa y sus botones.
function renderCantidades(categoria) {
  const centro = getCentroAdminActual();
  const secciones = categoria.subcategorias
    .map((sub) => {
      const nivel = centro.insumos[sub.id];
      return `
        <article class="seccion-insumo seccion-nivel" data-estado="${estadoDeNivel(nivel)}" data-sub="${sub.id}" data-nivel="${nivel}">
          <h3 class="seccion-insumo__nombre hueco__etiqueta" id="titulo-${sub.id}">${sub.nombre}</h3>
          <div class="seccion-nivel__repisa">${renderRepisaNivel(sub.id, nivel, { tamano: TAMANO })}</div>
          <div class="seccion-nivel__control" role="group" aria-labelledby="titulo-${sub.id}">
            <button type="button" class="seccion-nivel__boton" data-cambio="-1" aria-label="Quitar uno de ${sub.nombre}">−</button>
            <output class="seccion-nivel__valor" aria-live="polite">
              <span class="seccion-nivel__numero">${nivel}</span> de ${NIVEL_MAX}
              <span class="seccion-nivel__estado">${ETIQUETA_ESTADO[estadoDeNivel(nivel)]}</span>
            </output>
            <button type="button" class="seccion-nivel__boton" data-cambio="1" aria-label="Agregar uno de ${sub.nombre}">+</button>
          </div>
          <div class="necesidades-editor">
            <label for="nec-${sub.id}">¿Qué necesitan exactamente?</label>
            <ul class="necesidades-editor__lista" aria-label="Elementos que necesitan de ${sub.nombre}"></ul>
            <input id="nec-${sub.id}" class="necesidades-editor__campo" autocomplete="off"
                   placeholder="Escribe y presiona Enter" aria-describedby="nec-ayuda-${sub.id}" />
            <p class="necesidades-editor__ayuda" id="nec-ayuda-${sub.id}">Solo palabras, separadas con Enter o coma. Ej.: cascos, guantes</p>
          </div>
          <span class="seccion-insumo__cambio" hidden>Sin guardar</span>
        </article>`;
    })
    .join('');

  return `
    ${renderCabeceraZoom(categoria.nombre, '¿Cuánto tienes de cada insumo? De 0 (vacío, urgente) a 5 (abastecido).')}
    <div class="mueble mueble--cerca">
      <div class="mueble__cuerpo secciones-insumo">${secciones}</div>
    </div>
    <div class="admin-acciones">
      <p class="admin-acciones__aviso" aria-live="polite"></p>
      <button class="boton boton--grande" type="button" data-guardar disabled>Guardar</button>
    </div>`;
}

// Conecta los botones − / + y "Guardar" del panel.
function activarCantidades(panel, categoria) {
  const secciones = [...panel.querySelectorAll('.seccion-nivel')];
  const botonGuardar = panel.querySelector('[data-guardar]');
  const aviso = panel.querySelector('.admin-acciones__aviso');
  const original = Object.fromEntries(secciones.map((s) => [s.dataset.sub, Number(s.dataset.nivel)]));
  const centroInicial = getCentroAdminActual();
  // Listas de elementos que necesita el centro, por subcategoría.
  const listas = Object.fromEntries(
    secciones.map((s) => [s.dataset.sub, [...(centroInicial.necesidades?.[s.dataset.sub] ?? [])]])
  );
  const listasOriginales = Object.fromEntries(Object.entries(listas).map(([k, v]) => [k, v.join('|')]));
  let guardado = false;

  const listaCambio = (s) => listas[s.dataset.sub].join('|') !== listasOriginales[s.dataset.sub];
  const cambios = () =>
    secciones.filter((s) => Number(s.dataset.nivel) !== original[s.dataset.sub] || listaCambio(s));

  const escaparHTML = (t) =>
    t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function pintarLista(seccion) {
    const sub = seccion.dataset.sub;
    seccion.querySelector('.necesidades-editor__lista').innerHTML = listas[sub]
      .map(
        (p, i) => `<li>${escaparHTML(p)}<button type="button" data-quitar="${i}" aria-label="Quitar ${escaparHTML(p)}">×</button></li>`
      )
      .join('');
    seccion.querySelector('.seccion-insumo__cambio').hidden =
      Number(seccion.dataset.nivel) === original[sub] && !listaCambio(seccion);
  }

  function refrescar() {
    const n = cambios().length;
    botonGuardar.disabled = n === 0;
    aviso.textContent = n ? `${n} ${n === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}` : '';
  }

  function pintar(seccion, nivel) {
    const sub = seccion.dataset.sub;
    const estado = estadoDeNivel(nivel);
    seccion.dataset.nivel = nivel;
    seccion.dataset.estado = estado;
    seccion.querySelector('.seccion-nivel__repisa').innerHTML = renderRepisaNivel(sub, nivel, { tamano: TAMANO });
    cargarMiniaturas(seccion);
    seccion.querySelector('.seccion-nivel__numero').textContent = nivel;
    seccion.querySelector('.seccion-nivel__estado').textContent = ETIQUETA_ESTADO[estado];
    seccion.querySelector('[data-cambio="-1"]').disabled = nivel <= 0;
    seccion.querySelector('[data-cambio="1"]').disabled = nivel >= NIVEL_MAX;
    seccion.querySelector('.seccion-insumo__cambio').hidden = nivel === original[sub] && !listaCambio(seccion);
  }

  secciones.forEach((seccion) => {
    pintar(seccion, Number(seccion.dataset.nivel));
    pintarLista(seccion);

    // Campo de palabras: Enter o coma agrega; × quita.
    const campo = seccion.querySelector('.necesidades-editor__campo');
    const agregar = () => {
      const palabras = campo.value.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
      const lista = listas[seccion.dataset.sub];
      palabras.forEach((p) => {
        if (!lista.includes(p) && lista.length < 12) lista.push(p.slice(0, 40));
      });
      campo.value = '';
      pintarLista(seccion);
      refrescar();
    };
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        agregar();
      } else if (e.key === 'Backspace' && !campo.value && listas[seccion.dataset.sub].length) {
        listas[seccion.dataset.sub].pop();
        pintarLista(seccion);
        refrescar();
      }
    });
    campo.addEventListener('blur', () => campo.value.trim() && agregar());
    seccion.querySelector('.necesidades-editor__lista').addEventListener('click', (e) => {
      const boton = e.target.closest('[data-quitar]');
      if (!boton) return;
      listas[seccion.dataset.sub].splice(Number(boton.dataset.quitar), 1);
      pintarLista(seccion);
      refrescar();
      campo.focus();
    });

    seccion.querySelectorAll('[data-cambio]').forEach((boton) =>
      boton.addEventListener('click', () => {
        const nivel = Math.max(0, Math.min(NIVEL_MAX, Number(seccion.dataset.nivel) + Number(boton.dataset.cambio)));
        pintar(seccion, nivel);
        seccion.classList.remove('seccion-insumo--latido');
        void seccion.offsetWidth;
        seccion.classList.add('seccion-insumo--latido');
        refrescar();
      })
    );
  });

  botonGuardar.addEventListener('click', () => {
    const pendientes = cambios();
    const centro = getCentroAdminActual();
    // Lo que quedó escrito en un campo (sin Enter) también se guarda.
    secciones.forEach((s) => {
      const campo = s.querySelector('.necesidades-editor__campo');
      if (campo.value.trim()) {
        listas[s.dataset.sub].push(...campo.value.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean));
      }
    });
    const aGuardar = cambios();
    aGuardar.forEach((s) => {
      actualizarNivelInsumo(centro.id, s.dataset.sub, Number(s.dataset.nivel));
      actualizarNecesidades(centro.id, s.dataset.sub, listas[s.dataset.sub]);
    });
    guardado = true;
    mostrarConfirmacion(
      'Se han realizado los cambios',
      `${categoria.nombre}: ${aGuardar.length} ${aGuardar.length === 1 ? 'insumo actualizado' : 'insumos actualizados'}. Los donantes ya lo ven en el mapa y en la ficha del centro.`
    );
  });

  // Aviso si se intenta salir con cambios sin guardar (recargar o cerrar pestaña).
  const alSalir = (e) => {
    if (!guardado && cambios().length) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', alSalir);

  return {
    // Cerrar el zoom con cambios sin guardar pide confirmación.
    puedeCerrar: () =>
      guardado || !cambios().length || window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?'),
    limpiar: () => window.removeEventListener('beforeunload', alSalir),
  };
}

// A4 — Estantería 3D a pantalla completa. Al tocar un compartimiento la
// cámara se acerca y se abre el panel con las cantidades (− / +).
export const renderEstanteria = conSesion(({ categoriaId = null } = {}, centro) => {
  const encabezado = `
    ${renderEncabezado({ atras: '#/admin/menu', titulo: 'Gestionar insumos', centro })}
    <div class="admin-barra">
      <ul class="leyenda-estados" aria-label="Leyenda de estados">
        ${ESTADOS.map((e) => `<li><span class="punto-estado punto-estado--${e.id}"></span>${e.nombre}</li>`).join('')}
      </ul>
      ${renderBuscador('buscador-insumos')}
    </div>`;
  return {
    html: `
      <section class="vista vista-admin vista-estanteria vista-3d">
        ${renderEscena3D({ encabezado, etiqueta: 'Estantería 3D del centro: cada compartimiento es una categoría' })}
        <div class="estanteria2d" hidden>
          <div class="mueble">
            <div class="mueble__cuerpo estanteria__repisas">${renderEstanteriaAdmin({ centro })}</div>
            <div class="mueble__patas" aria-hidden="true"><span></span><span></span></div>
          </div>
        </div>
        ${renderCapaZoom()}
      </section>
    `,
    init(contenedor) {
      let api = null;
      let zoom = null;
      const nivelDe = (sub) => getCentroAdminActual().insumos[sub];

      // Panel de cantidades (se abre desde el compartimiento 3D o 2D).
      const crearPanel = (en3D) =>
        activarZoomEstanteria(contenedor, {
          categoriaInicial: en3D ? null : categoriaId,
          rutaAbierta: (cat) => `#/admin/insumos/${cat}`,
          rutaCerrada: '#/admin/insumos',
          contenido: renderCantidades,
          alMontar: activarCantidades,
          rectInicial: en3D ? (cat) => api?.rectDe(cat) : null,
          alCerrar: en3D ? () => api?.alejar() : null,
          actualizarRuta: !en3D,
        });

      const limpiar3D = montarVistaEstanteria3D(contenedor, {
        categoriaInicial: categoriaId,
        rutaAbierta: (cat) => `#/admin/insumos/${cat}`,
        rutaCerrada: '#/admin/insumos',
        estadoDe: (sub) => estadoDeNivel(nivelDe(sub)),
        extraEtiqueta: (sub) => `${nivelDe(sub)}/${NIVEL_MAX}`,
        alMontar: (a) => {
          api = a;
          zoom = crearPanel(true);
        },
        // Al llegar al compartimiento se abre el panel de cantidades.
        alLlegarACategoria: (cat) => setTimeout(() => zoom?.abrir(cat), 120),
        alElegirSubcategoria: (_sub, cat) => zoom?.abrir(cat),
        alFallar: () => {
          contenedor.querySelector('.estanteria2d').hidden = false;
          zoom?.();
          zoom = crearPanel(false);
          activarBuscador(contenedor);
        },
      });
      return () => {
        limpiar3D();
        zoom?.();
      };
    },
  };
});
