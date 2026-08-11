const CATEGORY_RULES = [
  {
    category: '编程开发',
    strong: [
      /代码|编程|脚本|github|git|api|sdk|node|python|javascript|typescript|终端|terminal|cli|cursor|vscode|debug|仓库|接口|数据库|前端|后端|组件|开源组件|react|next\.js|网页开发/i,
    ],
    weak: [/开发|部署|工程|函数|自动化脚本|动效组件|网页设计/i],
    tagBoost: [/前端|后端|开发|编程|代码|组件|开源|网页设计/i],
  },
  {
    category: 'AI工具',
    strong: [
      /claude|openclaw|gpt|llm|aigc|midjourney|sora|comfyui|prompt|提示词|大模型|人工智能|智能体|agent|gemini|claudecode/i,
    ],
    weak: [/(^|[^a-z])ai([^a-z]|$)/i, /工作流|自动化|模型/i],
    tagBoost: [/AI|agent|openclaw|claudecode|效率神器|智能体|模型/i],
  },
  {
    category: '阅读思考',
    strong: [
      /读书|阅读|书单|书评|乡土中国|费孝通|卡夫卡|戈多|人类学|社会学|哲学|戏剧|文学|理论|思想|批评|人文社科|荒诞|贝克特/i,
    ],
    weak: [/认知|思考|概念|文本|语境|经典|作家|研究/i],
    tagBoost: [/书籍|文学|社会学|哲学|人类学|剧本|卡夫卡|乡土中国|人文社科/i],
  },
  {
    category: '设计美学',
    strong: [
      /设计|视觉|品牌|排版|字体|海报|审美|ascii|界面|ui|ux|平面|视觉趋势|品牌设计|设计解析|壁画|马赛克艺术/i,
    ],
    weak: [/美学|视觉流行趋势|风格|色彩/i],
    tagBoost: [/设计|品牌|视觉|ascii|排版|ui|ux|审美/i],
  },
  {
    category: '旅行户外',
    strong: [
      /旅行|旅游|徒步|环线|自驾|景点|路线|机票|酒店|露营|city walk|户外|游记|登山|雪山|海拔|香格里拉|腾冲|芒市|川西|冰岛|青海|漠河|阿拉木图|乌孙古道/i,
    ],
    weak: [/攻略|目的地|出行|行程|打卡/i],
    tagBoost: [/旅行|旅游|徒步|露营|户外/i],
  },
  {
    category: '美食餐饮',
    strong: [/美食|好吃|餐厅|探店|火锅|菜谱|烹饪|营养|食物|饮食|咖啡|甜品|潮汕|陈晓卿/i],
    weak: [/吃|口味|下饭|食材/i],
    tagBoost: [/美食|咖啡|餐厅|菜谱|探店/i],
  },
  {
    category: '影像创作',
    strong: [/摄影|分镜|电影|镜头|胶片|画面|构图|色彩|视觉叙事|影像|视频剪辑|动画|短片|可灵|veo|海螺|ray2|游戏制作|steam/i],
    weak: [/叙事|故事|画幅|拍摄|视频|游戏/i],
    tagBoost: [/摄影|电影|镜头|影像|分镜|动画|短片|游戏/i],
  },
  {
    category: '方法论',
    strong: [/方法|步骤|教程|指南|清单|复盘|框架|流程|避坑|经验/i],
    weak: [/执行|打法|策略/i],
    tagBoost: [/教程|指南|复盘|方法|框架/i],
  },
  {
    category: '生活方式',
    strong: [/效率|习惯|时间管理|知识管理|收藏|整理|沉淀|身心|生活方式/i],
    weak: [/生活|管理|状态/i],
    tagBoost: [/效率|整理|知识管理|生活方式/i],
  },
];

const CATEGORY_PRIORITY = [
  '编程开发',
  'AI工具',
  '阅读思考',
  '设计美学',
  '旅行户外',
  '美食餐饮',
  '影像创作',
  '方法论',
  '生活方式',
];

function hitScore(text, regs, weight) {
  if (!regs || regs.length === 0) return 0;
  return regs.reduce((acc, re) => acc + (re.test(text) ? weight : 0), 0);
}

export function inferCategoryFromNote(note) {
  const title = typeof note?.title === 'string' ? note.title : '';
  const content = typeof note?.content === 'string' ? note.content : '';
  const rawContent = typeof note?.rawContent === 'string' ? note.rawContent : '';
  const ocrText = typeof note?.ocrText === 'string' ? note.ocrText : '';
  const tags = Array.isArray(note?.tags) ? note.tags.filter(Boolean).join(' ') : '';
  const source = `${title}\n${content}\n${rawContent}\n${ocrText}\n${tags}`;
  const scores = new Map();

  for (const rule of CATEGORY_RULES) {
    const score = hitScore(source, rule.strong, 3)
      + hitScore(source, rule.weak, 1)
      + hitScore(tags, rule.tagBoost, 2)
      + hitScore(title, rule.tagBoost, 2);
    scores.set(rule.category, score);
  }

  const reading = scores.get('阅读思考') || 0;
  const design = scores.get('设计美学') || 0;
  const coding = scores.get('编程开发') || 0;
  const ai = scores.get('AI工具') || 0;

  if (reading >= 4) {
    scores.set('方法论', Math.max(0, (scores.get('方法论') || 0) - 2));
  }
  if (design >= 4 && coding >= 3) {
    scores.set('编程开发', coding + 1);
  }
  if (ai >= 4 && coding >= 4 && /agent|openclaw|claudecode|模型|prompt/i.test(source)) {
    scores.set('AI工具', ai + 1);
  }
  if ((scores.get('影像创作') || 0) >= 4 && /veo|可灵|海螺|动画|短片|视频|镜头|游戏/i.test(source)) {
    scores.set('影像创作', (scores.get('影像创作') || 0) + 2);
    scores.set('AI工具', Math.max(0, (scores.get('AI工具') || 0) - 1));
  }

  let bestCategory = '待分类';
  let bestScore = 0;

  for (const category of CATEGORY_PRIORITY) {
    const score = scores.get(category) || 0;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestScore >= 2 ? bestCategory : '待分类';
}
