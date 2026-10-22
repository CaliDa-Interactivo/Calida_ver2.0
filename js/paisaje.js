// ============================================================
// paisaje.js — ilustración de paisaje por capas (estilo plano, como
// la referencia del equipo): cielo, sol, colinas salvia, pinos y dos
// casitas (centros de acopio, con techo rojo y amarillo).
// Se usa en la bienvenida y en el login. Solo decoración.
// ============================================================

let contador = 0;

function pino(x, y, s, color) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-1.5" y="-6" width="3" height="8" fill="#6E5440"/>
    <path d="M0 -40 L13 -14 L-13 -14 Z M0 -30 L16 -4 L-16 -4 Z M0 -20 L19 6 L-19 6 Z" transform="translate(0 -6)" fill="${color}"/>
  </g>`;
}

function casita(x, y, techo) {
  return `<g transform="translate(${x} ${y})">
    <rect x="-13" y="-16" width="26" height="18" fill="#FFF8ED"/>
    <path d="M-17 -15 L0 -30 L17 -15 Z" fill="${techo}"/>
    <rect x="-4" y="-8" width="8" height="10" fill="#8A6A4B"/>
  </g>`;
}

export function renderPaisaje({ clase = '', etiqueta = '' } = {}) {
  const id = `paisaje${++contador}`;
  const pinosFondo = [40, 70, 95, 300, 330, 355, 380]
    .map((x, i) => pino(x, 182 - (i % 2) * 4, 0.75, '#6FA393'))
    .join('');
  const pinosFrente = [12, 34, 58, 250, 282, 312, 344, 372, 396]
    .map((x, i) => pino(x, 236 + (i % 3) * 3, 1 + (i % 2) * 0.15, i % 2 ? '#3E7A6C' : '#2F6457'))
    .join('');
  return `
    <svg class="paisaje ${clase}" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice"
         ${etiqueta ? `role="img" aria-label="${etiqueta}"` : 'aria-hidden="true"'} focusable="false">
      <defs>
        <linearGradient id="${id}-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#E3EFEA"/>
          <stop offset="1" stop-color="#FFF8ED"/>
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#${id}-cielo)"/>
      <circle cx="300" cy="62" r="26" fill="#FDD794"/>
      <path d="M0 150 C60 110 120 120 170 140 C230 100 300 105 400 135 L400 260 L0 260 Z" fill="#C9E0D7"/>
      <path d="M0 185 C70 150 140 160 200 178 C270 150 330 152 400 172 L400 260 L0 260 Z" fill="#A2CABB"/>
      ${pinosFondo}
      <path d="M0 215 C90 190 160 196 230 210 C300 194 350 196 400 206 L400 260 L0 260 Z" fill="#86B5A9"/>
      ${casita(160, 214, '#CC0100')}
      ${casita(205, 220, '#F2C14E')}
      <path d="M0 240 C100 225 220 230 400 238 L400 260 L0 260 Z" fill="#3E7A6C"/>
      ${pinosFrente}
    </svg>`;
}
