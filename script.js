
"use strict";

/* =========================================
   1. INICIO DE SESIÓN
   Conservamos las claves usuarios y sesion.
========================================= */

const $ = (id) => document.getElementById(id);

function leerDatos(clave, valorInicial) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : valorInicial;
  } catch (error) {
    console.error("No se pudieron leer los datos:", error);
    return valorInicial;
  }
}

function guardarDatos(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    mostrarBanner("No se pudieron guardar los datos. Revisa el almacenamiento del navegador.");
    return false;
  }
}

function mostrarBanner(mensaje) {
  const banner = $("banner-errores");
  banner.textContent = mensaje;
  banner.classList.remove("oculto");
}

function ocultarBanner() {
  $("banner-errores").classList.add("oculto");
}

let usuarios = leerDatos("usuarios", {});
let usuarioActual = null;

function mostrarApp(nombre) {
  usuarioActual = nombre;
  localStorage.setItem("sesion", nombre);

  $("nombre-actual").textContent = nombre;
  $("login").classList.add("oculto");
  $("app").classList.remove("oculto");
  $("mensaje-error").textContent = "";
  $("clave").value = "";

  ocultarBanner();
  mostrarSubtitulosGuardados();
  dibujarTodo();
  cambiarSeccion("subtitulos");
}

function crearCuenta() {
  const nombre = $("usuario").value.trim();
  const clave = $("clave").value;
  const mensaje = $("mensaje-error");

  if (!nombre || !clave) {
    mensaje.textContent = "Escribe tu nombre y una contraseña.";
    return;
  }

  if (clave.length < 4) {
    mensaje.textContent = "La contraseña debe tener al menos 4 caracteres.";
    return;
  }

  if (Object.prototype.hasOwnProperty.call(usuarios, nombre)) {
    mensaje.textContent = "Ese nombre ya existe. Intenta entrar con tu cuenta.";
    return;
  }

  usuarios[nombre] = clave;

  if (guardarDatos("usuarios", usuarios)) {
    mostrarApp(nombre);
  }
}

function intentarEntrar() {
  const nombre = $("usuario").value.trim();
  const clave = $("clave").value;
  const mensaje = $("mensaje-error");

  if (!nombre || !clave) {
    mensaje.textContent = "Escribe tu nombre y contraseña.";
  } else if (!Object.prototype.hasOwnProperty.call(usuarios, nombre)) {
    mensaje.textContent = "Esa cuenta no existe. Pulsa Crear cuenta.";
  } else if (usuarios[nombre] !== clave) {
    mensaje.textContent = "La contraseña no es correcta.";
  } else {
    mostrarApp(nombre);
  }
}

$("btn-entrar").addEventListener("click", intentarEntrar);
$("btn-crear").addEventListener("click", crearCuenta);

$("clave").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") intentarEntrar();
});

$("usuario").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") intentarEntrar();
});

$("btn-salir").addEventListener("click", () => {
  detenerReconocimiento(false);
  localStorage.removeItem("sesion");
  usuarioActual = null;
  $("app").classList.add("oculto");
  $("login").classList.remove("oculto");
});

function cambiarSeccion(id) {
  document.querySelectorAll(".pantalla").forEach((pantalla) => {
    pantalla.classList.toggle("oculto", pantalla.id !== id);
  });

  document.querySelectorAll("nav button[data-seccion]").forEach((boton) => {
    boton.setAttribute(
      "aria-current",
      boton.dataset.seccion === id ? "page" : "false"
    );
  });

  if (id === "calendario") dibujarTodo();
}

document.querySelectorAll("nav button[data-seccion]").forEach((boton) => {
  boton.addEventListener("click", () => cambiarSeccion(boton.dataset.seccion));
});


/* =========================================
   2. SUBTÍTULOS EN VIVO
========================================= */

const APIReconocimiento =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let reconocimiento = null;
let escuchando = false;
let textoFinal = "";
let provisionalActual = "";
let reinicioProgramado = null;

const TEXTO_INICIAL = "Aquí aparecerá lo que se escuche...";

function estadoSubtitulos(mensaje) {
  $("estado").textContent = mensaje;
}

function mostrarBotonEscuchar() {
  $("btn-escuchar").classList.remove("oculto");
  $("btn-parar").classList.add("oculto");
}

function mostrarBotonParar() {
  $("btn-escuchar").classList.add("oculto");
  $("btn-parar").classList.remove("oculto");
}

function detenerReconocimiento(mostrarMensaje = true) {
  escuchando = false;

  if (reinicioProgramado) {
    clearTimeout(reinicioProgramado);
    reinicioProgramado = null;
  }

  if (reconocimiento) {
    // Quitamos onend antes de detener para evitar que se reinicie solo.
    reconocimiento.onend = null;

    try {
      reconocimiento.stop();
    } catch (error) {
      // Puede que el navegador ya lo haya detenido.
    }
  }

  reconocimiento = null;
  mostrarBotonEscuchar();

  if (mostrarMensaje) {
    estadoSubtitulos("Reconocimiento detenido. Puedes volver a empezar cuando quieras.");
  }
}

function iniciarReconocimiento() {
  if (!escuchando) return;

  if (!APIReconocimiento) {
    escuchando = false;
    mostrarBotonEscuchar();
    estadoSubtitulos(
      "Tu navegador no admite el reconocimiento de voz. Prueba con Google Chrome o Microsoft Edge actualizados."
    );
    return;
  }

  try {
    const nuevo = new APIReconocimiento();
    reconocimiento = nuevo;

    nuevo.lang = "es-CO";
    nuevo.continuous = true;
    nuevo.interimResults = true;
    nuevo.maxAlternatives = 1;

    nuevo.onstart = () => {
      estadoSubtitulos("🟢 Micrófono activo. Habla cerca del micrófono.");
    };

    nuevo.onresult = (evento) => {
      let provisional = "";

      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        const frase = resultado[0].transcript;

        if (resultado.isFinal) {
          textoFinal += frase.trim() + " ";
        } else {
          provisional += frase;
        }
      }

      provisionalActual = provisional;
      const texto = (textoFinal + provisionalActual).trim();

      $("caja-subtitulos").textContent = texto || TEXTO_INICIAL;
    };

    nuevo.onerror = (evento) => {
      const mensajes = {
        "not-allowed":
          "El permiso del micrófono está bloqueado. Permítelo en los ajustes del sitio y vuelve a intentarlo.",
        "service-not-allowed":
          "El navegador no permite usar el servicio de reconocimiento de voz.",
        "audio-capture":
          "No se encontró un micrófono disponible. Revisa que esté conectado.",
        "network":
          "El reconocimiento de voz tuvo un problema de conexión. Comprueba internet.",
        "no-speech":
          "No se detectó voz. Comprueba el micrófono y vuelve a hablar.",
        "aborted":
          "El reconocimiento se ha detenido."
      };

      estadoSubtitulos(
        mensajes[evento.error] ||
        "Ocurrió un problema con el reconocimiento de voz: " + evento.error
      );

      // Estos errores requieren que la persona pulse de nuevo el botón.
      if (
        evento.error === "not-allowed" ||
        evento.error === "service-not-allowed" ||
        evento.error === "audio-capture"
      ) {
        escuchando = false;
        mostrarBotonEscuchar();
      }
    };

    nuevo.onend = () => {
      if (!escuchando || reconocimiento !== nuevo) return;

      // Algunos navegadores finalizan la escucha después de una pausa.
      // Creamos una instancia nueva en vez de volver a usar la anterior.
      reinicioProgramado = setTimeout(() => {
        reinicioProgramado = null;
        if (escuchando) iniciarReconocimiento();
      }, 400);
    };

    nuevo.start();
    mostrarBotonParar();
  } catch (error) {
    escuchando = false;
    reconocimiento = null;
    mostrarBotonEscuchar();
    estadoSubtitulos(
      "No se pudo iniciar el reconocimiento. Comprueba el navegador y el permiso del micrófono, y vuelve a intentarlo."
    );
    console.error("Error al iniciar reconocimiento:", error);
  }
}

$("btn-escuchar").addEventListener("click", () => {
  if (escuchando) return;

  if (!APIReconocimiento) {
    estadoSubtitulos(
      "Este navegador no admite subtítulos por voz. Prueba con Chrome o Edge actualizados."
    );
    return;
  }

  if (!window.isSecureContext) {
    estadoSubtitulos(
      "Abre la app con Live Server en VS Code o desde una dirección segura. No abras index.html directamente para probar el micrófono."
    );
    return;
  }

  textoFinal = "";
  provisionalActual = "";
  $("caja-subtitulos").textContent = TEXTO_INICIAL;
  escuchando = true;
  estadoSubtitulos("Solicitando acceso al reconocimiento de voz...");
  iniciarReconocimiento();
});

$("btn-parar").addEventListener("click", () => {
  detenerReconocimiento(true);
});

$("btn-limpiar").addEventListener("click", () => {
  textoFinal = "";
  provisionalActual = "";
  $("caja-subtitulos").textContent = TEXTO_INICIAL;
  estadoSubtitulos("Texto limpiado. Puedes volver a escuchar.");
});

let subtitulosGuardados = leerDatos("subtitulosGuardados", []);

function mostrarSubtitulosGuardados() {
  const lista = $("lista-guardados");
  lista.replaceChildren();

  if (!subtitulosGuardados.length) {
    const li = document.createElement("li");
    li.className = "vacio";
    li.textContent = "Todavía no has guardado subtítulos.";
    lista.appendChild(li);
    return;
  }

  subtitulosGuardados.forEach((item) => {
    const li = document.createElement("li");

    const fecha = document.createElement("small");
    fecha.textContent = item.fecha;

    const texto = document.createElement("p");
    texto.className = "texto-guardado";
    texto.textContent = item.texto;

    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "btn-borrar";
    borrar.textContent = "🗑 Borrar";
    borrar.addEventListener("click", () => {
      subtitulosGuardados = subtitulosGuardados.filter(
        (otro) => otro.id !== item.id
      );
      guardarDatos("subtitulosGuardados", subtitulosGuardados);
      mostrarSubtitulosGuardados();
    });

    li.append(fecha, texto, borrar);
    lista.appendChild(li);
  });
}

$("btn-guardar").addEventListener("click", () => {
  const texto = $("caja-subtitulos").textContent.trim();

  if (!texto || texto === TEXTO_INICIAL) {
    estadoSubtitulos("Todavía no hay texto para guardar.");
    return;
  }

  subtitulosGuardados.unshift({
    id: crearId(),
    fecha: new Date().toLocaleString("es-CO"),
    texto
  });

  if (guardarDatos("subtitulosGuardados", subtitulosGuardados)) {
    mostrarSubtitulosGuardados();
    estadoSubtitulos("Subtítulo guardado correctamente.");
  }
});

$("btn-descargar").addEventListener("click", () => {
  if (!subtitulosGuardados.length) {
    estadoSubtitulos("No hay subtítulos guardados para descargar.");
    return;
  }

  const contenido = subtitulosGuardados.map((item) =>
    "[" + item.fecha + "]\n" + item.texto
  ).join("\n\n");

  const archivo = new Blob([contenido], {
    type: "text/plain;charset=utf-8"
  });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = "mis-subtitulos.txt";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});


/* =========================================
   3. CALENDARIO Y RECORDATORIOS
========================================= */

let eventos = leerDatos("eventosCalendario", []);

let fechaSeleccionada = fechaLocal(new Date());
let mesVisible = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const nombresMes = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const nombresDias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function crearId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function dos(numero) {
  return String(numero).padStart(2, "0");
}

function fechaLocal(fecha) {
  return fecha.getFullYear() + "-" +
    dos(fecha.getMonth() + 1) + "-" + dos(fecha.getDate());
}

function fechaDesdeTexto(texto) {
  const partes = texto.split("-").map(Number);
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

function sumarDias(texto, cantidad) {
  const fecha = fechaDesdeTexto(texto);
  fecha.setDate(fecha.getDate() + cantidad);
  return fechaLocal(fecha);
}

function diasHasta(texto) {
  const hoy = fechaDesdeTexto(fechaLocal(new Date()));
  const fecha = fechaDesdeTexto(texto);
  return Math.round((fecha - hoy) / 86400000);
}

function fechaBonita(texto, anio = false) {
  return fechaDesdeTexto(texto).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(anio ? { year: "numeric" } : {})
  });
}

function nombreTipo(tipo) {
  return tipo === "pilas" ? "🔋 Cambio de pilas" : "🩺 Cita médica";
}

function guardarEventos() {
  return guardarDatos("eventosCalendario", eventos);
}

function dibujarTodo() {
  dibujarMes();
  dibujarEventosDelDia();
  dibujarListaCompleta();
  dibujarAvisos();
  dibujarUltimoCambio();
}

function dibujarMes() {
  const rejilla = $("rejilla-mes");
  rejilla.replaceChildren();

  $("mes-titulo").textContent =
    nombresMes[mesVisible.getMonth()] + " " + mesVisible.getFullYear();

  nombresDias.forEach((nombre) => {
    const encabezado = document.createElement("div");
    encabezado.className = "dia-semana";
    encabezado.textContent = nombre;
    rejilla.appendChild(encabezado);
  });

  const primerDia = new Date(
    mesVisible.getFullYear(),
    mesVisible.getMonth(),
    1
  );

  // La semana empieza el lunes.
  const espacios = (primerDia.getDay() + 6) % 7;
  const totalDias = new Date(
    mesVisible.getFullYear(),
    mesVisible.getMonth() + 1,
    0
  ).getDate();

  for (let i = 0; i < espacios; i++) {
    const vacio = document.createElement("div");
    vacio.className = "dia-vacio";
    vacio.setAttribute("aria-hidden", "true");
    rejilla.appendChild(vacio);
  }

  for (let numero = 1; numero <= totalDias; numero++) {
    const fecha =
      mesVisible.getFullYear() + "-" +
      dos(mesVisible.getMonth() + 1) + "-" + dos(numero);

    const eventosDia = eventos.filter((evento) => evento.fecha === fecha);
    const hayCita = eventosDia.some((evento) => evento.tipo === "cita");
    const hayPilas = eventosDia.some((evento) => evento.tipo === "pilas");
    const hayHecho = eventosDia.some((evento) => evento.hecho);

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "dia";

    if (hayCita) boton.classList.add("con-cita");
    if (hayPilas) boton.classList.add("con-pilas");
    if (hayHecho) boton.classList.add("con-hecho");
    if (fecha === fechaLocal(new Date())) boton.classList.add("hoy");
    if (fecha === fechaSeleccionada) boton.classList.add("elegido");

    boton.setAttribute(
      "aria-label",
      fechaBonita(fecha, true) +
      (hayCita ? ", hay cita" : "") +
      (hayPilas ? ", hay cambio de pilas" : "") +
      (hayHecho ? ", hay un evento realizado" : "")
    );

    const numeroSpan = document.createElement("span");
    numeroSpan.className = "dia-numero";
    numeroSpan.textContent = numero;

    const marcas = document.createElement("span");
    marcas.className = "marcas";
    const simbolos = [];

    if (hayCita) simbolos.push("🩺");
    if (hayPilas) simbolos.push("🔋");
    if (hayHecho) simbolos.push("✔");

    marcas.textContent = simbolos.join(" ");

    boton.append(numeroSpan, marcas);

    boton.addEventListener("click", () => {
      fechaSeleccionada = fecha;
      $("ev-fecha").value = fecha;
      dibujarMes();
      dibujarEventosDelDia();
    });

    rejilla.appendChild(boton);
  }
}

function crearTarjetaEvento(evento, incluirFecha) {
  const li = document.createElement("li");
  li.className = "evento " + evento.tipo + (evento.hecho ? " hecho" : "");

  const detalleFecha = document.createElement("small");
  detalleFecha.textContent =
    (incluirFecha ? fechaBonita(evento.fecha, true) + " · " : "") +
    (evento.hora || "Sin hora indicada") + " · " +
    (evento.hecho ? "✔ Ya realizado" : "Pendiente");

  const titulo = document.createElement("strong");
  titulo.textContent = nombreTipo(evento.tipo) +
    (evento.nota ? ": " + evento.nota : "");

  li.append(detalleFecha, titulo);

  if (evento.tipo === "pilas" && Number(evento.repetir) > 0 && !evento.hecho) {
    const repetir = document.createElement("small");
    repetir.textContent =
      "🔁 Al marcarlo como hecho, se creará otro recordatorio en " +
      evento.repetir + " días.";
    li.appendChild(repetir);
  }

  const acciones = document.createElement("div");
  acciones.className = "acciones";

  if (!evento.hecho) {
    const hecho = document.createElement("button");
    hecho.type = "button";
    hecho.textContent = "✔ Marcar como hecho";
    hecho.addEventListener("click", () => marcarEventoHecho(evento.id));
    acciones.appendChild(hecho);
  }

  const borrar = document.createElement("button");
  borrar.type = "button";
  borrar.className = "btn-borrar";
  borrar.textContent = "🗑 Borrar";
  borrar.addEventListener("click", () => {
    if (!confirm("¿Quieres borrar este recordatorio?")) return;

    eventos = eventos.filter((otro) => otro.id !== evento.id);
    guardarEventos();
    dibujarTodo();
  });

  acciones.appendChild(borrar);
  li.appendChild(acciones);
  return li;
}

function dibujarEventosDelDia() {
  $("titulo-dia").textContent =
    "Eventos del " + fechaBonita(fechaSeleccionada, true);

  const lista = $("lista-dia");
  lista.replaceChildren();

  const delDia = eventos
    .filter((evento) => evento.fecha === fechaSeleccionada)
    .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  if (!delDia.length) {
    const li = document.createElement("li");
    li.className = "vacio";
    li.textContent = "No hay eventos en este día. Puedes agregar uno abajo.";
    lista.appendChild(li);
    return;
  }

  delDia.forEach((evento) => {
    lista.appendChild(crearTarjetaEvento(evento, false));
  });
}

function dibujarListaCompleta() {
  const lista = $("lista-eventos");
  lista.replaceChildren();

  if (!eventos.length) {
    const li = document.createElement("li");
    li.className = "vacio";
    li.textContent = "Todavía no tienes recordatorios guardados.";
    lista.appendChild(li);
    return;
  }

  const ordenados = eventos.slice().sort((a, b) =>
    (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || ""))
  );

  ordenados.forEach((evento) => {
    lista.appendChild(crearTarjetaEvento(evento, true));
  });
}

function dibujarAvisos() {
  const avisos = $("avisos");
  avisos.replaceChildren();

  const pendientes = eventos
    .filter((evento) => !evento.hecho && diasHasta(evento.fecha) <= 1)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  pendientes.forEach((evento) => {
    const aviso = document.createElement("div");
    aviso.className = "aviso";

    const diferencia = diasHasta(evento.fecha);
    let cuando;

    if (diferencia < 0) {
      cuando = "⚠ Vencido hace " + Math.abs(diferencia) + " día(s)";
    } else if (diferencia === 0) {
      cuando = "⚠ Es para hoy";
    } else {
      cuando = "⚠ Es para mañana";
    }

    aviso.textContent = cuando + ": " + nombreTipo(evento.tipo) +
      (evento.nota ? " — " + evento.nota : "");

    avisos.appendChild(aviso);
  });
}

function dibujarUltimoCambio() {
  const cambios = eventos
    .filter((evento) => evento.tipo === "pilas" && evento.hecho)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  $("ultima-pila").textContent = cambios.length
    ? "Último cambio de pilas marcado como realizado: " +
      fechaBonita(cambios[0].fecha, true) +
      (cambios[0].nota ? " — " + cambios[0].nota : "") + "."
    : "Todavía no has registrado un cambio de pilas como realizado.";
}

function marcarEventoHecho(id) {
  const evento = eventos.find((otro) => otro.id === id);
  if (!evento) return;

  evento.hecho = true;

  // Si es un cambio de pilas con repetición, programa el siguiente.
  if (evento.tipo === "pilas" && Number(evento.repetir) > 0) {
    eventos.push({
      id: crearId(),
      tipo: "pilas",
      nota: evento.nota,
      fecha: sumarDias(fechaLocal(new Date()), Number(evento.repetir)),
      hora: evento.hora || "",
      repetir: Number(evento.repetir),
      hecho: false
    });
  }

  guardarEventos();
  dibujarTodo();
}

$("ev-tipo").addEventListener("change", () => {
  $("bloque-repetir").classList.toggle(
    "oculto",
    $("ev-tipo").value !== "pilas"
  );
});

$("form-evento").addEventListener("submit", (evento) => {
  evento.preventDefault();

  const tipo = $("ev-tipo").value;
  const fecha = $("ev-fecha").value;
  const repetir = tipo === "pilas" ? Number($("ev-repetir").value) || 0 : 0;

  if (!fecha) {
    $("ev-error").textContent = "Elige una fecha para el recordatorio.";
    return;
  }

  if (repetir < 0 || repetir > 365) {
    $("ev-error").textContent = "La repetición debe ser de 0 a 365 días.";
    return;
  }

  eventos.push({
    id: crearId(),
    tipo,
    nota: $("ev-nota").value.trim(),
    fecha,
    hora: $("ev-hora").value,
    repetir,
    hecho: $("ev-hecho").checked
  });

  if (!guardarEventos()) return;

  fechaSeleccionada = fecha;
  const fechaElegida = fechaDesdeTexto(fecha);
  mesVisible = new Date(
    fechaElegida.getFullYear(),
    fechaElegida.getMonth(),
    1
  );

  $("ev-nota").value = "";
  $("ev-hora").value = "";
  $("ev-hecho").checked = false;
  $("ev-error").textContent = "";

  dibujarTodo();
});

$("mes-anterior").addEventListener("click", () => {
  mesVisible = new Date(
    mesVisible.getFullYear(),
    mesVisible.getMonth() - 1,
    1
  );
  dibujarMes();
});

$("mes-siguiente").addEventListener("click", () => {
  mesVisible = new Date(
    mesVisible.getFullYear(),
    mesVisible.getMonth() + 1,
    1
  );
  dibujarMes();
});


/* =========================================
   4. ARRANQUE DE LA APP
========================================= */

$("ev-fecha").value = fechaSeleccionada;
$("bloque-repetir").classList.toggle(
  "oculto",
  $("ev-tipo").value !== "pilas"
);

mostrarSubtitulosGuardados();

const sesionGuardada = localStorage.getItem("sesion");

if (
  sesionGuardada &&
  Object.prototype.hasOwnProperty.call(usuarios, sesionGuardada)
) {
  mostrarApp(sesionGuardada);
} else {
  $("login").classList.remove("oculto");
  $("app").classList.add("oculto");
}
