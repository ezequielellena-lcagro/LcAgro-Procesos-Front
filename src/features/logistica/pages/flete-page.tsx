import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/features/auth/auth-context";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { FilterActions, FilterBar, FilterField } from "@/shared/components/filter-bar";
import { fecha } from "../format";
import { referenciaFlota, textoFlotaValido, trimFlota } from "../lib/flota";
import { useFichaFlota, useFlota } from "../queries/use-logistica-flota";
import type { FichaFlotaDto, FiltrosFlota } from "../types";
import { FichaFlotaDialog, type ModoFichaFlota } from "../components/ficha-flota-dialog";
import { HistorialDialog } from "../components/historial-dialog";
import { AvisoDemo } from "../components/aviso-demo";
import { TablaLogistica } from "../components/tabla-logistica";

function LecturaFicha({
  id,
  modo,
  onClose,
  onConflict,
}: {
  id: string;
  modo: ModoFichaFlota;
  onClose: () => void;
  onConflict: () => void;
}) {
  const q = useFichaFlota(id);
  const [fresco, setFresco] = useState<FichaFlotaDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const refetch = q.refetch;
  // Una selección cacheada nunca habilita un comando. Cada apertura exige GET nuevo.
  useEffect(() => {
    let vigente = true;
    void refetch().then((r) => {
      if (!vigente) return;
      if (r.isSuccess) setFresco(structuredClone(r.data));
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [refetch]);
  if (fresco)
    return (
      <FichaFlotaDialog
        dato={fresco}
        modo={fresco.activo ? modo : "detalle"}
        onClose={onClose}
        onConflict={onConflict}
      />
    );
  return (
    <Modal open title="Leer ficha de flota" onClose={onClose}>
      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            setError(null);
            void refetch().then((r) => {
              if (r.isSuccess) setFresco(structuredClone(r.data));
              else setError(r.error);
            });
          }}
        />
      ) : (
        <p role="status" className="text-sm text-ink-soft">
          Consultando la ficha actual…
        </p>
      )}
    </Modal>
  );
}
export function FletePage() {
  const { user } = useAuth();
  const gestionar = user?.roles.includes("logistica-flete") ?? false;
  const [buscar, setBuscar] = useState("");
  const [estado, setEstado] = useState("");
  const [filtros, setFiltros] = useState<FiltrosFlota>({});
  const [filtroInvalido, setFiltroInvalido] = useState(false);
  const [aplicacion, setAplicacion] = useState(0);
  const [crear, setCrear] = useState(false);
  const [lectura, setLectura] = useState<{
    id: string;
    modo: ModoFichaFlota;
    apertura: number;
  } | null>(null);
  const [historia, setHistoria] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const q = useFlota(filtros, aplicacion);
  const abrir = (id: string, modo: ModoFichaFlota) => {
    setConflicto(false);
    setLectura({ id, modo, apertura: Date.now() });
  };
  const ocupado = crear || lectura !== null || historia !== null;
  const editable = gestionar && !q.isFetching && !ocupado;
  return (
    <div className="min-w-0">
      <PageHeader
        title="Flete y camiones"
        subtitle="Conductor, chasis, acoplado y transportista. Referencia manual de la flota."
        actions={
          gestionar && (
            <Button
              disabled={ocupado}
              onClick={() => {
                setConflicto(false);
                setCrear(true);
              }}
            >
              Nueva ficha
            </Button>
          )
        }
      />
      <AvisoDemo />
      <FilterBar
        onSubmit={(e) => {
          e.preventDefault();
          if (buscar !== "" && !textoFlotaValido(buscar, 200)) {
            setFiltroInvalido(true);
            return;
          }
          setFiltroInvalido(false);
          setAplicacion((n) => n + 1);
          setFiltros({
            ...(buscar ? { buscar: trimFlota(buscar) } : {}),
            ...(estado ? { activo: estado === "true" } : {}),
          });
        }}
      >
        <FilterField label="Buscar flota">
          <Input
            className="w-72"
            value={buscar}
            maxLength={200}
            placeholder="Patente, conductor o transportista"
            onChange={(e) => setBuscar(e.target.value)}
          />
        </FilterField>
        <FilterField label="Estado de la ficha">
          <Select
            className="w-40"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </Select>
        </FilterField>
        <FilterActions
          onClear={() => {
            setBuscar("");
            setEstado("");
            setFiltroInvalido(false);
            setAplicacion((n) => n + 1);
            setFiltros({});
          }}
          aviso={
            filtroInvalido && (
              <p role="alert" className="mr-auto text-sm text-rojo">
                Revisá el texto de búsqueda.
              </p>
            )
          }
        />
      </FilterBar>
      {conflicto && (
        <p role="alert" className="mb-4 text-sm text-rojo">
          La ficha cambió. Leímos la versión actual; cerrá el detalle y elegí una nueva operación.
        </p>
      )}
      <TablaLogistica
        titulo="Flete y camiones"
        filas={q.data?.pages.flatMap((p) => p.filas) ?? []}
        clave={(f) => f.id}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        hayMas={q.hasNextPage}
        mas={() => void q.fetchNextPage()}
        cargandoMas={q.isFetchingNextPage}
        vacio={
          Object.keys(filtros).length
            ? "No hay fichas para estos filtros."
            : "Todavía no hay fichas de flota. Registrá la primera ficha."
        }
        columnas={[
          {
            titulo: "Chasis / acoplado",
            celda: (f) => (
              <>
                <span className="font-medium">{f.ficha.patenteChasis}</span>
                <div className="text-xs text-ink-soft">
                  {f.ficha.patenteAcoplado ?? "Sin acoplado"}
                </div>
                {f.patenteChasisRepetida && (
                  <p className="mt-1 text-xs text-clementina-deep">
                    Patente repetida en otra ficha activa
                  </p>
                )}
              </>
            ),
          },
          { titulo: "Conductor", celda: (f) => f.ficha.conductor ?? "Sin conductor" },
          { titulo: "Transportista", celda: (f) => f.ficha.transportista ?? "Sin transportista" },
          {
            titulo: "Importe de referencia",
            numero: true,
            celda: (f) => referenciaFlota(f.ficha.importeReferencia, f.ficha.moneda),
          },
          { titulo: "Vigente desde", celda: (f) => fecha(f.ficha.vigenteDesde) },
          {
            titulo: "Estado",
            celda: (f) => (
              <>
                <span>{f.activo ? "Activa" : "Inactiva"}</span>
                <div className="text-xs text-ink-soft">Rev. {f.revision}</div>
              </>
            ),
          },
          {
            titulo: "Acciones",
            celda: (f) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={ocupado}
                  onClick={() => abrir(f.id, "detalle")}
                >
                  Detalle
                </Button>
                {gestionar && f.activo && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() => abrir(f.id, "editar")}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() => abrir(f.id, "baja")}
                    >
                      Baja
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={ocupado}
                  onClick={() => setHistoria(f.id)}
                >
                  Historial
                </Button>
              </div>
            ),
          },
        ]}
      />
      {crear && (
        <FichaFlotaDialog
          modo="crear"
          onClose={() => setCrear(false)}
          onConflict={() => {
            setCrear(false);
            setConflicto(true);
            void q.refetch();
          }}
        />
      )}
      {lectura && (
        <LecturaFicha
          key={lectura.id + ":" + lectura.apertura}
          id={lectura.id}
          modo={lectura.modo}
          onClose={() => setLectura(null)}
          onConflict={() => {
            setConflicto(true);
            setLectura({ ...lectura, modo: "detalle", apertura: lectura.apertura + 1 });
          }}
        />
      )}
      {historia && (
        <HistorialDialog recurso="flota" id={historia} onClose={() => setHistoria(null)} />
      )}
    </div>
  );
}
