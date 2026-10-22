// ============================================================
// gato.js — mascota guía de CaliDa (la ilustración del equipo).
// Siempre va con un globo de diálogo. Dos poses en assets/:
// gato.png (de pie) y gato-saluda.png (saludando).
// ============================================================

export const IMAGEN_GATO = 'assets/gato.png';
export const IMAGEN_GATO_SALUDA = 'assets/gato-saluda.png';

// El gato es 3D (gato3d.js); el PNG queda adentro como respaldo.
// Poses del 3D: quieto · saluda · senala · alerta · feliz.
// tamano 'asoma': se asoma de medio cuerpo por el borde (pre-registro).
// tamano 'lado': cuerpo entero al lado del mapa.
export function renderGato(mensaje, { tamano = 'normal', pose = 'quieto' } = {}) {
  const encuadre = tamano === 'asoma' ? 'medio' : 'completo';
  const src = pose === 'saluda' ? IMAGEN_GATO_SALUDA : IMAGEN_GATO;
  const pose3d = pose === 'normal' ? 'quieto' : pose;
  return `
    <div class="gato-guia gato-guia--${tamano}">
      <div class="gato-guia__imagen gato3d" data-gato3d data-pose="${pose3d}" data-encuadre="${encuadre}" role="img" aria-label="Gato guía de CaliDa">
        <img class="gato3d__respaldo" src="${src}" alt="" width="64" height="80" />
      </div>
      <div class="gato-guia__globo">
        <p>${mensaje}</p>
      </div>
    </div>
  `;
}
