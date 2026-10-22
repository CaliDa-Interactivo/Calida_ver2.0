// ============================================================
// miniaturas3d.js — "fotos" de los modelos 3D de cada subcategoría.
// Se dibuja cada .glb una sola vez con three.js (fondo transparente)
// y la imagen se repite en las repisas de cantidad (0 a 5): ficha del
// centro y gestión de insumos. Así se ven los mismos productos que en
// la estantería 3D sin abrir varias escenas 3D a la vez.
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODELOS_SUBCATEGORIA } from './estanteria3d.js';
import { cargarGLB } from './cargar-glb.js';
import { MINIATURAS } from './cache-miniaturas.js';
import { ajustarModelo } from './ajustes-modelos.js';

const TAMANO = 256;
let motor = null; // { renderer, escena, camara, cargador }
const pendientes = new Map();

function crearMotor() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(TAMANO, TAMANO, false);
  renderer.setClearColor(0x000000, 0);
  // three r147 (vista previa publicada): mismo color que r160.
  if (!('outputColorSpace' in renderer)) {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
  }
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight('#FFF8EE', '#D9C2A6', 2.0));
  const sol = new THREE.DirectionalLight('#FFFFFF', 2.2);
  sol.position.set(-2, 4, 5);
  escena.add(sol);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  return { renderer, escena, camara, cargador: new GLTFLoader() };
}

export function tieneModelo(subcategoriaId) {
  return Boolean(MODELOS_SUBCATEGORIA[subcategoriaId]);
}

/** Devuelve (y guarda) la imagen PNG del modelo de una subcategoría. */
export function generarMiniatura(subcategoriaId) {
  if (!tieneModelo(subcategoriaId)) return Promise.resolve(null);
  return generarMiniaturaDe(subcategoriaId, MODELOS_SUBCATEGORIA[subcategoriaId], (escena) =>
    ajustarModelo(subcategoriaId, escena, THREE)
  );
}

/** Igual, para cualquier modelo (p. ej. las casas de la ficha). */
export function generarMiniaturaDe(clave, url, preparar = null) {
  const subcategoriaId = clave;
  if (MINIATURAS.has(subcategoriaId)) return Promise.resolve(MINIATURAS.get(subcategoriaId));
  if (pendientes.has(subcategoriaId)) return pendientes.get(subcategoriaId);

  const tarea = (async () => {
    motor ??= crearMotor();
    const { renderer, escena, camara, cargador } = motor;
    const gltf = await cargarGLB(cargador, url);
    const modelo = preparar ? preparar(gltf.scene) : gltf.scene;

    // Centrar y encuadrar el modelo.
    modelo.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(modelo);
    const centro = caja.getCenter(new THREE.Vector3());
    const radio = caja.getSize(new THREE.Vector3()).length() / 2;
    modelo.position.sub(centro);
    escena.add(modelo);
    const d = radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2)) * 0.92;
    camara.position.set(0, radio * 0.35, d);
    camara.lookAt(0, 0, 0);
    camara.updateProjectionMatrix();

    renderer.render(escena, camara);
    const imagen = renderer.domElement.toDataURL('image/png');
    escena.remove(modelo);
    modelo.traverse((n) => {
      if (n.isMesh) {
        n.geometry.dispose();
        (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
      }
    });
    MINIATURAS.set(subcategoriaId, imagen);
    return imagen;
  })().catch((e) => {
    console.warn('Sin miniatura 3D para', subcategoriaId, e);
    return null;
  });
  pendientes.set(subcategoriaId, tarea);
  return tarea;
}
