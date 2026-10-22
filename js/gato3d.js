// ============================================================
// gato3d.js — el gato de CaliDa en 3D (assets/modelos/gato.glb).
//
// Reemplaza al gato 2D en toda la página. Cada contenedor
// [data-gato3d] recibe un pequeño lienzo three.js con su propia copia
// del modelo. Si el 3D no puede mostrarse, se queda el dibujo 2D que
// el contenedor ya trae adentro (respaldo).
//
// El modelo no trae animaciones, así que se animan sus partes desde
// el código, conservando las animaciones del gato 2D:
//   quieto  → mirando al frente, con vida: respira, se balancea un poco,
//             mueve suave la mano y la cola, y parpadea
//   (data-encuadre="medio": se ve de medio cuerpo, asomándose)
//   saluda  → solo saluda con la mano derecha (y parpadea): pantalla principal
//   senala  → se inclina hacia el contenido (izquierda)
//   alerta  → levanta la mano y la mueve despacio, llamando la atención
//             (sin sacudirse; mapa con urgencias:
//             se activa solo si está dentro de .mapa3d__gato--urgente)
//   feliz   → salta de alegría (confirmaciones)
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cargarGLB, MODELO_GATO } from './cargar-glb.js';

const activos = new Set();
let base = null; // Promise<THREE.Group> del modelo original

function cargarBase() {
  base ??= cargarGLB(new GLTFLoader(), MODELO_GATO).then((gltf) => {
    const modelo = gltf.scene;
    // El modelo mira hacia +x: se gira para que mire a la cámara (+z).
    modelo.rotation.y = -Math.PI / 2;
    const raiz = new THREE.Group();
    raiz.add(modelo);
    raiz.updateMatrixWorld(true);
    // Centrado en x/z y apoyado en y = 0, con alto 1.
    const caja = new THREE.Box3().setFromObject(raiz);
    const tam = caja.getSize(new THREE.Vector3());
    const centro = caja.getCenter(new THREE.Vector3());
    modelo.position.x -= centro.x;
    modelo.position.z -= centro.z;
    modelo.position.y -= caja.min.y;
    raiz.scale.setScalar(1 / tam.y);
    return raiz;
  });
  return base;
}

// Agrupa partes bajo un pivote (sin moverlas) para poder rotarlas juntas.
function agrupar(raiz, nombres, pivote) {
  const grupo = new THREE.Group();
  grupo.position.copy(pivote);
  raiz.add(grupo);
  raiz.updateMatrixWorld(true);
  grupo.updateMatrixWorld(true);
  nombres
    .map((n) => raiz.getObjectByName(n))
    .filter(Boolean)
    .forEach((obj) => grupo.attach(obj));
  return grupo;
}

function centroDe(raiz, nombres) {
  const caja = new THREE.Box3();
  nombres.map((n) => raiz.getObjectByName(n)).filter(Boolean).forEach((o) => caja.expandByObject(o));
  return caja.isEmpty() ? null : caja.getCenter(new THREE.Vector3());
}

async function montarUno(el) {
  const modeloBase = await cargarBase();
  if (!el.isConnected) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (!('outputColorSpace' in renderer)) {
    // three r147 (vista previa publicada): mismo color que r160.
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
  }
  const canvas = renderer.domElement;
  canvas.className = 'gato3d__canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const escena = new THREE.Scene();
  escena.add(new THREE.AmbientLight('#FFF4EA', 0.9));
  escena.add(new THREE.HemisphereLight('#FFF8EE', '#E9B99A', 1.3));
  const sol = new THREE.DirectionalLight('#FFF1E0', 1.7);
  sol.position.set(1.5, 3, 4);
  escena.add(sol);
  const borde = new THREE.DirectionalLight('#FFD9B8', 1.1); // luz de contorno cálida
  borde.position.set(-2.5, 2, -2);
  escena.add(borde);

  const camara = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  if (el.dataset.encuadre === 'medio') {
    // Medio cuerpo: de la cintura a las orejas (para asomarse por un lado).
    camara.position.set(0, 0.8, 1.5);
    camara.lookAt(0, 0.74, 0);
  } else {
    camara.position.set(0, 0.62, 2.55);
    camara.lookAt(0, 0.5, 0);
  }

  // Copia propia del modelo (las geometrías se comparten).
  const raiz = modeloBase.clone(true);
  const pivoteGato = new THREE.Group(); // para rebote y balanceo
  pivoteGato.add(raiz);
  escena.add(pivoteGato);

  // Partes animables.
  raiz.updateMatrixWorld(true);
  const ojos = ['Ojos', 'Pupilas', 'Pupilas espejo'];
  const centroOjos = centroDe(raiz, ojos);
  const grupoOjos = centroOjos ? agrupar(raiz, ojos, raiz.worldToLocal(centroOjos.clone())) : null;
  const cola = raiz.getObjectByName('Cola');
  const brazo = raiz.getObjectByName('BrazoDer'); // articulado en el hombro

  // Sombra suave en el piso (se ve más apoyado y orgánico).
  const lienzoSombra = document.createElement('canvas');
  lienzoSombra.width = lienzoSombra.height = 128;
  const ctxS = lienzoSombra.getContext('2d');
  const grad = ctxS.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(90, 40, 20, 0.32)');
  grad.addColorStop(1, 'rgba(90, 40, 20, 0)');
  ctxS.fillStyle = grad;
  ctxS.fillRect(0, 0, 128, 128);
  const texSombra = new THREE.CanvasTexture(lienzoSombra);
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.5),
    new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false })
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.002;
  if (el.dataset.encuadre !== 'medio') escena.add(sombra);

  el.appendChild(canvas);
  el.classList.add('gato3d--listo');

  const ajustar = () => {
    const w = el.clientWidth || 100;
    const h = el.clientHeight || w * 1.25;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(ajustar);
  observador.observe(el);
  ajustar();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(el);

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reloj = new THREE.Clock();
  const desfase = Math.random() * 10;
  let id = 0;

  function cuadro() {
    id = requestAnimationFrame(cuadro);
    if (!visible || !el.isConnected) return;
    try {
      animarCuadro();
    } catch (e) {
      // Si algo falla al animar, se vuelve al gato 2D (no se reintenta).
      console.warn('Gato 3D detenido; se usa el 2D.', e);
      instancia.destruir();
    }
  }

  function animarCuadro() {
    const t = reloj.getElapsedTime() + desfase;
    let pose = el.dataset.pose || 'quieto';
    if (el.closest('.mapa3d__gato--urgente')) pose = 'alerta';

    // Reinicio
    pivoteGato.position.set(0, 0, 0);
    pivoteGato.rotation.set(0, 0, 0);
    pivoteGato.scale.set(1, 1, 1);

    if (!reducido) {
      // Respiración (todas las poses)
      pivoteGato.scale.y = 1 + Math.sin(t * 1.6) * 0.01;

      if (pose === 'saluda') {
        // Solo la mano: el brazo sube y se mece desde el hombro.
        pivoteGato.scale.y = 1;
      } else if (pose === 'senala') {
        pivoteGato.rotation.z = 0.1 + Math.sin(t * 2) * 0.03;
        pivoteGato.rotation.y = -0.45 + Math.sin(t * 1.5) * 0.05;
      } else if (pose === 'alerta') {
        // Tranquilo y orgánico: se inclina apenas hacia adelante y respira.
        pivoteGato.rotation.z = Math.sin(t * 0.8) * 0.02;
        pivoteGato.rotation.x = 0.04;
      } else if (pose === 'feliz') {
        const c = t % 1.4;
        pivoteGato.position.y = c < 0.6 ? Math.sin((c / 0.6) * Math.PI) * 0.09 : 0;
        pivoteGato.rotation.y = Math.sin(t * 1.2) * 0.2;
      } else {
        // quieto: mirando al frente, pero vivo (cambio de peso suave).
        pivoteGato.rotation.z = Math.sin(t * 0.9) * 0.025;
        pivoteGato.rotation.y = Math.sin(t * 0.55) * 0.05;
        pivoteGato.position.y = 0;
      }

      // Brazo: saluda en la pantalla principal; en reposo, casi quieto.
      if (brazo) {
        brazo.rotation.x =
          pose === 'saluda'
            ? -0.95 + Math.sin(t * 5.5) * 0.28
            : pose === 'alerta'
              ? -1.05 + Math.sin(t * 2.2) * 0.22 // mano arriba, moviéndose despacio
            : pose === 'feliz'
              ? -0.9
              : // quieto: la mano se mueve suave, y cada tanto hace un saludito
                Math.sin(t * 1.3) * 0.07 + (t % 9 < 1.6 ? -0.45 * Math.sin(((t % 9) / 1.6) * Math.PI) : 0);
      }
      // Cola que se mueve (no en el saludo: ahí solo se mueve la mano)
      if (cola) {
        const v = pose === 'quieto' || pose === 'alerta' ? 1.2 : 2.4;
        const a = pose === 'saluda' ? 0 : pose === 'quieto' || pose === 'alerta' ? 0.08 : 0.16;
        cola.rotation.y = Math.sin(t * v) * a;
      }
      // Parpadeo cada ~4 s
      if (grupoOjos) {
        const p = t % 4.2;
        grupoOjos.scale.y = p > 4.05 ? 0.12 : 1;
      }
    }
    renderer.render(escena, camara);
  }

  const instancia = {
    el,
    destruir() {
      cancelAnimationFrame(id);
      observador.disconnect();
      io.disconnect();
      renderer.dispose();
      canvas.remove();
      el.classList.remove('gato3d--listo');
      activos.delete(instancia);
    },
  };
  activos.add(instancia);
  cuadro(); // empieza a animar (después de crear la instancia)
}

/** Pone el gato 3D en todos los [data-gato3d] dentro de `raiz`. */
export function montarGatos(raiz = document) {
  const pendientes = [...raiz.querySelectorAll('[data-gato3d]:not(.gato3d--listo):not([data-gato3d-montando])')];
  pendientes.forEach((el) => {
    el.dataset.gato3dMontando = '1';
    montarUno(el)
      .catch((e) => console.warn('Gato 3D no disponible; se usa el 2D.', e))
      .finally(() => delete el.dataset.gato3dMontando);
  });
}

/** Libera los gatos que ya no están en la página. */
export function limpiarGatos() {
  [...activos].forEach((g) => {
    if (!g.el.isConnected) g.destruir();
  });
}
