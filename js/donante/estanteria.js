// ============================================================
// estanteria.js — D2. "¿Qué deseas donar?"
// 5 repisas (una por categoría). Cada producto de la repisa es una
// subcategoría (p. ej. en Alimento: botellón = agua, lata = no
// perecederos, tetero = comida de bebé). Al tocar una repisa se hace
// zoom a ese recuadro AQUÍ MISMO (sin cambiar de pantalla): el
// recuadro crece hasta llenar la vista y muestra cada producto con
// su nombre. Al tocar un producto se abre el mapa. Buscador que resalta coincidencias.
// El gato NO aparece en esta pantalla.
// ============================================================

import { CATEGORIAS } from '../data.js';
import { ilustracion, productoPrincipal } from '../ilustraciones.js';
import { activarZoomEstanteria, renderCapaZoom, renderCabeceraZoom } from '../zoom-estanteria.js';
import { renderEscena3D, montarVistaEstanteria3D } from '../estanteria-vista.js';

function renderRepisa(categoria) {
  const objetos = categoria.subcategorias
    .map(
      (sub) => `
        <span class="repisa__objeto" data-texto-busqueda="${sub.nombre.toLowerCase()}">
          ${ilustracion(productoPrincipal(sub.id), { tamano: 48 })}
          <span class="repisa__objeto-nombre">${sub.nombre}</span>
        </span>
      `
    )
    .join('');

  return `
    <button
      class="repisa"
      type="button"
      data-categoria="${categoria.id}"
      aria-haspopup="dialog"
      data-texto-busqueda="${categoria.nombre.toLowerCase()}"
    >
      <span class="repisa__encabezado">
        <span class="repisa__nombre">${categoria.nombre}</span>
      </span>
      <span class="repisa__objetos">${objetos}</span>
      <span class="repisa__tabla" aria-hidden="true"></span>
    </button>
  `;
}

// Contenido del recuadro visto de cerca.
function renderRecuadroCerca(categoria) {
  const productos = categoria.subcategorias
    .map(
      (sub) => `
        <button class="producto-zoom" type="button" data-navegar="#/donante/mapa/${sub.id}">
          <span class="producto-zoom__figura">${ilustracion(productoPrincipal(sub.id), { tamano: 120 })}</span>
          <span class="producto-zoom__nombre">${sub.nombre}</span>
        </button>`
    )
    .join('');
  return `
    ${renderCabeceraZoom(categoria.nombre, '¿Qué vas a donar? Toca un producto.')}
    <div class="mueble mueble--cerca">
      <div class="mueble__cuerpo">
        <div class="hueco-zoom">
          <span class="hueco__etiqueta">${categoria.nombre}</span>
          <div class="hueco-zoom__productos">${productos}</div>
        </div>
      </div>
    </div>`;
}

export function render({ categoriaId = null } = {}) {
  const repisas = CATEGORIAS.map(renderRepisa).join('');
  const encabezado = `
    <header class="estanteria__encabezado">
      <a class="boton-atras" href="#/entrar">← Volver</a>
      <h1>¿Qué deseas donar?</h1>
      <label class="buscador">
        <span class="visually-hidden">Buscar categoría o subcategoría</span>
        <span class="buscador__icono" aria-hidden="true">🔍</span>
        <input type="search" id="buscador-estanteria" placeholder="Buscar..." />
      </label>
    </header>`;

  return {
    html: `
      <section class="vista vista-estanteria vista-3d">
        ${renderEscena3D({ encabezado, etiqueta: 'Estantería 3D: cada compartimiento es una categoría' })}

        <!-- Respaldo 2D (si el navegador no puede mostrar 3D) -->
        <div class="estanteria2d" hidden>
          <div class="mueble">
            <div class="mueble__cuerpo estanteria__repisas">${repisas}</div>
            <div class="mueble__patas" aria-hidden="true"><span></span><span></span></div>
          </div>
          ${renderCapaZoom()}
        </div>
      </section>
    `,
    init(contenedor) {
      let limpiar2D = null;
      const limpiar3D = montarVistaEstanteria3D(contenedor, {
        categoriaInicial: categoriaId,
        rutaAbierta: (cat) => `#/donante/subcategorias/${cat}`,
        rutaCerrada: '#/donante/estanteria',
        alElegirSubcategoria: (sub) => {
          location.hash = `#/donante/mapa/${sub}`;
        },
        alFallar: () => {
          contenedor.querySelector('.estanteria2d').hidden = false;
          limpiar2D = activarEstanteria2D(contenedor, categoriaId);
        },
      });
      return () => {
        limpiar3D();
        limpiar2D?.();
      };
    },
  };
}

// Estantería 2D de respaldo: zoom en la misma pantalla y buscador.
function activarEstanteria2D(raiz, categoriaId) {
  const limpiarZoom = activarZoomEstanteria(raiz, {
    categoriaInicial: categoriaId,
    rutaAbierta: (cat) => `#/donante/subcategorias/${cat}`,
    rutaCerrada: '#/donante/estanteria',
    contenido: renderRecuadroCerca,
  });
  const input = raiz.querySelector('input[type="search"]');
  const repisasEl = raiz.querySelectorAll('.repisa');
  input.addEventListener('input', () => {
    const termino = input.value.trim().toLowerCase();
    repisasEl.forEach((repisa) => {
      let coincide = !termino || repisa.dataset.textoBusqueda.includes(termino);
      repisa.querySelectorAll('.repisa__objeto').forEach((obj) => {
        const c = Boolean(termino) && obj.dataset.textoBusqueda.includes(termino);
        obj.classList.toggle('repisa__objeto--resaltado', c);
        if (c) coincide = true;
      });
      repisa.classList.toggle('repisa--opaca', !coincide);
    });
  });
  return limpiarZoom;
}
