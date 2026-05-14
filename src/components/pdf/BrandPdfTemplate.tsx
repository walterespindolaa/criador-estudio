import { forwardRef } from "react";

interface MoodboardEntryLike {
  section: string;
  question_key: string;
  answer: string | null;
}

interface PillarLike {
  name: string;
  color: string;
}

interface BrandPdfProps {
  profile: any;
  brandItems: any[];
  persona: any;
  pillars?: PillarLike[];
  moodboardEntries?: MoodboardEntryLike[];
}

const TOM_QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "estilo", label: "Estilo de comunicação" },
  { key: "palavras", label: "Palavras / expressões frequentes" },
  { key: "evitar", label: "O que evita" },
  { key: "referencias", label: "Referências de tom" },
  { key: "emocao", label: "Emoção que desperta" },
];

const EDITORIAL_QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "ideia-central", label: "Ideia central" },
  { key: "temas", label: "Temas" },
  { key: "transformacao", label: "Transformação que promove" },
  { key: "tipos-conteudo", label: "Tipos de conteúdo" },
  { key: "lema", label: "Lema / frase-guia" },
];

export const BrandPdfTemplate = forwardRef<HTMLDivElement, BrandPdfProps>(
  ({ profile, brandItems, persona, pillars = [], moodboardEntries = [] }, ref) => {
    const tom = brandItems.find(b => b.type === "tom")?.name;
    const arquetipo = brandItems.find(b => b.type === "arquetipo")?.name;
    const expressoes = brandItems.filter(b => b.type === "expressao").map(b => b.name);
    const evitar = brandItems.filter(b => b.type === "evitar").map(b => b.name);
    const cores = brandItems.filter(b => b.type === "cor");
    const fontes = brandItems.filter(b => b.type === "fonte");

    const tomAnswers = TOM_QUESTIONS
      .map(q => ({
        ...q,
        value: moodboardEntries.find(e => e.section === "tom-de-voz" && e.question_key === q.key)?.answer || "",
      }))
      .filter(q => q.value.trim().length > 0);

    const editorialAnswers = EDITORIAL_QUESTIONS
      .map(q => ({
        ...q,
        value: moodboardEntries.find(e => e.section === "linha-editorial" && e.question_key === q.key)?.answer || "",
      }))
      .filter(q => q.value.trim().length > 0);

    const sectionTitle: React.CSSProperties = {
      fontSize: 10,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: "#888",
      marginBottom: 12,
    };

    const blockTitle: React.CSSProperties = {
      fontSize: 16,
      fontWeight: 700,
      color: "#1a1a1a",
      margin: "32px 0 16px",
      borderBottom: "1px solid #e5e5e5",
      paddingBottom: 6,
    };

    return (
      <div ref={ref} style={{ width: 794, fontFamily: "Inter, sans-serif", background: "#fff", color: "#1a1a1a" }}>
        <div style={{ width: 794, padding: 64, boxSizing: "border-box" }}>
          {/* Header */}
          <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: 24, marginBottom: 32 }}>
            <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#666", marginBottom: 8 }}>
              {profile?.niche || "Creator de Conteúdo"}
            </p>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
              {profile?.name || "Brandbook"}
            </h1>
            <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
              Identidade de Marca · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Metadados topo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 8 }}>
            <div>
              <h3 style={sectionTitle}>Plataformas</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(profile?.platforms || []).map((p: string) => (
                  <span key={p} style={{ padding: "4px 12px", border: "1px solid #1a1a1a", borderRadius: 100, fontSize: 12 }}>
                    {p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : p === "youtube" ? "YouTube" : p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 style={sectionTitle}>Meta Semanal</h3>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{profile?.weekly_goal || 3} posts/semana</p>
            </div>
          </div>

          {/* Pilares */}
          {pillars.length > 0 && (
            <div>
              <h2 style={blockTitle}>Pilares</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {pillars.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid #e5e5e5", borderRadius: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, background: p.color || "#999", flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tom de Voz */}
          {(tom || arquetipo || expressoes.length > 0 || evitar.length > 0 || tomAnswers.length > 0) && (
            <div>
              <h2 style={blockTitle}>Tom de Voz</h2>
              {tom && (
                <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", margin: "0 0 12px" }}>{tom}</p>
              )}
              {arquetipo && (
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 16px" }}>
                  <span style={{ color: "#888" }}>Arquétipo: </span>{arquetipo}
                </p>
              )}
              {tomAnswers.map(q => (
                <div key={q.key} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{q.label}</p>
                  <p style={{ fontSize: 13, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{q.value}</p>
                </div>
              ))}
              {expressoes.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Expressões que usa</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {expressoes.map((e, i) => (
                      <span key={i} style={{ padding: "3px 10px", background: "#f5f5f5", borderRadius: 4, fontSize: 12 }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
              {evitar.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Evitar</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {evitar.map((e, i) => (
                      <span key={i} style={{ padding: "3px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 4, fontSize: 12 }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Linha Editorial */}
          {editorialAnswers.length > 0 && (
            <div>
              <h2 style={blockTitle}>Linha Editorial</h2>
              {editorialAnswers.map(q => (
                <div key={q.key} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{q.label}</p>
                  <p style={{ fontSize: 13, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{q.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Persona */}
          {persona && (persona.name || persona.age_range || persona.location || persona.pain_points?.length || persona.desires?.length || persona.interests?.length) && (
            <div>
              <h2 style={blockTitle}>Persona</h2>
              <div style={{ background: "#f9f9f9", padding: 20, borderRadius: 8 }}>
                <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 8px" }}>{persona.name || "Persona principal"}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {persona.age_range && (
                    <div>
                      <p style={{ fontSize: 10, color: "#888", margin: 0 }}>Faixa etária</p>
                      <p style={{ fontSize: 12, color: "#1a1a1a", margin: 0 }}>{persona.age_range}</p>
                    </div>
                  )}
                  {persona.gender && (
                    <div>
                      <p style={{ fontSize: 10, color: "#888", margin: 0 }}>Gênero</p>
                      <p style={{ fontSize: 12, color: "#1a1a1a", margin: 0 }}>{persona.gender}</p>
                    </div>
                  )}
                  {persona.location && (
                    <div>
                      <p style={{ fontSize: 10, color: "#888", margin: 0 }}>Localização</p>
                      <p style={{ fontSize: 12, color: "#1a1a1a", margin: 0 }}>{persona.location}</p>
                    </div>
                  )}
                </div>
                {persona.pain_points?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Principais dores</p>
                    {persona.pain_points.map((d: string, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: "#333", paddingLeft: 12, margin: "2px 0" }}>· {d}</p>
                    ))}
                  </div>
                )}
                {persona.desires?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Desejos</p>
                    {persona.desires.map((d: string, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: "#333", paddingLeft: 12, margin: "2px 0" }}>· {d}</p>
                    ))}
                  </div>
                )}
                {persona.interests?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Interesses</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {persona.interests.map((d: string, i: number) => (
                        <span key={i} style={{ padding: "3px 10px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 100, fontSize: 11 }}>{d}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Identidade Visual */}
          {(cores.length > 0 || fontes.length > 0) && (
            <div>
              <h2 style={blockTitle}>Identidade Visual</h2>
              {cores.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Paleta de cores</p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {cores.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid #e5e5e5", borderRadius: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 4, background: c.value || "#ddd", border: "1px solid #e5e5e5" }} />
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{c.name}</p>
                          {c.value && <p style={{ fontSize: 10, color: "#888", margin: 0 }}>{c.value}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fontes.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Tipografia</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {fontes.map((f, i) => (
                      <span key={i} style={{ padding: "6px 14px", border: "1px solid #1a1a1a", borderRadius: 6, fontSize: 13 }}>{f.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 48, borderTop: "1px solid #eee", paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 10, color: "#bbb", margin: 0 }}>Criado com CreatorsFlow</p>
            <p style={{ fontSize: 10, color: "#bbb", margin: 0 }}>{new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>
    );
  }
);
BrandPdfTemplate.displayName = "BrandPdfTemplate";
