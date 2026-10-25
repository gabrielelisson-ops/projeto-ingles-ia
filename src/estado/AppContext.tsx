/**
 * Estado global do app: perfil ativo, preferências, chave da IA e progresso.
 * As telas leem daqui com useApp().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { curso, estruturaDoCurso, type Curso } from '../conteudo/curso';
import { NIVEIS, type Nivel } from '../conteudo/schema';
import type { Banco } from '../dados/banco';
import { useBanco } from '../dados/ProvedorBanco';
import * as repo from '../dados/repositorio';
import { lerChave } from '../ia/chave';
import { MODELOS_PADRAO, type ModelosIA } from '../ia/professor';
import { nivelAtual, statusCurso, type EstruturaNivel, type Progresso, type Status } from '../logica/desbloqueio';
import { definirVozesPreferidas } from '../voz/falar';
import { VOZ_VALIDA, type Sotaque } from '../voz/vozes';

export type Preferencias = {
  sotaque: Sotaque;
  ajusteVelocidade: number;
  modelos: ModelosIA;
  /** Voz escolhida para cada sotaque; vazio = escolha automática. Vale só para este aparelho. */
  vozes: Partial<Record<Sotaque, string>>;
};

const PREFS_PADRAO: Preferencias = { sotaque: 'en-US', ajusteVelocidade: 1, modelos: MODELOS_PADRAO, vozes: {} };
const SOTAQUES: Sotaque[] = ['en-US', 'en-GB'];
export const MODELO_VALIDO = /^[a-z0-9][a-z0-9.-]{2,60}$/;

type Valor = {
  db: Banco;
  curso: Curso;
  estrutura: EstruturaNivel[];
  perfis: repo.Perfil[];
  perfil: repo.Perfil | null;
  escolherPerfil: (id: number) => Promise<void>;
  prefs: Preferencias;
  salvarPrefs: (p: Partial<Preferencias>) => Promise<void>;
  chave: string;
  recarregarChave: () => Promise<void>;
  progresso: Progresso;
  status: Map<string, Status>;
  nivel: Nivel;
  recarregar: () => Promise<void>;
  /** Relê tudo do banco (depois de importar um backup). */
  recarregarTudo: () => Promise<void>;
  pronto: boolean;
};

const Ctx = createContext<Valor | null>(null);

export function useApp(): Valor {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fora do AppProvider');
  return v;
}

const vazio: Progresso = { aulasConcluidas: new Set(), provas: {} };

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useBanco();
  const c = useMemo(() => curso(), []);
  const estrutura = useMemo(() => estruturaDoCurso(c), [c]);
  const [perfis, setPerfis] = useState<repo.Perfil[]>([]);
  const [perfilId, setPerfilId] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<Preferencias>(PREFS_PADRAO);
  const [chave, setChave] = useState('');
  const [progresso, setProgresso] = useState<Progresso>(vazio);
  const [agora, setAgora] = useState(() => Date.now());
  const [pronto, setPronto] = useState(false);

  const perfil = perfis.find((p) => p.id === perfilId) ?? null;
  const nivelInicial = (NIVEIS as readonly string[]).includes(perfil?.nivel_inicial ?? '') ? (perfil!.nivel_inicial as Nivel) : 'A1';

  const recarregar = useCallback(async () => {
    setPerfis(await repo.listarPerfis(db));
    if (perfilId != null) setProgresso(await repo.carregarProgresso(db, perfilId));
    setAgora(Date.now());
  }, [db, perfilId]);

  const recarregarTudo = useCallback(async () => {
    const lista = await repo.listarPerfis(db);
    setPerfis(lista);
    const ativo = Number(await repo.lerConfig(db, 'perfil_ativo'));
    // Depois de importar um backup, o perfil ativo pode não existir mais.
    setPerfilId(lista.some((p) => p.id === ativo) ? ativo : null);
    const sot = await repo.lerConfig(db, 'sotaque');
    const vel = Number(await repo.lerConfig(db, 'ajuste_velocidade'));
    const mc = await repo.lerConfig(db, 'modelo_conversa');
    const ma = await repo.lerConfig(db, 'modelo_avaliacao');
    const vozes: Partial<Record<Sotaque, string>> = {};
    for (const s of SOTAQUES) {
      const v = await repo.lerConfig(db, `voz_${s}`);
      if (v && VOZ_VALIDA.test(v)) vozes[s] = v;
    }
    definirVozesPreferidas(vozes);
    setPrefs({
      sotaque: sot === 'en-GB' ? 'en-GB' : 'en-US',
      ajusteVelocidade: vel >= 0.6 && vel <= 1.4 ? vel : 1,
      modelos: {
        conversa: mc && MODELO_VALIDO.test(mc) ? mc : MODELOS_PADRAO.conversa,
        avaliacao: ma && MODELO_VALIDO.test(ma) ? ma : MODELOS_PADRAO.avaliacao,
      },
      vozes,
    });
    setChave(await lerChave().catch(() => ''));
    if (lista.some((p) => p.id === ativo)) setProgresso(await repo.carregarProgresso(db, ativo));
    setPronto(true);
  }, [db]);

  useEffect(() => {
    // O estado só muda depois de ler o banco (assíncrono); a regra não percebe isso.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregarTudo();
  }, [recarregarTudo]);

  useEffect(() => {
    if (perfilId == null) return;
    repo.carregarProgresso(db, perfilId).then(setProgresso);
  }, [db, perfilId]);

  // Atualiza a hora a cada minuto (libera provas depois das 24h sem reabrir o app).
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const escolherPerfil = useCallback(
    async (id: number) => {
      if (id !== perfilId) setProgresso(vazio);
      setPerfilId(id);
      await repo.gravarConfig(db, 'perfil_ativo', String(id));
    },
    [db, perfilId],
  );

  const salvarPrefs = useCallback(
    async (p: Partial<Preferencias>) => {
      const novo = { ...prefs, ...p, modelos: { ...prefs.modelos, ...p.modelos }, vozes: { ...prefs.vozes, ...p.vozes } };
      if (!MODELO_VALIDO.test(novo.modelos.conversa) || !MODELO_VALIDO.test(novo.modelos.avaliacao)) {
        throw new Error('Nome de modelo inválido.');
      }
      for (const s of SOTAQUES) {
        const v = novo.vozes[s];
        if (v !== undefined && v !== '' && !VOZ_VALIDA.test(v)) throw new Error('Voz inválida.');
        if (!v) delete novo.vozes[s];
      }
      setPrefs(novo);
      definirVozesPreferidas(novo.vozes);
      for (const s of SOTAQUES) await repo.gravarConfig(db, `voz_${s}`, novo.vozes[s] ?? '');
      await repo.gravarConfig(db, 'sotaque', novo.sotaque);
      await repo.gravarConfig(db, 'ajuste_velocidade', String(novo.ajusteVelocidade));
      await repo.gravarConfig(db, 'modelo_conversa', novo.modelos.conversa);
      await repo.gravarConfig(db, 'modelo_avaliacao', novo.modelos.avaliacao);
    },
    [db, prefs],
  );

  const recarregarChave = useCallback(async () => setChave(await lerChave().catch(() => '')), []);

  const status = useMemo(() => statusCurso(estrutura, progresso, agora, nivelInicial), [estrutura, progresso, agora, nivelInicial]);
  const nivel = useMemo(() => nivelAtual(estrutura, progresso, nivelInicial), [estrutura, progresso, nivelInicial]);

  const valor: Valor = {
    db,
    curso: c,
    estrutura,
    perfis,
    perfil,
    escolherPerfil,
    prefs,
    salvarPrefs,
    chave,
    recarregarChave,
    progresso,
    status,
    nivel,
    recarregar,
    recarregarTudo,
    pronto,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
