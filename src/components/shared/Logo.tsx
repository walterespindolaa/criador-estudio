type LogoProps = {
  className?: string;
  variant?: "auto" | "light" | "dark";
};

export function Logo({ className = "h-8 w-auto", variant = "auto" }: LogoProps) {
  if (variant === "light") {
    return <img src="/logo-cria.png" alt="cria" className={className} />;
  }
  if (variant === "dark") {
    return <img src="/logo-cria-white.png" alt="cria" className={className} />;
  }
  return (
    <>
      <img src="/logo-cria.png" alt="cria" className={`${className} block dark:hidden`} />
      <img src="/logo-cria-white.png" alt="cria" className={`${className} hidden dark:block`} />
    </>
  );
}
