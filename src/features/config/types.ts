export type ConfigTipo = "int" | "decimal" | "bool" | "string";

/** Parámetro configurable (espeja ConfiguracionDto del backend). */
export interface ConfigDto {
  clave: string;
  valor: string;
  tipo: ConfigTipo;
  descripcion: string | null;
}

export interface ActualizarConfigItem {
  clave: string;
  valor: string;
}
