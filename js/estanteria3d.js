// ============================================================
// estanteria3d.js — la estantería en 3D (three.js) con los modelos
// del equipo (assets/modelos/*.glb).
//
// - Ocupa toda la pantalla y se mueve como el mapa: arrastrar para
//   desplazar, rueda o pellizco para acercar, clic derecho o dos
//   dedos para girar. Botones +, − y ⟲ para quien no use gestos.
// - Cada compartimiento es una categoría; cada modelo, una
//   subcategoría. Al tocar un compartimiento, la cámara se acerca a
//   él EN LA MISMA PANTALLA y aparecen los nombres de los productos
//   como botones.
// - Las etiquetas son botones HTML reales (teclado y lectores de
//   pantalla), proyectados sobre el 3D.
// - Si a una subcategoría le falta modelo, se muestra su ilustración
//   2D (ilustraciones.js) como una tarjeta de pie sobre la repisa.
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CATEGORIAS } from './data.js';
import { ilustracion, productoPrincipal } from './ilustraciones.js';
import { cargarGLB } from './cargar-glb.js';
import { ajustarModelo } from './ajustes-modelos.js';

// --- Modelos ------------------------------------------------------------

const RUTA = 'assets/modelos/';
export const MODELO_ESTANTERIA = `${RUTA}estanteria.glb`;
export const MODELOS_SUBCATEGORIA = {
  'alimento-agua': `${RUTA}agua.glb`,
  'alimento-no-perecederos': `${RUTA}alimento_no_perecedero.glb`,
  'alimento-bebe': `${RUTA}comida_bebe.glb`,
  'alimento-animal': `${RUTA}comida_animal.glb`,
  'aseo-corporal': `${RUTA}papel_higienico.glb`,
  'aseo-bucal': `${RUTA}higiene_bucal.glb`,
  'aseo-limpieza-hogar': `${RUTA}limpieza_hogar.glb`,
  'medicamentos-analgesicos': `${RUTA}analgesicos.glb`,
  'medicamentos-antibioticos': `${RUTA}antibioticos.glb`,
  'medicamentos-cronicos': `${RUTA}cronico.glb`,
  'construccion-herramientas': `${RUTA}herramientas.glb`,
  'construccion-materiales': `${RUTA}material_construccion.glb`,
  'construccion-proteccion': `${RUTA}proteccion_personal.glb`,
  // Sin modelo todavía (se usa la ilustración 2D): ropa.
};

// --- Compartimientos (medidos en estanteria.glb, ya girada de frente) ---
// x: izquierda → derecha · y: de la tabla de abajo a la de arriba.
const COMPARTIMIENTOS = {
  alimento: { x0: -2.57, x1: -0.312, y0: 3.625, y1: 4.997 },
  aseo: { x0: 0.11, x1: 2.49, y0: 3.625, y1: 4.997 },
  ropa: { x0: -2.57, x1: -0.312, y0: 1.989, y1: 3.374 },
  medicamentos: { x0: 0.11, x1: 2.49, y0: 1.989, y1: 3.374 },
  construccion: { x0: -2.57, x1: 2.49, y0: 0.076, y1: 1.738 },
};
const FONDO_Z = -0.95; // panel trasero
const FRENTE_Z = 1.38; // borde abierto
const Z_PRODUCTOS = 0.15;

const CENTRO_MUEBLE = new THREE.Vector3(-0.04, 2.55, 0);

// --- Utilidades -----------------------------------------------------------

function suavizar(velocidad, dt) {
  return 1 - Math.exp(-velocidad * dt);
}


// Ajusta un objeto para que quepa en una caja (ancho, alto, fondo),
// apoyado en y = 0 y centrado en x/z.
function encajar(objeto, ancho, alto, fondo) {
  objeto.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(objeto);
  const tam = caja.getSize(new THREE.Vector3());
  const escala = Math.min(ancho / tam.x, alto / tam.y, fondo / tam.z);
  const envoltura = new THREE.Group();
  envoltura.add(objeto);
  objeto.scale.multiplyScalar(escala);
  objeto.updateMatrixWorld(true);
  const caja2 = new THREE.Box3().setFromObject(objeto);
  const centro = caja2.getCenter(new THREE.Vector3());
  objeto.position.x -= centro.x;
  objeto.position.z -= centro.z;
  objeto.position.y -= caja2.min.y;
  return envoltura;
}

// Placa de madera clavada al frente de la tabla: fondo crema, borde de
// madera, dos clavitos y el texto. Se dibuja en un canvas (textura).
const COLOR_ESTADO = { urgente: '#CC0100', desabastecido: '#F2C14E', medio: '#86B5A9', abastecido: '#B8AD9C' };

function texturaPlaca(texto, { extra = '', estado = null, proporcion = 5 } = {}, registrar) {
  const ancho = 1024;
  const alto = Math.round(ancho / proporcion);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  const radio = alto * 0.42;
  const redondeado = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  // Borde de madera y fondo crema con un leve degradé
  ctx.fillStyle = '#B9814F';
  redondeado(0, 0, ancho, alto, radio);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, alto);
  g.addColorStop(0, '#FFFBF3');
  g.addColorStop(1, '#F6E7CF');
  ctx.fillStyle = g;
  redondeado(alto * 0.09, alto * 0.09, ancho - alto * 0.18, alto - alto * 0.18, radio * 0.8);
  ctx.fill();
  // Clavitos
  ctx.fillStyle = '#9A6A40';
  [alto * 0.42, ancho - alto * 0.42].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, alto / 2, alto * 0.07, 0, Math.PI * 2);
    ctx.fill();
  });
  // Texto (con punto de estado opcional)
  const familia = '"Montserrat", "Segoe UI", Arial, sans-serif';
  let tam = alto * 0.5;
  const textoCompleto = extra ? `${texto}  ${extra}` : texto;
  const margen = alto * 1.0 + (estado ? alto * 0.5 : 0);
  ctx.font = `800 ${tam}px ${familia}`;
  while (ctx.measureText(textoCompleto).width > ancho - margen * 1.4 && tam > alto * 0.24) {
    tam -= 2;
    ctx.font = `800 ${tam}px ${familia}`;
  }
  const anchoTexto = ctx.measureText(textoCompleto).width + (estado ? tam * 0.9 : 0);
  let x = (ancho - anchoTexto) / 2;
  if (estado) {
    ctx.fillStyle = COLOR_ESTADO[estado] ?? '#B8AD9C';
    ctx.beginPath();
    ctx.arc(x + tam * 0.3, alto / 2, tam * 0.28, 0, Math.PI * 2);
    ctx.fill();
    x += tam * 0.9;
  }
  ctx.fillStyle = '#011E41';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x, alto / 2 + tam * 0.04);
  if (extra) {
    const wTexto = ctx.measureText(`${texto}  `).width;
    ctx.fillStyle = '#426D8C';
    ctx.fillText(extra, x + wTexto, alto / 2 + tam * 0.04);
  }
  const textura = registrar(new THREE.CanvasTexture(lienzo));
  if ('colorSpace' in textura) textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

function crearPlaca(texto, ancho, alto, opciones, registrar) {
  const material = registrar(
    new THREE.MeshBasicMaterial({
      map: texturaPlaca(texto, { ...opciones, proporcion: ancho / alto }, registrar),
      transparent: true,
    })
  );
  const malla = new THREE.Mesh(registrar(new THREE.PlaneGeometry(ancho, alto)), material);
  return malla;
}

// Ilustración 2D (SVG) como tarjeta de pie, para subcategorías sin modelo.
function tarjetaIlustracion(subcategoriaId, registrar) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 256;
  const textura = registrar(new THREE.CanvasTexture(lienzo));
  if ('colorSpace' in textura) textura.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    lienzo.getContext('2d').drawImage(img, 0, 0, 256, 256);
    textura.needsUpdate = true;
  };
  img.src = `data:image/svg+xml,${encodeURIComponent(
    ilustracion(productoPrincipal(subcategoriaId), { tamano: 256 })
  )}`;
  const material = registrar(new THREE.SpriteMaterial({ map: textura, transparent: true }));
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0.06); // se apoya en la repisa
  return sprite;
}

// ======================================================================

/**
 * @param {object} o
 * @param {HTMLElement} o.lienzo         contenedor del <canvas>
 * @param {HTMLElement} o.capaEtiquetas  capa HTML para placas y nombres
 * @param {string|null} o.categoriaInicial  abrir ya acercada (sin animación)
 * @param {(sub, cat) => void} o.alElegirSubcategoria  clic en un producto
 * @param {(cat|null) => void} o.alCambiarCategoria    al acercar/alejar
 * @param {(cat) => void} o.alLlegarACategoria          cuando termina de acercarse
 * @param {boolean} o.productosComoBotones  false = solo nombres (sin clic)
 * @param {(sub) => string} o.extraEtiqueta  texto extra en el nombre (p. ej. "3/5")
 * @param {(sub) => string|null} o.estadoDe  'urgente'|'desabastecido'|... (punto de color)
 * @param {(estado) => void} o.alCargar     'listo' | 'error'
 */
export function montarEstanteria3D(o) {
  const {
    lienzo,
    capaEtiquetas,
    categoriaInicial = null,
    alElegirSubcategoria = () => {},
    alCambiarCategoria = () => {},
    alLlegarACategoria = () => {},
    productosComoBotones = true,
    extraEtiqueta = null,
    estadoDe = null,
    alCargar = () => {},
    margenSuperior = null, // () => px que tapa el encabezado flotante
  } = o;

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desechables = [];
  const registrar = (x) => (desechables.push(x), x);

  // --- Escena ---
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  lienzo.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.classList.add('estanteria3d__canvas');

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(38, 1, 0.05, 200);

  // Luz pareja: mucha luz ambiente y un sol suave, para que la madera se
  // vea de un solo color (sin zonas oscuras).
  escena.add(new THREE.AmbientLight('#FFFFFF', 1.1));
  escena.add(new THREE.HemisphereLight('#FFFFFF', '#F1E2CF', 1.2));
  const sol = new THREE.DirectionalLight('#FFFFFF', 0.9);
  sol.position.set(-4, 9, 8);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 7, bottom: -2, near: 1, far: 30 });
  sol.shadow.camera.updateProjectionMatrix();
  escena.add(sol);
  const relleno = new THREE.DirectionalLight('#FFFFFF', 0.6);
  relleno.position.set(0, 2, 10);
  escena.add(relleno);

  // Piso suave para la sombra del mueble.
  const piso = new THREE.Mesh(
    registrar(new THREE.CircleGeometry(7, 48)),
    registrar(new THREE.ShadowMaterial({ opacity: 0.18 }))
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.18;
  piso.receiveShadow = true;
  escena.add(piso);

  // --- Controles (como el mapa) ---
  const controles = new OrbitControls(camara, canvas);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.screenSpacePanning = true;
  controles.minDistance = 1.6;
  controles.maxDistance = 24;
  controles.minPolarAngle = 0.95;
  controles.maxPolarAngle = 1.95;
  controles.minAzimuthAngle = -0.75;
  controles.maxAzimuthAngle = 0.75;
  controles.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controles.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

  // El mueble no se puede arrastrar fuera de la pantalla.
  const LIMITE = { x: 3.4, yMin: 0, yMax: 5.4 };
  controles.addEventListener('change', () => {
    const t = controles.target;
    const c = new THREE.Vector3(
      THREE.MathUtils.clamp(t.x, -LIMITE.x, LIMITE.x),
      THREE.MathUtils.clamp(t.y, LIMITE.yMin, LIMITE.yMax),
      THREE.MathUtils.clamp(t.z, -1, 1.5)
    ).sub(t);
    if (c.lengthSq() > 0) {
      t.add(c);
      camara.position.add(c);
    }
  });

  // --- Encuadres de cámara ---
  // El encabezado flota encima del 3D: se descuenta su alto para que el
  // mueble llene el espacio que queda libre debajo de él.
  function fraccionOcupadaArriba() {
    const alto = lienzo.clientHeight || 1;
    return THREE.MathUtils.clamp((margenSuperior?.() ?? 0) / alto, 0, 0.45);
  }

  // Distancia para que una caja (ancho × alto) llene el área visible.
  function encuadrar(centro, ancho, alto, { margen = 1.04, elevacion = 0 } = {}) {
    const vfov = THREE.MathUtils.degToRad(camara.fov);
    const tan = Math.tan(vfov / 2);
    const frac = fraccionOcupadaArriba();
    const dAlto = alto / (1 - frac) / 2 / tan;
    const dAncho = ancho / 2 / (tan * camara.aspect);
    const d = Math.max(dAlto, dAncho) * margen;
    // Sube el objetivo para que la caja quede centrada en el área libre.
    const desplazamiento = 2 * d * tan * (frac / 2);
    const objetivo = centro.clone().add(new THREE.Vector3(0, desplazamiento, 0));
    return {
      objetivo,
      posicion: objetivo.clone().add(new THREE.Vector3(0, elevacion, d)),
    };
  }

  function encuadreGeneral() {
    // El mueble mide ~6.15 × 5.43: casi sin margen, para que se vea grande.
    // Sin margen: el mueble llena el espacio libre de la pantalla.
    return encuadrar(CENTRO_MUEBLE, 6.18, 5.45, { margen: 1.0, elevacion: 0.2 });
  }

  // De cerca: la cámara queda fija mostrando todo el compartimiento,
  // con espacio abajo para los nombres de los productos.
  function encuadreCompartimiento(cat) {
    const c = COMPARTIMIENTOS[cat];
    const centro = new THREE.Vector3((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2 - 0.12, FRENTE_Z - 0.3);
    return encuadrar(centro, (c.x1 - c.x0) * 1.06, (c.y1 - c.y0) * 1.45, { margen: 1.0, elevacion: 0.1 });
  }

  let vuelo = null; // { objetivo, posicion, alTerminar }
  function volarA({ objetivo, posicion }, alTerminar = null, animar = true) {
    if (!animar || reducido) {
      controles.target.copy(objetivo);
      camara.position.copy(posicion);
      controles.update();
      alTerminar?.();
      return;
    }
    vuelo = { objetivo, posicion, alTerminar };
  }
  controles.addEventListener('start', () => {
    if (vuelo && !vuelo.alTerminar) vuelo = null;
  });
  // La cámara es fija (en la vista general y dentro de cada compartimiento):
  // la persona solo toca; no arrastra, gira ni acerca con gestos.
  controles.enabled = false;

  // --- Compartimientos: zonas tocables + placas ---
  const zonas = new Map(); // cat → { malla, material, placa, ... }
  CATEGORIAS.forEach((categoria) => {
    const c = COMPARTIMIENTOS[categoria.id];
    if (!c) return;
    const material = registrar(
      new THREE.MeshBasicMaterial({ color: '#FDD794', transparent: true, opacity: 0, depthWrite: false })
    );
    const malla = new THREE.Mesh(
      registrar(new THREE.BoxGeometry(c.x1 - c.x0, c.y1 - c.y0, FRENTE_Z - FONDO_Z)),
      material
    );
    malla.position.set((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (FONDO_Z + FRENTE_Z) / 2);
    malla.userData.categoria = categoria.id;
    escena.add(malla);

    // Placa 3D clavada al frente de la tabla de abajo del compartimiento.
    const anchoPlaca = Math.min(1.55, (c.x1 - c.x0) * 0.62);
    const placa3d = crearPlaca(categoria.nombre, anchoPlaca, 0.25, {}, registrar);
    placa3d.position.set((c.x0 + c.x1) / 2, c.y0 - 0.125, FRENTE_Z + 0.035);
    placa3d.userData.categoria = categoria.id;
    escena.add(placa3d);

    const placa = document.createElement('button');
    placa.type = 'button';
    placa.className = 'estanteria3d__placa';
    placa.textContent = categoria.nombre;
    placa.setAttribute('aria-label', `Ver ${categoria.nombre}`);
    placa.addEventListener('click', () => acercar(categoria.id));
    placa.addEventListener('pointerenter', () => marcarHover(categoria.id));
    placa.addEventListener('pointerleave', () => marcarHover(null));
    placa.addEventListener('focus', () => marcarHover(categoria.id));
    placa.addEventListener('blur', () => marcarHover(null));
    capaEtiquetas.appendChild(placa);

    zonas.set(categoria.id, {
      categoria,
      malla,
      material,
      placa,
      placa3d,
      opacidadObjetivo: 0,
      atenuada: false,
      productos: [],
    });
  });

  // --- Estado de interacción ---
  let abierta = null; // categoría acercada
  let hover = null;
  let hoverProducto = null;

  function marcarHover(cat) {
    hover = cat;
    actualizarObjetivos();
  }

  function actualizarObjetivos() {
    for (const [cat, z] of zonas) {
      let op = 0;
      if (z.atenuada && !abierta) op = 0.45; // velo azul sobre lo que no coincide
      if (!abierta && hover === cat && !z.atenuada) op = 0.22;
      z.opacidadObjetivo = op;
      z.material.color.set(z.atenuada ? '#011E41' : '#FDD794');
      z.placa.hidden = Boolean(abierta);
      z.placa3d.visible = !abierta;
      z.placa3d.scale.setScalar(hover === cat && !abierta ? 1.08 : 1);
      z.placa3d.material.color.set(z.atenuada ? '#9AA6B2' : '#FFFFFF');
      z.placa.classList.toggle('estanteria3d__placa--activa', hover === cat && !abierta);
      z.placa.classList.toggle('estanteria3d__placa--atenuada', z.atenuada);
      for (const p of z.productos) {
        p.boton.hidden = abierta !== cat;
        if (p.etiqueta3d) p.etiqueta3d.visible = abierta === cat;
      }
    }
    botonVolver.hidden = !abierta;
    canvas.style.cursor = hover || hoverProducto ? 'pointer' : 'default';
  }

  function acercar(cat, { animar = true } = {}) {
    if (!zonas.has(cat)) return;
    abierta = cat;
    hover = null;
    // Dentro de un compartimiento la cámara queda fija: solo se mueve
    // en la vista de categorías (toda la estantería).
    controles.enabled = false;
    alCambiarCategoria(cat);
    actualizarObjetivos();
    volarA(encuadreCompartimiento(cat), () => {
      alLlegarACategoria(cat);
      zonas.get(cat).productos[0]?.boton.focus({ preventScroll: true });
    }, animar);
  }

  function alejar({ animar = true } = {}) {
    const anterior = abierta;
    abierta = null;
    alCambiarCategoria(null);
    actualizarObjetivos();
    volarA(encuadreGeneral(), null, animar);
    if (anterior) zonas.get(anterior)?.placa.focus({ preventScroll: true });
  }

  // Botón para volver de cerca a la estantería completa.
  const botonVolver = document.createElement('button');
  botonVolver.type = 'button';
  botonVolver.className = 'estanteria3d__volver';
  botonVolver.textContent = '← Ver toda la estantería';
  botonVolver.hidden = true;
  botonVolver.addEventListener('click', () => alejar());
  capaEtiquetas.parentElement.appendChild(botonVolver);

  // --- Carga de la estantería y los productos ---
  const cargador = new GLTFLoader();
  const productosRaiz = new THREE.Group();
  escena.add(productosRaiz);

  function prepararMateriales(objeto) {
    objeto.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => {
          desechables.push(m);
          if (m.map) desechables.push(m.map);
          // Algunos materiales vienen con alfa 0 en el color; se ignora.
          if (m.transparent && m.opacity === 0) {
            m.transparent = false;
            m.opacity = 1;
          }
        });
        desechables.push(n.geometry);
      }
    });
  }

  async function cargarTodo() {
    // Estantería
    const gltfMueble = await cargarGLB(cargador, MODELO_ESTANTERIA);
    const mueble = gltfMueble.scene;
    prepararMateriales(mueble);
    // Madera clara de un solo tono: material mate con un poco de brillo
    // propio, sin sombras sobre el mueble (así el color se ve uniforme).
    const madera = registrar(
      new THREE.MeshStandardMaterial({ color: '#E7B888', emissive: '#E7B888', emissiveIntensity: 0.28, roughness: 0.95, metalness: 0 })
    );
    mueble.traverse((n) => {
      if (n.isMesh) {
        n.material = madera;
        n.castShadow = false;
        n.receiveShadow = false;
      }
    });
    mueble.rotation.y = Math.PI; // la cara abierta mira hacia la cámara
    escena.add(mueble);

    // Productos: uno por subcategoría, repartidos en su compartimiento.
    const tareas = [];
    for (const [cat, zona] of zonas) {
      const c = COMPARTIMIENTOS[cat];
      const subs = zona.categoria.subcategorias;
      const ancho = (c.x1 - c.x0) / subs.length;
      subs.forEach((sub, i) => {
        const x = c.x0 + ancho * (i + 0.5);
        const altoMax = (c.y1 - c.y0) * 0.78;
        const anchoMax = ancho * 0.82;
        const ruta = MODELOS_SUBCATEGORIA[sub.id];

        const boton = document.createElement(productosComoBotones ? 'button' : 'span');
        if (productosComoBotones) {
          boton.type = 'button';
          boton.addEventListener('click', () => alElegirSubcategoria(sub.id, cat));
        }
        boton.className = 'estanteria3d__producto';
        const estado = estadoDe?.(sub.id);
        boton.innerHTML = `${estado ? `<span class="punto-estado punto-estado--${estado}" aria-hidden="true"></span>` : ''}${sub.nombre}${extraEtiqueta ? `<span class="estanteria3d__producto-extra">${extraEtiqueta(sub.id)}</span>` : ''}`;
        boton.hidden = true;
        capaEtiquetas.appendChild(boton);

        // Etiqueta 3D del producto, en el frente de la tabla debajo de él.
        const etiqueta3d = crearPlaca(
          sub.nombre,
          Math.min(1.25, ancho * 0.9),
          0.21,
          { extra: extraEtiqueta ? extraEtiqueta(sub.id) : '', estado: estado ?? null },
          registrar
        );
        etiqueta3d.position.set(x, c.y0 - 0.125, FRENTE_Z + 0.04);
        etiqueta3d.visible = false;
        escena.add(etiqueta3d);

        const producto = {
          sub,
          boton,
          etiqueta3d,
          raiz: null,
          base: new THREE.Vector3(x, c.y0, Z_PRODUCTOS),
          alto: altoMax,
          elev: 0,
        };
        zona.productos.push(producto);
        etiqueta3d.userData.producto = producto;
        boton.addEventListener('pointerenter', () => (hoverProducto = producto));
        boton.addEventListener('pointerleave', () => (hoverProducto = null));
        boton.addEventListener('focus', () => (hoverProducto = producto));
        boton.addEventListener('blur', () => (hoverProducto = null));

        const colocar = (objeto) => {
          objeto.position.copy(producto.base);
          objeto.userData.producto = producto;
          producto.raiz = objeto;
          productosRaiz.add(objeto);
        };

        if (ruta) {
          tareas.push(
            cargarGLB(cargador, ruta)
              .then((gltf) => {
                prepararMateriales(gltf.scene);
                const encajado = encajar(gltf.scene, anchoMax, altoMax, 1.4);
                ajustarModelo(sub.id, encajado, THREE);
                colocar(encajado);
              })
              .catch((e) => {
                console.warn(e);
                colocar(spriteDe(sub.id, anchoMax, altoMax));
              })
          );
        } else {
          colocar(spriteDe(sub.id, anchoMax, altoMax));
        }
      });
    }
    await Promise.all(tareas);
  }

  function spriteDe(subId, ancho, alto) {
    const sprite = tarjetaIlustracion(subId, registrar);
    const lado = Math.min(ancho, alto) * 1.05;
    sprite.scale.set(lado, lado, 1);
    const g = new THREE.Group();
    g.add(sprite);
    return g;
  }

  // --- Puntero: tocar compartimientos y productos -------------------------
  const raycaster = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let inicio = null;

  function golpe(evento) {
    const r = canvas.getBoundingClientRect();
    puntero.x = ((evento.clientX - r.left) / r.width) * 2 - 1;
    puntero.y = -((evento.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(puntero, camara);
    if (abierta) {
      const prods = zonas.get(abierta).productos;
      const objetos = [...prods.map((p) => p.raiz).filter(Boolean), ...prods.map((p) => p.etiqueta3d)];
      const h = raycaster.intersectObjects(objetos, true)[0];
      if (h) {
        let n = h.object;
        while (n && !n.userData.producto) n = n.parent;
        return n ? { producto: n.userData.producto } : null;
      }
      return null;
    }
    const h = raycaster.intersectObjects(
      [...zonas.values()].flatMap((z) => [z.placa3d, z.malla]),
      false
    )[0];
    return h ? { categoria: h.object.userData.categoria } : null;
  }

  function alMover(e) {
    if (e.pointerType === 'touch') return;
    const g = golpe(e);
    hoverProducto = g?.producto ?? null;
    const nuevo = g?.categoria ?? null;
    if (nuevo !== hover) marcarHover(nuevo);
    else canvas.style.cursor = hover || hoverProducto ? 'pointer' : 'default';
  }

  function alPresionar(e) {
    inicio = { x: e.clientX, y: e.clientY, t: performance.now() };
  }

  function alSoltar(e) {
    if (!inicio) return;
    const mov = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    const dur = performance.now() - inicio.t;
    inicio = null;
    if (mov > 8 || dur > 600) return; // fue un arrastre
    const g = golpe(e);
    if (g?.categoria) acercar(g.categoria);
    else if (g?.producto && productosComoBotones) alElegirSubcategoria(g.producto.sub.id, abierta);
  }

  canvas.addEventListener('pointermove', alMover);
  canvas.addEventListener('pointerdown', alPresionar);
  canvas.addEventListener('pointerup', alSoltar);
  canvas.addEventListener('pointerleave', () => marcarHover(null));

  // Escape: de cerca → estantería completa.
  const alTeclado = (e) => {
    if (e.key === 'Escape' && abierta && !document.querySelector('.zoom-capa:not([hidden])')) {
      e.preventDefault();
      alejar();
    }
  };
  document.addEventListener('keydown', alTeclado);

  // --- Tamaño ---
  function ajustar() {
    const { clientWidth: w, clientHeight: h } = lienzo;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    // La cámara fija se re-encuadra al cambiar el tamaño.
    if (!vuelo) volarA(abierta ? encuadreCompartimiento(abierta) : encuadreGeneral(), null, false);
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(lienzo);
  ajustar();

  // --- Etiquetas HTML sobre el 3D ---
  const v = new THREE.Vector3();
  function aPantalla(x, y, z) {
    v.set(x, y, z).project(camara);
    return {
      x: (v.x * 0.5 + 0.5) * lienzo.clientWidth,
      y: (-v.y * 0.5 + 0.5) * lienzo.clientHeight,
      visible: v.z < 1,
    };
  }

  // Las placas y etiquetas visibles son 3D; las HTML (ocultas a la vista)
  // existen para el teclado y los lectores de pantalla.
  function actualizarEtiquetas() {}

  /** Rectángulo en pantalla de un compartimiento (para animaciones 2D). */
  function rectDe(cat) {
    const c = COMPARTIMIENTOS[cat];
    const a = aPantalla(c.x0, c.y1, FRENTE_Z);
    const b = aPantalla(c.x1, c.y0, FRENTE_Z);
    const r = lienzo.getBoundingClientRect();
    return {
      left: r.left + Math.min(a.x, b.x),
      top: r.top + Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  }

  // --- Bucle ---
  const reloj = new THREE.Clock();
  let idFrame = 0;
  function animar() {
    idFrame = requestAnimationFrame(animar);
    const dt = Math.min(reloj.getDelta(), 0.05);
    const k = reducido ? 1 : suavizar(10, dt);

    for (const z of zonas.values()) {
      z.material.opacity += (z.opacidadObjetivo - z.material.opacity) * k;
      for (const p of z.productos) {
        if (!p.raiz) continue;
        const objetivo = hoverProducto === p ? 0.08 : 0;
        p.elev += (objetivo - p.elev) * k;
        p.raiz.position.y = p.base.y + p.elev;
        const s = 1 + p.elev * 0.8;
        p.raiz.scale.setScalar(s);
        p.etiqueta3d.scale.setScalar(1 + p.elev * 0.9);
      }
    }

    if (vuelo) {
      const kc = suavizar(4.5, dt);
      controles.target.lerp(vuelo.objetivo, kc);
      camara.position.lerp(vuelo.posicion, kc);
      if (camara.position.distanceTo(vuelo.posicion) < 0.01) {
        const fin = vuelo.alTerminar;
        vuelo = null;
        fin?.();
      }
    }

    controles.update();
    actualizarEtiquetas();
    renderer.render(escena, camara);
  }

  // Encuadre inicial (y otra vez en el siguiente cuadro, cuando el
  // encabezado flotante ya tiene su alto real).
  volarA(encuadreGeneral(), null, false);
  requestAnimationFrame(() => {
    if (!abierta) volarA(encuadreGeneral(), null, false);
  });
  animar();

  cargarTodo()
    .then(() => {
      alCargar('listo');
      if (categoriaInicial) acercar(categoriaInicial, { animar: false });
      actualizarObjetivos();
    })
    .catch((e) => {
      console.error('No se pudo cargar la estantería 3D:', e);
      alCargar('error');
    });

  actualizarObjetivos();

  return {
    acercar,
    alejar,
    rectDe,
    getAbierta: () => abierta,
    acercarZoom: (f) => {
      if (abierta) return; // cámara fija dentro del compartimiento
      const off = camara.position.clone().sub(controles.target);
      off.setLength(THREE.MathUtils.clamp(off.length() * f, controles.minDistance, controles.maxDistance));
      camara.position.copy(controles.target).add(off);
      controles.update();
    },
    restablecer: () => {
      if (!abierta) volarA(encuadreGeneral());
    },
    // Atenúa los compartimientos que no coinciden con la búsqueda.
    filtrar: (coincide) => {
      for (const [cat, z] of zonas) z.atenuada = !coincide(cat);
      actualizarObjetivos();
    },
    destruir() {
      cancelAnimationFrame(idFrame);
      observador.disconnect();
      document.removeEventListener('keydown', alTeclado);
      canvas.removeEventListener('pointermove', alMover);
      canvas.removeEventListener('pointerdown', alPresionar);
      canvas.removeEventListener('pointerup', alSoltar);
      controles.dispose();
      desechables.forEach((d) => d.dispose?.());
      renderer.dispose();
      canvas.remove();
      capaEtiquetas.replaceChildren();
      botonVolver.remove();
    },
  };
}
