// ============================================================
// zoom-estanteria.js — zoom a un recuadro de la estantería EN LA
// MISMA PANTALLA (sin cambiar de vista). Lo usan el donante y el
// administrador (gestionar insumos y registrar donación).
//
// El panel parte del tamaño y la posición del recuadro tocado y
// crece hasta el centro (técnica FLIP); al cerrar se encoge de
// vuelta. La dirección se actualiza sin recargar (replaceState),
// así "Volver" desde la pantalla siguiente regresa con el zoom
// abierto.
//
// Uso:
//   const limpiar = activarZoomEstanteria(contenedor, {
//     categoriaInicial,                       // abrir sin animación
//     rutaAbierta: (cat) => `#/…/${cat}`,     // dirección con el zoom abierto
//     rutaCerrada: '#/…',                     // dirección de la estantería
//     contenido: (categoria) => html,         // lo que se ve de cerca
//     alMontar: (panel, categoria) => ({ puedeCerrar, limpiar }),  // opcional
//   });
//
// Marcado necesario en la vista: botones .repisa[data-categoria] y
// renderCapaZoom() dentro de la sección.
// ============================================================

import { obtenerCategoria } from './data.js';

const DURACION = 420;

export function renderCapaZoom() {
  return `
    <div class="zoom-capa" hidden>
      <div class="zoom-capa__fondo" data-cerrar-zoom></div>
      <div class="zoom-capa__panel" role="dialog" aria-modal="true" aria-labelledby="zoom-titulo"></div>
    </div>`;
}

// Encabezado común del panel (botón de volver + título).
export function renderCabeceraZoom(titulo, instruccion = '') {
  return `
    <div class="zoom-capa__barra">
      <button type="button" class="zoom-capa__cerrar" data-cerrar-zoom>← Volver a la estantería</button>
    </div>
    <h2 class="zoom-capa__titulo" id="zoom-titulo">${titulo}</h2>
    ${instruccion ? `<p class="zoom__instruccion">${instruccion}</p>` : ''}`;
}

export function activarZoomEstanteria(contenedor, opciones) {
  const {
    categoriaInicial = null,
    rutaAbierta,
    rutaCerrada,
    contenido,
    alMontar,
    rectInicial = null, // (cat) => rect en pantalla, cuando no hay .repisa (estantería 3D)
    alCerrar = null, // () => void, después de cerrar
    actualizarRuta = true,
  } = opciones;
  const capa = contenedor.querySelector('.zoom-capa');
  const panel = capa.querySelector('.zoom-capa__panel');
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let repisaAbierta = null;
  let animando = false;
  let ganchos = null;

  let categoriaAbierta = null;
  const rectDe = (repisa) =>
    repisa ? repisa.getBoundingClientRect() : rectInicial?.(categoriaAbierta) ?? null;

  function transformDesde(repisa) {
    const r = rectDe(repisa);
    if (!r || !r.width) return 'scale(0.6)';
    const f = panel.getBoundingClientRect();
    const escala = r.width / f.width;
    const dx = r.left + r.width / 2 - (f.left + f.width / 2);
    const dy = r.top + r.height / 2 - (f.top + f.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${escala})`;
  }

  function abrir(categoriaId, { animar = true } = {}) {
    const categoria = obtenerCategoria(categoriaId);
    const repisa = contenedor.querySelector(`.repisa[data-categoria="${categoriaId}"]`);
    if (!categoria || (!repisa && !rectInicial) || animando) return;
    categoriaAbierta = categoriaId;

    panel.innerHTML = contenido(categoria);
    capa.hidden = false;
    document.body.classList.add('sin-scroll');
    repisaAbierta = repisa;
    repisa?.setAttribute('aria-expanded', 'true');
    if (actualizarRuta) history.replaceState(null, '', rutaAbierta(categoriaId));
    ganchos = alMontar?.(panel, categoria) ?? null;

    if (animar && !reducido) {
      animando = true;
      panel.style.transition = 'none';
      panel.style.transform = transformDesde(repisa);
      panel.classList.add('zoom-capa__panel--entrando');
      capa.classList.remove('zoom-capa--visible');
      void panel.offsetWidth;
      panel.style.transition = '';
      panel.style.transform = '';
      capa.classList.add('zoom-capa--visible');
      setTimeout(() => {
        panel.classList.remove('zoom-capa__panel--entrando');
        animando = false;
      }, DURACION);
    } else {
      capa.classList.add('zoom-capa--visible');
    }
    panel.querySelector('.producto-zoom, .seccion-nivel__boton, button:not([data-cerrar-zoom])')
      ?.focus({ preventScroll: true });
  }

  function cerrar() {
    if (capa.hidden || animando) return;
    if (ganchos?.puedeCerrar && !ganchos.puedeCerrar()) return;
    const repisa = repisaAbierta;
    const terminar = () => {
      capa.hidden = true;
      panel.innerHTML = '';
      panel.style.transform = '';
      document.body.classList.remove('sin-scroll');
      animando = false;
      repisa?.setAttribute('aria-expanded', 'false');
      repisa?.focus({ preventScroll: true });
      categoriaAbierta = null;
      alCerrar?.();
    };
    ganchos?.limpiar?.();
    ganchos = null;
    if (actualizarRuta) history.replaceState(null, '', rutaCerrada);
    repisaAbierta = null;
    if (reducido || (!repisa && !rectInicial)) return terminar();
    animando = true;
    capa.classList.remove('zoom-capa--visible');
    panel.classList.add('zoom-capa__panel--entrando');
    panel.style.transform = transformDesde(repisa);
    setTimeout(() => {
      panel.classList.remove('zoom-capa__panel--entrando');
      terminar();
    }, DURACION);
  }

  contenedor.querySelectorAll('.repisa[data-categoria]').forEach((repisa) =>
    repisa.addEventListener('click', () => abrir(repisa.dataset.categoria))
  );
  capa.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-zoom]')) cerrar();
  });

  // Teclado: Escape cierra; Tab no se sale del panel.
  const alTeclado = (e) => {
    if (capa.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
    } else if (e.key === 'Tab') {
      const foco = [...panel.querySelectorAll('button:not(:disabled), input, select, a[href]')];
      const primero = foco[0];
      const ultimo = foco.at(-1);
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  };
  document.addEventListener('keydown', alTeclado);

  if (categoriaInicial) abrir(categoriaInicial, { animar: false });

  const limpiar = () => {
    ganchos?.limpiar?.();
    document.removeEventListener('keydown', alTeclado);
    document.body.classList.remove('sin-scroll');
  };
  // Para abrir o cerrar el panel desde fuera (estantería 3D).
  limpiar.abrir = abrir;
  limpiar.cerrar = cerrar;
  return limpiar;
}
