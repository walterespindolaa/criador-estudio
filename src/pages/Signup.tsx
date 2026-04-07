import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = (e: React.FormEvent) => {
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
            Sua jornada criativa começa aqui. 🚀
          </h2>
          <p className="text-muted-foreground font-body text-lg leading-relaxed">
            Chega de improvisar. Organize suas ideias, crie com consistência e apareça pro mundo.
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
          <h3 className="text-2xl font-display font-semibold text-foreground mb-2">Criar conta</h3>
          <p className="text-muted-foreground font-body mb-8">Comece a organizar seu conteúdo hoje</p>

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-body">Seu nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Como quer ser chamado?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
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
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full">
              Criar minha conta
            </Button>
          </form>

          <p className="text-sm text-muted-foreground font-body mt-6 text-center">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
