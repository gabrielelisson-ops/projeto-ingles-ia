/**
 * Teste rápido do dia (uns 3 minutos): 5 perguntas sorteadas das aulas já concluídas.
 * O sorteio muda a cada dia. Não altera o desbloqueio; os erros vão para a revisão.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { aulasConcluidas } from '../conteudo/curso';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import { diaLocal, embaralhar, sementeDeTexto } from '../logica/estatisticas';
import { respostaCerta } from '../logica/respostas';
import { Aviso, Botao, Paragrafo, Tela, Titulo } from '../ui/base';
import { SequenciaExercicios } from '../ui/Exercicio';
import { segundosDesde, useInicio } from '../ui/useInicio';

export default function TesteDoDia() {
  const { curso, progresso, db, perfil, nivel } = useApp();
  const [fim, setFim] = useState<number | null>(null);
  const inicio = useInicio();

  // Sorteia só ao abrir a tela (a semente muda a cada dia).
  const [lista] = useState(() => {
    const aulas = aulasConcluidas(curso, progresso.aulasConcluidas);
    const todos = aulas.flatMap((a) => [...a.pratica, ...a.teste]);
    return embaralhar(todos, sementeDeTexto(`${perfil?.id}-${diaLocal(Date.now())}`)).slice(0, 5);
  });

  if (lista.length === 0) {
    return (
      <Tela>
        <Aviso tipo="info" texto="Conclua pelo menos uma aula para liberar o teste rápido do dia." />
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo>⚡ Teste rápido do dia</Titulo>
      {fim == null ? (
        <>
          <Paragrafo suave>{lista.length} perguntas das aulas que você já fez. Leva uns 3 minutos.</Paragrafo>
          <SequenciaExercicios
            lista={lista}
            nivel={nivel}
            onFim={async (rs) => {
              setFim(rs.filter((r) => r.acertou).length);
              if (!perfil) return;
              await repo.registrarAtividade(db, perfil.id, { segundosEstudo: segundosDesde(inicio) });
              await repo.adicionarRevisao(
                db,
                perfil.id,
                rs
                  .filter((r) => !r.acertou)
                  .map((r) => ({ item_id: `x:${r.exercicio.id}`, tipo: 'frase' as const, frente: respostaCerta(r.exercicio), verso: r.exercicio.explicacao_pt ?? '' })),
              );
            }}
          />
        </>
      ) : (
        <>
          <Aviso tipo={fim >= 4 ? 'sucesso' : 'info'} texto={`Você acertou ${fim} de ${lista.length}. ${fim >= 4 ? 'Ótimo!' : 'Os erros foram para a sua revisão.'}`} />
          <Botao titulo="Voltar" onPress={() => router.back()} />
        </>
      )}
    </Tela>
  );
}
