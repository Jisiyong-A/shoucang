/* Precise e5 quality check: embed queries + notes in node, print cosine. */
import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = true;
env.localModelPath = 'file:///D:/hermes/kankan-shoucang/dist/models/';

const embedder = await pipeline('feature-extraction', 'multilingual-e5-large');

async function embed(text, role) {
  const out = await embedder(`${role}: ${text}`, { pooling: 'none', normalize: false });
  const dim = 1024;
  const numTokens = Math.floor(out.data.length / dim);
  const vector = new Float32Array(dim);
  for (let t = 0; t < numTokens; t += 1) {
    const off = t * dim;
    for (let i = 0; i < dim; i += 1) vector[i] += out.data[off + i];
  }
  let norm = 0;
  for (let i = 0; i < dim; i += 1) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i += 1) vector[i] /= norm;
  return vector;
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

const notes = [
  { id: 'python', title: 'Python 自动化脚本：批量重命名文件', body: '用代码写了一个脚本，自动处理文件夹里的文档' },
  { id: 'sketch', title: '英国导师：你是我教过手绘最好的', body: '建筑手绘练习，钢笔线条' },
  { id: 'pet', title: '当答应不咬但诱惑真实存在时', body: '猫咪训练' },
];
const queries = ['coding', '代码', 'architecture sketch', '猫咪'];

const noteVectors = {};
for (const n of notes) {
  noteVectors[n.id] = await embed(`${n.title}\n${n.body}`, 'passage');
}

for (const q of queries) {
  const qv = await embed(q, 'query');
  const scores = notes.map((n) => ({ id: n.id, score: cosine(qv, noteVectors[n.id]) }))
    .sort((a, b) => b.score - a.score);
  console.log(`query "${q}":`, scores.map((s) => `${s.id}=${s.score.toFixed(3)}`).join('  '));
}
