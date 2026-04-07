import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Supabase auth
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-card items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="max-w-md"
        >
          <h2 className="text-4xl font-display font-bold text-foreground mb-4">
            Bem-vindo de volta, criador. ✨
          </h2>
          <p className="text-muted-foreground font-body text-lg leading-relaxed">
            Suas ideias estão te esperando. Continue de onde parou.
          </p>
        </motion.div>
      </div>

      {/* Right - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <Link to="/" className="text-2xl font-display font-bold text-foreground mb-8 block">
            Criadores
          </Link>
          <h3 className="text-2xl font-display font-semibold text-foreground mb-2">Entrar</h3>
          <p className="text-muted-foreground font-body mb-8">Acesse seu estúdio criativo</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-body">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full">
              Entrar
            </Button>
          </form>

          <p className="text-sm text-muted-foreground font-body mt-6 text-center">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
