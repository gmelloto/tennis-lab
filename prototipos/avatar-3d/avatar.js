// Tennis Lab — liga as formas de boca genéricas aos blendshapes de qualquer modelo GLB.
// Funciona com nomes ARKit (jawOpen, mouthFunnel, mouthSmile_L / mouthSmileLeft...)
// e visemas Oculus (viseme_aa, viseme_O...), comuns em avatares para web.

const MAPA = {
  abrir: [/^jawopen$/, /^viseme_aa$/, /^mouthopen$/],
  arredondar: [/^mouthfunnel$/, /^mouthpucker$/, /^viseme_o$/, /^viseme_u$/],
  sorrir: [/^mouthsmile(_?l|_?r|left|right)?$/, /^viseme_i$/, /^viseme_e$/],
  fechar: [/^mouthclose$/, /^mouthpress(_?l|_?r|left|right)$/, /^viseme_pp$/],
  piscar: [/^eyeblink(_?l|_?r|left|right)$/, /^blink$/],
};

// Intensidade relativa de cada blendshape (alguns são exagerados em 1.0).
const FATOR = { mouthclose: 0.5, mouthpucker: 0.6, mouthfunnel: 0.8, viseme_e: 0.6 };

const normalizar = (nome) => nome.split('.').pop().toLowerCase();

/** Encontra todos os blendshapes úteis no modelo. */
export function mapearBoca(raiz) {
  const ligacoes = [];
  raiz.traverse((obj) => {
    if (!obj.morphTargetDictionary || !obj.morphTargetInfluences) return;
    for (const [nome, indice] of Object.entries(obj.morphTargetDictionary)) {
      const n = normalizar(nome);
      for (const [forma, padroes] of Object.entries(MAPA)) {
        if (padroes.some((p) => p.test(n))) {
          ligacoes.push({ malha: obj, indice, forma, nome: n, fator: FATOR[n] ?? 1 });
        }
      }
    }
  });
  return ligacoes;
}

/** Aplica pesos {abrir, arredondar, sorrir, fechar, piscar} ao modelo. */
export function aplicarPesos(ligacoes, pesos) {
  for (const l of ligacoes) l.malha.morphTargetInfluences[l.indice] = (pesos[l.forma] ?? 0) * l.fator;
}

/** Relatório para avaliar se um GLB serve para o Tennis Lab. */
export function diagnosticar(gltf, ligacoes) {
  let malhas = 0;
  let blendshapes = 0;
  let esqueleto = false;
  gltf.scene.traverse((o) => {
    if (o.isMesh) malhas++;
    if (o.isSkinnedMesh) esqueleto = true;
    if (o.morphTargetDictionary) blendshapes += Object.keys(o.morphTargetDictionary).length;
  });
  const formas = [...new Set(ligacoes.map((l) => l.forma))];
  const fala = ['abrir', 'arredondar', 'sorrir', 'fechar'].filter((f) => formas.includes(f));
  return {
    malhas,
    blendshapes,
    esqueleto,
    animacoes: gltf.animations.map((a) => a.name || 'sem nome'),
    formasDeBoca: fala,
    piscar: formas.includes('piscar'),
    pronto: fala.includes('abrir') && fala.length >= 2,
  };
}
