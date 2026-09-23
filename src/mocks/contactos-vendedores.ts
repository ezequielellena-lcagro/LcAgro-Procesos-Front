/**
 * Emails de vendedores cargados "en la app" durante la sesión de demo, por código de viajante.
 *
 * Es UN solo store a propósito: en la API real el contacto del vendedor vive en una única tabla que
 * comparten el link de devolución de cuentas corrientes y el seguimiento de acopio. Cargarlo en
 * cualquiera de las dos pantallas lo deja disponible para las dos.
 */
export const CONTACTOS_VENDEDORES: Record<number, string> = {};
