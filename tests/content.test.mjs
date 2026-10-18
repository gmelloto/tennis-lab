import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const paths=['index.html','capitulos/01-descobrindo-o-tenis/index.html','prototipos/lia-voz/index.html','documentacao/01-plano-editorial.md'];
test('arquivos principais presentes',()=>{ for(const path of paths) assert.ok(existsSync(path), `Arquivo ausente: ${path}`); });
test('paginas HTML contem estrutura basica',()=>{ for(const path of paths.filter(p=>p.endsWith('.html'))) assert.match(readFileSync(path,'utf8'),/<html/i); });
