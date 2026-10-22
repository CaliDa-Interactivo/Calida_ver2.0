// ============================================================
// ficha.js — D5 · Información del centro de acopio.
// Muestra el recuadro de la estantería con la cantidad (0 a 5) de
// la subcategoría elegida y el botón de pre-registro. "Cómo llegar"
// NO va aquí: está en la pantalla que se abre después del pre-registro
// (llegar.js).
// ============================================================

import { getCentro, getNecesidades } from '../store.js';
import { obtenerSubcategoria, estadoDeNivel, ETIQUETA_ESTADO, NIVEL_MAX } from '../data.js';
import { renderRepisaNivel, cargarMiniaturas } from '../ilustraciones.js';
import { urlEmoji, EMOJI_CENTRO } from '../iconos.js';
import { prerregistroVigente, horaVencimiento } from './prerregistro-sesion.js';

export function renderNivel(subcategoria, nivel, { tamano = 52 } = {}) {
  const estado = estadoDeNivel(nivel);
  return `
    <div class="nivel ${nivel === 0 ? 'nivel--vacio' : ''}">
      <div class="nivel__repisa">${renderRepisaNivel(subcategoria.id, nivel, { tamano })}</div>
    </div>
  `;
}

// Etiqueta grande del estado: solo "Urgente" o "Desabastecido" (el mapa
// solo lleva a centros que necesitan la subcategoría).
const ETIQUETA_GRANDE = { urgente: '⚠ Urgente', desabastecido: 'Desabastecido' };

function renderEstadoGrande(nivel) {
  const estado = estadoDeNivel(nivel);
  if (!ETIQUETA_GRANDE[estado]) return '';
  return `<p class="estado-grande estado-grande--${estado}">${ETIQUETA_GRANDE[estado]}</p>`;
}

const escaparHTML = (t) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Elementos específicos que pidió el centro (los escribe el administrador).
function renderNecesidades(lista, subcategoria) {
  if (!lista.length) return '';
  return `
    <div class="necesidades">
      <h2 class="necesidades__titulo">Lo que necesitan de ${subcategoria.nombre.toLowerCase()}</h2>
      <ul class="necesidades__lista">
        ${lista.map((p) => `<li>${escaparHTML(p)}</li>`).join('')}
      </ul>
    </div>
  `;
}

export function render({ centroId, subcategoriaId }) {
  const centro = getCentro(centroId);
  const subcategoria = obtenerSubcategoria(subcategoriaId);
  const volverAtras = `#/donante/mapa/${subcategoriaId}`;

  if (!centro || !subcategoria) {
    return `
      <section class="vista">
        <a class="boton-atras" href="#/donante/estanteria">← Volver</a>
        <h1>Centro no encontrado</h1>
      </section>
    `;
  }

  const nivel = centro.insumos[subcategoriaId];
  const pre = prerregistroVigente(centroId, subcategoriaId);

  const acciones = pre
    ? `
      <div class="ficha-prerregistro-ok" role="status">
        <p><strong>✓ Ya hiciste tu pre-registro.</strong> Lleva tu donación antes del ${horaVencimiento(pre)}</p>
      </div>
      <button class="boton boton--grande" type="button"
              data-navegar="#/donante/llegar/${centro.id}/${subcategoria.id}">
        Continuar
      </button>`
    : `
      <button class="boton boton--grande" type="button"
              data-navegar="#/donante/prerregistro/${centro.id}/${subcategoria.id}">
        Pre-registrar mi donación
      </button>
      <p class="ficha-centro__nota">Toma un minuto y avisa al centro que vas en camino.</p>`;

  return {
    html: `
    <section class="vista vista-ficha">
      <a class="boton-atras" href="${volverAtras}">← Volver</a>
      <div class="tarjeta ficha-centro">
        <div class="ficha-centro__foto ficha-centro__foto--casa ficha-centro__foto--${estadoDeNivel(nivel)}"
             ${['urgente', 'desabastecido'].includes(estadoDeNivel(nivel)) ? `data-mini-casa="${estadoDeNivel(nivel)}"` : ''}>
          <img src="${urlEmoji(EMOJI_CENTRO)}" alt="" width="64" height="64" />
        </div>
        <h1 class="ficha__nombre">${centro.nombre}</h1>
        <p class="ficha-centro__dato"><strong>Zona:</strong> ${centro.zona}</p>
        <p class="ficha-centro__dato"><strong>Horario:</strong> ${centro.horario}</p>
        <p class="ficha-centro__dato"><strong>Teléfono:</strong> ${centro.telefono}</p>

        ${renderEstadoGrande(nivel)}
        ${renderNivel(subcategoria, nivel)}
        ${renderNecesidades(getNecesidades(centro.id, subcategoria.id), subcategoria)}

        ${acciones}
      </div>
    </section>
  `,
    // La repisa de cantidad muestra los mismos productos 3D de la estantería.
    init(contenedor) {
      cargarMiniaturas(contenedor);
    },
  };
}
