function inline(parent, source) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    parent.append(document.createTextNode(source.slice(last, match.index)));
    let node;
    if (match[1]) {
      node = document.createElement("a"); node.href = match[2]; node.textContent = match[1]; node.target = "_blank"; node.rel = "noopener noreferrer";
    } else if (match[3]) { node = document.createElement("strong"); node.textContent = match[3]; }
    else if (match[4]) { node = document.createElement("code"); node.textContent = match[4]; }
    else { node = document.createElement("em"); node.textContent = match[5]; }
    parent.append(node);
    last = match.index + match[0].length;
  }
  parent.append(document.createTextNode(source.slice(last)));
}

export function renderMarkdown(target, source) {
  target.replaceChildren();
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  let list = null;
  let code = null;
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (code) { target.append(code); code = null; }
      else code = document.createElement("pre");
      list = null; continue;
    }
    if (code) { code.textContent += `${line}\n`; continue; }
    if (!line.trim()) { list = null; continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const node = document.createElement(`h${heading[1].length + 2}`);
      inline(node, heading[2]); target.append(node); list = null; continue;
    }
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      if (!list) { list = document.createElement("ul"); target.append(list); }
      const item = document.createElement("li"); inline(item, bullet[1]); list.append(item); continue;
    }
    const paragraph = document.createElement("p"); inline(paragraph, line); target.append(paragraph); list = null;
  }
  if (code) target.append(code);
}
