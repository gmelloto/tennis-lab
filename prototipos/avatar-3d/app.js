// Tennis Lab — protótipo de avatar 3D com voz, legendas e sincronização labial.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';
import { bocaFechada, criarEstimadorDeAudio, pesosDoTexto, suavizar, legendaNoTempo } from './lipsync.js';
import { mapearBoca, aplicarPesos, diagnosticar } from './avatar.js';

const MODELO_TESTE = {
  url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/facecap.glb',
  nome: 'Modelo de teste',
};
const BASIS = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/';
const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// ---------- Cena ----------
const palco = $('palco');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch {
  $('aviso').textContent = 'Seu navegador não conseguiu iniciar o 3D (WebGL).';
  throw new Error('WebGL indisponível');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
palco.prepend(renderer.domElement);

const cena = new THREE.Scene();
cena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment()).texture;
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true;
controles.enablePan = false;

new ResizeObserver(() => {
  const { clientWidth: w, clientHeight: h } = palco;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe(palco);

const ktx2 = new KTX2Loader().setTranscoderPath(BASIS).detectSupport(renderer);
const carregador = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

let modelo = null;
let ligacoes = [];
let diag = null;

function enquadrar(obj) {
  const caixa = new THREE.Box3().setFromObject(obj);
  const tam = caixa.getSize(new THREE.Vector3());
  const centro = caixa.getCenter(new THREE.Vector3());
  // Corpo inteiro (alto e estreito): foca no rosto. Senão, mostra o modelo todo.
  const corpoInteiro = tam.y > tam.x * 1.6 && tam.y > tam.z * 1.6;
  const alvo = corpoInteiro ? new THREE.Vector3(centro.x, caixa.max.y - tam.y * 0.09, centro.z) : centro;
  const altura = corpoInteiro ? tam.y * 0.22 : Math.max(tam.x, tam.y, tam.z);
  const dist = (altura / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.35;
  camera.position.set(alvo.x, alvo.y, alvo.z + dist);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();
  controles.target.copy(alvo);
  controles.minDistance = dist * 0.5;
  controles.maxDistance = dist * 3;
}

async function carregarModelo(fonte, nome) {
  $('aviso').hidden = false;
  $('aviso').textContent = 'Carregando modelo 3D…';
  try {
    const gltf = typeof fonte === 'string'
      ? await carregador.loadAsync(fonte)
      : await new Promise((ok, erro) => carregador.parse(fonte, '', ok, erro));
    if (modelo) cena.remove(modelo);
    modelo = gltf.scene;
    cena.add(modelo);
    ligacoes = mapearBoca(modelo);
    diag = diagnosticar(gltf, ligacoes);
    enquadrar(modelo);
    $('selo').textContent = nome;
    $('aviso').hidden = true;
    mostrarDiagnostico();
  } catch (e) {
    console.error(e);
    $('aviso').textContent = 'Não foi possível carregar o modelo 3D. Verifique a conexão ou o arquivo .glb.';
    status('Erro ao carregar o modelo.');
  }
}

function mostrarDiagnostico() {
  const ok = (v) => (v ? '✅' : '⚠️');
  const nomes = { abrir: 'abrir', arredondar: 'arredondar', sorrir: 'sorrir', fechar: 'fechar' };
  $('diag').innerHTML = [
    `${ok(diag.pronto)} <strong>${diag.pronto ? 'Pronto para falar' : 'Sem formas de boca suficientes para falar'}</strong>`,
    `${ok(diag.formasDeBoca.length)} Formas de boca: ${diag.formasDeBoca.map((f) => nomes[f]).join(', ') || 'nenhuma'} (${diag.blendshapes} blendshapes no total)`,
    `${ok(diag.piscar)} Piscar: ${diag.piscar ? 'sim' : 'não'}`,
    `${ok(diag.esqueleto)} Esqueleto para animar golpes: ${diag.esqueleto ? 'sim' : 'não'}`,
    `ℹ️ Animações no arquivo: ${diag.animacoes.length ? diag.animacoes.join(', ') : 'nenhuma'}`,
  ].map((t) => `<li>${t}</li>`).join('');
}

// ---------- Áudio ----------
let ctxAudio = null;
let analisador = null;
let dadosFreq = null;
const estimar = criarEstimadorDeAudio();

function garantirAudio() {
  if (!ctxAudio) {
    ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    analisador = ctxAudio.createAnalyser();
    analisador.fftSize = 1024;
    analisador.smoothingTimeConstant = 0.25;
    dadosFreq = new Uint8Array(analisador.frequencyBinCount);
  }
  if (ctxAudio.state === 'suspended') ctxAudio.resume();
}

const elementoAudio = new Audio();
elementoAudio.preload = 'auto';
elementoAudio.setAttribute('playsinline', '');
let fonteElemento = null;

// O que está falando agora: null | {tipo:'audio'|'texto'|'mic', ...}
let falaAtual = null;

function status(msg) { $('status').textContent = msg; }

// iOS 17+: faz o áudio da página tocar mesmo com a chave de silencioso ligada.
function prepararSessaoDeAudio(tipo = 'playback') {
  try { if (navigator.audioSession) navigator.audioSession.type = tipo; } catch { /* sem suporte */ }
}
let utteranceAtual = null; // mantém a referência: o Safari descarta falas "soltas"

function parar() {
  const synth = window.speechSynthesis;
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
  elementoAudio.pause();
  if (falaAtual?.tipo === 'mic') {
    falaAtual.stream.getTracks().forEach((t) => t.stop());
    falaAtual.fonte.disconnect();
    $('mic').textContent = '🎙 Ativar microfone';
  }
  falaAtual = null;
  $('legenda').textContent = '';
}

async function tocarAudio(src, texto, legendas) {
  parar();
  prepararSessaoDeAudio();
  garantirAudio();
  if (!fonteElemento) {
    fonteElemento = ctxAudio.createMediaElementSource(elementoAudio);
    fonteElemento.connect(analisador);
  }
  analisador.connect(ctxAudio.destination); // religa a saída (o microfone a desliga)
  elementoAudio.src = src;
  falaAtual = { tipo: 'audio', texto, legendas };
  elementoAudio.onended = () => { if (falaAtual?.tipo === 'audio') parar(); status(''); };
  try {
    await elementoAudio.play();
    status('Tocando áudio…');
  } catch (e) {
    console.error(e);
    status('Não foi possível tocar este áudio.');
    parar();
  }
}

function vozPtBr() {
  const vozes = speechSynthesis.getVoices();
  return vozes.find((v) => v.lang === 'pt-BR' && /luciana|francisca|google/i.test(v.name))
    || vozes.find((v) => v.lang === 'pt-BR')
    || vozes.find((v) => v.lang?.startsWith('pt'));
}

function falarTexto(texto, velocidade) {
  const synth = window.speechSynthesis;
  if (!synth) { status('Este navegador não tem voz sintetizada.'); return; }
  const ocupado = synth.speaking || synth.pending;
  parar();
  prepararSessaoDeAudio();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR';
  u.rate = velocidade;
  const voz = vozPtBr();
  if (voz) u.voice = voz;
  const fala = { tipo: 'texto', texto, base: 0, inicio: performance.now(), cps: 14 * velocidade, iniciou: false };
  u.onstart = () => { fala.inicio = performance.now(); fala.iniciou = true; };
  u.onboundary = (e) => { fala.base = e.charIndex; fala.inicio = performance.now(); fala.iniciou = true; };
  u.onend = () => { if (falaAtual === fala) { parar(); status(''); } };
  u.onerror = () => { if (falaAtual === fala) parar(); };
  falaAtual = fala;
  utteranceAtual = u;
  const iniciar = () => {
    if (falaAtual !== fala) return;
    synth.resume();
    synth.speak(u);
  };
  // No iPhone, falar logo após cancelar pode descartar a fala: espera um instante.
  if (ocupado) setTimeout(iniciar, 250); else iniciar();
  const vozes = synth.getVoices().filter((v) => v.lang?.startsWith('pt')).length;
  status(voz ? `Voz do aparelho: ${voz.name}` : `Voz do aparelho (${vozes} vozes em português encontradas)`);
  setTimeout(() => { if (falaAtual === fala && !fala.iniciou) status('A voz não começou. Confira: modo silencioso desligado, volume alto e, em Ajustes › Acessibilidade › Conteúdo Falado › Vozes, uma voz em Português (Brasil).'); }, 3000);
}

async function ligarMicrofone() {
  if (falaAtual?.tipo === 'mic') { parar(); status(''); return; }
  parar();
  prepararSessaoDeAudio('play-and-record');
  garantirAudio();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const fonte = ctxAudio.createMediaStreamSource(stream);
    fonte.connect(analisador); // não vai para a saída: evita eco
    analisador.disconnect();
    falaAtual = { tipo: 'mic', stream, fonte };
    $('mic').textContent = '■ Desativar microfone';
    status('Microfone ativo — fale!');
  } catch {
    status('Permissão de microfone negada ou indisponível.');
  }
}

// ---------- Loop de animação ----------
let pesos = bocaFechada();
let proximaPiscada = 2;
let piscando = 0;
const relogio = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(relogio.getDelta(), 0.1);
  const t = relogio.elapsedTime;
  let alvo = bocaFechada();
  let legenda = '';

  if (falaAtual?.tipo === 'audio' || falaAtual?.tipo === 'mic') {
    if (falaAtual.tipo === 'mic' || !elementoAudio.paused) {
      analisador.getByteFrequencyData(dadosFreq);
      alvo = estimar(dadosFreq, ctxAudio.sampleRate, analisador.fftSize);
    }
    if (falaAtual.tipo === 'audio') {
      legenda = legendaNoTempo(elementoAudio.currentTime, elementoAudio.duration, falaAtual.legendas, falaAtual.texto);
    }
  } else if (falaAtual?.tipo === 'texto' && falaAtual.iniciou) {
    const pos = falaAtual.base + ((performance.now() - falaAtual.inicio) / 1000) * falaAtual.cps;
    alvo = pesosDoTexto(falaAtual.texto, Math.min(pos, falaAtual.texto.length - 1));
    legenda = legendaNoTempo(pos, falaAtual.texto.length, null, falaAtual.texto);
  }

  pesos = suavizar(pesos, alvo, dt);

  // Piscar natural a cada 2–5 s
  proximaPiscada -= dt;
  if (proximaPiscada <= 0) { piscando = 0.16; proximaPiscada = 2 + Math.random() * 3; }
  piscando = Math.max(0, piscando - dt);
  const piscar = piscando > 0 ? Math.sin((piscando / 0.16) * Math.PI) : 0;

  aplicarPesos(ligacoes, { ...pesos, piscar });

  if (modelo && !movimentoReduzido) {
    modelo.rotation.y = Math.sin(t * 0.45) * 0.05;
    modelo.rotation.x = Math.sin(t * 0.31) * 0.02;
  }

  const mostrar = $('legendas').checked ? legenda : '';
  if ($('legenda').textContent !== mostrar) $('legenda').textContent = mostrar;

  controles.update();
  renderer.render(cena, camera);
});

// ---------- Interface ----------
let falas = [];

async function carregarFalas() {
  try {
    falas = (await (await fetch('./falas.json')).json()).falas;
  } catch {
    falas = [{ id: 'padrao', personagem: 'Lia', titulo: 'Teste', texto: 'Oi! Eu sou a Lia.' }];
  }
  $('fala').innerHTML = falas.map((f, i) => `<option value="${i}">${f.personagem} — ${f.titulo}</option>`).join('');
}

$('vel').addEventListener('input', (e) => { $('velTxt').textContent = `${Number(e.target.value).toFixed(1).replace('.', ',')}×`; });

$('ouvir').addEventListener('click', () => {
  const f = falas[$('fala').value];
  if (!f) return;
  if (f.audio) tocarAudio(new URL(f.audio, location.href).href, f.texto, f.legendas);
  else falarTexto(f.texto, Number($('vel').value));
});

let urlArquivo = null;
$('arquivo').addEventListener('change', (e) => {
  const arq = e.target.files[0];
  if (urlArquivo) URL.revokeObjectURL(urlArquivo);
  urlArquivo = arq ? URL.createObjectURL(arq) : null;
  $('tocar').disabled = !arq;
  if (arq) status(`Áudio escolhido: ${arq.name}`);
});
$('tocar').addEventListener('click', () => urlArquivo && tocarAudio(urlArquivo, $('textoAudio').value.trim(), null));

$('mic').addEventListener('click', ligarMicrofone);
for (const b of ['parar1', 'parar2']) $(b).addEventListener('click', () => { parar(); status(''); });

$('glb').addEventListener('change', async (e) => {
  const arq = e.target.files[0];
  if (!arq) return;
  parar();
  await carregarModelo(await arq.arrayBuffer(), arq.name);
  status(diag?.pronto ? 'Avatar carregado e pronto para falar.' : 'Avatar carregado — veja o diagnóstico abaixo.');
});
$('padrao').addEventListener('click', () => carregarModelo(MODELO_TESTE.url, MODELO_TESTE.nome));

const abas = [...document.querySelectorAll('[role=tab]')];
abas.forEach((aba) => aba.addEventListener('click', () => {
  abas.forEach((a) => {
    const ativa = a === aba;
    a.setAttribute('aria-selected', String(ativa));
    $(a.getAttribute('aria-controls')).hidden = !ativa;
  });
}));

window.speechSynthesis?.getVoices(); // iOS carrega as vozes de forma assíncrona
carregarFalas();
carregarModelo(MODELO_TESTE.url, MODELO_TESTE.nome);

// Ponto de inspeção para testes automatizados
window.__tennisLab = { get pesos() { return pesos; }, get diag() { return diag; }, get ligacoes() { return ligacoes.length; } };
