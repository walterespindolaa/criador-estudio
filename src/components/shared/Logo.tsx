type LogoProps = {
  className?: string;
  variant?: "auto" | "light" | "dark";
  icon?: boolean;
};

export function Logo({ className = "h-8 w-auto", variant = "auto", icon = false }: LogoProps) {
  const light = icon ? "/logo-icon.png" : "/logo-cria.png";
  const dark = icon ? "/logo-icon-white.png" : "/logo-cria-white.png";

  if (variant === "light") {
    return <img src={light} alt="cria" className={className} />;
  }
  if (variant === "dark") {
    return <img src={dark} alt="cria" className={className} />;
  }
  return (
    <>
      <img src={light} alt="cria" className={`${className} block dark:hidden`} />
      <img src={dark} alt="cria" className={`${className} hidden dark:block`} />
    </>
  );
}
