export function mdToHtml(md){
  if(!md) return '';
  md = md.replace(/\r\n?/g,'\n');
  const escape = s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let blocks=[];
  md = md.replace(/```([\s\S]*?)```/g,(m,p)=>{const k='__CODE_BLOCK_'+blocks.length+'__';blocks.push('<pre><code>'+escape(p)+'</code></pre>');return k});
  md = md.replace(/^>\s?(.*)$/gm,'<blockquote>$1</blockquote>');
  for(let i=6;i>=1;i--){const re=new RegExp('^'+('#'.repeat(i))+'\\s+(.+)$','gm');md=md.replace(re,'<h'+i+'>$1</h'+i+'>');}
  md = md.replace(/^---+$/gm,'<hr/>');
  md = md.replace(/^(?:[-*])\s+(.+)$/gm,'<li>$1</li>');
  md = md.replace(/(<li>.*<\/li>\n?)+/g, m=>'<ul>'+m+'</ul>');
  md = md.replace(/^(?:\d+\.)\s+(.+)$/gm,'<li>$1</li>');
  md = md.replace(/(<li>.*<\/li>\n?)+/g, m=> m.includes('<ul>')? m : '<ol>'+m+'</ol>');
  md = md.replace(/`([^`]+)`/g,'<code>$1</code>');
  md = md.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  md = md.replace(/\*([^*]+)\*/g,'<em>$1</em>');
  md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img alt="$1" src="$2" />');
  md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  const parts = md.split(/\n{2,}/).map(block=>{
    if(/^<h\d|^<ul>|^<ol>|^<pre>|^<blockquote>|^<hr\/>/.test(block.trim())) return block;
    const inner = block.replace(/\n/g,'<br/>');
    return '<p>'+inner+'</p>';
  });
  let html = parts.join('\n');
  blocks.forEach((frag,idx)=>{ html = html.replace('__CODE_BLOCK_'+idx+'__', frag); });
  return html;
}
