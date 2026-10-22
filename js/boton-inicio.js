// ============================================================
// boton-inicio.js — botón "Volver a pantalla principal" (#/).
// main.js lo agrega solo en las pantallas a las que se llega
// después de pasar más de dos pantallas (donante y administrador),
// y en la pantalla de pre-registro.
// ============================================================

export const RUTA_PRINCIPAL = '#/';

export function renderBotonInicio() {
  return `
    <div class="barra-inicio">
      <a class="boton-inicio" href="${RUTA_PRINCIPAL}">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Volver a pantalla principal
      </a>
    </div>`;
}

// Inserta el botón al comienzo de la vista (si no lo tiene ya).
export function agregarBotonInicio(vista) {
  if (!vista || vista.querySelector('.barra-inicio')) return;
  vista.insertAdjacentHTML('afterbegin', renderBotonInicio());
}
