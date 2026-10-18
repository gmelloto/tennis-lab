import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const paths=['index.html','capitulos/01-descobrindo-o-tenis/index.html','prototipos/lia-voz/index.html','documentacao/01-plano-editorial.md'];
test('arquivos principais presentes',()=>{ for(const path of paths) assert.ok(existsSync(path), `Arquivo ausente: ${path}`); });
test('paginas HTML contem estrutura basica',()=>{ for(const path of paths.filter(p=>p.endsWith('.html'))) assert.match(readFileSync(path,'utf8'),/<html/i); });

const pages=['index.html','capitulos/01-descobrindo-o-tenis/index.html','prototipos/lia-voz/index.html'];
test('links internos apontam para arquivos existentes',()=>{
  for(const page of pages){
    const html=readFileSync(page,'utf8'); const base=page.split('/').slice(0,-1).join('/');
    for(const [,href] of html.matchAll(/(?:href|src)="([^"#:]+)"/g)){
      const target=new URL(href,'file:///r/'+(base?base+'/':'')).pathname.slice(3);
      assert.ok(existsSync(target), `${page} -> link quebrado: ${href}`);
    }
  }
});
test('todas as paginas tem favicon e caminho de volta ao portal',()=>{
  for(const page of pages) assert.match(readFileSync(page,'utf8'),/rel="icon"/, `${page} sem favicon`);
  for(const page of pages.slice(1)) assert.match(readFileSync(page,'utf8'),/href="\.\.\/\.\.\/index\.html"/, `${page} sem link para o portal`);
});
