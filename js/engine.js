// Web 网页端通用计算逻辑与数据接口
// 完全沿用原生 engine.js 的 6维算法、能力匹配、年龄歧视检测等核心逻辑

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data.js'));
  } else {
    root.CareerEngine = factory(root.CareerData);
  }
}(typeof self !== 'undefined' ? self : this, function (D) {

  const INTERESTS = D.INTERESTS;
  const SKILL_GROUPS = D.SKILL_GROUPS;
  const TRAITS = D.TRAITS;
  const PREF_ITEMS = D.PREF_ITEMS;
  const JOBS = D.JOBS;
  const COURSES = D.COURSES;
  const PERSONAS = D.PERSONAS;
  const STEP_DEFS = D.STEP_DEFS;
  const PERSONA_STEPS = D.PERSONA_STEPS;

  const ALL_SKILLS = SKILL_GROUPS.flatMap(g => g.items);
  const SKILL_LABELS = Object.fromEntries(ALL_SKILLS.map(x => [x.id, x.label]));
  const PERSONA_NAMES = { mid: "35+ 重新出发", mom: "宝妈重返职场" };

  function scoreJob(job, a) {
    let interest = 0;
    if (a.interests.length) {
      let sum = 0, hit = 0;
      for (const id of a.interests) {
        const w = job.fit.interests[id] || 0;
        if (w > 0) { sum += w; hit++; }
      }
      const cover = hit / a.interests.length;
      const strength = hit ? sum / hit : 0;
      interest = strength * (0.55 + 0.45 * cover);
    }
    let skill = 0;
    if (a.skills.length) {
      let sum = 0;
      for (const id of a.skills) sum += job.fit.skills[id] || 0;
      skill = Math.min(1, sum / Math.max(2, a.skills.length * 0.8));
    }
    let trait = 0, wSum = 0;
    for (const t of TRAITS) {
      const w = job.fit.traits[t.id] || 0.3;
      trait += (a.traits[t.id] / 10) * w;
      wSum += w;
    }
    trait /= wSum;
    let pref = 0.5;
    if (a.prefs.length) {
      let sum = 0;
      for (const id of a.prefs) sum += job.fit.prefs[id] || 0;
      pref = Math.min(1, sum / a.prefs.length);
    }
    const persona = a.persona ? job.persona[a.persona] : 0.7;
    const total = interest * 0.35 + skill * 0.25 + trait * 0.20 + pref * 0.15 + persona * 0.05;
    return { total: Math.round(total * 100), parts: { interest, skill, trait, pref, persona } };
  }

  function buildReport(a) {
    const scored = JOBS.map(j => ({ job: j, ...scoreJob(j, a) }))
      .sort((x, y) => y.total - x.total);
    const top1 = scored[0];
    const top1Major = top1.job.cat.split(" ")[0];
    const alt = scored.find(s => s.job.cat.split(" ")[0] !== top1Major && s.total >= 55) || scored[3];
    return {
      time: Date.now(),
      persona: a.persona,
      interests: [...a.interests],
      skills: [...a.skills],
      traits: { ...a.traits },
      prefs: [...a.prefs],
      top: scored.slice(0, 3),
      alt,
    };
  }

  function gapSkills(report) {
    const j = report && report.top && report.top[0] ? report.top[0].job : null;
    if (!j) return [];
    return Object.entries(j.fit.skills)
      .filter(([, w]) => w >= 0.4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => ALL_SKILLS.find(x => x.id === id))
      .filter(Boolean);
  }

  function gapCoursePlan(missing) {
    if (!missing || !missing.length) return [];
    return COURSES
      .map(c => ({ c, hits: c.skills.filter(s => missing.includes(s)).length }))
      .filter(x => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map(x => x.c);
  }

  function reasonText(a, m) {
    const j = m.job, out = [];
    const hitInterests = a.interests
      .filter(id => (j.fit.interests[id] || 0) >= 0.6)
      .map(id => INTERESTS.find(x => x.id === id)?.label);
    if (hitInterests.length) out.push(`你的兴趣「${hitInterests.slice(0, 2).join("、")}」与该职位高度重合`);
    const hitSkills = a.skills
      .filter(id => (j.fit.skills[id] || 0) >= 0.6)
      .map(id => SKILL_LABELS[id]);
    if (hitSkills.length) out.push(`你已掌握所需技能：${hitSkills.slice(0, 3).join("、")}`);
    const topTraits = TRAITS
      .filter(t => (j.fit.traits[t.id] || 0) >= 0.8 && a.traits[t.id] >= 7)
      .map(t => t.label);
    if (topTraits.length) out.push(`你的「${topTraits.slice(0, 2).join("、")}」优势正是这个岗位的核心要求`);
    const hitPrefs = a.prefs
      .filter(id => (j.fit.prefs[id] || 0) >= 0.7)
      .map(id => PREF_ITEMS.find(x => x.id === id)?.label);
    if (hitPrefs.length) out.push(`符合你「${hitPrefs[0]}」的求职偏好`);
    if (a.persona && j.persona[a.persona] >= 0.85) {
      const personaMsg = {
        mid: "该职位看重阅历积累，经验是加分项",
        mom: "该职位时间弹性，适合兼顾家庭",
      };
      if (personaMsg[a.persona]) out.push(personaMsg[a.persona]);
    }
    if (!out.length) out.push("综合五维测评结果，该职位与你较为匹配");
    return out.slice(0, 3);
  }

  function jobById(id) { return JOBS.find(j => j.id === id); }
  function courseById(id) { return COURSES.find(c => c.id === id); }

  const LEVELS = [
    [0, "Lv.1 启航新人"], [150, "Lv.2 探索者"], [400, "Lv.3 进阶者"],
    [750, "Lv.4 行动派"], [1200, "Lv.5 职场达人"],
  ];

  function levelOf(xp) {
    let cur = LEVELS[0], next = null;
    for (let i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i][0]) cur = LEVELS[i];
      else { next = LEVELS[i]; break; }
    }
    const base = cur[0], span = next ? next[0] - base : 1;
    const pct = next ? Math.min(100, ((xp - base) / span) * 100) : 100;
    return { label: cur[1], pct };
  }

  const AGE_BIAS_RULES = [
    { word: "28岁以下", level: "high", desc: "直接设定年龄上限，属于明显的年龄歧视表述", suggestion: "删除年龄限制，改为「具备相关经验」" },
    { word: "35岁以下", level: "high", desc: "直接设定年龄上限，35+求职者会被自动筛除", suggestion: "删除年龄限制，改为「3年以上相关经验」" },
    { word: "95后", level: "high", desc: "以出生年份筛选候选人，变相排除35+群体", suggestion: "改为「年轻有活力」或直接删除" },
    { word: "00后", level: "high", desc: "以出生年份筛选候选人，变相排除35+群体", suggestion: "改为「学习能力强」或直接删除" },
    { word: "年龄不超过", level: "high", desc: "直接的年龄歧视表述", suggestion: "删除，改为对经验和能力的要求" },
    { word: "限应届", level: "high", desc: "排除了所有非应届求职者，35+群体完全无法投递", suggestion: "改为「欢迎应届及有经验者」" },
    { word: "应届毕业生", level: "medium", desc: "如非校招岗位，此表述会排除有经验的求职者", suggestion: "改为「1-3年经验或优秀应届生」" },
    { word: "统招本科", level: "medium", desc: "隐含筛选年轻群体的意图，35+求职者可能第一学历非统招", suggestion: "改为「本科及以上学历」" },
    { word: "抗压能力强", level: "medium", desc: "常用于暗示需要高强度加班，对需要兼顾家庭的求职者不利", suggestion: "改为「能高效完成工作任务」" },
    { word: "能接受高强度", level: "medium", desc: "直接暗示加班文化，对35+求职者不公平", suggestion: "改为「能在规定时间内高质量交付」" },
    { word: "未婚优先", level: "medium", desc: "婚姻状况歧视，违反劳动法相关规定", suggestion: "删除此表述" },
    { word: "无生育计划", level: "high", desc: "直接涉及生育歧视，违反多项劳动法规", suggestion: "删除此表述，属违法内容" },
  ];

  function detectAgeBias(text) {
    if (!text) return { score: 0, riskLevel: "安全", riskColor: "#2ea56a", issues: [], summary: "未输入内容" };
    const found = [];
    for (const rule of AGE_BIAS_RULES) {
      if (text.includes(rule.word)) found.push({ ...rule });
    }
    let score = 0;
    const weights = { high: 25, medium: 12, low: 5 };
    for (const item of found) score += weights[item.level] || 0;
    score = Math.min(100, score);
    let riskLevel, riskColor;
    if (score === 0) { riskLevel = "安全"; riskColor = "#2ea56a"; }
    else if (score <= 15) { riskLevel = "低风险"; riskColor = "#0284c7"; }
    else if (score <= 40) { riskLevel = "中风险"; riskColor = "#d97706"; }
    else { riskLevel = "高风险"; riskColor = "#dc2626"; }
    let summary;
    if (score === 0) summary = '未检测到年龄歧视风险，该文本表述规范安全。';
    else if (score <= 15) summary = `检测到轻微风险表述（${found.length}处），建议优化措辞以提升 35+ 求职者通过率。`;
    else if (score <= 40) summary = `检测到 ${found.length} 处中等风险表述，强烈建议修改以避免 35+ 求职者被筛除。`;
    else summary = `检测到 ${found.length} 处高风险年龄歧视表述，该文本将严重阻碍 35+ 求职者获得面试机会！`;
    return { score, riskLevel, riskColor, issues: found, summary };
  }

  // 多维度简历诊断
  function diagnoseResume(text, targetJob) {
    if (!text || !text.trim()) return null;
    const t = text.trim();
    const lines = t.split(/\n/).filter(l => l.trim());
    const result = {
      totalScore: 0,
      dimensions: [],
      summary: '',
      suggestions: []
    };

    // 1. 年龄歧视检测（复用已有）
    const ageBias = detectAgeBias(t);
    result.dimensions.push({
      name: '年龄歧视风险',
      icon: 'ri-shield-check-line',
      score: Math.max(0, 100 - ageBias.score),
      weight: 20,
      detail: ageBias.issues.length
        ? `检测到 ${ageBias.issues.length} 处风险表述`
        : '未检测到年龄歧视风险',
      issues: ageBias.issues,
      color: ageBias.riskColor
    });

    // 2. 简历结构完整性
    const hasContact = /[\w.-]+@[\w.-]+|1[3-9]\d{9}|微信|手机|电话|联系方式/.test(t);
    const hasWork = /工作经历|工作经验|从业经历|任职|就职|负责|担任|参与/.test(t);
    const hasEdu = /教育背景|学历|毕业|学位|本科|大专|硕士|博士|学校/.test(t);
    const hasSkill = /技能|能力|掌握|熟悉|精通|了解|熟练|擅长/.test(t);
    const hasSelf = /自我评价|个人简介|自我介绍|关于我|个人总结/.test(t);
    const structScore = (hasContact ? 20 : 0) + (hasWork ? 30 : 0) + (hasEdu ? 20 : 0) + (hasSkill ? 20 : 0) + (hasSelf ? 10 : 0);
    const structIssues = [];
    if (!hasContact) structIssues.push('缺少联系方式（邮箱/手机/微信号）');
    if (!hasWork) structIssues.push('缺少工作经历描述');
    if (!hasEdu) structIssues.push('缺少教育背景');
    if (!hasSkill) structIssues.push('缺少技能/能力描述');
    if (!hasSelf) structIssues.push('缺少自我评价');
    result.dimensions.push({
      name: '结构完整性',
      icon: 'ri-file-list-3-line',
      score: structScore,
      weight: 15,
      detail: `包含 ${5 - structIssues.length}/5 个核心模块`,
      issues: structIssues.map(i => ({ word: '缺失', desc: i, suggestion: '建议补充该模块，提升HR阅读效率' })),
      color: structScore >= 80 ? '#2ea56a' : structScore >= 50 ? '#d97706' : '#dc2626'
    });

    // 3. 量化成果评估
    const numbers = t.match(/\d+[%万元人天次个月年项目个]|提升|增长|节省|完成|达成|超过|排名|TOP/g) || [];
    const quantified = t.match(/\d+[%％]|[为创建增节省].*?\d+/g) || [];
    const hasResult = /成果|业绩|成就|效果|成绩|贡献|突破/.test(t);
    const quantScore = Math.min(100, (quantified.length >= 5 ? 40 : quantified.length >= 2 ? 25 : quantified.length >= 1 ? 15 : 0) + (hasResult ? 20 : 0) + (numbers.length >= 5 ? 40 : numbers.length >= 2 ? 25 : numbers.length >= 1 ? 15 : 0));
    result.dimensions.push({
      name: '量化成果',
      icon: 'ri-bar-chart-grouped-line',
      score: quantScore,
      weight: 20,
      detail: `发现 ${quantified.length} 处量化表述，${numbers.length} 个数据指标`,
      issues: quantScore < 50 ? [{ word: '不足', desc: '缺少量化数据支撑', suggestion: '用「提升30%」「节省5万」「管理10人团队」等具体数据替代模糊描述' }] : [],
      color: quantScore >= 70 ? '#2ea56a' : quantScore >= 40 ? '#d97706' : '#dc2626'
    });

    // 4. 关键词密度
    const skillKeywords = ['管理','领导','协调','沟通','策划','执行','分析','设计','开发','运营','营销','销售','财务','行政','人事','客服','项目','产品','数据','市场'];
    const hitKeywords = skillKeywords.filter(k => t.includes(k));
    const kwScore = Math.min(100, hitKeywords.length * 8);
    result.dimensions.push({
      name: '关键词覆盖',
      icon: 'ri-key-2-line',
      score: kwScore,
      weight: 15,
      detail: `匹配 ${hitKeywords.length} 个核心能力关键词`,
      issues: kwScore < 50 ? [{ word: '偏少', desc: '关键词密度不足，可能被ATS系统筛除', suggestion: `建议补充：${skillKeywords.filter(k => !t.includes(k)).slice(0, 3).join('、')} 等关键词` }] : [],
      color: kwScore >= 70 ? '#2ea56a' : kwScore >= 40 ? '#d97706' : '#dc2626'
    });

    // 5. 空窗期风险
    const gapPatterns = [
      /空白期.*?(\d+)\s*个月/,
      /空窗.*?(\d+)\s*个?月/,
      /离职.*?(\d+)\s*个?月/,
      /(\d{4})\s*[-–~至到]\s*(\d{4})/g
    ];
    let gapRisk = 0;
    const gapDetails = [];
    for (const p of gapPatterns) {
      const m = t.match(p);
      if (m) {
        const months = parseInt(m[1]) || 0;
        if (months > 12) { gapRisk += 30; gapDetails.push(`检测到较长空白期（${months}个月）`); }
        else if (months > 6) { gapRisk += 15; gapDetails.push(`检测到中等空白期（${months}个月）`); }
      }
    }
    // 检查是否有解释空白期的关键词
    if (gapRisk > 0 && /学习|进修|考证|培训|照顾|育儿|自由职业|创业|兼职/.test(t)) {
      gapRisk = Math.max(0, gapRisk - 15);
      gapDetails.push('已包含空白期解释（学习/照顾/创业等）');
    }
    const gapScore = Math.max(0, 100 - gapRisk);
    result.dimensions.push({
      name: '空窗期风险',
      icon: 'ri-calendar-todo-line',
      score: gapScore,
      weight: 15,
      detail: gapRisk > 0 ? `检测到潜在空白期风险 ${gapDetails.length} 项` : '未检测到明显空窗期风险',
      issues: gapRisk > 15 ? gapDetails.map(d => ({ word: '空白期', desc: d, suggestion: '建议正面解释空白期，强调期间的成长（学习、考证、照顾家庭等）' })) : [],
      color: gapScore >= 80 ? '#2ea56a' : gapScore >= 50 ? '#d97706' : '#dc2626'
    });

    // 6. 表述专业度
    const weakWords = ['负责过','做过','参与了','帮忙','打杂','还行','还可以','一般','普通','基本'];
    const strongWords = ['主导','统筹','推动','优化','提升','突破','达成','荣获','负责','领导'];
    const weakHits = weakWords.filter(w => t.includes(w));
    const strongHits = strongWords.filter(w => t.includes(w));
    const profScore = Math.min(100, Math.max(0, 50 + strongHits.length * 10 - weakHits.length * 15));
    result.dimensions.push({
      name: '表述专业度',
      icon: 'ri-quill-pen-line',
      score: profScore,
      weight: 15,
      detail: `使用 ${strongHits.length} 个专业动词，${weakHits.length} 个弱化表述`,
      issues: weakHits.length > 0 ? weakHits.map(w => ({ word: `「${w}」`, desc: '弱化表述，降低专业感', suggestion: `替换为：主导/统筹/推动/优化 等强有力动词` })) : [],
      color: profScore >= 70 ? '#2ea56a' : profScore >= 40 ? '#d97706' : '#dc2626'
    });

    // 计算加权总分
    let total = 0;
    for (const d of result.dimensions) {
      total += d.score * (d.weight / 100);
    }
    result.totalScore = Math.round(total);

    // 生成综合评语
    if (total >= 80) result.summary = '简历质量优秀，结构完整、表述专业、数据充分，面试邀约率较高。';
    else if (total >= 60) result.summary = '简历质量良好，部分维度有优化空间，针对性改进后可显著提升竞争力。';
    else if (total >= 40) result.summary = '简历存在一定短板，建议按照诊断建议逐项优化，避免被HR快速淘汰。';
    else result.summary = '简历存在较多问题，建议重点优化结构、量化成果和表述方式，否则很难获得面试机会。';

    // 生成优化建议
    if (ageBias.issues.length) result.suggestions.push('消除年龄歧视表述，用能力描述替代年龄限制');
    if (!hasContact) result.suggestions.push('添加清晰的联系方式，方便HR第一时间联系你');
    if (quantScore < 50) result.suggestions.push('用具体数据量化工作成果（提升了多少、节省了多少、管理了多少人）');
    if (weakHits.length > 0) result.suggestions.push('将弱化动词替换为「主导」「统筹」「推动」等专业动词');
    if (kwScore < 50) result.suggestions.push('补充目标岗位的核心技能关键词，提升ATS通过率');
    if (gapRisk > 15) result.suggestions.push('正面解释空白期，强调期间的学习成长或家庭责任');

    return result;
  }

  return {
    scoreJob, buildReport, gapSkills, gapCoursePlan, reasonText, jobById, courseById, levelOf, detectAgeBias, diagnoseResume
  };
}));
