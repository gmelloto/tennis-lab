// Tennis Lab — sincronização labial independente do modelo 3D.
// Converte áudio (espectro) ou texto em quatro "formas de boca" genéricas.
// O avatar (avatar.js) traduz essas formas para os blendshapes do modelo:
// ARKit (jawOpen, mouthFunnel...), visemas Oculus (viseme_aa...) etc.

export const FORMAS = ['abrir', 'arredondar', 'sorrir', 'fechar'];

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const bocaFechada = () => ({ abrir: 0, arredondar: 0, sorrir: 0, fechar: 0 });

// ---------- A partir do áudio (arquivo, microfone, voz gerada) ----------

function mediaDaBanda(freq, hzPorBin, de, ate) {
  const ini = Math.max(0, Math.floor(de / hzPorBin));
  const fim = Math.min(freq.length - 1, Math.ceil(ate / hzPorBin));
  let soma = 0;
  for (let i = ini; i <= fim; i++) soma += freq[i];
  return fim >= ini ? soma / (fim - ini + 1) / 255 : 0;
}

/**
 * Cria um estimador com ganho automático: ele aprende o volume típico da voz
 * para funcionar tanto com áudio baixo quanto alto.
 */
export function criarEstimadorDeAudio() {
  let pico = 0.25;
  return function pesosDoEspectro(freq, sampleRate, fftSize) {
    const hz = sampleRate / fftSize;
    const grave = mediaDaBanda(freq, hz, 90, 350);   // vozeamento, "o"/"u"
    const medio = mediaDaBanda(freq, hz, 350, 1400); // vogais abertas, "a"
    const agudo = mediaDaBanda(freq, hz, 1400, 3500); // "e"/"i"
    const sibil = mediaDaBanda(freq, hz, 3500, 8000); // "s", "f", "x"
    const energia = grave * 0.3 + medio * 0.4 + agudo * 0.2 + sibil * 0.1;

    pico = Math.max(energia, pico * 0.995, 0.15); // decai devagar
    const volume = clamp((energia / pico - 0.4) / 0.5); // portão de ruído
    if (volume === 0) return bocaFechada();

    const total = grave + medio + agudo + sibil + 1e-6;
    return {
      abrir: clamp(volume * (0.35 + (medio / total) * 1.3)),
      arredondar: clamp(volume * (grave / total) * 1.5),
      sorrir: clamp(volume * ((agudo + sibil) / total) * 1.6),
      fechar: 0,
    };
  };
}

// ---------- A partir do texto (voz do navegador, sem acesso ao áudio) ----------

const semAcento = (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function formaDaLetra(letra) {
  const c = semAcento(letra || '');
  switch (c) {
    case 'a': return { abrir: 0.85, arredondar: 0, sorrir: 0.1, fechar: 0 };
    case 'e': return { abrir: 0.5, arredondar: 0, sorrir: 0.5, fechar: 0 };
    case 'i': case 'y': return { abrir: 0.25, arredondar: 0, sorrir: 0.8, fechar: 0 };
    case 'o': return { abrir: 0.55, arredondar: 0.7, sorrir: 0, fechar: 0 };
    case 'u': case 'w': return { abrir: 0.2, arredondar: 0.95, sorrir: 0, fechar: 0 };
    case 'm': case 'b': case 'p': return { abrir: 0, arredondar: 0, sorrir: 0, fechar: 1 };
    case 'f': case 'v': return { abrir: 0.1, arredondar: 0, sorrir: 0.3, fechar: 0.3 };
    case 's': case 'z': case 'c': case 'x': case 'j': case 'g':
      return { abrir: 0.15, arredondar: 0, sorrir: 0.45, fechar: 0 };
    default:
      return /[a-z]/.test(c) ? { abrir: 0.2, arredondar: 0, sorrir: 0.1, fechar: 0 } : bocaFechada();
  }
}

/** Forma da boca no instante em que a fala está no caractere `posicao` (pode ser fracionário). */
export function pesosDoTexto(texto, posicao) {
  if (posicao < 0 || posicao >= texto.length) return bocaFechada();
  const i = Math.floor(posicao);
  const f = posicao - i;
  const a = formaDaLetra(texto[i]);
  const b = formaDaLetra(texto[i + 1]);
  const r = {};
  for (const k of FORMAS) r[k] = a[k] * (1 - f) + b[k] * f;
  return r;
}

// ---------- Suavização (evita boca "tremendo") ----------

/** Aproxima `atual` de `alvo`: abre rápido, fecha um pouco mais devagar. */
export function suavizar(atual, alvo, dt) {
  const r = {};
  for (const k of FORMAS) {
    const tau = alvo[k] > atual[k] ? 0.04 : 0.06;
    const a = 1 - Math.exp(-dt / tau);
    r[k] = atual[k] + (alvo[k] - atual[k]) * a;
  }
  return r;
}

// ---------- Legendas ----------

/**
 * Legenda ativa num instante. `legendas` = [{inicio, fim, texto}] em segundos.
 * Sem legendas com tempo, divide o texto em frases proporcionalmente à duração.
 */
export function legendaNoTempo(t, duracao, legendas, texto) {
  if (legendas?.length) return legendas.find((l) => t >= l.inicio && t < l.fim)?.texto ?? '';
  if (!texto || !duracao) return texto || '';
  const frases = texto.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [texto];
  const total = frases.reduce((s, f) => s + f.length, 0);
  let acumulado = 0;
  for (const frase of frases) {
    acumulado += frase.length;
    if (t <= (acumulado / total) * duracao) return frase;
  }
  return frases.at(-1);
}
