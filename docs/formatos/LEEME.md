# Formatos de origen

Formatos digitales (Word, PDF, Excel o foto) de cada tipo de inspección, a partir de los cuales se construye su formulario.

- Un archivo por tipo, con nombre claro (idealmente con el código del estándar).
- Formatos de **un equipo**: se crea `demo/formatos/<id>.js` (copiar uno existente y cambiar cabecera, ítems, grupos y firmantes) y se agrega al menú `inspecciones.html` con `href: "inspeccion.html?f=<id>"`. El motor común es `inspeccion.html`.
- Formatos con **varios equipos** en una misma inspección (como Grupos Generadores Chacay-Mina) tienen su propia página.
- Cada formulario nuevo se registra en `docs/BITACORA.md`.
