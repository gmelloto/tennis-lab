import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarEstimadorDeAudio, formaDaLetra, pesosDoTexto, suavizar, legendaNoTempo, bocaFechada } from '../prototipos/avatar-3d/lipsync.js';
import { mapearBoca, diagnosticar } from '../prototipos/avatar-3d/avatar.js';

test('silêncio mantém a boca fechada', () => {
  const estimar = criarEstimadorDeAudio();
  assert.deepEqual(estimar(new Uint8Array(512), 48000, 1024), bocaFechada());
});

test('voz alta abre a boca', () => {
  const estimar = criarEstimadorDeAudio();
  const freq = new Uint8Array(512).map((_, i) => (i > 3 && i < 40 ? 200 : 60));
  assert.ok(estimar(freq, 48000, 1024).abrir > 0.4);
});

test('vogais e consoantes geram formas coerentes', () => {
  assert.ok(formaDaLetra('á').abrir > formaDaLetra('i').abrir);
  assert.ok(formaDaLetra('u').arredondar > 0.8);
  assert.equal(formaDaLetra('m').fechar, 1);
  assert.deepEqual(formaDaLetra(' '), bocaFechada());
  assert.deepEqual(pesosDoTexto('oi', 5), bocaFechada());
});

test('suavização se aproxima do alvo sem ultrapassar', () => {
  const r = suavizar(bocaFechada(), { abrir: 1, arredondar: 0, sorrir: 0, fechar: 0 }, 0.05);
  assert.ok(r.abrir > 0.5 && r.abrir < 1);
});

test('legendas: com tempos e por proporção do texto', () => {
  const l = [{ inicio: 0, fim: 1, texto: 'A' }, { inicio: 1, fim: 2, texto: 'B' }];
  assert.equal(legendaNoTempo(1.5, 2, l), 'B');
  assert.equal(legendaNoTempo(0.1, 10, null, 'Primeira frase. Segunda frase.'), 'Primeira frase.');
  assert.equal(legendaNoTempo(9.9, 10, null, 'Primeira frase. Segunda frase.'), 'Segunda frase.');
});

test('mapeia blendshapes ARKit e visemas', () => {
  const malha = (dict) => ({ morphTargetDictionary: dict, morphTargetInfluences: Object.values(dict).map(() => 0), isMesh: true });
  const arkit = malha({ 'blendShape1.jawOpen': 0, 'blendShape1.mouthFunnel': 1, 'blendShape1.mouthSmile_L': 2, 'blendShape1.eyeBlink_R': 3 });
  const oculus = malha({ viseme_aa: 0, viseme_O: 1, viseme_PP: 2 });
  const raiz = { traverse: (fn) => [arkit, oculus].forEach(fn) };
  const lig = mapearBoca(raiz);
  const formas = new Set(lig.map((l) => l.forma));
  for (const f of ['abrir', 'arredondar', 'sorrir', 'fechar', 'piscar']) assert.ok(formas.has(f), f);
  const d = diagnosticar({ scene: raiz, animations: [] }, lig);
  assert.equal(d.pronto, true);
});

test('roteiros de fala são válidos', () => {
  const { falas } = JSON.parse(readFileSync('prototipos/avatar-3d/falas.json', 'utf8'));
  assert.ok(falas.length >= 1);
  for (const f of falas) {
    assert.ok(f.id && f.personagem && f.texto, `fala incompleta: ${f.id}`);
    assert.ok(['Lia', 'Alex'].includes(f.personagem));
  }
});
