import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";
import { toAppError } from "@/lib/api-error";
import logoMark from "@/assets/brand/logo-mark.png";
import { useAuth } from "../auth-context";

const schema = z.object({
  email: z.email("Email inválido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});
type Values = z.infer<typeof schema>;

interface LocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? "/";

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Si ya hay sesión, no mostramos el login.
  if (status === "authenticated") return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      const e = toAppError(err);
      toast.error(e.status === 401 ? "Email o contraseña incorrectos." : e.message);
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-brand via-slate-2 to-slate-3 p-6">
      <div className="w-full max-w-sm rounded-card border border-line/20 bg-panel p-8 shadow-float">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logoMark} alt="La Clementina" className="mb-3 size-14 rounded-card" />
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">LcAgro</h1>
          <p className="mt-1 text-sm text-ink-soft">Plataforma de Procesos · La Clementina</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="usuario@lcagro.com"
              autoFocus
              {...form.register("email")}
            />
            {errors.email && <p className="text-xs text-rojo">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...form.register("password")}
            />
            {errors.password && <p className="text-xs text-rojo">{errors.password.message}</p>}
          </div>

          <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando…" : "Iniciar sesión"}
          </Button>
        </form>

        {env.useMocks && (
          <p className="mt-5 rounded-md bg-verde-bg px-3 py-2 text-center text-xs text-verde">
            Modo demo (mocks). Probá: <b>admin@lcagro.local</b> · <b>operador@lcagro.local</b> ·{" "}
            <b>cobranzas@lcagro.local</b> · <b>lectura@lcagro.local</b> — clave: cualquiera.
          </p>
        )}
      </div>
    </div>
  );
}
