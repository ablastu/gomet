const contIzquierdos = document.querySelectorAll('.contenedor-izquierdo');
const dropZones = document.querySelectorAll('.contendor-soltar');
const draggables = document.querySelectorAll('.draggable-mut');
const draggableMutBodies = new Map();
let isDragging = false;
let currentDraggingBody = null;
let cursorPosition = { x: 0, y: 0 };  // Guardar la posición del cursor o dedo

const { Engine, Render, World, Bodies, Body } = Matter;
const engine = Engine.create();
const world = engine.world;

const contDerecho = document.getElementById('contenedor-derecho');

// Renderizado de Matter.js con formas transparentes
const render = Render.create({
    element: contDerecho,
    engine: engine,
    options: {
        width: contDerecho.clientWidth,
        height: contDerecho.clientHeight,
        wireframes: false,
        background: 'transparent'
    }
});

Render.run(render);

function createWalls() {
    const width = contDerecho.clientWidth;
    const height = contDerecho.clientHeight;

    const walls = [
        Bodies.rectangle(width / 2, 0, width, 4, { isStatic: true, render: { fillStyle: 'transparent' } }),
        Bodies.rectangle(width / 2, height, width, 4, { isStatic: true, render: { fillStyle: 'transparent' } }),
        Bodies.rectangle(0, height / 2, 4, height, { isStatic: true, render: { fillStyle: 'transparent' } }),
        Bodies.rectangle(width, height / 2, 4, height, { isStatic: true, render: { fillStyle: 'transparent' } })
    ];

    World.add(world, walls);
}

createWalls();

window.addEventListener('resize', function () {
    World.clear(world, false);
    createWalls();
    // Actualizar la posición de los cuerpos al redimensionar
    draggableMutBodies.forEach((body, element) => {
        const elemRect = element.getBoundingClientRect();
        Body.setPosition(body, {
            x: Math.min(Math.max(elemRect.left + elemRect.width / 2, 0), contDerecho.clientWidth),
            y: Math.min(Math.max(elemRect.top + elemRect.height / 2, 0), contDerecho.clientHeight)
        });
    });
});

function esDispositivoTactil() {
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

const isTouchDevice = esDispositivoTactil();

draggables.forEach((draggable) => {
    let dragTimeout;
    let isMouseDown = false;
    let draggableInstance;
    let hasBeenReleased = false;
    let releaseHandler;

    addBody(draggable);

    // Inicialización de GSAP Draggable
    draggableInstance = Draggable.create(draggable, {
        type: 'x,y',
        zIndexBoost: true,
        onPress: function (e) {
            const isTouch = e.type === " touchstart"; cursorPosition.x = isTouch ? e.touches[0].clientX :
                e.clientX; // Guardar posición inicial del cursor cursorPosition.y=isTouch ? e.touches[0].clientY : e.clientY;
            const body = draggableMutBodies.get(draggable); hasBeenReleased = false; isMouseDown = true; isDragging = false;
            releaseHandler = () => {
                hasBeenReleased = true;
                clearTimeout(dragTimeout);
                draggableInstance.enable();
                isMouseDown = false;
                isDragging = false;
                window.removeEventListener('mouseup', releaseHandler);
                window.removeEventListener('touchend', releaseHandler);
            };

            window.addEventListener('mouseup', releaseHandler);
            window.addEventListener('touchend', releaseHandler, { passive: false });

            // Detectar si está dentro de una zona de soltado (contenedor-soltar)
            if (draggable.parentElement.classList.contains('contenedor-soltar')) {
                draggableInstance.disable(); // Deshabilitamos el Draggable

                dragTimeout = setTimeout(() => {
                    if (!hasBeenReleased && isMouseDown) {
                        // Mover el elemento al body
                        document.body.appendChild(draggable);
                        gsap.set(draggable, {
                            position: 'absolute',
                            x: cursorPosition.x - draggable.offsetWidth / 2,  // Centrar en el cursor
                            y: cursorPosition.y - draggable.offsetHeight / 2,
                            width: '200px',
                            height: '200px'
                        });

                        // Sincronizamos con Matter.js
                        if (body) {
                            Body.setStatic(body, true);
                            Body.setAngle(body, body.angle);
                            currentDraggingBody = body;
                        }

                        isDragging = true;
                        draggableInstance.enable();  // Reactivamos el Draggable
                        draggableInstance.startDrag(e);
                    }
                }, 300);
            } else {
                gsap.set(draggable, {
                    x: cursorPosition.x - draggable.offsetWidth / 2,  // Centrar en el cursor
                    y: cursorPosition.y - draggable.offsetHeight / 2
                });

                if (body) {
                    Body.setStatic(body, true);
                    Body.setAngle(body, body.angle);
                    currentDraggingBody = body;
                }

                isDragging = true;
            }
        },
        onDrag: function (e) {
            if (!isDragging) return;

            const isTouch = e.type === "touchmove";
            const clientX = isTouch ? e.touches[0].clientX : e.clientX;
            const clientY = isTouch ? e.touches[0].clientY : e.clientY;
            const body = draggableMutBodies.get(draggable);

            gsap.set(draggable, {
                x: clientX - draggable.offsetWidth / 2,
                y: clientY - draggable.offsetHeight / 2
            });

            if (body) {
                Body.setPosition(body, {
                    x: Math.min(Math.max(clientX, 0), contDerecho.clientWidth),
                    y: Math.min(Math.max(clientY, 0), contDerecho.clientHeight)
                });
            }
        },
        onRelease: function (e) {
            clearTimeout(dragTimeout);  // Limpiar el temporizador cada vez
            isMouseDown = false;
            isDragging = false;

            const body = draggableMutBodies.get(draggable);

            if (body) {
                Body.setStatic(body, false);
                currentDraggingBody = null;
            }

            const elemRect = draggable.getBoundingClientRect();
            const dropZone = Array.from(dropZones).find(zone => {
                const zoneRect = zone.getBoundingClientRect();
                return isOverlapping(elemRect, zoneRect);
            });

            if (dropZone) {
                dropZone.appendChild(draggable);
                draggable.classList.replace('draggable-mut', 'hijo-de');

                // **Matar completamente Draggable** al convertir a hijo-de
                if (draggableInstance) {
                    draggableInstance.kill();
                    draggableInstance = null; // Eliminar referencia de la instancia
                }

                gsap.set(draggable, {
                    position: 'relative',
                    top: 'auto',
                    left: 'auto',
                    x: 0,
                    y: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: '5'
                });

                removeBody(draggable);
                monitorClickTime(draggable);
            }

            window.removeEventListener('mouseup', releaseHandler);
            window.removeEventListener('touchend', releaseHandler);
        }
    })[0];
});

function monitorClickTime(element) {
    let startTime, timer;
    let cursorPos = { x: 0, y: 0 };
    let offset = { x: 0, y: 0 }; // Desplazamiento inicial entre el centro del div y el cursor

    const startHandler = (e) => {
        const isTouch = e.type === 'touchstart';
        cursorPos.x = isTouch ? e.touches[0].clientX : e.clientX;
        cursorPos.y = isTouch ? e.touches[0].clientY : e.clientY;

        // Obtener las dimensiones iniciales del elemento
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calcular el desplazamiento entre el centro del div y el cursor
        offset.x = cursorPos.x - centerX;
        offset.y = cursorPos.y - centerY;

        startTime = Date.now();
        timer = setTimeout(() => {
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > 300 && element.classList.contains('hijo-de')) {
                // Cambio de clase a draggable-mut
                element.classList.replace('hijo-de', 'draggable-mut');

                // Mover el div al body para ser draggable de nuevo
                document.body.appendChild(element);

                // Obtener las dimensiones actuales del elemento
                const originalWidth = element.offsetWidth;
                const originalHeight = element.offsetHeight;

                // Centrar respecto al cursor en la posición actual, ajustando el desplazamiento
                gsap.set(element, {
                    position: 'absolute',
                    x: cursorPos.x - originalWidth / 2 + offset.x,
                    y: cursorPos.y - originalHeight / 2 + offset.y
                });

                // Animación de cambio de tamaño con actualización constante de posición
                gsap.to(element, {
                    duration: 0.2,  // Duración del cambio de tamaño
                    width: '200px',  // Ancho original
                    height: '200px',  // Altura original
                    onUpdate: function () {
                        // Mantener el div centrado respecto al cursor durante la transformación de tamaño
                        const newWidth = element.offsetWidth;
                        const newHeight = element.offsetHeight;

                        gsap.set(element, {
                            x: cursorPos.x - newWidth / 2 + offset.x,
                            y: cursorPos.y - newHeight / 2 + offset.y
                        });
                    },
                    onComplete: function () {
                        // Asegurarse de que al final de la animación el div sigue centrado
                        gsap.set(element, {
                            x: cursorPos.x - element.offsetWidth / 2 + offset.x,
                            y: cursorPos.y - element.offsetHeight / 2 + offset.y
                        });

                        // Reactivar Draggable inmediatamente sin requerir un nuevo "click"
                        draggableInstance = Draggable.create(element, {
                            type: 'x,y',
                            zIndexBoost: true,
                            onPress: function (e) {
                                const isTouch = e.type === "touchstart";
                                const cx = isTouch ? e.touches[0].clientX : e.clientX;
                                const cy = isTouch ? e.touches[0].clientY : e.clientY;

                                // Volver a centrar el div en el cursor al iniciar el drag
                                gsap.set(element, {
                                    x: cx - element.offsetWidth / 2 + offset.x,
                                    y: cy - element.offsetHeight / 2 + offset.y
                                });
                            },
                            onDrag: function (e) {
                                const isTouch = e.type === "touchmove";
                                const clientX = isTouch ? e.touches[0].clientX : e.clientX;
                                const clientY = isTouch ? e.touches[0].clientY : e.clientY;

                                // Mover el div con el cursor
                                gsap.set(element, {
                                    x: clientX - element.offsetWidth / 2,
                                    y: clientY - element.offsetHeight / 2
                                });
                            },
                            onRelease: function (e) {
                                const elemRect = element.getBoundingClientRect();
                                const dropZone = Array.from(dropZones).find(zone => {
                                    const zoneRect = zone.getBoundingClientRect();
                                    return isOverlapping(elemRect, zoneRect);
                                });

                                if (dropZone) {
                                    dropZone.appendChild(element);
                                    element.classList.replace('draggable-mut', 'hijo-de');

                                    // Desactivar GSAP Draggable
                                    draggableInstance.kill();
                                    draggableInstance = null;

                                    gsap.set(element, {
                                        position: 'relative',
                                        top: 'auto',
                                        left: 'auto',
                                        x: 0,
                                        y: 0,
                                        width: '100%',
                                        height: '100%',
                                        zIndex: '5'

                                    });

                                    removeBody(element);
                                    monitorClickTime(element);  // Reiniciar el ciclo de click
                                }
                            }
                        })[0];

                        // Iniciar el drag inmediatamente sin esperar otro click
                        draggableInstance.startDrag(e);
                    }
                });

                // Crear un ciclo de actualización para mantener el div centrado mientras cambia de tamaño
                const updatePosition = () => {
                    const newWidth = element.offsetWidth;
                    const newHeight = element.offsetHeight;
                    gsap.set(element, {
                        x: cursorPos.x - newWidth / 2 + offset.x,
                        y: cursorPos.y - newHeight / 2 + offset.y
                    });
                };

                // Bucle constante de actualización hasta que finalice la transformación
                const intervalId = setInterval(updatePosition, 16); // 60 FPS

                setTimeout(() => clearInterval(intervalId), 200); // Parar el bucle tras la animación
            }
        }, 300);
    };

    element.addEventListener('mousedown', startHandler);
    element.addEventListener('touchstart', startHandler);

    const endHandler = () => clearTimeout(timer);
    element.addEventListener('mouseup', endHandler);
    element.addEventListener('touchend', endHandler);
}

function isOverlapping(rect1, rect2) {
    return !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
}

function addBody(element) {
    const elemRect = element.getBoundingClientRect();
    const body = Bodies.rectangle(
        elemRect.left + elemRect.width / 2,
        elemRect.top + elemRect.height / 2,
        elemRect.width,
        elemRect.height,
        {
            restitution: 0.5,
            render: { fillStyle: 'transparent', strokeStyle: 'transparent' }  // Hacer el cuerpo transparente
        }
    );
    draggableMutBodies.set(element, body);
    World.add(world, body);
}

function removeBody(element) {
    const body = draggableMutBodies.get(element);
    if (body) {
        World.remove(world, body);
        draggableMutBodies.delete(element);
    }
}

function update() {
    Engine.update(engine);

    draggableMutBodies.forEach((body, element) => {
        if (!isDragging || body !== currentDraggingBody) {
            const pos = body.position;
            const angle = body.angle;

            element.style.transform = `translate(${pos.x - element.offsetWidth / 2}px, ${pos.y - element.offsetHeight / 2}px) rotate(${angle}rad)`;
        }
    });

    requestAnimationFrame(update);
}

update();







// Redimensionamiento Horizontal
const separador = document.getElementById('separador');
const contenedorIzq = document.getElementById('ct-izq');
const contenedorDrc = document.getElementById('ct-drc');
const contenedoresInferiores = document.querySelector('.contenedores-inferiores');

let isResizing = false;

function iniciarRedimensionamiento(e) {
    isResizing = true;
}

function detenerRedimensionamiento() {
    isResizing = false;
}

function redimensionarHorizontal(e) {
    if (!isResizing) return;

    if (e.type === 'touchmove') {
        e.preventDefault();
    }

    const eventX = e.clientX || (e.touches && e.touches[0].clientX);
    const contenedoresRect = contenedoresInferiores.getBoundingClientRect();
    const mouseX = eventX - contenedoresRect.left;

    const newLeftWidth = (mouseX / contenedoresRect.width) * 100;
    const newRightWidth = 100 - newLeftWidth;

    if (newLeftWidth > 5 && newRightWidth > 5) {
        contenedorIzq.style.width = `${newLeftWidth}%`;
        contenedorDrc.style.width = `${newRightWidth}%`;
    }
}

// Eventos para redimensionamiento
separador.addEventListener('mousedown', iniciarRedimensionamiento);
separador.addEventListener('touchstart', iniciarRedimensionamiento, { passive: false });

window.addEventListener('mousemove', redimensionarHorizontal);
window.addEventListener('touchmove', redimensionarHorizontal, { passive: false });

window.addEventListener('mouseup', detenerRedimensionamiento);
window.addEventListener('touchend', detenerRedimensionamiento);

// Redimensionamiento Vertical
const separadorVertical = document.getElementById('separador-vertical');
const contenedorSup = document.querySelector('.contenedor-superior');
const contenedorInf = document.querySelector('.contenedores-inferiores');
const contenedoresTotal = document.querySelector('.contenedores');

let isResizingVertical = false;

function iniciarRedimensionamientoVertical(e) {
    isResizingVertical = true;
}

function detenerRedimensionamientoVertical() {
    isResizingVertical = false;
}

function redimensionarVertical(e) {
    if (!isResizingVertical) return;

    if (e.type === 'touchmove') {
        e.preventDefault();
    }

    const eventY = e.clientY || (e.touches && e.touches[0].clientY);
    const contenedoresRect2 = contenedoresTotal.getBoundingClientRect();
    const mouseY = eventY - contenedoresRect2.top;

    const newTopHeight = (mouseY / contenedoresRect2.height) * 100;
    const newBottomHeight = 100 - newTopHeight;

    if (newTopHeight > 5 && newBottomHeight > 5) {
        contenedorSup.style.height = `${newTopHeight}%`;
        contenedorInf.style.height = `${newBottomHeight}%`;
    }
}

// Eventos para redimensionamiento vertical
separadorVertical.addEventListener('mousedown', iniciarRedimensionamientoVertical);
separadorVertical.addEventListener('touchstart', iniciarRedimensionamientoVertical, { passive: false });

window.addEventListener('mousemove', redimensionarVertical);
window.addEventListener('touchmove', redimensionarVertical, { passive: false });

window.addEventListener('mouseup', detenerRedimensionamientoVertical);
window.addEventListener('touchend', detenerRedimensionamientoVertical);

// Generación de capas
function generarCapas(contenedor, capas) {
    capas.forEach(({ gradient, rotation, opacity }) => {
        const layer = document.createElement('div');
        layer.classList.add('layer');
        layer.style.backgroundImage = gradient;
        layer.style.transform = `rotate(${rotation})`;
        layer.style.opacity = opacity;
        contenedor.appendChild(layer);
    });
}

const naranjaGradients = [
    { gradient: 'radial-gradient(circle, rgba(0, 255, 255, 1) 53%, transparent 50%)', rotation: '0deg', opacity: '0%' },
    { gradient: 'radial-gradient(circle, rgba(255, 0, 255, 1) 53%, transparent 58%)', rotation: '45deg', opacity: '100%' },
    { gradient: 'radial-gradient(circle, rgba(255, 255, 0, 1) 65%, transparent 60%)', rotation: '0deg', opacity: '100%' },
    { gradient: 'radial-gradient(circle, rgba(0, 0, 0, 1) 50%, transparent 25%)', rotation: '45deg', opacity: '0%' }
];

const azul1Gradients = [
    { gradient: 'radial-gradient(circle, rgba(0, 255, 255, 1) 50%, transparent 50%)', rotation: '0deg', opacity: '100%' },
    { gradient: 'radial-gradient(circle, rgba(255, 0, 255, 1) 9%, transparent 58%)', rotation: '45deg', opacity: '100%' },
    { gradient: 'radial-gradient(circle, rgba(255, 255, 0, 1) 65%, transparent 60%)', rotation: '0deg', opacity: '0%' },
    { gradient: 'radial-gradient(circle, rgba(0, 0, 0, 1) 50%, transparent 25%)', rotation: '45deg', opacity: '0%' }
];

const verdeGradients = [
    { gradient: 'radial-gradient(circle, rgba(0, 255, 255, 1) 80%, transparent 70%)', rotation: '45deg', opacity: '100%' },
    { gradient: 'radial-gradient(circle, rgba(255, 0, 255, 1) 10%, transparent 70%)', rotation: '15deg', opacity: '100%' },
    { gradient: 'radial-gradient(circle, rgba(255, 255, 0, 1) 62%, transparent 60%)', rotation: '75deg', opacity: '100%' },
    { gradient: 'radial-gradient(circle, rgba(0, 0, 0, 1) 50%, transparent 25%)', rotation: '45deg', opacity: '0%' }
];

const naranjaDiv = document.querySelector('.naranja');
generarCapas(naranjaDiv, naranjaGradients);

const azul1Div = document.querySelector('.azul1');
generarCapas(azul1Div, azul1Gradients);

const verdeDiv = document.querySelector('.verde');
generarCapas(verdeDiv, verdeGradients);

function actualizarReglas() {
    const alturaPantalla = window.innerHeight;
    const anchuraPantalla = window.innerWidth;
    const numSubdivisiones = 10;

    const reglaIzquierda = document.getElementById('regla-izquierda');
    const reglaDerecha = document.getElementById('regla-derecha');
    const reglaSuperior = document.getElementById('regla-superior');
    const reglaInferior = document.getElementById('regla-inferior');

    [reglaIzquierda, reglaDerecha, reglaSuperior, reglaInferior].forEach(regla => regla.innerHTML = '');

    function crearSubdivisiones(limite, esVertical) {
        const fragmento = document.createDocumentFragment();
        const paso = limite / numSubdivisiones;

        for (let i = 0; i <= numSubdivisiones; i++) {
            const div = document.createElement('div');
            const texto = document.createElement('span');
            texto.classList.add('texto-regla');
            texto.innerText = Math.round(paso * i) + 'px';

            if (esVertical) {
                div.classList.add('subdivision-vertical');
                div.style.top = `${paso * i}px`;
                texto.style.transform = 'rotate(-90deg)';
                div.appendChild(texto);
            } else {
                div.classList.add('subdivision');
                div.style.left = `${paso * i}px`;
                div.appendChild(texto);
            }

            fragmento.appendChild(div);
        }

        return fragmento;
    }

    reglaIzquierda.appendChild(crearSubdivisiones(alturaPantalla, true));
    reglaDerecha.appendChild(crearSubdivisiones(alturaPantalla, true));
    reglaSuperior.appendChild(crearSubdivisiones(anchuraPantalla, false));
    reglaInferior.appendChild(crearSubdivisiones(anchuraPantalla, false));
}


// Agrega el motor de Matter.js al renderizado
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Crea los cuerpos para cada elemento `draggable-mut`
draggables.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const body = Bodies.rectangle(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect.width,
        rect.height,
        { restitution: 0.9, friction: 0.05 }
    );

    // Vincula cada cuerpo de Matter.js con su elemento
    Body.setAngle(body, 0);
    World.add(world, body);

    // Actualiza la posición de los elementos HTML
    Events.on(engine, 'afterUpdate', () => {
        element.style.left = `${body.position.x - rect.width / 2}px`;
        element.style.top = `${body.position.y - rect.height / 2}px`;
    });
});

// Configura la gravedad según el giroscopio
if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
        const gravityX = event.gamma / 90; // Rango de -1 a 1
        const gravityY = event.beta / 90;  // Rango de -1 a 1
        engine.gravity.x = gravityX;
        engine.gravity.y = gravityY;
    });
} else {
    alert("Tu dispositivo no soporta el giroscopio.");
}

// Define los bordes del área para que los elementos no se salgan del viewport
const boundaries = [
    Bodies.rectangle(window.innerWidth / 2, -10, window.innerWidth, 20, { isStatic: true }), // Borde superior
    Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 10, window.innerWidth, 20, { isStatic: true }), // Borde inferior
    Bodies.rectangle(-10, window.innerHeight / 2, 20, window.innerHeight, { isStatic: true }), // Borde izquierdo
    Bodies.rectangle(window.innerWidth + 10, window.innerHeight / 2, 20, window.innerHeight, { isStatic: true }) // Borde derecho
];
World.add(world, boundaries);




window.addEventListener('load', actualizarReglas);
window.addEventListener('resize', actualizarReglas);