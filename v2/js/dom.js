// Мини-хелпер: создаёт элементы без innerHTML (защита от XSS).
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}
