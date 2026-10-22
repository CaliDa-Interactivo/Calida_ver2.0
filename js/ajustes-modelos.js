// ============================================================
// ajustes-modelos.js — retoques a los modelos de productos:
// colores que venían mal en el archivo y calcomanías (íconos)
// al frente. Lo usan la estantería 3D y las "fotos" de los modelos.
// ============================================================

// Colores por material (nombre del material en el .glb).
const COLORES = {
  'alimento-agua': {
    'Bottle plastic': { color: '#8FD0F2', metalness: 0, roughness: 0.2, opacity: 0.88 },
    'Bottle cap': { color: '#1E6FD9', metalness: 0, roughness: 0.45 },
  },
};

// Íconos dibujados en canvas (fondo transparente).
function dibujarMaiz(ctx, s) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-0.35);
  // hojas
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.42);
  ctx.quadraticCurveTo(-s * 0.36, s * 0.05, -s * 0.12, -s * 0.3);
  ctx.quadraticCurveTo(-s * 0.08, s * 0.1, 0, s * 0.42);
  ctx.fill();
  ctx.fillStyle = '#3E9B43';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.42);
  ctx.quadraticCurveTo(s * 0.36, s * 0.05, s * 0.12, -s * 0.3);
  ctx.quadraticCurveTo(s * 0.08, s * 0.1, 0, s * 0.42);
  ctx.fill();
  // mazorca
  ctx.fillStyle = '#FFC93C';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.13, s * 0.33, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F2A81D';
  for (let y = -0.3; y <= 0.2; y += 0.085) {
    for (let x = -0.07; x <= 0.07; x += 0.07) {
      ctx.beginPath();
      ctx.arc(x * s, (y - 0.02) * s, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function dibujarHuella(ctx, s) {
  ctx.fillStyle = '#FFF6E6';
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6B3A1E';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.6, s * 0.15, s * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  [
    [0.3, 0.42, -0.4],
    [0.42, 0.3, -0.15],
    [0.58, 0.3, 0.15],
    [0.7, 0.42, 0.4],
  ].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.ellipse(s * x, s * y, s * 0.06, s * 0.08, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

const CALCOMANIAS = {
  'alimento-no-perecederos': dibujarMaiz,
  'alimento-animal': dibujarHuella,
};

/**
 * Corrige colores y agrega la calcomanía al frente (+z) del objeto.
 * @param {string} subcategoriaId
 * @param {THREE.Object3D} objeto  ya ubicado/escalado
 * @param {typeof import('three')} THREE
 */
export function ajustarModelo(subcategoriaId, objeto, THREE) {
  const colores = COLORES[subcategoriaId];
  if (colores) {
    objeto.traverse((n) => {
      if (!n.isMesh) return;
      (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
        const c = colores[m.name];
        if (!c) return;
        m.color.set(c.color);
        m.metalness = c.metalness;
        m.roughness = c.roughness;
        if (c.opacity !== undefined) {
          m.transparent = true;
          m.opacity = c.opacity;
        }
      });
    });
  }

  const dibujar = CALCOMANIAS[subcategoriaId];
  if (dibujar) {
    objeto.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(objeto);
    const tam = caja.getSize(new THREE.Vector3());
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 256;
    dibujar(lienzo.getContext('2d'), 256);
    const textura = new THREE.CanvasTexture(lienzo);
    if ('colorSpace' in textura) textura.colorSpace = THREE.SRGBColorSpace;
    const lado = Math.min(tam.x, tam.y) * 0.5;
    const calco = new THREE.Mesh(
      new THREE.PlaneGeometry(lado, lado),
      new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false })
    );
    // En coordenadas del mundo: al frente, centrada.
    const centro = caja.getCenter(new THREE.Vector3());
    const pos = new THREE.Vector3(centro.x, centro.y, caja.max.z + tam.z * 0.01);
    objeto.worldToLocal(pos);
    calco.position.copy(pos);
    // Compensa la escala del objeto para que la calcomanía mida "lado".
    const escala = objeto.getWorldScale(new THREE.Vector3());
    calco.scale.set(1 / escala.x, 1 / escala.y, 1);
    calco.renderOrder = 2;
    objeto.add(calco);
  }
  return objeto;
}
