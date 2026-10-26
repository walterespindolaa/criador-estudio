-- Card do parceiro (26/10/2026): o carrossel guarda a capa no gancho (hook) e
-- os slides 2 em diante + o CTA final na coluna cta ("Conteúdo dos slides" no
-- Criando). parceiro_abrir_card não devolvia a cta, então o designer via só a
-- capa. Acrescenta 'cta' ao JSON sem reescrever a função à mão: o banco diverge
-- do repo nessa função, então a troca é feita em cima da definição VIVA.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.parceiro_abrir_card(uuid)'::regprocedure);
  if position('''cta''' in d) = 0 then
    if position('''roteiro'', _p.script,' in d) = 0 then
      raise exception 'parceiro_abrir_card mudou: não achei o trecho do roteiro';
    end if;
    d := replace(d, '''roteiro'', _p.script,', '''roteiro'', _p.script,' || chr(10) || '    ''cta'', _p.cta,');
    execute d;
  end if;
end $$;
